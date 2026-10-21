import io
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.concurrency import run_in_threadpool
from pypdf import PdfReader
from pypdf.errors import PdfReadError
from sqlalchemy.orm import Session

from app.auth import CurrentUserId
from app.db import get_db
from app.models import CvProfile
from app.schemas.cv import CV_MAX_CHARS, CvRead, CvUpdate, PdfText

router = APIRouter(prefix="/cv", tags=["cv"])

DbSession = Annotated[Session, Depends(get_db)]

PDF_MAX_BYTES = 2 * 1024 * 1024
PDF_MAX_PAGES = 10


@router.get("", response_model=CvRead)
def get_cv(db: DbSession, user_id: CurrentUserId) -> CvProfile:
    cv = db.get(CvProfile, user_id)
    if cv is None:
        raise HTTPException(status_code=404, detail="No CV yet")
    return cv


@router.put("", response_model=CvRead)
def save_cv(payload: CvUpdate, db: DbSession, user_id: CurrentUserId) -> CvProfile:
    cv = db.get(CvProfile, user_id) or CvProfile(user_id=user_id)
    cv.content = payload.content
    cv.format = payload.format
    db.add(cv)
    db.commit()
    db.refresh(cv)
    return cv


@router.delete("", status_code=204)
def delete_cv(db: DbSession, user_id: CurrentUserId) -> Response:
    cv = db.get(CvProfile, user_id)
    if cv is not None:
        db.delete(cv)
        db.commit()
    return Response(status_code=204)


@router.post("/pdf", response_model=PdfText)
async def extract_pdf_text(request: Request, user_id: CurrentUserId) -> PdfText:
    """Body = the raw PDF (Content-Type: application/pdf). Returns its text for the user to
    review and save with PUT /cv; neither the PDF nor the text is stored here."""
    if request.headers.get("content-type", "").split(";")[0].strip() != "application/pdf":
        raise HTTPException(status_code=415, detail="Upload a PDF file")

    # Read in chunks and stop at the limit, so a huge upload can't fill the server's memory
    # (Content-Length can be missing or wrong, so it isn't trusted).
    data = bytearray()
    async for chunk in request.stream():
        data += chunk
        if len(data) > PDF_MAX_BYTES:
            raise HTTPException(status_code=413, detail="PDF is larger than 2 MB")
    if not data.startswith(b"%PDF-"):
        raise HTTPException(status_code=422, detail="Not a PDF file")

    # Parsing is CPU work: run it in a thread so other requests aren't blocked meanwhile.
    return await run_in_threadpool(_pdf_to_text, bytes(data))


def _pdf_to_text(data: bytes) -> PdfText:
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise HTTPException(status_code=422, detail="This PDF is password-protected")
        if len(reader.pages) > PDF_MAX_PAGES:
            raise HTTPException(
                status_code=422, detail=f"A CV PDF can have at most {PDF_MAX_PAGES} pages"
            )
        text = "\n\n".join(page.extract_text() or "" for page in reader.pages).strip()
    except (PdfReadError, ValueError, KeyError) as error:
        raise HTTPException(status_code=422, detail="This PDF could not be read") from error

    if not text:
        raise HTTPException(
            status_code=422,
            detail="No text found in this PDF (is it a scanned image?). Paste your CV instead.",
        )
    if len(text) > CV_MAX_CHARS:
        raise HTTPException(status_code=422, detail="This PDF has too much text for a CV")
    return PdfText(text=text, pages=len(reader.pages))

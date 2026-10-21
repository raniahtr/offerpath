from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator


class EditOp(BaseModel):
    """One change to the CV's .tex body, proposed by the LLM and applied by code.

    Lines are addressed by id ("L1" = first line after \\begin{document}; "L0" = before it,
    only as an anchor). All fields are required (nullable instead of optional), as strict
    JSON-schema mode demands.
    """

    model_config = ConfigDict(extra="forbid")

    op: Literal["replace", "insert_after", "delete", "move"]
    line: str = Field(description="Line to replace/delete/move, or the anchor to insert after.")
    text: str | None = Field(description="New LaTeX line for replace/insert_after, else null.")
    after: str | None = Field(description="For move: the line id to move after, else null.")
    sources: list[str] = Field(
        max_length=5, description="Exact quotes from the CV or the user's facts backing this."
    )
    reason: str = Field(max_length=300, description="Why, in one sentence, for the candidate.")

    @model_validator(mode="after")
    def _fields_match_op(self) -> Self:
        needs_text = self.op in ("replace", "insert_after")
        if needs_text != (self.text is not None):
            raise ValueError(f"'text' is {'required' if needs_text else 'not allowed'} here")
        needs_after = self.op == "move"
        if needs_after != (self.after is not None):
            raise ValueError(f"'after' is {'required' if needs_after else 'not allowed'} here")
        return self

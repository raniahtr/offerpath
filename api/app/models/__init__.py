# Import every model here so Base.metadata knows all tables (used by Alembic).
from app.models.application import Application, ApplicationStatus
from app.models.cv_profile import CvFormat, CvProfile
from app.models.fit_analysis import AnalysisSource, FitAnalysis
from app.models.llm_call import LlmCall
from app.models.posting import Posting

__all__ = [
    "AnalysisSource",
    "Application",
    "ApplicationStatus",
    "CvFormat",
    "CvProfile",
    "FitAnalysis",
    "LlmCall",
    "Posting",
]

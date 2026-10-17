# Import every model here so Base.metadata knows all tables (used by Alembic).
from app.models.application import Application, ApplicationStatus

__all__ = ["Application", "ApplicationStatus"]

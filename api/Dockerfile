# Base image: official Python 3.12 on a minimal Debian ("slim" drops compilers/docs → smaller image).
FROM python:3.12-slim

# Copy the uv binary out of uv's own image (pinned version) instead of pip-installing it.
COPY --from=ghcr.io/astral-sh/uv:0.12.21 /uv /bin/uv

# UV_PROJECT_ENVIRONMENT: put the venv in /opt/venv, OUTSIDE /app. In local dev, compose
#   mounts your ./api folder over /app; a venv inside /app would be hidden by that mount.
# UV_PYTHON_DOWNLOADS=never: use the image's Python, never download another one.
# UV_COMPILE_BYTECODE=1: precompile .pyc files at build time → faster container startup.
# PYTHONUNBUFFERED=1: print logs immediately instead of buffering them (so `docker logs` is live).
# PATH: make /opt/venv/bin/{uvicorn,pytest,...} callable without a prefix.
ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_PYTHON_DOWNLOADS=never \
    UV_COMPILE_BYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

# Create an unprivileged user (used at the end via USER): if the app is ever compromised,
# the attacker isn't root inside the container.
RUN useradd --create-home appuser

# All following commands run in /app (created if missing, owned by root by default).
# chown lets appuser write there too (e.g. pytest's cache).
WORKDIR /app
RUN chown appuser:appuser /app

# Build-time switch: `docker build --build-arg INSTALL_DEV=true` also installs pytest/ruff.
# Default false → production image without dev tools.
ARG INSTALL_DEV=false

# Copy ONLY the dependency files first. Docker caches each step ("layer"); as long as these
# files don't change, the slow install below is reused even when your code changes.
COPY pyproject.toml uv.lock .python-version ./
# --frozen: install exactly what uv.lock says; fail instead of re-resolving versions.
RUN if [ "$INSTALL_DEV" = "true" ]; then uv sync --frozen; else uv sync --frozen --no-dev; fi

# Now copy the application code (changes often → kept after the dependency layer),
# owned by appuser.
COPY --chown=appuser:appuser . .

# Run everything from here on (including CMD) as the unprivileged user.
USER appuser

# Documentation only: the app listens on 8000. Publishing the port happens in compose/hosting.
EXPOSE 8000

# Default command when the container starts. 0.0.0.0 = listen on all network interfaces;
# 127.0.0.1 would only accept connections from inside the container itself.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

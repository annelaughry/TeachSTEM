FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=lessons.settings

WORKDIR /app

# System deps + Node.js 20
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Python deps (own layer so they cache independently of app code)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# npm deps (own layer so they cache independently of frontend source)
COPY frontend/package*.json ./frontend/
RUN npm ci --prefix frontend

# Full source (frontend/node_modules excluded via .dockerignore)
COPY . .

# Build React — creates frontend/dist/ inside the image
RUN npm run build --prefix frontend

# Django static files (admin CSS, etc.) baked into the image
RUN python manage.py collectstatic --noinput

RUN chmod +x docker-entrypoint.sh \
    && adduser --disabled-password --gecos '' appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

ENTRYPOINT ["/bin/sh", "/app/docker-entrypoint.sh"]

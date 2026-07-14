# Django API image. The React app is built separately and deployed to
# S3 + CloudFront (see DEPLOYMENT.md) -- it does not live in this image.

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=lessons.settings

WORKDIR /app

# System deps: none needed beyond what's in the slim image, since
# psycopg[binary] ships its own libpq.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Static assets (Django admin CSS, DRF browsable API CSS, etc.) don't
# need a live DB, so bake them into the image at build time.
RUN python manage.py collectstatic --noinput

RUN chmod +x docker-entrypoint.sh \
    && adduser --disabled-password --gecos '' appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

ENTRYPOINT ["/bin/sh", "/app/docker-entrypoint.sh"]

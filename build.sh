#!/usr/bin/env bash
set -e

echo "--- Installing Python dependencies ---"
pip install -r requirements.txt

echo "--- Collecting Django static files ---"
python manage.py collectstatic --noinput

echo "--- Running database migrations ---"
python manage.py migrate

echo "--- Build complete ---"

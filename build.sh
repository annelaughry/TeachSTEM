#!/usr/bin/env bash
set -e  # exit immediately if any command fails

echo "--- Installing Python dependencies ---"
pip install -r requirements.txt

echo "--- Building React frontend ---"
cd frontend
npm install
npm run build
cd ..

echo "--- Collecting Django static files ---"
python manage.py collectstatic --noinput

echo "--- Running database migrations ---"
python manage.py migrate

echo "--- Build complete ---"

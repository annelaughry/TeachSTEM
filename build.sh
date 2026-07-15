#!/usr/bin/env bash
set -e

# --- Node.js ---
# Render's Python environment doesn't include Node. Download it once;
# subsequent builds reuse the cached binary if Render preserves $HOME.
NODE_VERSION="20.11.0"
NODE_BIN="$HOME/.local/node/bin"
export PATH="$NODE_BIN:$PATH"

if ! node --version 2>/dev/null | grep -q "^v20"; then
  echo "--- Downloading Node.js $NODE_VERSION ---"
  mkdir -p "$HOME/.local/node"
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.gz" \
    | tar -xz -C "$HOME/.local/node" --strip-components=1
fi
echo "Node: $(node --version)  npm: $(npm --version)"

# --- React build ---
echo "--- Building React frontend ---"
cd frontend
npm ci
npm run build
cd ..

# --- Python ---
echo "--- Installing Python dependencies ---"
pip install -r requirements.txt

echo "--- Collecting Django static files ---"
python manage.py collectstatic --noinput

echo "--- Running database migrations ---"
python manage.py migrate

echo "--- Build complete ---"

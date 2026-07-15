#!/usr/bin/env bash
set -e

# --- Node.js ---
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
npm install
npm run build
cd ..
echo "--- React dist contents: ---"
ls frontend/dist/

# --- Python ---
echo "--- Installing Python dependencies ---"
pip install -r requirements.txt

echo "--- Collecting Django static files ---"
python manage.py collectstatic --noinput

# Copy the React build into staticfiles/ so it is available at runtime.
# frontend/dist/ lives in the build environment; staticfiles/ is the
# directory whitenoise serves from and is guaranteed to persist.
echo "--- Copying React build into staticfiles/ ---"
cp frontend/dist/index.html staticfiles/index.html
cp -r frontend/dist/assets staticfiles/assets
cp -r frontend/dist/fonts  staticfiles/fonts
cp    frontend/dist/logo.png staticfiles/logo.png

echo "--- Running database migrations ---"
python manage.py migrate

echo "--- Build complete ---"

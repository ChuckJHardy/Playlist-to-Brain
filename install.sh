#!/usr/bin/env bash
set -euo pipefail

cat <<'EOF'
playlist-to-brain installer
===========================

This will:
  1. Install Homebrew packages: yt-dlp, whisper-cpp, ffmpeg, node
       (yt-dlp pulls playlist data and captions; whisper-cpp transcribes
        videos that have no captions; ffmpeg decodes audio for whisper;
        node runs the CLI.)
  2. Download the whisper model (~1.5 GB, one-time) used as the
     transcription fallback when YouTube has no captions.
  3. Run "npm install", "npm run build", and "npm install -g ." so
     the "playlist-to-brain" command is on your PATH globally.

Anything already installed is skipped. No API keys, no OAuth, no cookies.

EOF

# 1. Homebrew deps (skipped if already present)
echo "==> Step 1/3: Homebrew packages"
if ! command -v brew >/dev/null 2>&1; then
  echo "ERROR: Homebrew is required. Install from https://brew.sh and re-run." >&2
  exit 1
fi

for pkg in yt-dlp whisper-cpp ffmpeg node; do
  if brew list --formula "$pkg" >/dev/null 2>&1; then
    echo "    $pkg already installed — skipping."
  else
    echo "    Installing $pkg..."
    brew install "$pkg"
  fi
done

# 2. Whisper model — defaults to large-v3-turbo, override with $WHISPER_MODEL_NAME
echo
echo "==> Step 2/3: Whisper model"
MODEL_NAME="${WHISPER_MODEL_NAME:-ggml-large-v3-turbo.bin}"
MODEL_DIR="${WHISPER_MODEL_DIR:-$HOME/.local/share/whisper}"
mkdir -p "$MODEL_DIR"
if [ -f "$MODEL_DIR/$MODEL_NAME" ]; then
  echo "    $MODEL_NAME already present in $MODEL_DIR — skipping."
else
  echo "    Downloading $MODEL_NAME to $MODEL_DIR (~1.5 GB)..."
  curl -L --fail \
    -o "$MODEL_DIR/$MODEL_NAME" \
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/$MODEL_NAME"
fi

# 3. Build & install the CLI globally
echo
echo "==> Step 3/3: Build and link the CLI"
echo "    Running npm install..."
npm install
echo "    Running npm run build..."
npm run build
echo "    Linking globally with npm install -g ..."
npm install -g .

echo
echo "Done. Run 'playlist-to-brain doctor' to verify the install."

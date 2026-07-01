# resources/

Place external binaries here before running in development or building for distribution.

## Expected structure

```
resources/
├── ffmpeg/
│   ├── ffmpeg          # macOS / Linux binary
│   └── ffmpeg.exe      # Windows binary
├── whisper/
│   ├── whisper-cli     # macOS / Linux binary (or `main` from a raw build)
│   ├── whisper-cli.exe # Windows binary
│   └── models/
│       └── ggml-small.bin   # Whisper GGML model file
└── README.md
```

> Binary files and model files are gitignored. Only this README and the
> `.gitkeep` placeholder files are committed.

---

## FFmpeg

Download from <https://ffmpeg.org/download.html> and place the binary here,
**or** install it globally on your system PATH.

| Platform | Binary path |
|----------|-------------|
| Windows  | `resources/ffmpeg/ffmpeg.exe` |
| macOS    | `resources/ffmpeg/ffmpeg` |
| Linux    | `resources/ffmpeg/ffmpeg` |

The app checks `resources/ffmpeg/` first, then falls back to the system PATH.

---

## Whisper CLI

Build from source or download a pre-built binary from
<https://github.com/ggerganov/whisper.cpp>.

**Build from source (all platforms):**

```bash
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
make -j4
```

Then copy the compiled binary:

| Platform | Source binary | Destination |
|----------|---------------|-------------|
| Windows  | `build/bin/whisper-cli.exe` | `resources/whisper/whisper-cli.exe` |
| macOS    | `whisper-cli` or `main` | `resources/whisper/whisper-cli` |
| Linux    | `whisper-cli` or `main` | `resources/whisper/whisper-cli` |

The app checks `resources/whisper/` first (for `whisper-cli`, then `main`),
then falls back to `whisper-cli` on the system PATH.

---

## Whisper Models

Download GGML model files from
<https://huggingface.co/ggerganov/whisper.cpp/tree/main>.

You can either:

### Option A — Place in `resources/whisper/models/` (bundled with the dev build)

```bash
# Example: small model (~466 MB)
curl -L -o resources/whisper/models/ggml-small.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin
```

### Option B — Place in the app data directory (available to packaged app)

| Platform | Path |
|----------|------|
| macOS    | `~/Library/Application Support/video-clipper/whisper-models/` |
| Windows  | `%APPDATA%\video-clipper\whisper-models\` |
| Linux    | `~/.config/video-clipper/whisper-models/` |

The app checks `resources/whisper/models/` first, then the app data directory.

### Available model sizes

| Model  | Size    | Accuracy | Speed    |
|--------|---------|----------|----------|
| tiny   | ~75 MB  | Lowest   | Fastest  |
| base   | ~142 MB | Low      | Fast     |
| small  | ~466 MB | Good     | Balanced |
| medium | ~1.5 GB | High     | Slow     |
| large  | ~3 GB   | Best     | Slowest  |

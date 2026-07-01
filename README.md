# Video Clipper & Caption Generator

A cross-platform desktop app for splitting long-form videos into short clips with TikTok-style animated captions. Fully offline — no cloud API required.

## Features

- **Video Import & Splitting** — Fixed duration, fixed count, silence-based, or scene-change detection
- **Automatic Captioning** — Word-level speech-to-text via Whisper, with pop/karaoke/fade animations
- **LLM-Assisted Features (optional)** — Highlight detection, title generation, transcript cleanup via local Ollama
- **Batch Export** — Split, transcribe, caption, and export all clips in one workflow
- **Fully Offline** — No cloud API dependency for core features

## Tech Stack

| Layer | Technology |
|-------|-----------|
| App shell | Electron |
| Frontend | React 18 + TypeScript + Zustand |
| Video processing | FFmpeg (binary, bundled separately) |
| Speech-to-text | Whisper (whisper.cpp binary) |
| Optional LLM | Ollama (local, user-installed) |
| Packaging | electron-builder |

## Prerequisites

> [!NOTE]
> **Development vs. packaged:** In dev mode (`npm run dev`), the app looks for binaries in the local `resources/` directory **or** on the system PATH. A packaged build bundles everything from `resources/` automatically. See [`resources/README.md`](resources/README.md) for the full directory layout.

### Required for development

1. **FFmpeg** — place the binary at `resources/ffmpeg/ffmpeg[.exe]`, or install globally:
   ```bash
   # macOS
   brew install ffmpeg
   # Ubuntu/Debian
   apt install ffmpeg
   # Windows — download from https://ffmpeg.org/download.html and add to PATH
   ```

2. **whisper.cpp CLI** — build from source and copy to `resources/whisper/`:
   ```bash
   git clone https://github.com/ggerganov/whisper.cpp
   cd whisper.cpp
   make -j4

   # macOS / Linux
   cp whisper-cli /path/to/auto-clipper/resources/whisper/whisper-cli

   # Windows (MinGW / CMake build)
   copy build\bin\whisper-cli.exe \path\to\auto-clipper\resources\whisper\whisper-cli.exe
   ```
   Or install a pre-built binary and ensure `whisper-cli` is on your PATH.

3. **Whisper GGML model** — download from [huggingface.co/ggerganov/whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp/tree/main) and place in `resources/whisper/models/`:
   ```bash
   # Recommended: small model (~466 MB)
   curl -L -o resources/whisper/models/ggml-small.bin \
     https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin
   ```
   Alternatively, place the model in the platform-specific app data directory:

   | Platform | Path |
   |----------|------|
   | macOS    | `~/Library/Application Support/video-clipper/whisper-models/` |
   | Windows  | `%APPDATA%\video-clipper\whisper-models\` |
   | Linux    | `~/.config/video-clipper/whisper-models/` |

### Optional

4. **Ollama** — download from [ollama.ai](https://ollama.ai) and pull a model:
   ```bash
   ollama pull llama3.2
   ```
   The app auto-detects Ollama at startup. If not found, LLM features are gracefully disabled.

## Setup & Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Type checking
npm run typecheck

# Run tests
npm test
```

## Building for Distribution

```bash
# Build for macOS
npm run build:mac

# Build for Windows
npm run build:win

# Build unpacked (for testing)
npm run build:unpack
```

## Project Structure

```
auto-clipper/
├── resources/             # Place external binaries here (gitignored except scaffold)
│   ├── ffmpeg/
│   │   └── ffmpeg[.exe]   # FFmpeg binary (or use system PATH)
│   ├── whisper/
│   │   ├── whisper-cli[.exe]  # whisper.cpp binary (or use system PATH)
│   │   └── models/
│   │       └── ggml-small.bin # GGML model file
│   └── README.md          # Full setup instructions
├── src/
│   ├── main/              # Electron main process
│   │   ├── index.ts       # Entry point
│   │   ├── ipc-handlers.ts
│   │   ├── ffmpeg/        # FFmpeg binary resolution, splitting, caption burning
│   │   ├── whisper/       # Whisper binary/model resolution, transcription
│   │   ├── llm/           # Ollama client, LLM prompts
│   │   └── utils/         # Progress, error handling, path resolution
│   ├── preload/           # Context bridge (IPC exposure)
│   └── renderer/          # React UI
│       ├── components/    # ImportView, SplitSettings, ClipPreview, etc.
│       ├── store/         # Zustand state management
│       └── styles/        # Global CSS
├── tests/                 # Vitest tests
└── electron-builder.yml   # Build configuration
```

## Architecture Overview

### Processing Pipeline

```
Import Video → Split Settings → Compute Split Points
                                    ↓
                              Preview / Adjust
                                    ↓
                           Transcribe Audio (Whisper)
                                    ↓
                           Configure Caption Style
                                    ↓
                    Split Video + Burn Captions (FFmpeg)
                                    ↓
                              Export to Output Dir
```

### Key Design Decisions

- **FFmpeg filter strings** are built by modular functions in `filters.ts` — no hardcoded strings scattered across files
- **Ollama integration** is isolated behind a clean interface in `llm/ollama.ts` — core pipeline never depends on it
- **Word-level timestamps** from Whisper enable precise per-word caption animation via FFmpeg's `drawtext` filter
- **Progress is streamed** from main process to renderer via IPC events for real-time UI feedback

## Settings Reference

### Whisper Model
| Model | Size | Accuracy | Speed |
|-------|------|----------|-------|
| tiny | ~75MB | Lowest | Fastest |
| base | ~142MB | Low | Fast |
| small | ~466MB | Good | Balanced |
| medium | ~1.5GB | High | Slow |
| large | ~3GB | Best | Slowest |

### Split Modes
- **Fixed Duration**: Split every N seconds (configurable 15–180s)
- **Fixed Count**: Split into N equal-length clips
- **Silence-Based**: Detects silence gaps via FFmpeg's `silencedetect` filter
- **Scene Change**: Detects scene cuts via FFmpeg's `scdet` filter

### Caption Styles
- **Animation**: Pop (word-by-word), Karaoke (highlighted word), Fade (smooth in/out)
- **Position**: Lower third, Center, Top
- **Font, Size, Colors**: Fully customizable

### LLM Features (require Ollama)
- **Highlight Detection**: Suggests engaging segments from transcript
- **Title Generation**: Creates titles and hooks for each clip
- **Transcript Cleanup**: Removes filler words (um, uh) — opt-in toggle

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

### Required

1. **FFmpeg** — Download from [ffmpeg.org](https://ffmpeg.org) and place the binary at:
   - `resources/ffmpeg/ffmpeg` (macOS/Linux)
   - `resources/ffmpeg/ffmpeg.exe` (Windows)
   - Or install globally via `brew install ffmpeg` (macOS) / `apt install ffmpeg` (Linux) / [Windows installer](https://ffmpeg.org/download.html)

2. **whisper.cpp model** — Download a GGML model from [huggingface.co/ggerganov/whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp/tree/main):
   ```bash
   # Recommended: small model (~466MB)
   curl -L -o ~/Library/Application\ Support/video-clipper/whisper-models/ggml-small.bin \
     https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin
   ```
   Or use tiny/base for faster but less accurate results.

3. **whisper.cpp CLI** — Build from [github.com/ggerganov/whisper.cpp](https://github.com/ggerganov/whisper.cpp):
   ```bash
   git clone https://github.com/ggerganov/whisper.cpp
   cd whisper.cpp
   make -j4
   # Copy the `main` binary to:
   cp main ../video-clipper/resources/whisper/whisper-cli
   ```

### Optional

4. **Ollama** — Download from [ollama.ai](https://ollama.ai) and pull a model:
   ```bash
   ollama pull llama3.2
   ```
   The app auto-detects Ollama. If not found, LLM features are gracefully disabled.

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
video-clipper/
├── src/
│   ├── main/              # Electron main process
│   │   ├── index.ts       # Entry point
│   │   ├── ipc-handlers.ts
│   │   ├── ffmpeg/        # FFmpeg binary, splitting, caption burning
│   │   ├── whisper/       # Whisper binary, transcription
│   │   ├── llm/           # Ollama client, LLM prompts
│   │   └── utils/         # Progress, error handling
│   ├── preload/           # Context bridge (IPC exposure)
│   └── renderer/          # React UI
│       ├── components/    # ImportView, SplitSettings, ClipPreview, etc.
│       ├── store/         # Zustand state management
│       └── styles/        # Global CSS
├── tests/                 # Vitest tests
├── resources/             # Icons, bundled binaries
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

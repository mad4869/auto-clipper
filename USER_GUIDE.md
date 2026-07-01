# Video Clipper — User Guide

## Overview

Video Clipper helps you turn long videos into short, captioned clips ready for TikTok, Instagram Reels, or YouTube Shorts. Everything runs locally on your machine — no uploads, no cloud API.

---

## Quick Start

1. **Open the app** — You'll see the Import screen
2. **Select a video** — Click the dropzone or drag a file (MP4, MOV, MKV, AVI, WebM)
3. **Choose output folder** — Where your clips will be saved
4. **Configure splits** — Pick how to divide the video
5. **Preview & adjust** — See the split points, edit or remove clips
6. **Transcribe** — Let Whisper generate word-level captions
7. **Style captions** — Font, color, animation, position
8. **Export** — Process all clips and save them to your output folder

---

## Step-by-Step

### 1. Import

- Click the large dropzone to browse for a video file
- Select an output directory where clips will be saved
- Click **Continue**

### 2. Split Settings

Choose a splitting mode:

| Mode | How it works | Best for |
|------|-------------|----------|
| **Fixed Duration** | Every clip is the same length | Podcasts, lectures |
| **Fixed Count** | Video divided into N equal clips | Any |
| **Silence-Based** | Splits at silence gaps | Interviews, conversations |
| **Scene Change** | Splits at scene cuts | Vlogs, tutorials |

Adjust the slider and click **Preview Clips**.

### 3. Preview

See all your clips listed with start/end times:
- **Edit** — Drag the range sliders to adjust a clip's boundaries
- **Remove** — Delete a clip you don't want
- **AI Highlight Detection** — If Ollama is connected, click this to have the LLM suggest the most engaging segments

Click **Configure Captions** to proceed.

### 4. Caption Settings

**Step 1: Transcribe**
- Click **Transcribe Audio** to run Whisper on your video
- Wait for the transcription to complete
- If Ollama is available, **Clean up (LLM)** removes filler words

**Step 2: Style**
| Setting | Options |
|---------|---------|
| Font | Arial, Helvetica, Impact, Montserrat, etc. |
| Size | 16–48px |
| Text Color | Any hex color |
| Highlight Color | Color for karaoke-style emphasis |
| Position | Lower third, Center, Top |
| Animation | Pop (appears word-by-word), Karaoke (highlights current word), Fade (smooth transitions) |
| Words per line | 1–8 |

### 5. Export

Watch the progress bar as the app:
1. Splits your video into clips
2. Burns captions onto each clip
3. Exports .srt and .ass subtitle files alongside each clip

When complete, you'll see a summary of all generated files.

---

## Settings Panel

Click the gear icon in the top navigation bar.

### Whisper Model
- Choose model size: tiny / base / **small** (default) / medium / large
- Grayed-out options mean that model isn't downloaded yet
- Model locations (pick one):
  - **Local** (dev & packaged): `resources/whisper/models/ggml-<size>.bin`
  - **macOS**: `~/Library/Application Support/video-clipper/whisper-models/`
  - **Windows**: `%APPDATA%\video-clipper\whisper-models\`
  - **Linux**: `~/.config/video-clipper/whisper-models/`

### Ollama / Local LLM
- Shows connection status and available models
- If Ollama isn't running, setup instructions are shown

---

## LLM Features (Optional)

These features require Ollama running locally with a model pulled:

1. **Highlight Detection** (Preview screen) — Analyzes the transcript and suggests which segments are most engaging
2. **Title Generation** (Preview screen) — Creates TikTok-style hooks and titles
3. **Transcript Cleanup** (Caption screen) — Removes "um", "uh", "like" filler words

To enable:
```bash
# Install Ollama
# macOS: https://ollama.ai/download
# Linux: curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model
ollama pull llama3.2

# Restart the app
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "FFmpeg not found" | Place `ffmpeg[.exe]` in `resources/ffmpeg/`, or install FFmpeg globally |
| "Whisper model not found" | Download a GGML model from [huggingface.co/ggerganov/whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp/tree/main) and place in `resources/whisper/models/` or your platform's app data directory |
| "Ollama not running" | Start Ollama desktop app or run `ollama serve` |
| Transcription fails | Try a smaller model; check the audio is clear |
| Export takes too long | Use a smaller Whisper model; reduce number of clips |
| Captions are out of sync | Ensure the input video's audio is clear without background music |

---

## File Formats

| Format | Input | Output |
|--------|-------|--------|
| Video | MP4, MOV, MKV, AVI, WebM | MP4 (H.264 + AAC) |
| Subtitles | — | .srt, .ass |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+O / Cmd+O | Open video file |
| Ctrl+E / Cmd+E | Export |
| Escape | Close settings panel / Cancel edit |

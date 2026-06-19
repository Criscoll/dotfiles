---
name: image-read
description: >-
  Route image reading to the right tool: ocr-read for text extraction (offline,
  fast, free), vision-read for visual reasoning (charts, diagrams, layout).
  Auto-invoke when given any image file (.png, .jpg, .jpeg, .gif, .webp, .bmp,
  .tiff) or phrases like "read this image", "look at this screenshot", "what
  does this image say", "extract text from image", "analyze this image".
disable-model-invocation: false
---

When an image needs to be read, choose the right tool based on what the image
contains — not the quickest path.

## Routing Decision

| Use `ocr-read` | Use `vision-read` |
|---|---|
| Text extraction from docs, forms, receipts | Charts, diagrams, UI layouts, infographics |
| Image is primarily textual content | Needs visual reasoning beyond reading |
| Fast offline extraction, no API cost | Spatial relationships matter |
| Terminal output, log dumps, text screenshots | Complex mixed text + visuals |

**When in doubt:** if the image contains text you need to read, start with
`ocr-read`. It is free and instant after the first run. Fall back to
`vision-read` only if OCR output is garbled or misses structure.

## Script Check — Do This First

Both scripts are in `agent_scripts/` and deliberately not on `$PATH`. Verify:

```bash
ls ~/bin/agent_scripts/ocr-read ~/bin/agent_scripts/vision-read
```

If missing, stow from the dotfiles repo hasn't been run.

## `ocr-read` — Offline Text Extraction

```bash
# Basic extraction — English (default)
~/bin/agent_scripts/ocr-read screenshot.png

# Multi-language
~/bin/agent_scripts/ocr-read form.jpg --lang en,fr

# Capture output for further processing
text=$(~/bin/agent_scripts/ocr-read receipt.png)
```

**First-run note:** downloads EasyOCR models (~150MB) to `~/.EasyOCR/` — takes
1–2 minutes on first call. Every subsequent run is instant (models cached locally).

**Output:** plain text to stdout, one line per detected text block. No API
calls, no cost, no internet required after the first model download.

## `vision-read` — LLM-Powered Visual Analysis

```bash
# General image description
~/bin/agent_scripts/vision-read diagram.png

# Focused analysis with context
~/bin/agent_scripts/vision-read chart.png 'extract all data points and values'

# Visual bug inspection (compose with browser-screenshot)
SCREENSHOT=$(~/bin/agent_scripts/browser-screenshot)
~/bin/agent_scripts/vision-read "$SCREENSHOT" 'inspecting for visual bugs — misalignment, overlap, broken images'

# Override model for harder images
~/bin/agent_scripts/vision-read complex-diagram.png --model opus 'explain the architecture'
```

**Output:** rich prose from a vision-capable LLM (default:
`openrouter/moonshotai/kimi-k2.6`). Requires pi to be installed with a valid
API key.

## When to Use / Not Use

Use `ocr-read` for:
- Reading text in screenshots, scanned documents, forms, receipts
- Extracting terminal output or log content captured as an image
- Getting text out of an image before feeding it to another tool

Use `vision-read` for:
- Understanding what a chart or graph shows
- Diagnosing visual layout bugs in UI screenshots
- Describing UI flows, diagrams, or infographics
- Cases where spatial relationships or visual structure matter
- When `ocr-read` output is garbled or misses important structure

Do NOT reach for either tool if:
- The file is a PDF → use `pdfparse` instead
- You need to fetch an image from a URL → use `webcrawl` first to get the page,
  then save/read the image

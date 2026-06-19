---
name: pdf-parse
description: >-
  Extract text from PDF files for agent/LLM consumption. Supports local files
  and URLs, outputs markdown (default), JSON, or plain text. Uses pymupdf4llm
  (fast, good layout/table preservation) with automatic fallback to pdftotext.
  Auto-invoke BEFORE attempting to read, search, or extract content from a PDF
  file, processing any URL that ends in .pdf, or answering questions about
  document contents from a PDF. Trigger phrases: "pdf", "parse this pdf",
  "extract text from pdf", "read this pdf", "pdf file", "convert pdf to
  markdown", "scanned document".
disable-model-invocation: false
---

Extract text from PDFs using `~/bin/agent_scripts/pdfparse`, which wraps
pymupdf4llm (primary) with automatic fallback to pdftotext (poppler-utils).
Output goes to stdout; diagnostic messages go to stderr.

## Script Check — Do This First

`pdfparse` is in `agent_scripts/` and deliberately not on `$PATH`. Call by full path:

```bash
ls ~/bin/agent_scripts/pdfparse
```

If missing, stow from the dotfiles repo hasn't been run.

## Common Usage

```bash
# Basic extraction — markdown to stdout
~/bin/agent_scripts/pdfparse report.pdf

# URL download + extraction
~/bin/agent_scripts/pdfparse https://arxiv.org/pdf/2206.01062

# Select specific pages (1-based, supports ranges and lists)
~/bin/agent_scripts/pdfparse report.pdf --pages 1-5
~/bin/agent_scripts/pdfparse report.pdf --pages 1,3,7

# JSON output (pymupdf4llm required)
~/bin/agent_scripts/pdfparse report.pdf --format json

# Plain text output
~/bin/agent_scripts/pdfparse report.pdf --format txt

# Better table detection for complex tables
~/bin/agent_scripts/pdfparse report.pdf --table-strategy lines

# For scanned PDFs (experimental OCR mode)
~/bin/agent_scripts/pdfparse scanned.pdf --ocr
```

## Output Format

Markdown to stdout by default. Diagnostic messages (download progress, fallback
warnings, errors) go to stderr and don't mix with the content output.

```bash
# Capture content only
content=$(~/bin/agent_scripts/pdfparse report.pdf)

# Redirect to file
~/bin/agent_scripts/pdfparse report.pdf > report.md

# Pipe content directly to the agent for analysis
~/bin/agent_scripts/pdfparse report.pdf --pages 1-3 | head -50
```

JSON output (when available) produces structured content with per-element
metadata:

```json
{
  "metadata": {"format": "PDF 1.7", "pages": 12},
  "pages": [
    {
      "number": 1,
      "width": 612,
      "height": 792,
      "blocks": [
        {"type": "heading", "text": "Introduction", "bbox": [50, 50, 562, 70]},
        {"type": "text", "text": "This is the body text...", "bbox": [50, 80, 562, 120]}
      ]
    }
  ]
}
```

Note: JSON format requires pymupdf4llm. Without it, the script errors with
installation instructions.

## Engine Selection Logic

1. **pymupdf4llm** — always tried first. Fast, C-based (PyMuPDF backend), good
   layout and table preservation — loaded automatically by the PEP 723 script.
2. **pdftotext** — automatic fallback. Already installed on this system (part of
   poppler-utils). Basic text extraction, no layout/table handling.

There is no 3 — if both fail, the script exits with clear instructions.

## When to Use / Not Use

Use `pdfparse` for:
- Extracting text from PDFs for agent consumption / analysis
- Reading research papers, reports, or documentation
- Converting PDF content to markdown for RAG pipelines
- Processing PDFs from URLs (arXiv, GitHub releases, etc.)

Do NOT use for:
- Editing or modifying PDFs (use dedicated PDF editors)
- Parsing non-PDF files (.docx, .html, etc.)
- Processing password-protected PDFs (use `qpdf --decrypt` first)
- High-volume batch processing of hundreds of files (the per-file overhead
  of pymupdf4llm startup adds up)
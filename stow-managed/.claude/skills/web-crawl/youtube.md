# YouTube Transcript Notes

Last updated: 2026-06-25

## Why Not Crawl YouTube Directly

`webcrawl https://www.youtube.com/watch?v=...` returns only the page HTML — title, description, and metadata. It cannot extract spoken content. Use `video-transcript` instead.

## Tool: `video-transcript`

```bash
~/bin/agent_scripts/video-transcript <url>
~/bin/agent_scripts/video-transcript --json <url>
~/bin/agent_scripts/video-transcript --json --meta <url>
~/bin/agent_scripts/video-transcript --lang fr <url>
```

**Options:**

| Flag | Default | Effect |
|---|---|---|
| `--lang <code>` | `en` | Caption language (e.g. `fr`, `de`, `ja`) |
| `--json` | off | Wrap output in `{"url","title","channel","duration","language","source","transcript"}` |
| `--meta` | off | Populate title/channel/duration in JSON (requires yt-dlp; implies a second yt-dlp call) |
| `--model <pattern>` | `openrouter/google/gemini-2.5-flash` | Pi model for ASR fallback |

## Two-Tier Strategy

**Tier 1 — Caption extraction** (~1s, no download, requires `pip install youtube-transcript-api`)

Hits YouTube's internal caption API. Works for any video with captions (auto-generated or manual). The `source` field in JSON output will be `"captions"`.

**Tier 2 — ASR fallback** (slower, requires `pip install yt-dlp` and `pi`)

When tier 1 fails — no captions, disabled, or non-YouTube URL — `yt-dlp` downloads the audio as mp3 and `pi` sends it to a multimodal model for transcription. The `source` field will be `"asr"`.

Tier 2 works for most video sites yt-dlp supports (Vimeo, Twitter/X, etc.), not just YouTube.

## Install Prerequisites

```bash
pip install youtube-transcript-api   # tier 1
pip install yt-dlp                   # tier 2 and --meta
```

## Limitations

| Case | Behaviour |
|---|---|
| Private video | Both tiers fail; yt-dlp surfaces the error |
| Age-gated video | yt-dlp may require cookies (`--cookies-from-browser chrome`) |
| No captions + no audio | Tier 2 will attempt but may produce empty/poor output |
| Non-Latin language | Pass `--lang <code>`; tier 1 fetches the right track if it exists |

## Common Agent Pattern

```bash
# Research pattern: find a video, extract its content
RESULTS=$(~/bin/agent_scripts/websearch "python asyncio tutorial site:youtube.com")
URL=$(echo "$RESULTS" | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['url'])")
~/bin/agent_scripts/video-transcript --json "$URL"
```

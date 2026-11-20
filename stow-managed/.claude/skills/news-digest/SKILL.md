---
name: news-digest
description: >-
  Build a news digest from a curated list of trusted outlets — pull headlines from their RSS feeds, read the full articles, summarise them, and present the result with numbered citations (outlet, date, full URL) so every claim can be checked at the source. Saves a markdown copy. Auto-invoke BEFORE answering any request for a briefing, roundup, or summary of recent news, even if the user does not say "digest". Trigger phrases: "news digest", "what's in the news", "what happened today", "daily briefing", "news roundup", "catch me up", "headlines", "morning news", "news on <topic>", "what's the latest on <topic> news", "summarise the news".
disable-model-invocation: false
---

Produce a digest whose value is **verifiability**: the user reads your summary to save time, and follows the citation when a story matters or a claim looks off. A summary without a working link is just an assertion, so every story carries its source.

For a single factual lookup ("who won X", "what is the price of Y"), use the `web-search` skill instead — this skill is for multi-story briefings.

## Tools

- `~/bin/agent_scripts/news-feed` — discovery. Reads the curated sources and prints JSON headlines (title, URL, date, short blurb). Check it exists with `ls ~/bin/agent_scripts/news-feed`; if missing, stow hasn't run — stop and say so.
- `webcrawl <url>` (see the `web-crawl` skill) — reading full articles. Feed blurbs are one or two sentences; summarising from them alone produces vague, sometimes wrong digests.
- The trusted-source list is `$CLAUDE_SKILL_DIR/references/sources.toml`, overlaid by `~/.config/news-digest/sources.local.toml` if present. To add or remove an outlet, edit one of those; don't hardcode outlets in your answer. Trust is the user's curated decision, not yours — don't pull in outlets from outside the list for the digest body.

## Workflow

1. **Scope the request.**
   - General ("news", "briefing"): run `news-feed` with no flags (default categories, last 36h).
   - Topic ("news on Taiwan chips"): `news-feed -k "taiwan,tsmc,semiconductor"` — with a keyword it searches all categories. Widen with `--since-hours 168` for "this week".
   - Category ("tech news"): `news-feed -c tech`.
   - If the user's wording is ambiguous about time window or topic, pick a sensible default and state it at the top of the digest rather than asking.
2. **Fetch headlines.** Check `errors` in the output and mention any dead feed in one line at the end; a quiet gap in coverage misleads the reader.
3. **Optionally add "For you".** For general digests, also run `news-feed -k "<interest_keywords from sources.toml>"` and surface matches that the main run didn't already include.
4. **Select stories.** Aim for roughly 8–12 stories (fewer for a narrow topic). Cluster items about the same event across outlets into one story. Prefer stories covered by multiple independent outlets; cross-coverage is the cheapest reliability signal available. Drop pure opinion/live-blog/listicle items unless the user asked.
5. **Read before summarising.** For each selected story, `webcrawl` the best 1–2 URLs (run them in parallel). If a page is paywalled or fails, summarise only what the feed blurb supports and mark it `(headline/blurb only — full article not read)`. Never fill the gap from memory.
6. **Write the digest** in the format below.
7. **Save it** to `~/.local/share/news-digest/YYYY-MM-DD[-topic-slug].md` (create the directory if needed) and print the path at the end. Same content as shown, so the links survive after the session.

## Output format

Number citations globally so `[3]` means the same source everywhere. Put what you know confidently as plain statements; flag what a source merely claims.

```markdown
# News digest — <date> · <scope, e.g. "general" or "Taiwan chips, last 7 days">

## <Topic or category>

**<Story headline in your words>** — 2–4 sentences: what happened, why it matters,
the key number/name that makes it concrete. Attribute contested claims ("according
to Reuters-cited officials…"). [1][4]

*Sources differ:* <only if outlets materially disagree — say how.>

## For you
…

## Sources
1. <Outlet> — "<Article title>" (<YYYY-MM-DD>) <full URL>
2. …

_Feeds unavailable: <names>_   (omit if none)
```

Rules that keep the digest trustworthy:

- Every story has at least one citation; stories on contested or fast-moving events should have two or more outlets when available.
- Use the full URL exactly as returned — never shorten, reconstruct, or guess one.
- Paraphrase; don't copy article text. Quote at most a short phrase, in quotation marks, attributed.
- Use the article's date from the feed, not today's date. If the newest item is older than the window, say so.
- Don't add background or analysis from your own knowledge into a cited statement. If you add context, label it "Context (not from sources):".
- Keep the whole digest scannable: the user should be able to skim headlines in under a minute and dig in via the links.

---
name: web-search
description: >-
  Search the web on-demand — Brave Search API primary (search + extracted page
  content in one call, no Docker), local SearXNG Docker instance as automatic
  fallback. Use for live web search, recent news, current documentation, or any
  query that needs real-time results. Auto-invoke BEFORE attempting to answer
  questions requiring current information. Trigger phrases: "search the web",
  "look this up", "find recent", "what's the latest on", "search for", "web
  search", "find online", "current status of", "look up".
disable-model-invocation: false
---

Search the web using `~/bin/agent_scripts/websearch`, a tiered search wrapper:

- **Primary — Brave Search API.** By default uses the LLM Context endpoint:
  search and pre-extracted page content arrive together in one call, so
  quick lookups need no follow-up crawl; for anything that will drive an
  action, read 1–2 top sources yourself (see Content Rule). No Docker,
  sub-second response.
- **Fallback — SearXNG** (Docker-backed, via `websearch-searxng`). The wrapper
  delegates automatically when no API key is present or the Brave call fails
  (invalid key, quota, rate limit, network). The stderr banner says which
  provider served each search — read it so you know whether content came back.

Do not use the built-in `WebSearch` tool or `WebFetch` when this is available.

## Preflight — Do This First

```bash
ls ~/bin/agent_scripts/websearch
{ [ -n "$BRAVE_API_KEY" ] || [ -s ~/.config/agent-scripts/env ]; } && echo "brave key: present" || echo "BRAVE KEY MISSING"
```

If the script is missing, stow from the dotfiles repo hasn't been run. Do not attempt a fallback.

**If the key is missing, say so loudly before searching.** Open your reply with
a line like `WARNING: BRAVE_API_KEY is not set, so web-search is DEGRADED
(SearXNG fallback, short snippets from a single engine).` Do not stay quiet and
carry on. Why it matters: in the missing-key case the fallback returned generic
vendor and Wikipedia pages with 70–136-character snippets, and an earlier
session answered from them without noticing. Brave returns 1.4–2k characters of
extracted content per result and finds forums, issues and official docs. The two
are not the same tool.

Then tell the user the fix: export `BRAVE_API_KEY` from `~/.zshenv` (inherited
when `claude` is launched from zsh) or write `~/.config/agent-scripts/env` (also
works from launchers, IDEs, cron and Paseo). Never print or ask for the key
in chat. You may still search, but follow the degraded rules below.

## Check the provider after every search

Never throw stderr away: it holds the only record of which provider answered.
Save it and read it every time:

```bash
~/bin/agent_scripts/websearch -n 8 "query" >ws.json 2>ws.err   # scratch dir, not the repo
grep -E 'Falling back|SearXNG' ws.err && echo "DEGRADED: fallback served this search"
```

A banner of `Searching (Brave LLM Context)` or `Searching (Brave, raw)` is good.
`Falling back to SearXNG …` means degraded, whatever the reason (no key, invalid
key, quota, rate limit, network). Yell about it the same way as a missing key,
including the reason from the banner.

When degraded, do **not** treat snippets as evidence. Use them only to pick
URLs, then fetch the best 2–3 with the **web-crawl** skill and answer from what
you read. If results are off-topic (generic vendor pages, wrong language), say so
instead of summarising them.

## Common Usage

```bash
# Default — Brave LLM Context: results WITH extracted page content (~$5/1k reqs)
~/bin/agent_scripts/websearch "python asyncio best practices"

# Limit results (default 10, Brave caps at 50)
~/bin/agent_scripts/websearch -n 5 "rust ownership tutorial"

# Freshness filter
~/bin/agent_scripts/websearch -t day "latest Claude API changes"
~/bin/agent_scripts/websearch -t month "kubernetes 1.31 release notes"

# Raw search — cheapest (titles + snippets only). Use when you just need
# candidate URLs, then invoke the web-crawl skill for the best hits.
~/bin/agent_scripts/websearch --search-only -n 5 "site:github.com fast JSON parser"

# Force the SearXNG fallback (e.g. testing, or Brave quota is known-exhausted)
~/bin/agent_scripts/websearch --provider searxng "docker security vulnerabilities"
```

## Output Format

JSON array on stdout; provider/diagnostics on stderr (the `Searching (Brave …):
<query>` banner and `Falling back to SearXNG …` notice are stderr — verified
2026-10-17: with stderr split off, stdout parses cleanly with `json.load`).

**Never merge stderr into stdout when parsing.** `websearch … 2>&1 | python3 -c
"json.load(sys.stdin)"` puts the banner first and fails with `JSONDecodeError:
Expecting value: line 1 column 1`. Parse stdout only, and save stderr to a file
so you can read the provider banner (see "Check the provider after every search"):

```bash
~/bin/agent_scripts/websearch -n 5 "query" 2>ws.err | python3 -c 'import json,sys; [print(r["url"]) for r in json.load(sys.stdin)]'
cat ws.err
```

Do not "fix" this with `tail -n +2` — stdout has no banner line, so that would
drop the opening `[` and break valid JSON. Do not send stderr to `/dev/null`:
it hides which provider served the search, and that already caused a degraded
fallback to go unnoticed.

```json
[
  {
    "title": "Result title",
    "url": "https://example.com/page",
    "snippet": "Extracted page content (LLM Context) or excerpt (raw search)...",
    "engine": "brave-llm-context"
  }
]
```

`engine` tells you the provenance: `brave-llm-context` (content included),
`brave` (raw snippets), or the SearXNG engine name (fallback; snippets only).

## Content Rule — When to Crawl

Brave's snippets are extracted and summarised by a search service, not read
by you. They are good for choosing sources and can be fine for casual lookups,
but they can drop a caveat, mix up versions, or cut a page at the wrong place.
So scale how much you read yourself to what the answer will be used for:

- **Read 1–2 top sources in full with the web-crawl skill** when the answer
  will drive an action or a recommendation, or hinges on exact behaviour: a
  setting, flag or button name, a version-specific feature, pricing, a
  procedure, a "does X support Y" question, or anything where the user will
  rely on the detail. Pick sources by authority, not rank: official docs or
  manual, then the project's own issue tracker or maintainers, then forum or
  Reddit threads. Skim the page for the part the snippet only hinted at.
- **Answer from snippets alone** for quick lookups, background context, or when
  a snippet already quotes an authoritative page verbatim and says exactly what
  you need. Don't crawl just to crawl.
- **Cross-check before relying on a forum answer.** A single post is an anecdote.
  If the claim matters, find the official doc or a second independent source,
  or say it is unverified.
- **Say what you read.** In the answer, separate "read in full" sources from
  "snippet only" ones, and cite both. If you answered from snippets on something
  that could matter, say so.
- **Raw search (`--search-only`) or SearXNG fallback:** results are
  titles/snippets only. Pick the best hits and crawl them before answering;
  don't stop at the results list.

Example: asked how darktable behaves with images on an unplugged drive, the
default search returned forum threads plus the official manual's "selected
image(s)" page. The right move is to crawl the manual page (it names the move,
copy, copy locally and resync buttons exactly) and cite the forums only for
experience reports.

## API Key Setup (per machine)

The key can come from either place; the wrapper accepts both:
- `$BRAVE_API_KEY` exported in the shell that launched the agent (e.g. from
  `~/.zshenv`, which every zsh reads; `~/.zshrc` only covers interactive shells).
  Fine when `claude` is always started from that shell.
- `~/.config/agent-scripts/env` (untracked, chmod 600): the wrapper sources it
  itself, so it also works from launchers, IDE extensions, cron and Paseo, and
  can't be committed to a dotfiles repo by accident.

```bash
mkdir -p ~/.config/agent-scripts
echo 'export BRAVE_API_KEY="<key from password manager>"' > ~/.config/agent-scripts/env
chmod 600 ~/.config/agent-scripts/env
```

If neither exists, the wrapper falls back to SearXNG automatically. The skill
still runs, but results are much weaker (see Preflight): treat it as degraded
and say so, not as equivalent.

**Cost note:** ~$5/1k requests (search and LLM Context both count as requests);
$5 of free credits is applied automatically every month. Prefer `--search-only`
for high-volume URL-hunting; use the default for content-grounded answers.

## SearXNG Fallback Details

The fallback runs a persistent SearXNG Docker container (`searxng-websearch`,
starts on first use, stays running). Requires Docker at `/usr/bin/docker` and
`~/.config/searxng/settings.yml` (stow-managed). Under Paseo, `WEBSEARCH_URL`
points the fallback at an always-warm sidecar and Docker is skipped.

**Startup time and parallel searches:** first SearXNG call per session is
~10–15s (container cold start). Check warmth before parallel calls:

```bash
/usr/bin/docker inspect --format='{{.State.Running}}' searxng-websearch 2>/dev/null \
  | grep -q "^true$" && echo warm || echo cold
```

- **Warm**: parallelize freely.
- **Cold**: run one search first (~10–15s), then parallelize the rest —
  parallel cold-starts race to start the container and the losers may fail.

## When to Use / Not Use

Use `websearch` for:
- Questions requiring current or real-time information
- Recent news, release notes, CVEs, changelogs
- Verifying whether a library/API still exists or has changed
- Finding URLs to feed into `webcrawl` for full content

Do NOT use for:
- Fetching a specific known URL → use `webcrawl` directly
- Visual inspection of rendered pages → use **browser-inspect** skill
- Local file search → use `rg` or `fd`

## Load Reference Files When Relevant

Read these using the Bash tool (`cat "$CLAUDE_SKILL_DIR/references/<file>"`). Do not guess their contents — read them.

- **references/engine-blocking.md** — load when: a SearXNG-fallback search
  returns an empty results array (including for trivial queries), `docker logs
  searxng-websearch` shows `SearxEngineCaptchaException` or `Suspended`
  errors, or before re-enabling `duckduckgo`/`brave`/`startpage`/`google` in
  `settings.yml`.

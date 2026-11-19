---
name: web-search
description: >-
  Search the web on-demand via the Brave Search API (search + extracted page
  content in one call, no Docker); a local SearXNG Docker instance is available
  only when forced. Use for live web search, recent news, current documentation, or any
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
- **SearXNG — automatic fallback currently DISABLED.** Its results were poor
  (Bing returned unrelated pages), so a Brave failure (no key, invalid key,
  quota, rate limit, network) now exits 1 with an `Error: Brave search
  failed (…)` on stderr instead of silently degrading. Report the error to the
  user; don't retry with `--provider searxng` unless they ask, or Brave is
  known to be down and low-quality results are acceptable.

Do not use the built-in `WebSearch` tool or `WebFetch` when this is available.

## Preflight — Do This First

```bash
ls ~/bin/agent_scripts/websearch
{ [ -n "$BRAVE_API_KEY" ] || [ -s ~/.config/agent-scripts/env ]; } && echo "brave key: present" || echo "BRAVE KEY MISSING"
```

If the script is missing, stow from the dotfiles repo hasn't been run. Do not attempt a fallback.

**If the key is missing, say so before searching.** With no key the wrapper
exits 1 (automatic SearXNG fallback is disabled), so report it instead of
answering from memory. Tell the user the fix: export `BRAVE_API_KEY` from
`~/.zshenv` (inherited when `claude` is launched from zsh) or write
`~/.config/agent-scripts/env` (also works from launchers, IDEs, cron and
Paseo). Never print or ask for the key in chat.

## Check the provider after every search

Never throw stderr away: it holds the only record of which provider answered
and why a search failed. Save it and read it every time:

```bash
~/bin/agent_scripts/websearch -n 8 "query" >ws.json 2>ws.err   # scratch dir, not the repo
grep -E 'Falling back|SearXNG|^Error' ws.err && echo "NOT A NORMAL BRAVE RESULT"
```

A banner of `Searching (Brave LLM Context)` or `Searching (Brave, raw)` is good.
`Error: Brave search failed (…)` means no results: report the reason to the user.
`Falling back to SearXNG …` appears only when SearXNG was forced with
`--provider searxng`; treat that output as degraded: do **not** treat snippets
as evidence. Use them only to pick URLs, then fetch the best 2–3 with the
**web-crawl** skill and answer from what you read. If results are off-topic
(generic vendor pages, wrong language), say so instead of summarising them.

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

# Country — defaults to AU ($WEBSEARCH_COUNTRY overrides per machine).
# Global/tech queries return the same results under AU and US; money, law,
# shopping and health queries get Australian sources. Use -c US (or another
# code) when the question is explicitly about that country.
~/bin/agent_scripts/websearch -c US "401k contribution limits"

# Precision over recall (LLM Context only) — roughly half the passages, all
# more on-topic. Good for factual lookups; skip for broad research.
~/bin/agent_scripts/websearch --strict "python 3.13 release date"

# Re-rank sources with Goggles (see "Goggles" below); repeat up to 3 times
~/bin/agent_scripts/websearch --goggles '$boost=3,site=docs.python.org' "asyncio taskgroup"
```

`-c`, `-l LANG`, `--goggles` and `--strict` are Brave-only; on SearXNG
fallback they are ignored and stderr says so.

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

## Source Quality and Recency

Search ranking rewards popularity and SEO, not accuracy. Before answering:

- **Prefer primary sources** — official docs, the vendor's own pricing/terms
  pages, original announcements, papers, the actual thread. Comparison
  listicles and "best X in 2026" posts are often written by a vendor in the
  space; treat them as leads, not evidence.
- **Crawl the primary page for prices, terms, policies, limits, and anything
  contested** rather than answering from a secondary summary.
- **Check dates.** Note when each source was published or updated. Claims about
  policies, pricing, terms, or API behaviour from an undated source or one over
  a year old may be stale — confirm against a current primary source or say so.
  (Real example: a 9-month-old HN thread said Brave's API forbids AI use; that
  rule belonged to a plan Brave retired in Feb 2026.)
- **Cite the source you actually relied on**, with its date when it matters.

## Goggles (Brave re-ranking)

A Goggle is a set of rules that boosts, downranks, or discards results by site
or URL pattern for one query. Opt-in only — never apply one by default, since
it imposes our own bias. Rules are newline- (or `\n`-) separated; each is
`$<action>,site=<domain>` where action is `boost=N`, `downrank=N` (N 1–10) or
`discard`. Precedence: discard > boost > downrank. A bare `$discard` line
first turns the list into an allow-list (only listed sites survive). A hosted
goggle URL also works but must be registered with Brave first; inline rules
need no registration.

Recipes (tested 2026-11-19) — substitute domains relevant to the query:

```bash
# Docs-first: boost the official docs for the topic. Use site= boosts, not
# path patterns like /docs/ — those also boost low-quality sites that use /docs/.
--goggles '$boost=3,site=docs.python.org\n$boost=3,site=developer.mozilla.org\n$downrank=3,site=medium.com'

# De-SEO: drop or sink content farms for how-to queries
--goggles '$discard,site=pinterest.com\n$discard,site=quora.com\n$downrank=5,site=medium.com\n$downrank=5,site=geeksforgeeks.org'

# Community experience: lived-experience questions ("is X worth it", "anyone
# used Y"). Even boost=2 can fill every slot with Reddit when it has many
# matching threads (tested: top 6 went from 1 Reddit hit to 6). Use it when you
# want forum voices specifically, not as a "mix in some forums" setting.
--goggles '$boost=2,site=reddit.com\n$boost=2,site=news.ycombinator.com\n$boost=2,site=lobste.rs'

# Allow-list: only these sites
--goggles '$discard\n$site=docs.rs\n$site=rust-lang.org'
```

## Brave Terms — Don't Persist Raw Results

Brave's API terms (updated 2026-09-01) permit feeding results to a model at
query time — the normal use of this skill. They forbid storing or caching
results beyond transient use (clause 3(b)(i)) and using them to train,
fine-tune, or benchmark models (3(b)(xiii)). Do not write raw `websearch`
output into a database, vector store, cache, or bulk file. Writing a
summary in your own words with citations (e.g. a note via the notes skill) is
fine.

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

The same file can set `export WEBSEARCH_COUNTRY="US"` to change this machine's
default country (unset → AU). Note it is only sourced when `$BRAVE_API_KEY` is
not already in the environment.

If neither the file nor `$BRAVE_API_KEY` exists, the wrapper errors out — a key
is required (automatic SearXNG fallback is disabled).

**Cost note:** ~$5/1k requests (search and LLM Context both count as requests);
$5 of free credits is applied automatically every month. Prefer `--search-only`
for high-volume URL-hunting; use the default for content-grounded answers.

## SearXNG Fallback Details

Applies only when forced with `--provider searxng` while automatic fallback is
disabled. To re-enable it, set `PROVIDER="auto"` in `websearch`.

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

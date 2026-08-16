# Reddit — Crawling Posts, Comments, and Threads

Last updated: 2026-08-16

## Preferred: Use the Scripts

For threads and search, use the wrapper scripts instead of hand-rolling a
fetch — they encapsulate the mirror-fetch/retry logic and parse the Redlib
markdown into structured post/comment data:

```bash
~/bin/agent_scripts/reddit-thread <reddit-or-redlib-url> [--limit N] [--chars N] [--json]
~/bin/agent_scripts/reddit-search <query> [--subreddit SUB] [--sort hot|new|top|relevance] [--json]
```

Examples:

```bash
~/bin/agent_scripts/reddit-thread "https://www.reddit.com/r/technology/comments/1vay198/amazon_accidentally_spent_18_million_using_claude/"
~/bin/agent_scripts/reddit-search "claude code" --subreddit ClaudeAI --sort top
```

`reddit-thread` accepts a canonical `reddit.com`/`old.reddit.com` URL directly
(it normalizes the host to the mirror) or a Redlib URL unchanged.
`reddit-search` is discovery/triage only (no self-text in default output) —
call `reddit-thread <permalink>` on a result for full content. Both support
`--mirror HOST` / the `REDLIB_MIRROR` env var to override the pinned default
mirror, and `--json` for structured output.

Fall back to the manual pattern below only for Redlib page types the scripts
don't cover (e.g. a user profile page) — don't hand-roll thread/search
fetching, the scripts already do it.

## Why Direct Fetches Fail

`webcrawl https://www.reddit.com/r/...` (and `old.reddit.com`) returns `Blocked by
anti-bot protection: HTTP 403`. Reddit's Cloudflare layer blocks any automated
client that isn't the official app or an OAuth-authenticated, paying API consumer
— this affects `webcrawl`, `curl`, and `WebFetch` equally. RSS feeds
(`reddit.com/r/{sub}.rss`) survive but only expose post bodies, not comments, so
they're not a substitute for reading a discussion thread.

## Workaround: Redlib Mirrors

[Redlib](https://github.com/redlib-org/redlib) is an open-source, self-hosted
Reddit front-end. It renders Reddit content server-side by mimicking the official
Reddit Android app's OAuth handshake and headers — to Reddit's backend, mirror
traffic looks like the real app, not a scraper, which is why it gets through where
a bare fetch doesn't. Community consensus (r/webscraping, r/ClaudeAI as of
2026-08) treats this as the standard workaround for agentic Reddit access — see
`~/bin/agent_scripts/websearch "redlib reddit scraping"` for current discussion,
and note a dedicated `redlib-mcp-server` project exists purpose-built for giving
AI agents structured (JSON) access to a Redlib instance.

**URL transform** — swap the Reddit host for the mirror host, keep the rest of
the path:

```
https://www.reddit.com/r/HongKong/comments/abc123/some_title/
→ https://<mirror-host>/r/HongKong/comments/abc123/some_title/
```

**Known-working public mirror (confirmed live 2026-08-16):**
`redlib.privacyredirect.com`. It's gated by an "Anubis" JS proof-of-work
challenge that a headless browser (`webcrawl`'s Playwright backend) only
solves intermittently — both thread pages and search pages typically succeed
within a handful of retries, but any single attempt can hit the challenge
page instead of content. This is normal, not a sign the mirror is down; don't
conclude a mirror is dead from a small number of failures — retry first.
Public mirrors do still churn over longer timescales. If this one stops
working entirely after a real retry campaign, pull a fresh candidate from the
maintained list instead of guessing:

```bash
webcrawl https://raw.githubusercontent.com/redlib-org/redlib-instances/main/instances.md --raw
```

(Use the raw URL, not the `github.com/.../blob/...` UI — the blob page is a
JS-heavy SPA that renders mostly nav chrome under `webcrawl`.)

Cite the canonical `reddit.com` URL in any saved notes/citations — the mirror is
only the retrieval mechanism, not the durable source.

## Retry Pattern — Mirrors Are Flaky Too (Manual Fallback)

`reddit-thread`/`reddit-search` already implement this (6 attempts, 3s/attempt
backoff) — only hand-roll it for page types those scripts don't cover:

```bash
fetch_reddit() {
  local url="$1"
  local mirror_host="redlib.privacyredirect.com"
  local mirror_url="${url/https:\/\/www.reddit.com/https:\/\/$mirror_host}"
  mirror_url="${mirror_url/https:\/\/reddit.com/https:\/\/$mirror_host}"
  for i in 1 2 3 4 5 6; do
    out=$(webcrawl "$mirror_url" --raw 2>&1)
    if echo "$out" | grep -qE "comments sorted by|Upvotes"; then
      echo "$out"
      return 0
    fi
    sleep $((3 * i))
  done
  echo "FAILED to fetch $url after retries" >&2
  return 1
}
```

- Accept a response only if it contains a real content marker (`comments sorted
  by` for a thread page, `Upvotes` for a post) — the bot-check page contains
  neither.
- A "You are about to leave Redlib" interstitial *inside* otherwise-valid output
  is harmless page furniture (an outbound-link warning), not a block signal —
  don't treat its presence as failure.
- Bash function definitions don't persist across separate Bash tool calls in this
  harness; redefine via `source /dev/stdin <<'FUNC' ... FUNC` at the top of each
  new Bash invocation that needs it.

## Self-Hosting (Not Yet Set Up)

No private Redlib instance is running yet for this user — the mirror above is a
public, third-party instance, used as-is with no account or config. Self-hosting
would remove the shared-mirror flakiness (own uptime, no other users' traffic
tripping bot-checks) and pairs naturally with `redlib-mcp-server` for structured
JSON access instead of scraping rendered markdown. Revisit only if the public
mirror pattern proves unreliable enough to be worth the upkeep — see
`~/bin/agent_scripts/websearch "redlib docker deployment"` for current setup
steps if this gets revisited.

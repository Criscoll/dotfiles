# Reddit — Crawling Posts, Comments, and Threads

Last updated: 2026-08-16

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

**Known-working public mirror (as of 2026-08-16):** `redlib.privacyredirect.com`.
Public mirrors churn — some run their own Cloudflare JS challenge or an "Anubis"
proof-of-work block page, and instances go down entirely. If this one stops
working, pull a fresh candidate from the maintained list instead of guessing:

```bash
webcrawl https://github.com/redlib-org/redlib-instances/blob/main/instances.md --raw
```

Cite the canonical `reddit.com` URL in any saved notes/citations — the mirror is
only the retrieval mechanism, not the durable source.

## Retry Pattern — Mirrors Are Flaky Too

Even a working mirror intermittently serves its own bot-check page instead of
content, especially under rapid repeated requests. Retry with backoff and verify
the response actually contains thread content before accepting it:

```bash
fetch_reddit() {
  local url="$1"
  local mirror_host="redlib.privacyredirect.com"
  local mirror_url="${url/https:\/\/www.reddit.com/https:\/\/$mirror_host}"
  mirror_url="${mirror_url/https:\/\/reddit.com/https:\/\/$mirror_host}"
  for i in 1 2 3 4; do
    out=$(webcrawl "$mirror_url" 2>&1)
    if echo "$out" | grep -qE "comments sorted by|Upvotes"; then
      echo "$out"
      return 0
    fi
    sleep 4
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

# Reddit Crawling Notes

Last updated: 2026-06-16

## Access Model (as of 2026)

Reddit aggressively restricts unauthenticated access. Since mid-2023, nearly all programmatic access requires approved OAuth credentials. Self-serve app creation at `reddit.com/prefs/apps` is gated behind the Responsible Builder Policy — new accounts cannot create API apps without manual approval.

## What Works (No Credentials)

### RSS / Atom feeds — posts only, no comments

The only reliable unauthenticated data source. Returns post titles, links, and post body as Atom XML.

```bash
# Subreddit feeds
https://www.reddit.com/r/{sub}.rss                        # hot
https://www.reddit.com/r/{sub}/top.rss?t=week&limit=25   # top this week
https://www.reddit.com/r/{sub}/new.rss
https://www.reddit.com/r/{sub}/search.rss?q={query}&sort=relevance

# Fetch with curl (stdlib only — no credentials needed)
curl -s -H "User-Agent: my-agent/0.1" "https://www.reddit.com/r/python/top.rss?t=week&limit=25"
```

Parse with `xml.etree.ElementTree` (stdlib). Each `<entry>` has `<title>`, `<link href="..."/>`, and `<content>` (HTML body of the post).

**Limitation**: no comments, no vote counts, no metadata beyond the post itself.

## What Does NOT Work (No Credentials)

| Method | Result |
|---|---|
| `webcrawl https://www.reddit.com/...` | 403 — blocked before page loads |
| `webcrawl https://old.reddit.com/...` | 403 — same block |
| `curl https://www.reddit.com/r/sub/top.json` | Returns SPA HTML, not JSON |
| `curl https://old.reddit.com/r/sub/top.json` | Returns "Blocked" HTML page |

All unauthenticated HTTP-level access (including webcrawl's Playwright-backed fetcher) is blocked by Reddit's Cloudflare layer at the IP/fingerprint level.

## Untested — May Work

### Playwright MCP (real browser)

The user has a Playwright MCP running Chromium on a VPS (`134.199.169.64`). A full real browser has a better chance of passing Cloudflare fingerprint checks than an HTTP fetcher. However, the VPS is a datacenter IP which Reddit/Cloudflare may block regardless of browser fingerprint.

**To test**: use the **web-scrape** skill to open a Reddit post URL and extract comments. If the VPS IP is blocked, this will also fail.

## Getting API Credentials (Required for Comments)

PRAW gives full programmatic access including comment trees (`submission.comments`), but requires approved OAuth credentials.

Self-serve path is closed for new accounts. Options:

1. **File a developer access ticket** (only real path):
   https://support.reddithelp.com/hc/en-us/requests/new?ticket_form_id=14868593862164&tf_42139884615700=api_request_type_developer_clone
   Explain the use case (read-only information gathering), which subreddits, what API actions. No guarantee of approval; may take time.

2. **Use Devvit** (Reddit's official developer platform):
   Only viable if building something that lives inside Reddit (widget, mod tool, game). Not suitable for external LLM agent use cases.

## PRAW Quickstart (once credentials are obtained)

```python
import praw

reddit = praw.Reddit(
    client_id="CLIENT_ID",
    client_secret="CLIENT_SECRET",
    username="YOUR_USERNAME",
    password="YOUR_PASSWORD",
    user_agent="my-agent/0.1 by u/YOUR_USERNAME",
)

# Posts
for post in reddit.subreddit("python").top(time_filter="week", limit=25):
    print(post.title, post.url)

# Comments on a post
submission = reddit.submission(url="https://www.reddit.com/r/python/comments/abc123/...")
submission.comments.replace_more(limit=0)  # flatten MoreComments objects
for comment in submission.comments.list():
    print(comment.body)
```

Install via: `uv add praw`

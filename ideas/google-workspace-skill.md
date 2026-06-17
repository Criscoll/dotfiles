# Google Workspace Agent Skill

An exploration of encapsulating Google Workspace interactions (Gmail, Calendar, Drive, etc.) as an on-demand agent skill — following the philosophy of [What If You Don't Need MCP?](https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/)

## Session Context

- **Date**: 2026-06-17
- **Source repo**: [taylorwilsdon/google_workspace_mcp](https://github.com/taylorwilsdon/google_workspace_mcp) (2.7k stars, 2,382 commits, MIT license)
- **GCP setup**: Ready — OAuth client ID/secret exist
- **Auth preference**: Public OAuth 2.1 (PKCE) — no client secret needed, browser consent on first use
- **Initial scope**: Gmail + Calendar

## The Reference Project

`google_workspace_mcp` is the most complete Google Workspace MCP server available:

- **12 services**: Gmail, Drive, Calendar, Docs, Sheets, Slides, Forms, Chat, Apps Script, Tasks, Contacts, Custom Search
- **FastMCP-based**: runs as `streamable-http` on port 8000
- **Official Docker image**: `ghcr.io/taylorwilsdon/google_workspace_mcp` (linux/amd64 + linux/arm64, 30.4K downloads)
- **Includes `workspace-cli`**: a CLI tool that can call any server tool from the command line
- **Stateless mode**: `WORKSPACE_MCP_STATELESS_MODE=true` for container-friendly zero-disk-write operation
- **Pluggable credential store**: local directory, GCS, or Valkey/Redis

### Docker setup from the repo

```yaml
# docker-compose.yml
services:
  gws_mcp:
    build: .
    container_name: gws_mcp
    ports:
      - "8000:8000"
    environment:
      - GOOGLE_MCP_CREDENTIALS_DIR=/app/store_creds
    volumes:
      - ./client_secret.json:/app/client_secret.json:ro
      - store_creds:/app/store_creds:rw
    env_file:
      - .env
```

```dockerfile
# Dockerfile highlights
FROM python:3.11-slim
RUN pip install uv && uv sync --frozen --no-dev --extra disk
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s \
  CMD sh -c 'curl -f http://localhost:${PORT:-8000}/health || exit 1'
ENTRYPOINT ["/bin/sh", "-c"]
CMD ["uv run main.py --transport streamable-http ..."]
```

### Run commands

```bash
docker pull ghcr.io/taylorwilsdon/google_workspace_mcp:sha-4463b2e

# With env vars for tool selection
docker run -e TOOL_TIER=core workspace-mcp
docker run -e TOOLS="gmail drive calendar" workspace-mcp
```

## The Philosophy (from the blog post)

The blog post argues that for many use cases, **you don't need MCP servers at all**. Instead:

1. **Write simple CLI scripts** the agent calls via bash — the agent already knows how to write code and use shell commands
2. **Progressive disclosure**: A small README (~225 tokens vs 13k-18k for MCP servers) tells the agent what tools exist and when to use them
3. **Composability**: CLI output goes to files, not through agent context. Results can be piped or combined.
4. **Easy to extend**: Adding a new tool is editing a script + adding a line to the README
5. **On-demand**: Start containers when needed, tear them down when done (the web-search SearXNG pattern)

## Two Options for Implementation

### Option A: Container + `workspace-cli` wrapper

Use the existing Docker container on-demand (same pattern as web-search/SearXNG). The agent runs CLI commands through `workspace-cli` which talks to the running container.

**Scripts would look like:**

```bash
# gmail-list --tool-tier core
# Called via: uv run workspace-cli call gmail_list_messages --params '{"maxResults": 10}'
```

**Pros:**
- Zero new API code to maintain — the MCP server already has full Google API coverage
- CLI exists and works (`workspace-cli list`, `workspace-cli call ...`)
- 12 services available from day one
- Token/cache management handled by the server

**Cons:**
- Requires pulling a ~200MB+ container image
- OAuth still needs browser consent (can't be fully headless without service account)
- Still runs a full FastMCP server process inside the container just for CLI access
- Adds Docker dependency for what could be a simple Python script

### Option B: Thin Python scripts via Google APIs directly

Write individual PEP 723 / `uv run --script` Python scripts per operation. Each script uses `google-api-python-client` directly with pinned dependency versions.

**Example structure (initial scope: Gmail + Calendar):**

```
stow-managed/.claude/skills/google-workspace/
├── SKILL.md                              # Agent instructions + tool list
├── scripts/
│   ├── gmail-list.py          # List inbox threads
│   ├── gmail-read.py          # Read a thread by ID
│   ├── gmail-send.py          # Draft/send an email
│   ├── gmail-search.py        # Search emails by query
│   ├── calendar-list.py       # List upcoming events
│   ├── calendar-today.py      # Today's events (shortcut)
│   ├── calendar-create.py     # Create an event
│   └── auth.py                # Shared OAuth helper (imported)
```

**Pros:**
- **No MCP server, no Docker container** — the purest expression of the philosophy
- ~50-100 lines per script, easy to extend or tweak
- First-party Google SDK with full API surface
- Auth tokens cached to `~/.google_workspace_mcp/credentials/` (compatible with `workspace-mcp` format)
- Scripts are portable across machines (just need `uv` and GCP OAuth creds)
- Can reuse `workspace-mcp`'s credential storage format for cross-compatibility

**Cons:**
- More scripts to write and maintain up front
- Each script needs the same OAuth boilerplate (or a shared auth module)
- Need to handle token refresh in each script or import a shared helper
- Less complete feature coverage than the MCP server (but for Gmail + Calendar the APIs are well-documented)

## Setup Notes

### GCP Requirements (already ready)

- Google Cloud project with OAuth 2.0 credentials (Desktop application type for PKCE)
- APIs enabled: Gmail API, Google Calendar API
- OAuth consent screen configured (Internal or External)

### Auth flow (Public OAuth 2.1 / PKCE)

For Option B, the auth flow is:

1. **First run**: Opens browser for Google consent → gets refresh token → caches it
2. **Subsequent runs**: Reuses cached token, auto-refreshes when expired
3. **Credential storage**: `~/.google_workspace_mcp/credentials/` (same location as `workspace-mcp`)

The `workspace-mcp` project already handles this well — Option B scripts could potentially import its credential management, or use `google-auth-oauthlib` directly with file-based token storage.

### Environment variables

```bash
export GOOGLE_OAUTH_CLIENT_ID="your-client-id"
# No client secret needed for public PKCE clients
```

## Next Steps To Pick Up

When resuming, decide:

1. **Option A vs Option B** — container-based CLI wrapper vs native Python scripts
2. **Which service(s) first** — start with just Gmail, or Gmail + Calendar together
3. **Auth strategy** — share token storage with `workspace-mcp` or use standalone `google-auth-oauthlib`
4. **Skill structure** — single combined skill README with all tools, or separate skills per service

---

## Appendix: The Landscape Changed (Web Research, 2026-06-17)

*This section was appended after researching existing similar setups. The findings below supersede the exploration above — both Option A and Option B are now covered by existing tools.*

### Discovery: Google's Official `gws` CLI

In early March 2026, Google released an official Google Workspace CLI — [`googleworkspace/cli`](https://github.com/googleworkspace/cli) — on GitHub under the `googleworkspace` org. It hit 10k stars in its first week and topped Hacker News. **This is not an officially supported Google product** (pre-v1, breaking changes expected), but it's shipping under their org and is Apache-2.0 licensed.

**Key facts about `gws`:**

| Aspect | Detail |
|---|---|
| Language | Rust, distributed via npm (`@googleworkspace/cli`), pre-built binaries, Homebrew, Cargo |
| Architecture | Reads Google's Discovery Service at runtime — builds its entire command tree dynamically. When Google adds API endpoints, `gws` picks them up automatically without updates |
| Coverage | Every Workspace API: Drive, Gmail, Calendar, Docs, Sheets, Slides, Chat, Apps Script, Tasks, Contacts, Admin, and more |
| Auth | OAuth with AES-256-GCM encrypted credentials (OS keyring), plus service accounts, env-var tokens (`GOOGLE_WORKSPACE_CLI_TOKEN`), and headless/CI export flow |
| Agent skills | Ships 40+ `SKILL.md` files (one per service) plus 50 curated workflow recipes. Install via `npx skills add https://github.com/googleworkspace/cli` |
| Helper commands | High-level shortcuts like `+send`, `+reply`, `+triage`, `+agenda`, `+standup-report`, `+meeting-prep`, `+weekly-digest` |
| Safety | `--sanitize` flag integrates with Google Cloud Model Armor to scan API responses for prompt injection |
| Exit codes | Structured exit codes (0=success, 1=API error, 2=auth error, 3=validation error, 4=discovery error, 5=internal error) for scripting |

#### Common usage

```bash
gws auth setup       # one-time: creates Cloud project, enables APIs, logs you in
gws auth login       # subsequent scope selection and login

gws drive files list --params '{"pageSize": 10}'
gws gmail +send --to [EMAIL] --subject "Hello" --body "Hi there"
gws calendar +agenda --today
gws workflow +standup-report     # today's meetings + open tasks
gws workflow +meeting-prep       # agenda, attendees, linked docs
```

### Community Alternative: `gws-cli` (andmarios)

[andmarios/google-workspace-skill](https://github.com/andmarios/google-workspace-skill) is a Python/uv-based CLI targeting Claude Code directly. 78 commits, MIT license.

- **239 operations** across 8 services: Docs (50), Sheets (49), Slides (36), Drive (28), Gmail (35), Calendar (23), Contacts (15), Convert (3)
- **Runs via** `uvx gws-cli <command>` — no install needed beyond `uv`
- **Comprehensive auth**: multi-account support with encrypted tokens at rest, per-account config, read-only mode
- **Built-in prompt injection protection**: wraps all external content with security markers via [`prompt-security-utils`](https://github.com/andmarios/prompt-security-utils)
- **Dedicated Claude Code skill**: clone to `~/.claude/skills/google-workspace/` and the agent discovers it automatically

### Comparison: The Two Existing CLI Tools

| | **Google's `gws`** | **`gws-cli` (andmarios)** |
|---|---|---|
| Source | `github.com/googleworkspace/cli` | `github.com/andmarios/google-workspace-skill` |
| Language | Rust (single binary) | Python (via `uvx`) |
| Coverage | All Workspace APIs (auto-discovered) | 239 ops across 8 services (curated) |
| Agent skills | 40+ included, npx-installable | Dedicated SKILL.md, clone to skills dir |
| Auth model | OS keyring, service accounts, env vars, CI export | Encrypted per-account tokens, multi-account |
| Prompt injection protection | Model Armor (`--sanitize` flag) | Security markers via `prompt-security-utils` |
| CLI ergonomics | Raw Discovery-surface + helper commands | Curated, opinionated commands |
| Status | Google org but **not official**, pre-v1, breaking changes expected | Stable, MIT |
| Install | `npm -g @googleworkspace/cli` or pre-built binary | `uvx gws-cli` (no install) or `uv tool install gws-cli` |

### The Philosophical Alignment

The blogosphere has converged on the same conclusion your exploration reached:

- **MindStudio comparison** ([source](https://www.mindstudio.ai/blog/google-workspace-cli-vs-mcp-claude-code-gmail-docs-access)): "The GWS CLI is a bash-command interface. Claude Code calls it the same way it calls any shell command. That simplicity is the point." Makes the same token-efficiency argument: MCP loads the full API surface into context; a bash tool only loads what's used.
- **Zen van Riel guide** ([source](https://zenvanriel.com/ai-engineer-blog/google-workspace-cli-ai-agents-guide/)): "Guillermo Rauch noted that '2026 is the year of Skills and CLIs' — the command line is becoming the primary interface for both humans and AI agents interacting with cloud services."
- **Hacker News discussion** ([thread](https://news.ycombinator.com/item?id=47255881)): Heavy discussion on the dynamic Discovery-based architecture and what it means for pre-v1 stability.

### What This Means for This Project

Both Option A and Option B are now **superseded by existing tools**. The remaining decision is not "which one to build" but **which one to adopt and wrap** as a dotfiles skill:

- **`gws`** wins on coverage and official backing (even if not formally supported). Its auto-discovery means it never needs updating when Google changes APIs.
- **`gws-cli`** wins on Claude Code integration maturity (dedicated SKILL.md, multi-account, prompt-injection protection) and Python/uv native toolchain.

Either way, the original setup notes (GCP OAuth credentials, PKCE flow) apply directly — both tools consume the same Desktop App OAuth client.

### New References

- [googleworkspace/cli — GitHub](https://github.com/googleworkspace/cli)
- [andmarios/google-workspace-skill — GitHub](https://github.com/andmarios/google-workspace-skill)
- [InfoQ: Google Workspace CLI — Unified Command-Line Tool (June 2026)](https://www.infoq.com/news/2026/06/google-workspace-cli/)
- [MindStudio: GWS CLI vs MCP for Claude Code (May 2026)](https://www.mindstudio.ai/blog/google-workspace-cli-vs-mcp-claude-code-gmail-docs-access)
- [Zen van Riel: Google Workspace CLI for AI Agents Guide (June 2026)](https://zenvanriel.com/ai-engineer-blog/google-workspace-cli-ai-agents-guide/)
- [HN discussion (March 2026)](https://news.ycombinator.com/item?id=47255881)

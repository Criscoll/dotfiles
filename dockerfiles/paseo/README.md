# paseo

Builds `paseo-with-agents`, a [Paseo](https://github.com/getpaseo/paseo) daemon image
(`ghcr.io/getpaseo/paseo`) with Claude Code, pi, and uv installed on top, so agent
sessions launched through Paseo have those CLIs available.

Run via `docker compose up -d` from this directory on the host. Requires a `.env`
file (see `.env.example`) with `TS_IP`, `TS_HOSTNAME`, `PASEO_PASSWORD`,
`OPENROUTER_API_KEY`, and `PASEO_REPO_DIR` — kept outside this repo since it
holds secrets.

## Deployment layout

The actual deployment lives outside this repo (e.g. `~/paseo`), with `Dockerfile`
and `docker-compose.yml` symlinked back into this directory for convenience, and
`.env` / `paseo-home/` kept local (untracked, machine-specific — secrets and
runtime state never belong in this repo).

`PASEO_REPO_DIR` must be an **absolute path to this directory** (e.g.
`/home/user/Repos/dotfiles/dockerfiles/paseo`). The build context is pinned to it
explicitly rather than left as the implicit `.` (the compose file's own
directory), because buildkit refuses to dereference a `Dockerfile` symlink that
escapes the build context — a path-traversal guard, not a bug. Pointing the
context straight at the real repo directory sidesteps that check entirely and
keeps `docker compose build` working normally from the symlinked deployment dir.

## Claude/pi Config Provisioning

The container bind-mounts `/home/cristian/Repos` → `/workspace`, so
`/workspace/dotfiles` **is the same live checkout as the host** — not a separate
clone. This means the container can reuse the exact stow-based provisioning this
repo already uses for read-only machines, instead of a parallel mechanism: full
read-write against the same working tree, no separate ledger needed.

`~/opt` is bind-mounted read-only (`/home/cristian/opt:/home/paseo/opt:ro`)
rather than reinstalled, because the "opt-backed" tools several skills shell out
to (`rtk`, `fzf`, `rg`, `xsv`, `vd`) have no install script or source anywhere in
the repo — they're manually-placed binaries per `stow-managed/bin/CLAUDE.md`. On
the same machine/arch, the host binaries just work; the stow-managed `bin/*`
wrapper scripts already resolve via `$HOME/opt/...`, so this needs zero wrapper
changes. It's read-only since the container has no business mutating host tool
binaries.

`~/.pi` gets its own bind mount (`./paseo-home/.pi:/home/paseo/.pi`) for the same
reason `.claude`/`.config`/etc. already have one: without it, pi's config and
session state live only in the container's writable layer and vanish on
`docker compose down` / recreate.

The `ENTRYPOINT` is wrapped (`provision-agents.sh`, run under `tini` as PID 1
exactly like the base image does) so provisioning happens automatically before
the daemon starts, on every container start — not as a manual one-off
`docker exec`. It:

1. Creates the guard directories (`~/.claude/{commands,agents,skills,hooks}`,
   `~/.pi/agent/{extensions,agents}`) as the `paseo` user.
2. Simulates a stow run (`stow -n -v -t /home/paseo stow-managed`) and backs up
   (`.bak`) any pre-existing plain file stow reports as a conflict. This is the
   same "bootstrap conflict" this repo's root docs already describe for new
   machines (the base image drops a placeholder `.zshrc` and
   `.claude/settings.json` into a fresh home) — handled generically here instead
   of a hand-maintained file list, so it keeps working if the base image changes
   what it bakes in.
3. Runs the real stow.
4. `exec`s into the original `/usr/local/bin/paseo-docker-entrypoint "$@"` so the
   base image's own directory-ensuring / `gosu paseo` daemon-launch logic runs
   unmodified.

**Projects vs. workspaces gotcha:** Paseo's project auto-detection scans for
git repos, tagging each one as its own project. `~/Repos` itself is **not** a
git repo — it's a plain directory containing several git repos as
subdirectories (`dotfiles/`, `spreadsheets/`, etc.). Because the whole thing is
bind-mounted as one flat `/workspace`, Paseo registers `/workspace` itself as a
single project rather than discovering the repos inside it as separate
projects. That's why the "new workspace" picker only ever offers `/workspace`
and can't browse down into e.g. `spreadsheets/` — workspace creation only
works within an already-registered project, and per-project git worktrees
require that project to actually be a git repo. To work on an individual repo
with proper worktree-backed workspaces, register that subdirectory (e.g.
`/workspace/spreadsheets`) as its own project in Paseo instead of expecting it
to appear under the `/workspace` project.

**Anonymous-volume gotcha:** the base image declares `/home/paseo` itself as a
`VOLUME`. Anything under it *not* covered by an explicit bind mount in
`docker-compose.yml` (e.g. `~/Repos`, `~/bin`, `~/.zshrc`, `~/.local`) is backed
by an anonymous volume that Docker seeds from the image **only once, the first
time it's created** — rebuilding the image and running `docker compose up -d` on
top of an *existing* container reuses the stale volume and silently does not
pick up new Dockerfile-baked content there. A full `docker compose down` (which
removes anonymous volumes tied to the removed container) followed by
`docker compose up -d` is required to see fresh image content in those paths.

## Known Gaps / Follow-up

Not solved by the provisioning above — intentionally deferred, not forgotten:

- **`c4ai-sse` / `playwright` MCP servers** need an SSH tunnel to the VPS
  running *inside* the container (today it only exists on the host). MCP
  registration itself (`claude mcp add ...`, stored in `~/.claude.json`) is also
  machine-specific and untracked, so it needs re-running inside the container
  too.
- **`web-search` skill's `searxng-websearch` sidecar** needs a Docker daemon
  reachable from inside the container (Docker-in-Docker, or a shared/mounted
  Docker socket). A plain binary install won't do it.
- **`google-workspace` skill** needs gws-cli OAuth artifacts
  (`~/.config/gws-cli/*.enc` plus the decryption passphrase) deliberately
  carried in — not reproducible by file copy alone.

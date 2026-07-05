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

## Why Containerized, Not Host-Native

Paseo is not a Docker-only artifact — it's a Node CLI (`@getpaseo/cli`, symlinked
at `/usr/local/bin/paseo`, state in `~/.paseo`) that runs perfectly well
host-native. So the container adds **no capability** the host lacks. It is kept
for **one reason: supply-chain confinement.**

Paseo is launched from a phone and runs agent sessions with real tool access. If
a Paseo release (or one of its transitive npm deps) is ever compromised, the
container is the blast-radius wall:

- runs as the non-root `paseo` user, not the host user;
- can't reach `~/.ssh`, the host `$HOME`, or the host OS (nothing there is
  mounted);
- can't modify host tool binaries — `~/opt` is bind-mounted `:ro`;
- has **no Docker socket** mounted, so there's no trivial escape — a breakout
  needs a kernel 0-day;
- malicious npm `install` scripts run at **build time in the image**, never as
  the host user (the image build also uses `--ignore-scripts` for pi).

### Accepted Residual Risk (by design)

The phone workflow is *editing repos from the phone*, which requires write
access, so `~/Repos` is bind-mounted **read-write**. That is a deliberate,
eyes-open trade-off:

- a compromise **can poison repos**, including `dotfiles` — which stows to other
  machines, making it a cross-machine pivot;
- it can **exfiltrate the tokens already in the mounts** (`.claude`, `.codex`,
  `.pi`, `.config`, and `OPENROUTER_API_KEY`) over unrestricted egress.

We accept this for the phone workflow. Mitigations are **digest-pinning the base
image** (`Dockerfile` pins by `@sha256:` so the tag can't be silently repointed)
plus **deliberate, reviewed upgrades** (bump the digest by hand, never float).

### Next Step: Migrate → Host-Native Paseo

**Current direction (decided 2026-07-05): move off the container to host-native.**

The confinement above is only worth its cost if the container stays *lean* — a
small, well-understood surface distinct from the host. But the actual usage
demands the opposite: every skill we wire up needs the container brought to
**feature parity with the host**, which means mounting more of the host in
(host `~/opt`, host `~/Repos` rw, the `.claude`/`.codex`/`.pi`/`.config` token
dirs) and re-solving each tool's setup inside the box. That parity work steadily
erodes the very boundary the container exists to provide — and the friction is
real: `web-search` needed a bespoke sidecar, and `calendar-management` is
**blocked** because gws-cli 1.3.1's local-mode OAuth uses a localhost callback
that can't complete headless (its only device flow needs a relay server we don't
run — see "Known Gaps"). At that point the boundary is mostly notional while the
maintenance is not.

So the plan is to migrate host-native: `npm i -g @getpaseo/cli@<pin>` and run the
daemon as the user. Sessions become plain host processes with full tooling parity
and **zero provisioning** — no stow-in-container, no per-skill parity work, no
headless-auth blockers (calendar included). The cost is giving up all the
confinement listed above; mitigate instead by pinning the Paseo version and
upgrading deliberately, exactly as we already do for the base image digest.

Until that migration happens, the container config here (digest pin, sidecar,
`no-new-privileges`/`pids_limit`) stays as-is and functional. Calendar auth is
intentionally left unconfigured — it will be handled as part of, or after, the
host-native move rather than worked around in-container.

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
- **`google-workspace` / `calendar-management` skills — BLOCKED headless.**
  gws-cli **1.3.1** has two auth modes and neither completes cleanly inside the
  container:
  - **Local mode** (`auth import-credentials <client_secret.json>` →
    `account add <name>`): uses a localhost-callback + browser-launch OAuth with
    **no** device/OOB flag, so Google's redirect to the container's `localhost`
    can't be reached from an external phone/laptop browser without forwarding the
    callback port out.
  - **Server mode** (`config set-mode server --url <relay>` →
    `auth server-login --device`): the `--device` flow *is* headless-friendly, but
    needs an oauth-token-relay server we don't run (a bare `server-login` returns
    `NOT_CONFIGURED`).

  The cleanest workaround is to auth on the **host** (browser + display present,
  localhost callback works natively) and copy `~/.config/gws-cli/` into the
  bind-mounted `paseo-home/.config/gws-cli/` — *if* the encrypted token isn't
  machine-bound (untested for 1.3.1). Deferred: this is expected to be resolved
  by the host-native migration (see "Next Step" above), not solved in-container.

  Note: the `google-workspace` SKILL.md still documents the **old** gws-cli API
  (`auth login`, `account add-service`) — neither subcommand exists in 1.3.1. That
  doc is stale independent of Paseo and should be updated to the
  `import-credentials` → `account add` flow when calendar auth is next touched.

Solved since the original gap list:

- **`web-search`** — no longer needs a Docker daemon inside the container. A
  persistent `searxng` sidecar runs on the compose network (`docker-compose.yml`)
  and the `daemon` service sets `WEBSEARCH_URL=http://searxng:8080`; the
  `websearch` script honors that env var and skips its own container lifecycle.
  No Docker socket is mounted.

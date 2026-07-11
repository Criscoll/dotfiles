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

#### Decision analysis (2026-07-11) — pending, no action taken

Revisited the host-native direction above with a full pros/cons + security
pass before actually pulling the trigger. Full writeup:
`/home/cristian/.claude/plans/i-m-not-convinced-the-noble-wreath.md` (not
part of this repo — a local Claude Code plan file; summarized here so the
decision context survives even if that file doesn't).

**Confirmed today's container already covers most tooling parity** (bind-mounts
`~/Repos` rw and `~/opt` ro, self-provisions via stow) — what's genuinely
broken in-container is the MCP SSH tunnels, calendar OAuth (see "Known Gaps"
below), and the flat `/workspace` single-project problem (see "Projects vs.
workspaces gotcha" below). All three already work today for ordinary
host-native Claude Code/pi sessions, for free, because those run as the
primary user with normal `~/.ssh`, `~/.claude.json`, and `localhost` access —
host-native Paseo would inherit exactly that.

**Host-native pros:** zero provisioning/no Dockerfile-Compose-provisioning
script to maintain, real per-repo project detection instead of one flat
`/workspace` project, sibling Docker services (e.g. the `websearch` skill's
`searxng-websearch` sidecar) reachable over plain `localhost` like any host
process instead of compose-network wiring, calendar/MCP gaps close for free.

**Host-native cons — the blast-radius wall disappears entirely:** no non-root
boundary, no restricted mounts, full reach to `~/.ssh`, `~/.gnupg` (this
repo's git-crypt signing key), every other repo, every credential. Matters
more than usual here because Paseo is phone-triggered over the network,
gated only by `PASEO_PASSWORD` + Tailscale reachability — not a
locally-invoked tool. `npm i -g` also runs install scripts as the real host
user rather than in a disposable image-build layer, and a version pin is a
weaker guarantee than the current `@sha256:` digest pin (no lockfile
enforcement on a global install).

**Forking instead of `npm install -g`:** confirmed viable — `getpaseo/paseo`
is a public AGPL-3.0 npm/turborepo monorepo (10.2k stars, solo-maintained,
active), buildable via `npm run build:server`. Pinning to a reviewed git
commit is stronger provenance than trusting an npm registry publish, and
closes the "malicious version pushed to the registry" vector specifically.
But it's **orthogonal to the sandboxing trade-off above** — host exposure is
identical whether the code is forked or `npm install`ed — and it adds real
ongoing merge/rebase burden against an active project. Best understood as a
stronger pinning mechanism for host-native, not a way to get the container
wall back.

A **dedicated non-root OS user** (not the primary account, not a container)
was considered as a middle ground but rejected: it wouldn't automatically
inherit `~/.claude.json` MCP registrations, SSH agent, or GPG keyring without
extra sharing setup — reintroducing the exact per-tool parity work
host-native is meant to eliminate.

**Status: no decision made.** Asked directly whether to proceed (and via
`npm i -g` vs. fork-and-build) — both answered "not deciding yet." The
container config below remains as-is until a decision is made.

#### Source-build experiment (2026-07-11) — in progress, paused

Cloned `getpaseo/paseo` to `/home/cristian/Repos/paseo` (plain clone, `origin`
still points at `git@github.com:getpaseo/paseo.git` — not yet forked or
repointed at a private remote) to try running the daemon from source, as a
lower-commitment way to poke at host-native before deciding on the migration
above.

Toolchain gap found immediately: the repo pins `nodejs 22.20.0`
(`.tool-versions` / `.mise.toml`); the host only had system `nodejs 18.19.1`
(apt-installed) and no active version manager — `.zshrc` already references
`NVM_DIR` but `~/.nvm` didn't actually exist on this machine. Installed `nvm`
(official install script, into `~/.nvm`, matching what `.zshrc` already
expected) and ran `nvm install 22.20.0` — done. Host `rustc` (1.95.0) is newer
than the repo's pinned `1.85.1` but not yet verified to build cleanly against
it. Java isn't installed; expected to only matter for the Android/mobile
packages, not the headless daemon, but unconfirmed.

**Paused here — not yet run:** `npm install`, `npm run build:server`, and
actually starting the daemon. Relevant facts from `docs/development.md` for
when this resumes: `npm run dev:server` runs the daemon on `127.0.0.1:6768`
against a checkout-scoped `PASEO_HOME` (`$ROOT/.dev/paseo-home`), separate
from the production `~/.paseo` used by `npm run start` / the packaged app on
`:6767`; `npm run cli -- ...` talks to that same dev daemon automatically.

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

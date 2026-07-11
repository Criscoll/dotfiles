# paseo

**Status (2026-07-11): migrated to host-native.** The Paseo daemon now runs
directly on the host as a `systemd --user` service, built from source at
`/home/cristian/Repos/paseo` (a plain clone of `getpaseo/paseo`, `origin` still
pointing at `git@github.com:getpaseo/paseo.git`). The container setup below
(`Dockerfile`, `docker-compose.yml`, `provision-agents.sh`, `.env.example`) is
kept in place, dormant, as a rollback reference — nothing currently runs it.
See "Host-Native Setup (current)" for the live configuration and "Why
Containerized, Not Host-Native" / "Migration History" for how and why this
happened.

## Host-Native Setup (current)

- **Source checkout:** `/home/cristian/Repos/paseo` — plain clone, not a fork.
  Built with `npm install && npm run build:server` under Node 22.20.0 (via
  `nvm`; the repo pins this in `.tool-versions`/`.mise.toml` — the system
  Node is 18.19.1 and too old).
- **Process supervision:** `~/.config/systemd/user/paseo.service`, a simple
  `systemd --user` unit (`Restart=on-failure`). `loginctl enable-linger
  cristian` is enabled so the service starts at boot and keeps running without
  an active login session — required since Paseo is triggered from a phone,
  not an interactive shell.
- **Secrets/env:** `~/paseo/paseo-native.env` (untracked, `chmod 600`,
  loaded via the unit's `EnvironmentFile=`). Holds `PASEO_HOME` (`~/.paseo`),
  `PASEO_LISTEN` (`<tailscale-ip>:6767`), `PASEO_HOSTNAMES` (Tailscale IP +
  MagicDNS hostname, for the daemon's Host-header check), `PASEO_PASSWORD`,
  `OPENROUTER_API_KEY`, and `WEBSEARCH_URL`. Resolved from the same values
  that used to live in `~/paseo/.env` (still present, now only relevant if the
  container is ever revived).
- **Runtime state:** `~/paseo/paseo-home/.paseo` (the bind-mounted container
  volume) was moved to `~/.paseo` — the default `PASEO_HOME` for a host-native
  install — via a plain `mv`, carrying over the existing agent registry,
  projects/workspaces, and daemon keypair. `~/.paseo` did not previously exist
  on the host.
- **Web search:** no dedicated sidecar needed anymore. `WEBSEARCH_URL` points
  straight at the existing standalone `searxng-websearch` container (the
  `web-search` skill's own persistent, `--network=host` sidecar, listening on
  `127.0.0.1:18080`) — the same one ordinary host Claude Code/pi sessions
  already use. The old dedicated `paseo-searxng` compose service was stopped
  and removed (`docker compose down` in `~/paseo`); it existed only because
  the containerized daemon had no other way to reach host services.
- **Management commands:**
  ```bash
  systemctl --user status paseo.service
  journalctl --user -u paseo.service -f
  systemctl --user restart paseo.service
  ```

### Known side effect: old workspaces archived

Workspaces registered while the daemon ran in the container point at
container-relative paths (`/workspace`, `/workspace/spreadsheets`, ...). On
first host-native boot the daemon auto-archived those (directory not found at
those paths on the host) rather than erroring. This is expected and is
actually the fix for the flat-`/workspace` limitation described below under
"Projects vs. workspaces gotcha" — new workspaces should be registered against
real host paths (e.g. `/home/cristian/Repos/dotfiles` as its own project)
instead of one flat `/workspace` project standing in for everything under
`~/Repos`.

### Known gaps now resolved for free

Host-native inherits the primary user's normal `~/.ssh`, `~/.claude.json`, and
`localhost` access, which closes every gap that was previously blocked
in-container (see "Known Gaps / Follow-up" below for the original detail):

- `c4ai-sse` / `playwright` MCP SSH tunnels — work like any other host process.
- `google-workspace` / `calendar-management` — host browser + display makes
  the gws-cli 1.3.1 local-mode localhost-callback OAuth completable normally;
  no relay server needed.

## Why Containerized, Not Host-Native (historical)

Paseo is not a Docker-only artifact — it's a Node CLI (`@getpaseo/cli`) that
runs perfectly well host-native. The container added **no capability** the
host lacked; it existed for **one reason: supply-chain confinement.**

Paseo is launched from a phone and runs agent sessions with real tool access.
If a Paseo release (or one of its transitive npm deps) were ever compromised,
the container was the blast-radius wall:

- ran as the non-root `paseo` user, not the host user;
- couldn't reach `~/.ssh`, the host `$HOME`, or the host OS;
- couldn't modify host tool binaries — `~/opt` was bind-mounted `:ro`;
- had **no Docker socket** mounted, so there was no trivial escape;
- malicious npm `install` scripts ran at **build time in the image**, never
  as the host user.

### Accepted residual risk (by design, while containerized)

The phone workflow is *editing repos from the phone*, which requires write
access, so `~/Repos` was bind-mounted **read-write** — a deliberate trade-off:
a compromise could poison repos (including `dotfiles`, which stows to other
machines) and exfiltrate the tokens in the mounts (`.claude`, `.codex`, `.pi`,
`.config`, `OPENROUTER_API_KEY`) over unrestricted egress. Mitigated by
digest-pinning the base image and deliberate, reviewed upgrades.

## Migration History

**2026-07-05 — direction decided.** The confinement above is only worth its
cost if the container stays lean, but actual usage demanded the opposite:
every skill wired up needed the container brought to feature parity with the
host (more bind mounts, re-solving each tool's setup inside the box), which
steadily eroded the boundary while the maintenance cost stayed real —
`web-search` needed a bespoke sidecar, and `calendar-management` was blocked
outright (gws-cli 1.3.1's local-mode OAuth needs a localhost callback that
can't complete headless, and its device-flow alternative needs a relay server
not run here). Decided to migrate host-native: `npm i -g @getpaseo/cli@<pin>`
or a source build, run as the user, full tooling parity, zero provisioning.

**2026-07-11 — decision analysis.** Revisited with a full pros/cons + security
pass before pulling the trigger. Confirmed the container already covered most
tooling parity — what was genuinely broken in-container was the MCP SSH
tunnels, calendar OAuth, and the flat `/workspace` single-project problem, all
of which work for free host-native since sessions run as the primary user.
Host-native cons: the blast-radius wall disappears entirely (full reach to
`~/.ssh`, `~/.gnupg`, every repo, every credential), which matters more than
usual since Paseo is phone-triggered over the network, gated only by
`PASEO_PASSWORD` + Tailscale reachability. Forking `getpaseo/paseo` (AGPL-3.0,
10.2k stars, solo-maintained) instead of `npm install -g` was confirmed viable
and gives stronger provenance (pin a reviewed commit vs. trust a registry
publish), but is orthogonal to the sandboxing trade-off and adds ongoing
merge/rebase burden. A dedicated non-root OS user was considered as a middle
ground and rejected — it wouldn't inherit `~/.claude.json` MCP registrations,
SSH agent, or GPG keyring without redoing the same per-tool parity work
host-native is meant to eliminate. Decision at that point: not yet — asked
directly, answered "not deciding yet."

**2026-07-11 — source-build experiment, then full migration.** Cloned
`getpaseo/paseo` to `/home/cristian/Repos/paseo` (plain clone, not repointed)
to poke at host-native at lower commitment. Toolchain gap: repo pins Node
22.20.0, host only had system Node 18.19.1 with no active version manager —
installed `nvm` (matching what `.zshrc` already expected) and `nvm install
22.20.0`. `npm install` (2581 packages) and `npm run build:server` both
completed cleanly with no native-build issues (host `rustc` 1.95.0 vs. the
repo's pinned 1.85.1 was never actually exercised — no native/napi deps hit
the Rust toolchain in this build path). Smoke-tested the built daemon in
isolation (scratch `PASEO_HOME`, alternate port, off the production path) —
started clean, password auth enabled, WebSocket up. Given the smoke test and
security analysis above, went ahead with the full cutover the same day: see
"Host-Native Setup (current)" for the resulting configuration. The container
artifacts were deliberately left in place, unused, as a rollback reference
rather than deleted.

## Claude/pi Config Provisioning (historical — container-only)

This section describes how the **container** self-provisioned Claude/pi
config via bind-mounted stow. It no longer applies to daily operation since
the daemon runs host-native and uses the host's own `~/.claude` / `~/.pi`
directly — kept here for whoever revives the container from the rollback
artifacts.

The container bind-mounted `/home/cristian/Repos` → `/workspace`, so
`/workspace/dotfiles` was the same live checkout as the host — not a separate
clone, so it could reuse the exact stow-based provisioning this repo already
uses for read-only machines.

`~/opt` was bind-mounted read-only rather than reinstalled, because the
"opt-backed" tools several skills shell out to (`rtk`, `fzf`, `rg`, `xsv`,
`vd`) have no install script or source anywhere in the repo — they're
manually-placed binaries per `stow-managed/bin/CLAUDE.md`. On the same
machine/arch, the host binaries just worked; the stow-managed `bin/*` wrapper
scripts already resolve via `$HOME/opt/...`.

`~/.pi` got its own bind mount for the same reason `.claude`/`.config`/etc.
already had one: without it, pi's config and session state would live only in
the container's writable layer and vanish on `docker compose down` / recreate.

The `ENTRYPOINT` was wrapped (`provision-agents.sh`, run under `tini` as PID 1
exactly like the base image does) so provisioning happened automatically
before the daemon started, on every container start:

1. Created the guard directories (`~/.claude/{commands,agents,skills,hooks}`,
   `~/.pi/agent/{extensions,agents}`) as the `paseo` user.
2. Simulated a stow run (`stow -n -v -t /home/paseo stow-managed`) and backed
   up (`.bak`) any pre-existing plain file stow reported as a conflict.
3. Ran the real stow.
4. `exec`'d into the original `/usr/local/bin/paseo-docker-entrypoint "$@"` so
   the base image's own directory-ensuring / `gosu paseo` daemon-launch logic
   ran unmodified.

**Projects vs. workspaces gotcha (historical):** Paseo's project
auto-detection scans for git repos, tagging each one as its own project.
`~/Repos` itself is **not** a git repo — it's a plain directory containing
several git repos as subdirectories. Because the whole thing was
bind-mounted as one flat `/workspace`, Paseo registered `/workspace` itself as
a single project rather than discovering the repos inside it as separate
projects, so the "new workspace" picker only ever offered `/workspace` and
couldn't browse into e.g. `spreadsheets/`. Host-native fixes this for free —
each repo under `~/Repos` can now be registered as its own project with
proper worktree-backed workspaces.

**Anonymous-volume gotcha (historical):** the base image declared
`/home/paseo` itself as a `VOLUME`. Anything under it *not* covered by an
explicit bind mount (e.g. `~/Repos`, `~/bin`, `~/.zshrc`, `~/.local`) was
backed by an anonymous volume Docker seeded from the image **only once, the
first time it was created** — rebuilding the image and running `docker
compose up -d` on top of an *existing* container reused the stale volume and
silently didn't pick up new Dockerfile-baked content there. A full `docker
compose down` followed by `docker compose up -d` was required to see fresh
image content in those paths.

## Known Gaps / Follow-up (historical — container-only, resolved by migration)

Not solved by the provisioning above while containerized — see "Known gaps
now resolved for free" above for current status:

- **`c4ai-sse` / `playwright` MCP servers** needed an SSH tunnel to the VPS
  running *inside* the container. MCP registration itself (`claude mcp add
  ...`, stored in `~/.claude.json`) was also machine-specific and untracked.
- **`google-workspace` / `calendar-management` skills were BLOCKED headless.**
  gws-cli **1.3.1** has two auth modes and neither completed cleanly inside
  the container: local mode's localhost-callback OAuth couldn't be reached
  from an external phone/laptop browser, and server mode's headless-friendly
  device flow needed an oauth-token-relay server that wasn't run.

  Note: the `google-workspace` SKILL.md still documents the **old** gws-cli
  API (`auth login`, `account add-service`) — neither subcommand exists in
  1.3.1. That doc is stale independent of Paseo and should be updated to the
  `import-credentials` → `account add` flow when calendar auth is next
  touched.

Solved before the migration:

- **`web-search`** — stopped needing a Docker daemon inside the container. A
  persistent `searxng` sidecar ran on the compose network and the `daemon`
  service set `WEBSEARCH_URL=http://searxng:8080`; the `websearch` script
  honored that env var and skipped its own container lifecycle. No Docker
  socket was mounted. (Now handled even more simply host-native — see "Web
  search" above.)

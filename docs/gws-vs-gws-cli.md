# Google Workspace CLI: `gws` vs `gws-cli`

Findings from evaluating the two candidate CLIs for the Google Workspace agent
skill. **Decision: use `gws-cli` for now.** This doc records why, and what would
justify migrating to `gws` later.

_Verified 2026-06-19 by running `gws-cli` directly and inspecting `gws`'s npm
package + README. Both tools are pre-/post-v1 at the versions noted; re-check
before acting on this much later._

## What each one is

- **`gws` (official-ish)** — `github.com/googleworkspace/cli`. A **Rust binary**
  under Google's GitHub org (but **not** an officially supported product). It
  ships **no fixed command list**: it reads Google's [Discovery Service](https://developers.google.com/discovery)
  at runtime and *generates* its command surface dynamically. Driven with JSON:
  `gws calendar events list --params '{...}'`.
- **`gws-cli` (community)** — `github.com/andmarios/google-workspace-skill`,
  PyPI `gws-cli`, run via `uvx`. A **Python app** with **hand-curated** commands
  and ergonomic flags: `gws-cli gmail send --to x --subject y --body z`.

**They are independent projects — not a fork, and neither is built on the other.**
`gws-cli`'s dependencies are the official Google **Python** SDK
(`google-api-python-client`, `google-auth`, `google-auth-oauthlib`) plus
`typer`/`rich`/`cryptography`/`prompt-security-utils`. No dependency on `gws` or
anything Rust. Both are simply separate clients of the same Google REST APIs.

## Side by side

| | **gws (official)** | **gws-cli (andmarios)** |
|---|---|---|
| Repo | googleworkspace/cli | andmarios/google-workspace-skill |
| Version seen | 0.22.5 (pre-v1, "expect breaking changes") | 1.3.0 / 1.3.1 (post-v1) |
| Backing | Google org, **not officially supported** | Single community maintainer |
| Runtime | Rust single binary, no runtime deps | Python; ~80 MB ML deps on first run |
| Install | binary→`~/opt` + `bin/` wrapper, or npm/brew/cargo/nix | `uvx gws-cli==<ver>` — zero install (uv already required) |
| Startup | Instant | Slow cold start (Python + model load) |
| Command surface | **Every** Workspace API, auto-discovered at runtime | 8 fixed services (Gmail + Calendar fully covered) |
| Surface stability | Generated from live Discovery + pre-v1 mapping → can shift | Hardcoded in source; frozen by a version pin |
| Ergonomics | Raw `--params '{json}'` (verbose for an agent) | Friendly flags (`--to`, `--subject`) |
| Output | Structured JSON | Structured JSON |
| Injection protection | Opt-in `--sanitize` → needs GCP Model Armor | **Always on**, local (the ML deps) |
| Auth modes | keyring / token env / service account / CI export | OAuth + multi-account + read-only mode |
| Extras | `--dry-run`, `--page-all` NDJSON, `gws schema` introspection | per-account service toggles, read-only lockdown |

Both consume the **same Desktop-app `client_secret.json`** already provisioned
for this project.

## Why `gws-cli` for now

For *this* deliverable — a low-maintenance agent skill scoped to Gmail +
Calendar — `gws-cli` wins on:

1. **Repo fit / zero install.** Runs via `uvx`; the only prerequisite is `uv`,
   already required everywhere. No `~/opt` binary, no `bin/` wrapper, no `$PATH`
   change, no per-machine binary upkeep.
2. **Stable command surface.** Commands are hardcoded in source and frozen by a
   version pin (`uvx gws-cli==1.3.0 ...`). The SKILL.md's hardcoded commands keep
   meaning the same thing until we deliberately bump the pin.
3. **Built-in prompt-injection protection**, on by default and local — relevant
   when an agent reads untrusted email. `gws` needs GCP Model Armor wired up.
4. **Full coverage of the scope** (Gmail + Calendar), including every operation
   the existing `calendar-triage` skill needs.

### The "command shift" risk that decided it

`gws` regenerates its commands on every run from (a) Google's live Discovery doc
and (b) its own still-evolving pre-v1 mapping rules. So a command that works
today — e.g. `gws calendar events list --params '{"calendarId":"primary"}'` —
could later become `calendar event list`, or promote `calendarId` to a flag,
breaking a skill that hard-codes the old form. **Pinning the `gws` binary doesn't
fully prevent this**, because part of the surface comes from live Discovery,
outside the pinned version. A pinned Python CLI freezes *everything*. (Caveat:
Discovery for mature APIs like Gmail v1 / Calendar v3 is stable in practice; the
larger churn source is `gws`'s own pre-v1 evolution.)

## When migrating to `gws` would be worth it

Revisit `gws` if the priorities change to favor what it does better:

- **Scope expands well beyond Gmail + Calendar** (Drive, Docs, Sheets, Admin,
  Chat…). `gws` auto-discovers all of them with no extra code and tracks new
  Google endpoints automatically; `gws-cli` is frozen at 8 services.
- **You need raw API control** — arbitrary parameters, `--dry-run`, schema
  introspection, NDJSON pagination — beyond `gws-cli`'s curated commands.
- **`gws` reaches v1 / stabilizes**, removing the surface-churn risk that's the
  main reason it lost here.
- **Performance / footprint matters** — Rust binary with instant startup vs.
  Python + heavy ML deps.
- **Single-maintainer bus-factor on `gws-cli`** becomes a concern and Google's
  backing of `gws` is preferred.

### Migration would mainly mean

- Install `gws` per the repo's `~/opt` + `bin/` wrapper pattern (or npm/brew).
- Re-auth: import the same `client_secret.json`, but use
  `gws auth login -s gmail,calendar` — **note the `@gmail.com` testing-mode
  gotcha**: unverified apps are capped at ~25 scopes, so the broad `recommended`
  preset fails; select services explicitly.
- Rewrite the SKILL.md command strings from `gws-cli`'s flag style to `gws`'s
  `--params '{json}'` style.
- Optionally wire up `--sanitize` (Model Armor) to match the injection
  protection `gws-cli` gives for free.

## References

- gws — https://github.com/googleworkspace/cli (npm `@googleworkspace/cli`)
- gws-cli — https://github.com/andmarios/google-workspace-skill (PyPI `gws-cli`)

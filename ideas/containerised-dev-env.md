# Containerised Dev Environment

## The Problem

Setting up a new machine requires:
- Manually installing binaries into `~/opt/` (Neovim AppImage, Helix, Go, Alacritty, etc.)
- Some of these require building from source or fetching specific releases
- The dotfiles repo handles *config* well via Stow, but doesn't handle *software installation* at all
- Each new machine is a partial manual process regardless of how clean the dotfiles are

## Docker: Technically Viable, Wrong Layer

The instinct to containerise `~/` with Docker is reasonable but hits a hard architectural wall: **the terminal emulator must run on the host**.

Alacritty is a GPU-accelerated terminal — it needs direct access to the display server and GPU. It cannot run inside a Docker container in any practical sense. This means the real topology would be:

```
Alacritty (host, uncontainerised)
  └─ docker exec -it mydev zsh
       └─ Tmux
            └─ Neovim, shell tools, etc. (all containerised)
```

This works, but creates ongoing friction:

- **Clipboard**: Requires explicit configuration (e.g. `xclip`/`xsel` forwarded into the container, or `DISPLAY` passed through)
- **Fonts**: Nerd Fonts must still be installed on the host for Alacritty to render them; the container sees nothing
- **File paths**: Host paths and container paths diverge; tools that open files by path (e.g. `open`, `xdg-open`) break or need workarounds
- **Privileged access**: Some tools (debuggers, `perf`, hardware access) need `--privileged` or specific capabilities
- **Startup**: Every new shell session requires `docker exec` or an always-running container; neither is seamless
- **macOS**: Docker on macOS runs inside a Linux VM, adding another layer and worsening I/O performance for anything touching `~/`

The container approach solves the binary installation problem but introduces container plumbing problems in its place. Net benefit is unclear.

## The Right Tool: Nix + home-manager

Nix is purpose-built for exactly this problem. It manages both packages and dotfiles declaratively, reproducibly, and without containers.

### How it works

- `home-manager` is a Nix tool that takes a declarative config (`home.nix` or `flake.nix`) and applies it to `~`
- Packages declared in the config are installed into `~/.nix-profile/` — no root, no system pollution
- Dotfiles are also declared in the config and either generated or symlinked by home-manager (replacing Stow)
- On a new machine: install Nix, run `home-manager switch` → full environment materialises

### What it replaces in this repo

| Current approach | Nix equivalent |
|---|---|
| `~/opt/` + manual installs | `home.packages = [ pkgs.neovim pkgs.helix ... ]` |
| `stow-managed/bin/` wrapper scripts | Not needed; packages are in PATH directly |
| GNU Stow for symlinks | `home.file` declarations or `programs.*` modules |
| `.local` files for machine-specific config | Per-host `flake.nix` overlays or `nixosConfigurations` |

### Cross-platform

Nix runs on Linux and macOS. `nix-darwin` provides macOS system-level integration (launchd services, system preferences). The same `home.nix` can be shared across both platforms with minor per-host overrides.

### The tradeoff

Nix has a **steep learning curve**:
- The Nix language (a pure, lazy functional DSL) is unlike anything else
- Mental model takes weeks to internalise
- Migrating an existing dotfiles setup is a real project, not a weekend task
- Some packages are not in Nixpkgs or are outdated; AppImages and proprietary binaries need special handling
- Debugging failed builds or broken derivations is non-trivial early on

## Smaller Step: Ansible

If the binary installation pain is the specific problem (not dotfiles management generally), Ansible can solve it without touching the Stow setup:

- An Ansible playbook handles all `~/opt/` installs: download the right binary for the platform, verify checksums, set permissions
- The existing Stow workflow is preserved exactly
- Running `ansible-playbook setup.yml` on a new machine installs all binaries
- Lower upside than Nix, but the cost to adopt is a fraction of the cost

This is a good incremental option if the goal is reducing manual steps per machine without committing to a full Nix migration.

## Summary

| Approach | Solves binary installs | Solves dotfiles | Cross-platform | Complexity |
|---|---|---|---|---|
| Docker (containerise `~/`) | Yes | Partially | Yes (with caveats) | High — wrong abstraction |
| Nix + home-manager | Yes | Yes | Yes | High — right abstraction, steep curve |
| Ansible + keep Stow | Yes | No (keep as-is) | Yes | Low |
| Status quo (Stow only) | No | Yes | Yes | None |

**Recommendation**: If pain is high enough to justify a real investment, migrate to Nix + home-manager. If a lighter fix is wanted, add an Ansible playbook for binary installs and keep everything else. Docker is not the right tool here.

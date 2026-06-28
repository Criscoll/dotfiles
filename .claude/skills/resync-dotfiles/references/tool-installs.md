# Tool Installation Reference

Load-on-demand reference for the resync-dotfiles skill. When a tool has decision
`install-now`, look up the canonical install command here. Do not try fallbacks
automatically — if a command fails, surface it to the user.

---

## Tier hierarchy

**apt** — OS-level utilities (git, tmux, zsh, stow, docker, git-crypt, fd, rclone, delta).
Distro signs packages and tracks CVEs; version lag is acceptable for slow-moving system tools.

**GitHub release → ~/opt/** — fast-moving dev tools (nvim, fzf, rg, alacritty, rtk, xsv, pi,
delta). Distro is typically 1–3 years behind; GitHub release is the project's canonical
distribution. Always verify SHA256 against the project's release checksums file.

**Official installer** — tools that self-manage their updates (uv, claude). The publisher
provides a canonical script or npm package; use it rather than apt/brew.

**pip venv → ~/opt/** — Python CLI tools (visidata) that need an isolated Python env.

**brew** — macOS equivalent of apt for system tools; for ~/opt/ tools, prefer a symlink from
the brew prefix into ~/opt/ so the wrapper still resolves correctly.

**Cargo** — last resort; requires full Rust toolchain (~1.5 GB, slow build). Only if no
binary release exists for the tool.

---

## Per-tool commands

One canonical method per OS. If the command fails, surface it to the user — do not try a
fallback automatically.

| Tool | ~/opt/ path | Linux install | macOS install | Notes |
|---|---|---|---|---|
| `nvim` | `~/opt/nvim` | Download AppImage from github.com/neovim/neovim/releases; verify sha256; `chmod +x`; place at `~/opt/nvim` | Same AppImage path, or `brew install neovim; ln -sf $(brew --prefix)/bin/nvim ~/opt/nvim` | Wrapper: `stow-managed/bin/nvim` |
| `hx` (helix) | `~/opt/helix/hx` | Download tarball from github.com/helix-editor/helix/releases; verify sha256; extract to `~/opt/helix/` | Same | Not in versions.lock; wrapper: `stow-managed/bin/hx` |
| `go` / `gofmt` | `~/opt/go/bin/{go,gofmt}` | Download tarball from go.dev/dl; verify sha256; `tar -C ~/opt -xzf go*.tar.gz` | Same | Wrappers: `stow-managed/bin/go`, `stow-managed/bin/gofmt` |
| `alacritty` | `~/opt/alacritty` | Download AppImage from github.com/alacritty/alacritty/releases; verify sha256; `chmod +x`; place at `~/opt/alacritty` | Same AppImage path | Wrapper: `stow-managed/bin/alacritty` |
| `pi` | `~/opt/pi/pi` | Download from pi release page (see `~/opt/pi/docs/` for URL); verify sha256; extract to `~/opt/pi/` | Same | Wrapper: `stow-managed/bin/pi` |
| `rtk` | `~/opt/rtk` | Download binary from github.com/rtk-ai/rtk/releases; verify sha256; `chmod +x`; place at `~/opt/rtk` | Same | Wrapper: `stow-managed/bin/rtk` |
| `xsv` | `~/opt/xsv` | Download binary from github.com/BurntSushi/xsv/releases; verify sha256; `chmod +x`; place at `~/opt/xsv` | Same | Wrapper: `stow-managed/bin/xsv` |
| `vd` (visidata) | `~/opt/visidata/bin/vd` | `python3 -m venv ~/opt/visidata && ~/opt/visidata/bin/pip install visidata` | Same | Wrapper: `stow-managed/bin/vd` |
| `fzf` | `~/opt/fzf` | Download binary from github.com/junegunn/fzf/releases; verify sha256; `chmod +x`; place at `~/opt/fzf` | `brew install fzf; ln -sf $(brew --prefix)/bin/fzf ~/opt/fzf` | No dedicated wrapper; `~/opt/` dir in PATH via `.zshrc` |
| `rg` (ripgrep) | `~/opt/rg` | Download binary from github.com/BurntSushi/ripgrep/releases; verify sha256; `chmod +x`; place at `~/opt/rg` | `brew install ripgrep; ln -sf $(brew --prefix)/bin/rg ~/opt/rg` | No dedicated wrapper |
| `uv` | n/a | `curl -LsSf https://astral.sh/uv/install.sh \| sh` | Same | Official installer; self-manages updates |
| `claude` | n/a | `npm install -g @anthropic-ai/claude-code` | Same | Official npm package |
| `delta` | n/a | `sudo apt install git-delta` | `brew install git-delta` | No `~/opt/` wrapper; goes to system PATH |
| `rclone` | n/a | `sudo apt install rclone` | `brew install rclone` | |
| `tmux` | n/a | `sudo apt install tmux` | `brew install tmux` | |
| `zsh` | n/a | `sudo apt install zsh` | Pre-installed on macOS | |
| `git` | n/a | `sudo apt install git` | Pre-installed on macOS | |
| `fd` | n/a | `sudo apt install fd-find` | `brew install fd` | Ubuntu binary is `fdfind`; wrapper in `stow-managed/bin/fd` handles the alias |
| `stow` | n/a | `sudo apt install stow` | `brew install stow` | |
| `docker` | n/a | Follow docs.docker.com/engine/install/ubuntu | Docker Desktop | |
| `git-crypt` | n/a | `sudo apt install git-crypt` | `brew install git-crypt` | |

---

## SHA256 verification pattern (GitHub releases)

```bash
# 1. Download the asset and its checksums file (names vary by project)
curl -LO https://github.com/OWNER/REPO/releases/download/vX.Y.Z/tool-linux-x86_64
curl -LO https://github.com/OWNER/REPO/releases/download/vX.Y.Z/sha256sums.txt

# 2. Verify (grep for just the asset you downloaded)
sha256sum --check --ignore-missing sha256sums.txt

# 3. Place binary
chmod +x tool-linux-x86_64
mv tool-linux-x86_64 ~/opt/TOOL_NAME
```

If the project uses a different checksums file name (e.g. `checksums.txt`, `SHASUMS256.txt`),
adjust step 1 accordingly — check the GitHub release page for the exact filename.

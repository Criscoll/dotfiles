# Phase 6: Cargo and delta

`delta` is a git diff pager used throughout `.zshrc` (aliases like `gd`, `glh`, `gds`, etc.). It is installed via cargo (Rust's package manager). `~/.cargo/bin` is already in `$PATH` via `.zshrc`.

## Step 1: Install build tools (Linux only)

Cargo compiles delta from source and requires a C linker. On macOS the Xcode CLT provides this automatically; on Linux it must be installed explicitly.

```bash
sudo apt install -y build-essential
```

## Step 2: Install cargo

Check if cargo is already installed (skip if step 1 was needed — cargo won't be there yet):
```bash
{ command -v cargo && cargo --version; } || echo "cargo: NOT INSTALLED"
```

If missing, install via rustup:

### Linux
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
. "$HOME/.cargo/env"
```

### macOS
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
. "$HOME/.cargo/env"
```

### Confirm
```bash
cargo --version
```

## Step 3: Install delta

### Linux and macOS (via cargo)
```bash
cargo install git-delta
```

### macOS alternative (brew)
```bash
brew install git-delta
```

Note: if installed via brew on macOS, the binary lands in the brew prefix, not `~/.cargo/bin` — both are in PATH so either works.

### Confirm
```bash
delta --version
```

## Route
```bash
python3 ${CLAUDE_SKILL_DIR}/orchestrate.py --route 6 done
```

# Mason Installation Failures

These errors appear in `:MasonLog` / `~/.local/state/nvim/mason.log`, not the nvim log.
The mason-lspconfig ERROR in the nvim log just says "failed to install X" — always read the Mason log for the real cause.

```bash
cat ~/.local/state/nvim/mason.log | tail -60
```

---

## Case A — Stale lockfile from a previous failed install

**Symptom in mason.log:**
```
Lockfile already exists. Package(name=typescript-language-server)
Installation failed ... error="Lockfile exists, installation is already running in another process (pid: XXXXX). Run with :MasonInstall --force to bypass."
```

**Cause:** A prior installation attempt crashed and left a staging directory behind. Mason treats the staging dir as a lock.

**Fix:**
```bash
rm -rf ~/.local/share/nvim/mason/staging/<package-name>
```
Then reinstall with `:MasonInstall <server>`.

---

## Case B — Missing system dependency

**npm not found (ts_ls, html-lsp, etc.):**
```
Failed to spawn process. cmd="npm", err="ENOENT: no such file or directory"
```
Fix: install Node.js / npm via your package manager or nvm.

**unzip not found (clangd, etc.):**
```
Failed to spawn process. cmd="unzip", err="ENOENT: no such file or directory"
```
Fix: `sudo apt install unzip` (or equivalent).

**python3 exits with code 1 (pylsp):**
```
Installation failed for Package(name=python-lsp-server) error=spawn: python3 failed with exit code 1
```
This is almost always missing `ensurepip`. On Ubuntu/Debian, `python3 -m venv --help` can return OK even when `ensurepip` is absent — the venv is created but the bootstrap pip install fails silently at exit code 1.

Verify:
```bash
python3 -m venv /tmp/test-venv 2>&1   # will print the ensurepip error if missing
rm -rf /tmp/test-venv
```

Fix:
```bash
sudo apt install python3.X-venv   # replace X with your Python minor version
```
(e.g. `python3.12-venv` for Python 3.12)

After installing, retry with `:MasonInstall python-lsp-server`.

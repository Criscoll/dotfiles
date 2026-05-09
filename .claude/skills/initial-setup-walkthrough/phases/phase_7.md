# Phase 7: Default Shell and .zshrc.local

## Set zsh as the default shell

Check the current default:
```bash
echo $SHELL
```

If it's not `/bin/zsh` or `/usr/bin/zsh`, change it:
```bash
chsh -s $(which zsh)
```

You'll be prompted for your password. The change takes effect on next login (or when you open a new terminal session).

## Create .zshrc.local

`.zshrc.local` is sourced at the end of `.zshrc` for machine-specific config. It is not tracked in the repo — it lives only on this machine.

```bash
if [ ! -f ~/.zshrc.local ]; then
  cat > ~/.zshrc.local << 'EOF'
# Machine-specific config — not tracked in the dotfiles repo.
# Add work aliases, local env vars, machine-specific PATH entries, etc.

# Examples:
# export WORK_TOKEN="..."
# alias deploy="cd ~/work && ./deploy.sh"
# export PATH="$HOME/.local/bin:$PATH"
EOF
  echo "Created ~/.zshrc.local"
else
  echo "~/.zshrc.local already exists — skipping"
fi
```

## Verify zsh starts cleanly
```bash
zsh -c "echo 'zsh started without errors'"
```

No error output means the shell config is clean.

## Route
```bash
python3 ${CLAUDE_SKILL_DIR}/orchestrate.py --route 7 done
```

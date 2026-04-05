# Current Claude Code Setup

Reference for what's configured and relevant when making changes to `.claude`.

---

## Settings (`~/.claude/settings.json`)

```json
{
  "alwaysThinkingEnabled": true,
  "effortLevel": "high",
  "statusLine": {
    "type": "command",
    "command": "bash /home/cristian/.claude/statusline-command.sh"
  },
  "permissions": {
    "allow": [
      "Bash(ls *)",
      "Bash(rg *)",
      "Bash(fd *)"
    ]
  }
}
```

- `alwaysThinkingEnabled` — extended thinking is always on
- `effortLevel: "high"` — model effort set to high by default; `"max"` is available via `/effort max` or `--effort max` but only on Opus 4.6 and cannot be persisted in settings
- Custom status line via shell script at `~/.claude/statusline-command.sh`
- Auto-allowed Bash commands: `ls`, `rg` (ripgrep), `fd` — all others prompt for approval

---

## Project Instructions (`CLAUDE.md`)

Located at `/home/cristian/Repos/dotfiles/CLAUDE.md`. Key points:

- **Repo purpose**: Terminal-focused dotfiles shared across machines via GNU Stow
- **Primary vs read-only devices**: Only primary devices push; read-only devices pull only
- **`.local` file pattern**: Machine-specific config goes in untracked `.local` files; shared config goes in tracked standard files
- **Stow convention**: Always run `stow --simulate` before applying to catch conflicts
- **Never commit**: credentials, shell history, runtime state, machine-specific private data
- **Tool stack**: Zsh + Powerlevel10k, Alacritty, Tmux, Neovim (lazy.nvim), Helix, delta, fzf + ripgrep, rclone

---

## Memory System (`~/.claude/projects/.../memory/`)

Project-scoped persistent memory for the dotfiles repo lives at:
`~/.claude/projects/-home-cristian-Repos-dotfiles/memory/`

Current memory index entries:
- `project_purpose.md` — Uni-directional sync model, `.local` file pattern
- `feedback_stow_simulate.md` — Always simulate stow before applying
- `feedback_design_docs_location.md` — Keep `.claude/design/` in the repo; not symlinked, not auto-loaded

---

## Design Docs (`~/Repos/dotfiles/.claude/design/`)

This directory. Not symlinked — kept in the repo as a manual reference, not loaded into Claude context automatically. Scope: config optimisation only.

- `README.md` — Overview and index
- `workflows.md` — Efficient prompting patterns (Research → Plan → Implement)
- `setup.md` — This file; current setup snapshot

---

## Key Paths

| Path | Purpose |
|------|---------|
| `~/.claude/settings.json` | Global Claude Code settings |
| `~/.claude/skills/` | Global skills — guard directory, pre-create on new machines |
| `~/.claude/agents/` | Global agents — guard directory, pre-create on new machines |
| `~/.claude/commands/` | Legacy commands — guard directory, prefer `skills/` for new additions |
| `~/Repos/dotfiles/.claude/design/` | Config design reference docs (this repo, not symlinked) |
| `~/.claude/projects/.../memory/` | Project-scoped persistent memory |
| `~/Repos/dotfiles/CLAUDE.md` | Project instructions for this repo |
| `~/.claude/statusline-command.sh` | Custom status line script |

#!/bin/sh
# Claude Code status line - mirrors p10k prompt style (dir + git + claude info)

input=$(cat)

cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd')
model=$(echo "$input" | jq -r '.model.display_name // ""')
used_pct=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
ctx_size=$(echo "$input" | jq -r '.context_window.context_window_size // empty')

# Shorten home directory to ~
home="$HOME"
short_cwd=$(echo "$cwd" | sed "s|^$home|~|")

# Git branch and status (skip optional locks)
git_info=""
if git -C "$cwd" rev-parse --git-dir -q --no-optional-locks > /dev/null 2>&1; then
    branch=$(git -C "$cwd" symbolic-ref --short HEAD 2>/dev/null || git -C "$cwd" rev-parse --short HEAD 2>/dev/null)
    if [ -n "$branch" ]; then
        dirty=""
        if ! git -C "$cwd" diff --quiet --no-optional-locks 2>/dev/null || ! git -C "$cwd" diff --cached --quiet --no-optional-locks 2>/dev/null; then
            dirty="*"
        fi
        git_info=" ($branch$dirty)"
    fi
fi

# Context usage
ctx_info=""
if [ -n "$used_pct" ] && [ -n "$ctx_size" ]; then
    used_tokens=$(awk "BEGIN{printf \"%.0f\", $ctx_size * $used_pct / 100}")
    tok_str=$(awk "BEGIN{printf \"%.0fk\", $used_tokens / 1000}")
    ctx_info=" ctx:${tok_str} ($(printf '%.0f' "$used_pct")%)"
elif [ -n "$used_pct" ]; then
    ctx_info=" ctx:$(printf '%.0f' "$used_pct")%"
fi

printf "%s%s | %s%s" "$short_cwd" "$git_info" "$model" "$ctx_info"

#!/usr/bin/env bash
# check-inefficient-command.sh <command-string>
#
# Checks whether a command string matches any inefficient-command rule.
# stdout: suggestion text if a rule matched; empty if no match
# exit:   always 0
#
# Shared by catch-stupid-commands.sh (Claude Code hook) and
# inefficient-commands.ts (pi extension) so both consumers stay in sync.

command_str="$1"

# rtk-prefixed commands are already token-optimised — skip them to avoid
# false positives (e.g. "rtk grep -r" matching the grep-r rule).
[[ "$command_str" == rtk\ * ]] && exit 0

# git commit: the -m argument is free-form message text, not a command.
# Patterns like "grep -r" in a commit message body must not be blocked.
printf '%s' "$command_str" | command grep -qE '(^|[[:space:]])git[[:space:]]+commit\b' && exit 0

# Flat array: 4 elements per rule — (pattern, suggestion, exception, required_tool).
# Set exception to '' when no exception is needed.
# Set required_tool to the binary the suggestion depends on (e.g. 'rg', 'fd').
# Set required_tool to '' when the alternative needs no new tool.
# Rules are skipped (command allowed through) when required_tool is absent on $PATH.
rules=(
    # rg -r used as recursive flag — actually means --replace; rg recurses by default
    'rg[[:space:]]+-[a-zA-Z]*r[a-zA-Z]*([[:space:]]|$)'
    "rg -r means --replace, not recursive. rg recurses directories by default — no flag needed. Use: rg <pattern> [path]"
    ''
    ''

    # rg with \| alternation (grep BRE syntax) — rg uses | for alternation, not \|
    'rg[[:space:]]+.*\\\|'
    "rg uses | for alternation (not \\|). Use: rg 'pat1|pat2' [path]  or  rg -e 'pat1' -e 'pat2' [path]"
    ''
    ''

    # grep -r / -R / combined flags (e.g. -rn, -rl, -ri): ripgrep is faster and respects .gitignore
    'grep[[:space:]]+-[a-zA-Z]*[rR][a-zA-Z]*([[:space:]]|$)'
    "grep -r is slow and does not respect .gitignore. Use rg instead: rg <pattern> [path]"
    ''
    'rg'

    # grep --recursive (long form)
    'grep[[:space:]]+--recursive([[:space:]]|$)'
    "grep --recursive is slow and does not respect .gitignore. Use rg instead: rg <pattern> [path]"
    ''
    'rg'

    # useless use of cat piped to grep
    'cat[[:space:]]+[^|]+\|[[:space:]]*grep[[:space:]]'
    "Useless use of cat. Pass the file directly to grep: grep <pattern> <file>"
    ''
    ''

    # useless use of cat piped to wc -l
    'cat[[:space:]]+[^|]+\|[[:space:]]*wc[[:space:]]+-l'
    "Useless use of cat. Pass the file directly to wc: wc -l <file>"
    ''
    ''

    # find piped to xargs: fd --exec/-x is safer (handles spaces) and more direct
    'find[[:space:]]+[^|]*\|[[:space:]]*xargs([[:space:]]|$)'
    "find | xargs is inefficient. Use fd with --exec (-x): fd [pattern] [path] -t f -x <cmd> {}. The -x flag handles spaces in filenames and is safer than xargs."
    ''
    'fd'

    # find -name / -iname for file searching: fd is faster and has simpler syntax
    'find[[:space:]]+.*-i?name[[:space:]]'
    "find -name is verbose for file searches. Use fd instead: fd <pattern> [path]"
    ''
    'fd'

    # find -type f/d: fd -t f/d is faster and simpler
    # Exception: allow when using predicates fd cannot replicate (-perm, -user, -group)
    'find[[:space:]]+.*[[:space:]]-type[[:space:]]+[fd]([[:space:]]|$)'
    "Use fd for type-based searches: fd -t f [path] or fd -t d [path]. fd also supports: --changed-after <file> (replaces -newer), --changed-within <duration> (replaces -mtime), --size <spec> (replaces -size). Only use find when filtering by -perm, -user, or -group."
    'find[[:space:]]+.*(-(perm|user|group)[[:space:]])'
    'fd'

    # fd --search-path: not a valid fd flag; silently exits 1 masking the error
    'fd[[:space:]].*--search-path'
    "fd has no --search-path flag. Pass multiple search paths as positional arguments after the pattern: fd <pattern> path1 path2"
    ''
    'fd'
)

for ((i=0; i<${#rules[@]}; i+=4)); do
    pattern="${rules[i]}"
    suggestion="${rules[i+1]}"
    exception="${rules[i+2]}"
    required_tool="${rules[i+3]}"

    if [ -n "$required_tool" ] && ! command -v "$required_tool" &>/dev/null; then
        continue
    fi

    if printf '%s' "$command_str" | command grep -qE "$pattern"; then
        if [ -n "$exception" ] && printf '%s' "$command_str" | command grep -qE "$exception"; then
            continue
        fi
        printf '%s' "$suggestion"
        exit 0
    fi
done

exit 0

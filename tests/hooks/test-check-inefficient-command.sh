#!/usr/bin/env bash
# Tests for check-inefficient-command.sh
# Usage: bash tests/hooks/test-check-inefficient-command.sh
# Exit: 0 if all pass, 1 if any fail

SCRIPT="$(cd "$(dirname "$0")/../.." && pwd)/stow-managed/bin/agent_scripts/check-inefficient-command.sh"

pass=0
fail=0

check_matches() {
    local desc="$1"
    local cmd="$2"
    local out
    out=$("$SCRIPT" "$cmd")
    if [ -n "$out" ]; then
        echo "PASS: $desc"
        ((pass++))
    else
        echo "FAIL: $desc"
        echo "      Expected non-empty output for: $cmd"
        ((fail++))
    fi
}

check_no_match() {
    local desc="$1"
    local cmd="$2"
    local out
    out=$("$SCRIPT" "$cmd")
    if [ -z "$out" ]; then
        echo "PASS: $desc"
        ((pass++))
    else
        echo "FAIL: $desc"
        echo "      Expected empty output for: $cmd"
        echo "      Got: $out"
        ((fail++))
    fi
}

check_no_match_without_tool() {
    local desc="$1"
    local cmd="$2"
    local tool="$3"
    # Run with the tool removed from PATH
    local out
    out=$(PATH=$(echo "$PATH" | tr ':' '\n' | grep -v "$(dirname "$(command -v "$tool" 2>/dev/null)")" | tr '\n' ':') "$SCRIPT" "$cmd" 2>/dev/null)
    if [ -z "$out" ]; then
        echo "PASS: $desc"
        ((pass++))
    else
        echo "FAIL: $desc"
        echo "      Expected empty output (tool '$tool' absent) for: $cmd"
        echo "      Got: $out"
        ((fail++))
    fi
}

echo "=== Should match (non-empty output) ==="
check_matches "rg -r treated as --replace" "rg -r foo ."
check_matches "rg with backslash-pipe alternation" "rg 'foo\|bar'"
check_matches "grep -r (recursive)" "grep -r foo ."
check_matches "grep -rn (combined flag)" "grep -rn foo ."
check_matches "grep --recursive (long form)" "grep --recursive foo ."
check_matches "cat | grep (useless cat)" "cat file.txt | grep foo"
check_matches "cat | wc -l (useless cat)" "cat file.txt | wc -l"
check_matches "find | xargs" 'find . -name "*.ts" | xargs rm'
check_matches "find -name" 'find . -name "*.ts"'
check_matches "find -type f" "find . -type f"
check_matches "find -type d" "find . -type d"

echo ""
echo "=== Should NOT match (empty output) ==="
check_no_match "plain rg (no flags)" "rg foo ."
check_no_match "grep non-recursive" "grep foo file.txt"
check_no_match "find -type f with -perm exception" "find . -type f -perm 755"
check_no_match "find -type f with -user exception" "find . -type f -user root"
check_no_match "find -type f with -group exception" "find . -type f -group staff"
check_no_match "rtk prefix skips grep -r check" "rtk grep -r foo ."

echo ""
echo "=== git commit guard (message text must not be blocked) ==="
check_no_match "git commit -m with grep -r in message" 'git commit -m "mention grep -r in message"'
check_no_match "rtk git commit with blocked pattern in message" 'rtk git commit -m "grep -r is slow, use rg"'
check_no_match "git commit chained after git add" 'git add foo.sh && git commit -m "replace grep -r with rg"'
check_no_match "git commit heredoc form" $'git commit -m "$(cat <<\'EOF\'\nreplace grep -r with rg\nEOF\n)"'

echo ""
echo "=== required_tool guard (tool absent → allow through) ==="
check_no_match_without_tool "grep -r allowed when rg absent" "grep -r foo" "rg"
check_no_match_without_tool "find -name allowed when fd absent" 'find . -name "*.ts"' "fd"

echo ""
echo "=== Summary ==="
echo "Passed: $pass  Failed: $fail"
[ "$fail" -eq 0 ]

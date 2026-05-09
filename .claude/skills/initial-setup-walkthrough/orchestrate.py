#!/usr/bin/env python3
import sys
import os

SKILL_DIR = os.path.dirname(os.path.abspath(__file__))
PHASES_DIR = os.path.join(SKILL_DIR, "phases")

ROUTING = {
    ("0", "ready"): "1",
    ("1", "done"):  "2",
    ("2", "done"):  "3",
    ("3", "done"):  "4",
    ("4", "done"):  "5",
    ("5", "done"):  "6",
    ("6", "done"):  "7",
    ("7", "done"):  "end",
}


def get_phase(phase_id):
    path = os.path.join(PHASES_DIR, f"phase_{phase_id}.md")
    with open(path) as f:
        content = f.read()
    return content.replace("${CLAUDE_SKILL_DIR}", SKILL_DIR)


def route(current, condition):
    key = (current, condition)
    if key not in ROUTING:
        valid = [c for (p, c) in ROUTING if p == current]
        print(
            f"Error: no route from phase {current!r} with condition {condition!r}.\n"
            f"Valid conditions for phase {current!r}: {valid}",
            file=sys.stderr,
        )
        sys.exit(1)
    return ROUTING[key]


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: orchestrate.py --phase N | --route PHASE CONDITION")
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "--phase":
        print(get_phase(sys.argv[2]))
    elif cmd == "--route":
        print(route(sys.argv[2], sys.argv[3]))
    else:
        print(f"Unknown argument: {cmd}", file=sys.stderr)
        sys.exit(1)

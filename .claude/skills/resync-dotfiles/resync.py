#!/usr/bin/env python3
"""Resync skill orchestrator — outputs phase prompts and routes between states."""

import argparse
import sys
from pathlib import Path

PHASES_DIR = Path(__file__).parent / "phases"

# State machine routing table.
# Keys: (current_phase, condition)
# Values: next_phase
ROUTING = {
    # Phase 0: Orientation
    ("0", "done"): "1",

    # Phase 1: Inventory
    ("1", "clean_slate"): "5",      # All files MISSING_LOCALLY — skip timeline/diff/audit
    ("1", "has_local_files"): "2",  # Some local files exist — need analysis

    # Phase 2: Timeline Analysis
    ("2", "done"): "3",

    # Phase 3: Diff and Semantic Analysis
    ("3", "done"): "4",

    # Phase 4: Sensitive Data Audit
    ("4", "done"): "5",

    # Phase 5: Classify Files
    ("5", "done"): "6",

    # Phase 6: Produce Plan — wait for explicit user approval before proceeding
    ("6", "approved"): "7",         # User approved the plan
    ("6", "needs_revision"): "5",   # User wants to reclassify items — redo classification

    # Phase 7: Execution
    ("7", "done"): "end",
    ("7", "sensitive_blocked"): "end",  # Halted: sensitive data in repo, cannot continue
}


def phase_prompt(phase: str) -> None:
    path = PHASES_DIR / f"phase_{phase}.md"
    if not path.exists():
        print(f"Error: no phase file for '{phase}' at {path}", file=sys.stderr)
        sys.exit(1)
    print(path.read_text())


def route(current: str, condition: str) -> None:
    key = (current, condition)
    if key not in ROUTING:
        valid = [
            f"  {c!r} -> {n}"
            for (p, c), n in sorted(ROUTING.items())
            if p == current
        ]
        msg = f"Unknown route: phase={current!r}, condition={condition!r}"
        if valid:
            msg += f"\nValid conditions for phase {current!r}:\n" + "\n".join(valid)
        else:
            msg += f"\nNo routes defined for phase {current!r}."
        print(msg, file=sys.stderr)
        sys.exit(1)
    print(ROUTING[key])


def list_phases() -> None:
    if not PHASES_DIR.exists():
        print(f"Error: phases directory not found: {PHASES_DIR}", file=sys.stderr)
        sys.exit(1)
    for f in sorted(PHASES_DIR.glob("phase_*.md")):
        phase_id = f.stem.replace("phase_", "")
        print(phase_id)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Resync skill orchestrator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
examples:
  %(prog)s --phase 0                    output phase 0 prompt
  %(prog)s --route 1 clean_slate        get next phase (returns '5')
  %(prog)s --route 6 approved           get next phase (returns '7')
  %(prog)s --list                       list all available phases
        """,
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--phase", metavar="N", help="Output the prompt for phase N")
    group.add_argument(
        "--route",
        nargs=2,
        metavar=("PHASE", "CONDITION"),
        help="Print next phase given current phase and outcome condition",
    )
    group.add_argument("--list", action="store_true", help="List available phase IDs")

    args = parser.parse_args()

    if args.phase:
        phase_prompt(args.phase)
    elif args.route:
        route(args.route[0], args.route[1])
    elif args.list:
        list_phases()


if __name__ == "__main__":
    main()

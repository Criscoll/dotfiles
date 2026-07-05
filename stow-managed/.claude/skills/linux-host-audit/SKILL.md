---
name: linux-host-audit
description: >-
  Diagnose resource-constraint root causes on a Linux host or VPS — OOM kills, crashes,
  SSH disconnects, and CPU/memory throttling — by running a bundled script and
  cross-referencing Docker containers against kernel OOM evidence. Auto-invoke BEFORE
  investigating an unexplained crash, reboot, or SSH disconnect on a Linux server, or
  when asked to check host/VPS health or resource pressure. Not for network
  connectivity issues (use the troubleshoot skill) or application-level bugs. Trigger
  phrases: "diagnose crashes", "why did the box crash", "host health check", "check
  for OOM kills", "is the VPS being throttled", "audit this VPS", "resource
  constraint", "getting kicked off ssh", "server health check", "OOM killer", "out of
  memory", "system crashed", "vps unstable".
disable-model-invocation: false
---

## Step 1 — Run the audit script

```bash
bash "$CLAUDE_SKILL_DIR/host-audit.sh"
```

It runs two tiers. Non-root checks (memory/swap snapshot, PSI pressure, steal-time,
reboot history, installed monitoring tools, sar history if already being collected,
Docker container inventory) always run and are usually enough for a first pass. The
root-gated tier — where the actual kernel OOM-killer victim log, panic traces, prior-
boot tails, and auth.log disconnects live — only runs under `sudo`, and the script
says so explicitly rather than failing silently if it's missing.

**An agent cannot supply an interactive sudo password.** If the first run (without
sudo) reports the root section skipped, don't retry `sudo` yourself — it will hang
waiting for a TTY or fail with "a password is required". Instead, hand the exact
command to the user and ask them to run it and paste the output back (or, in Claude
Code, tell them to prefix it with `!` so it runs in-session and lands directly in the
conversation):

```bash
sudo bash "$CLAUDE_SKILL_DIR/host-audit.sh"
```

Add `--since-days N` (default 90) to narrow or widen the history window.

## Step 2 — Split the symptom, then read the matching section

Before interpreting anything, decide whether the report is a hard crash (something
got killed) or throttling (something got slow but survived) — they leave different
evidence and the fix differs. Read `references/diagnosis-playbook.md` for the full
walkthrough: how to parse an OOM-killer triplet, what `global_oom` implies about an
uncapped container, how to read a systemd unit's `oom-kill` result, how to tell a
clean shutdown from a forced one in a prior boot's tail, and rough PSI/steal
thresholds for "this is normal" vs "this is a real problem."

```bash
cat "$CLAUDE_SKILL_DIR/references/diagnosis-playbook.md"
```

The single highest-value cross-reference: every OOM-killer line names a
`task_memcg=` cgroup path. A `docker-<hash>.scope` path maps to a container ID —
the script's Docker section already lists every running container's `mem_limit`, so
check whether the implicated container has `mem_limit=0` (uncapped). An uncapped
container is what turns one greedy process into a `global_oom` event that can kill
anything on the host, including unrelated services or the user's own shell/CLI
session — which is what "crashes" and "kicked off ssh" usually turn out to be on a
small host, even though the container itself was never the process that got killed.

## Step 3 — Propose remediations, don't just apply them

Read `references/remediations.md` for the exact command for each situation: capping
an uncapped container (`docker update --memory=...`, live, no restart), adding a
swapfile when none exists, protecting a specific service from being an OOM victim via
a systemd drop-in, or installing a proactive OOM manager (`earlyoom`).

State the diagnosis and the proposed fix to the user before running anything from
that file — these touch live container/service state on a host presumably in active
use. Apply one fix at a time and verify it (`docker inspect`, `free -h`, `swapon
--show`) before moving to the next, so a regression is traceable to the change that
caused it.

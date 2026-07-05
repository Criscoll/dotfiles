# Reading host-audit.sh output

## First, split the symptom before reading anything

A "crash" and a "throttle" leave different evidence, and reading the wrong section
wastes the whole audit:

| Symptom | Evidence to check | What it means |
|---|---|---|
| Process/session hard-died, SSH kicked | `Kernel OOM-killer victims`, `Systemd units killed by OOM` | The kernel killed something — a real, logged crash |
| Everything is just slow, nothing died | `Pressure Stall Information`, `CPU steal-time snapshot`, `sar` CPU rows | Contention/throttling — survivable, no kill occurred |
| Box rebooted with no explanation | `Tail of each prior boot` | Distinguishes a clean shutdown from a forced restart |

Don't assume a disconnect was a crash. Check the OOM section first — if it's empty
for the relevant time window, the SSH drop was probably a network blip or client-side
issue, not resource exhaustion, and this skill's remediations don't apply.

## Reading an OOM-killer line

```
kernel: systemd invoked oom-killer: ... oom_score_adj=0
kernel: oom-kill:constraint=CONSTRAINT_NONE,...,task_memcg=/system.slice/docker-<hash>.scope,task=chrome,pid=123,uid=999
kernel: Out of memory: Killed process 123 (chrome) total-vm:50734704kB, anon-rss:16380kB, ...
```

Three things to pull out of every triplet:
- **`invoked oom-killer`** — which process *triggered* the scan by requesting memory that couldn't be granted. This is often not the victim, and its identity matters less than the trigger's memory footprint.
- **`constraint=`** — `CONSTRAINT_NONE` + `global_oom` means the OOM killer scanned and could kill **any process on the host**, not just ones in the triggering cgroup. This only happens when the triggering cgroup (e.g. a Docker container) has no `memory.max`/`--memory` cap of its own — an uncapped container is free to pressure the whole machine before the kernel steps in, and when it does, the victim can be anything, not the container. If you see `global_oom` repeatedly, look for an uncapped container as the root cause even if the *victim* was something unrelated (dbus, journald, your own shell).
- **`task_memcg=`** — the cgroup the *victim* belonged to. A path like `/system.slice/docker-<hash>.scope` maps 1:1 to a container ID (the hash is the container ID, truncated in display but matchable via `docker ps -a` + `docker inspect <hash> --format '{{.Name}} mem_limit={{.HostConfig.Memory}}'`, already run for you in the script's Docker section). A path like `/user.slice/user-1000.slice/session-NNNN.scope` is a login session's own processes — a CLI tool, shell, or anything the user launched directly, not a container.

**The pattern that indicates an uncapped-container problem**: multiple OOM invocations clustered within the same minute, with the *trigger* naming a container process (or a chrome/browser/build-tool process whose `task_memcg` is a `docker-*.scope`) and *victims* scattered across unrelated cgroups (system services, other sessions). The container was still allowed to keep allocating after each kill because it has no ceiling of its own — so the kernel kept re-scanning and kept picking increasingly unrelated victims as the "easy" targets ran out.

## Reading "systemd units killed by OOM" lines

```
systemd[N]: dbus.service: Main process exited, code=killed, status=9/KILL
systemd[N]: dbus.service: Failed with result 'oom-kill'.
```

This is systemd's own record of an OOM kill, keyed by unit name rather than PID —
useful for confirming which *service* (not just which raw process) went down, and it
survives even when the raw kernel line has scrolled out of the retention window.

## Reading a prior boot's tail

A clean shutdown ends with a `poweroff.target` / `systemd-shutdown[1]: Syncing
filesystems...` sequence. A boot that instead ends with repeated
`systemd-journald: Under memory pressure, flushing caches` lines and no shutdown
sequence at all was very likely a forced/hard restart under memory exhaustion —
either the OOM killer took out something critical enough to wedge the system, or an
external watchdog (hypervisor, hosting provider) reset it. Treat this as a crash
even though no explicit panic or OOM line names the exact cause — the pattern itself
is the evidence.

## PSI thresholds — how much pressure is "fine"

`/proc/pressure/{memory,cpu}` reports `some` (at least one task stalled) and `full`
(all tasks stalled) as running averages over 10s/60s/300s windows. As a rule of
thumb on a small VPS:
- `cpu some avg60` under ~10% — normal background contention, not a cause for concern.
- Any `full` average consistently above 0 — tasks are fully starved, not just
  competing; this is a real throttling problem worth investigating further (check
  what's runnable via `top`/`htop` at the time).
- `memory some`/`full` spiking right before a gap in the journal — corroborates an
  OOM event even if the kill line itself has rotated out of the logs.

`vmstat`'s `st` (steal) column is the hypervisor-contention signal specifically —
non-zero steal means another VM on the same physical host is taking CPU cycles away
from this one. This is throttling, not something the OOM killer or swap can fix; it's
a hosting-provider/plan-tier issue.

## When the output looks clean

If no OOM lines, no panics, and PSI/steal are near zero across the requested window,
the symptom may not be resource-constraint at all — reconsider network-level causes
(the `troubleshoot` skill's networking playbook) or application-level bugs before
concluding the host is fine and moving on.

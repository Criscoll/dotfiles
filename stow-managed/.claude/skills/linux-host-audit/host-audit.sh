#!/usr/bin/env bash
# Diagnoses resource-constraint root causes on a Linux host: OOM kills, crashes,
# throttling, and Docker containers implicated in either. Safe to run repeatedly
# and safe to run without root — root-gated sections degrade gracefully and say
# so, since that's where the kernel OOM-killer evidence actually lives.
#
# Usage:
#   bash host-audit.sh                  # run as current user (no root section)
#   sudo bash host-audit.sh             # run as root (full output)
#   sudo bash host-audit.sh --since-days 30   # narrower history window (default 90)
set -uo pipefail

# 90 days covers typical log-rotation retention (auth.log/kern.log usually keep
# ~4 rotations) without scanning further back than the journal is likely to hold.
SINCE_DAYS=90
while [ $# -gt 0 ]; do
  case "$1" in
    --since-days) SINCE_DAYS="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done
SINCE="-${SINCE_DAYS} days"

hr() { printf '\n===== %s =====\n' "$1"; }
IS_ROOT=0
[ "$(id -u)" -eq 0 ] && IS_ROOT=1

hr "Host identity"
uname -a
echo "virt: $(systemd-detect-virt 2>&1)"
uptime
last -x reboot 2>&1 | head -10

hr "Memory & swap (current snapshot)"
free -h
swapon --show 2>&1
[ -z "$(swapon --show 2>&1)" ] && echo "No swap configured."
cat /proc/sys/vm/overcommit_memory 2>&1
echo "(overcommit_memory: 0=heuristic [default], 1=always, 2=strict — 0 with no swap is the risky combination)"

hr "Pressure Stall Information (contention that hasn't necessarily killed anything yet)"
for f in /proc/pressure/memory /proc/pressure/cpu /proc/pressure/io; do
  if [ -r "$f" ]; then
    echo "--- $f ---"
    cat "$f"
  else
    echo "$f not available (kernel built without PSI, or cgroup v1 host)"
  fi
done

hr "CPU steal-time snapshot (hypervisor-level contention, 3s sample)"
vmstat 1 3 2>&1

hr "Reboot / boot history"
journalctl --list-boots --no-pager 2>&1

hr "Monitoring tool inventory"
for t in atop sysstat sar earlyoom vmstat mpstat iostat smem dstat; do
  command -v "$t" >/dev/null 2>&1 && echo "$t: installed" || echo "$t: missing"
done
echo "systemd-oomd unit: $(systemctl list-unit-files 2>&1 | grep -c systemd-oomd) found (0 = not installed/available)"

hr "sar historical trend (memory %used/%commit, CPU %idle/%steal — only if sysstat is collecting)"
if systemctl is-active sysstat >/dev/null 2>&1 && ls /var/log/sysstat/sa[0-9][0-9] >/dev/null 2>&1; then
  for f in /var/log/sysstat/sa[0-9][0-9]; do
    # last 5 lines = final ~40min of samples plus the day's Average row — enough
    # to spot a trend without dumping every 10-minute sample from every day
    echo "--- $f (memory) ---"
    sar -r -f "$f" 2>&1 | tail -5
    echo "--- $f (cpu) ---"
    sar -u -f "$f" 2>&1 | tail -5
  done
else
  echo "sysstat not active or no history yet. Install/enable with: sudo apt install sysstat && sudo systemctl enable --now sysstat"
fi

hr "Docker containers (cross-reference target for OOM cgroup paths below)"
if command -v docker >/dev/null 2>&1; then
  docker ps -a --format '{{.ID}}\t{{.Image}}\t{{.Names}}\t{{.Status}}' 2>&1
  echo
  echo "--- memory limits per container (0 = uncapped = can trigger a global OOM storm) ---"
  for cid in $(docker ps -q 2>&1); do
    docker inspect "$cid" --format '{{.Name}} mem_limit={{.HostConfig.Memory}} image={{.Config.Image}}' 2>&1
  done
else
  echo "docker not installed/available"
fi

hr "Storage — filesystem usage"
df -h
echo
df -i
echo "--- top-level usage breakdown for filesystems at or above 80% full ---"
# overlay/tmpfs/devtmpfs/squashfs excluded: overlay is docker's per-container merged
# view (already reflected in the real disk mount underneath it), the rest are RAM.
df -x tmpfs -x devtmpfs -x squashfs -x overlay --output=pcent,target 2>&1 | tail -n +2 | \
while read -r pct mnt; do
  pct_num="${pct%\%}"
  if [ "${pct_num:-0}" -ge 80 ] 2>/dev/null; then
    echo "=== $mnt ($pct full) ==="
    du -xh --max-depth=1 "$mnt" 2>&1 | sort -rh | head -15
    echo
  fi
done

hr "inotify limits & usage (exhaustion breaks editors, dev-server hot-reload, file watchers)"
sysctl fs.inotify.max_user_watches fs.inotify.max_user_instances fs.inotify.max_user_queued_events 2>&1
echo
echo "--- current usage per process (only visible for processes this user owns, unless run as root) ---"
# fs.inotify.max_user_watches/max_user_instances are enforced per real UID, not
# system-wide or per-process — so a single user with many editor/watcher instances
# open can exhaust the limit even while no individual process looks abusive. Sum
# both dimensions per UID as well as listing the per-process breakdown.
declare -A uid_instances uid_watches
found=0
for fd_path in /proc/[0-9]*/fd/*; do
  [ -e "$fd_path" ] || continue
  link="$(readlink "$fd_path" 2>/dev/null)" || continue
  [ "$link" = "anon_inode:inotify" ] || continue
  pid="${fd_path#/proc/}"; pid="${pid%%/*}"
  fdnum="${fd_path##*/}"
  fdinfo="/proc/$pid/fdinfo/$fdnum"
  [ -r "$fdinfo" ] || continue
  watches=$(grep -c '^inotify' "$fdinfo" 2>/dev/null)
  uid=$(awk '/^Uid:/{print $2}' "/proc/$pid/status" 2>/dev/null)
  comm=$(cat "/proc/$pid/comm" 2>/dev/null || echo "?")
  user=$(getent passwd "$uid" 2>/dev/null | cut -d: -f1)
  [ -z "$user" ] && user="uid:$uid"
  echo "pid=$pid user=$user comm=$comm watches=$watches"
  uid_instances["$user"]=$(( ${uid_instances["$user"]:-0} + 1 ))
  uid_watches["$user"]=$(( ${uid_watches["$user"]:-0} + watches ))
  found=1
done
if [ "$found" -eq 0 ]; then
  echo "No inotify instances found (or insufficient permission to inspect other users' fds — re-run with sudo for full coverage)."
else
  echo
  echo "--- totals per user (compare 'watches' against max_user_watches above) ---"
  for user in "${!uid_watches[@]}"; do
    echo "$user: instances=${uid_instances[$user]} watches=${uid_watches[$user]}"
  done
fi

hr "Storage — deleted-but-open files (invisible to du, still billed by df)"
# +L1 lists open files with link count 0 (unlinked/deleted but still held open by a
# process) — the classic cause of a df/du mismatch on a disk-backed filesystem.
# /dev/shm and /run entries are tmpfs (RAM), not real disk, and don't explain a gap.
deleted_open="$(lsof +L1 2>/dev/null | awk '$7+0 > 10485760 {print}')"
if [ -n "$deleted_open" ]; then
  echo "$deleted_open" | sort -k7 -rn
else
  echo "None found above 10MB."
fi

hr "Storage — Docker breakdown"
if command -v docker >/dev/null 2>&1; then
  docker system df 2>&1
  echo
  echo "--- local volumes with no container reference (docker volume prune candidates) ---"
  volumes="$(docker volume ls -q 2>&1)"
  if [ $? -ne 0 ]; then
    echo "$volumes"
  else
    orphaned=0
    for v in $volumes; do
      if ! docker ps -a --filter "volume=$v" --format '{{.ID}}' 2>/dev/null | grep -q .; then
        echo "$v"
        orphaned=$((orphaned + 1))
      fi
    done
    [ "$orphaned" -eq 0 ] && echo "None — every volume is attached to a container."
  fi
else
  echo "docker not installed/available"
fi

if [ "$IS_ROOT" -eq 0 ]; then
  hr "Root-only sections SKIPPED"
  echo "The kernel OOM-killer victim log, panic traces, prior-boot tails, and auth.log"
  echo "disconnects require root (journalctl -k / kern.log / auth.log are mode 640,"
  echo "owner syslog:adm). Re-run as: sudo bash \"$0\" --since-days $SINCE_DAYS"
  echo "An agent cannot supply an interactive sudo password — if you are an agent"
  echo "reading this, ask the user to run the sudo invocation themselves and paste"
  echo "the output back rather than retrying sudo yourself."
  exit 0
fi

hr "Kernel OOM-killer victims (current journal + rotated kern.log*)"
journalctl -k --no-pager --since "$SINCE" 2>&1 | grep -iE "out of memory|killed process|oom-kill|invoked oom-killer"
for f in /var/log/kern.log.*.gz; do
  [ -e "$f" ] || continue
  zgrep -iE "out of memory|killed process|oom-kill|invoked oom-killer" "$f" 2>&1
done

hr "Systemd units killed by OOM (unit-level result, distinct signal from the raw kernel line)"
journalctl --no-pager -p warning --since "$SINCE" 2>&1 | grep -iE "oom-kill|code=killed, status=9|segfault"

hr "Kernel panics / hung tasks / hardware errors"
journalctl -k --no-pager --since "$SINCE" 2>&1 | grep -iE "panic|hung_task|hardware error|mce:|segfault|Call Trace"

hr "Tail of each prior boot (clean poweroff.target sequence vs. abrupt cutoff)"
for idx in $(journalctl --list-boots --no-pager 2>&1 | awk '$1 ~ /^-?[0-9]+$/ {print $1}'); do
  # 15 lines is enough to see a full shutdown.target/poweroff sequence (or its
  # absence) without dumping the whole boot's log
  echo "--- boot $idx, last 15 lines ---"
  journalctl -b "$idx" --no-pager 2>&1 | tail -15
done

hr "SSH disconnects (auth.log, current + rotated)"
# current file gets more lines (most likely to matter); older rotated files get
# fewer since they're lower-relevance the further back they go
grep -iE "disconnect|Connection closed|Connection reset|error:" /var/log/auth.log 2>&1 | tail -60
for f in /var/log/auth.log.*; do
  [ -e "$f" ] || continue
  case "$f" in *.gz) zgrep -iE "disconnect|Connection closed|Connection reset|error:" "$f" 2>&1 | tail -20 ;;
              *) grep -iE "disconnect|Connection closed|Connection reset|error:" "$f" 2>&1 | tail -20 ;;
  esac
done

hr "OOM-protection posture"
dpkg -l systemd-oomd 2>&1 | tail -1
dpkg -l earlyoom 2>&1 | tail -1

hr "Storage — root-only Docker directory breakdown"
if [ -d /var/lib/docker ]; then
  du -xh --max-depth=1 /var/lib/docker/* 2>&1 | sort -rh
  echo
  docker info 2>&1 | grep -i "storage driver"
else
  echo "/var/lib/docker not present"
fi

hr "Done — see the linux-host-audit skill's references/ for how to interpret this and pick a fix."

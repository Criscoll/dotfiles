# Diagnosing and fixing low disk space

This is a distinct symptom from OOM/CPU pressure (see `diagnosis-playbook.md`) — the
evidence and the fix are both different. Jump here directly when `df -h` shows a
mount at or near 100% used, or the user asks where storage is going.

## The `du` vs `df` gap is the first thing to explain, not ignore

`df` reports what the filesystem thinks is allocated; `du` only sees files it can
walk and read. Two things routinely cause a large, confusing gap between the two:

- **Root-owned directories the audit couldn't read without `sudo`.** The script's
  "Storage — filesystem usage" section runs unprivileged first, so directories like
  `/var/lib/docker` show up as a few KB (just the directory inode) instead of their
  real size. If the gap lines up with a permission-denied line in that section's
  output, re-run `sudo bash host-audit.sh` — the root-only tail includes a dedicated
  `/var/lib/docker` subdirectory breakdown for exactly this reason.
- **Deleted-but-still-open files.** A process holding a file handle to a deleted
  file keeps the disk blocks allocated even though the file has no path `du` can
  walk to. The script's "deleted-but-open files" section runs `lsof +L1` (link
  count 0 = unlinked) and filters to entries over 10MB. Ignore anything under
  `/dev/shm` or `/run` — those are tmpfs (RAM-backed), so they can't be the cause of
  a disk-backed mount running out of space, even though `lsof` lists them the same
  way. If a real disk-backed entry (device shown as a major,minor pair like
  `253,1`, not `0,NN`) shows up multi-GB in size, the fix is killing or restarting
  the owning process — the space won't return until the last file handle closes.

If neither explains the gap, the remaining possibility is a filesystem the audit
excluded from the breakdown loop (`overlay`, `tmpfs`, `devtmpfs`, `squashfs`) that's
actually backed by real disk in an unusual way — check `mount` output for the
mount's actual backing device.

## Reading `docker system df`

```
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          6         6         12.95GB   0B (0%)
Containers      6         6         93.01MB   0B (0%)
Local Volumes   13        2         7.725GB   7.725GB (100%)
Build Cache     40        0         5.637GB   4.381GB
```

- **Images/Containers at 0% reclaimable with TOTAL == ACTIVE** — every image and
  container is in active use by something running right now. Nothing to prune here
  without stopping/removing a container first.
- **Build Cache** is pure intermediate layers from past `docker build` runs — never
  a running container's live data. High reclaimable-vs-total here is common after
  repeated builds/rebuilds and is close to always safe to clear:
  ```bash
  sudo docker builder prune -f
  ```
- **Local Volumes with ACTIVE < TOTAL** is the one that needs judgment, not just
  execution. `ACTIVE` counts volumes currently mounted into a running container;
  the rest have no container reference at all, which is why Docker marks their
  share as 100% reclaimable — but "reclaimable" here means "orphaned," not
  "junk verified safe to delete." An orphaned named volume can still hold real data
  from a container that was `docker rm`'d without `-v`, or from an experiment that's
  done, or from a database nobody's touched in months but still needs.

  The script's "local volumes with no container reference" list (in the "Storage —
  Docker breakdown" section) already resolves this cross-reference for you — no
  need to eyeball `docker volume ls` against `docker ps -a` by hand. Before pruning,
  skim the names in that list for anything identifiable (a project name, a database
  engine, a date that doesn't match recent throwaway work). If nothing looks load-
  bearing:
  ```bash
  sudo docker volume prune -f
  ```
  This command is structurally safe in one specific sense — Docker refuses to
  remove a volume with an active container reference, so it can't touch the 2 (or
  however many) volumes something running actually depends on. It is not safe in
  the sense that matters here: whatever data sits in the orphaned volumes is gone
  once pruned. State the volume list and the diagnosis to the user before running
  this, per this skill's general remediation posture.

## A non-standard `rootfs` directory under `/var/lib/docker`

Most Docker installs use the `overlay2` storage driver, which creates
`/var/lib/docker/overlay2/`. If the root-only breakdown instead shows a large
`/var/lib/docker/rootfs` directory, don't assume what driver produced it — confirm
with:
```bash
sudo docker info | grep -i "storage driver"
```
(the script's root-only tail already runs this). Treat the directory name as a
prompt to check, not a diagnosis in itself.

## Order of operations once a fix is agreed

1. `docker builder prune -f` first — zero ambiguity, always safe, do it without
   much ceremony.
2. Re-check `df -h` — if that alone resolves the space problem, stop there rather
   than also touching volumes.
3. Only if still short, move to volume pruning — inspect names, confirm with the
   user, then `docker volume prune -f`.
4. Verify with `df -h` again after each step, so a regression is traceable to the
   step that caused it (same one-fix-at-a-time discipline as the OOM remediations).

# Remediations

Present the diagnosis and the specific fix below to the user before applying any of
these — they change live service/container state on a host that's presumably in use,
and even though every step here is reversible, a wrong guess about *which* container
or service is the offender wastes a restart cycle the user has to notice and undo.

## An uncapped Docker container is triggering global OOM storms

Identified via `diagnosis-playbook.md`'s cross-reference: a container's `mem_limit`
reads `0` in the script's Docker section, and its cgroup path shows up as an OOM
*trigger* (not just an incidental victim).

```bash
# Applies live — no restart needed. Pick a limit comfortably under total host RAM
# (leave headroom for the OS + other services; a few hundred MB is usually enough
# for a single-purpose container like a headless-browser worker).
docker update --memory=768m --memory-swap=768m <container-name>

# If the container was already unhealthy/misbehaving, restart it after capping so
# it starts clean rather than carrying over whatever bad state caused the pressure:
docker restart <container-name>
```

Setting `--memory-swap` equal to `--memory` disables swap *for that container
specifically* (it still can't exceed the cap even if host swap exists) — this keeps
the container's own OOM behavior predictable: it hits its own ceiling and gets
killed inside its own cgroup, instead of pressuring the whole host into a
`global_oom` scan.

## No swap configured on a small host

Confirmed via `swapon --show` being empty in the script's memory section, combined
with `free -h` showing low `available` memory.

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab   # persist across reboots
```

Swap doesn't prevent an OOM kill — a process that genuinely needs more memory than
swap+RAM combined still gets killed. What it does is convert *marginal* memory
pressure (the common case) from an instant, silent hard-kill into a slowdown the
user can actually notice and react to before something dies. Size it modestly (1-2GB
on a small VPS) — a swapfile far larger than RAM just means slow thrashing for a long
time before the inevitable kill, which is worse than a quicker one.

## A specific service must never be the OOM victim (e.g. sshd)

Belt-and-suspenders once the actual offender above is fixed — this doesn't address
the cause, it just biases the kernel's victim selection away from one critical
service.

```bash
sudo mkdir -p /etc/systemd/system/<unit>.service.d
printf '[Service]\nOOMScoreAdjust=-900\n' | sudo tee /etc/systemd/system/<unit>.service.d/oom.conf
sudo systemctl daemon-reload
sudo systemctl restart <unit>
```

Use a drop-in file rather than `systemctl edit <unit>` — the latter opens an
interactive editor, which an agent has no way to drive. `-900` (near the `-1000`
floor that fully exempts a process) makes it very unlikely to be picked without
completely disabling protection.

## No proactive OOM manager at all

`systemd-oomd` (modern, cgroup-aware) or `earlyoom` (older, simpler, wider distro
support) watch memory pressure trending upward and kill the *least valuable* process
early, before the kernel's blunt global OOM killer has to pick blindly among
everything on the host. Worth installing generally, but treat it as secondary to
capping the actual offending container above — a proactive killer chooses better
victims, but an uncapped container will still cause more frequent kills than
necessary.

```bash
sudo apt install earlyoom
sudo systemctl enable --now earlyoom
```

## Applying multiple fixes in one session

Do them one at a time and verify each before moving to the next, per this repo's
testing convention — e.g. confirm `docker update`'s new limit with `docker inspect`
before also touching swap, so if something regresses it's obvious which change did
it.

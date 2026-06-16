# Docker Networking Gotchas

## VPN Breaks Docker Bridge Routing

**Symptom:** `curl http://127.0.0.1:<mapped-port>/` returns `000` (no data) or
"Connection reset by peer". `curl http://172.17.x.x:<port>/` returns
"Connection refused". `docker ps` confirms the container is running.

**Root cause:** VPN software (Mullvad, Tailscale, WireGuard, OpenVPN, etc.) installs
iptables rules that intercept and block traffic to the Docker bridge subnet
(`172.17.0.0/16`). Docker's userland proxy — which forwards `127.0.0.1:PORT →
172.17.x.x:<container-port>` — can't reach the container because the host can't
route to bridge IPs.

**Diagnosis:**
```sh
ping -c 2 -W 2 172.17.0.2   # 100% packet loss → bridge routing is blocked
```

**Fix: use `--network=host`**

Host networking shares the host's network namespace. The container process binds
directly to the host's loopback — no NAT, no bridge, no routing needed:

```sh
docker run -d --rm \
  --network=host \
  -e BIND_HOST=127.0.0.1 \     # limit to loopback, not 0.0.0.0
  -e PORT=18080 \
  some/image
```

Then query `http://127.0.0.1:18080/` directly — no port mapping flags needed.

**Why not just fix the VPN rules?** VPN rules are dynamic (change on reconnect) and
machine-specific. `--network=host` is stable and portable across all affected machines.

---

## Image Defaults to IPv6-Only Bind

**Symptom:** Container is up, `/healthz` returns 200 from inside (`docker exec python3 ...`)
but `curl` from the host returns 000 even without VPN.

**Root cause:** Some images ship with `BIND_HOST=::` (IPv6 all-interfaces). Docker's
bridge NAT is IPv4-based — it can't forward to an IPv6-only socket.

**How to check:**
```sh
docker inspect <image> --format '{{json .Config.Env}}' | python3 -m json.tool | grep -i host
# Look for: "GRANIAN_HOST=::" or "BIND_ADDRESS=::" etc.
```

**Fix:** override the bind host to `0.0.0.0` (IPv4 all) or `127.0.0.1` (loopback):
```sh
-e GRANIAN_HOST=127.0.0.1    # for granian-based images (SearXNG, etc.)
-e BIND_HOST=0.0.0.0         # for other images — check the actual env var name
```

Then combine with `--network=host` if you're also on VPN.

**Known affected images:**
- `searxng/searxng` — `GRANIAN_HOST=::` (granian web server)

---

## Confirming Port Is Reachable

After starting a container, always verify with a direct probe before declaring the
service ready:

```sh
# From host
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:PORT/healthz

# From inside container (bypasses all host-side routing — ground truth)
docker exec <name> python3 -c "
import urllib.request
resp = urllib.request.urlopen('http://localhost:PORT/', timeout=5)
print('status:', resp.status)
"
```

If host-side fails but inside-container succeeds → networking issue (see above).
If both fail → service hasn't started yet, or startup error in logs.

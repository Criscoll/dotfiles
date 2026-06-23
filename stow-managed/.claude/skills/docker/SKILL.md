---
name: docker
description: >-
  Apply Docker best practices and known gotchas for on-demand containers, networking,
  and container config — covers VPN/bridge routing failures, host networking, default
  secret key rejections, and the on-demand lifecycle pattern. Auto-invoke BEFORE any
  `docker run`, Docker networking task, container health check, or Docker-backed agent
  skill setup. Trigger phrases: "docker", "docker run", "container", "host network",
  "docker networking", "searxng", "granian", "--network", "port mapping", "bridge",
  "docker pull", "docker exec".
disable-model-invocation: false
---

Apply the patterns and gotchas below when writing Docker commands, debugging container
connectivity, or building on-demand Docker services for agent skills.

## On-Demand Container Pattern

For agent skills that spin up a container per-call:

```sh
CONTAINER=my-service
PORT=18080

# 1. Remove any stale container from a prior failed run
docker rm -f "$CONTAINER" 2>/dev/null || true

# 2. Start with host networking (see Networking below for why)
docker run -d --name "$CONTAINER" --rm \
  --network=host \
  -e <BIND_HOST_VAR>=127.0.0.1 \
  -e <PORT_VAR>="$PORT" \
  -v "$CONFIG_FILE:/etc/service/config.yml:ro" \
  some/image

# 3. Clean up on all exit paths — --rm handles removal after stop
cleanup() { docker stop "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

# 4. Health-poll before issuing the query
BASE_URL="http://127.0.0.1:${PORT}"
for i in $(seq 1 30); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}/healthz")" = "200" ] && break
  sleep 1
done
```

Key: `--rm` auto-removes on stop; `docker rm -f` pre-cleans for idempotency; `trap cleanup EXIT` covers errors and signals.

## Persistent Container Pattern (preferred for frequent/concurrent calls)

When a skill is called often or concurrently, keep the container running between
calls instead of tearing it down — no per-call cold-start (~10–15s on first pull;
image cached locally after).

```sh
CONTAINER=my-service
PORT=18080

# 1. Reuse if already running
if [ "$(docker inspect --format='{{.State.Running}}' "$CONTAINER" 2>/dev/null)" != "true" ]; then
  # 2. Clear stale state, then start detached (NO --rm — it must survive)
  docker rm -f "$CONTAINER" 2>/dev/null || true
  docker run -d --name "$CONTAINER" --network=host \
    -e <BIND_HOST_VAR>=127.0.0.1 -e <PORT_VAR>="$PORT" some/image \
    2>/dev/null || true          # 3. suppress "name already in use" startup race
fi

# 4. Always health-poll (fast if already healthy)
for i in $(seq 1 30); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/healthz")" = "200" ] && break
  sleep 1
done

# 5. Issue the query. NO EXIT trap — container persists for the next call.
```

Differences from the per-call pattern: omit `--rm`, omit the `trap cleanup EXIT`,
and gate startup on a running-state check so concurrent callers don't collide.

## Networking

**Read `references/networking.md` before any Docker networking task, port mapping setup, or when `curl` to a mapped port returns 000 or "Connection reset by peer".**

```bash
cat "$CLAUDE_SKILL_DIR/references/networking.md"
```

## Container Config Gotchas

**Default secret keys cause startup failure.** Some images ship with a placeholder secret and refuse to start with it. Always override:

```sh
# SearXNG: default is "ultrasecretkey" — server worker exits with an error if unchanged
-e SEARXNG_SECRET=some-non-default-value
```

Check the image's env vars before first run:
```sh
docker inspect <image> --format '{{json .Config.Env}}' | python3 -c "import json,sys; [print(e) for e in json.load(sys.stdin)]"
```

**Image env vars override `settings.yml`.** For images that read config from both env vars and a config file, env vars win. Check the image defaults first; only mount a config file for settings that have no env var equivalent.

**`:ro` volume mounts may cause `chown` warnings.** Some services try to `chown` their config file on startup. This fails silently with `:ro` and is harmless — do not remove `:ro` just to suppress the warning.

## Debugging a Container That Won't Connect

```sh
# 1. Check what the container is actually listening on
docker exec <name> ss -tlnp 2>/dev/null || \
  docker exec <name> python3 -c "import socket; s=socket.socket(); s.bind(('0.0.0.0',0)); print('ipv4 ok')"

# 2. Test from inside the container (bypasses all host-side routing)
docker exec <name> python3 -c "
import urllib.request
resp = urllib.request.urlopen('http://localhost:<port>/', timeout=5)
print('status:', resp.status)
"

# 3. Check image env vars for bind address overrides
docker inspect <image> --format '{{json .Config.Env}}' | python3 -m json.tool

# 4. Check container logs for startup errors
docker logs <name> 2>&1 | grep -E 'ERROR|Listening|exit'
```

## Load Reference Files When Relevant

```bash
cat "$CLAUDE_SKILL_DIR/references/networking.md"
```

| File | Load when |
|---|---|
| `references/networking.md` | Port mapping, VPN, curl returns 000/connection reset, `--network`, bridge routing |

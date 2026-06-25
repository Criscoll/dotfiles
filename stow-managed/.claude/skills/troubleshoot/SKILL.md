---
name: troubleshoot
description: >-
  Dispatch a concrete system or tooling symptom to a domain-specific diagnostic playbook, then load only the
  matching reference (progressive disclosure). Covers networking first (interfaces, routing, DNS, firewall/VPN,
  connectivity). Auto-invoke BEFORE diagnosing a concrete symptom in a known domain — no internet, can't reach
  a host, DNS not resolving, VPN/Tailscale/Mullvad routing, ping/connection failures. Complements the
  `investigate` skill (reasoning process) by supplying the actual commands to run. Trigger phrases: "no
  internet", "can't connect", "can't reach", "not connecting", "ping fails", "DNS not resolving", "name
  resolution", "wifi not working", "VPN", "tailscale", "mullvad", "no route to host", "connection refused",
  "network is unreachable", "troubleshoot the network".
disable-model-invocation: false
---

This skill supplies domain-specific commands. For the reasoning discipline (one-change-one-test,
hypothesis-before-fix, ground-truth hierarchy), the `investigate` skill is assumed — invoke it if not
already active.

## Step 1 — Identify the domain

Read the symptom. Do **not** load any reference file speculatively — loading a domain's full command set when it's irrelevant wastes context and pulls in misleading commands. Match the symptom to a row in the table
below, then load only that reference.

| Symptom domain | Load |
|---|---|
| Connectivity / DNS / routing / VPN / firewall — "can't reach X", no internet, ping/curl fails, Tailscale, Mullvad | `references/networks.md` |

## Step 2 — Load the reference

```bash
cat "$CLAUDE_SKILL_DIR/references/networks.md"
```

Then follow the layered diagnostic sequence in the loaded file.

---

**Adding a domain:** drop a `references/<domain>.md` (one domain per file, one level deep) and add one row
to the table above — the dispatcher logic stays untouched.

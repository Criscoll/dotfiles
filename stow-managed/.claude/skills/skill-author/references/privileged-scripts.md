# Scripts that need sudo without an interactive password

An agent cannot supply a password to an interactive `sudo` prompt — it hangs waiting
for a TTY, or fails with "a password is required" under `sudo -n`. If a skill needs
to run a specific script or command as root on every invocation (a health-check
script, a log audit, a fixed maintenance task), pausing for a human to type a
password every single time is the wrong default. A narrowly-scoped `NOPASSWD`
sudoers rule solves this — scoped to the exact script path, nothing broader — but it
has to be built carefully, since a wrong sudoers file can lock out `sudo` entirely
and a wrong invocation pattern silently fails to match.

This is the validated procedure (built and debugged live against `linux-host-audit`'s
`host-audit.sh` — every pitfall below actually happened, not theoretical).

## The rule: exact path, no wildcards, no args

```
cristian ALL=(root) NOPASSWD: /home/cristian/.claude/skills/<skill-name>/<script>.sh
```

No wildcard on the arguments. Sudoers matches the full command line — a trailing `*`
would let the invocation carry arbitrary arguments, and unless every argument path
through the script has been reviewed as carefully as the sudoers file itself, that's
a bigger grant than it looks. If the script has an optional flag (e.g. a `--since-days
N` window), leave it out of the passwordless path; the rare invocation that needs it
just falls back to an interactive password, which is an acceptable trade for keeping
the common path exact-match only.

**The invocation must match exactly what's in sudoers.** If the skill's documented
command is `sudo bash "$SCRIPT_DIR/script.sh"`, sudo is being asked to run `bash`
with an argument — sudoers would need to whitelist `/usr/bin/bash <path>`, not the
script path alone. Simplest fix: make the script executable with a shebang
(`chmod +x`, `#!/usr/bin/env bash`) and invoke it directly —
`sudo "$SCRIPT_DIR/script.sh"` — so the sudoers rule only ever has one path to match,
not an interpreter-plus-path pair.

## Creating the file: never paste into visudo's interactive editor

`visudo -f /etc/sudoers.d/<name>` opens an interactive editor, and pasting a rule
into it is a real failure mode: text copied from a wrapped source (a chat UI, a
terminal that visually wrapped the line) can carry an embedded newline at the wrap
point, splitting the rule across two lines and breaking it — `visudo` will catch the
syntax error, but only after prompting for a password twice and dropping into a
recovery menu, which is a confusing dead end for an agent to navigate. Skip the
editor entirely:

```bash
# 1. Write the rule with a heredoc — exact content, immune to terminal wrapping
cat <<'EOF' > /tmp/<name>.sudoers
cristian ALL=(root) NOPASSWD: /home/cristian/.claude/skills/<skill-name>/<script>.sh
EOF

# 2. Validate BEFORE it touches /etc/sudoers.d/ — a bad file there breaks sudo for
#    everyone, since sudoers.d is included wholesale via #includedir
sudo visudo -c -f /tmp/<name>.sudoers

# 3. Only if that prints "parsed OK", install it with the required ownership/mode
sudo install -o root -g root -m 0440 /tmp/<name>.sudoers /etc/sudoers.d/<name>
rm -f /tmp/<name>.sudoers
```

`install` sets owner/group/mode atomically in one step — a plain `cp` followed by
separate `chown`/`chmod` leaves a window where the file has the wrong permissions,
and it's easy to forget one of the two follow-up commands.

## The step people actually skip: verify the file made it to `/etc/sudoers.d/`

The most common failure isn't a bad rule — it's validating the rule in `/tmp` and
then never running the `install` step, so nothing ends up in `/etc/sudoers.d/` at
all. If `sudo -n <command>` still asks for a password after "fixing" it, don't
assume the rule syntax is wrong before confirming the file actually exists in place:

```bash
sudo cat /etc/sudoers.d/<name>
```

## Verifying it actually works: `sudo -n`, not plain `sudo`

Testing with plain `sudo <command>` will always appear to succeed, because it just
prompts for a password interactively and a human sitting at the terminal types it —
that tells you nothing about whether an agent (which has no TTY) can run the command
unattended. Test the way the agent actually will:

```bash
sudo -n /home/cristian/.claude/skills/<skill-name>/<script>.sh
```

If this succeeds silently (or produces the script's real output) with no "a password
is required" line, the rule works. If it fails identically to `sudo -n -l` (an
unrelated, deliberately-unmatched command), that's a sign no rule is matching at
all — go back and confirm the file is actually installed (above) before suspecting
something more exotic like a `Defaults requiretty` setting elsewhere in sudoers that
forces a password on any non-tty invocation regardless of NOPASSWD
(`sudo grep -rn "requiretty" /etc/sudoers /etc/sudoers.d/` checks for it).

## Don't misdiagnose slowness as a sudo failure

A privileged script that scans logs over a wide window (e.g. `journalctl --since
"-90 days"`) can legitimately take longer than a normal command timeout, especially
on a CPU-pressured host. If a test run hits a timeout with no explicit sudo error in
the output, that's a runtime problem, not a permissions one — rerun with a longer
timeout (or in the background) before concluding the sudoers rule is broken.

## The residual trust boundary: the script itself

A correctly-scoped rule only ever runs *whatever the script currently contains* — if
the same account that gets NOPASSWD access can also edit the script file (true by
default, since it's usually owned by the user who authored the skill), then in
principle an edit to the script followed by `sudo <script>` achieves the same result
as a wildcard grant would have. Closing this fully means `chown root:root` +
`chmod 755` on the script, so only root can modify it — but that also means the
skill's author needs `sudo` for every future edit to their own script, which is real
ongoing friction. For a single-operator machine where that account already holds
full interactive `sudo`, this residual gap is usually an acceptable trade — the
narrow rule's actual purpose is constraining what an *agent acting autonomously* (or
a prompt-injected one) can do in one unattended step, not defending against the
account's own operator. Flag the tradeoff to the user rather than silently picking
either extreme.

## When this pattern isn't enough

If the privileged surface grows beyond a couple of fixed scripts — several different
commands, or arguments that genuinely need to vary per-invocation — a small
root-owned helper (a tiny daemon or socket the agent calls, which validates inputs
before doing anything privileged) is the more scalable answer, since it can reject
malformed input before escalating rather than relying on sudoers' path-matching
alone. That's real engineering, though, so only reach for it once the sudoers
approach genuinely doesn't fit — not preemptively for one or two scripts.

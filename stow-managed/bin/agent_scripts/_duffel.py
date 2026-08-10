"""Shared Duffel Air helper: token loading, HTTP, redaction, offer summarization.

Imported by duffel-check / duffel-flight-search / duffel-offer-get — not executed
directly. Keeping auth/redaction/parsing here (instead of copy-pasted per script)
means a fix to any of it lands once for every wrapper.
"""

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

API_BASE = "https://api.duffel.com"
DUFFEL_VERSION = "v2"
USER_AGENT = "dotfiles-travel-agent-duffel-wrapper/1.0"

# Sequential test-token searches observed ~2.4s each (flight-search-tools.md); this
# leaves generous slack for slow links without hanging indefinitely.
REQUEST_TIMEOUT = 30

# Retry budget for 429s: courtesy pacing + recovery from a transient rate limit
# without hammering the API (flight-search-tools.md's "don't spam" rule).
MAX_RETRIES = 3

# Duffel returns a `ratelimit-reset` header (RFC 2616 HTTP-date) on a 429 telling
# us exactly when the current window clears — a 2026-08 sweep found a fixed
# exponential backoff (1s/2s/4s) gives up long before that, so honor the header
# instead of guessing. Cap how long we'll auto-wait so a single call can't hang
# past a caller's own timeout budget; beyond the cap we surface the reset time
# and let the caller decide whether to wait.
MAX_RATE_LIMIT_WAIT = 90

SETUP_HINT = (
    "See stow-managed/.claude/skills/travel-agent/references/flight-search-tools.md "
    "for setup: sign up at app.duffel.com, create a Read-Write access token, and "
    "export it as DUFFEL_TOKEN_READ_WRITE (test) or DUFFEL_LIVE_READ_WRITE (live) "
    "in ~/.zshrc.local."
)

_TOKEN_RE = re.compile(r"duffel_(?:test|live)_[A-Za-z0-9_-]+")
_DUR_RE = re.compile(r"P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?")


def eprint(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)


class DuffelAPIError(Exception):
    def __init__(self, status, message, payload=None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.payload = payload or {}


def redact(text):
    if text is None:
        return text
    return _TOKEN_RE.sub("duffel_***_REDACTED", text)


def _mode_from_token(token):
    if token.startswith("duffel_live_"):
        return "live"
    if token.startswith("duffel_test_"):
        return "test"
    eprint("Warning: token does not start with a recognized Duffel prefix "
           "(duffel_test_/duffel_live_) — unable to determine test/live mode.")
    return "unknown"


def load_token(force_test=False):
    if force_test:
        token = os.environ.get("DUFFEL_TOKEN_READ_WRITE")
        if not token:
            eprint(f"DUFFEL_TOKEN_READ_WRITE is not set. {SETUP_HINT}")
            sys.exit(1)
    else:
        token = os.environ.get("DUFFEL_LIVE_READ_WRITE") or os.environ.get("DUFFEL_TOKEN_READ_WRITE")
        if not token:
            eprint(f"Neither DUFFEL_LIVE_READ_WRITE nor DUFFEL_TOKEN_READ_WRITE is set. {SETUP_HINT}")
            sys.exit(1)
    return token, _mode_from_token(token)


def _error_message(payload):
    errors = payload.get("errors") if isinstance(payload, dict) else None
    if not errors:
        return ""
    parts = []
    for e in errors:
        code = e.get("code", "")
        text = e.get("message") or e.get("title") or code
        if code and text != code:
            text = f"{code}: {text}"
        parts.append(text)
    return "; ".join(parts)


def _rate_limit_wait_seconds(headers, attempt):
    """Seconds to wait before retrying a 429.

    Prefers the `ratelimit-reset` header (exact reset time from Duffel); falls
    back to a short exponential backoff if the header is missing or unparseable.
    Returns (wait_seconds, source_label).
    """
    reset_header = headers.get("ratelimit-reset")
    if reset_header:
        try:
            reset_at = parsedate_to_datetime(reset_header)
        except (TypeError, ValueError):
            reset_at = None
        if reset_at is not None:
            if reset_at.tzinfo is None:
                reset_at = reset_at.replace(tzinfo=timezone.utc)
            wait = (reset_at - datetime.now(timezone.utc)).total_seconds()
            # Floor at 1s rather than 0 — a reset boundary that just passed can
            # still 429 for a moment on the server side (bucket refill lag).
            return max(wait, 1), "ratelimit-reset"
    return 2 ** attempt, "fallback backoff (no ratelimit-reset header)"


def request(method, path, token, body=None):
    """POST/GET against the Duffel API. Returns the parsed JSON body.

    Handles 429 by waiting for Duffel's own reset time (falling back to
    exponential backoff, then exiting — no unattended hammering) and 403 with
    the read-write-scope remediation. Any other error status raises
    DuffelAPIError for the caller to handle (e.g. 404 means different things to
    different callers).
    """
    url = f"{API_BASE}{path}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Duffel-Version": DUFFEL_VERSION,
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
    }
    data = json.dumps(body).encode("utf-8") if body is not None else None

    attempt = 0
    while True:
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
                raw = resp.read()
            return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            raw = e.read()
            try:
                payload = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                payload = {}

            if e.code == 429:
                wait, source = _rate_limit_wait_seconds(e.headers, attempt)
                if wait > MAX_RATE_LIMIT_WAIT:
                    eprint(
                        f"Rate limited (429) — resets in {wait:.0f}s per {source}, "
                        f"longer than this tool auto-waits (cap {MAX_RATE_LIMIT_WAIT}s). "
                        "Retry after that."
                    )
                    sys.exit(1)
                if attempt < MAX_RETRIES:
                    eprint(f"Rate limited (429) — waiting {wait:.0f}s per {source} ({attempt + 1}/{MAX_RETRIES}) …")
                    time.sleep(wait)
                    attempt += 1
                    continue
                eprint("Still rate limited after retries — stop and retry later rather than hammering the API.")
                sys.exit(1)

            if e.code == 403:
                raw_text = redact(raw.decode("utf-8", "ignore"))
                if "insufficient_permissions" in raw_text:
                    eprint(
                        "403 insufficient_permissions: this token is Read Only. Duffel "
                        "needs a Read-Write token for air.offer_requests.create — generate "
                        "one at app.duffel.com -> More -> Developers -> Access Tokens."
                    )
                else:
                    eprint(f"403: {redact(_error_message(payload)) or e.reason}")
                sys.exit(1)

            message = redact(_error_message(payload)) or str(e.reason)
            raise DuffelAPIError(e.code, message, payload)
        except urllib.error.URLError as e:
            eprint(f"Network error: {redact(str(e.reason))}")
            sys.exit(1)


def parse_duration_minutes(iso):
    """Parse an ISO8601 duration ('PT9H25M') into total minutes."""
    if not iso:
        return None
    m = _DUR_RE.match(iso)
    if not m:
        return None
    d, h, mnt = m.groups()
    return (int(d) if d else 0) * 24 * 60 + (int(h) if h else 0) * 60 + (int(mnt) if mnt else 0)


def format_duration(iso):
    minutes = parse_duration_minutes(iso)
    if minutes is None:
        return "?"
    h, m = divmod(minutes, 60)
    return f"{h}h{m:02d}m" if h else f"{m}m"


def _parse_dt(s):
    if not s:
        return None
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return None


def _fmt_baggage(passenger):
    baggages = passenger.get("baggages") or []
    parts = []
    for b in baggages:
        qty = b.get("quantity", 0)
        typ = (b.get("type") or "").replace("_", "-")
        if qty and typ:
            parts.append(f"{qty}x {typ}")
    return ", ".join(parts) if parts else "n/a"


def cabin_and_baggage(offer):
    """Duffel has no offer-level cabin/baggage field — pull it from the first
    passenger of the first segment (uniform across an offer in practice)."""
    slices = offer.get("slices") or []
    segments = slices[0].get("segments") if slices else None
    passengers = segments[0].get("passengers") if segments else None
    if not passengers:
        return "?", "n/a"
    p = passengers[0]
    return p.get("cabin_class", "?"), _fmt_baggage(p)


def _fmt_condition(cond):
    if not cond:
        return "not specified"
    if not cond.get("allowed"):
        return "not allowed"
    penalty = cond.get("penalty_amount")
    currency = cond.get("penalty_currency")
    if penalty not in (None, ""):
        return f"allowed, penalty {currency} {penalty}"
    return "allowed, no penalty"


def build_offer_summary(offer):
    """Structured dict summary of one offer — shared base for the flat search
    line, the --json outputs, and the human-readable offer-detail text."""
    cabin, baggage = cabin_and_baggage(offer)
    slices = []
    for sl in offer.get("slices", []):
        segs = []
        for seg in sl.get("segments", []):
            aircraft = seg.get("aircraft") or {}
            segs.append({
                "carrier": seg.get("marketing_carrier", {}).get("iata_code"),
                "flight_number": seg.get("marketing_carrier_flight_number"),
                "origin": seg.get("origin", {}).get("iata_code"),
                "destination": seg.get("destination", {}).get("iata_code"),
                "departs": seg.get("departing_at"),
                "arrives": seg.get("arriving_at"),
                "aircraft": aircraft.get("name"),
                "duration": format_duration(seg.get("duration")),
            })
        slices.append({
            "origin": sl.get("origin", {}).get("iata_code"),
            "destination": sl.get("destination", {}).get("iata_code"),
            "duration": format_duration(sl.get("duration")),
            "segments": segs,
        })
    conditions = offer.get("conditions") or {}
    return {
        "id": offer.get("id"),
        "live_mode": offer.get("live_mode"),
        "price": offer.get("total_amount"),
        "currency": offer.get("total_currency"),
        "airline": offer.get("owner", {}).get("iata_code"),
        "airline_name": offer.get("owner", {}).get("name"),
        "cabin": cabin,
        "baggage": baggage,
        "expires_at": offer.get("expires_at"),
        "slices": slices,
        "refund_before_departure": _fmt_condition(conditions.get("refund_before_departure")),
        "change_before_departure": _fmt_condition(conditions.get("change_before_departure")),
    }


def _fmt_slice_line(sl):
    segs = sl.get("segments", [])
    if not segs:
        return f"{sl.get('origin', '?')}→{sl.get('destination', '?')} no segment data"
    dep = _parse_dt(segs[0].get("departs"))
    arr = _parse_dt(segs[-1].get("arrives"))
    date_str = dep.strftime("%m-%d") if dep else "?"
    dep_str = dep.strftime("%H:%M") if dep else "?"
    arr_str = arr.strftime("%H:%M") if arr else "?"
    day_offset = ""
    if dep and arr:
        delta = (arr.date() - dep.date()).days
        if delta > 0:
            day_offset = f"+{delta}"
    stops = len(segs) - 1
    stop_str = "nonstop" if stops == 0 else (f"{stops}stop" if stops == 1 else f"{stops}stops")
    return (f"{sl.get('origin', '?')}→{sl.get('destination', '?')} {date_str} "
            f"{dep_str}→{arr_str}{day_offset} {stop_str} {sl.get('duration', '?')}")


def summarize_offer(offer):
    """One flat pipe-delimited line per offer — the default search output."""
    s = build_offer_summary(offer)
    parts = [s["id"] or "?", f"{s['currency']} {s['price']}", s["airline"] or "?"]
    n = len(s["slices"])
    for i, sl in enumerate(s["slices"]):
        label = ("OUT" if i == 0 else "RET") if n <= 2 else f"L{i + 1}"
        parts.append(f"{label} {_fmt_slice_line(sl)}")
    parts.append(s["cabin"] or "?")
    parts.append(s["baggage"] or "n/a")
    return " | ".join(parts)


def offer_detail(offer):
    """Multi-line human-readable breakdown of one offer."""
    s = build_offer_summary(offer)
    lines = [
        f"Offer {s['id']}  {s['currency']} {s['price']}  ({s['airline_name'] or s['airline']})",
        f"Mode: {'live' if s['live_mode'] else 'test'}   Expires: {s['expires_at']}",
        "",
    ]
    for i, sl in enumerate(s["slices"]):
        lines.append(f"Slice {i + 1}: {sl['origin']} → {sl['destination']}  (duration {sl['duration']})")
        for seg in sl["segments"]:
            lines.append(
                f"  {seg['carrier']}{seg['flight_number']}  {seg['origin']}→{seg['destination']}  "
                f"{seg['departs']} → {seg['arrives']}  {seg['aircraft'] or 'unknown aircraft'}  "
                f"({seg['duration']})"
            )
        lines.append("")
    lines.append(f"Cabin: {s['cabin']}   Baggage: {s['baggage']}")
    lines.append(f"Refund before departure: {s['refund_before_departure']}")
    lines.append(f"Change before departure: {s['change_before_departure']}")
    return "\n".join(lines)

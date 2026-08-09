"""Shared date-sweep + preference-filter helpers for multi-leg Duffel searches.

Imported by per-trip sweep scripts (e.g. a Travel_ task's flight_date_sweep.py)
so the mechanics of sweeping a date window, picking the cheapest offer that
satisfies stated preferences (red-eye, layover cap, overnight layover, latest
arrival day/time), and summing multi-leg totals aren't reimplemented per trip.
Trip-specific routes, dates, and filter choices stay in the calling script --
this module only holds the reusable parts. Not executed directly.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

import _duffel


@dataclass
class LegFilter:
    """Preference filters applied when picking the best matching offer for a leg.

    Defaults are permissive (no filtering) -- a leg with no stated preference
    (e.g. a short domestic hop) should pass every offer through unfiltered
    rather than silently inherit some other leg's cap.
    """
    require_nonstop: bool = False
    max_layover_min: int | None = None
    reject_redeye: bool = False
    redeye_depart_start_hour: int = 19
    redeye_depart_end_hour: int = 5
    redeye_arrive_before_hour: int = 6
    reject_overnight_layover: bool = False
    overnight_layover_start_hour: int = 22
    overnight_layover_end_hour: int = 6
    # Latest acceptable arrival weekday (Mon=0..Sun=6), e.g. "must land home by
    # Sunday". Leave None to not constrain arrival day at all.
    latest_arrival_weekday: int | None = None
    # If arriving ON latest_arrival_weekday, must be before this local hour.
    # Ignored if latest_arrival_weekday is None.
    latest_arrival_weekday_cutoff_hour: int | None = None


@dataclass
class LegSpec:
    """One leg of a multi-leg trip, dated relative to the sweep's anchor date."""
    label: str
    origin: str
    destination: str
    offset_days: int  # days after the sweep anchor date
    filters: LegFilter = field(default_factory=LegFilter)


def candidate_dates(window_start: date, window_end: date, step_days: int) -> list[date]:
    dates = []
    d = window_start
    while d <= window_end:
        dates.append(d)
        d += timedelta(days=step_days)
    return dates


def leg_summary(offer_summary: dict) -> dict:
    sl = offer_summary["slices"][0]  # one-way search -> single slice
    segs = sl["segments"]
    flight_numbers = "+".join(f"{seg['carrier']}{seg['flight_number']}" for seg in segs)
    layovers = []
    for i in range(len(segs) - 1):
        arr = datetime.fromisoformat(segs[i]["arrives"])
        dep = datetime.fromisoformat(segs[i + 1]["departs"])
        layover_min = int((dep - arr).total_seconds() // 60)
        layovers.append((segs[i]["destination"], layover_min))
    depart_dt = datetime.fromisoformat(segs[0]["departs"])
    arrive_dt = datetime.fromisoformat(segs[-1]["arrives"])
    return {
        "price": float(offer_summary["price"]),
        "currency": offer_summary["currency"],
        "airline_code": offer_summary["airline"],
        "airline_name": offer_summary.get("airline_name"),
        "cabin": offer_summary.get("cabin"),
        "baggage": offer_summary.get("baggage"),
        "flight_numbers": flight_numbers,
        "duration": sl["duration"],
        "stops": len(segs) - 1,
        "layovers": layovers,
        "depart_dt": depart_dt,
        "arrive_dt": arrive_dt,
        "segments": segs,
    }


def is_redeye(leg: dict, f: LegFilter) -> bool:
    dep_hour = leg["depart_dt"].hour
    arr_hour = leg["arrive_dt"].hour
    if dep_hour >= f.redeye_depart_start_hour or dep_hour < f.redeye_depart_end_hour:
        return True
    if arr_hour < f.redeye_arrive_before_hour:
        return True
    return False


def exceeds_max_layover(leg: dict, cap_min: int) -> bool:
    return any(minutes > cap_min for _, minutes in leg["layovers"])


def has_overnight_layover(leg: dict, f: LegFilter) -> bool:
    """A layover that sits inside sleep hours or spans past midnight."""
    for seg, next_seg in zip(leg["segments"], leg["segments"][1:]):
        arr = datetime.fromisoformat(seg["arrives"])
        dep = datetime.fromisoformat(next_seg["departs"])
        if arr.date() != dep.date():
            return True
        if arr.hour >= f.overnight_layover_start_hour or dep.hour < f.overnight_layover_end_hour:
            return True
    return False


def fails_latest_arrival(leg: dict, f: LegFilter) -> bool:
    if f.latest_arrival_weekday is None:
        return False
    weekday = leg["arrive_dt"].weekday()
    if weekday > f.latest_arrival_weekday:
        return True
    if (weekday == f.latest_arrival_weekday
            and f.latest_arrival_weekday_cutoff_hour is not None
            and leg["arrive_dt"].hour >= f.latest_arrival_weekday_cutoff_hour):
        return True
    return False


def best_leg(token: str, origin: str, destination: str, on: date, filters: LegFilter, *,
             adults: int = 1, children: int = 0, infants: int = 0, cabin: str = "economy",
             inter_request_delay: float = 1.0) -> dict:
    """Search one leg on one date; return the cheapest offer matching `filters`
    alongside the cheapest offer overall (so callers can show what a
    preference is costing rather than silently hiding it)."""
    passengers = (
        [{"type": "adult"}] * adults
        + [{"type": "child"}] * children
        + [{"type": "infant_without_seat"}] * infants
    )
    body = {
        "data": {
            "slices": [{"origin": origin, "destination": destination, "departure_date": on.isoformat()}],
            "passengers": passengers,
            "cabin_class": cabin,
        }
    }
    resp = _duffel.request("POST", "/air/offer_requests", token, body)
    if inter_request_delay:
        time.sleep(inter_request_delay)

    offers = resp.get("data", {}).get("offers", [])
    if not offers:
        return {"matched": None, "cheapest_overall": None}

    legs = [leg_summary(_duffel.build_offer_summary(o)) for o in offers]
    cheapest_overall = min(legs, key=lambda leg: leg["price"])

    candidates = legs
    if filters.require_nonstop:
        candidates = [leg for leg in candidates if leg["stops"] == 0]
    elif filters.max_layover_min is not None:
        candidates = [leg for leg in candidates if not exceeds_max_layover(leg, filters.max_layover_min)]
    if filters.reject_redeye:
        candidates = [leg for leg in candidates if not is_redeye(leg, filters)]
    if filters.reject_overnight_layover:
        candidates = [leg for leg in candidates if not has_overnight_layover(leg, filters)]
    if filters.latest_arrival_weekday is not None:
        candidates = [leg for leg in candidates if not fails_latest_arrival(leg, filters)]

    matched = min(candidates, key=lambda leg: leg["price"]) if candidates else None
    return {"matched": matched, "cheapest_overall": cheapest_overall}


def sweep(token: str, anchor_dates: list[date], legs: list[LegSpec], *,
          adults: int = 1, children: int = 0, infants: int = 0, cabin: str = "economy",
          inter_request_delay: float = 1.0) -> list[dict]:
    """Run best_leg for every (anchor date x leg) pair. Each leg's actual date
    is anchor + leg.offset_days -- e.g. offset_days=0 for the outbound leg,
    offset_days=10 for a return leg 10 days later."""
    results = []
    for anchor in anchor_dates:
        leg_results = {}
        for leg in legs:
            on = anchor + timedelta(days=leg.offset_days)
            leg_results[leg.label] = {
                "date": on,
                **best_leg(token, leg.origin, leg.destination, on, leg.filters,
                           adults=adults, children=children, infants=infants, cabin=cabin,
                           inter_request_delay=inter_request_delay),
            }
        legs_ok = all(r["matched"] is not None for r in leg_results.values())
        total = sum(r["matched"]["price"] for r in leg_results.values()) if legs_ok else None
        results.append({"anchor": anchor, "legs": leg_results, "total": total})
    return results


def format_leg(leg: dict | None) -> str:
    if leg is None:
        return "no matching offer"
    stop_word = "nonstop" if leg["stops"] == 0 else f"{leg['stops']}stop"
    layover_str = ""
    if leg["layovers"]:
        layover_str = " (" + ", ".join(f"{ap} {m // 60}h{m % 60:02d}m" for ap, m in leg["layovers"]) + ")"
    dep_str = leg["depart_dt"].strftime("%H:%M")
    arr_str = leg["arrive_dt"].strftime("%H:%M")
    day_offset = (leg["arrive_dt"].date() - leg["depart_dt"].date()).days
    offset_str = f"+{day_offset}" if day_offset else ""
    return (f"{leg['flight_numbers']} {leg['price']:.0f} | {dep_str}->{arr_str}{offset_str} "
            f"{leg['duration']} {stop_word}{layover_str}")


# Duffel returns each timestamp as local wall-clock time with no UTC offset
# attached (a naive ISO string) -- so the offset has to come from a static
# per-airport table, not from parsing the datetime itself. Only covers
# airports exercised so far; extend by merging more entries in as new routes
# come up (e.g. `_duffel_sweep.AIRPORT_UTC_OFFSET["LAX"] = "-08:00"`), rather
# than guessing an offset that hasn't been verified.
AIRPORT_UTC_OFFSET = {
    "SYD": "+11:00",  # AEDT (daylight saving in effect Oct-Apr)
    "TPE": "+08:00",
    "HKG": "+08:00",
    "KHH": "+08:00",
    "SIN": "+08:00",
    "MNL": "+08:00",
    "KUL": "+08:00",
}


def utc_offset_str(airport: str) -> str:
    """Each airport's own UTC offset, so depart/arrive times across a
    timezone-crossing segment don't look like they contradict the stated
    duration (e.g. SYD 11:05 -> HKG 17:30 is 6h25m of *clock* difference but
    9h25m of *elapsed* time, because SYD is UTC+11 and HKG is UTC+8 -- a 3h
    offset the bare clock times don't show)."""
    return AIRPORT_UTC_OFFSET.get(airport, "?")


def format_leg_detail(leg: dict | None, indent: str = "    ") -> str:
    """Per-segment breakdown: each flight's own depart/arrive time (with its
    own UTC offset -- see utc_offset_str), duration, aircraft, with layovers
    printed between the segments they connect."""
    if leg is None:
        return f"{indent}no matching offer"
    lines = []
    segs = leg["segments"]
    for i, seg in enumerate(segs):
        dep = datetime.fromisoformat(seg["departs"])
        arr = datetime.fromisoformat(seg["arrives"])
        day_offset = (arr.date() - dep.date()).days
        offset_str = f"+{day_offset}" if day_offset else ""
        lines.append(
            f"{indent}Seg {i + 1}: {seg['carrier']}{seg['flight_number']}  {seg['origin']}->{seg['destination']}  "
            f"{dep.strftime('%Y-%m-%d %H:%M')} UTC{utc_offset_str(seg['origin'])} -> "
            f"{arr.strftime('%H:%M')}{offset_str} UTC{utc_offset_str(seg['destination'])}  "
            f"{seg['duration']}  {seg['aircraft'] or 'unknown aircraft'}"
        )
        if i < len(segs) - 1:
            airport, minutes = leg["layovers"][i]
            lines.append(f"{indent}  -- layover: {airport}, {minutes // 60}h{minutes % 60:02d}m --")
    lines.append(f"{indent}{leg['airline_name'] or leg['airline_code']} | cabin: {leg['cabin']} | "
                  f"baggage: {leg['baggage']} | price: {leg['price']:.0f} {leg['currency']}")
    return "\n".join(lines)


def print_sweep_report(results: list[dict], legs: list[LegSpec], *,
                        currency_label: str = "AUD", passenger_label: str = "") -> None:
    """Rank candidates cheapest-first and print a summary line per candidate
    followed by a full per-leg breakdown. `passenger_label` is a free-text
    suffix for the total line, e.g. "2 adults" -- leave blank to omit."""
    ranked = sorted(results, key=lambda r: (r["total"] is None, r["total"]))
    total_suffix = f" ({passenger_label})" if passenger_label else ""

    def date_parts(r):
        return " | ".join(f"{leg.label} {r['legs'][leg.label]['date'].isoformat()}" for leg in legs)

    print("Summary (Option ID cross-references the detailed breakdown below):")
    for i, r in enumerate(ranked):
        opt = chr(ord("A") + i)
        total_desc = f"{r['total']:.0f}" if r["total"] is not None else "N/A"
        print(f"  Option {opt}: {date_parts(r)} | Total {currency_label}{total_suffix}: {total_desc}")

    for i, r in enumerate(ranked):
        opt = chr(ord("A") + i)
        total_desc = f"{r['total']:.0f}" if r["total"] is not None else "N/A (no matching offer on one or more legs)"
        print(f"\n=== Option {opt}: {date_parts(r)} | Total {currency_label}{total_suffix}: {total_desc} ===")
        for leg in legs:
            leg_result = r["legs"][leg.label]
            print(f"  {leg.label} ({leg.origin}-{leg.destination}):")
            print(format_leg_detail(leg_result["matched"]))
            if leg_result["matched"] is None and leg_result["cheapest_overall"] is not None:
                print("    (cheapest overall, fails filters):")
                print(format_leg_detail(leg_result["cheapest_overall"], indent="      "))

#!/usr/bin/env python3
"""Regenerate src/data/listening.ts from the live music sources.

Run this occasionally to refresh the portfolio's Listening page without hand-
editing numbers. It reads two things, both on the hub box:

  - hedgy-hub/state/stats-cache.json  -> the hub's authoritative all-time figures
    (total plays, top artists, listening hours, library + analyzed counts),
    computed by hub/stats.py with the merged-play-store methodology (Navidrome
    play_count + non-library Spotify, de-duplicated so the export isn't double
    counted). Pass --refresh to rebuild that cache first (needs the hub venv).

  - hedgy-hub/spotify-export.zip      -> the only source with per-play timestamps,
    used for the dated month-by-month grid and the hour-of-day clock.

The mood quadrants are computed too but the Listening page keeps that chart
hidden until the analyzer has scored the whole library (only ~5.5k of 17k so far).

Run it with the hub's venv python so the Postgres (psycopg) and --refresh paths
work; plain system python falls back to the zip and warns.

Usage:
    ~/Documents/hedgy-hub/venv/bin/python scripts/sync-listening-stats.py [--refresh]
"""
from __future__ import annotations
import collections
import datetime
import json
import os
import sys
import zipfile
import zoneinfo

HUB = os.environ.get("HEDGY_HUB", "/home/hedge/Documents/hedgy-hub")
CACHE = os.path.join(HUB, "state", "stats-cache.json")
EXPORT = os.path.join(HUB, "spotify-export.zip")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "src", "data", "listening.ts")
TZ = zoneinfo.ZoneInfo("America/Chicago")  # local time for the listening clock
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
DARK_HOURS = {22, 23, 0, 1, 2, 3}  # 10pm-4am


def refresh_cache() -> None:
    """Rebuild the hub's stats cache in place (fresh play counts)."""
    sys.path.insert(0, HUB)
    from hub import stats  # type: ignore
    stats.build()


def read_cache() -> dict:
    with open(CACHE) as f:
        return json.load(f)


def _tally(played_ms_iter):
    monthly = collections.defaultdict(lambda: [0] * 12)
    hourly = collections.Counter()
    stamped = 0
    for pm in played_ms_iter:
        dt = datetime.datetime.fromtimestamp(pm / 1000, datetime.timezone.utc).astimezone(TZ)
        monthly[dt.year][dt.month - 1] += 1
        hourly[dt.hour] += 1
        stamped += 1
    return monthly, hourly, stamped


def navidrome_monthly(live_start=(2026, 8)):
    """Dated live-Navidrome plays per month, from the mood plugin's weekly
    buckets (each a list of {track, unix-ts} play events). Only the live-scrobble
    era counts: the buckets ramp from ~1/month to >1000 at 2026-08 when live
    logging began, so earlier sparse entries are pre-logging noise and excluded.
    Navidrome's all-time play_count already merges the Spotify + MusicBee imports,
    so this is the ONE window where self-hosted listening is separable."""
    import subprocess
    script = (
        "import sqlite3,json;"
        "con=sqlite3.connect('file:/kv/kvstore.db?mode=ro&immutable=1',uri=True);"
        "print(json.dumps([(v.decode() if isinstance(v,bytes) else v) for (v,) in con.execute("
        "\"select value from kvstore where key like 'plays:wk%'\")]))"
    )
    monthly = collections.defaultdict(lambda: [0] * 12)
    out = subprocess.run(
        ["docker", "run", "--rm", "-v", "/var/lib/navidrome/plugins/mood-playlists:/kv:ro",
         "python:3-alpine", "python", "-c", script],
        capture_output=True, text=True, timeout=120)
    if out.returncode != 0:
        print(f"  WARNING: could not read Navidrome weekly buckets ({out.stderr[:120]}); "
              "the handoff chart will show no Navidrome data.")
        return monthly
    for blob in json.loads(out.stdout):
        for p in json.loads(blob):
            t = p.get("t")
            if not t:
                continue
            dt = datetime.datetime.fromtimestamp(t, datetime.timezone.utc).astimezone(TZ)
            if (dt.year, dt.month) < live_start:
                continue  # before live scrobbling began
            monthly[dt.year][dt.month - 1] += 1
    return monthly


def parse_dated():
    """month-by-year grid + hour-of-day counts from the dated Spotify plays.

    Prefers the hub's Postgres spotify_play table (de-duplicated, matching how
    the all-time totals are computed); falls back to parsing the export zip so
    this still runs with the database off. Both currently end where my Spotify
    export does -- recent listening lives on my own server, which keeps no dated
    history, so the 2026 tail is real, not missing data."""
    try:
        sys.path.insert(0, HUB)
        from hub import hubdb  # type: ignore
        rows = hubdb.query("SELECT played_ms FROM spotify_play WHERE ms_played >= 30000")
        if rows:
            return _tally(pm for (pm,) in rows)
        print("  WARNING: spotify_play query returned nothing -- is the DB up? "
              "Run with the hub venv python so psycopg is available. Falling back to the zip.")
    except Exception as e:
        print(f"  WARNING: Postgres unavailable ({e}); falling back to the zip. "
              "Run with the hub venv python for the de-duplicated numbers.")
    # fallback: the raw export zip (double-counts a little vs the de-duped table)
    def zip_played_ms():
        z = zipfile.ZipFile(EXPORT)
        for name in z.namelist():
            if "Audio" not in name or not name.endswith(".json"):
                continue
            for r in json.loads(z.read(name)):
                if (r.get("ms_played") or 0) < 30000:
                    continue
                ts = r.get("ts")
                if not ts:
                    continue
                try:
                    dt = datetime.datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ")
                except ValueError:
                    continue
                yield int(dt.replace(tzinfo=datetime.timezone.utc).timestamp() * 1000)
    return _tally(zip_played_ms())


def mood_quadrants(cache: dict):
    """Bin the analyzed tracks into valence x intensity quadrants (held chart)."""
    pts = cache.get("mood_map", [])
    counts = collections.Counter()
    for v, i, *_ in pts:
        valence = "happy" if v >= 0.5 else "sad"
        intensity = "intense" if i >= 0.5 else "calm"
        counts[f"{valence} · {intensity}"] += 1
    total = sum(counts.values()) or 1
    order = ["sad · calm", "happy · intense", "sad · intense", "happy · calm"]
    out = []
    for label in sorted(counts, key=lambda k: -counts[k]):
        out.append({"label": label, "tracks": counts[label],
                    "share": f"{round(100 * counts[label] / total)}%"})
    return out, total


def commas(n) -> str:
    return f"{int(round(n)):,}"


def ts_array(items, fmt):
    return "\n".join("  " + fmt(x) + "," for x in items)


def build_ts(cache, monthly, nav, hourly, stamped, moods, mood_total) -> str:
    u = cache["unified"]
    totals = cache["totals"]
    days = round(u["time"]["total_days"])
    dark = sum(hourly[h] for h in DARK_HOURS)
    dark_pct = round(100 * dark / max(stamped, 1))
    years = sorted(set(monthly) | set(nav))
    top = u["top_artists"][:10]
    hours_labels = [datetime.time(h).strftime("%-I%p").lower() for h in range(24)]
    nav_total = sum(sum(v) for v in nav.values())

    def artist_line(a):
        name = a["artist"].replace("\\", "\\\\").replace("'", "\\'")
        return f"{{ name: '{name}', plays: {a['plays']} }}"

    def month_line(y):
        sp = monthly.get(y, [0] * 12)
        nv = nav.get(y, [0] * 12)
        return (f"{{ year: {y}, spotify: [{', '.join(map(str, sp))}],"
                f" navidrome: [{', '.join(map(str, nv))}] }}")

    def hour_line(h):
        return f"{{ hour: '{hours_labels[h]}', plays: {hourly[h]} }}"

    def mood_line(m):
        return f"{{ label: '{m['label']}', tracks: {m['tracks']}, share: '{m['share']}' }}"

    stamp = datetime.datetime.now(TZ).strftime("%Y-%m-%d")
    return f"""// My listening history, regenerated from the live music server by
// scripts/sync-listening-stats.py on {stamp}. Do not hand-edit: rerun the script.
// Plays/top-artists/days/library come from the hub's merged-play-store stats
// (Navidrome already folds in the imported Spotify + MusicBee history); the dated
// grids come from the Spotify archive (through Aug 2026) and the live Navidrome
// scrobble log (Aug 2026 on) -- the one window where the two are separable.

export const kpis = [
  {{ value: '{commas(u['total_plays'])}', label: 'plays, all-time' }},
  {{ value: '≈{days} days', label: 'of continuous audio' }},
  {{ value: '{commas(totals['tracks'])}', label: 'tracks in the library' }},
  {{ value: '{dark_pct}%', label: 'played after dark' }},
]

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Plays per month, split by source. `spotify` is the dated Spotify archive
 *  (2014 - Aug 2026); `navidrome` is the live self-hosted scrobble log, which
 *  only begins Aug 2026 (the handoff). Charts read the sum for totals and the
 *  split to show the migration. {commas(nav_total)} dated Navidrome plays so far. */
export const monthly: {{ year: number; spotify: number[]; navidrome: number[] }}[] = [
{ts_array(years, month_line)}
]

/** All-time top ten artists. */
export const topArtists: {{ name: string; plays: number }}[] = [
{ts_array(top, artist_line)}
]

/** The {commas(mood_total)} tracks with mood scores, by valence/intensity quadrant.
 *  The Listening page holds this chart until the analyzer finishes the library. */
export const moodQuadrants: {{ label: string; tracks: number; share: string }}[] = [
{ts_array(moods, mood_line)}
]

/** Plays by hour of day (local time), from the {commas(stamped)} stamped plays. */
export const hourly: {{ hour: string; plays: number }}[] = [
{ts_array(range(24), hour_line)}
]
"""


def main() -> int:
    if "--refresh" in sys.argv:
        print("Refreshing the hub stats cache (this takes ~30s)...")
        refresh_cache()
    cache = read_cache()
    monthly, hourly, stamped = parse_dated()
    nav = navidrome_monthly()
    moods, mood_total = mood_quadrants(cache)
    ts = build_ts(cache, monthly, nav, hourly, stamped, moods, mood_total)
    with open(os.path.normpath(OUT), "w") as f:
        f.write(ts)
    u = cache["unified"]
    print(f"Wrote {os.path.normpath(OUT)}")
    print(f"  plays={commas(u['total_plays'])}  library={commas(cache['totals']['tracks'])}"
          f"  analyzed={commas(cache['totals']['analyzed'])}  stamped={commas(stamped)}")
    print(f"  mood coverage {cache['totals']['analyzed']}/{cache['totals']['tracks']}"
          f" ({round(100*cache['totals']['analyzed']/cache['totals']['tracks'])}%) -- chart stays held until ~100%")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

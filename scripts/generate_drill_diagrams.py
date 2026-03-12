#!/usr/bin/env python3
"""
ProspectX — One-Time Drill Diagram Generator
=============================================
Reads drills where diagram_data IS NULL, calls Anthropic Claude to generate
Konva-compatible diagram JSON, writes it back to the drills table.

Two modes:
  Direct DB:  DATABASE_URL=<url> ANTHROPIC_API_KEY=<key> python scripts/generate_drill_diagrams.py
  Via API:    ANTHROPIC_API_KEY=<key> python scripts/generate_drill_diagrams.py --api

Run once. Never runs automatically. Safe to re-run (WHERE diagram_data IS NULL guard).
"""

import os
import sys
import json
import time
import argparse
import urllib.request
import urllib.error

try:
    import anthropic
except ImportError:
    print("ERROR: anthropic package not installed. Run: pip install anthropic")
    sys.exit(1)

# ── Config ──────────────────────────────────────────────────────
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")
MODEL = "claude-sonnet-4-20250514"

API_BASE = "https://prospectx-app-production-b918.up.railway.app"
API_EMAIL = "jason@prospectx.com"
API_PASSWORD = "testpass123"

# ── Category → rinkType mapping ────────────────────────────────
CATEGORY_RINK_MAP: dict[str, str] = {
    "skating": "full",
    "warm_up": "full",
    "skills_testing": "full",
    "conditioning": "full",
    "cool_down": "full",
    "fun": "full",
    "passing": "half",
    "puck_handling": "half",
    "station_setup": "half",
    "shooting": "zone",
    "goalie": "zone",
    "defensive": "zone",
    "offensive": "zone",
    "systems": "zone",
    "transition": "zone",
    "special_teams": "zone",
    "battle": "zone",
    "small_area_games": "zone",  # default; "circle" if name/desc suggests it
}

SYSTEM_PROMPT = """You are a hockey drill diagram generator. Given a drill description, generate a JSON object representing the drill diagram on a hockey rink.

Return ONLY valid JSON, no markdown, no explanation, no code fences.

Rules:
1. rinkType is "full", "half", "zone", or "circle" — use the one specified in the user message.
2. Canvas is 800x400 for full/half/zone, 400x400 for circle.
3. Place net at x=760,y=200 for offensive zone, x=40,y=200 for defensive zone.
4. Skating arrows use dashed=false, pass lines use dashed=true.
5. Use 3-7 elements total — keep diagrams clean.
6. Player colors: forwards=#008080, defence=#1F4E79, goalie=#C55A11.

JSON schema:
{
  "rinkType": "full" | "half" | "zone" | "circle",
  "width": 800,
  "height": 400,
  "elements": [
    {"type": "player", "id": "p1", "x": 120, "y": 200, "label": "F1", "color": "#008080"},
    {"type": "arrow", "id": "a1", "points": [120,200,300,150], "color": "#1F4E79", "dashed": false, "curved": true},
    {"type": "puck", "id": "pk1", "x": 400, "y": 200},
    {"type": "cone", "id": "c1", "x": 300, "y": 150}
  ]
}"""


def pick_rink_type(category: str, name: str, description: str) -> str:
    """Determine rinkType from category, with circle detection for small_area_games."""
    rink = CATEGORY_RINK_MAP.get(category, "zone")
    if category == "small_area_games":
        text = f"{name} {description}".lower()
        if "circle" in text or "faceoff circle" in text:
            rink = "circle"
    return rink


def generate_diagram(client: anthropic.Anthropic, drill: dict) -> dict | None:
    """Call Claude to generate diagram JSON for a single drill."""
    rink_type = pick_rink_type(
        drill["category"] or "",
        drill["name"] or "",
        drill["description"] or "",
    )
    canvas = "400x400" if rink_type == "circle" else "800x400"

    user_msg = (
        f"Drill name: {drill['name']}\n"
        f"Category: {drill['category']}\n"
        f"Description: {drill['description'] or 'No description'}\n"
        f"Players: {drill.get('min_players') or 'Not specified'}\n"
        f"Requires goalie: {drill.get('requires_goalies') or False}\n"
        f"rinkType to use: {rink_type}\n"
        f"Canvas size: {canvas}"
    )

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_msg}],
        )
        raw = response.content[0].text.strip()

        # Strip markdown fences if model wraps anyway
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3].strip()

        data = json.loads(raw)

        # Validate minimum structure
        if "rinkType" not in data or "elements" not in data:
            print("WARN Invalid structure (missing rinkType/elements)")
            return None

        return data

    except json.JSONDecodeError as e:
        print(f"WARN JSON parse error: {e}")
        return None
    except anthropic.APIError as e:
        print(f"WARN API error: {e}")
        return None
    except Exception as e:
        print(f"WARN Unexpected error: {e}")
        return None


# ── API helper functions ────────────────────────────────────────

def api_login() -> str:
    """Login to ProspectX API and return access token."""
    data = json.dumps({"email": API_EMAIL, "password": API_PASSWORD}).encode()
    req = urllib.request.Request(
        f"{API_BASE}/auth/login",
        data=data,
        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
    )
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read())["access_token"]


def api_get_drills(token: str) -> list[dict]:
    """Fetch all drills from the API."""
    req = urllib.request.Request(
        f"{API_BASE}/drills?limit=10000",
        headers={"Authorization": f"Bearer {token}", "User-Agent": "Mozilla/5.0"},
    )
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read())


def api_save_diagram(token: str, drill_id: str, diagram_data: dict) -> tuple[bool, str]:
    """Save diagram_data to a drill via the API. Returns (success, token)."""
    data = json.dumps({"diagram_data": diagram_data}).encode()
    req = urllib.request.Request(
        f"{API_BASE}/drills/{drill_id}/diagram/canvas",
        data=data,
        method="PUT",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0",
        },
    )
    try:
        resp = urllib.request.urlopen(req)
        return (resp.status == 200, token)
    except urllib.error.HTTPError as e:
        if e.code == 401:
            # Token expired — re-login and retry once
            print("(token refresh) ", end="", flush=True)
            try:
                token = api_login()
                data2 = json.dumps({"diagram_data": diagram_data}).encode()
                req2 = urllib.request.Request(
                    f"{API_BASE}/drills/{drill_id}/diagram/canvas",
                    data=data2,
                    method="PUT",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                        "User-Agent": "Mozilla/5.0",
                    },
                )
                resp2 = urllib.request.urlopen(req2)
                return (resp2.status == 200, token)
            except Exception as e2:
                print(f"WARN API save error after refresh: {e2}")
                return (False, token)
        print(f"WARN API save error: {e}")
        return (False, token)
    except Exception as e:
        print(f"WARN API save error: {e}")
        return (False, token)


# ── Direct DB mode ──────────────────────────────────────────────

def run_db_mode():
    """Run using direct PostgreSQL connection."""
    import psycopg2

    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute("""
        SELECT id, name, category, description, min_players, requires_goalies
        FROM drills
        WHERE diagram_data IS NULL
        ORDER BY category, name
    """)
    drills = cur.fetchall()
    columns = ["id", "name", "category", "description", "min_players", "requires_goalies"]
    drill_dicts = [dict(zip(columns, row)) for row in drills]

    total = len(drill_dicts)
    print(f"\nFound {total} drills with NULL diagram_data.\n")

    if total == 0:
        print("Nothing to do. Exiting.")
        cur.close()
        conn.close()
        return

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    success = 0
    failure = 0

    for i, drill in enumerate(drill_dicts, 1):
        name = drill["name"] or "Unnamed"
        cat = drill["category"] or "unknown"
        print(f"[{i}/{total}] {cat} / {name} ... ", end="", flush=True)

        diagram = generate_diagram(client, drill)

        if diagram is not None:
            try:
                cur.execute(
                    "UPDATE drills SET diagram_data = %s, diagram_url = NULL WHERE id = %s",
                    (json.dumps(diagram), drill["id"]),
                )
                print("OK")
                success += 1
            except Exception as e:
                print(f"FAIL DB write error: {e}")
                failure += 1
        else:
            failure += 1

        if i % 50 == 0:
            print(f"  ... pausing 5s (rate limit buffer) ...")
            time.sleep(5)

    cur.close()
    conn.close()

    print("\n" + "=" * 60)
    print(f"DONE — Total: {total} | Success: {success} | Failure: {failure}")
    print("=" * 60)


# ── API mode ────────────────────────────────────────────────────

def run_api_mode():
    """Run using the ProspectX REST API (no DATABASE_URL needed)."""
    print("Mode: API (via ProspectX REST endpoints)\n")

    print("Logging in... ", end="", flush=True)
    token = api_login()
    print("OK")

    print("Fetching drills... ", end="", flush=True)
    all_drills = api_get_drills(token)
    drill_dicts = [d for d in all_drills if d.get("diagram_data") is None]
    print(f"OK ({len(drill_dicts)} with NULL diagram_data out of {len(all_drills)} total)")

    total = len(drill_dicts)
    if total == 0:
        print("Nothing to do. Exiting.")
        return

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    success = 0
    failure = 0

    for i, drill in enumerate(drill_dicts, 1):
        name = drill.get("name") or "Unnamed"
        cat = drill.get("category") or "unknown"
        print(f"[{i}/{total}] {cat} / {name} ... ", end="", flush=True)

        diagram = generate_diagram(client, drill)

        if diagram is not None:
            saved, token = api_save_diagram(token, drill["id"], diagram)
            if saved:
                print("OK")
                success += 1
            else:
                print("FAIL API save failed")
                failure += 1
        else:
            failure += 1

        if i % 50 == 0:
            print(f"  ... pausing 5s (rate limit buffer) ...")
            time.sleep(5)

    print("\n" + "=" * 60)
    print(f"DONE — Total: {total} | Success: {success} | Failure: {failure}")
    print("=" * 60)


# ── Main ────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Generate drill diagram data via Anthropic Claude")
    parser.add_argument("--api", action="store_true", help="Use ProspectX REST API instead of direct DB")
    args = parser.parse_args()

    print("=" * 60)
    print("ProspectX — Drill Diagram Generator (One-Time Migration)")
    print("=" * 60)

    if not ANTHROPIC_API_KEY:
        print("ERROR: ANTHROPIC_API_KEY environment variable is required.")
        sys.exit(1)

    if args.api:
        run_api_mode()
    else:
        if not DATABASE_URL:
            print("ERROR: DATABASE_URL environment variable is required.")
            print("  Hint: Use --api flag to run via the ProspectX REST API instead.")
            sys.exit(1)
        print("Mode: Direct PostgreSQL\n")
        run_db_mode()


if __name__ == "__main__":
    main()

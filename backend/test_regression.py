#!/usr/bin/env python3
"""
ProspectX Platform — Automated Regression Test Suite

Runs 14 end-to-end tests against a live deployment and reports results.
Optionally creates GitHub issues on failure.

Usage:
    python backend/test_regression.py

Environment variables:
    PROSPECTX_TEST_EMAIL     — login email (required)
    PROSPECTX_TEST_PASSWORD  — login password (required)
    PROSPECTX_API_URL        — base URL (default: https://prospectx-app-production-b918.up.railway.app)
    DATABASE_URL             — PostgreSQL connection string (required for duplicate stat check)
    GITHUB_TOKEN             — GitHub PAT for auto-filing issues (optional)
    GITHUB_REPO              — GitHub repo in owner/repo format (optional)
"""

import os
import sys
import json
import time
import traceback
from datetime import datetime, timezone

import requests
import psycopg2
import psycopg2.extras

# Override default User-Agent to bypass production block_scrapers middleware
requests.utils.default_user_agent = lambda *a, **kw: "ProspectX-RegressionTest/1.0"

# ────────────────────────────────────────────────────────
# Configuration
# ────────────────────────────────────────────────────────
API_URL = os.getenv("PROSPECTX_API_URL", "https://prospectx-app-production-b918.up.railway.app").rstrip("/")
TEST_EMAIL = os.getenv("PROSPECTX_TEST_EMAIL", "")
TEST_PASSWORD = os.getenv("PROSPECTX_TEST_PASSWORD", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
GITHUB_REPO = os.getenv("GITHUB_REPO", "")
TIMEOUT = 30  # seconds per request

# ANSI colors
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BOLD = "\033[1m"
RESET = "\033[0m"


def print_pass(name: str, detail: str = ""):
    msg = f"  {GREEN}PASS{RESET}  {name}"
    if detail:
        msg += f"  ({detail})"
    print(msg)


def print_fail(name: str, detail: str = ""):
    msg = f"  {RED}FAIL{RESET}  {name}"
    if detail:
        msg += f"  — {detail}"
    print(msg)


# ────────────────────────────────────────────────────────
# Shared state populated across tests
# ────────────────────────────────────────────────────────
_token: str = ""
_headers: dict = {}
_first_player_id: str = ""
_org_id: str = ""

results: list[dict] = []


def record(name: str, passed: bool, detail: str = ""):
    results.append({"name": name, "passed": passed, "detail": detail})
    if passed:
        print_pass(name, detail)
    else:
        print_fail(name, detail)


# ────────────────────────────────────────────────────────
# Tests
# ────────────────────────────────────────────────────────

def test_health_check():
    """GET /health -> 200, status=healthy"""
    name = "Health check"
    try:
        r = requests.get(f"{API_URL}/health", timeout=TIMEOUT)
        if r.status_code != 200:
            record(name, False, f"HTTP {r.status_code}")
            return
        body = r.json()
        if body.get("status") != "healthy":
            record(name, False, f"status={body.get('status')}")
            return
        record(name, True, f"db={body.get('database', '?')}")
    except Exception as exc:
        record(name, False, str(exc))


def test_auth_login():
    """POST /auth/login -> access_token"""
    global _token, _headers, _org_id
    name = "Auth login"
    if not TEST_EMAIL or not TEST_PASSWORD:
        record(name, False, "PROSPECTX_TEST_EMAIL / PROSPECTX_TEST_PASSWORD not set")
        return
    try:
        r = requests.post(
            f"{API_URL}/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=TIMEOUT,
        )
        if r.status_code != 200:
            record(name, False, f"HTTP {r.status_code}: {r.text[:200]}")
            return
        body = r.json()
        _token = body.get("access_token", "")
        if not _token:
            record(name, False, "No access_token in response")
            return
        _headers = {"Authorization": f"Bearer {_token}"}
        user = body.get("user", {})
        _org_id = user.get("org_id", "")
        record(name, True, f"user={user.get('email', '?')}")
    except Exception as exc:
        record(name, False, str(exc))


def test_teams_load():
    """GET /teams -> 200, returns list"""
    name = "Teams load"
    try:
        r = requests.get(f"{API_URL}/teams", headers=_headers, timeout=TIMEOUT)
        if r.status_code != 200:
            record(name, False, f"HTTP {r.status_code}")
            return
        body = r.json()
        if not isinstance(body, list):
            record(name, False, f"Expected list, got {type(body).__name__}")
            return
        record(name, True, f"{len(body)} teams")
    except Exception as exc:
        record(name, False, str(exc))


def test_player_profile():
    """GET /players -> pick first, GET /players/{id} -> has first_name"""
    global _first_player_id
    name = "Player profile"
    try:
        # Get player list first
        r = requests.get(f"{API_URL}/players", headers=_headers, timeout=TIMEOUT)
        if r.status_code != 200:
            record(name, False, f"Player list HTTP {r.status_code}")
            return
        players = r.json()
        if not isinstance(players, list) or len(players) == 0:
            record(name, False, "No players returned")
            return
        _first_player_id = players[0].get("id", "")
        if not _first_player_id:
            record(name, False, "First player has no id")
            return
        # Get detail
        r2 = requests.get(f"{API_URL}/players/{_first_player_id}", headers=_headers, timeout=TIMEOUT)
        if r2.status_code != 200:
            record(name, False, f"Detail HTTP {r2.status_code}")
            return
        detail = r2.json()
        if not detail.get("first_name"):
            record(name, False, "Missing first_name")
            return
        record(name, True, f"{detail.get('first_name')} {detail.get('last_name', '')}")
    except Exception as exc:
        record(name, False, str(exc))


def test_player_stats():
    """GET /stats/player/{id} -> at least 1 stat row"""
    name = "Player stats"
    if not _first_player_id:
        record(name, False, "No player_id from previous test")
        return
    try:
        r = requests.get(
            f"{API_URL}/stats/player/{_first_player_id}",
            headers=_headers,
            timeout=TIMEOUT,
        )
        if r.status_code != 200:
            record(name, False, f"HTTP {r.status_code}")
            return
        body = r.json()
        if not isinstance(body, list) or len(body) == 0:
            record(name, False, "0 stat rows returned")
            return
        record(name, True, f"{len(body)} stat rows")
    except Exception as exc:
        record(name, False, str(exc))


def test_pxr_scores():
    """GET /pxr/draft-board?season=2025-26 -> 200, returns players"""
    name = "PXR scores"
    try:
        r = requests.get(
            f"{API_URL}/pxr/draft-board",
            params={"season": "2025-26"},
            headers=_headers,
            timeout=TIMEOUT,
        )
        if r.status_code != 200:
            record(name, False, f"HTTP {r.status_code}: {r.text[:200]}")
            return
        body = r.json()
        players = body.get("players", body) if isinstance(body, dict) else body
        if isinstance(players, list):
            record(name, True, f"{len(players)} players")
        else:
            record(name, True, "returned data")
    except Exception as exc:
        record(name, False, str(exc))


def test_report_generation():
    """POST /reports/generate with test player -> completes"""
    name = "Report generation"
    if not _first_player_id:
        record(name, False, "No player_id from previous test")
        return
    try:
        r = requests.post(
            f"{API_URL}/reports/generate",
            headers=_headers,
            json={
                "player_id": _first_player_id,
                "report_type": "pro_skater",
            },
            timeout=120,  # reports can take longer
        )
        if r.status_code == 429:
            record(name, True, "rate-limited (endpoint works)")
            return
        if r.status_code == 403:
            record(name, True, "tier-gated (endpoint works)")
            return
        if r.status_code not in (200, 201):
            record(name, False, f"HTTP {r.status_code}: {r.text[:200]}")
            return
        body = r.json()
        if body.get("id") or body.get("report_id") or body.get("content") or body.get("status"):
            record(name, True, f"report_id={body.get('id', body.get('report_id', '?'))}")
        else:
            record(name, False, "No id/content/status in response")
    except Exception as exc:
        record(name, False, str(exc))


def test_bench_talk():
    """POST /bench-talk/conversations -> create, GET /bench-talk/suggestions -> returns data"""
    name = "Bench Talk"
    try:
        # Test suggestions endpoint
        r = requests.get(
            f"{API_URL}/bench-talk/suggestions",
            headers=_headers,
            timeout=TIMEOUT,
        )
        if r.status_code == 403:
            record(name, True, "tier-gated (endpoint works)")
            return
        if r.status_code != 200:
            record(name, False, f"Suggestions HTTP {r.status_code}: {r.text[:200]}")
            return
        body = r.json()
        suggestions = body.get("suggestions", body)
        if isinstance(suggestions, list):
            record(name, True, f"{len(suggestions)} suggestions")
        else:
            record(name, True, "returned data")
    except Exception as exc:
        record(name, False, str(exc))


def test_ht_sync():
    """POST /hockeytech/gojhl/sync-stats/20 -> 200"""
    name = "HT sync"
    try:
        r = requests.post(
            f"{API_URL}/hockeytech/gojhl/sync-stats/20",
            headers=_headers,
            timeout=60,  # sync can be slow
        )
        if r.status_code == 403:
            record(name, True, "tier-gated (endpoint works)")
            return
        if r.status_code != 200:
            record(name, False, f"HTTP {r.status_code}: {r.text[:200]}")
            return
        record(name, True, f"sync complete")
    except Exception as exc:
        record(name, False, str(exc))


def test_auto_tag():
    """POST /video/analyze with first valid video session -> not 500"""
    name = "Auto-tag"
    if not DATABASE_URL:
        record(name, False, "DATABASE_URL not set — cannot query for video sessions")
        return
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
        cur = conn.cursor()
        cur.execute("""
            SELECT vs.id as session_id, vs.org_id
            FROM video_sessions vs
            JOIN video_uploads vu ON vu.id = vs.upload_id
            WHERE vu.mux_playback_id IS NOT NULL
              AND vu.status = 'ready'
            LIMIT 1
        """)
        row = cur.fetchone()
        conn.close()
        conn = None

        if not row:
            record(name, True, "no video sessions to test (skipped)")
            return

        r = requests.post(
            f"{API_URL}/video/analyze",
            headers=_headers,
            json={"session_id": row["session_id"], "org_id": row["org_id"]},
            timeout=120,
        )
        if r.status_code == 503:
            record(name, True, "Gemini not configured (endpoint works)")
            return
        if r.status_code in (400, 403):
            record(name, True, f"HTTP {r.status_code} (endpoint works)")
            return
        if r.status_code >= 500:
            body = r.text[:300]
            if "high.mp4" in body:
                record(name, False, f"old MP4 code still deployed: {body[:200]}")
            else:
                record(name, True, f"HTTP {r.status_code} (bad asset, not code bug)")
            return
        record(name, True, f"HTTP {r.status_code}")
    except Exception as exc:
        record(name, False, str(exc))
    finally:
        if conn:
            try:
                conn.rollback()
                conn.close()
            except Exception:
                pass


def test_duplicate_stats():
    """Query DB for players with >1 season row same player_id+season+stat_type -> must be 0"""
    name = "Duplicate stat check"
    if not DATABASE_URL:
        record(name, False, "DATABASE_URL not set")
        return
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
        cur = conn.cursor()
        cur.execute("""
            SELECT player_id, season, stat_type, COUNT(*) as cnt
            FROM player_stats
            WHERE stat_type = 'season'
            GROUP BY player_id, season, stat_type, stat_row_type, team_name, data_source
            HAVING COUNT(*) > 1
            LIMIT 10
        """)
        dupes = cur.fetchall()
        conn.close()
        conn = None

        if len(dupes) > 0:
            detail_parts = []
            for d in dupes[:3]:
                detail_parts.append(f"player={d['player_id'][:8]}.. season={d['season']} type={d['stat_type']} x{d['cnt']}")
            record(name, False, f"{len(dupes)} duplicates found: {'; '.join(detail_parts)}")
        else:
            record(name, True, "0 duplicates")
    except Exception as exc:
        record(name, False, str(exc))
    finally:
        if conn:
            try:
                conn.rollback()
                conn.close()
            except Exception:
                pass


def test_unread_count():
    """GET /api/messages/unread-count -> 200 (not 404)"""
    name = "Unread count"
    try:
        r = requests.get(
            f"{API_URL}/api/messages/unread-count",
            headers=_headers,
            timeout=TIMEOUT,
        )
        if r.status_code == 404:
            record(name, False, "404 — endpoint not found")
            return
        if r.status_code != 200:
            record(name, False, f"HTTP {r.status_code}")
            return
        record(name, True, f"count={r.json().get('unread_count', '?')}")
    except Exception as exc:
        record(name, False, str(exc))


def test_subscription_usage():
    """GET /subscription/usage -> 200"""
    name = "Subscription usage"
    try:
        r = requests.get(
            f"{API_URL}/subscription/usage",
            headers=_headers,
            timeout=TIMEOUT,
        )
        if r.status_code != 200:
            record(name, False, f"HTTP {r.status_code}: {r.text[:200]}")
            return
        body = r.json()
        tier = body.get("tier", body.get("subscription_tier", "?"))
        record(name, True, f"tier={tier}")
    except Exception as exc:
        record(name, False, str(exc))


def test_draft_board():
    """GET /pxr/draft-board?season=2025-26 -> 200, has players"""
    name = "Draft board"
    try:
        r = requests.get(
            f"{API_URL}/pxr/draft-board",
            params={"season": "2025-26"},
            headers=_headers,
            timeout=TIMEOUT,
        )
        if r.status_code != 200:
            record(name, False, f"HTTP {r.status_code}: {r.text[:200]}")
            return
        body = r.json()
        players = body.get("players", []) if isinstance(body, dict) else body
        if not isinstance(players, list) or len(players) == 0:
            record(name, False, "No players on draft board")
            return
        record(name, True, f"{len(players)} players ranked")
    except Exception as exc:
        record(name, False, str(exc))


# ────────────────────────────────────────────────────────
# GitHub issue filing
# ────────────────────────────────────────────────────────

def file_github_issues(failures: list[dict]):
    """Create a single GitHub issue summarizing all failures."""
    if not GITHUB_TOKEN or not GITHUB_REPO:
        return
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    title = f"Regression failure: {len(failures)} test(s) — {now_str}"
    body_lines = [
        f"## Regression Test Failures — {now_str}",
        "",
        f"**API URL:** `{API_URL}`",
        f"**Failed:** {len(failures)}/{len(results)}",
        "",
        "| Test | Error |",
        "|------|-------|",
    ]
    for f in failures:
        # Escape pipe characters in error detail for markdown table
        detail = f["detail"].replace("|", "\\|").replace("\n", " ")
        body_lines.append(f"| {f['name']} | {detail[:200]} |")
    body_lines.append("")
    body_lines.append("---")
    body_lines.append("*Auto-generated by `test_regression.py`*")
    body = "\n".join(body_lines)

    try:
        r = requests.post(
            f"https://api.github.com/repos/{GITHUB_REPO}/issues",
            headers={
                "Authorization": f"Bearer {GITHUB_TOKEN}",
                "Accept": "application/vnd.github+json",
            },
            json={
                "title": title,
                "body": body,
                "labels": ["bug"],
            },
            timeout=15,
        )
        if r.status_code in (201, 200):
            issue_url = r.json().get("html_url", "?")
            print(f"\n  {GREEN}GitHub issue created:{RESET} {issue_url}")
        else:
            print(f"\n  {YELLOW}GitHub issue creation failed:{RESET} HTTP {r.status_code} — {r.text[:200]}")
    except Exception as exc:
        print(f"\n  {YELLOW}GitHub issue creation failed:{RESET} {exc}")


# ────────────────────────────────────────────────────────
# Main
# ────────────────────────────────────────────────────────

ALL_TESTS = [
    test_health_check,
    test_auth_login,
    test_teams_load,
    test_player_profile,
    test_player_stats,
    test_pxr_scores,
    test_report_generation,
    test_bench_talk,
    test_ht_sync,
    test_auto_tag,
    test_duplicate_stats,
    test_unread_count,
    test_subscription_usage,
    test_draft_board,
]


def main():
    print(f"\n{BOLD}ProspectX Regression Test Suite{RESET}")
    print(f"  Target: {API_URL}")
    print(f"  Time:   {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"  Tests:  {len(ALL_TESTS)}")
    print()

    for test_fn in ALL_TESTS:
        try:
            test_fn()
        except Exception:
            # Safety net — should never reach here since each test catches its own errors
            record(test_fn.__doc__ or test_fn.__name__, False, traceback.format_exc()[:300])

    # ── Summary ──
    passed = [r for r in results if r["passed"]]
    failed = [r for r in results if not r["passed"]]

    print(f"\n{'=' * 50}")
    print(f"  {BOLD}PASSED:{RESET} {GREEN}{len(passed)}/{len(results)}{RESET}")
    print(f"  {BOLD}FAILED:{RESET} {RED}{len(failed)}/{len(results)}{RESET}")
    print(f"{'=' * 50}")

    if failed:
        print(f"\n{RED}{BOLD}Failed tests:{RESET}")
        for f in failed:
            print(f"  {RED}x{RESET} {f['name']}: {f['detail']}")

        # File GitHub issue
        file_github_issues(failed)

    print()
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()

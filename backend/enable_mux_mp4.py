"""
One-time script to enable mp4_support="standard" on all existing Mux assets.

Usage:
    MUX_TOKEN_ID=xxx MUX_TOKEN_SECRET=yyy python enable_mux_mp4.py

This enables static MP4 renditions so Gemini auto-tag can download
videos via /low.mp4 for Files API upload.
"""

import os
import sys
import requests

MUX_TOKEN_ID = os.environ.get("MUX_TOKEN_ID", "")
MUX_TOKEN_SECRET = os.environ.get("MUX_TOKEN_SECRET", "")

if not MUX_TOKEN_ID or not MUX_TOKEN_SECRET:
    print("ERROR: MUX_TOKEN_ID and MUX_TOKEN_SECRET environment variables are required")
    sys.exit(1)

AUTH = (MUX_TOKEN_ID, MUX_TOKEN_SECRET)
BASE = "https://api.mux.com/video/v1"


def list_assets():
    """Fetch all Mux assets (paginated)."""
    assets = []
    page = 1
    while True:
        resp = requests.get(f"{BASE}/assets", auth=AUTH, params={"page": page, "limit": 100})
        resp.raise_for_status()
        data = resp.json().get("data", [])
        if not data:
            break
        assets.extend(data)
        page += 1
    return assets


def enable_mp4(asset_id):
    """Enable mp4_support=standard on a single asset."""
    resp = requests.put(
        f"{BASE}/assets/{asset_id}/mp4-support",
        auth=AUTH,
        json={"mp4_support": "standard"},
    )
    resp.raise_for_status()
    return resp.json()


def main():
    print("Fetching all Mux assets...")
    assets = list_assets()
    print(f"Found {len(assets)} asset(s)\n")

    updated = 0
    skipped = 0
    failed = 0

    for asset in assets:
        asset_id = asset["id"]
        status = asset.get("status", "unknown")
        mp4 = asset.get("mp4_support", "none")

        if mp4 == "standard":
            print(f"  SKIP  {asset_id} — mp4_support already standard")
            skipped += 1
            continue

        if status == "errored":
            print(f"  SKIP  {asset_id} — asset status is errored")
            skipped += 1
            continue

        try:
            enable_mp4(asset_id)
            print(f"  OK    {asset_id} — mp4_support enabled")
            updated += 1
        except requests.HTTPError as e:
            print(f"  FAIL  {asset_id} — {e}")
            failed += 1

    print(f"\nDone: {updated} updated, {skipped} skipped, {failed} failed")


if __name__ == "__main__":
    main()

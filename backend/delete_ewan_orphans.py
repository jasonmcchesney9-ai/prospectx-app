"""
Migration: Delete 3 orphan Ewan McChesney duplicate player records.

These 3 records were created by a Feb 21 batch import and have zero
attached data across all tables. The original record (08f2a360...)
with 49 stats, 23 reports, etc. is preserved.

Usage:
    cd backend
    python delete_ewan_orphans.py
"""

import os
import sys
import sqlite3

# ── Database connection (mirrors main.py get_db pattern) ────────────────
_DATA_DIR = os.path.join(os.path.expanduser("~"), ".prospectx")
DATABASE_URL = os.getenv("DATABASE_URL")
USE_PG = DATABASE_URL is not None
DB_FILE = os.path.join(_DATA_DIR, "prospectx.db")


def get_db():
    if USE_PG:
        # PgConnectionWrapper lives in main.py — import only if needed
        sys.path.insert(0, os.path.dirname(__file__))
        from main import PgConnectionWrapper
        return PgConnectionWrapper(DATABASE_URL)
    else:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        return conn


# ── Orphan IDs to delete (NEVER touch the original) ────────────────────
ORIGINAL_ID = "08f2a360-7424-4ec8-819b-09f5ef01defb"
ORPHAN_IDS = [
    "15f19178-f812-4266-819e-dd646c785e49",  # NULL team, bad league field
    "5209e0e7-7b04-4acf-9069-72b675403fa3",  # NULL team, NULL league
    "ac372260-45cd-4946-b902-a2d4fe08ff16",  # duplicate of original
]

# Tables to check for attached data before deleting
ATTACHMENT_TABLES = [
    ("player_stats", "player_id"),
    ("goalie_stats", "player_id"),
    ("reports", "player_id"),
    ("scout_notes", "player_id"),
    ("pxr_scores", "player_id"),
]


def main():
    conn = get_db()
    try:
        # ── Step 1: Verify all 4 Ewan McChesney records exist ───────────
        print("=" * 60)
        print("STEP 1: Verifying Ewan McChesney records exist")
        print("=" * 60)

        rows = conn.execute(
            "SELECT id, first_name, last_name, current_team, current_league, created_at "
            "FROM players WHERE first_name = ? AND last_name = ? ORDER BY created_at ASC",
            ("Ewan", "McChesney"),
        ).fetchall()

        print(f"Found {len(rows)} records:")
        for r in rows:
            marker = " <-- ORIGINAL (KEEP)" if r["id"] == ORIGINAL_ID else " <-- ORPHAN (DELETE)"
            print(f"  {r['id']}  | {r['current_team']} | {r['current_league']} | {r['created_at']}{marker}")

        if len(rows) != 4:
            print(f"\nABORT: Expected 4 records, found {len(rows)}. State has changed.")
            conn.close()
            return

        # Verify the original exists
        original_found = any(r["id"] == ORIGINAL_ID for r in rows)
        if not original_found:
            print(f"\nABORT: Original record {ORIGINAL_ID} not found!")
            conn.close()
            return

        # Verify all 3 orphans exist
        found_ids = {r["id"] for r in rows}
        for oid in ORPHAN_IDS:
            if oid not in found_ids:
                print(f"\nABORT: Orphan {oid} not found in database!")
                conn.close()
                return

        print("\n[OK] All 4 records confirmed.\n")

        # ── Step 2: Verify orphans have zero attached data ──────────────
        print("=" * 60)
        print("STEP 2: Verifying orphans have zero attached data")
        print("=" * 60)

        for oid in ORPHAN_IDS:
            print(f"\n  Checking {oid}:")
            for table, col in ATTACHMENT_TABLES:
                count = conn.execute(
                    f"SELECT COUNT(*) as cnt FROM {table} WHERE {col} = ?",
                    (oid,),
                ).fetchone()["cnt"]
                status = "[OK] 0" if count == 0 else f"[FAIL] {count} ROWS FOUND"
                print(f"    {table}: {status}")

                if count > 0:
                    print(f"\nABORT: Orphan {oid} has {count} rows in {table}!")
                    print("Rolling back. No records deleted.")
                    conn.rollback()
                    conn.close()
                    return

        print("\n[OK] All 3 orphans have zero attached data. Safe to delete.\n")

        # ── Step 3: Delete the 3 orphan records ─────────────────────────
        print("=" * 60)
        print("STEP 3: Deleting 3 orphan records")
        print("=" * 60)

        for oid in ORPHAN_IDS:
            conn.execute("DELETE FROM players WHERE id = ?", (oid,))
            print(f"  Deleted: {oid}")

        conn.commit()
        print("\n[OK] Commit successful.\n")

        # ── Step 4: Confirm exactly 1 record remains ────────────────────
        print("=" * 60)
        print("STEP 4: Post-deletion verification")
        print("=" * 60)

        remaining = conn.execute(
            "SELECT id, first_name, last_name, current_team, current_league, created_at "
            "FROM players WHERE first_name = ? AND last_name = ? ORDER BY created_at ASC",
            ("Ewan", "McChesney"),
        ).fetchall()

        print(f"Remaining records: {len(remaining)}")
        for r in remaining:
            print(f"  {r['id']}  | {r['current_team']} | {r['current_league']} | {r['created_at']}")

        if len(remaining) == 1 and remaining[0]["id"] == ORIGINAL_ID:
            print("\n[OK] SUCCESS: Exactly 1 Ewan McChesney record remains (the original).")
        else:
            print("\nWARNING: Unexpected state after deletion. Check manually.")

    except Exception as e:
        print(f"\nERROR: {e}")
        print("Rolling back all changes.")
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()

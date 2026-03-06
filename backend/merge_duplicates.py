"""
ProspectX - Merge Duplicate Player Records
==========================================
Standalone migration script. Connects via DATABASE_URL (PostgreSQL on Railway).
Run with --dry-run first, then --live to execute.

Usage:
  python merge_duplicates.py --dry-run   # Preview only
  python merge_duplicates.py --live      # Execute merges
"""

import os
import sys

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL environment variable not set.")
    sys.exit(1)

# Detect mode
if len(sys.argv) < 2 or sys.argv[1] not in ("--dry-run", "--live"):
    print("Usage: python merge_duplicates.py --dry-run | --live")
    sys.exit(1)

DRY_RUN = sys.argv[1] == "--dry-run"

import psycopg2
import psycopg2.extras

# Tables with a player_id FK to reassign
REASSIGN_TABLES = [
    "player_stats",
    "reports",
    "player_intelligence",
    "development_plans",
    "player_drill_logs",
    "pxr_scores",
    "scouting_list",
    "player_parents",
    "drill_logs",
    "scout_notes",
    "player_corrections",
    "player_merges",
    "player_game_stats",
    "goalie_stats",
    "player_archetypes",
    "player_achievements",
    "player_events",
    "player_stat_snapshots",
    "player_team_history",
    "player_transfers",
    "family_cards",
    "chat_messages",
    "instat_player_stats",
    "instat_player_game_log",
]

conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = False
cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

print("=" * 70)
print("ProspectX Duplicate Merge - %s" % ("DRY RUN" if DRY_RUN else "LIVE EXECUTION"))
print("=" * 70)
print()

# -- Step 1: Verify which reassign tables actually exist ----------------
cur.execute("""
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
""")
existing_tables = {row["table_name"] for row in cur.fetchall()}

valid_tables = []
skipped_tables = []
for t in REASSIGN_TABLES:
    if t in existing_tables:
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s AND column_name = 'player_id'
        """, (t,))
        if cur.fetchone():
            valid_tables.append(t)
        else:
            skipped_tables.append("%s (no player_id column)" % t)
    else:
        skipped_tables.append("%s (table not found)" % t)

print("Tables to reassign (%d): %s" % (len(valid_tables), ", ".join(valid_tables)))
if skipped_tables:
    print("Skipped (%d): %s" % (len(skipped_tables), ", ".join(skipped_tables)))
print()

# -- Step 2: Bulk-load all active players + stat counts in 2 queries ---
print("Loading all active players...")
cur.execute("""
    SELECT p.id, p.first_name, p.last_name, p.hockeytech_id,
           p.current_team, p.current_league, p.created_at,
           COALESCE(s.stat_count, 0) as stat_count
    FROM players p
    LEFT JOIN (
        SELECT player_id, COUNT(*) as stat_count
        FROM player_stats
        GROUP BY player_id
    ) s ON s.player_id = p.id
    WHERE (p.is_deleted = 0 OR p.is_deleted IS NULL)
      AND (p.is_merged = 0 OR p.is_merged IS NULL)
    ORDER BY p.first_name, p.last_name,
             (CASE WHEN p.hockeytech_id IS NOT NULL THEN 0 ELSE 1 END),
             COALESCE(s.stat_count, 0) DESC,
             p.created_at ASC
""")
all_players = cur.fetchall()
print("  Loaded %d active players." % len(all_players))

# Group by name
from collections import defaultdict
name_groups = defaultdict(list)
for p in all_players:
    key = (p["first_name"], p["last_name"])
    name_groups[key].append(p)

dup_groups = {k: v for k, v in name_groups.items() if len(v) > 1}
print("  Duplicate groups: %d" % len(dup_groups))
print()

# -- Step 3: For dry run, bulk-count rows per dupe in each table -------
# Build the merge plan: list of (primary_id, dupe_id, full_name, ht_tag)
merge_plan = []

for (fname, lname), records in sorted(dup_groups.items(), key=lambda x: -len(x[1])):
    full_name = "%s %s" % (fname, lname)

    # Sort: hockeytech_id first, then most stats, then oldest created_at
    def sort_key(rec):
        has_ht = 0 if rec["hockeytech_id"] else 1
        return (has_ht, -rec["stat_count"], str(rec["created_at"] or "9999"))

    sorted_recs = sorted(records, key=sort_key)
    primary = sorted_recs[0]
    primary_id = primary["id"]
    ht_tag = " [HT:%s]" % primary["hockeytech_id"] if primary["hockeytech_id"] else ""

    for dupe in sorted_recs[1:]:
        merge_plan.append((primary_id, dupe["id"], full_name, ht_tag))

print("Total merges to perform: %d" % len(merge_plan))
print()

# Collect all dupe IDs for bulk counting
all_dupe_ids = [m[1] for m in merge_plan]

# -- Step 4: Bulk count rows in each table for all dupes at once -------
table_counts = {}  # table -> {dupe_id: count}
for table in valid_tables:
    cur.execute(
        "SELECT player_id, COUNT(*) as cnt FROM %s WHERE player_id = ANY(%%s) GROUP BY player_id" % table,
        (all_dupe_ids,)
    )
    table_counts[table] = {row["player_id"]: row["cnt"] for row in cur.fetchall()}

print("Row counts loaded for all %d tables." % len(valid_tables))
print()

# -- Step 5: Process merges -------------------------------------------
total_groups_processed = len(dup_groups)
total_soft_deleted = 0
total_reassigned = 0

for primary_id, dupe_id, full_name, ht_tag in merge_plan:
    group_reassigned = 0
    reassign_details = []

    for table in valid_tables:
        count = table_counts.get(table, {}).get(dupe_id, 0)
        if count > 0:
            group_reassigned += count
            reassign_details.append("  %sREASSIGN: %s - %d rows" % ("WOULD " if DRY_RUN else "", table, count))

            if not DRY_RUN:
                # Use savepoint so unique constraint violations don't abort the txn
                cur.execute("SAVEPOINT sp_reassign")
                try:
                    cur.execute(
                        "UPDATE %s SET player_id = %%s WHERE player_id = %%s" % table,
                        (primary_id, dupe_id)
                    )
                    cur.execute("RELEASE SAVEPOINT sp_reassign")
                except (psycopg2.errors.UniqueViolation, psycopg2.errors.ForeignKeyViolation) as e:
                    # UniqueViolation: Primary already has this data
                    # ForeignKeyViolation: FK points to another table (e.g. instat_players) that doesn't have the primary
                    # In both cases, delete the dupe's rows instead
                    cur.execute("ROLLBACK TO SAVEPOINT sp_reassign")
                    cur.execute(
                        "DELETE FROM %s WHERE player_id = %%s" % table,
                        (dupe_id,)
                    )
                    err_type = "UNIQUE" if "UniqueViolation" in type(e).__name__ else "FK"
                    reassign_details.append("  CONFLICT-DELETE(%s): %s - %d rows" % (err_type, table, count))

    # Soft-delete the duplicate
    if not DRY_RUN:
        cur.execute("""
            UPDATE players SET is_deleted = 1, is_merged = 1, merged_into = %s,
                merged_at = CURRENT_TIMESTAMP,
                deleted_at = CURRENT_TIMESTAMP,
                deleted_reason = 'Automated duplicate merge'
            WHERE id = %s
        """, (primary_id, dupe_id))

    for detail in reassign_details:
        print(detail)

    print("%s: %s (%s..) -> PRIMARY: %s..%s | rows reassigned: %d" % (
        "WOULD MERGE" if DRY_RUN else "MERGED",
        full_name, dupe_id[:8], primary_id[:8], ht_tag, group_reassigned
    ))

    total_soft_deleted += 1
    total_reassigned += group_reassigned

if not DRY_RUN:
    conn.commit()

print()
print("=" * 70)
print("DRY RUN SUMMARY" if DRY_RUN else "EXECUTION SUMMARY")
print("=" * 70)
print("  Duplicate groups processed: %d" % total_groups_processed)
print("  Duplicate records %ssoft-deleted: %d" % ("would be " if DRY_RUN else "", total_soft_deleted))
print("  Related rows %sreassigned: %d" % ("would be " if DRY_RUN else "", total_reassigned))
print()

if DRY_RUN:
    print("This was a DRY RUN. No changes were made.")
    print("Run with --live to execute.")

cur.close()
conn.close()

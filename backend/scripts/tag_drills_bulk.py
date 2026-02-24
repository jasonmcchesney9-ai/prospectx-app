#!/usr/bin/env python3
# ============================================================
# DRILL LIBRARY BULK TAGGING SCRIPT
# File: backend/scripts/tag_drills_bulk.py
# Run: python scripts/tag_drills_bulk.py
# 
# Step 1: Reads all drills from DB
# Step 2: Sends batches to Claude API for tagging
# Step 3: Writes proposed tags to drill_tags_proposed.json
# Step 4: Human reviews, then run tag_drills_apply.py to commit
# ============================================================

import json
import os
import sys
import time
import anthropic
from datetime import datetime

# ── CONFIG ───────────────────────────────────────────────────
BATCH_SIZE = 20          # Drills per API call
OUTPUT_FILE = "drill_tags_proposed.json"
LOW_CONFIDENCE_FILE = "drill_tags_review_needed.json"
MODEL = "claude-sonnet-4-6"

VALID_LTPD_STAGES = ["U9", "U11", "U13", "U15", "U18", "U20_Junior"]
VALID_SKILL_DOMAINS = [
    "skating", "puck_skills", "passing", "shooting",
    "decision_making", "compete", "goalie", "systems", "transition"
]
VALID_INTENSITY = ["low", "medium", "high"]
VALID_GAME_ISSUE_TAGS = [
    "d_zone_coverage", "oz_entries", "oz_possession", "breakouts",
    "net_front_battles", "forecheck", "backcheck", "nz_play",
    "rush_defense", "pp_execution", "pk_execution", "corner_battles",
    "faceoffs", "transition_defense", "transition_offense",
    "goalie_positioning", "goalie_rebound_control",
]

TAGGING_SYSTEM_PROMPT = """
You are tagging hockey drills for the ProspectX drill library.
For each drill, propose LTPD/ADM metadata so the system can
safely filter drills by age and stage.

LTPD stages available:
- U9 (ages 7-8, FUNdamentals): basic skills, fun, small-area
- U11 (ages 9-10, Learn to Train Early): individual skills, skating
- U13 (ages 11-12, Learn to Train Late): position skills, basic tactics
- U15 (ages 13-14, Train to Train): full systems, compete, PP/PK
- U18 (ages 15-17, Train to Compete): advanced systems, video-linked
- U20_Junior (ages 17-20, Train to Win): pro-style, team identity

Skill domains (pick all that apply):
skating, puck_skills, passing, shooting, decision_making, 
compete, goalie, systems, transition

Intensity:
- low: station, fundamentals, intro, teaching, walk-through
- medium: transition, game-situation, timed, competitive
- high: battle, conditioning, high-tempo, full-ice sprint, pressure

Game issue tags (pick relevant ones or leave empty):
d_zone_coverage, oz_entries, oz_possession, breakouts,
net_front_battles, forecheck, backcheck, nz_play,
rush_defense, pp_execution, pk_execution, corner_battles,
faceoffs, transition_defense, transition_offense,
goalie_positioning, goalie_rebound_control

CRITICAL RULES:
1. CONSERVATIVE BIAS: When unsure between younger/older stage,
   always pick the OLDER stage. Safer to restrict than over-expose.
2. U9/U11: Never assign systems domain or high intensity unless
   description clearly indicates it (very rare).
3. Goalie domain: add if description mentions crease, rebound, 
   save, blocker, glove, screens, tracking.
4. Systems domain: add if description mentions forecheck system,
   breakout system, PP setup, PK formation, zone structure.
   If systems domain added, minimum stage is U13.
5. Confidence:
   - "high": drill name+description clearly fits one age band
   - "medium": could fit 2+ stages, some ambiguity
   - "low": vague description, unclear age fit, missing context

Return ONLY a valid JSON array. No explanation, no markdown,
no code blocks. Just the raw JSON array.

Format per drill:
{
  "id": "<drill id>",
  "ltpd_stages": ["U11", "U13"],
  "age_bands": [9, 10, 11, 12],
  "skill_domains": ["compete", "decision_making"],
  "intensity": "medium",
  "tags": ["corner_battles"],
  "confidence": "high"
}
"""


def fetch_all_drills():
    """
    Fetch all drills from the database.
    Returns list of {id, name, description, category} dicts.
    """
    # Import here to avoid circular imports
    sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

    try:
        from main import get_db
        import sqlite3

        # Try PostgreSQL first (Railway)
        db_url = os.getenv("DATABASE_URL", "")
        if db_url.startswith("postgresql"):
            import psycopg2
            conn = psycopg2.connect(db_url)
            cur = conn.cursor()
            cur.execute("""
                SELECT id::text, name, 
                       COALESCE(description, '') as description,
                       COALESCE(category, '') as category
                FROM drills
                ORDER BY category, name
            """)
            rows = cur.fetchall()
            conn.close()
        else:
            # SQLite fallback (local dev)
            conn = sqlite3.connect("hockey_reports.db")
            cur = conn.cursor()
            cur.execute("""
                SELECT id, name,
                       COALESCE(description, '') as description,
                       COALESCE(category, '') as category
                FROM drills
                ORDER BY category, name
            """)
            rows = cur.fetchall()
            conn.close()

        drills = [
            {
                "id": str(row[0]),
                "name": row[1],
                "description": row[2],
                "category": row[3],
            }
            for row in rows
        ]
        print(f"Fetched {len(drills)} drills from database.")
        return drills

    except Exception as e:
        print(f"DB error: {e}")
        print("Make sure DATABASE_URL is set or hockey_reports.db exists.")
        sys.exit(1)


def tag_batch(client: anthropic.Anthropic, batch: list) -> list:
    """
    Send a batch of drills to Claude for tagging.
    Returns list of proposed tag objects.
    """
    drills_json = json.dumps(batch, indent=2)

    user_message = f"""
Tag these {len(batch)} drills with LTPD metadata.
Return a JSON array with exactly {len(batch)} objects,
one per drill, in the same order.

Drills to tag:
{drills_json}
"""

    response = client.messages.create(
        model=MODEL,
        max_tokens=4000,
        system=TAGGING_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    raw = response.content[0].text.strip()

    # Strip markdown code blocks if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        tagged = json.loads(raw)
        return tagged
    except json.JSONDecodeError as e:
        print(f"  JSON parse error in batch: {e}")
        print(f"  Raw response (first 500 chars): {raw[:500]}")
        return []


def validate_tags(tagged: dict) -> tuple[dict, list]:
    """
    Validate proposed tags against allowed values.
    Returns (cleaned_tags, warnings).
    """
    warnings = []

    # Validate ltpd_stages
    valid_stages = [s for s in tagged.get("ltpd_stages", [])
                    if s in VALID_LTPD_STAGES]
    if len(valid_stages) != len(tagged.get("ltpd_stages", [])):
        invalid = set(tagged.get("ltpd_stages", [])) - set(VALID_LTPD_STAGES)
        warnings.append(f"Invalid ltpd_stages removed: {invalid}")
    tagged["ltpd_stages"] = valid_stages

    # Validate skill_domains
    valid_domains = [d for d in tagged.get("skill_domains", [])
                     if d in VALID_SKILL_DOMAINS]
    if len(valid_domains) != len(tagged.get("skill_domains", [])):
        invalid = set(tagged.get("skill_domains", [])) - set(VALID_SKILL_DOMAINS)
        warnings.append(f"Invalid skill_domains removed: {invalid}")
    tagged["skill_domains"] = valid_domains

    # Validate intensity
    if tagged.get("intensity") not in VALID_INTENSITY:
        warnings.append(f"Invalid intensity: {tagged.get('intensity')} → set to medium")
        tagged["intensity"] = "medium"

    # Validate tags
    valid_tags = [t for t in tagged.get("tags", [])
                  if t in VALID_GAME_ISSUE_TAGS]
    tagged["tags"] = valid_tags

    # Ensure confidence field
    if tagged.get("confidence") not in ["high", "medium", "low"]:
        tagged["confidence"] = "medium"
        warnings.append("Missing confidence → set to medium")

    # Systems domain requires U13+ minimum
    if "systems" in tagged.get("skill_domains", []):
        valid_stages = tagged.get("ltpd_stages", [])
        junior_stages = {"U9", "U11"}
        if all(s in junior_stages for s in valid_stages) and valid_stages:
            warnings.append(
                "Systems domain requires U13+ — stages adjusted"
            )
            tagged["ltpd_stages"] = ["U13"]
            tagged["confidence"] = "low"

    return tagged, warnings


def run_bulk_tagging():
    """Main entry point for bulk tagging job."""
    print("=" * 60)
    print("PXI DRILL LIBRARY BULK TAGGING JOB")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # Initialize Anthropic client
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY not set.")
        sys.exit(1)
    client = anthropic.Anthropic(api_key=api_key)

    # Fetch drills
    drills = fetch_all_drills()
    total = len(drills)

    # Process in batches
    all_tagged = []
    all_warnings = {}
    errors = []

    batches = [drills[i:i+BATCH_SIZE] for i in range(0, total, BATCH_SIZE)]
    print(f"\nProcessing {total} drills in {len(batches)} batches of {BATCH_SIZE}...")
    print()

    for i, batch in enumerate(batches):
        batch_num = i + 1
        print(f"Batch {batch_num}/{len(batches)} "
              f"(drills {i*BATCH_SIZE+1}–{min((i+1)*BATCH_SIZE, total)})...")

        try:
            tagged_batch = tag_batch(client, batch)

            if not tagged_batch:
                print(f"  ERROR: Empty response for batch {batch_num}")
                errors.append(f"Batch {batch_num}: empty response")
                continue

            if len(tagged_batch) != len(batch):
                print(f"  WARNING: Expected {len(batch)} results, "
                      f"got {len(tagged_batch)}")

            # Validate and merge with original drill data
            for j, tagged in enumerate(tagged_batch):
                if j < len(batch):
                    original = batch[j]
                    tagged["id"] = original["id"]  # Ensure ID is preserved
                    tagged["name"] = original["name"]  # Keep for review
                    tagged["category"] = original["category"]

                    cleaned, warnings = validate_tags(tagged)
                    if warnings:
                        all_warnings[cleaned["id"]] = warnings

                    all_tagged.append(cleaned)

            # Confidence summary for this batch
            high = sum(1 for t in tagged_batch
                       if t.get("confidence") == "high")
            medium = sum(1 for t in tagged_batch
                         if t.get("confidence") == "medium")
            low = sum(1 for t in tagged_batch
                      if t.get("confidence") == "low")
            print(f"  ✓ Tagged {len(tagged_batch)} drills — "
                  f"high: {high}, medium: {medium}, low: {low}")

            # Rate limiting
            if batch_num < len(batches):
                time.sleep(1)

        except Exception as e:
            print(f"  ERROR in batch {batch_num}: {e}")
            errors.append(f"Batch {batch_num}: {str(e)}")
            continue

    # Write full output
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_tagged, f, indent=2)
    print(f"\n✅ Full proposed tags written to: {OUTPUT_FILE}")

    # Write low-confidence subset for priority review
    needs_review = [
        t for t in all_tagged
        if t.get("confidence") in ["low", "medium"]
    ]
    with open(LOW_CONFIDENCE_FILE, "w", encoding="utf-8") as f:
        json.dump(needs_review, f, indent=2)
    print(f"⚠️  Review needed ({len(needs_review)} drills): "
          f"{LOW_CONFIDENCE_FILE}")

    # Summary
    print()
    print("=" * 60)
    print("TAGGING COMPLETE")
    print(f"Total drills tagged: {len(all_tagged)}")
    confidence_counts = {
        "high": sum(1 for t in all_tagged if t.get("confidence") == "high"),
        "medium": sum(1 for t in all_tagged if t.get("confidence") == "medium"),
        "low": sum(1 for t in all_tagged if t.get("confidence") == "low"),
    }
    print(f"High confidence (bulk approve): {confidence_counts['high']}")
    print(f"Medium confidence (spot check): {confidence_counts['medium']}")
    print(f"Low confidence (must review): {confidence_counts['low']}")
    if errors:
        print(f"\nErrors encountered: {len(errors)}")
        for err in errors:
            print(f"  - {err}")
    if all_warnings:
        print(f"\nValidation warnings on {len(all_warnings)} drills "
              f"(auto-corrected).")
    print()
    print("NEXT STEPS:")
    print(f"1. Review {LOW_CONFIDENCE_FILE} — edit tags as needed")
    print(f"2. When satisfied, run: python scripts/tag_drills_apply.py")
    print("   This writes approved tags to the drills table.")
    print("=" * 60)


# ── APPLY SCRIPT (run after review) ─────────────────────────

APPLY_SCRIPT = '''#!/usr/bin/env python3
# ============================================================
# DRILL TAGS APPLY SCRIPT
# File: backend/scripts/tag_drills_apply.py
# Run AFTER reviewing drill_tags_proposed.json
# Writes approved tags to drills table in database.
# ============================================================

import json
import os
import sys

INPUT_FILE = "drill_tags_proposed.json"

def apply_tags():
    print("Applying approved drill tags to database...")

    with open(INPUT_FILE, "r") as f:
        approved = json.load(f)

    db_url = os.getenv("DATABASE_URL", "")

    if db_url.startswith("postgresql"):
        import psycopg2
        import psycopg2.extras
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()

        updated = 0
        errors = []

        for drill in approved:
            try:
                cur.execute("""
                    UPDATE drills SET
                        ltpd_stages = %s,
                        age_bands = %s,
                        skill_domains = %s,
                        intensity = %s,
                        tags = %s,
                        ltpd_tagged_at = NOW(),
                        ltpd_confidence = %s
                    WHERE id = %s::uuid
                """, (
                    json.dumps(drill.get("ltpd_stages", [])),
                    json.dumps(drill.get("age_bands", [])),
                    json.dumps(drill.get("skill_domains", [])),
                    drill.get("intensity", "medium"),
                    json.dumps(drill.get("tags", [])),
                    drill.get("confidence", "medium"),
                    drill["id"],
                ))
                updated += 1
            except Exception as e:
                errors.append(f"Drill {drill.get('id')}: {e}")

        conn.commit()
        conn.close()

        print(f"✅ Updated {updated} drills in database.")
        if errors:
            print(f"Errors on {len(errors)} drills:")
            for err in errors:
                print(f"  - {err}")
    else:
        print("ERROR: PostgreSQL required. Set DATABASE_URL.")
        sys.exit(1)

if __name__ == "__main__":
    apply_tags()
'''


if __name__ == "__main__":
    # Also write the apply script
    apply_path = os.path.join(
        os.path.dirname(__file__), "tag_drills_apply.py"
    )
    with open(apply_path.replace("tag_drills_bulk.py", "tag_drills_apply.py"),
              "w") as f:
        f.write(APPLY_SCRIPT)
    print("Apply script written to: scripts/tag_drills_apply.py")

    run_bulk_tagging()

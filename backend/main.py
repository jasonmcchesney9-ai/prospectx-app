"""
ProspectX API Server — SQLite Version
Zero external DB dependencies. Just SQLite + FastAPI.
"""

import asyncio
import json
import logging
import os
import re
import sqlite3
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import csv
import io

import jwt
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Request, Depends, File, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from passlib.context import CryptContext
from pydantic import BaseModel, Field, field_validator

# Load .env from the backend directory (works regardless of CWD)
_backend_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_backend_dir, ".env"), override=True)

# ============================================================
# LOGGING
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("prospectx")

# ============================================================
# CONFIG
# ============================================================

# Store SQLite DB outside the Next.js project folder so Turbopack doesn't
# try to read the WAL lock files (.db-shm, .db-wal) and crash.
_DATA_DIR = os.path.join(os.path.expanduser("~"), ".prospectx")
os.makedirs(_DATA_DIR, exist_ok=True)
DB_FILE = os.path.join(_DATA_DIR, "prospectx.db")
JWT_SECRET = os.getenv("JWT_SECRET", "prospectx_dev_secret_change_in_production_2026")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# ============================================================
# APP + MIDDLEWARE
# ============================================================

app = FastAPI(
    title="ProspectX API",
    description="Decision-Grade Hockey Intelligence Platform",
    version="1.0.0",
)

# ── Images directory ──────────────────────────────
_IMAGES_DIR = os.path.join(_DATA_DIR, "images")
os.makedirs(_IMAGES_DIR, exist_ok=True)

# Serve uploaded player images as static files
app.mount("/uploads", StaticFiles(directory=_IMAGES_DIR), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        FRONTEND_URL,
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Accept", "Accept-Language", "Authorization", "Content-Language", "Content-Type"],
    max_age=600,
)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

# ============================================================
# REQUEST ID MIDDLEWARE
# ============================================================

@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    try:
        response = await call_next(request)
        response.headers["X-Request-Id"] = request_id
        return response
    except Exception as exc:
        logger.exception("Middleware error on %s %s", request.method, request.url.path)
        detail = str(exc) if ENVIRONMENT == "development" else "Internal server error"
        return JSONResponse(status_code=500, content={"detail": detail})

# ============================================================
# GLOBAL ERROR HANDLER
# ============================================================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    detail = str(exc) if ENVIRONMENT == "development" else "Internal server error."
    return JSONResponse(status_code=500, content={"detail": detail})

# ============================================================
# DATABASE
# ============================================================

def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


# ── League Tier Classification ──────────────────────────────────────────────
LEAGUE_TIERS = {
    # Tier 1 — Major Junior (CHL)
    "OHL": "Tier1", "WHL": "Tier1", "QMJHL": "Tier1", "CHL": "Tier1",
    # Tier 2 — Junior A
    "OJHL": "Tier2", "BCHL": "Tier2", "USHL": "Tier2", "AJHL": "Tier2",
    "CCHL": "Tier2", "NOJHL": "Tier2", "SJHL": "Tier2", "MHL": "Tier2",
    "MJHL": "Tier2",
    # Tier 3 — Junior B / Tier 2 Jr
    "GOJHL": "Tier3", "NAHL": "Tier3", "GMHL": "Tier3", "PJHL": "Tier3",
    "WOAA": "Tier3", "SIJHL": "Tier3",
    # College / University
    "NCAA": "NCAA", "NCAA DI": "NCAA", "NCAA DIII": "NCAA_D3",
    "USports": "USports", "U SPORTS": "USports",
    # International
    "KHL": "Pro", "SHL": "Pro", "AHL": "Pro", "ECHL": "Pro",
    "NHL": "Pro", "Liiga": "Pro", "NLA": "Pro", "DEL": "Pro",
}


def _get_league_tier(league_name: str | None) -> str | None:
    """Classify league into tier."""
    if not league_name:
        return None
    # Exact match first
    if league_name in LEAGUE_TIERS:
        return LEAGUE_TIERS[league_name]
    # Case-insensitive
    upper = league_name.upper().strip()
    for key, tier in LEAGUE_TIERS.items():
        if key.upper() == upper:
            return tier
    return "Unknown"


def _get_age_group(birth_year: int | None) -> str | None:
    """Classify player into age group based on birth year."""
    if not birth_year:
        return None
    current_year = datetime.now().year
    age = current_year - birth_year
    if age <= 16:
        return "U16"
    elif age <= 18:
        return "U18"
    elif age <= 20:
        return "U20"
    else:
        return "Over20"


def _populate_derived_player_fields(conn):
    """Auto-populate birth_year, age_group, draft_eligible_year, league_tier
    for any players that have NULL values but have the source data."""
    # Birth year / age group / draft eligible year from dob
    rows = conn.execute(
        "SELECT id, dob, current_league, birth_year, league_tier FROM players"
    ).fetchall()
    updated = 0
    for row in rows:
        pid = row[0]
        dob = row[1]
        league = row[2]
        existing_by = row[3]
        existing_lt = row[4]

        updates = {}
        params = []

        # Derive birth_year, age_group, draft_eligible_year from dob
        if dob and not existing_by:
            try:
                by = int(dob[:4])
                updates["birth_year"] = by
                updates["age_group"] = _get_age_group(by)
                updates["draft_eligible_year"] = by + 18
            except (ValueError, IndexError):
                pass

        # Derive league_tier from current_league
        if league and not existing_lt:
            updates["league_tier"] = _get_league_tier(league)

        if updates:
            set_clauses = ", ".join(f"{k} = ?" for k in updates)
            params = list(updates.values()) + [pid]
            conn.execute(f"UPDATE players SET {set_clauses} WHERE id = ?", params)
            updated += 1

    if updated:
        conn.commit()
        logger.info("Populated derived fields for %d players", updated)


# ── Template Category Mapping ──────────────────────────────────────────────
TEMPLATE_CATEGORIES = {
    "pro_skater":          ("Player Analytics", "Performance Metrics"),
    "season_intelligence": ("Player Analytics", "Performance Metrics"),
    "family_card":         ("Player Analytics", "Presentation"),
    "agent_pack":          ("Player Analytics", "Presentation"),
    "unified_prospect":    ("Player Analytics", "Advanced Stats"),
    "game_decision":       ("Player Analytics", "Advanced Stats"),
    "development_roadmap": ("Player Analytics", "Projections & Development"),
    "draft_comparative":   ("Player Analytics", "Projections & Development"),
    "season_progress":     ("Player Analytics", "Performance Metrics"),
    "team_identity":       ("Team Analytics", "System Analysis"),
    "operations":          ("Team Analytics", "System Analysis"),
    "practice_plan":       ("Team Analytics", "System Analysis"),
    "line_chemistry":      ("Team Analytics", "Line Optimization"),
    "st_optimization":     ("Team Analytics", "Special Teams"),
    "goalie_tandem":       ("Team Analytics", "Special Teams"),
    "goalie":              ("Competitive Intelligence", "Market & Acquisitions"),
    "opponent_gameplan":   ("Competitive Intelligence", "Opponent Analysis"),
    "playoff_series":      ("Competitive Intelligence", "Opponent Analysis"),
    "trade_target":        ("Competitive Intelligence", "Market & Acquisitions"),
    # Priority 2 reports
    "indices_dashboard":   ("Player Analytics", "Advanced Stats"),
    "player_projection":   ("Player Analytics", "Projections & Development"),
    "league_benchmarks":   ("Competitive Intelligence", "League Benchmarks"),
    "season_projection":   ("Competitive Intelligence", "League Benchmarks"),
    "free_agent_market":   ("Competitive Intelligence", "Market & Acquisitions"),
}


def _seed_template_categories(conn):
    """Set category/subcategory on report_templates if not already set."""
    for rtype, (cat, subcat) in TEMPLATE_CATEGORIES.items():
        conn.execute(
            "UPDATE report_templates SET category = ?, subcategory = ? WHERE report_type = ? AND (category IS NULL OR category = '')",
            (cat, subcat, rtype),
        )
    conn.commit()


def init_db():
    """Create all tables if they don't exist."""
    conn = get_db()
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS organizations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            org_type TEXT DEFAULT 'team',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            first_name TEXT,
            last_name TEXT,
            role TEXT NOT NULL DEFAULT 'scout',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (org_id) REFERENCES organizations(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS players (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            dob TEXT,
            position TEXT NOT NULL,
            shoots TEXT,
            height_cm INTEGER,
            weight_kg INTEGER,
            current_team TEXT,
            current_league TEXT,
            passports TEXT DEFAULT '[]',
            notes TEXT,
            tags TEXT DEFAULT '[]',
            archetype TEXT,
            image_url TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (org_id) REFERENCES organizations(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS player_stats (
            id TEXT PRIMARY KEY,
            player_id TEXT NOT NULL,
            game_id TEXT,
            season TEXT,
            stat_type TEXT DEFAULT 'season',
            gp INTEGER DEFAULT 0,
            g INTEGER DEFAULT 0,
            a INTEGER DEFAULT 0,
            p INTEGER DEFAULT 0,
            plus_minus INTEGER DEFAULT 0,
            pim INTEGER DEFAULT 0,
            toi_seconds INTEGER DEFAULT 0,
            pp_toi_seconds INTEGER DEFAULT 0,
            pk_toi_seconds INTEGER DEFAULT 0,
            shots INTEGER DEFAULT 0,
            sog INTEGER DEFAULT 0,
            shooting_pct REAL,
            microstats TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (player_id) REFERENCES players(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS reports (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            player_id TEXT NOT NULL,
            template_id TEXT,
            report_type TEXT NOT NULL,
            title TEXT,
            status TEXT DEFAULT 'pending',
            output_json TEXT,
            output_text TEXT,
            input_data TEXT,
            error_message TEXT,
            generated_at TEXT,
            llm_model TEXT,
            llm_tokens INTEGER DEFAULT 0,
            generation_time_ms INTEGER,
            created_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (org_id) REFERENCES organizations(id),
            FOREIGN KEY (player_id) REFERENCES players(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS report_templates (
            id TEXT PRIMARY KEY,
            org_id TEXT,
            template_name TEXT NOT NULL,
            report_type TEXT NOT NULL,
            prompt_text TEXT,
            data_schema TEXT DEFAULT '{}',
            is_global INTEGER DEFAULT 1,
            version INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS teams (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            name TEXT NOT NULL,
            league TEXT,
            city TEXT,
            abbreviation TEXT,
            identity TEXT DEFAULT '{}',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (org_id) REFERENCES organizations(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS scout_notes (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            player_id TEXT NOT NULL,
            scout_id TEXT NOT NULL,
            note_text TEXT NOT NULL,
            note_type TEXT DEFAULT 'general',
            tags TEXT DEFAULT '[]',
            is_private INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (org_id) REFERENCES organizations(id),
            FOREIGN KEY (player_id) REFERENCES players(id),
            FOREIGN KEY (scout_id) REFERENCES users(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS import_jobs (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            uploaded_by TEXT NOT NULL,
            filename TEXT,
            total_rows INTEGER DEFAULT 0,
            new_players INTEGER DEFAULT 0,
            duplicates_found INTEGER DEFAULT 0,
            errors_found INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending',
            preview_data TEXT DEFAULT '[]',
            duplicate_data TEXT DEFAULT '[]',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (org_id) REFERENCES organizations(id),
            FOREIGN KEY (uploaded_by) REFERENCES users(id)
        )
    """)

    # ── Hockey Operating System Tables ──────────────────────────

    # Hockey terminology glossary — the language ProspectX speaks
    c.execute("""
        CREATE TABLE IF NOT EXISTS hockey_terms (
            id TEXT PRIMARY KEY,
            term TEXT NOT NULL UNIQUE,
            category TEXT NOT NULL,
            definition TEXT NOT NULL,
            aliases TEXT DEFAULT '[]',
            usage_context TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Systems library — tactical structures teams can run
    c.execute("""
        CREATE TABLE IF NOT EXISTS systems_library (
            id TEXT PRIMARY KEY,
            system_type TEXT NOT NULL,
            code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            description TEXT,
            strengths TEXT,
            weaknesses TEXT,
            ideal_personnel TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Team systems — which systems a team actually runs
    c.execute("""
        CREATE TABLE IF NOT EXISTS team_systems (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            team_id TEXT,
            team_name TEXT,
            season TEXT,
            forecheck TEXT,
            dz_structure TEXT,
            oz_setup TEXT,
            pp_formation TEXT,
            pk_formation TEXT,
            neutral_zone TEXT,
            breakout TEXT,
            identity_tags TEXT DEFAULT '[]',
            pace TEXT DEFAULT '',
            physicality TEXT DEFAULT '',
            offensive_style TEXT DEFAULT '',
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (org_id) REFERENCES organizations(id)
        )
    """)

    # Migrate existing team_systems table — add Team Style columns if missing
    try:
        c.execute("ALTER TABLE team_systems ADD COLUMN pace TEXT DEFAULT ''")
    except sqlite3.OperationalError:
        pass  # Column already exists
    try:
        c.execute("ALTER TABLE team_systems ADD COLUMN physicality TEXT DEFAULT ''")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE team_systems ADD COLUMN offensive_style TEXT DEFAULT ''")
    except sqlite3.OperationalError:
        pass

    # ── Reports table migration: make player_id nullable, add team_name column ──
    # SQLite doesn't support ALTER COLUMN, so we check and recreate if needed
    cursor_info = c.execute("PRAGMA table_info(reports)").fetchall()
    report_cols = {col[1] for col in cursor_info}
    if "team_name" not in report_cols:
        logger.info("Migrating reports table: adding team_name column, making player_id nullable...")
        c.execute("""CREATE TABLE IF NOT EXISTS reports_new (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            player_id TEXT,
            team_name TEXT,
            template_id TEXT,
            report_type TEXT NOT NULL,
            title TEXT,
            status TEXT DEFAULT 'pending',
            output_json TEXT,
            output_text TEXT,
            input_data TEXT,
            error_message TEXT,
            generated_at TEXT,
            llm_model TEXT,
            llm_tokens INTEGER DEFAULT 0,
            generation_time_ms INTEGER,
            created_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (org_id) REFERENCES organizations(id)
        )""")
        c.execute("""INSERT INTO reports_new (id, org_id, player_id, template_id, report_type, title, status, output_json, output_text, input_data, error_message, generated_at, llm_model, llm_tokens, generation_time_ms, created_by, created_at)
            SELECT id, org_id, player_id, template_id, report_type, title, status, output_json, output_text, input_data, error_message, generated_at, llm_model, llm_tokens, generation_time_ms, created_by, created_at FROM reports""")
        c.execute("DROP TABLE reports")
        c.execute("ALTER TABLE reports_new RENAME TO reports")
        logger.info("Reports table migration complete.")

    # Player archetypes — computed or manually assigned role classifications
    c.execute("""
        CREATE TABLE IF NOT EXISTS player_archetypes (
            id TEXT PRIMARY KEY,
            player_id TEXT NOT NULL,
            archetype TEXT NOT NULL,
            confidence REAL DEFAULT 0.0,
            indices TEXT DEFAULT '{}',
            assigned_by TEXT DEFAULT 'manual',
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (player_id) REFERENCES players(id)
        )
    """)

    # System adherence — how well a player fits or performs in a system
    c.execute("""
        CREATE TABLE IF NOT EXISTS system_adherence (
            id TEXT PRIMARY KEY,
            player_id TEXT NOT NULL,
            system_code TEXT NOT NULL,
            adherence_score REAL,
            fit_rating TEXT,
            notes TEXT,
            evaluated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (player_id) REFERENCES players(id)
        )
    """)

    # Team evaluation criteria — what a team values for each position
    c.execute("""
        CREATE TABLE IF NOT EXISTS team_eval_criteria (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            position TEXT NOT NULL,
            criteria_name TEXT NOT NULL,
            weight REAL DEFAULT 1.0,
            description TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (org_id) REFERENCES organizations(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS leagues (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            abbreviation TEXT NOT NULL UNIQUE,
            country TEXT DEFAULT 'Canada',
            level TEXT DEFAULT 'junior',
            sort_order INTEGER DEFAULT 100,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ── InStat Analytics tables ──────────────────────────────

    c.execute("""
        CREATE TABLE IF NOT EXISTS goalie_stats (
            id TEXT PRIMARY KEY,
            player_id TEXT NOT NULL,
            org_id TEXT NOT NULL,
            season TEXT,
            stat_type TEXT DEFAULT 'season',
            gp INTEGER DEFAULT 0,
            toi_seconds INTEGER DEFAULT 0,
            ga REAL DEFAULT 0,
            sa REAL DEFAULT 0,
            sv REAL DEFAULT 0,
            sv_pct TEXT,
            gaa REAL,
            extended_stats TEXT,
            data_source TEXT DEFAULT 'manual',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (player_id) REFERENCES players(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS team_stats (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            team_name TEXT NOT NULL,
            league TEXT,
            season TEXT,
            stat_type TEXT DEFAULT 'season',
            extended_stats TEXT,
            data_source TEXT DEFAULT 'instat',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS line_combinations (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            team_name TEXT NOT NULL,
            season TEXT,
            line_type TEXT NOT NULL,
            player_names TEXT NOT NULL,
            player_refs TEXT,
            plus_minus TEXT,
            shifts INTEGER DEFAULT 0,
            toi_seconds INTEGER DEFAULT 0,
            goals_for REAL DEFAULT 0,
            goals_against REAL DEFAULT 0,
            extended_stats TEXT,
            data_source TEXT DEFAULT 'instat',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ── Player Intelligence table ─────────────────────────────
    c.execute("""
        CREATE TABLE IF NOT EXISTS player_intelligence (
            id TEXT PRIMARY KEY,
            player_id TEXT NOT NULL,
            org_id TEXT NOT NULL,
            archetype TEXT,
            archetype_confidence REAL,
            overall_grade TEXT,
            offensive_grade TEXT,
            defensive_grade TEXT,
            skating_grade TEXT,
            hockey_iq_grade TEXT,
            compete_grade TEXT,
            summary TEXT,
            strengths TEXT,
            development_areas TEXT,
            comparable_players TEXT,
            stat_signature TEXT,
            tags TEXT DEFAULT '[]',
            projection TEXT,
            data_sources_used TEXT,
            trigger TEXT,
            version INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (player_id) REFERENCES players(id)
        )
    """)

    conn.commit()

    # ── Migrations for existing databases ───────────────────
    # Add image_url column if it doesn't exist
    cols = [col[1] for col in conn.execute("PRAGMA table_info(players)").fetchall()]
    if "image_url" not in cols:
        conn.execute("ALTER TABLE players ADD COLUMN image_url TEXT")
        conn.commit()
        logger.info("Migration: added image_url column to players table")

    # Add extended_stats and data_source columns to player_stats
    ps_cols = [col[1] for col in conn.execute("PRAGMA table_info(player_stats)").fetchall()]
    if "extended_stats" not in ps_cols:
        conn.execute("ALTER TABLE player_stats ADD COLUMN extended_stats TEXT")
        conn.commit()
        logger.info("Migration: added extended_stats column to player_stats")
    if "data_source" not in ps_cols:
        conn.execute("ALTER TABLE player_stats ADD COLUMN data_source TEXT DEFAULT 'manual'")
        conn.commit()
        logger.info("Migration: added data_source column to player_stats")

    # Add logo_url column to teams
    teams_cols = [col[1] for col in conn.execute("PRAGMA table_info(teams)").fetchall()]
    if "logo_url" not in teams_cols:
        conn.execute("ALTER TABLE teams ADD COLUMN logo_url TEXT")
        conn.commit()
        logger.info("Migration: added logo_url column to teams")

    # Add intelligence_version column to players
    player_cols = [col[1] for col in conn.execute("PRAGMA table_info(players)").fetchall()]
    if "intelligence_version" not in player_cols:
        conn.execute("ALTER TABLE players ADD COLUMN intelligence_version INTEGER DEFAULT 0")
        conn.commit()
        logger.info("Migration: added intelligence_version column to players")

    # ── Data Compartmentalization: birth_year, age_group, draft_eligible_year, league_tier ──
    player_cols = [col[1] for col in conn.execute("PRAGMA table_info(players)").fetchall()]
    new_player_cols = {
        "birth_year": "INTEGER",
        "age_group": "TEXT",
        "draft_eligible_year": "INTEGER",
        "league_tier": "TEXT",
    }
    for col_name, col_type in new_player_cols.items():
        if col_name not in player_cols:
            conn.execute(f"ALTER TABLE players ADD COLUMN {col_name} {col_type}")
            conn.commit()
            logger.info("Migration: added %s column to players", col_name)

    # Auto-populate birth_year / age_group / draft_eligible_year from dob
    _populate_derived_player_fields(conn)

    # Add category / subcategory columns to report_templates
    tmpl_cols = [col[1] for col in conn.execute("PRAGMA table_info(report_templates)").fetchall()]
    if "category" not in tmpl_cols:
        conn.execute("ALTER TABLE report_templates ADD COLUMN category TEXT")
        conn.commit()
        logger.info("Migration: added category column to report_templates")
    if "subcategory" not in tmpl_cols:
        conn.execute("ALTER TABLE report_templates ADD COLUMN subcategory TEXT")
        conn.commit()
        logger.info("Migration: added subcategory column to report_templates")

    # Seed template categories
    _seed_template_categories(conn)

    # Create indexes for fast queries
    for idx_sql in [
        "CREATE INDEX IF NOT EXISTS idx_players_birth_year ON players(birth_year)",
        "CREATE INDEX IF NOT EXISTS idx_players_age_group ON players(age_group)",
        "CREATE INDEX IF NOT EXISTS idx_players_league_tier ON players(league_tier)",
        "CREATE INDEX IF NOT EXISTS idx_players_team_league ON players(current_team, current_league)",
        "CREATE INDEX IF NOT EXISTS idx_players_position ON players(position)",
    ]:
        conn.execute(idx_sql)
    conn.commit()

    conn.close()
    logger.info("SQLite database initialized: %s", DB_FILE)


def seed_hockey_os():
    """Seed the Hockey OS reference data (systems library + glossary)."""
    conn = get_db()

    # Check if already seeded
    count = conn.execute("SELECT COUNT(*) FROM systems_library").fetchone()[0]
    if count > 0:
        conn.close()
        return

    # ── Systems Library ───────────────────────────────────────
    systems = [
        # Forecheck systems
        ("forecheck", "F_AGGRESSIVE_1_2_2", "Aggressive 1-2-2", "First forward pressures hard, two wingers contain middle ice, two D stay high. Forces turnovers but vulnerable to speed through the middle.", "High pressure, turnovers forced, good for teams with fast F1", "Can be beaten with quick east-west passes, requires disciplined F1", "Fast F1 with good closing speed, physical wingers"),
        ("forecheck", "F_1_2_2_TRAP", "1-2-2 Neutral Zone Trap", "Passive forecheck clogging the neutral zone. F1 angles, two forwards sit in a wall across the red line, D stay deep. Limits opponent transition.", "Limits odd-man rushes, controls pace, low risk", "Can be frustrating for own forwards, low event hockey", "Disciplined forwards willing to backcheck, patient defensemen"),
        ("forecheck", "F_2_1_2", "2-1-2 Forecheck", "Two forwards go deep on the forecheck, one center supports high, two D pinch. Very aggressive, forces turnovers but leaves the NZ open.", "Maximum OZ pressure, turnovers deep, dominant possession", "Vulnerable to stretch passes, breakaways if pinch fails", "Two physical forecheckers, mobile D who can pinch and recover"),
        ("forecheck", "F_1_3_1", "1-3-1 Forecheck", "One forward pressures, three across the neutral zone in a line, one D cheats up. Great for trapping teams and counter-attacking.", "Controls NZ, generates turnovers in transition, counter-attack", "Weak if opponent gets behind the 3-man wall", "Smart F1 who angles well, fast counter-attack wingers"),
        ("forecheck", "F_1_1_3", "1-1-3 Passive Trap", "Deep trap with only one forechecker, one mid-zone forward, and three players sitting back. Ultra-defensive shell.", "Almost impossible to get clean entries against, low goals against", "Very few offensive chances, boring hockey, hard to score", "Disciplined team willing to play low-event hockey"),
        # DZ structures
        ("dz_coverage", "DZ_MAN_TO_MAN", "Man-to-Man DZ", "Each player picks up a man in the defensive zone. Tight coverage, eliminates passing lanes, but can be exposed by picks and screens.", "Tight coverage, eliminates freelancers, good vs cycle teams", "Vulnerable to screens, picks, and mismatch situations", "Players with good feet, communication, and physicality"),
        ("dz_coverage", "DZ_ZONE", "Zone Defense DZ", "Players cover areas rather than men. Strong side overload, weak side rotates. Standard NHL-style coverage.", "Good against cycle, covers shooting lanes, less skating", "Can leave men open in soft areas, requires communication", "Smart players who read plays, good stick positioning"),
        ("dz_coverage", "DZ_COLLAPSING_BOX", "Collapsing Box DZ", "Four players form a box in front of the net, one player pressures the puck. Collapses inward on shots. Very protective of the slot.", "Protects the slot and net-front, limits high-danger chances", "Gives up perimeter shots, weak vs point shots with traffic", "Shot-blocking willingness, goalie who handles perimeter shots"),
        ("dz_coverage", "DZ_SWARM", "Swarm Coverage DZ", "Aggressive puck pursuit in the DZ. All five players pressure the puck carrier. High risk, high reward — forces turnovers or gets burned.", "Forces turnovers, creates transition chances from DZ", "Extremely vulnerable if beaten, requires elite conditioning", "High-compete players, great conditioning, smart gambles"),
        # OZ setups
        ("oz_setup", "OZ_UMBRELLA", "Umbrella OZ / PP", "One player at the top with two half-wall options and two net-front/bumper players. Classic power play look. Creates triangles for one-timers.", "One-timer options, triangle passing, multiple shooting lanes", "Predictable if scouted, requires a strong bumper player", "Shooter at the top, playmaker on the half-wall, big net-front"),
        ("oz_setup", "OZ_OVERLOAD", "Overload OZ", "Shifts 4 players to one side of the ice, creating numerical advantage. Quick passes in tight space, back-door options.", "Creates confusion, numerical advantage, back-door plays", "Weak side is empty — one pass beats it entirely", "Quick decision-makers, players comfortable in tight spaces"),
        ("oz_setup", "OZ_CYCLE", "Heavy Cycle OZ", "Grind the puck down low, use the half-wall, and work it to the net-front or point. Physical, possession-based.", "Controls the puck, wears down opponents, creates net-front chaos", "Slow to generate shots, can be broken by aggressive DZ pressure", "Big, strong forwards who protect the puck, net-front presence"),
        ("oz_setup", "OZ_1_3_1_PP", "1-3-1 Power Play", "One player at the top, three across the middle (two half-walls + bumper), one net-front. Creates passing lanes and mid-range shots.", "Multiple shooting options, hard to defend bumper, cross-ice plays", "Requires elite passer at the top, vulnerable to aggressive PK", "High-IQ playmaker at the top, finisher in the bumper"),
        # Breakout systems
        ("breakout", "BO_STANDARD", "Standard Breakout", "D-to-D behind the net, up to the winger on the wall, center supports through the middle. Basic but reliable.", "Simple, reliable, low turnover risk", "Predictable, easy for aggressive forechecks to read", "Good first-pass D, wingers who get open on the wall"),
        ("breakout", "BO_REVERSE", "Reverse Breakout", "D starts one direction then reverses behind the net to the weak-side D or winger. Changes the point of attack.", "Changes angles, beats overcommitted forecheckers", "Risky if weak-side support is late, requires good skating D", "Mobile defensemen, quick-thinking forwards"),
        ("breakout", "BO_WHEEL", "Wheel Breakout", "D skates behind the net and carries the puck up-ice themselves. Aggressive, creates odd-man opportunities.", "Creates speed through NZ, D joins the rush as an extra attacker", "Very risky if D gets caught, requires elite skating ability", "Mobile, puck-carrying defensemen with good vision"),
        # PK formations
        ("pk_formation", "PK_BOX", "Box PK", "Four players form a box (diamond). Protects the slot, takes away one-timer lanes. Standard PK look.", "Protects the slot, eliminates one-timers, simple reads", "Gives up perimeter shots, can be stretched by movement", "Shot blockers, strong sticks in passing lanes"),
        ("pk_formation", "PK_DIAMOND", "Diamond PK", "One forward pressures high, two forwards/D at the dots, one D in front of the net. More aggressive than a box.", "Pressures the puck, disrupts PP entries, forces turnovers", "Vulnerable if high man is beaten, leaves backdoor open", "Fast penalty-killing forwards, aggressive D"),
        ("pk_formation", "PK_AGGRESSIVE", "Aggressive PK", "Two forwards pressure the puck aggressively on the PK, trying to force turnovers and create shorthanded chances.", "Shorthanded goals, disrupts PP flow, momentum swings", "Extremely risky — one pass can expose the entire PK", "Elite PKers with speed, high hockey IQ, calculated aggression"),
    ]

    for sys_type, code, name, desc, strengths, weaknesses, personnel in systems:
        conn.execute(
            "INSERT INTO systems_library (id, system_type, code, name, description, strengths, weaknesses, ideal_personnel) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), sys_type, code, name, desc, strengths, weaknesses, personnel),
        )

    # ── Hockey Glossary Terms ─────────────────────────────────
    terms = [
        ("Controlled Entry", "transition", "Entering the offensive zone with possession of the puck (carry-in or pass). Opposite of a dump-in.", '["carry-in", "clean entry"]', "Microstat tracking, transition analysis"),
        ("Controlled Exit", "transition", "Exiting the defensive zone with possession — either carrying or passing the puck out cleanly.", '["clean exit", "breakout with possession"]', "Microstat tracking, transition analysis"),
        ("Battle Win Rate", "compete", "Percentage of loose puck battles won. Measured in board play, net-front, and forecheck scenarios.", '["puck battle %", "compete rate"]', "Physical evaluation, compete level assessment"),
        ("Forecheck Pressure", "forecheck", "An aggressive action on the puck carrier in the offensive zone to force a turnover or rushed play.", '["F1 pressure", "forechecking"]', "System adherence, forecheck evaluation"),
        ("Slot Pass", "offense", "A pass completed into the scoring slot area (between the faceoff dots and below the top of the circles).", '["pass to slot", "dangerous pass"]', "Offensive creation, playmaking evaluation"),
        ("xG (Expected Goals)", "analytics", "A model-based metric estimating the probability a shot becomes a goal based on location, type, and context.", '["expected goals"]', "Advanced analytics, shot quality measurement"),
        ("Cycle Play", "systems", "Possession-based offensive strategy working the puck along the boards and behind the net to create scoring chances.", '["grinding", "below the goal line"]', "System description, offensive evaluation"),
        ("Gap Control", "defense", "The distance a defender maintains between themselves and the attacking player. Tight gap = aggressive, loose gap = conservative.", '["closing speed", "gap management"]', "Defensive evaluation, skating assessment"),
        ("Net-Front Presence", "offense", "A player's ability to establish and maintain position in front of the opposing net to screen, tip, and create chaos.", '["net-front", "crease work", "dirty area goals"]', "Role fit, archetype classification"),
        ("Transition Game", "transition", "The ability to move the puck effectively from defense to offense through the neutral zone. Measured by controlled entries/exits.", '["transition", "NZ play"]', "Overall game assessment, speed of play"),
        ("Two-Way Forward", "archetypes", "A forward who contributes offensively while also being responsible defensively. Trusted in all three zones and situations.", '["200-foot player", "complete forward"]', "Archetype classification, role fit"),
        ("Puck-Moving Defenseman", "archetypes", "A defenseman whose primary value is moving the puck out of the DZ and through the NZ. Good first pass, skating, and vision.", '["mobile D", "skating defenseman"]', "Archetype classification, D evaluation"),
        ("F1/F2/F3", "systems", "The three forward roles in a forecheck. F1 = first forechecker (pressure), F2 = second (support/contain), F3 = third (high/safety).", '["forecheck roles"]', "System description, forecheck evaluation"),
        ("Retrieve and Regroup", "breakout", "A breakout strategy where the D retrieves the puck behind the net and looks to regroup rather than make a quick breakout pass.", '["regroup"]', "Breakout evaluation, patience assessment"),
        ("Shooting Percentage", "analytics", "Goals divided by shots on goal. Context matters — league average varies by level. Sustainability is key.", '["S%", "sh%", "shooting efficiency"]', "Offensive evaluation, shot selection"),
    ]

    for term, cat, defn, aliases, context in terms:
        conn.execute(
            "INSERT INTO hockey_terms (id, term, category, definition, aliases, usage_context) VALUES (?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), term, cat, defn, aliases, context),
        )

    conn.commit()
    conn.close()
    logger.info("Seeded Hockey OS: %d systems, %d glossary terms", len(systems), len(terms))


def seed_templates():
    """Seed the 19 report templates if they don't exist yet."""
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) FROM report_templates").fetchone()[0]
    if count > 0:
        conn.close()
        return

    templates = [
        ("Pro/Amateur Skater Report", "pro_skater"),
        ("Unified Prospect Report", "unified_prospect"),
        ("Goalie Report", "goalie"),
        ("Single Game Decision Report", "game_decision"),
        ("Season Player Intelligence", "season_intelligence"),
        ("Elite Operations Engine", "operations"),
        ("Team Identity Card", "team_identity"),
        ("Opponent Game Plan", "opponent_gameplan"),
        ("Agent Pack", "agent_pack"),
        ("Development Roadmap", "development_roadmap"),
        ("Player/Family Card", "family_card"),
        ("Line Chemistry Report", "line_chemistry"),
        ("Special Teams Optimization", "st_optimization"),
        ("Trade/Acquisition Target", "trade_target"),
        ("Draft Class Comparative", "draft_comparative"),
        ("Season Progress Report", "season_progress"),
        ("Practice Plan Generator", "practice_plan"),
        ("Playoff Series Prep", "playoff_series"),
        ("Goalie Tandem Optimization", "goalie_tandem"),
    ]

    for name, rtype in templates:
        conn.execute(
            "INSERT INTO report_templates (id, template_name, report_type, is_global, prompt_text) VALUES (?, ?, ?, 1, ?)",
            (str(uuid.uuid4()), name, rtype, f"You are an elite hockey scout. Generate a {name} for the given player."),
        )

    conn.commit()
    conn.close()
    logger.info("Seeded %d report templates", len(templates))


def seed_new_templates():
    """Add any new report templates that were introduced after initial seeding."""
    conn = get_db()
    new_templates = [
        ("ProspectX Indices Dashboard", "indices_dashboard",
         "Player Analytics", "Advanced Stats",
         "Visual dashboard of all ProspectX performance indices with league percentile rankings, position comparisons, and development priorities."),
        ("League Benchmarks Comparison", "league_benchmarks",
         "Competitive Intelligence", "League Benchmarks",
         "Compare a team to league averages across offense, defense, special teams, and statistical leaders with trend analysis."),
        ("Team Season Projection", "season_projection",
         "Competitive Intelligence", "League Benchmarks",
         "Project full season standings, playoff odds, championship probabilities, and remaining schedule difficulty."),
        ("Next Season Player Projection", "player_projection",
         "Player Analytics", "Projections & Development",
         "Project a player's next season performance across conservative, expected, and optimistic scenarios with comparable player analysis."),
        ("Free Agent Market Analysis", "free_agent_market",
         "Competitive Intelligence", "Market & Acquisitions",
         "Analyze available uncommitted players by position, quality grade, and system fit with market trend analysis and timing recommendations."),
    ]
    added = 0
    for name, rtype, cat, subcat, desc in new_templates:
        existing = conn.execute("SELECT id FROM report_templates WHERE report_type = ?", (rtype,)).fetchone()
        if not existing:
            conn.execute(
                "INSERT INTO report_templates (id, template_name, report_type, is_global, prompt_text, category, subcategory) VALUES (?, ?, ?, 1, ?, ?, ?)",
                (str(uuid.uuid4()), name, rtype, desc, cat, subcat),
            )
            added += 1
    if added:
        conn.commit()
        logger.info("Added %d new report templates", added)
    conn.close()


def seed_leagues():
    """Seed the leagues reference table with Canadian/US junior and college leagues."""
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) FROM leagues").fetchone()[0]
    if count > 0:
        conn.close()
        return

    leagues = [
        ("GOJHL", "Greater Ontario Junior Hockey League", "Canada", "junior_b", 10),
        ("OJHL", "Ontario Junior Hockey League", "Canada", "junior_a", 20),
        ("OHL", "Ontario Hockey League", "Canada", "major_junior", 30),
        ("QMJHL", "Quebec Major Junior Hockey League", "Canada", "major_junior", 31),
        ("WHL", "Western Hockey League", "Canada", "major_junior", 32),
        ("BCHL", "British Columbia Hockey League", "Canada", "junior_a", 40),
        ("AJHL", "Alberta Junior Hockey League", "Canada", "junior_a", 41),
        ("SJHL", "Saskatchewan Junior Hockey League", "Canada", "junior_a", 42),
        ("MJHL", "Manitoba Junior Hockey League", "Canada", "junior_a", 43),
        ("MHL", "Maritime Hockey League", "Canada", "junior_a", 44),
        ("CCHL", "Central Canada Hockey League", "Canada", "junior_a", 45),
        ("NOJHL", "Northern Ontario Junior Hockey League", "Canada", "junior_a", 46),
        ("USHL", "United States Hockey League", "USA", "junior_a", 50),
        ("NAHL", "North American Hockey League", "USA", "junior_a", 51),
        ("NCAA", "National Collegiate Athletic Association", "USA", "college", 60),
        ("USHS", "US High School", "USA", "high_school", 70),
        ("AAA", "AAA Minor Hockey", "Canada", "minor", 80),
    ]
    for abbr, name, country, level, sort in leagues:
        conn.execute(
            "INSERT INTO leagues (id, abbreviation, name, country, level, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), abbr, name, country, level, sort),
        )
    conn.commit()
    conn.close()
    logger.info("Seeded %d leagues", len(leagues))


def seed_teams():
    """Seed reference teams for GOJHL (all conferences)."""
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) FROM teams WHERE org_id = '__global__'").fetchone()[0]
    if count > 0:
        conn.close()
        return

    # Ensure __global__ org exists for reference data (FK constraint)
    existing = conn.execute("SELECT id FROM organizations WHERE id = '__global__'").fetchone()
    if not existing:
        conn.execute(
            "INSERT INTO organizations (id, name) VALUES ('__global__', 'Global Reference Data')"
        )
        conn.commit()

    gojhl_teams = [
        # Western Conference
        ("Chatham Maroons", "GOJHL", "Chatham", "CM"),
        ("Leamington Flyers", "GOJHL", "Leamington", "LF"),
        ("LaSalle Vipers", "GOJHL", "LaSalle", "LV"),
        ("London Nationals", "GOJHL", "London", "LN"),
        ("Komoka Kings", "GOJHL", "Komoka", "KK"),
        ("Strathroy Rockets", "GOJHL", "Strathroy", "SR"),
        ("St. Thomas Stars", "GOJHL", "St. Thomas", "STS"),
        ("St. Marys Lincolns", "GOJHL", "St. Marys", "STM"),
        ("Sarnia Legionnaires", "GOJHL", "Sarnia", "SAR"),
        # Midwestern Conference
        ("Brantford Bandits", "GOJHL", "Brantford", "BB"),
        ("Cambridge Redhawks", "GOJHL", "Cambridge", "CAM"),
        ("Elmira Sugar Kings", "GOJHL", "Elmira", "ESK"),
        ("KW Siskins", "GOJHL", "Kitchener", "KWS"),
        ("Listowel Cyclones", "GOJHL", "Listowel", "LC"),
        ("Stratford Warriors", "GOJHL", "Stratford", "SW"),
        ("Ayr Centennials", "GOJHL", "Ayr", "AC"),
        # Golden Horseshoe Conference
        ("Caledonia Corvairs", "GOJHL", "Caledonia", "CC"),
        ("Hamilton Kilty B's", "GOJHL", "Hamilton", "HKB"),
        ("Pelham Panthers", "GOJHL", "Pelham", "PP"),
        ("St. Catharines Falcons", "GOJHL", "St. Catharines", "SCF"),
        ("Thorold Blackhawks", "GOJHL", "Thorold", "TB"),
        ("Niagara Falls Canucks", "GOJHL", "Niagara Falls", "NFC"),
        # Northern Conference
        ("Caledon Bombers", "GOJHL", "Caledon", "CB"),
    ]
    for name, league, city, abbr in gojhl_teams:
        conn.execute(
            "INSERT INTO teams (id, org_id, name, league, city, abbreviation) VALUES (?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), "__global__", name, league, city, abbr),
        )
    conn.commit()
    conn.close()
    logger.info("Seeded %d reference teams", len(gojhl_teams))


# Run on import
init_db()
seed_templates()
seed_new_templates()
seed_hockey_os()
seed_leagues()
seed_teams()


# ============================================================
# INSTAT ANALYTICS — HEADER MAPPINGS
# ============================================================
# Maps normalized InStat XLSX headers → storage targets.
# _parse_file_to_rows normalizes: .lower().replace(" ", "_").replace("-", "_")
# So "+/-" → "+/_", "short-handed" → "short_handed", "Faceoffs won, %" → "faceoffs_won,_%"
#
# Core targets: direct column names in player_stats (gp, g, a, p, etc.)
# Extended targets: "category.field" paths stored in extended_stats JSON

INSTAT_SKATER_CORE_MAP = {
    "games_played": "gp",
    "goals": "g",
    "assists": "a",
    "points": "p",
    "+/_": "plus_minus",
    "penalty_time": "pim",           # MM:SS → minutes
    "time_on_ice": "toi_seconds",    # MM:SS → seconds
    "shots": "shots",
    "shots_on_goal": "sog",
    "%_shots_on_goal": "shooting_pct",
}

INSTAT_SKATER_EXTENDED_MAP = {
    # Main statistics
    "all_shifts": "main.shifts",
    "puck_touches": "main.puck_touches",
    "puck_control_time": "main.puck_control_time",
    "scoring_chances": "main.scoring_chances",
    "penalties": "main.penalties",
    "penalties_drawn": "main.penalties_drawn",
    "hits": "main.hits",
    "hits_against": "main.hits_against",
    "error_leading_to_goal": "main.error_leading_to_goal",
    "dump_ins": "main.dump_ins",
    "dump_outs": "main.dump_outs",
    "first_assist": "main.first_assist",
    "second_assist": "main.second_assist",
    "plus": "main.plus",
    "minus": "main.minus",
    "faceoffs": "main.faceoffs",
    "faceoffs_won": "main.faceoffs_won",
    "faceoffs_lost": "main.faceoffs_lost",
    "faceoffs_won,_%": "main.faceoffs_won_pct",
    # Shots
    "blocked_shots": "shots.blocked_shots",
    "missed_shots": "shots.missed_shots",
    "slapshot": "shots.slapshot",
    "wrist_shot": "shots.wrist_shot",
    "shootouts": "shots.shootouts",
    "shootouts_scored": "shots.shootouts_scored",
    "shootouts_missed": "shots.shootouts_missed",
    "power_play_shots": "shots.pp_shots",
    "short_handed_shots": "shots.sh_shots",
    "positional_attack_shots": "shots.positional_attack_shots",
    "counter_attack_shots": "shots.counter_attack_shots",
    "shots_5_v_5": "shots.five_v_five_shots",
    # Puck battles
    "puck_battles": "puck_battles.total",
    "puck_battles_won": "puck_battles.won",
    "puck_battles_won,_%": "puck_battles.won_pct",
    "puck_battles_in_dz": "puck_battles.dz",
    "puck_battles_in_nz": "puck_battles.nz",
    "puck_battles_in_oz": "puck_battles.oz",
    "shots_blocking": "puck_battles.shots_blocking",
    "dekes": "puck_battles.dekes",
    "dekes_successful": "puck_battles.dekes_successful",
    "dekes_unsuccessful": "puck_battles.dekes_unsuccessful",
    "dekes_successful,_%": "puck_battles.dekes_successful_pct",
    # Recoveries & losses
    "takeaways": "recoveries.takeaways",
    "takeaways_in_dz": "recoveries.takeaways_dz",
    "takeaways_in_nz": "recoveries.takeaways_nz",
    "takeaways_in_oz": "recoveries.takeaways_oz",
    "loose_puck_recovery": "recoveries.loose_puck_recovery",
    "opponent's_dump_in_retrievals": "recoveries.dump_in_retrievals",
    "puck_retrievals_after_shots": "recoveries.puck_retrievals_after_shots",
    "puck_losses": "recoveries.puck_losses",
    "puck_losses_in_dz": "recoveries.puck_losses_dz",
    "puck_losses_in_nz": "recoveries.puck_losses_nz",
    "puck_losses_in_oz": "recoveries.puck_losses_oz",
    # Special teams
    "power_play": "special_teams.pp_count",
    "successful_power_play": "special_teams.pp_successful",
    "power_play_time": "special_teams.pp_time",
    "short_handed": "special_teams.sh_count",
    "penalty_killing": "special_teams.pk_count",
    "short_handed_time": "special_teams.sh_time",
    # xG
    "xg_per_shot": "xg.xg_per_shot",
    "xg_(expected_goals)": "xg.xg",
    "xg_per_goal": "xg.xg_per_goal",
    "net_xg_(xg_player_on___opp._team's_xg)": "xg.net_xg",
    "team_xg_when_on_ice": "xg.team_xg_on_ice",
    "opponent's_xg_when_on_ice": "xg.opponent_xg_on_ice",
    "xg_conversion": "xg.xg_conversion",
    # Passes
    "passes": "passes.total",
    "accurate_passes": "passes.accurate",
    "accurate_passes,_%": "passes.accurate_pct",
    "passes_to_the_slot": "passes.to_slot",
    "pre_shots_passes": "passes.pre_shot",
    "pass_receptions": "passes.receptions",
    # Entries & breakouts
    "entries": "entries.total",
    "entries_via_pass": "entries.via_pass",
    "entries_via_dump_in": "entries.via_dump",
    "entries_via_stickhandling": "entries.via_stickhandling",
    "breakouts": "entries.breakouts_total",
    "breakouts_via_pass": "entries.breakouts_via_pass",
    "breakouts_via_dump_out": "entries.breakouts_via_dump",
    "breakouts_via_stickhandling": "entries.breakouts_via_stickhandling",
    # Advanced (CORSI / Fenwick)
    "corsi": "advanced.corsi",
    "corsi_": "advanced.corsi_against",
    "corsi+": "advanced.corsi_for",
    "corsi_for,_%": "advanced.corsi_pct",
    "fenwick_for": "advanced.fenwick_for",
    "fenwick_against": "advanced.fenwick_against",
    "fenwick_for,_%": "advanced.fenwick_pct",
    # Faceoffs by zone
    "faceoffs_in_dz": "faceoffs_zone.dz_total",
    "faceoffs_won_in_dz": "faceoffs_zone.dz_won",
    "faceoffs_won_in_dz,_%": "faceoffs_zone.dz_pct",
    "faceoffs_in_nz": "faceoffs_zone.nz_total",
    "faceoffs_won_in_nz": "faceoffs_zone.nz_won",
    "faceoffs_won_in_nz,_%": "faceoffs_zone.nz_pct",
    "faceoffs_in_oz": "faceoffs_zone.oz_total",
    "faceoffs_won_in_oz": "faceoffs_zone.oz_won",
    "faceoffs_won_in_oz,_%": "faceoffs_zone.oz_pct",
    # Playtime
    "offensive_play": "playtime.offensive",
    "defensive_play": "playtime.defensive",
    "playing_in_attack": "playtime.offensive",  # team export alias
    "playing_in_defense": "playtime.defensive",  # team export alias
    "oz_possession": "playtime.oz_possession",
    "nz_possession": "playtime.nz_possession",
    "dz_possession": "playtime.dz_possession",
    # Scoring chances detail
    "scoring_chances___total": "scoring_chances.total",
    "scoring_chances___scored": "scoring_chances.scored",
    "scoring_chances_missed": "scoring_chances.missed",
    "scoring_chances_saved": "scoring_chances.saved",
    "scoring_chances,_%": "scoring_chances.pct",
    "inner_slot_shots___total": "scoring_chances.inner_slot_total",
    "inner_slot_shots___scored": "scoring_chances.inner_slot_scored",
    "inner_slot_shots___missed": "scoring_chances.inner_slot_missed",
    "inner_slot_shots___saved": "scoring_chances.inner_slot_saved",
    "inner_slot_shots,_%": "scoring_chances.inner_slot_pct",
    "outer_slot_shots___total": "scoring_chances.outer_slot_total",
    "outer_slot_shots___scored": "scoring_chances.outer_slot_scored",
    "outer_slot_shots___missed": "scoring_chances.outer_slot_missed",
    "outer_slot_shots___saved": "scoring_chances.outer_slot_saved",
    "outer_slot_shots,_%": "scoring_chances.outer_slot_pct",
    "blocked_shots_from_the_slot": "scoring_chances.blocked_from_slot",
    "blocked_shots_outside_of_the_slot": "scoring_chances.blocked_outside_slot",
    # Team-specific extras (only in team exports)
    "team_goals_when_on_ice": "team_extras.team_goals_on_ice",
    "opponent's_goals_when_on_ice": "team_extras.opponent_goals_on_ice",
    "1_on_1_shots": "team_extras.one_on_one_shots",
    "1_on_1_goals": "team_extras.one_on_one_goals",
    "shots_conversion_1_on_1,_%": "team_extras.one_on_one_pct",
    "ev_dz_retrievals": "team_extras.ev_dz_retrievals",
    "ev_oz_retrievals": "team_extras.ev_oz_retrievals",
    "power_play_retrievals": "team_extras.pp_retrievals",
    "penalty_kill_retrievals": "team_extras.pk_retrievals",
}

INSTAT_SKATER_BIO_MAP = {
    "date_of_birth": "dob",
    "nationality": "nationality",
    "height": "height",
    "weight": "weight",
    "active_hand": "shoots",
    "contract": "contract",
    "national_team": "national_team",
}

INSTAT_GOALIE_CORE_MAP = {
    "games_played": "gp",
    "time_on_ice": "toi_seconds",
    "goals_against": "ga",
    "shots_on_goal": "sa",
    "saves": "sv",
    "saves,_%": "sv_pct",
    "penalty_time": "pim",
}

INSTAT_GOALIE_EXTENDED_MAP = {
    "penalties_drawn": "penalties_drawn",
    "passes": "passes_total",
    "accurate_passes": "passes_accurate",
    "accurate_passes,_%": "passes_accurate_pct",
    "xg_conceded": "xg_conceded",
    "xg_per_shot_taken": "xg_per_shot",
    "xg_per_goal_conceded": "xg_per_goal",
    "xg_per_shot_saved": "xg_per_shot_saved",
    "shootouts": "shootouts",
    "shootout_saves": "shootout_saves",
    "shootouts_allowed": "shootouts_allowed",
    "scoring_chances___total": "scoring_chances_total",
    "scoring_chance_saves": "scoring_chance_saves",
    "scoring_chance_saves,_%": "scoring_chance_saves_pct",
    "age": "age",
}

INSTAT_TEAM_EXTENDED_MAP = {
    # Maps ALL team stat columns to extended_stats categories
    # Team stats don't have core columns — everything goes to extended_stats
    "goals": "offense.goals",
    "penalties": "discipline.penalties",
    "penalties_drawn": "discipline.penalties_drawn",
    "penalty_time": "discipline.penalty_time",
    "faceoffs": "faceoffs.total",
    "faceoffs_won": "faceoffs.won",
    "faceoffs_won,_%": "faceoffs.won_pct",
    "faceoffs_lost": "faceoffs.lost",
    "hits": "physical.hits",
    "hits_against": "physical.hits_against",
    "faceoffs_in_dz": "faceoffs.dz_total",
    "faceoffs_won_in_dz": "faceoffs.dz_won",
    "faceoffs_won_in_dz,_%": "faceoffs.dz_pct",
    "faceoffs_in_nz": "faceoffs.nz_total",
    "faceoffs_won_in_nz": "faceoffs.nz_won",
    "faceoffs_won_in_nz,_%": "faceoffs.nz_pct",
    "faceoffs_in_oz": "faceoffs.oz_total",
    "faceoffs_won_in_oz": "faceoffs.oz_won",
    "faceoffs_won_in_oz,_%": "faceoffs.oz_pct",
    "scoring_chances": "offense.scoring_chances",
    "shots": "shots.total",
    "shots_on_goal": "shots.on_goal",
    "blocked_shots": "shots.blocked",
    "missed_shots": "shots.missed",
    "%_shots_on_goal": "shots.on_goal_pct",
    "slapshot": "shots.slapshot",
    "wrist_shot": "shots.wrist_shot",
    "power_play_shots": "shots.pp_shots",
    "short_handed_shots": "shots.sh_shots",
    "shootouts_scored": "shots.shootout_scored",
    "corsi%": "advanced.corsi_pct",
    "power_play": "special_teams.pp_count",
    "successful_power_play": "special_teams.pp_successful",
    "power_play_time": "special_teams.pp_time",
    "power_play,_%": "special_teams.pp_pct",
    "short_handed": "special_teams.sh_count",
    "penalty_killing": "special_teams.pk_count",
    "short_handed_time": "special_teams.sh_time",
    "short_handed,_%": "special_teams.pk_pct",
    "shots_blocking": "defense.shots_blocking",
    "xg_per_shot": "xg.xg_per_shot",
    "opponent's_xg_per_shot": "xg.opponent_xg_per_shot",
    "net_xg_(xg___opponent's_xg)": "xg.net_xg",
    "xg_conversion": "xg.xg_conversion",
    "xg_(expected_goals)": "xg.xg",
    "opponent's_xg": "xg.opponent_xg",
    "xg_per_goal": "xg.xg_per_goal",
    "opponent's_xg_per_goal": "xg.opponent_xg_per_goal",
    "offensive_play": "playtime.offensive",
    "defensive_play": "playtime.defensive",
    "oz_possession": "playtime.oz_possession",
    "nz_possession": "playtime.nz_possession",
    "dz_possession": "playtime.dz_possession",
    "puck_battles": "puck_battles.total",
    "puck_battles_won": "puck_battles.won",
    "puck_battles_won,_%": "puck_battles.won_pct",
    "puck_battles_in_oz": "puck_battles.oz",
    "puck_battles_in_nz": "puck_battles.nz",
    "puck_battles_in_dz": "puck_battles.dz",
    "dekes": "puck_battles.dekes",
    "dekes_successful": "puck_battles.dekes_successful",
    "dekes_unsuccessful": "puck_battles.dekes_unsuccessful",
    "dekes_successful,_%": "puck_battles.dekes_successful_pct",
    "passes_total": "passes.total",
    "accurate_passes": "passes.accurate",
    "accurate_passes,_%": "passes.accurate_pct",
    "pre_shots_passes": "passes.pre_shot",
    "dump_ins": "transition.dump_ins",
    "dump_outs": "transition.dump_outs",
    "passes_to_the_slot": "passes.to_slot",
    "takeaways": "recoveries.takeaways",
    "takeaways_in_nz": "recoveries.takeaways_nz",
    "takeaways_in_dz": "recoveries.takeaways_dz",
    "takeaways_in_oz": "recoveries.takeaways_oz",
    "loose_puck_recovery": "recoveries.loose_puck_recovery",
    "opponent's_dump_in_retrievals": "recoveries.dump_in_retrievals",
    "puck_losses": "recoveries.puck_losses",
    "puck_losses_in_oz": "recoveries.puck_losses_oz",
    "puck_losses_in_nz": "recoveries.puck_losses_nz",
    "puck_losses_in_dz": "recoveries.puck_losses_dz",
    "retrievals": "recoveries.retrievals",
    "power_play_retrievals": "recoveries.pp_retrievals",
    "penalty_kill_retrievals": "recoveries.pk_retrievals",
    "ev_oz_retrievals": "recoveries.ev_oz_retrievals",
    "ev_dz_retrievals": "recoveries.ev_dz_retrievals",
    "entries": "entries.total",
    "entries_via_pass": "entries.via_pass",
    "entries_via_dump_in": "entries.via_dump",
    "entries_via_stickhandling": "entries.via_stickhandling",
    "breakouts": "entries.breakouts_total",
    "breakouts_via_pass": "entries.breakouts_via_pass",
    "breakouts_via_dump_out": "entries.breakouts_via_dump",
    "breakouts_via_stickhandling": "entries.breakouts_via_stickhandling",
    "oz_play": "offense.oz_play",
    "oz_play_with_shots": "offense.oz_play_with_shots",
    "oz_play_with_shots,_%": "offense.oz_play_with_shots_pct",
    "counterattacks": "offense.counterattacks",
    "counter_attack_with_shots": "offense.counterattack_with_shots",
    "counter_attack_with_shots,_%": "offense.counterattack_with_shots_pct",
}

INSTAT_LINES_MAP = {
    "plus/minus": "plus_minus",
    "numbers_of_shifts": "shifts",
    "time_on_ice": "toi_seconds",
    "goals": "goals_for",
    "opponent's_goals": "goals_against",
    "shots": "shots_for",
    "shots_on_goal": "sog_for",
    "opponent_shots_total": "shots_against",
    "shots_on_goal_against": "sog_against",
    "corsi": "corsi",
    "corsi+": "corsi_for",
    "corsi_": "corsi_against",
    "short_handed_play": "sh_play",
    "power_play_played": "pp_played",
    "power_play_time": "pp_time",
    "successful_power_play": "pp_successful",
    "short_handed_time": "sh_time",
}


# ============================================================
# HELPER
# ============================================================

def row_to_dict(row: sqlite3.Row) -> dict:
    """Convert a sqlite3.Row to a plain dict."""
    return dict(row)


def gen_id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_anthropic_client():
    from anthropic import Anthropic
    key = ANTHROPIC_API_KEY
    if not key or key == "your_anthropic_api_key_here":
        return None
    return Anthropic(api_key=key)


# ============================================================
# PYDANTIC MODELS
# ============================================================

# --- Auth ---
class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=8)
    first_name: str
    last_name: str
    org_name: str
    org_type: str = "team"

class UserOut(BaseModel):
    id: str
    org_id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

# --- Players ---
class PlayerCreate(BaseModel):
    first_name: str
    last_name: str
    position: str
    dob: Optional[str] = None
    shoots: Optional[str] = None
    height_cm: Optional[int] = None
    weight_kg: Optional[int] = None
    current_team: Optional[str] = None
    current_league: Optional[str] = None
    passports: Optional[List[str]] = []
    notes: Optional[str] = None
    tags: Optional[List[str]] = []
    archetype: Optional[str] = None
    image_url: Optional[str] = None

class PlayerResponse(BaseModel):
    id: str
    org_id: str
    first_name: str
    last_name: str
    dob: Optional[str] = None
    position: str
    shoots: Optional[str] = None
    height_cm: Optional[int] = None
    weight_kg: Optional[int] = None
    current_team: Optional[str] = None
    current_league: Optional[str] = None
    passports: Optional[List[str]] = []
    notes: Optional[str] = None
    tags: Optional[List[str]] = []
    archetype: Optional[str] = None
    image_url: Optional[str] = None
    birth_year: Optional[int] = None
    age_group: Optional[str] = None
    draft_eligible_year: Optional[int] = None
    league_tier: Optional[str] = None
    created_at: str

# --- Reports ---
class ReportGenerateRequest(BaseModel):
    player_id: Optional[str] = None
    team_name: Optional[str] = None
    report_type: str
    template_id: Optional[str] = None
    data_scope: Optional[Dict[str, Any]] = None

class ReportResponse(BaseModel):
    id: str
    org_id: str
    player_id: Optional[str] = None
    team_name: Optional[str] = None
    report_type: str
    title: Optional[str] = None
    status: str
    output_json: Optional[Dict[str, Any]] = None
    output_text: Optional[str] = None
    error_message: Optional[str] = None
    generated_at: Optional[str] = None
    llm_model: Optional[str] = None
    llm_tokens: Optional[int] = None
    created_at: str

class ReportGenerateResponse(BaseModel):
    report_id: str
    status: str
    title: Optional[str] = None
    generation_time_ms: Optional[int] = None

class ReportStatusResponse(BaseModel):
    report_id: str
    status: str
    error_message: Optional[str] = None
    generation_time_ms: Optional[int] = None

# --- Stats ---
class StatsResponse(BaseModel):
    id: str
    player_id: str
    game_id: Optional[str] = None
    season: Optional[str] = None
    stat_type: str
    gp: int
    g: int
    a: int
    p: int
    plus_minus: int
    pim: int
    toi_seconds: int
    pp_toi_seconds: int
    pk_toi_seconds: int
    shots: int
    sog: int
    shooting_pct: Optional[float] = None
    microstats: Optional[Dict[str, Any]] = None
    created_at: str

# --- Scout Notes ---
class NoteCreate(BaseModel):
    note_text: str = Field(..., min_length=1)
    note_type: str = "general"  # game, practice, interview, general
    tags: Optional[List[str]] = []
    is_private: bool = False

class NoteUpdate(BaseModel):
    note_text: Optional[str] = None
    note_type: Optional[str] = None
    tags: Optional[List[str]] = None
    is_private: Optional[bool] = None

class NoteResponse(BaseModel):
    id: str
    org_id: str
    player_id: str
    scout_id: str
    scout_name: Optional[str] = None
    note_text: str
    note_type: str
    tags: List[str]
    is_private: bool
    created_at: str
    updated_at: str

# --- Batch Import ---
class ImportDuplicate(BaseModel):
    row_index: int
    csv_name: str
    existing_id: str
    existing_name: str
    match_score: float
    match_reasons: List[str]

class ImportPreviewResponse(BaseModel):
    job_id: str
    filename: str
    total_rows: int
    new_players: int
    duplicates: List[ImportDuplicate]
    errors: List[str]
    preview: List[dict]

class DuplicateResolution(BaseModel):
    row_index: int
    action: str  # "create_new", "skip", "merge"

class ImportExecuteRequest(BaseModel):
    resolutions: List[DuplicateResolution] = []

# --- Templates ---
class TemplateResponse(BaseModel):
    id: str
    template_name: str
    report_type: str
    description: str = ""
    is_global: bool
    version: int
    created_at: str


# ============================================================
# AUTH UTILITIES
# ============================================================

def create_token(user_id: str, org_id: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "org_id": org_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ============================================================
# AUTH ENDPOINTS
# ============================================================

@app.post("/auth/register", response_model=TokenResponse)
async def register(req: RegisterRequest):
    conn = get_db()
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (req.email.lower().strip(),)).fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=400, detail="Email already registered")

    org_id = gen_id()
    user_id = gen_id()
    password_hash = pwd_context.hash(req.password)

    conn.execute(
        "INSERT INTO organizations (id, name, org_type) VALUES (?, ?, ?)",
        (org_id, req.org_name, req.org_type),
    )
    conn.execute(
        "INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (user_id, org_id, req.email.lower().strip(), password_hash, req.first_name, req.last_name, "admin"),
    )
    conn.commit()

    user = UserOut(id=user_id, org_id=org_id, email=req.email.lower().strip(), first_name=req.first_name, last_name=req.last_name, role="admin")
    token = create_token(user_id, org_id, "admin")
    conn.close()

    logger.info("User registered: %s (org: %s)", req.email, req.org_name)
    return TokenResponse(access_token=token, user=user)


@app.post("/auth/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE email = ?", (req.email.lower().strip(),)).fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not pwd_context.verify(req.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user = UserOut(
        id=row["id"], org_id=row["org_id"], email=row["email"],
        first_name=row["first_name"], last_name=row["last_name"], role=row["role"],
    )
    token = create_token(row["id"], row["org_id"], row["role"])
    logger.info("User logged in: %s", req.email)
    return TokenResponse(access_token=token, user=user)


@app.get("/auth/me", response_model=UserOut)
async def get_me(token_data: dict = Depends(verify_token)):
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (token_data["user_id"],)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut(
        id=row["id"], org_id=row["org_id"], email=row["email"],
        first_name=row["first_name"], last_name=row["last_name"], role=row["role"],
    )


# ============================================================
# PLAYER ENDPOINTS
# ============================================================

def _player_from_row(row: sqlite3.Row) -> dict:
    d = dict(row)
    # Parse JSON list fields
    for field in ("passports", "tags"):
        val = d.get(field)
        if isinstance(val, str):
            try:
                d[field] = json.loads(val)
            except Exception:
                d[field] = []
        elif val is None:
            d[field] = []
    return d


# ── Player Intelligence Engine ─────────────────────────────────────────────


def _compute_stat_signature(player: dict, stats: list, goalie_stats: list, extended_stats_list: list) -> tuple:
    """Rule-based stat classifier. Fast, deterministic, no LLM needed.
    Returns (stat_signature dict, auto_tags list)."""
    sig = {}
    tags = set()

    position = (player.get("position") or "").upper()
    is_goalie = position in ("G", "GK", "GOALIE")

    if is_goalie and goalie_stats:
        # Goalie classification
        latest = goalie_stats[0]  # most recent
        gp = latest.get("gp") or 0
        sv_pct_str = latest.get("sv_pct") or ""
        gaa = latest.get("gaa") or 0

        # Parse sv_pct (might be string like ".920" or "0.920" or "92.0")
        try:
            sv_pct = float(sv_pct_str) if sv_pct_str else 0
            if sv_pct > 1:
                sv_pct = sv_pct / 100.0
        except (ValueError, TypeError):
            sv_pct = 0

        if gp >= 5:
            if sv_pct >= 0.930:
                sig["save_pct_tier"] = "Elite"
                tags.add("positioning")
            elif sv_pct >= 0.910:
                sig["save_pct_tier"] = "Strong"
            elif sv_pct >= 0.890:
                sig["save_pct_tier"] = "Average"
            else:
                sig["save_pct_tier"] = "Developing"

            if gaa <= 2.0:
                sig["goals_against_tier"] = "Elite"
            elif gaa <= 2.75:
                sig["goals_against_tier"] = "Strong"
            elif gaa <= 3.5:
                sig["goals_against_tier"] = "Average"
            else:
                sig["goals_against_tier"] = "Developing"

        # Check extended goalie stats
        if latest.get("extended_stats"):
            try:
                ext = json.loads(latest["extended_stats"]) if isinstance(latest["extended_stats"], str) else latest["extended_stats"]
                if ext:
                    tags.add("compete")
            except (json.JSONDecodeError, TypeError):
                pass

        return sig, list(tags)

    # Skater classification
    if not stats:
        return sig, list(tags)

    # Aggregate across all stat rows (use latest season or total)
    total_gp = 0
    total_g = 0
    total_a = 0
    total_p = 0
    total_pim = 0
    total_plus_minus = 0
    total_shots = 0

    for s in stats:
        gp = s.get("gp") or 0
        total_gp += gp
        total_g += s.get("g") or 0
        total_a += s.get("a") or 0
        total_p += s.get("p") or 0
        total_pim += s.get("pim") or 0
        total_plus_minus += s.get("plus_minus") or 0
        total_shots += s.get("shots") or s.get("sog") or 0

    if total_gp == 0:
        return sig, list(tags)

    ppg = total_p / total_gp
    gpg = total_g / total_gp
    apg = total_a / total_gp
    pim_pg = total_pim / total_gp

    # Production tier
    if ppg > 1.0:
        sig["production_tier"] = "Elite"
        tags.update(["shooting", "vision"])
    elif ppg > 0.7:
        sig["production_tier"] = "High"
        tags.add("puck_skills")
    elif ppg > 0.4:
        sig["production_tier"] = "Moderate"
    else:
        sig["production_tier"] = "Developing"

    # Goal-scoring profile
    if gpg > 0.4:
        sig["scoring_profile"] = "Sniper"
        tags.add("shooting")
    elif gpg > 0.25:
        sig["scoring_profile"] = "Scorer"
        tags.add("shooting")
    elif total_g > 0 and total_a > 1.5 * total_g:
        sig["scoring_profile"] = "Playmaker"
        tags.update(["vision", "puck_skills"])
    else:
        sig["scoring_profile"] = "Balanced"

    # Defensive reliability
    pm_per_game = total_plus_minus / total_gp
    if pm_per_game > 0.5:
        sig["defensive_reliability"] = "Elite"
        tags.add("positioning")
    elif total_plus_minus > 0:
        sig["defensive_reliability"] = "Reliable"
    elif total_plus_minus == 0:
        sig["defensive_reliability"] = "Neutral"
    else:
        sig["defensive_reliability"] = "Developing"

    # Discipline
    if pim_pg < 0.5:
        sig["discipline"] = "Clean"
    elif pim_pg < 1.5:
        sig["discipline"] = "Moderate"
    else:
        sig["discipline"] = "Physical"
        tags.add("physicality")

    # Shooting efficiency
    if total_shots > 0:
        sh_pct = total_g / total_shots * 100
        if sh_pct > 15:
            sig["shooting_efficiency"] = "Elite"
            tags.add("shooting")
        elif sh_pct > 10:
            sig["shooting_efficiency"] = "Above Average"
        elif sh_pct > 5:
            sig["shooting_efficiency"] = "Average"
        else:
            sig["shooting_efficiency"] = "Below Average"

    # ── Extended stats analysis (InStat analytics) ──
    for ext_row in extended_stats_list:
        try:
            ext = json.loads(ext_row) if isinstance(ext_row, str) else ext_row
            if not ext or not isinstance(ext, dict):
                continue
        except (json.JSONDecodeError, TypeError):
            continue

        # xG finishing (check multiple possible locations)
        xg_data = ext.get("xg") or ext.get("advanced") or {}
        xg_val = xg_data.get("xG") or xg_data.get("xg") or 0
        if xg_val and total_g > 0:
            try:
                xg_float = float(xg_val)
                if xg_float > 0:
                    ratio = total_g / xg_float
                    if ratio > 1.15:
                        sig["finishing"] = "Over-performer"
                        tags.add("shooting")
                    elif ratio > 0.85:
                        sig["finishing"] = "Expected"
                    else:
                        sig["finishing"] = "Under-performer"
            except (ValueError, TypeError):
                pass

        # Possession (CORSI / possession %)
        poss_data = ext.get("main") or ext.get("advanced") or {}
        cf_pct = poss_data.get("CF%") or poss_data.get("cf_pct") or poss_data.get("Possession, %") or 0
        try:
            cf_float = float(cf_pct)
            if cf_float > 0:
                if cf_float > 55:
                    sig["possession_impact"] = "Driver"
                    tags.update(["hockey_iq", "puck_skills"])
                elif cf_float > 50:
                    sig["possession_impact"] = "Positive"
                elif cf_float > 45:
                    sig["possession_impact"] = "Neutral"
                else:
                    sig["possession_impact"] = "Passenger"
        except (ValueError, TypeError):
            pass

        # Puck battles
        battles_data = ext.get("puck_battles") or ext.get("duels") or {}
        battle_won = battles_data.get("Won") or battles_data.get("won") or 0
        battle_total = battles_data.get("Total") or battles_data.get("total") or 0
        try:
            b_won = float(battle_won)
            b_total = float(battle_total)
            if b_total > 0:
                win_pct = (b_won / b_total) * 100
                if win_pct > 55:
                    sig["physical_engagement"] = "Battle Winner"
                    tags.update(["physicality", "compete"])
                elif win_pct > 45:
                    sig["physical_engagement"] = "Competitive"
                    tags.add("compete")
                else:
                    sig["physical_engagement"] = "Avoid Contact"
        except (ValueError, TypeError):
            pass

        # Faceoffs
        fo_data = ext.get("faceoffs") or ext.get("main") or {}
        fo_won = fo_data.get("FO Won") or fo_data.get("fo_won") or 0
        fo_total = fo_data.get("FO Total") or fo_data.get("fo_total") or fo_data.get("Faceoffs") or 0
        try:
            fw = float(fo_won)
            ft = float(fo_total)
            if ft > 0:
                fo_pct = (fw / ft) * 100
                if fo_pct > 55:
                    sig["faceoff_ability"] = "Elite"
                    tags.add("hockey_iq")
                elif fo_pct > 50:
                    sig["faceoff_ability"] = "Strong"
                else:
                    sig["faceoff_ability"] = "Developing"
        except (ValueError, TypeError):
            pass

        break  # Use first valid extended stats row

    # Position-based tag hints
    if position in ("D", "LD", "RD"):
        if sig.get("defensive_reliability") in ("Elite", "Reliable"):
            tags.add("positioning")
        if ppg > 0.5:
            tags.add("puck_skills")  # offensive D
    elif position in ("C",):
        if sig.get("faceoff_ability") in ("Elite", "Strong"):
            tags.add("hockey_iq")

    return sig, list(tags)


async def _generate_player_intelligence(player_id: str, org_id: str, trigger: str = "manual") -> Optional[dict]:
    """Generate or refresh a player's AI intelligence profile.
    Uses Claude Haiku for fast, cheap structured JSON output."""
    conn = get_db()
    try:
        # 1. Get player
        player_row = conn.execute("SELECT * FROM players WHERE id = ? AND org_id = ?", (player_id, org_id)).fetchone()
        if not player_row:
            return None
        player = _player_from_row(player_row)

        # 2. Get stats
        stats_rows = conn.execute(
            "SELECT * FROM player_stats WHERE player_id = ? ORDER BY season DESC", (player_id,)
        ).fetchall()
        stats = [dict(r) for r in stats_rows]

        # 3. Get goalie stats
        goalie_rows = conn.execute(
            "SELECT * FROM goalie_stats WHERE player_id = ? ORDER BY season DESC", (player_id,)
        ).fetchall()
        goalie_stats = [dict(r) for r in goalie_rows]

        # 4. Get extended stats
        extended_stats_list = []
        for s in stats:
            if s.get("extended_stats"):
                extended_stats_list.append(s["extended_stats"])
        for g in goalie_stats:
            if g.get("extended_stats"):
                extended_stats_list.append(g["extended_stats"])

        # 5. Compute stat signature (rule-based, instant)
        stat_sig, auto_tags = _compute_stat_signature(player, stats, goalie_stats, extended_stats_list)

        # 6. Get scout notes (last 10)
        notes_rows = conn.execute(
            "SELECT note_text, note_type, tags, created_at FROM scout_notes WHERE player_id = ? ORDER BY created_at DESC LIMIT 10",
            (player_id,)
        ).fetchall()
        notes = [dict(n) for n in notes_rows]

        # 7. Get previous intelligence snapshot (for continuity)
        prev_intel = conn.execute(
            "SELECT * FROM player_intelligence WHERE player_id = ? AND org_id = ? ORDER BY version DESC LIMIT 1",
            (player_id, org_id)
        ).fetchone()
        prev_version = dict(prev_intel)["version"] if prev_intel else 0

        # 8. Get latest report summary
        latest_report = conn.execute(
            "SELECT output_text, report_type, generated_at FROM reports WHERE player_id = ? AND status = 'complete' ORDER BY generated_at DESC LIMIT 1",
            (player_id,)
        ).fetchone()

        # 9. Build context for LLM
        # Pre-compute age
        age_str = "Unknown"
        if player.get("dob"):
            try:
                dob_str = player["dob"][:10]
                birth = datetime.strptime(dob_str, "%Y-%m-%d").date()
                today = datetime.now().date()
                age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
                age_str = str(age)
            except Exception:
                pass

        bio_section = f"""PLAYER BIO:
Name: {player.get('first_name', '')} {player.get('last_name', '')}
Position: {player.get('position', 'Unknown')}
Age: {age_str}
DOB: {player.get('dob', 'Unknown')}
Height: {player.get('height_cm', 'N/A')} cm
Weight: {player.get('weight_kg', 'N/A')} kg
Shoots: {player.get('shoots', 'Unknown')}
Team: {player.get('current_team', 'Unknown')}
League: {player.get('current_league', 'Unknown')}"""

        stats_section = ""
        if stats:
            stats_section = "\n\nSTATISTICS:\n"
            for s in stats[:3]:  # Last 3 seasons max
                season = s.get("season", "Unknown")
                stats_section += f"Season {season}: {s.get('gp',0)} GP, {s.get('g',0)}G-{s.get('a',0)}A—{s.get('p',0)}P, +/- {s.get('plus_minus',0)}, {s.get('pim',0)} PIM"
                if s.get("shots"):
                    stats_section += f", {s.get('shots',0)} SOG"
                if s.get("shooting_pct"):
                    stats_section += f", {s.get('shooting_pct',0)}% SH%"
                stats_section += "\n"

        if goalie_stats:
            stats_section += "\nGOALIE STATISTICS:\n"
            for g in goalie_stats[:3]:
                season = g.get("season", "Unknown")
                stats_section += f"Season {season}: {g.get('gp',0)} GP, {g.get('gaa','N/A')} GAA, {g.get('sv_pct','N/A')} SV%, {g.get('ga',0)} GA, {g.get('sa',0)} SA\n"

        sig_section = ""
        if stat_sig:
            sig_section = "\n\nSTAT SIGNATURE (rule-based analysis):\n"
            for k, v in stat_sig.items():
                sig_section += f"- {k.replace('_', ' ').title()}: {v}\n"

        notes_section = ""
        if notes:
            notes_section = "\n\nSCOUT NOTES (most recent first):\n"
            for n in notes[:5]:  # Cap at 5 for prompt size
                notes_section += f"- [{n.get('note_type','general')}] {n.get('note_text','')[:300]}\n"

        report_section = ""
        if latest_report:
            report_text = dict(latest_report).get("output_text", "")
            if report_text:
                # Extract key sections (first 800 chars)
                report_section = f"\n\nLATEST REPORT EXCERPT:\n{report_text[:800]}..."

        prev_section = ""
        if prev_intel:
            pi = dict(prev_intel)
            prev_section = f"\n\nPREVIOUS INTELLIGENCE (v{pi.get('version',0)}):\nArchetype: {pi.get('archetype','N/A')}\nOverall Grade: {pi.get('overall_grade','N/A')}\nSummary: {(pi.get('summary','N/A') or 'N/A')[:300]}"

        full_context = bio_section + stats_section + sig_section + notes_section + report_section + prev_section

        # 10. Call Claude Haiku for intelligence
        client = get_anthropic_client()
        if not client:
            # No API key — store stat signature only
            intel_id = str(uuid.uuid4())
            now = datetime.now().isoformat()
            conn.execute("""
                INSERT INTO player_intelligence (id, player_id, org_id, stat_signature, tags, trigger, version, data_sources_used, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (intel_id, player_id, org_id, json.dumps(stat_sig), json.dumps(auto_tags), trigger, prev_version + 1,
                  json.dumps({"stats": len(stats), "goalie_stats": len(goalie_stats), "notes": len(notes), "reports": 1 if latest_report else 0}), now))
            conn.execute("UPDATE players SET tags = ?, intelligence_version = ? WHERE id = ?",
                         (json.dumps(auto_tags), prev_version + 1, player_id))
            conn.commit()
            return {"id": intel_id, "stat_signature": stat_sig, "tags": auto_tags, "version": prev_version + 1}

        system_prompt = """You are ProspectX Intelligence — an elite hockey scouting AI that produces structured player intelligence profiles.

Given a player's bio, statistics, stat signature, scout notes, and any previous intelligence, produce a JSON object with your assessment.

RULES:
- Return ONLY valid JSON — no markdown, no explanation, no code fences
- Grade scale: A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-, NR (Not Rated — use when insufficient data)
- Archetype should be a compound descriptor like "Two-Way Playmaking Center" or "Power Forward" or "Offensive Defenseman"
- archetype_confidence is 0.0 to 1.0 (higher = more data available)
- strengths and development_areas: 3-5 items each, specific to hockey skills
- comparable_players: 1-2 NHL/pro comparisons that match the player's style (be realistic, these are junior players)
- projection: 1-2 sentences about ceiling/floor at next level
- tags must be from: skating, shooting, compete, hockey_iq, puck_skills, positioning, physicality, speed, vision, leadership, coachability, work_ethic
- summary: 2-3 sentence scouting summary, professional tone
- If data is very limited, be conservative with grades (use NR liberally) but still provide archetype/summary based on what's available

JSON SCHEMA:
{
  "archetype": string,
  "archetype_confidence": number,
  "overall_grade": string,
  "offensive_grade": string,
  "defensive_grade": string,
  "skating_grade": string,
  "hockey_iq_grade": string,
  "compete_grade": string,
  "summary": string,
  "strengths": [string],
  "development_areas": [string],
  "comparable_players": [string],
  "projection": string,
  "tags": [string]
}"""

        try:
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1000,
                system=system_prompt,
                messages=[{"role": "user", "content": f"Generate an intelligence profile for this player:\n\n{full_context}"}]
            )

            raw_text = response.content[0].text.strip()
            # Strip code fences if present
            if raw_text.startswith("```"):
                raw_text = re.sub(r"^```(?:json)?\s*\n?", "", raw_text)
                raw_text = re.sub(r"\n?```\s*$", "", raw_text)

            intel_data = json.loads(raw_text)
        except json.JSONDecodeError as e:
            logger.error("Intelligence JSON parse error for player %s: %s", player_id, str(e))
            # Fall back to stat signature only
            intel_data = {}
        except Exception as e:
            logger.error("Intelligence LLM call failed for player %s: %s", player_id, str(e))
            intel_data = {}

        # 11. Merge LLM results with stat signature
        archetype = intel_data.get("archetype") or player.get("archetype")
        archetype_confidence = intel_data.get("archetype_confidence", 0.5)
        overall_grade = intel_data.get("overall_grade", "NR")
        offensive_grade = intel_data.get("offensive_grade", "NR")
        defensive_grade = intel_data.get("defensive_grade", "NR")
        skating_grade = intel_data.get("skating_grade", "NR")
        hockey_iq_grade = intel_data.get("hockey_iq_grade", "NR")
        compete_grade = intel_data.get("compete_grade", "NR")
        summary = intel_data.get("summary", "")
        strengths = intel_data.get("strengths", [])
        dev_areas = intel_data.get("development_areas", [])
        comparables = intel_data.get("comparable_players", [])
        projection = intel_data.get("projection", "")
        llm_tags = intel_data.get("tags", [])

        # Merge LLM tags with rule-based auto_tags
        all_tags = list(set(auto_tags + llm_tags))
        # Filter to valid tags only
        valid_tags = {"skating", "shooting", "compete", "hockey_iq", "puck_skills", "positioning",
                      "physicality", "speed", "vision", "leadership", "coachability", "work_ethic"}
        all_tags = [t for t in all_tags if t in valid_tags]

        # 12. Store intelligence
        intel_id = str(uuid.uuid4())
        new_version = prev_version + 1
        now = datetime.now().isoformat()
        data_sources = {
            "stats": len(stats),
            "goalie_stats": len(goalie_stats),
            "notes": len(notes),
            "reports": 1 if latest_report else 0,
            "extended_stats": len(extended_stats_list)
        }

        conn.execute("""
            INSERT INTO player_intelligence
            (id, player_id, org_id, archetype, archetype_confidence, overall_grade, offensive_grade, defensive_grade,
             skating_grade, hockey_iq_grade, compete_grade, summary, strengths, development_areas, comparable_players,
             stat_signature, tags, projection, data_sources_used, trigger, version, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (intel_id, player_id, org_id, archetype, archetype_confidence, overall_grade, offensive_grade,
              defensive_grade, skating_grade, hockey_iq_grade, compete_grade, summary,
              json.dumps(strengths), json.dumps(dev_areas), json.dumps(comparables),
              json.dumps(stat_sig), json.dumps(all_tags), projection, json.dumps(data_sources),
              trigger, new_version, now))

        # 13. Write back to players table
        conn.execute("UPDATE players SET archetype = ?, tags = ?, intelligence_version = ? WHERE id = ?",
                     (archetype, json.dumps(all_tags), new_version, player_id))
        conn.commit()

        logger.info("Intelligence v%d generated for player %s (trigger=%s)", new_version, player_id, trigger)

        return {
            "id": intel_id,
            "player_id": player_id,
            "archetype": archetype,
            "archetype_confidence": archetype_confidence,
            "overall_grade": overall_grade,
            "offensive_grade": offensive_grade,
            "defensive_grade": defensive_grade,
            "skating_grade": skating_grade,
            "hockey_iq_grade": hockey_iq_grade,
            "compete_grade": compete_grade,
            "summary": summary,
            "strengths": strengths,
            "development_areas": dev_areas,
            "comparable_players": comparables,
            "stat_signature": stat_sig,
            "tags": all_tags,
            "projection": projection,
            "trigger": trigger,
            "version": new_version,
            "created_at": now,
        }
    except Exception as e:
        logger.error("Intelligence generation failed for player %s: %s", player_id, str(e))
        return None
    finally:
        conn.close()


async def _extract_report_intelligence(report_id: str, player_id: str, org_id: str):
    """Parse a completed report to extract insights, then refresh player intelligence."""
    conn = get_db()
    try:
        report = conn.execute("SELECT output_text FROM reports WHERE id = ?", (report_id,)).fetchone()
        if not report:
            return
        text = dict(report).get("output_text", "") or ""
        if not text:
            return

        # Extract key data from report text using regex
        extracted = {}

        # Overall Grade
        grade_match = re.search(r"Overall\s*Grade[:\s]*([A-D][+-]?)", text, re.IGNORECASE)
        if grade_match:
            extracted["overall_grade"] = grade_match.group(1)

        # System Fit
        fit_match = re.search(r"(Elite Fit|Strong Fit|Developing Fit|Adjustment Needed)", text, re.IGNORECASE)
        if fit_match:
            extracted["system_fit"] = fit_match.group(1)

        # Archetype mentions
        arch_match = re.search(r"(?:profiles?|projects?|presents?|plays?)\s+as\s+(?:a|an)\s+(.+?)(?:\.|,|\n)", text, re.IGNORECASE)
        if arch_match:
            extracted["archetype_hint"] = arch_match.group(1).strip()[:80]

        logger.info("Report %s intelligence extracted: %s", report_id, list(extracted.keys()))
    except Exception as e:
        logger.error("Report intelligence extraction failed for %s: %s", report_id, str(e))
    finally:
        conn.close()

    # Now refresh player intelligence with the new report context
    try:
        await _generate_player_intelligence(player_id, org_id, trigger="report")
    except Exception as e:
        logger.error("Post-report intelligence refresh failed for %s: %s", player_id, str(e))


@app.get("/players/filter-options")
async def get_player_filter_options(token_data: dict = Depends(verify_token)):
    """Return unique values for all filter dimensions (for populating dropdowns)."""
    org_id = token_data["org_id"]
    conn = get_db()
    result = {}
    # Unique leagues
    rows = conn.execute("SELECT DISTINCT current_league FROM players WHERE org_id = ? AND current_league IS NOT NULL AND current_league != '' ORDER BY current_league", (org_id,)).fetchall()
    result["leagues"] = [r[0] for r in rows]
    # Unique teams
    rows = conn.execute("SELECT DISTINCT current_team FROM players WHERE org_id = ? AND current_team IS NOT NULL AND current_team != '' ORDER BY current_team", (org_id,)).fetchall()
    result["teams"] = [r[0] for r in rows]
    # Unique birth years
    rows = conn.execute("SELECT DISTINCT birth_year FROM players WHERE org_id = ? AND birth_year IS NOT NULL ORDER BY birth_year DESC", (org_id,)).fetchall()
    result["birth_years"] = [r[0] for r in rows]
    # Unique age groups
    rows = conn.execute("SELECT DISTINCT age_group FROM players WHERE org_id = ? AND age_group IS NOT NULL ORDER BY age_group", (org_id,)).fetchall()
    result["age_groups"] = [r[0] for r in rows]
    # Unique league tiers
    rows = conn.execute("SELECT DISTINCT league_tier FROM players WHERE org_id = ? AND league_tier IS NOT NULL AND league_tier != 'Unknown' ORDER BY league_tier", (org_id,)).fetchall()
    result["league_tiers"] = [r[0] for r in rows]
    # Unique positions
    rows = conn.execute("SELECT DISTINCT position FROM players WHERE org_id = ? AND position IS NOT NULL ORDER BY position", (org_id,)).fetchall()
    result["positions"] = [r[0] for r in rows]
    # Unique draft eligible years
    rows = conn.execute("SELECT DISTINCT draft_eligible_year FROM players WHERE org_id = ? AND draft_eligible_year IS NOT NULL ORDER BY draft_eligible_year DESC", (org_id,)).fetchall()
    result["draft_years"] = [r[0] for r in rows]

    conn.close()
    return result


@app.get("/players", response_model=List[PlayerResponse])
async def list_players(
    search: Optional[str] = None,
    position: Optional[str] = None,
    team: Optional[str] = None,
    league: Optional[str] = None,
    birth_year: Optional[int] = None,
    age_group: Optional[str] = None,
    league_tier: Optional[str] = None,
    draft_year: Optional[int] = None,
    limit: int = Query(default=200, ge=1, le=500),
    skip: int = Query(default=0, ge=0),
    token_data: dict = Depends(verify_token),
):
    org_id = token_data["org_id"]
    conn = get_db()

    query = "SELECT * FROM players WHERE org_id = ?"
    params: list = [org_id]

    if search:
        query += " AND (first_name LIKE ? OR last_name LIKE ? OR current_team LIKE ?)"
        s = f"%{search}%"
        params.extend([s, s, s])

    if position:
        query += " AND position = ?"
        params.append(position.upper())

    if team:
        query += " AND LOWER(current_team) = LOWER(?)"
        params.append(team)

    if league:
        query += " AND LOWER(current_league) = LOWER(?)"
        params.append(league)

    if birth_year:
        query += " AND birth_year = ?"
        params.append(birth_year)

    if age_group:
        query += " AND age_group = ?"
        params.append(age_group)

    if league_tier:
        query += " AND league_tier = ?"
        params.append(league_tier)

    if draft_year:
        query += " AND draft_eligible_year = ?"
        params.append(draft_year)

    query += " ORDER BY last_name, first_name LIMIT ? OFFSET ?"
    params.extend([limit, skip])

    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [PlayerResponse(**_player_from_row(r)) for r in rows]


@app.post("/players", response_model=PlayerResponse, status_code=201)
async def create_player(player: PlayerCreate, token_data: dict = Depends(verify_token)):
    org_id = token_data["org_id"]
    player_id = gen_id()
    now = now_iso()
    conn = get_db()

    # Derive compartmentalization fields
    birth_year = None
    age_group = None
    draft_eligible_year = None
    if player.dob:
        try:
            birth_year = int(player.dob[:4])
            age_group = _get_age_group(birth_year)
            draft_eligible_year = birth_year + 18
        except (ValueError, IndexError):
            pass
    league_tier = _get_league_tier(player.current_league)

    conn.execute("""
        INSERT INTO players (id, org_id, first_name, last_name, dob, position, shoots, height_cm, weight_kg,
                             current_team, current_league, passports, notes, tags, archetype, image_url,
                             birth_year, age_group, draft_eligible_year, league_tier,
                             created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        player_id, org_id, player.first_name, player.last_name, player.dob,
        player.position.upper(), player.shoots, player.height_cm, player.weight_kg,
        player.current_team, player.current_league,
        json.dumps(player.passports or []), player.notes, json.dumps(player.tags or []),
        player.archetype, player.image_url,
        birth_year, age_group, draft_eligible_year, league_tier,
        now, now,
    ))
    conn.commit()

    row = conn.execute("SELECT * FROM players WHERE id = ?", (player_id,)).fetchone()
    conn.close()
    logger.info("Player created: %s %s (org %s)", player.first_name, player.last_name, org_id)
    return PlayerResponse(**_player_from_row(row))


@app.get("/players/{player_id}", response_model=PlayerResponse)
async def get_player(player_id: str, token_data: dict = Depends(verify_token)):
    org_id = token_data["org_id"]
    conn = get_db()
    row = conn.execute("SELECT * FROM players WHERE id = ? AND org_id = ?", (player_id, org_id)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Player not found")
    return PlayerResponse(**_player_from_row(row))


@app.put("/players/{player_id}", response_model=PlayerResponse)
async def update_player(player_id: str, player: PlayerCreate, token_data: dict = Depends(verify_token)):
    org_id = token_data["org_id"]
    conn = get_db()
    existing = conn.execute("SELECT id FROM players WHERE id = ? AND org_id = ?", (player_id, org_id)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Player not found")

    # Derive compartmentalization fields
    birth_year = None
    age_group = None
    draft_eligible_year = None
    if player.dob:
        try:
            birth_year = int(player.dob[:4])
            age_group = _get_age_group(birth_year)
            draft_eligible_year = birth_year + 18
        except (ValueError, IndexError):
            pass
    league_tier = _get_league_tier(player.current_league)

    conn.execute("""
        UPDATE players SET first_name=?, last_name=?, dob=?, position=?, shoots=?, height_cm=?, weight_kg=?,
                          current_team=?, current_league=?, passports=?, notes=?, tags=?, archetype=?, image_url=?,
                          birth_year=?, age_group=?, draft_eligible_year=?, league_tier=?, updated_at=?
        WHERE id = ? AND org_id = ?
    """, (
        player.first_name, player.last_name, player.dob, player.position.upper(), player.shoots,
        player.height_cm, player.weight_kg, player.current_team, player.current_league,
        json.dumps(player.passports or []), player.notes, json.dumps(player.tags or []),
        player.archetype, player.image_url,
        birth_year, age_group, draft_eligible_year, league_tier,
        now_iso(), player_id, org_id,
    ))
    conn.commit()
    row = conn.execute("SELECT * FROM players WHERE id = ?", (player_id,)).fetchone()
    conn.close()
    return PlayerResponse(**_player_from_row(row))


@app.delete("/players/{player_id}")
async def delete_player(player_id: str, token_data: dict = Depends(verify_token)):
    org_id = token_data["org_id"]
    conn = get_db()
    result = conn.execute("DELETE FROM players WHERE id = ? AND org_id = ?", (player_id, org_id))
    conn.commit()
    conn.close()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Player not found")
    return {"detail": "Player deleted"}


# ── Player Image Upload ────────────────────────────────────
@app.post("/players/{player_id}/image")
async def upload_player_image(
    player_id: str,
    file: UploadFile = File(...),
    token_data: dict = Depends(verify_token),
):
    org_id = token_data["org_id"]
    conn = get_db()
    row = conn.execute("SELECT id FROM players WHERE id = ? AND org_id = ?", (player_id, org_id)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Player not found")

    # Validate file type
    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed_types:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Invalid image type. Allowed: JPEG, PNG, WebP, GIF")

    # Generate a unique filename
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "jpg"
    if ext not in ("jpg", "jpeg", "png", "webp", "gif"):
        ext = "jpg"
    filename = f"{player_id}.{ext}"
    filepath = os.path.join(_IMAGES_DIR, filename)

    # Remove any existing image for this player (different extension)
    for old_ext in ("jpg", "jpeg", "png", "webp", "gif"):
        old_path = os.path.join(_IMAGES_DIR, f"{player_id}.{old_ext}")
        if os.path.exists(old_path) and old_path != filepath:
            os.remove(old_path)

    # Save the file
    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)

    # Update the player record with the image URL
    image_url = f"/uploads/{filename}"
    conn.execute(
        "UPDATE players SET image_url = ?, updated_at = ? WHERE id = ? AND org_id = ?",
        (image_url, now_iso(), player_id, org_id),
    )
    conn.commit()
    conn.close()

    logger.info("Player image uploaded: %s → %s", player_id, filename)
    return {"image_url": image_url}


@app.delete("/players/{player_id}/image")
async def delete_player_image(
    player_id: str,
    token_data: dict = Depends(verify_token),
):
    org_id = token_data["org_id"]
    conn = get_db()
    row = conn.execute("SELECT id, image_url FROM players WHERE id = ? AND org_id = ?", (player_id, org_id)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Player not found")

    # Delete the file from disk
    for ext in ("jpg", "jpeg", "png", "webp", "gif"):
        fpath = os.path.join(_IMAGES_DIR, f"{player_id}.{ext}")
        if os.path.exists(fpath):
            os.remove(fpath)

    conn.execute(
        "UPDATE players SET image_url = NULL, updated_at = ? WHERE id = ? AND org_id = ?",
        (now_iso(), player_id, org_id),
    )
    conn.commit()
    conn.close()
    return {"detail": "Image deleted"}


@app.post("/teams/{team_id}/logo")
async def upload_team_logo(team_id: str, file: UploadFile = File(...), token_data: dict = Depends(verify_token)):
    """Upload team logo image."""
    conn = get_db()
    team = conn.execute("SELECT * FROM teams WHERE id = ?", (team_id,)).fetchone()
    if not team:
        conn.close()
        raise HTTPException(status_code=404, detail="Team not found")

    fname = (file.filename or "logo.png").lower()
    ext = fname.rsplit(".", 1)[-1] if "." in fname else "png"
    if ext not in ("jpg", "jpeg", "png", "gif", "webp", "svg"):
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid image type")

    filename = f"team_{team_id}.{ext}"
    filepath = os.path.join(_IMAGES_DIR, filename)
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    logo_url = f"/uploads/{filename}"
    conn.execute("UPDATE teams SET logo_url = ? WHERE id = ?", (logo_url, team_id))
    conn.commit()
    conn.close()

    return {"logo_url": logo_url}


# ============================================================
# STATS ENDPOINTS
# ============================================================

@app.get("/stats/player/{player_id}", response_model=List[StatsResponse])
async def get_player_stats(player_id: str, token_data: dict = Depends(verify_token)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM player_stats WHERE player_id = ? ORDER BY created_at DESC",
        (player_id,)
    ).fetchall()
    conn.close()

    results = []
    for r in rows:
        d = dict(r)
        if d.get("microstats") and isinstance(d["microstats"], str):
            try:
                d["microstats"] = json.loads(d["microstats"])
            except Exception:
                d["microstats"] = None
        results.append(StatsResponse(**d))
    return results


@app.get("/stats/goalie/{player_id}")
async def get_goalie_stats(player_id: str, token_data: dict = Depends(verify_token)):
    """Get goalie stats for a player."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM goalie_stats WHERE player_id = ? ORDER BY season DESC, created_at DESC",
        (player_id,)
    ).fetchall()
    conn.close()
    results = []
    for r in rows:
        d = dict(r)
        if d.get("extended_stats") and isinstance(d["extended_stats"], str):
            try:
                d["extended_stats"] = json.loads(d["extended_stats"])
            except Exception:
                pass
        results.append(d)
    return results


@app.get("/stats/team/{team_name}")
async def get_team_stats(team_name: str, token_data: dict = Depends(verify_token)):
    """Get team-level stats."""
    org_id = token_data["org_id"]
    decoded = team_name.replace("%20", " ")
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM team_stats WHERE org_id = ? AND LOWER(team_name) = LOWER(?) ORDER BY season DESC",
        (org_id, decoded)
    ).fetchall()
    conn.close()
    results = []
    for r in rows:
        d = dict(r)
        if d.get("extended_stats") and isinstance(d["extended_stats"], str):
            try:
                d["extended_stats"] = json.loads(d["extended_stats"])
            except Exception:
                pass
        results.append(d)
    return results


@app.get("/stats/team/{team_name}/lines")
async def get_team_lines(
    team_name: str,
    line_type: Optional[str] = Query(None),
    token_data: dict = Depends(verify_token),
):
    """Get line combinations for a team."""
    org_id = token_data["org_id"]
    decoded = team_name.replace("%20", " ")
    conn = get_db()
    query = "SELECT * FROM line_combinations WHERE org_id = ? AND LOWER(team_name) = LOWER(?)"
    params = [org_id, decoded]
    if line_type:
        query += " AND line_type = ?"
        params.append(line_type)
    query += " ORDER BY toi_seconds DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    results = []
    for r in rows:
        d = dict(r)
        for jf in ("player_refs", "extended_stats"):
            if d.get(jf) and isinstance(d[jf], str):
                try:
                    d[jf] = json.loads(d[jf])
                except Exception:
                    pass
        results.append(d)
    return results


def _parse_file_to_rows(content: bytes, fname: str) -> list[dict]:
    """Parse a CSV or Excel file into a list of normalized dicts."""
    is_excel = any(fname.endswith(ext) for ext in (".xlsx", ".xls", ".xlsm"))

    if is_excel:
        try:
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
            ws = wb.active
            if not ws:
                raise HTTPException(status_code=400, detail="Excel file has no active sheet")
            rows_iter = ws.iter_rows(values_only=True)
            raw_headers = next(rows_iter, None)
            if not raw_headers:
                raise HTTPException(status_code=400, detail="Excel file is empty")
            headers = [str(h).strip().lower().replace(" ", "_").replace("-", "_") if h else f"col_{i}" for i, h in enumerate(raw_headers)]
            all_rows = []
            for row_vals in rows_iter:
                row_dict = {}
                for j, val in enumerate(row_vals):
                    if j < len(headers):
                        row_dict[headers[j]] = str(val).strip() if val is not None else ""
                if any(v for v in row_dict.values()):
                    all_rows.append(row_dict)
            wb.close()
            return all_rows
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse Excel file: {str(e)}")
    else:
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = content.decode("latin-1")
        reader = csv.DictReader(io.StringIO(text))
        if reader.fieldnames:
            reader.fieldnames = [f.strip().lower().replace(" ", "_").replace("-", "_") for f in reader.fieldnames]
        return [{k.strip(): v.strip() if v else "" for k, v in row.items()} for row in reader]


def _parse_mmss_to_seconds(val: str) -> int:
    """Convert 'MM:SS' or 'HH:MM:SS' time string to total seconds."""
    if not val or val == "-" or val == "None":
        return 0
    val = val.strip()
    parts = val.split(":")
    try:
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        elif len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
        else:
            return int(float(val))
    except (ValueError, TypeError):
        return 0


def _detect_instat_game_log(headers: list[str]) -> bool:
    """Detect InStat per-game box score format (e.g. 'Games - Player Name.xlsx')."""
    instat_markers = {"date", "opponent", "score", "time_on_ice", "all_shifts"}
    return len(instat_markers.intersection(set(headers))) >= 3


def _detect_instat_team_stats(headers: list[str]) -> bool:
    """Detect InStat team skater stats format (e.g. 'Skaters - Team Name.xlsx')."""
    # Team stats files have a 'player' or '#' column plus standard stat headers
    has_player_col = any(h in headers for h in ["player", "#", "name", "player_name"])
    has_stat_cols = any(h in headers for h in ["goals", "assists", "points", "time_on_ice"])
    return has_player_col and has_stat_cols


def _to_int(val, default=0):
    """Convert a value to int, handling floats, dashes, and empty strings."""
    if not val or val == "-" or val == "None":
        return default
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return default


def _to_float(val, default=None):
    """Convert a value to float, handling dashes and empty strings."""
    if not val or val == "-" or val == "None":
        return default
    try:
        # Strip percent signs
        cleaned = str(val).replace("%", "").strip()
        return float(cleaned) if cleaned else default
    except (ValueError, TypeError):
        return default


# ============================================================
# INSTAT ANALYTICS — UTILITY FUNCTIONS
# ============================================================

def _clean_instat_val(val):
    """Clean InStat value: handle '-', None, strip %."""
    if val is None:
        return None
    s = str(val).strip()
    if s in ("-", "None", "", "N/A"):
        return None
    return s


def _instat_to_number(val):
    """Convert InStat value to number (int or float). Returns None for empty."""
    cleaned = _clean_instat_val(val)
    if cleaned is None:
        return None
    # Strip percent suffix
    cleaned = cleaned.rstrip("%")
    try:
        f = float(cleaned)
        if f == int(f) and "." not in cleaned:
            return int(f)
        return f
    except (ValueError, TypeError):
        return None


def _parse_instat_row(row: dict, core_map: dict, extended_map: dict):
    """Parse an InStat row into (core_stats, extended_stats) dicts."""
    core = {}
    extended = {}

    for header, target in core_map.items():
        raw = row.get(header)
        if raw is None:
            continue
        cleaned = _clean_instat_val(raw)
        if cleaned is None:
            continue
        if target == "toi_seconds":
            core[target] = _parse_mmss_to_seconds(cleaned)
        elif target == "pim":
            # PIM comes as MM:SS in InStat
            secs = _parse_mmss_to_seconds(cleaned)
            core[target] = secs // 60 if secs else _to_int(cleaned)
        elif target == "shooting_pct":
            core[target] = _to_float(cleaned)
        elif target == "sv_pct":
            core[target] = cleaned  # Keep as string like "91.9%"
        elif target in ("ga", "sa", "sv"):
            core[target] = _to_float(cleaned)
        else:
            core[target] = _instat_to_number(cleaned)

    for header, target in extended_map.items():
        raw = row.get(header)
        if raw is None:
            continue
        cleaned = _clean_instat_val(raw)
        if cleaned is None:
            continue

        if "." in target:
            category, field = target.split(".", 1)
            if category not in extended:
                extended[category] = {}
            # Determine value type
            if "time" in field and ":" in str(cleaned):
                extended[category][field] = _parse_mmss_to_seconds(cleaned)
            elif "pct" in field or field.endswith("_%"):
                extended[category][field] = _to_float(cleaned)
            else:
                extended[category][field] = _instat_to_number(cleaned)
        else:
            # Flat field for goalie extended
            if "time" in target and ":" in str(cleaned):
                extended[target] = _parse_mmss_to_seconds(cleaned)
            elif "pct" in target:
                extended[target] = _to_float(cleaned)
            else:
                extended[target] = _instat_to_number(cleaned)

    return core, extended


def _detect_instat_file_type(headers: list) -> str:
    """Auto-detect InStat XLSX file type from headers."""
    h_set = set(h.lower().replace(" ", "_") for h in headers if h)

    # Lines files: have "line" column
    if "line" in h_set:
        return "lines"

    # Goalie files: have saves/sv% markers but NOT goals/assists (skater stats)
    goalie_markers = {"saves,_%", "saves", "goals_against", "shootout_saves", "shootouts_allowed"}
    has_goalie = len(goalie_markers & h_set) >= 2
    has_assists = "assists" in h_set or "first_assist" in h_set

    if has_goalie and not has_assists:
        has_team_col = "team" in h_set
        return "league_goalies" if has_team_col else "team_goalies"

    # Skater files: have player + scoring stats
    has_player = "player" in h_set
    has_scoring = "goals" in h_set or "points" in h_set

    if has_player and has_scoring:
        has_team_col = "team" in h_set
        return "league_skaters" if has_team_col else "team_skaters"

    # Team stats: has "team" as first col and no "player" col
    if "team" in h_set and not has_player and has_scoring:
        return "league_teams"

    # Fallback: check if it looks like team stats (no player column, has stats)
    if not has_player and ("faceoffs" in h_set or "shots_on_goal" in h_set):
        return "league_teams"

    return "unknown"


def _parse_line_players(line_string: str) -> list:
    """Parse '6 E. Weiss, 20 N. Battler, ...' into structured player refs."""
    players = []
    if not line_string:
        return players
    for entry in line_string.split(","):
        entry = entry.strip()
        if not entry:
            continue
        parts = entry.split(None, 1)
        if len(parts) == 2:
            players.append({"jersey": parts[0], "name": parts[1]})
        elif len(parts) == 1:
            players.append({"jersey": "", "name": parts[0]})
    return players


@app.post("/stats/ingest")
async def ingest_stats(
    file: UploadFile = File(...),
    player_id: Optional[str] = Query(None),
    token_data: dict = Depends(verify_token),
):
    """
    Ingest stats from a CSV or Excel file. Supports:
    - Standard format: columns like gp, g, a, p, plus_minus, pim, etc.
    - InStat game log: per-game box scores (Date, Opponent, Score, Goals, Assists, etc.)
    - InStat team stats: team skater stats with player names
    Requires player_id query param for single-player files (InStat game logs).
    """
    org_id = token_data["org_id"]
    fname = (file.filename or "").lower()

    if not any(fname.endswith(ext) for ext in (".csv", ".xlsx", ".xls", ".xlsm")):
        raise HTTPException(status_code=400, detail="File must be .csv, .xlsx, or .xls")

    content = await file.read()
    all_rows = _parse_file_to_rows(content, fname)

    if not all_rows:
        raise HTTPException(status_code=400, detail="File contains no data rows")

    headers = list(all_rows[0].keys())
    logger.info("Stats ingest headers: %s", headers)

    conn = get_db()
    inserted = 0
    errors = []

    # ── InStat Game Log Format ────────────────────────────────────
    # Per-game box scores for a single player (e.g. "Games - Ewan McChesney.xlsx")
    # Columns: Date, Opponent, Score, All shifts, Time on ice, Goals, Assists, Points, +/-, etc.
    if _detect_instat_game_log(headers):
        if not player_id:
            conn.close()
            raise HTTPException(
                status_code=400,
                detail="InStat game log detected — please upload this from the player's profile page so we know which player to attach stats to."
            )

        # Verify player belongs to org
        player = conn.execute("SELECT id, first_name, last_name FROM players WHERE id = ? AND org_id = ?", (player_id, org_id)).fetchone()
        if not player:
            conn.close()
            raise HTTPException(status_code=404, detail="Player not found")

        # Try to extract season from filename (e.g. "Games - Ewan McChesney, 08-Feb-2026.xlsx")
        import re as _re
        year_match = _re.search(r"(\d{4})", file.filename or "")
        default_season = ""
        if year_match:
            y = int(year_match.group(1))
            # Hockey seasons span two years; if month is before August, it's previous year's season
            default_season = f"{y-1}-{y}"

        logger.info("InStat game log detected for player %s %s — %d rows, season guess: %s",
                     player["first_name"], player["last_name"], len(all_rows), default_season or "unknown")

        for i, row in enumerate(all_rows):
            # Skip the "Average per game" summary row (has no date)
            opponent = row.get("opponent", "")
            if "average" in opponent.lower() or not opponent:
                continue

            g = _to_int(row.get("goals"))
            first_a = _to_int(row.get("first_assist"))
            second_a = _to_int(row.get("second_assist"))
            a = _to_int(row.get("assists"), first_a + second_a)
            p = _to_int(row.get("points"), g + a)

            toi = _parse_mmss_to_seconds(row.get("time_on_ice", ""))
            pim_seconds = _parse_mmss_to_seconds(row.get("penalty_time", ""))
            pim_minutes = pim_seconds // 60 if pim_seconds else 0

            # Build a game_id from date + opponent for dedup
            game_date = row.get("date", "")
            game_id = f"{game_date}_{opponent.replace(' ', '_')}" if game_date else None

            shots = _to_int(row.get("shots"))
            sog = _to_int(row.get("shots_on_goal"))
            pp_shots = _to_int(row.get("power_play_shots"))
            pk_shots = _to_int(row.get("short_handed_shots") or row.get("shorthanded_shots"))
            shooting_pct = round((g / sog * 100), 1) if sog > 0 else None

            try:
                conn.execute("""
                    INSERT INTO player_stats (id, player_id, game_id, season, stat_type, gp, g, a, p, plus_minus, pim,
                                              toi_seconds, pp_toi_seconds, pk_toi_seconds, shots, sog, shooting_pct,
                                              microstats, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    gen_id(), player_id, game_id, default_season, "game",
                    1,  # gp = 1 per game row
                    g, a, p,
                    _to_int(row.get("+/_") or row.get("plusminus") or row.get("+/−") or row.get("+/")),
                    pim_minutes, toi, 0, 0,
                    shots, sog, shooting_pct,
                    json.dumps({
                        "opponent": opponent,
                        "score": row.get("score", ""),
                        "date": game_date,
                        "shifts": _to_int(row.get("all_shifts")),
                        "hits": _to_int(row.get("hits")),
                        "blocked_shots": _to_int(row.get("blocked_shots")),
                        "faceoffs": _to_int(row.get("faceoffs")),
                        "faceoffs_won": _to_int(row.get("faceoffs_won")),
                        "faceoff_pct": _to_float(row.get("faceoffs_won,_%")),
                        "penalties_drawn": _to_int(row.get("penalties_drawn")),
                        "pp_shots": pp_shots,
                        "pk_shots": pk_shots,
                    }),
                    now_iso(),
                ))
                inserted += 1
            except Exception as e:
                errors.append(f"Row {i+1}: {str(e)}")

        conn.commit()

        # ── Auto-aggregate game logs into a season summary row ──────
        # Delete any existing auto-generated season summary for this player/season
        # (so re-importing doesn't create duplicates)
        if default_season and inserted > 0:
            conn.execute("""
                DELETE FROM player_stats
                WHERE player_id = ? AND season = ? AND stat_type = 'season'
                AND id IN (
                    SELECT id FROM player_stats
                    WHERE player_id = ? AND season = ? AND stat_type = 'season'
                )
            """, (player_id, default_season, player_id, default_season))

            # Aggregate all game rows for this player/season
            agg = conn.execute("""
                SELECT
                    COUNT(*) as gp,
                    SUM(g) as g, SUM(a) as a, SUM(p) as p,
                    SUM(plus_minus) as plus_minus, SUM(pim) as pim,
                    SUM(toi_seconds) as toi_seconds,
                    SUM(pp_toi_seconds) as pp_toi_seconds,
                    SUM(pk_toi_seconds) as pk_toi_seconds,
                    SUM(shots) as shots, SUM(sog) as sog
                FROM player_stats
                WHERE player_id = ? AND season = ? AND stat_type = 'game'
            """, (player_id, default_season)).fetchone()

            if agg and agg["gp"] > 0:
                total_g = agg["g"] or 0
                total_sog = agg["sog"] or 0
                season_shooting_pct = round((total_g / total_sog * 100), 1) if total_sog > 0 else None

                conn.execute("""
                    INSERT INTO player_stats (id, player_id, season, stat_type, gp, g, a, p, plus_minus, pim,
                                              toi_seconds, pp_toi_seconds, pk_toi_seconds, shots, sog, shooting_pct, created_at)
                    VALUES (?, ?, ?, 'season', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    gen_id(), player_id, default_season,
                    agg["gp"], total_g, agg["a"] or 0, agg["p"] or 0,
                    agg["plus_minus"] or 0, agg["pim"] or 0,
                    agg["toi_seconds"] or 0, agg["pp_toi_seconds"] or 0, agg["pk_toi_seconds"] or 0,
                    agg["shots"] or 0, total_sog, season_shooting_pct,
                    now_iso(),
                ))
                conn.commit()
                logger.info("Auto-generated season summary for %s %s (%s): %dGP %dG %dA %dP",
                            player["first_name"], player["last_name"], default_season,
                            agg["gp"], total_g, agg["a"] or 0, agg["p"] or 0)

        conn.close()
        logger.info("InStat game log ingested: %d games for %s %s", inserted, player["first_name"], player["last_name"])

        # Trigger intelligence generation in background
        if inserted > 0:
            asyncio.create_task(_generate_player_intelligence(player_id, org_id, trigger="import"))

        return {
            "detail": f"Imported {inserted} game logs + season summary from InStat",
            "inserted": inserted + (1 if default_season and inserted > 0 else 0),
            "format": "instat_game_log",
            "errors": errors[:10],
        }

    # ── InStat Team Stats Format ──────────────────────────────────
    # Team-wide skater stats (e.g. "Skaters - St. Marys Lincolns.xlsx")
    # Has player names + stats for the whole team
    if _detect_instat_team_stats(headers):
        logger.info("InStat team stats detected — %d rows", len(all_rows))
        _imported_player_ids = set()

        for i, row in enumerate(all_rows):
            # Get player name
            player_name = row.get("player") or row.get("name") or row.get("player_name") or ""
            if not player_name or player_name == "-":
                errors.append(f"Row {i+1}: no player name")
                continue

            # Try to match to existing player by name
            parts = player_name.strip().split(None, 1)
            if len(parts) < 2:
                errors.append(f"Row {i+1}: cannot split name '{player_name}'")
                continue

            first_name, last_name = parts[0], parts[1]

            # Look up player in DB (case-insensitive match)
            matched = conn.execute(
                "SELECT id FROM players WHERE org_id = ? AND LOWER(first_name) = LOWER(?) AND LOWER(last_name) = LOWER(?)",
                (org_id, first_name, last_name)
            ).fetchone()

            if not matched:
                errors.append(f"Row {i+1}: player '{player_name}' not found in database — import them first")
                continue

            pid = matched["id"]
            g = _to_int(row.get("goals"))
            a = _to_int(row.get("assists"))
            p = _to_int(row.get("points"), g + a)
            toi = _parse_mmss_to_seconds(row.get("time_on_ice", ""))
            pim_seconds = _parse_mmss_to_seconds(row.get("penalty_time", ""))

            try:
                conn.execute("""
                    INSERT INTO player_stats (id, player_id, season, stat_type, gp, g, a, p, plus_minus, pim,
                                              toi_seconds, shots, sog, shooting_pct, microstats, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    gen_id(), pid, "", "season",
                    _to_int(row.get("gp") or row.get("games") or row.get("games_played")),
                    g, a, p,
                    _to_int(row.get("+/_") or row.get("plusminus") or row.get("+/−")),
                    pim_seconds // 60 if pim_seconds else 0,
                    toi,
                    _to_int(row.get("shots")),
                    _to_int(row.get("shots_on_goal") or row.get("sog")),
                    _to_float(row.get("shooting_pct") or row.get("sh%") or row.get("s%")),
                    json.dumps({
                        "faceoffs": _to_int(row.get("faceoffs")),
                        "faceoffs_won": _to_int(row.get("faceoffs_won")),
                        "hits": _to_int(row.get("hits")),
                        "blocked_shots": _to_int(row.get("blocked_shots")),
                    }),
                    now_iso(),
                ))
                inserted += 1
                _imported_player_ids.add(pid)
            except Exception as e:
                errors.append(f"Row {i+1} ({player_name}): {str(e)}")

        conn.commit()
        conn.close()
        logger.info("InStat team stats ingested: %d rows", inserted)

        # Trigger intelligence generation for each imported player in background
        for _pid in _imported_player_ids:
            asyncio.create_task(_generate_player_intelligence(_pid, org_id, trigger="import"))

        return {
            "detail": f"Imported {inserted} stat rows from InStat team stats",
            "inserted": inserted,
            "format": "instat_team_stats",
            "errors": errors[:10],
        }

    # ── Standard Format ───────────────────────────────────────────
    _std_player_ids = set()
    for i, row in enumerate(all_rows):
        pid = row.get("player_id") or player_id
        if not pid:
            errors.append(f"Row {i+1}: missing player_id")
            continue

        # Verify player belongs to org
        player = conn.execute("SELECT id FROM players WHERE id = ? AND org_id = ?", (pid, org_id)).fetchone()
        if not player:
            errors.append(f"Row {i+1}: player {pid} not found")
            continue

        g = _to_int(row.get("g") or row.get("goals"))
        a = _to_int(row.get("a") or row.get("assists"))
        p = _to_int(row.get("p") or row.get("pts") or row.get("points"), g + a)

        conn.execute("""
            INSERT INTO player_stats (id, player_id, season, stat_type, gp, g, a, p, plus_minus, pim,
                                      toi_seconds, pp_toi_seconds, pk_toi_seconds, shots, sog, shooting_pct, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            gen_id(), pid,
            row.get("season", ""),
            row.get("stat_type", "season"),
            _to_int(row.get("gp") or row.get("games") or row.get("games_played")),
            g, a, p,
            _to_int(row.get("plus_minus") or row.get("+/-") or row.get("plusminus")),
            _to_int(row.get("pim") or row.get("penalty_minutes")),
            _to_int(row.get("toi_seconds") or row.get("toi")),
            _to_int(row.get("pp_toi_seconds") or row.get("pp_toi")),
            _to_int(row.get("pk_toi_seconds") or row.get("pk_toi")),
            _to_int(row.get("shots")),
            _to_int(row.get("sog") or row.get("shots_on_goal")),
            _to_float(row.get("shooting_pct") or row.get("sh%") or row.get("s%")),
            now_iso(),
        ))
        inserted += 1
        _std_player_ids.add(pid)

    conn.commit()
    conn.close()

    logger.info("Stats ingested: %d rows for org %s (%d errors)", inserted, org_id, len(errors))

    # Trigger intelligence generation for each imported player in background
    for _pid in _std_player_ids:
        asyncio.create_task(_generate_player_intelligence(_pid, org_id, trigger="import"))

    return {
        "detail": f"Imported {inserted} stat rows",
        "inserted": inserted,
        "errors": errors[:10],
    }


# ============================================================
# TEAM ENDPOINTS
# ============================================================

@app.get("/leagues")
async def list_leagues():
    """List all leagues (reference data — no auth required)."""
    conn = get_db()
    rows = conn.execute("SELECT * FROM leagues ORDER BY sort_order, name").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/teams")
async def list_teams(token_data: dict = Depends(verify_token)):
    org_id = token_data["org_id"]
    conn = get_db()
    rows = conn.execute("SELECT * FROM teams WHERE org_id = ? ORDER BY name", (org_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/teams/reference")
async def list_reference_teams(
    league: Optional[str] = None,
    token_data: dict = Depends(verify_token),
):
    """List global reference teams + org-specific teams, optionally filtered by league."""
    org_id = token_data["org_id"]
    conn = get_db()
    query = "SELECT * FROM teams WHERE (org_id = '__global__' OR org_id = ?)"
    params: list = [org_id]
    if league:
        query += " AND league = ?"
        params.append(league)
    query += " ORDER BY league, name"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/teams/{team_name}/roster")
async def get_team_roster(team_name: str, token_data: dict = Depends(verify_token)):
    """Get all players on a team (matched by current_team, case-insensitive)."""
    org_id = token_data["org_id"]
    decoded_name = team_name.replace("%20", " ")
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM players WHERE org_id = ? AND LOWER(current_team) = LOWER(?) ORDER BY position, last_name",
        (org_id, decoded_name),
    ).fetchall()
    conn.close()
    return [_player_from_row(r) for r in rows]


@app.get("/teams/{team_name}/reports")
async def get_team_reports(team_name: str, token_data: dict = Depends(verify_token)):
    """Get all reports for players on a specific team, plus team-level reports."""
    org_id = token_data["org_id"]
    decoded_name = team_name.replace("%20", " ")
    conn = get_db()
    # Player-linked reports (via player's current_team) + team-level reports (via r.team_name)
    rows = conn.execute("""
        SELECT r.* FROM reports r
        LEFT JOIN players p ON r.player_id = p.id
        WHERE r.org_id = ?
          AND (LOWER(p.current_team) = LOWER(?) OR LOWER(r.team_name) = LOWER(?))
        ORDER BY r.created_at DESC
    """, (org_id, decoded_name, decoded_name)).fetchall()
    conn.close()
    results = []
    seen_ids = set()
    for r in rows:
        d = dict(r)
        if d["id"] in seen_ids:
            continue
        seen_ids.add(d["id"])
        for json_field in ("output_json", "input_data"):
            if d.get(json_field) and isinstance(d[json_field], str):
                try:
                    d[json_field] = json.loads(d[json_field])
                except Exception:
                    pass
        results.append(d)
    return results


class TeamCreateRequest(BaseModel):
    name: str
    league: Optional[str] = None
    city: Optional[str] = None
    abbreviation: Optional[str] = None


@app.post("/teams")
async def create_team(body: TeamCreateRequest, token_data: dict = Depends(verify_token)):
    org_id = token_data["org_id"]
    team_id = gen_id()
    conn = get_db()
    conn.execute(
        "INSERT INTO teams (id, org_id, name, league, city, abbreviation) VALUES (?, ?, ?, ?, ?, ?)",
        (team_id, org_id, body.name, body.league, body.city, body.abbreviation),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM teams WHERE id = ?", (team_id,)).fetchone()
    conn.close()
    return dict(row)


# ============================================================
# REPORT GENERATION
# ============================================================

def _generate_mock_report(player: dict, report_type: str) -> str:
    """Generate a structured mock report without calling the LLM."""
    name = f"{player.get('first_name', '')} {player.get('last_name', '')}"
    pos = player.get("position", "F")
    team = player.get("current_team", "Unknown Team")
    league = player.get("current_league", "")
    height = player.get("height_cm", "N/A")
    weight = player.get("weight_kg", "N/A")
    shoots = player.get("shoots", "N/A")

    return f"""EXECUTIVE_SUMMARY
{name} is a {height}cm, {weight}kg {pos} who shoots {shoots}, currently playing for {team}{f' in the {league}' if league else ''}. No game statistics are available in the current dataset — this assessment is based on profile data only.

This report was generated in demo mode. Connect your Anthropic API key in backend/.env to generate full AI-powered scouting intelligence.

KEY_NUMBERS
- Position: {pos}
- Shoots: {shoots}
- Height/Weight: {height}cm / {weight}kg
- Team: {team}
- League: {league or 'N/A'}
- Season Line: No stats available in current data

STRENGTHS
Based on the available profile data for {name}:

1. Active roster player at the {league or 'current'} level, indicating competitive ability against age-appropriate or higher competition.
2. {pos} positioning suggests versatility in the lineup — centers typically anchor lines and take key faceoffs, while wingers drive possession on their strong side.
3. Listed at {height}cm/{weight}kg, which is solid size for {league or 'current'} level play.

Note: Additional on-ice observation data, video clips, and advanced metrics would significantly enhance this assessment.

DEVELOPMENT_AREAS
1. Without advanced tracking data (zone entries, slot shots, defensive recoveries), specific technical gaps cannot be identified. Recommend adding microstats via CSV import.
2. Shooting efficiency data is limited — tracking shot quality and release speed would help project offensive ceiling.
3. Special teams deployment data is not available. Understanding PP and PK usage would clarify his role within the team structure.

DEVELOPMENT_PRIORITIES
1. Add game-level statistics via CSV import to enable trend analysis and per-game consistency tracking.
2. Include video observation notes in the player profile to capture qualitative scouting insights.
3. Track practice habits, compete level, and coachability ratings to build a holistic development picture.

ROLE_FIT
{name} profiles as a {league or 'current'}-level {pos} with roster depth value. Role projection requires additional performance data to refine.

Without deployment data (TOI, PP/PK minutes, line combinations), specific role-fit recommendations are limited. This is a key area where adding detailed stats will unlock deeper analysis.

BOTTOM_LINE
{name} ({team}{f', {league}' if league else ''}) is an active {pos} whose full projection requires richer data input. The ProspectX platform is designed to turn structured stats and scouting notes into actionable intelligence — import CSV stats, add observation notes, and re-generate this report for a comprehensive AI-powered assessment.

**To unlock full report intelligence:** Add your Anthropic API key to backend/.env and re-generate this report.
"""


TEAM_REPORT_TYPES = [
    "team_identity", "opponent_gameplan", "line_chemistry", "st_optimization",
    "practice_plan", "playoff_series", "goalie_tandem",
    "league_benchmarks", "season_projection", "free_agent_market",
]

# ── Custom Report Focus Areas → Prompt Sections Map ───────────
CUSTOM_FOCUS_PROMPTS = {
    "skating": {
        "label": "Skating",
        "prompt": "Provide a detailed SKATING_ASSESSMENT section evaluating: stride mechanics, top-end speed, acceleration, agility/edgework, backward skating, pivots, crossovers, and skating under pressure. Reference specific skating data or observations.",
        "sections": ["SKATING_ASSESSMENT"],
    },
    "offense": {
        "label": "Offensive Game",
        "prompt": "Provide a detailed OFFENSIVE_GAME section evaluating: shot release/accuracy, finishing ability, creativity with the puck, zone entry patterns, cycle game involvement, net-front presence, one-timer ability, and offensive instincts. Reference shooting %, goals, xG data if available.",
        "sections": ["OFFENSIVE_GAME"],
    },
    "defense": {
        "label": "Defensive Game",
        "prompt": "Provide a detailed DEFENSIVE_GAME section evaluating: gap control, stick positioning, shot blocking, DZ coverage responsibility, backchecking effort, board play defense, take-aways vs turnovers, and defensive reads. Reference +/-, takeaway data, and CORSI if available.",
        "sections": ["DEFENSIVE_GAME"],
    },
    "transition": {
        "label": "Transition Play",
        "prompt": "Provide a detailed TRANSITION_GAME section evaluating: breakout passing, zone exit execution, neutral zone play, controlled entries vs dump-ins, transition speed, puck retrieval, and ability to create odd-man rushes. Reference zone entry/breakout data if available.",
        "sections": ["TRANSITION_GAME"],
    },
    "hockey_iq": {
        "label": "Hockey IQ / Sense",
        "prompt": "Provide a detailed HOCKEY_SENSE section evaluating: anticipation, read-and-react ability, decision-making speed, understanding of positional play, ability to process the game at speed, coaching adaptability, and spatial awareness. Reference specific game situations.",
        "sections": ["HOCKEY_SENSE"],
    },
    "compete": {
        "label": "Compete Level",
        "prompt": "Provide a detailed COMPETE_LEVEL section evaluating: battle intensity, puck battles won/lost, willingness to go to hard areas, physical engagement, effort consistency across shifts, compete in key moments, and work ethic indicators. Reference PIM, hits, puck battle data if available.",
        "sections": ["COMPETE_LEVEL"],
    },
    "special_teams": {
        "label": "Special Teams",
        "prompt": "Provide a detailed SPECIAL_TEAMS section evaluating: power play role and effectiveness (PP1/PP2, bumper/flank/net-front/point), penalty kill contributions, PP points, SH points, PP and PK time-on-ice. Recommend optimal special teams deployment.",
        "sections": ["SPECIAL_TEAMS"],
    },
    "projection": {
        "label": "Projection / Ceiling",
        "prompt": "Provide a detailed PROJECTION section with: realistic ceiling and floor projections, development timeline, age-curve analysis for their position and league level, comparable players at this stage of development, and pathway to next level. Include Conservative / Expected / Optimistic scenarios with specific stat projections.",
        "sections": ["PROJECTION", "COMPARABLE_PATHWAYS"],
    },
    "trade_value": {
        "label": "Trade / Acquisition Value",
        "prompt": "Provide a detailed TRADE_VALUE section with: current market value assessment, contract considerations, acquisition cost (draft picks/prospects), roster fit analysis for acquiring teams, risk/reward profile, and comparable recent transactions. Include a clear BUY/HOLD/SELL recommendation.",
        "sections": ["TRADE_VALUE", "MARKET_POSITION"],
    },
    "development": {
        "label": "Development Plan",
        "prompt": "Provide a detailed DEVELOPMENT_PLAN section with: top 3-5 specific skills to develop (ranked by impact), 30-day and 90-day improvement targets, on-ice drill recommendations, off-ice training focus, measurable benchmarks for progress, and recommended coaching approach.",
        "sections": ["DEVELOPMENT_PLAN", "DEVELOPMENT_PRIORITIES"],
    },
    "system_fit": {
        "label": "System Fit",
        "prompt": "Provide a detailed SYSTEM_FIT section evaluating: how this player fits the team's tactical systems (forecheck, DZ, OZ, special teams), role within the system (F1/F2/F3, pinch/stay, PP bumper/flank), system compatibility rating (Elite Fit / Strong Fit / Developing Fit / Adjustment Needed), and coaching recommendations for optimizing deployment within the system.",
        "sections": ["SYSTEM_FIT"],
    },
    "draft": {
        "label": "Draft Analysis",
        "prompt": "Provide a detailed DRAFT_ANALYSIS section with: draft eligibility status, projected draft round/range, draft stock trajectory (rising/falling/steady), draft-day value proposition, comparable draft picks at similar production levels, and red flags or green flags for drafting teams.",
        "sections": ["DRAFT_POSITIONING", "DRAFT_ELIGIBILITY"],
    },
    "physical": {
        "label": "Physical Profile",
        "prompt": "Provide a detailed PHYSICAL_PROFILE section evaluating: size/strength for the level, physical maturity and growth projection, body composition, endurance/stamina across a game, injury history concerns, and how physical tools translate to on-ice impact.",
        "sections": ["PHYSICAL_PROFILE"],
    },
    "goaltending": {
        "label": "Goaltending (Goalie Only)",
        "prompt": "Provide a detailed TECHNICAL_ASSESSMENT section for the goaltender: stance and positioning, movement efficiency (butterfly, T-push, shuffle), rebound control, glove/blocker technique, puck tracking, crease management, post integration, puck handling, mental composure, and recovery speed. Reference save %, GAA, high-danger save % if available.",
        "sections": ["TECHNICAL_ASSESSMENT", "MENTAL_GAME"],
    },
}

CUSTOM_AUDIENCE_PROMPTS = {
    "coaching_staff": {
        "label": "Coaching Staff",
        "tone": "Write for an experienced coaching staff. Use tactical hockey language, deployment recommendations, and specific system references. Focus on actionable coaching intel — line combinations, matchup strategies, practice focus areas. Be direct and tactical.",
    },
    "gm_management": {
        "label": "GM / Management",
        "tone": "Write for a General Manager and hockey operations staff. Focus on player value, roster fit, cap implications, acquisition cost, development timeline, and organizational depth chart impact. Balance analytics with eye-test evaluation.",
    },
    "scouts": {
        "label": "Professional Scouts",
        "tone": "Write in professional scouting report format. Use standard scouting terminology, letter grades, tool ratings, and projection language. Be concise, honest, and focused on translatable skills and red/green flags.",
    },
    "agents": {
        "label": "Agents / Advisors",
        "tone": "Write for player agents and advisors. Highlight strengths, marketability, development upside, and career trajectory. Professional and polished, suitable for sharing with teams, but honest about areas for growth.",
    },
    "family": {
        "label": "Player & Family",
        "tone": "Write for the player and their family. Use clear, accessible language (avoid excessive jargon). Be encouraging but honest. Focus on development, next steps, and actionable goals. Celebrate progress while identifying growth areas.",
    },
    "general": {
        "label": "General Audience",
        "tone": "Write for a broad audience — hockey fans, media, or general stakeholders. Explain hockey terminology when used. Balance analysis with readability. Keep it engaging and informative.",
    },
}

CUSTOM_DEPTH_CONFIG = {
    "brief": {
        "label": "Executive Brief",
        "max_tokens": 3000,
        "instruction": "Keep the report CONCISE — executive brief format. Each section should be 3-5 sentences maximum. Focus on the key takeaways and bottom-line assessment. Target 500-800 words total.",
    },
    "standard": {
        "label": "Standard Report",
        "max_tokens": 6000,
        "instruction": "Produce a standard-depth report. Each section should provide thorough analysis with specific examples and stats. Target 1000-1500 words total.",
    },
    "deep_dive": {
        "label": "Deep Dive",
        "max_tokens": 8000,
        "instruction": "Produce an exhaustive deep-dive report. Leave no stone unturned. Provide detailed analysis in every section with multiple data points, comparisons, and tactical breakdowns. Target 2000-3000 words total.",
    },
}

CUSTOM_COMPARISON_MODES = {
    "league_peers": {
        "label": "Compare to League Peers",
        "instruction": "Include a PEER_COMPARISON section comparing this player against the top performers at their position in the same league. Use percentile rankings where possible.",
    },
    "age_group": {
        "label": "Compare to Age Group",
        "instruction": "Include a PEER_COMPARISON section comparing this player against peers in the same age group (birth year cohort). Evaluate where they stand on the development curve relative to same-age players.",
    },
    "previous_season": {
        "label": "Compare to Previous Season",
        "instruction": "Include a TREND_ANALYSIS section comparing current season performance to the previous season. Highlight improvements, regressions, and trajectory changes with specific stat deltas.",
    },
}


def _get_team_system(conn, org_id: str, team_name: str) -> Optional[dict]:
    """Fetch and parse a team's system profile."""
    ts_row = conn.execute(
        "SELECT * FROM team_systems WHERE org_id = ? AND LOWER(team_name) = LOWER(?) LIMIT 1",
        (org_id, team_name)
    ).fetchone()
    if not ts_row:
        return None
    return {
        "team_name": ts_row["team_name"],
        "season": ts_row["season"],
        "forecheck": ts_row["forecheck"],
        "dz_structure": ts_row["dz_structure"],
        "oz_setup": ts_row["oz_setup"],
        "pp_formation": ts_row["pp_formation"],
        "pk_formation": ts_row["pk_formation"],
        "breakout": ts_row["breakout"],
        "pace": ts_row["pace"] or "",
        "physicality": ts_row["physicality"] or "",
        "offensive_style": ts_row["offensive_style"] or "",
        "identity_tags": json.loads(ts_row["identity_tags"]) if ts_row["identity_tags"] else [],
        "notes": ts_row["notes"] or "",
    }


def _resolve_system_code(conn, code: str) -> str:
    """Look up a system code in the library and return description."""
    if not code:
        return "Not specified"
    lib_row = conn.execute(
        "SELECT name, description FROM systems_library WHERE code = ? LIMIT 1", (code,)
    ).fetchone()
    if lib_row:
        return f"{lib_row['name']} — {lib_row['description']}"
    return code


def _build_system_context_block(conn, team_system: dict) -> str:
    """Build the TEAM SYSTEM CONTEXT prompt block from a team system dict."""
    fc_desc = _resolve_system_code(conn, team_system.get('forecheck', ''))
    dz_desc = _resolve_system_code(conn, team_system.get('dz_structure', ''))
    oz_desc = _resolve_system_code(conn, team_system.get('oz_setup', ''))
    pp_desc = _resolve_system_code(conn, team_system.get('pp_formation', ''))
    pk_desc = _resolve_system_code(conn, team_system.get('pk_formation', ''))
    bo_desc = _resolve_system_code(conn, team_system.get('breakout', ''))

    return f"""
TEAM SYSTEM CONTEXT — HOCKEY OPERATING SYSTEM:
Team: {team_system['team_name']} ({team_system.get('season', 'Current')})
Team Identity: {', '.join(team_system.get('identity_tags', [])) or 'Not specified'}
Team Notes: {team_system.get('notes', 'None')}

TACTICAL SYSTEMS:
- Forecheck: {fc_desc}
- Defensive Zone Coverage: {dz_desc}
- Offensive Zone Setup: {oz_desc}
- Power Play Formation: {pp_desc}
- Penalty Kill Formation: {pk_desc}
- Breakout Pattern: {bo_desc}

TEAM STYLE:
- Pace: {team_system.get('pace', 'Not specified')}
- Physicality: {team_system.get('physicality', 'Not specified')}
- Offensive Style: {team_system.get('offensive_style', 'Not specified')}
"""


async def _generate_custom_report(request, org_id: str, user_id: str, conn):
    """Generate a fully customizable report built from user-selected focus areas, audience, depth, and comparison modes."""
    scope = request.data_scope or {}
    focus_areas = scope.get("focus_areas", [])
    audience = scope.get("audience", "general")
    depth = scope.get("depth", "standard")
    comparison_mode = scope.get("comparison_mode", "")
    custom_instructions = (scope.get("custom_instructions", "") or "")[:500]
    report_title = scope.get("report_title", "")

    is_team = bool(request.team_name and not request.player_id)

    # Create report record
    report_id = gen_id()

    if is_team:
        # ── TEAM CUSTOM REPORT ──
        team_name = request.team_name

        conn.execute("""
            INSERT INTO reports (id, org_id, player_id, team_name, template_id, report_type, status, input_data, created_by, created_at)
            VALUES (?, ?, NULL, ?, NULL, 'custom', 'processing', ?, ?, ?)
        """, (report_id, org_id, team_name, json.dumps(scope), user_id, now_iso()))
        conn.commit()

        title = report_title or f"Custom Report — {team_name}"
        start_time = time.perf_counter()

        try:
            client = get_anthropic_client()

            # Gather roster
            roster_rows = conn.execute(
                "SELECT * FROM players WHERE org_id = ? AND LOWER(current_team) = LOWER(?) ORDER BY position, last_name",
                (org_id, team_name),
            ).fetchall()
            roster = [_player_from_row(r) for r in roster_rows]

            roster_with_stats = []
            for p in roster:
                stats_rows = conn.execute(
                    "SELECT * FROM player_stats WHERE player_id = ? ORDER BY season DESC LIMIT 5",
                    (p["id"],)
                ).fetchall()
                p_stats = []
                for sr in stats_rows:
                    p_stats.append({
                        "season": sr["season"], "gp": sr["gp"], "g": sr["g"], "a": sr["a"], "p": sr["p"],
                        "plus_minus": sr["plus_minus"], "pim": sr["pim"], "shots": sr["shots"], "sog": sr["sog"],
                    })
                roster_with_stats.append({"player": p, "stats": p_stats})

            team_system = _get_team_system(conn, org_id, team_name)
            system_context = _build_system_context_block(conn, team_system) if team_system else ""

            input_data = {"team_name": team_name, "roster": roster_with_stats}
            if team_system:
                input_data["team_system"] = team_system

            # Build custom prompt
            focus_prompt_parts = []
            required_sections = ["EXECUTIVE_SUMMARY", "BOTTOM_LINE"]
            for fa in focus_areas:
                cfg = CUSTOM_FOCUS_PROMPTS.get(fa)
                if cfg:
                    focus_prompt_parts.append(cfg["prompt"])
                    required_sections.extend(cfg["sections"])

            audience_cfg = CUSTOM_AUDIENCE_PROMPTS.get(audience, CUSTOM_AUDIENCE_PROMPTS["general"])
            depth_cfg = CUSTOM_DEPTH_CONFIG.get(depth, CUSTOM_DEPTH_CONFIG["standard"])

            comparison_block = ""
            if comparison_mode:
                comp_cfg = CUSTOM_COMPARISON_MODES.get(comparison_mode)
                if comp_cfg:
                    comparison_block = f"\n{comp_cfg['instruction']}\n"

            custom_block = ""
            if custom_instructions:
                custom_block = f"\nADDITIONAL USER INSTRUCTIONS:\n{custom_instructions}\n"

            sections_str = ", ".join(sorted(set(required_sections)))

            system_prompt = f"""You are ProspectX, an elite hockey scouting intelligence engine. You produce professional-grade custom hockey analysis reports.

REPORT CONFIGURATION:
- Subject: Team — {team_name}
- Focus Areas: {', '.join(CUSTOM_FOCUS_PROMPTS.get(fa, {}).get('label', fa) for fa in focus_areas) or 'Comprehensive'}
- Audience: {audience_cfg['label']}
- Depth: {depth_cfg['label']}

AUDIENCE & TONE:
{audience_cfg['tone']}

DEPTH INSTRUCTION:
{depth_cfg['instruction']}

{system_context}

REQUIRED SECTIONS (use ALL_CAPS_WITH_UNDERSCORES format):
Always include: EXECUTIVE_SUMMARY and BOTTOM_LINE.

{'FOCUS AREA SECTIONS:' if focus_prompt_parts else 'Provide a comprehensive team assessment covering strategy, roster, and identity.'}
{chr(10).join(focus_prompt_parts)}
{comparison_block}
{custom_block}

GRADING: Include "Overall Grade: X" in EXECUTIVE_SUMMARY using scale A (Elite) to D (Developing), NR (Not Rated).
Format each section header on its own line in ALL_CAPS_WITH_UNDERSCORES format.
Today's date is {datetime.now().date().isoformat()}."""

            user_prompt = f"Generate a custom team analysis report for {team_name}. Here is ALL available data:\n\n" + json.dumps(input_data, indent=2, default=str)

            if client:
                llm_model = "claude-sonnet-4-20250514"
                message = client.messages.create(
                    model=llm_model,
                    max_tokens=depth_cfg["max_tokens"],
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_prompt}],
                )
                output_text = message.content[0].text
                total_tokens = message.usage.input_tokens + message.usage.output_tokens
            else:
                llm_model = "mock-demo"
                total_tokens = 0
                output_text = f"""EXECUTIVE_SUMMARY\nCustom team report for {team_name}. Focus: {', '.join(focus_areas)}. Audience: {audience}.\n\nOverall Grade: NR\n\nBOTTOM_LINE\nThis is a mock custom report. Set your Anthropic API key to generate real analysis."""

            generation_ms = int((time.perf_counter() - start_time) * 1000)

            conn.execute("""
                UPDATE reports SET status='complete', title=?, output_text=?, generated_at=?,
                                  llm_model=?, llm_tokens=?, generation_time_ms=?
                WHERE id = ?
            """, (title, output_text, now_iso(), llm_model, total_tokens, generation_ms, report_id))
            conn.commit()
            conn.close()

            return ReportGenerateResponse(report_id=report_id, status="complete", title=title, generation_time_ms=generation_ms)

        except Exception as e:
            conn.execute("UPDATE reports SET status='failed', error_message=? WHERE id = ?", (str(e), report_id))
            conn.commit()
            conn.close()
            raise HTTPException(status_code=500, detail=f"Custom report generation failed: {str(e)}")

    # ── PLAYER CUSTOM REPORT ──
    player_row = conn.execute("SELECT * FROM players WHERE id = ? AND org_id = ?", (request.player_id, org_id)).fetchone()
    if not player_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Player not found")

    player = _player_from_row(player_row)
    player_name = f"{player['first_name']} {player['last_name']}"

    conn.execute("""
        INSERT INTO reports (id, org_id, player_id, template_id, report_type, status, input_data, created_by, created_at)
        VALUES (?, ?, ?, NULL, 'custom', 'processing', ?, ?, ?)
    """, (report_id, org_id, request.player_id, json.dumps(scope), user_id, now_iso()))
    conn.commit()

    title = report_title or f"Custom Report — {player_name}"
    start_time = time.perf_counter()

    try:
        client = get_anthropic_client()

        def _row_get(row, key, default=None):
            try:
                return row[key]
            except (IndexError, KeyError):
                return default

        # Gather stats
        stats_rows = conn.execute(
            "SELECT * FROM player_stats WHERE player_id = ? ORDER BY season DESC, created_at DESC",
            (request.player_id,),
        ).fetchall()
        stats_list = []
        for sr in stats_rows:
            stat_entry = {
                "season": sr["season"], "stat_type": sr["stat_type"],
                "gp": sr["gp"], "g": sr["g"], "a": sr["a"], "p": sr["p"],
                "plus_minus": sr["plus_minus"], "pim": sr["pim"],
                "shots": sr["shots"], "sog": sr["sog"],
                "shooting_pct": sr["shooting_pct"],
                "toi_seconds": sr["toi_seconds"],
            }
            ext_raw = _row_get(sr, "extended_stats")
            if ext_raw:
                try:
                    ext = json.loads(ext_raw) if isinstance(ext_raw, str) else ext_raw
                    if ext:
                        stat_entry["extended_stats"] = ext
                        stat_entry["data_source"] = _row_get(sr, "data_source", "manual")
                except (json.JSONDecodeError, TypeError):
                    pass
            stats_list.append(stat_entry)

        # Goalie stats
        goalie_stats_list = []
        goalie_rows = conn.execute(
            "SELECT * FROM goalie_stats WHERE player_id = ? ORDER BY season DESC",
            (request.player_id,),
        ).fetchall()
        for gr in goalie_rows:
            goalie_entry = {
                "season": gr["season"], "gp": gr["gp"],
                "toi_seconds": gr["toi_seconds"],
                "ga": gr["ga"], "sa": gr["sa"], "sv": gr["sv"],
                "sv_pct": gr["sv_pct"], "gaa": gr["gaa"],
            }
            ext_raw = _row_get(gr, "extended_stats")
            if ext_raw:
                try:
                    ext = json.loads(ext_raw) if isinstance(ext_raw, str) else ext_raw
                    if ext:
                        goalie_entry["extended_stats"] = ext
                except (json.JSONDecodeError, TypeError):
                    pass
            goalie_stats_list.append(goalie_entry)

        # Scout notes
        notes_rows = conn.execute(
            "SELECT * FROM scout_notes WHERE player_id = ? AND org_id = ? ORDER BY created_at DESC LIMIT 20",
            (request.player_id, org_id),
        ).fetchall()
        notes_list = [{"date": nr["created_at"], "note_type": nr["note_type"], "content": nr["note_text"], "tags": nr["tags"]} for nr in notes_rows]

        # Team system
        team_system = None
        system_context = ""
        if player.get("current_team"):
            team_system = _get_team_system(conn, org_id, player["current_team"])
            if team_system:
                system_context = _build_system_context_block(conn, team_system)

        # Line combos
        line_combos = []
        if player.get("current_team"):
            lc_rows = conn.execute(
                "SELECT * FROM line_combinations WHERE org_id = ? AND LOWER(team_name) = LOWER(?) ORDER BY toi_seconds DESC LIMIT 30",
                (org_id, player["current_team"]),
            ).fetchall()
            for lc in lc_rows:
                player_name_lower = player_name.lower()
                pn = (lc["player_names"] or "").lower()
                if player_name_lower.split()[-1] in pn:
                    lc_entry = {
                        "line_type": lc["line_type"], "players": lc["player_names"],
                        "toi_seconds": lc["toi_seconds"], "goals_for": lc["goals_for"],
                        "goals_against": lc["goals_against"], "plus_minus": lc["plus_minus"],
                    }
                    ext_raw = _row_get(lc, "extended_stats")
                    if ext_raw:
                        try:
                            ext = json.loads(ext_raw) if isinstance(ext_raw, str) else ext_raw
                            if ext:
                                lc_entry["extended_stats"] = ext
                        except (json.JSONDecodeError, TypeError):
                            pass
                    line_combos.append(lc_entry)

        # Pre-compute age
        player_for_report = dict(player)
        if player.get("dob"):
            try:
                dob_str = player["dob"][:10]
                birth = datetime.strptime(dob_str, "%Y-%m-%d").date()
                today = datetime.now().date()
                age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
                player_for_report["age"] = age
                player_for_report["age_note"] = f"Born {dob_str} — currently {age} years old (as of {today.isoformat()})"
            except Exception:
                pass

        input_data = {"player": player_for_report, "stats": stats_list, "scout_notes": notes_list}
        if goalie_stats_list:
            input_data["goalie_stats"] = goalie_stats_list
        if line_combos:
            input_data["line_combinations"] = line_combos
        if team_system:
            input_data["team_system"] = team_system

        # Intelligence data
        try:
            indices = _compute_prospectx_indices(
                stats_list[0] if stats_list else {},
                player.get("position", ""),
                conn.execute("SELECT * FROM player_stats WHERE org_id = ?", (org_id,)).fetchall()
            )
            input_data["prospectx_indices"] = indices
        except Exception:
            pass

        intel_row = conn.execute(
            "SELECT * FROM player_intelligence WHERE player_id = ? AND org_id = ? ORDER BY version DESC LIMIT 1",
            (request.player_id, org_id)
        ).fetchone()
        if intel_row:
            intel = dict(intel_row)
            for k in ("strengths", "development_areas", "comparable_players", "tags"):
                if isinstance(intel.get(k), str):
                    try: intel[k] = json.loads(intel[k])
                    except Exception: intel[k] = []
            if isinstance(intel.get("stat_signature"), str):
                try: intel["stat_signature"] = json.loads(intel["stat_signature"])
                except Exception: intel["stat_signature"] = {}
            input_data["intelligence"] = intel

        # Build custom prompt from selections
        focus_prompt_parts = []
        required_sections = ["EXECUTIVE_SUMMARY", "BOTTOM_LINE"]
        for fa in focus_areas:
            cfg = CUSTOM_FOCUS_PROMPTS.get(fa)
            if cfg:
                focus_prompt_parts.append(cfg["prompt"])
                required_sections.extend(cfg["sections"])

        audience_cfg = CUSTOM_AUDIENCE_PROMPTS.get(audience, CUSTOM_AUDIENCE_PROMPTS["general"])
        depth_cfg = CUSTOM_DEPTH_CONFIG.get(depth, CUSTOM_DEPTH_CONFIG["standard"])

        comparison_block = ""
        if comparison_mode:
            comp_cfg = CUSTOM_COMPARISON_MODES.get(comparison_mode)
            if comp_cfg:
                comparison_block = f"\n{comp_cfg['instruction']}\n"

        custom_block = ""
        if custom_instructions:
            custom_block = f"\nADDITIONAL USER INSTRUCTIONS:\n{custom_instructions}\n"

        has_extended = any(s.get("extended_stats") for s in stats_list)

        system_prompt = f"""You are ProspectX, an elite hockey scouting intelligence engine powered by the Hockey Operating System. You produce professional-grade custom scouting reports.

REPORT CONFIGURATION:
- Player: {player_name} ({player.get('position', 'Unknown')}) — {player.get('current_team', 'Unknown Team')}
- Focus Areas: {', '.join(CUSTOM_FOCUS_PROMPTS.get(fa, {}).get('label', fa) for fa in focus_areas) or 'Comprehensive Assessment'}
- Audience: {audience_cfg['label']}
- Depth: {depth_cfg['label']}

AUDIENCE & TONE:
{audience_cfg['tone']}

DEPTH INSTRUCTION:
{depth_cfg['instruction']}

DATA AVAILABLE: {len(stats_list)} stat rows {'(with InStat extended analytics)' if has_extended else ''}, {len(notes_list)} scout notes, {len(goalie_stats_list)} goalie stat rows, {len(line_combos)} line combinations.
{'ProspectX Intelligence profile available.' if input_data.get('intelligence') else ''}
{'ProspectX Indices scores available.' if input_data.get('prospectx_indices') else ''}

{system_context}

{'FOCUS AREA SECTIONS — Generate each of the following:' if focus_prompt_parts else 'Provide a comprehensive player assessment.'}
{chr(10).join(focus_prompt_parts)}
{comparison_block}
{custom_block}

PROSPECT GRADING SCALE (include an Overall Grade in EXECUTIVE_SUMMARY):
  A = Top-Line / #1 D / Franchise | A- = Top-6 F / Top-4 D
  B+ = Middle-6 F / Top-4 D | B = Bottom-6 / Backup G
  B- = NHL Fringe / AHL Top | C+ = AHL Regular
  C = AHL Depth | C- = ECHL / Junior | D = Junior / College | NR = Insufficient Data

MANDATORY: Include "Overall Grade: X" in EXECUTIVE_SUMMARY on its own line.
Format each section header on its own line in ALL_CAPS_WITH_UNDERSCORES format.
When InStat extended analytics are provided (xG, CORSI, puck battles, zone entries), leverage these advanced metrics.
Age-accurate: Use the provided "age" field. Today's date is {datetime.now().date().isoformat()}.
If data is limited for any focus area, note what additional data would strengthen the analysis rather than fabricating observations."""

        user_prompt = f"Generate a custom scouting report for {player_name}. Here is ALL available data:\n\n" + json.dumps(input_data, indent=2, default=str)

        if client:
            llm_model = "claude-sonnet-4-20250514"
            message = client.messages.create(
                model=llm_model,
                max_tokens=depth_cfg["max_tokens"],
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
            output_text = message.content[0].text
            total_tokens = message.usage.input_tokens + message.usage.output_tokens
        else:
            llm_model = "mock-demo"
            total_tokens = 0
            output_text = f"""EXECUTIVE_SUMMARY\nCustom scouting report for {player_name}. Focus: {', '.join(focus_areas)}. Audience: {audience}.\n\nOverall Grade: NR\n\nBOTTOM_LINE\nThis is a mock custom report. Set your Anthropic API key to generate real analysis."""

        generation_ms = int((time.perf_counter() - start_time) * 1000)

        conn.execute("""
            UPDATE reports SET status='complete', title=?, output_text=?, generated_at=?,
                              llm_model=?, llm_tokens=?, generation_time_ms=?
            WHERE id = ?
        """, (title, output_text, now_iso(), llm_model, total_tokens, generation_ms, report_id))
        conn.commit()
        conn.close()

        # Trigger intelligence refresh
        if request.player_id:
            asyncio.create_task(_extract_report_intelligence(report_id, request.player_id, org_id))

        return ReportGenerateResponse(report_id=report_id, status="complete", title=title, generation_time_ms=generation_ms)

    except Exception as e:
        conn.execute("UPDATE reports SET status='failed', error_message=? WHERE id = ?", (str(e), report_id))
        conn.commit()
        conn.close()
        raise HTTPException(status_code=500, detail=f"Custom report generation failed: {str(e)}")


async def _generate_team_report(request, org_id: str, user_id: str, conn):
    """Generate a team-level report (team_identity, opponent_gameplan, etc.)."""
    team_name = request.team_name

    # Get template
    template = conn.execute(
        "SELECT * FROM report_templates WHERE report_type = ? AND (org_id = ? OR is_global = 1) LIMIT 1",
        (request.report_type, org_id),
    ).fetchone()
    if not template:
        conn.close()
        raise HTTPException(status_code=404, detail="Report template not found")

    # Create report record — player_id is NULL for team reports
    report_id = gen_id()
    conn.execute("""
        INSERT INTO reports (id, org_id, player_id, team_name, template_id, report_type, status, input_data, created_by, created_at)
        VALUES (?, ?, NULL, ?, ?, ?, 'processing', ?, ?, ?)
    """, (report_id, org_id, team_name, template["id"], request.report_type, json.dumps(request.data_scope or {}), user_id, now_iso()))
    conn.commit()

    start_time = time.perf_counter()
    title = f"{template['template_name']} — {team_name}"

    try:
        client = get_anthropic_client()

        # Gather roster data
        roster_rows = conn.execute(
            "SELECT * FROM players WHERE org_id = ? AND LOWER(current_team) = LOWER(?) ORDER BY position, last_name",
            (org_id, team_name),
        ).fetchall()
        roster = [_player_from_row(r) for r in roster_rows]

        # Gather stats for each rostered player
        roster_with_stats = []
        for p in roster:
            stats_rows = conn.execute(
                "SELECT * FROM player_stats WHERE player_id = ? ORDER BY season DESC LIMIT 5",
                (p["id"],)
            ).fetchall()
            p_stats = []
            for sr in stats_rows:
                p_stats.append({
                    "season": sr["season"], "stat_type": sr["stat_type"],
                    "gp": sr["gp"], "g": sr["g"], "a": sr["a"], "p": sr["p"],
                    "plus_minus": sr["plus_minus"], "pim": sr["pim"],
                })
            p_entry = {
                "name": f"{p['first_name']} {p['last_name']}",
                "position": p["position"],
                "archetype": p.get("archetype", ""),
                "shoots": p.get("shoots", ""),
                "dob": p.get("dob", ""),
                "stats": p_stats,
            }
            # Pre-compute age
            if p.get("dob"):
                try:
                    dob_str = p["dob"][:10]
                    birth = datetime.strptime(dob_str, "%Y-%m-%d").date()
                    today = datetime.now().date()
                    p_entry["age"] = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
                except Exception:
                    pass
            roster_with_stats.append(p_entry)

        # Gather team system
        team_system = _get_team_system(conn, org_id, team_name)
        system_context = _build_system_context_block(conn, team_system) if team_system else "\nNo team system profile configured. The report should note this limitation.\n"

        report_type_name = template["template_name"]
        input_data = {
            "team_name": team_name,
            "roster": roster_with_stats,
            "team_system": team_system,
            "report_type": request.report_type,
        }

        # ── Enrich team-report input_data for special report types ──
        if request.report_type in ("league_benchmarks", "season_projection", "free_agent_market"):
            # Get the team's league from roster or team system
            team_league = None
            if roster_with_stats:
                for rp in roster_with_stats:
                    if rp.get("current_league"):
                        team_league = rp["current_league"]
                        break
            if not team_league and team_system:
                team_league = team_system.get("league")

            # Get league-wide stats for all teams
            if team_league:
                league_players = conn.execute("""
                    SELECT p.first_name, p.last_name, p.position, p.current_team, p.birth_year, p.age_group,
                           ps.gp, ps.g, ps.a, ps.p, ps.plus_minus, ps.pim, ps.season
                    FROM players p
                    JOIN player_stats ps ON p.id = ps.player_id
                    WHERE p.org_id = ? AND LOWER(p.current_league) = LOWER(?)
                    ORDER BY ps.p DESC
                """, (org_id, team_league)).fetchall()
                input_data["league_data"] = {
                    "league_name": team_league,
                    "all_players": [dict(r) for r in league_players[:100]],
                    "total_players_in_league": len(league_players),
                }

                # Get all teams with stats for league rankings
                team_aggs = conn.execute("""
                    SELECT p.current_team, COUNT(DISTINCT p.id) as roster_size,
                           SUM(ps.g) as total_goals, SUM(ps.a) as total_assists, SUM(ps.p) as total_points,
                           AVG(CASE WHEN ps.gp > 0 THEN CAST(ps.p AS FLOAT) / ps.gp END) as avg_ppg,
                           AVG(ps.plus_minus) as avg_pm
                    FROM players p
                    JOIN player_stats ps ON p.id = ps.player_id
                    WHERE p.org_id = ? AND LOWER(p.current_league) = LOWER(?) AND p.current_team IS NOT NULL
                    GROUP BY p.current_team
                    ORDER BY total_points DESC
                """, (org_id, team_league)).fetchall()
                input_data["league_data"]["team_rankings"] = [dict(r) for r in team_aggs]

            # For free agent market — include intelligence data
            if request.report_type == "free_agent_market":
                intel_rows = conn.execute("""
                    SELECT pi.player_id, pi.archetype, pi.overall_grade, pi.summary,
                           p.first_name, p.last_name, p.position, p.current_team, p.birth_year, p.age_group
                    FROM player_intelligence pi
                    JOIN players p ON pi.player_id = p.id
                    WHERE pi.org_id = ? AND pi.version = (SELECT MAX(pi2.version) FROM player_intelligence pi2 WHERE pi2.player_id = pi.player_id)
                    ORDER BY pi.overall_grade
                """, (org_id,)).fetchall()
                input_data["player_intelligence_summary"] = [dict(r) for r in intel_rows[:50]]

        if client:
            llm_model = "claude-sonnet-4-20250514"

            system_prompt = f"""You are ProspectX, an elite hockey scouting intelligence engine powered by the Hockey Operating System. You produce professional-grade team strategy and scouting reports using tactical hockey terminology that NHL coaches, junior hockey GMs, and hockey operations staff expect.

Generate a **{report_type_name}** for the team below. Your report must be:
- Data-driven: Reference roster composition, player stats, and team system when available
- Tactically literate: Use real hockey language — forecheck structures, defensive zone coverage, breakout patterns, special teams formations, line matching
- Professionally formatted: Use ALL_CAPS_WITH_UNDERSCORES section headers (e.g., EXECUTIVE_SUMMARY, TEAM_IDENTITY, ROSTER_ANALYSIS, TACTICAL_SYSTEMS, SPECIAL_TEAMS, STRENGTHS, WEAKNESSES, GAME_PLAN, PRACTICE_PRIORITIES, BOTTOM_LINE)
- System-aware: Reference the team's configured Hockey Operating System — their forecheck, DZ, OZ, PP, PK structures
- Coaching-grade: Write like you're briefing a coaching staff before a game or planning session

{system_context}

Include actionable coaching recommendations. Reference specific players by name when discussing line combinations, deployment, or matchup strategies."""

            # ── Report-type-specific prompt enhancements for team reports ──
            if request.report_type == "league_benchmarks":
                system_prompt += f"""

SPECIAL INSTRUCTIONS FOR LEAGUE BENCHMARKS COMPARISON:
Structure your report as:
1. EXECUTIVE_SUMMARY — Team's overall standing vs league with key differentiators
2. TEAM_VS_LEAGUE — Compare this team to league averages across: Goals For, Goals Against, Points Per Game, Plus/Minus differential. Show specific numbers and percentages (e.g., "+35% above league average")
3. STATISTICAL_LEADERS — Top 10 scoring leaders in the league. Highlight OUR team's players with markers
4. POSITION_GROUP_RANKINGS — Rank this team's forward group, defense group, and goalies vs other teams in the league
5. SYSTEM_COMPARISON — Compare this team's tactical effectiveness vs league averages (if system data available)
6. TREND_ANALYSIS — What's improving vs league? What's declining? Use specific stat trends
7. COMPETITIVE_ADVANTAGES — Top 3 areas where this team outperforms the league
8. COMPETITIVE_VULNERABILITIES — Top 3 areas of concern relative to league
9. BOTTOM_LINE — Overall league standing assessment and playoff implications
Use the league_data in the input to reference REAL stats and rankings. Today's date is {datetime.now().date().isoformat()}."""

            elif request.report_type == "season_projection":
                system_prompt += f"""

SPECIAL INSTRUCTIONS FOR TEAM SEASON PROJECTION:
Structure your report as:
1. PROJECTED_STANDINGS — Project final standings for ALL teams in the league based on current pace and roster strength. Include W-L-OTL-Points columns and playoff probability percentages
2. CHAMPIONSHIP_ODDS — Top 5 championship contenders with probability percentages
3. TEAM_DETAILED_PROJECTION — Deep dive on THIS team: projected record, current pace extrapolation, strengths driving the projection, risks to the projection
4. KEY_PLAYERS_PROJECTED — Top 5 players on this team with projected final season stats
5. PLAYOFF_PATH — If team projects to make playoffs: likely first-round opponent, win probability per round, championship odds
6. REMAINING_SCHEDULE — Assess schedule difficulty for remaining games
7. RISK_FACTORS — Injuries, goaltending consistency, schedule difficulty, competitive balance concerns
8. BOTTOM_LINE — Clear projection with confidence level
Base projections on the actual stats provided. Use points pace (current_points / games_played * total_season_games). Today's date is {datetime.now().date().isoformat()}. The GOJHL regular season is typically 52 games."""

            elif request.report_type == "free_agent_market":
                system_prompt += f"""

SPECIAL INSTRUCTIONS FOR FREE AGENT MARKET ANALYSIS:
Structure your report as:
1. MARKET_SUMMARY — Total available players by position, birth year distribution, quality distribution (Grade A/B/C)
2. TOP_AVAILABLE_BY_POSITION — For each position group (Centers, Wingers, Defense, Goalies), list top 5 available players with stats, grade, and system fit assessment
3. TEAM_NEEDS_ANALYSIS — Based on THIS team's current roster composition, identify position gaps and priorities
4. RECOMMENDED_TARGETS — Top 3-5 recommended acquisition targets with: player profile, stats, system fit rating (Excellent/Good/Moderate/Poor), market value assessment, and recommendation (PURSUE/MONITOR/PASS)
5. MARKET_TRENDS — Which positions are scarce vs abundant? Where should the team act fast vs wait?
6. TIMING_RECOMMENDATIONS — Prioritize which positions to address immediately vs later
7. BOTTOM_LINE — Clear action items for the GM
Use intelligence grades and archetypes from the player_intelligence_summary in the input. Today's date is {datetime.now().date().isoformat()}."""

            user_prompt = f"Generate a {report_type_name} for {team_name}. Here is all available data:\n\n" + json.dumps(input_data, indent=2, default=str)

            message = client.messages.create(
                model=llm_model,
                max_tokens=8000,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
            output_text = message.content[0].text
            total_tokens = message.usage.input_tokens + message.usage.output_tokens
        else:
            llm_model = "mock-demo"
            total_tokens = 0
            roster_summary = ", ".join([f"{p['name']} ({p['position']})" for p in roster_with_stats[:10]])
            output_text = f"""EXECUTIVE_SUMMARY
{team_name} — {report_type_name}. This is a demo-mode team report. Roster: {len(roster_with_stats)} players. Connect your Anthropic API key in backend/.env to generate full AI-powered team intelligence.

ROSTER_ANALYSIS
Players on file: {roster_summary or 'No players found for this team.'}
Total roster size: {len(roster_with_stats)} players.

TACTICAL_SYSTEMS
{'Team system profile is configured.' if team_system else 'No team system profile found. Configure one in the Systems tab to unlock full tactical analysis.'}

BOTTOM_LINE
This report was generated in demo mode. Add your Anthropic API key to backend/.env and re-generate for full team intelligence.

**To unlock full report intelligence:** Add your Anthropic API key to backend/.env and re-generate this report.
"""
            logger.info("No Anthropic API key — generated mock team report for %s", team_name)

        generation_ms = int((time.perf_counter() - start_time) * 1000)

        conn.execute("""
            UPDATE reports SET status='complete', title=?, output_text=?, generated_at=?,
                              llm_model=?, llm_tokens=?, generation_time_ms=?
            WHERE id = ?
        """, (title, output_text, now_iso(), llm_model, total_tokens, generation_ms, report_id))
        conn.commit()

        logger.info("Team report generated: %s (%s) in %d ms", title, request.report_type, generation_ms)
        conn.close()
        return ReportGenerateResponse(report_id=report_id, status="complete", title=title, generation_time_ms=generation_ms)

    except Exception as e:
        conn.execute("UPDATE reports SET status='failed', error_message=? WHERE id = ?", (str(e), report_id))
        conn.commit()
        conn.close()
        logger.error("Team report generation failed: %s — %s", report_id, str(e))
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")


@app.get("/reports/custom-options")
async def get_custom_report_options(token_data: dict = Depends(verify_token)):
    """Return the available configuration options for custom report builder."""
    return {
        "focus_areas": [
            {"key": k, "label": v["label"], "sections": v["sections"]}
            for k, v in CUSTOM_FOCUS_PROMPTS.items()
        ],
        "audiences": [
            {"key": k, "label": v["label"]}
            for k, v in CUSTOM_AUDIENCE_PROMPTS.items()
        ],
        "depths": [
            {"key": k, "label": v["label"]}
            for k, v in CUSTOM_DEPTH_CONFIG.items()
        ],
        "comparison_modes": [
            {"key": k, "label": v["label"]}
            for k, v in CUSTOM_COMPARISON_MODES.items()
        ],
    }


@app.post("/reports/generate", response_model=ReportGenerateResponse)
async def generate_report(request: ReportGenerateRequest, token_data: dict = Depends(verify_token)):
    org_id = token_data["org_id"]
    user_id = token_data["user_id"]

    if not request.player_id and not request.team_name:
        raise HTTPException(status_code=400, detail="Either player_id or team_name is required")

    is_team_report = request.report_type in TEAM_REPORT_TYPES and request.team_name and not request.player_id
    conn = get_db()

    # ── CUSTOM REPORT FLOW ────────────────────────────────
    if request.report_type == "custom":
        return await _generate_custom_report(request, org_id, user_id, conn)

    # ── TEAM REPORT FLOW ──────────────────────────────────
    if is_team_report:
        return await _generate_team_report(request, org_id, user_id, conn)

    # ── PLAYER REPORT FLOW (existing) ─────────────────────
    # Verify player
    player_row = conn.execute("SELECT * FROM players WHERE id = ? AND org_id = ?", (request.player_id, org_id)).fetchone()
    if not player_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Player not found")

    player = _player_from_row(player_row)

    # Get template
    template = conn.execute(
        "SELECT * FROM report_templates WHERE report_type = ? AND (org_id = ? OR is_global = 1) LIMIT 1",
        (request.report_type, org_id),
    ).fetchone()
    if not template:
        conn.close()
        raise HTTPException(status_code=404, detail="Report template not found")

    # Create report record
    report_id = gen_id()
    conn.execute("""
        INSERT INTO reports (id, org_id, player_id, template_id, report_type, status, input_data, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, 'processing', ?, ?, ?)
    """, (report_id, org_id, request.player_id, template["id"], request.report_type, json.dumps(request.data_scope or {}), user_id, now_iso()))
    conn.commit()

    start_time = time.perf_counter()
    player_name = f"{player['first_name']} {player['last_name']}"
    title = f"{template['template_name']} — {player_name}"

    try:
        client = get_anthropic_client()
        if client:
            llm_model = "claude-sonnet-4-20250514"

            # Helper: safe get from sqlite3.Row (which doesn't support .get())
            def _row_get(row, key, default=None):
                try:
                    return row[key]
                except (IndexError, KeyError):
                    return default

            # Gather player stats (including extended InStat analytics)
            stats_rows = conn.execute(
                "SELECT * FROM player_stats WHERE player_id = ? ORDER BY season DESC, created_at DESC",
                (request.player_id,),
            ).fetchall()
            stats_list = []
            for sr in stats_rows:
                stat_entry = {
                    "season": sr["season"], "stat_type": sr["stat_type"],
                    "gp": sr["gp"], "g": sr["g"], "a": sr["a"], "p": sr["p"],
                    "plus_minus": sr["plus_minus"], "pim": sr["pim"],
                    "shots": sr["shots"], "sog": sr["sog"],
                    "shooting_pct": sr["shooting_pct"],
                    "toi_seconds": sr["toi_seconds"],
                }
                # Include extended stats if available (InStat analytics: xG, CORSI, puck battles, entries, etc.)
                ext_raw = _row_get(sr, "extended_stats")
                if ext_raw:
                    try:
                        ext = json.loads(ext_raw) if isinstance(ext_raw, str) else ext_raw
                        if ext:
                            stat_entry["extended_stats"] = ext
                            stat_entry["data_source"] = _row_get(sr, "data_source", "manual")
                    except (json.JSONDecodeError, TypeError):
                        pass
                stats_list.append(stat_entry)

            # Gather goalie stats if player is a goalie
            goalie_stats_list = []
            goalie_rows = conn.execute(
                "SELECT * FROM goalie_stats WHERE player_id = ? ORDER BY season DESC",
                (request.player_id,),
            ).fetchall()
            for gr in goalie_rows:
                goalie_entry = {
                    "season": gr["season"], "gp": gr["gp"],
                    "toi_seconds": gr["toi_seconds"],
                    "ga": gr["ga"], "sa": gr["sa"], "sv": gr["sv"],
                    "sv_pct": gr["sv_pct"], "gaa": gr["gaa"],
                }
                ext_raw = _row_get(gr, "extended_stats")
                if ext_raw:
                    try:
                        ext = json.loads(ext_raw) if isinstance(ext_raw, str) else ext_raw
                        if ext:
                            goalie_entry["extended_stats"] = ext
                    except (json.JSONDecodeError, TypeError):
                        pass
                goalie_stats_list.append(goalie_entry)

            # Gather scout notes
            notes_rows = conn.execute(
                "SELECT * FROM scout_notes WHERE player_id = ? AND org_id = ? ORDER BY created_at DESC LIMIT 20",
                (request.player_id, org_id),
            ).fetchall()
            notes_list = []
            for nr in notes_rows:
                notes_list.append({
                    "date": nr["created_at"],
                    "note_type": nr["note_type"],
                    "content": nr["note_text"],
                    "tags": nr["tags"],
                })

            # Gather team system data (if the player's team has a system profile)
            team_system = None
            if player.get("current_team"):
                ts_row = conn.execute(
                    "SELECT * FROM team_systems WHERE org_id = ? AND LOWER(team_name) = LOWER(?) LIMIT 1",
                    (org_id, player["current_team"])
                ).fetchone()
                if ts_row:
                    team_system = {
                        "team_name": ts_row["team_name"],
                        "season": ts_row["season"],
                        "forecheck": ts_row["forecheck"],
                        "dz_structure": ts_row["dz_structure"],
                        "oz_setup": ts_row["oz_setup"],
                        "pp_formation": ts_row["pp_formation"],
                        "pk_formation": ts_row["pk_formation"],
                        "breakout": ts_row["breakout"],
                        "pace": ts_row["pace"] or "",
                        "physicality": ts_row["physicality"] or "",
                        "offensive_style": ts_row["offensive_style"] or "",
                        "identity_tags": json.loads(ts_row["identity_tags"]) if ts_row["identity_tags"] else [],
                        "notes": ts_row["notes"] or "",
                    }

            # Resolve system codes to human-readable names from the systems library
            def resolve_system_code(code: str) -> str:
                """Look up a system code in the library and return 'Name (code)' or just the code."""
                if not code:
                    return "Not specified"
                lib_row = conn.execute(
                    "SELECT name, description, ideal_personnel FROM systems_library WHERE code = ? LIMIT 1", (code,)
                ).fetchone()
                if lib_row:
                    return f"{lib_row['name']} — {lib_row['description']}"
                return code

            # Gather line combinations for the player's team
            line_combos = []
            if player.get("current_team"):
                lc_rows = conn.execute(
                    "SELECT * FROM line_combinations WHERE org_id = ? AND LOWER(team_name) = LOWER(?) ORDER BY toi_seconds DESC LIMIT 30",
                    (org_id, player["current_team"]),
                ).fetchall()
                for lc in lc_rows:
                    player_name_lower = f"{player['first_name']} {player['last_name']}".lower()
                    pn = (lc["player_names"] or "").lower()
                    if player_name_lower.split()[-1] in pn:  # Check if player's last name in line
                        lc_entry = {
                            "line_type": lc["line_type"],
                            "players": lc["player_names"],
                            "toi_seconds": lc["toi_seconds"],
                            "goals_for": lc["goals_for"],
                            "goals_against": lc["goals_against"],
                            "plus_minus": lc["plus_minus"],
                        }
                        ext_raw = _row_get(lc, "extended_stats")
                        if ext_raw:
                            try:
                                ext = json.loads(ext_raw) if isinstance(ext_raw, str) else ext_raw
                                if ext:
                                    lc_entry["extended_stats"] = ext
                            except (json.JSONDecodeError, TypeError):
                                pass
                        line_combos.append(lc_entry)

            has_extended = any(s.get("extended_stats") for s in stats_list)
            logger.info("Report input — stats: %d rows (extended: %s), goalie_stats: %d, notes: %d, lines: %d, team_system: %s",
                        len(stats_list), "yes" if has_extended else "no", len(goalie_stats_list), len(notes_list), len(line_combos), "yes" if team_system else "no")

            # Pre-compute age so Claude doesn't have to guess
            player_for_report = dict(player)
            if player.get("dob"):
                try:
                    dob_str = player["dob"][:10]  # Handle ISO datetime or date strings
                    birth = datetime.strptime(dob_str, "%Y-%m-%d").date()
                    today = datetime.now().date()
                    age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
                    player_for_report["age"] = age
                    player_for_report["age_note"] = f"Born {dob_str} — currently {age} years old (as of {today.isoformat()})"
                except Exception:
                    pass

            input_data = {
                "player": player_for_report,
                "stats": stats_list,
                "scout_notes": notes_list,
                "request_scope": request.data_scope,
            }
            if goalie_stats_list:
                input_data["goalie_stats"] = goalie_stats_list
            if line_combos:
                input_data["line_combinations"] = line_combos
            if team_system:
                input_data["team_system"] = team_system

            # Add ProspectX Indices and Intelligence data for enriched reports
            try:
                indices = _compute_prospectx_indices(
                    stats_list[0] if stats_list else {},
                    player.get("position", ""),
                    conn.execute("SELECT * FROM player_stats WHERE org_id = ?", (org_id,)).fetchall()
                )
                input_data["prospectx_indices"] = indices
            except Exception:
                pass  # Non-critical

            intel_row = conn.execute(
                "SELECT * FROM player_intelligence WHERE player_id = ? AND org_id = ? ORDER BY version DESC LIMIT 1",
                (request.player_id, org_id)
            ).fetchone()
            if intel_row:
                intel = dict(intel_row)
                for k in ("strengths", "development_areas", "comparable_players", "tags"):
                    if isinstance(intel.get(k), str):
                        try:
                            intel[k] = json.loads(intel[k])
                        except Exception:
                            intel[k] = []
                if isinstance(intel.get("stat_signature"), str):
                    try:
                        intel["stat_signature"] = json.loads(intel["stat_signature"])
                    except Exception:
                        intel["stat_signature"] = {}
                input_data["intelligence"] = intel

            report_type_name = template["template_name"]

            # Build the system context block for the prompt — resolve codes to full tactical descriptions
            system_context_block = ""
            if team_system:
                fc_desc = resolve_system_code(team_system.get('forecheck', ''))
                dz_desc = resolve_system_code(team_system.get('dz_structure', ''))
                oz_desc = resolve_system_code(team_system.get('oz_setup', ''))
                pp_desc = resolve_system_code(team_system.get('pp_formation', ''))
                pk_desc = resolve_system_code(team_system.get('pk_formation', ''))
                bo_desc = resolve_system_code(team_system.get('breakout', ''))

                system_context_block = f"""

TEAM SYSTEM CONTEXT — HOCKEY OPERATING SYSTEM (use this to evaluate system fit):
Team: {team_system['team_name']} ({team_system.get('season', 'Current')})
Team Identity: {', '.join(team_system.get('identity_tags', [])) or 'Not specified'}
Team Notes: {team_system.get('notes', 'None')}

TACTICAL SYSTEMS:
- Forecheck: {fc_desc}
- Defensive Zone Coverage: {dz_desc}
- Offensive Zone Setup: {oz_desc}
- Power Play Formation: {pp_desc}
- Penalty Kill Formation: {pk_desc}
- Breakout Pattern: {bo_desc}

TEAM STYLE:
- Pace: {team_system.get('pace', 'Not specified')}
- Physicality: {team_system.get('physicality', 'Not specified')}
- Offensive Style: {team_system.get('offensive_style', 'Not specified')}

SYSTEM_FIT SECTION REQUIREMENTS:
You MUST include a dedicated SYSTEM_FIT section in the report. This is a signature ProspectX feature. The SYSTEM_FIT section must:
1. Explicitly name the team's forecheck system and describe the player's role within it (F1/F2/F3 for forwards, pinch/support for D)
2. Evaluate DZ responsibilities — how this player functions in the team's defensive zone structure
3. Evaluate OZ contributions — how this player drives the team's offensive zone attack
4. Assess special teams fit — power play role and penalty kill capability
5. Rate overall system compatibility (Elite Fit / Strong Fit / Developing Fit / Adjustment Needed)
6. Provide specific tactical recommendations for coaching staff

Use elite hockey language. Write like you're briefing an NHL coaching staff. Reference specific systems by name — "As F1 on the 2-1-2 aggressive forecheck, McChesney's 18.4% shooting and +12 rating suggest..." not generic statements. This section should make a GM say "this tool UNDERSTANDS my team."
"""

            system_prompt = f"""You are ProspectX, an elite hockey scouting intelligence engine powered by the Hockey Operating System. You produce professional-grade scouting reports using tactical hockey terminology that NHL scouts, junior hockey GMs, agents, and player development staff expect.

Generate a **{report_type_name}** for the player below. Your report must be:
- Data-driven: Reference specific stats (GP, G, A, P, +/-, PIM, S%, etc.) when available. When InStat extended analytics are provided (xG, CORSI, Fenwick, puck battles, zone entries, breakouts, scoring chances, slot shots, passes, faceoffs by zone), leverage these advanced metrics prominently in your analysis
- Tactically literate: Use real hockey language — forecheck roles (F1/F2/F3), transition play, gap control, cycle game, net-front presence, breakout patterns, DZ coverage. When CORSI/Fenwick data is available, discuss possession metrics. When xG data is available, compare expected vs actual goals
- Professionally formatted: Use ALL_CAPS_WITH_UNDERSCORES section headers (e.g., EXECUTIVE_SUMMARY, KEY_NUMBERS, STRENGTHS, DEVELOPMENT_AREAS, SYSTEM_FIT, PROJECTION, BOTTOM_LINE)
- Specific to position: Tailor analysis to the player's position (center, wing, defense, goalie)
- Honest and balanced: Don't inflate or deflate — give an accurate, scout-grade assessment
- Age-accurate: The player data includes a pre-computed "age" field and "age_note". ALWAYS use the provided age value — do NOT attempt to recalculate it from dob. Today's date is {datetime.now().date().isoformat()}
- Archetype-aware: The player's archetype may be compound (e.g., "Two-Way Playmaking Forward") indicating multiple dimensions. Analyze ALL archetype traits — if the archetype says "Two-Way Playmaking Forward" you must evaluate both the 200-foot game AND the playmaking IQ separately, then synthesize how these traits combine
{system_context_block}
PROSPECT GRADING SCALE (include an overall grade in EXECUTIVE_SUMMARY or BOTTOM_LINE):
  A   = Top-Line / #1 D / Franchise — Elite NHL talent, first-round caliber
  A-  = Top-6 F / Top-4 D / Starting G — High-end NHL player, early-round pick
  B+  = Middle-6 F / Top-4 D — Solid NHL regular, mid-round value
  B   = Bottom-6 F / Bottom-Pair D / Backup G — NHL depth, late-round value
  B-  = NHL Fringe / AHL Top — Borderline NHL, top AHL contributor
  C+  = AHL Regular / NHL Call-Up — Strong minor-leaguer, occasional NHL fill-in
  C   = AHL Depth / ECHL Top — Professional career outside NHL
  C-  = ECHL / Junior Overager — Lower pro or strong junior
  D   = Junior / College / Non-Pro — Developing player at junior/college level
  NR  = Not Rated — Insufficient data to project

MANDATORY GRADING REQUIREMENTS:
1. You MUST include "Overall Grade: X" (where X is one of the grades above) in the EXECUTIVE_SUMMARY section. This is NOT optional.
2. Place the grade on its own line, formatted exactly as: Overall Grade: B+ (or whichever grade applies)
3. Also include "Overall Grade: X" in the RECOMMENDATION or BOTTOM_LINE section at the end.
4. Consider: age, league level, stat production relative to peers, physical tools, skating, and development trajectory.
5. EVERY report must have a grade. If data is insufficient, use "NR" and explain what's missing.

Include quantitative analysis where stats exist. If data is limited, note what additional scouting data would strengthen the assessment.

Format each section header on its own line in ALL_CAPS_WITH_UNDERSCORES format, followed by the section content."""

            # ── Report-type-specific prompt enhancements ──
            if request.report_type == "indices_dashboard":
                system_prompt += """

SPECIAL INSTRUCTIONS FOR PROSPECTX INDICES DASHBOARD:
This report focuses on the player's ProspectX Index scores. Structure your report as:
1. OVERALL_PROSPECTX_GRADE — Synthesize all indices into a single letter grade (A through D scale) with numeric score (0-100)
2. INDICES_BREAKDOWN — For EACH of the 6 indices (SniperIndex, PlaymakerIndex, TransitionIndex, DefensiveIndex, CompeteIndex, HockeyIQIndex), provide: the score, percentile, rating tier (Elite/Above Average/Average/Below Average/Developing), and a 2-3 sentence analysis explaining WHY the player scores at that level
3. PERCENTILE_RANKINGS — Compare vs position peers, vs league, and vs age group
4. INDEX_CORRELATION — How do the indices work together? (e.g., high Playmaker + high IQ = elite distributor)
5. SYSTEM_FIT — Based on indices, what role/system fits this player best?
6. DEVELOPMENT_PRIORITIES — Based on index analysis, what 3 specific improvements would most impact their game?
7. COMPARABLE_PLAYERS — Players with similar index profiles
Use the prospectx_indices data in the input prominently. Show specific numbers."""

            elif request.report_type == "player_projection":
                system_prompt += f"""

SPECIAL INSTRUCTIONS FOR NEXT SEASON PLAYER PROJECTION:
Project this player's performance for the NEXT season (2026-27). Structure your report as:
1. PROJECTION_SUMMARY — Expected points range (Conservative/Expected/Optimistic scenarios)
2. METHODOLOGY — Explain what data informed the projection (current stats, age curve, league level, development trend)
3. THREE_SCENARIOS — Detail Conservative (25th percentile), Expected (50th), and Optimistic (75th) with specific point/goal/assist projections
4. AGE_CURVE_ANALYSIS — How does this player's age and development stage affect projection? Reference typical age-development curves for their league tier
5. COMPARABLE_PATHWAYS — 3-5 similar players who were at this statistical level at this age, and what they did next season
6. DEVELOPMENT_FACTORS — What could boost or reduce projection (shooting improvement, ice time changes, linemate quality, etc.)
7. RECOMMENDATION — Clear actionable guidance
Use the player's birth_year and age_group from the data. Today's date is {datetime.now().date().isoformat()}. Reference specific stats when projecting."""

            user_prompt = f"Generate a {report_type_name} for the following player. Here is ALL available data:\n\n" + json.dumps(input_data, indent=2, default=str)

            message = client.messages.create(
                model=llm_model,
                max_tokens=8000,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
            output_text = message.content[0].text
            total_tokens = message.usage.input_tokens + message.usage.output_tokens
        else:
            llm_model = "mock-demo"
            total_tokens = 0
            output_text = _generate_mock_report(player, request.report_type)
            logger.info("No Anthropic API key — generated mock report for %s", player_name)

        generation_ms = int((time.perf_counter() - start_time) * 1000)

        conn.execute("""
            UPDATE reports SET status='complete', title=?, output_text=?, generated_at=?,
                              llm_model=?, llm_tokens=?, generation_time_ms=?
            WHERE id = ?
        """, (title, output_text, now_iso(), llm_model, total_tokens, generation_ms, report_id))
        conn.commit()

        logger.info("Report generated: %s (%s) in %d ms", title, request.report_type, generation_ms)
        conn.close()

        # Trigger intelligence refresh from report insights (background)
        if request.player_id:
            asyncio.create_task(_extract_report_intelligence(report_id, request.player_id, org_id))

        return ReportGenerateResponse(report_id=report_id, status="complete", title=title, generation_time_ms=generation_ms)

    except Exception as e:
        conn.execute("UPDATE reports SET status='failed', error_message=? WHERE id = ?", (str(e), report_id))
        conn.commit()
        conn.close()
        logger.error("Report generation failed: %s — %s", report_id, str(e))
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")


# ============================================================
# REPORT CRUD
# ============================================================

@app.get("/reports/{report_id}", response_model=ReportResponse)
async def get_report(report_id: str, token_data: dict = Depends(verify_token)):
    org_id = token_data["org_id"]
    conn = get_db()
    row = conn.execute("SELECT * FROM reports WHERE id = ? AND org_id = ?", (report_id, org_id)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    return ReportResponse(**dict(row))


@app.get("/reports/{report_id}/status", response_model=ReportStatusResponse)
async def get_report_status(report_id: str, token_data: dict = Depends(verify_token)):
    org_id = token_data["org_id"]
    conn = get_db()
    row = conn.execute(
        "SELECT id, status, error_message, generation_time_ms FROM reports WHERE id = ? AND org_id = ?",
        (report_id, org_id),
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    return ReportStatusResponse(
        report_id=row["id"], status=row["status"],
        error_message=row["error_message"], generation_time_ms=row["generation_time_ms"],
    )


@app.put("/reports/{report_id}")
async def regenerate_report(report_id: str, token_data: dict = Depends(verify_token)):
    """Regenerate an existing report with same parameters."""
    org_id = token_data["org_id"]
    conn = get_db()
    row = conn.execute("SELECT * FROM reports WHERE id = ? AND org_id = ?", (report_id, org_id)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Report not found")

    report = dict(row)
    conn.execute("DELETE FROM reports WHERE id = ?", (report_id,))
    conn.commit()
    conn.close()

    regen_req = ReportGenerateRequest(
        player_id=report.get("player_id"),
        team_name=report.get("team_name"),
        report_type=report["report_type"],
        template_id=report.get("template_id"),
    )
    return await generate_report(regen_req, token_data)


@app.get("/reports", response_model=List[ReportResponse])
async def list_reports(
    player_id: Optional[str] = None,
    report_type: Optional[str] = None,
    report_status: Optional[str] = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    token_data: dict = Depends(verify_token),
):
    org_id = token_data["org_id"]
    conn = get_db()

    query = "SELECT * FROM reports WHERE org_id = ?"
    params: list = [org_id]

    if player_id:
        query += " AND player_id = ?"
        params.append(player_id)
    if report_type:
        query += " AND report_type = ?"
        params.append(report_type)
    if report_status:
        query += " AND status = ?"
        params.append(report_status)

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, skip])

    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [ReportResponse(**dict(r)) for r in rows]


@app.delete("/reports/{report_id}")
async def delete_report(report_id: str, token_data: dict = Depends(verify_token)):
    org_id = token_data["org_id"]
    conn = get_db()
    result = conn.execute("DELETE FROM reports WHERE id = ? AND org_id = ?", (report_id, org_id))
    conn.commit()
    conn.close()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"detail": "Report deleted", "report_id": report_id}


# ============================================================
# PLAYER INTELLIGENCE ENDPOINTS
# ============================================================


@app.get("/players/{player_id}/intelligence")
async def get_player_intelligence(player_id: str, token_data: dict = Depends(verify_token)):
    """Get the latest intelligence snapshot for a player. Auto-generates if none exists."""
    org_id = token_data["org_id"]
    conn = get_db()

    # Verify player belongs to org
    player = conn.execute("SELECT id FROM players WHERE id = ? AND org_id = ?", (player_id, org_id)).fetchone()
    if not player:
        conn.close()
        raise HTTPException(status_code=404, detail="Player not found")

    # Get latest intelligence
    row = conn.execute(
        "SELECT * FROM player_intelligence WHERE player_id = ? AND org_id = ? ORDER BY version DESC LIMIT 1",
        (player_id, org_id)
    ).fetchone()
    conn.close()

    if row:
        d = dict(row)
        # Parse JSON fields
        for field in ("strengths", "development_areas", "comparable_players", "tags"):
            val = d.get(field)
            if isinstance(val, str):
                try:
                    d[field] = json.loads(val)
                except Exception:
                    d[field] = []
            elif val is None:
                d[field] = []
        if isinstance(d.get("stat_signature"), str):
            try:
                d["stat_signature"] = json.loads(d["stat_signature"])
            except Exception:
                d["stat_signature"] = {}
        if isinstance(d.get("data_sources_used"), str):
            try:
                d["data_sources_used"] = json.loads(d["data_sources_used"])
            except Exception:
                d["data_sources_used"] = {}
        return d

    # No intelligence exists — check if player has any data to generate from
    conn2 = get_db()
    has_stats = conn2.execute("SELECT COUNT(*) FROM player_stats WHERE player_id = ?", (player_id,)).fetchone()[0] > 0
    has_goalie_stats = conn2.execute("SELECT COUNT(*) FROM goalie_stats WHERE player_id = ?", (player_id,)).fetchone()[0] > 0
    has_notes = conn2.execute("SELECT COUNT(*) FROM scout_notes WHERE player_id = ?", (player_id,)).fetchone()[0] > 0
    conn2.close()

    if has_stats or has_goalie_stats or has_notes:
        # Auto-generate intelligence
        result = await _generate_player_intelligence(player_id, org_id, trigger="auto")
        if result:
            return result

    # No data at all — return empty intelligence
    return {
        "id": None,
        "player_id": player_id,
        "archetype": None,
        "archetype_confidence": None,
        "overall_grade": None,
        "offensive_grade": None,
        "defensive_grade": None,
        "skating_grade": None,
        "hockey_iq_grade": None,
        "compete_grade": None,
        "summary": None,
        "strengths": [],
        "development_areas": [],
        "comparable_players": [],
        "stat_signature": None,
        "tags": [],
        "projection": None,
        "trigger": None,
        "version": 0,
        "created_at": None,
    }


@app.get("/players/{player_id}/intelligence/history")
async def get_intelligence_history(player_id: str, token_data: dict = Depends(verify_token)):
    """Get all historical intelligence snapshots for a player (shows evolution)."""
    org_id = token_data["org_id"]
    conn = get_db()

    # Verify player
    player = conn.execute("SELECT id FROM players WHERE id = ? AND org_id = ?", (player_id, org_id)).fetchone()
    if not player:
        conn.close()
        raise HTTPException(status_code=404, detail="Player not found")

    rows = conn.execute(
        "SELECT * FROM player_intelligence WHERE player_id = ? AND org_id = ? ORDER BY version DESC",
        (player_id, org_id)
    ).fetchall()
    conn.close()

    results = []
    for row in rows:
        d = dict(row)
        for field in ("strengths", "development_areas", "comparable_players", "tags"):
            val = d.get(field)
            if isinstance(val, str):
                try:
                    d[field] = json.loads(val)
                except Exception:
                    d[field] = []
            elif val is None:
                d[field] = []
        if isinstance(d.get("stat_signature"), str):
            try:
                d["stat_signature"] = json.loads(d["stat_signature"])
            except Exception:
                d["stat_signature"] = {}
        if isinstance(d.get("data_sources_used"), str):
            try:
                d["data_sources_used"] = json.loads(d["data_sources_used"])
            except Exception:
                d["data_sources_used"] = {}
        results.append(d)

    return results


@app.post("/players/{player_id}/intelligence")
async def refresh_player_intelligence(player_id: str, token_data: dict = Depends(verify_token)):
    """Manually trigger a full intelligence refresh for a player."""
    org_id = token_data["org_id"]
    conn = get_db()

    # Verify player
    player = conn.execute("SELECT id FROM players WHERE id = ? AND org_id = ?", (player_id, org_id)).fetchone()
    if not player:
        conn.close()
        raise HTTPException(status_code=404, detail="Player not found")
    conn.close()

    result = await _generate_player_intelligence(player_id, org_id, trigger="manual")
    if result:
        return result
    raise HTTPException(status_code=500, detail="Intelligence generation failed — check server logs")


# ============================================================
# SCOUT NOTES ENDPOINTS
# ============================================================

NOTE_TAGS = ["skating", "shooting", "compete", "hockey_iq", "puck_skills", "positioning",
             "physicality", "speed", "vision", "leadership", "coachability", "work_ethic"]

@app.get("/notes/tags")
async def get_note_tags():
    """Return available note tag options."""
    return NOTE_TAGS


@app.post("/players/{player_id}/notes", response_model=NoteResponse, status_code=201)
async def create_note(player_id: str, note: NoteCreate, token_data: dict = Depends(verify_token)):
    org_id = token_data["org_id"]
    user_id = token_data["user_id"]
    conn = get_db()

    # Verify player belongs to org
    player = conn.execute("SELECT id FROM players WHERE id = ? AND org_id = ?", (player_id, org_id)).fetchone()
    if not player:
        conn.close()
        raise HTTPException(status_code=404, detail="Player not found")

    note_id = gen_id()
    now = now_iso()

    conn.execute("""
        INSERT INTO scout_notes (id, org_id, player_id, scout_id, note_text, note_type, tags, is_private, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (note_id, org_id, player_id, user_id, note.note_text, note.note_type,
          json.dumps(note.tags or []), 1 if note.is_private else 0, now, now))
    conn.commit()

    # Fetch scout name
    user_row = conn.execute("SELECT first_name, last_name FROM users WHERE id = ?", (user_id,)).fetchone()
    scout_name = f"{user_row['first_name'] or ''} {user_row['last_name'] or ''}".strip() if user_row else None

    conn.close()
    logger.info("Note created for player %s by %s", player_id, user_id)

    # Trigger intelligence refresh in background (notes change context)
    asyncio.create_task(_generate_player_intelligence(player_id, org_id, trigger="note"))

    return NoteResponse(
        id=note_id, org_id=org_id, player_id=player_id, scout_id=user_id,
        scout_name=scout_name, note_text=note.note_text, note_type=note.note_type,
        tags=note.tags or [], is_private=note.is_private, created_at=now, updated_at=now,
    )


@app.get("/players/{player_id}/notes", response_model=List[NoteResponse])
async def get_player_notes(
    player_id: str,
    note_type: Optional[str] = None,
    tag: Optional[str] = None,
    token_data: dict = Depends(verify_token),
):
    org_id = token_data["org_id"]
    user_id = token_data["user_id"]
    conn = get_db()

    # Show all shared notes + user's own private notes
    query = """
        SELECT n.*, u.first_name as scout_first, u.last_name as scout_last
        FROM scout_notes n
        LEFT JOIN users u ON n.scout_id = u.id
        WHERE n.player_id = ? AND n.org_id = ?
        AND (n.is_private = 0 OR n.scout_id = ?)
    """
    params: list = [player_id, org_id, user_id]

    if note_type:
        query += " AND n.note_type = ?"
        params.append(note_type)

    query += " ORDER BY n.created_at DESC"

    rows = conn.execute(query, params).fetchall()
    conn.close()

    results = []
    for r in rows:
        d = dict(r)
        tags = d.get("tags", "[]")
        if isinstance(tags, str):
            try:
                tags = json.loads(tags)
            except Exception:
                tags = []
        scout_name = f"{d.get('scout_first', '') or ''} {d.get('scout_last', '') or ''}".strip()
        results.append(NoteResponse(
            id=d["id"], org_id=d["org_id"], player_id=d["player_id"], scout_id=d["scout_id"],
            scout_name=scout_name or None, note_text=d["note_text"], note_type=d["note_type"],
            tags=tags, is_private=bool(d["is_private"]),
            created_at=d["created_at"], updated_at=d["updated_at"],
        ))

    # Filter by tag in Python (since tags are JSON in SQLite)
    if tag:
        results = [n for n in results if tag in n.tags]

    return results


@app.put("/notes/{note_id}", response_model=NoteResponse)
async def update_note(note_id: str, note: NoteUpdate, token_data: dict = Depends(verify_token)):
    org_id = token_data["org_id"]
    user_id = token_data["user_id"]
    conn = get_db()

    row = conn.execute("SELECT * FROM scout_notes WHERE id = ? AND org_id = ?", (note_id, org_id)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Note not found")

    # Only the author can edit their note
    if row["scout_id"] != user_id:
        conn.close()
        raise HTTPException(status_code=403, detail="Can only edit your own notes")

    updates = {}
    if note.note_text is not None:
        updates["note_text"] = note.note_text
    if note.note_type is not None:
        updates["note_type"] = note.note_type
    if note.tags is not None:
        updates["tags"] = json.dumps(note.tags)
    if note.is_private is not None:
        updates["is_private"] = 1 if note.is_private else 0

    if updates:
        updates["updated_at"] = now_iso()
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        vals = list(updates.values()) + [note_id]
        conn.execute(f"UPDATE scout_notes SET {set_clause} WHERE id = ?", vals)
        conn.commit()

    updated_row = conn.execute("""
        SELECT n.*, u.first_name as scout_first, u.last_name as scout_last
        FROM scout_notes n LEFT JOIN users u ON n.scout_id = u.id
        WHERE n.id = ?
    """, (note_id,)).fetchone()
    conn.close()

    d = dict(updated_row)
    tags = d.get("tags", "[]")
    if isinstance(tags, str):
        try:
            tags = json.loads(tags)
        except Exception:
            tags = []
    scout_name = f"{d.get('scout_first', '') or ''} {d.get('scout_last', '') or ''}".strip()

    return NoteResponse(
        id=d["id"], org_id=d["org_id"], player_id=d["player_id"], scout_id=d["scout_id"],
        scout_name=scout_name or None, note_text=d["note_text"], note_type=d["note_type"],
        tags=tags, is_private=bool(d["is_private"]),
        created_at=d["created_at"], updated_at=d["updated_at"],
    )


@app.delete("/notes/{note_id}")
async def delete_note(note_id: str, token_data: dict = Depends(verify_token)):
    org_id = token_data["org_id"]
    user_id = token_data["user_id"]
    conn = get_db()

    row = conn.execute("SELECT scout_id FROM scout_notes WHERE id = ? AND org_id = ?", (note_id, org_id)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Note not found")
    if row["scout_id"] != user_id:
        conn.close()
        raise HTTPException(status_code=403, detail="Can only delete your own notes")

    conn.execute("DELETE FROM scout_notes WHERE id = ?", (note_id,))
    conn.commit()
    conn.close()
    return {"detail": "Note deleted"}


# ============================================================
# HOCKEY OPERATING SYSTEM ENDPOINTS
# ============================================================


class TeamSystemCreate(BaseModel):
    team_name: str
    season: str = ""
    forecheck: str = ""
    dz_structure: str = ""
    oz_setup: str = ""
    pp_formation: str = ""
    pk_formation: str = ""
    neutral_zone: str = ""
    breakout: str = ""
    identity_tags: list = []
    pace: str = ""
    physicality: str = ""
    offensive_style: str = ""
    notes: str = ""


class TeamSystemResponse(BaseModel):
    id: str
    org_id: str
    team_id: Optional[str] = None
    team_name: str
    season: str = ""
    forecheck: str = ""
    dz_structure: str = ""
    oz_setup: str = ""
    pp_formation: str = ""
    pk_formation: str = ""
    neutral_zone: str = ""
    breakout: str = ""
    identity_tags: list = []
    notes: str = ""
    created_at: str = ""
    updated_at: str = ""


@app.get("/hockey-os/systems-library")
async def list_systems_library(system_type: Optional[str] = None):
    """Get all available tactical systems from the library (no auth needed — reference data)."""
    conn = get_db()
    if system_type:
        rows = conn.execute("SELECT * FROM systems_library WHERE system_type = ? ORDER BY code", (system_type,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM systems_library ORDER BY system_type, code").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/hockey-os/glossary")
async def list_glossary(category: Optional[str] = None):
    """Get hockey terminology glossary (no auth needed — reference data)."""
    conn = get_db()
    if category:
        rows = conn.execute("SELECT * FROM hockey_terms WHERE category = ? ORDER BY term", (category,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM hockey_terms ORDER BY category, term").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/hockey-os/team-systems")
async def list_team_systems(token_data: dict = Depends(verify_token)):
    """Get all team system profiles for the org."""
    org_id = token_data["org_id"]
    conn = get_db()
    rows = conn.execute("SELECT * FROM team_systems WHERE org_id = ? ORDER BY team_name", (org_id,)).fetchall()
    conn.close()
    results = []
    for r in rows:
        d = dict(r)
        if d.get("identity_tags"):
            try:
                d["identity_tags"] = json.loads(d["identity_tags"])
            except (json.JSONDecodeError, TypeError):
                d["identity_tags"] = []
        else:
            d["identity_tags"] = []
        results.append(d)
    return results


@app.get("/hockey-os/team-systems/{system_id}")
async def get_team_system(system_id: str, token_data: dict = Depends(verify_token)):
    """Get a single team system profile."""
    org_id = token_data["org_id"]
    conn = get_db()
    row = conn.execute("SELECT * FROM team_systems WHERE id = ? AND org_id = ?", (system_id, org_id)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Team system not found")
    result = dict(row)
    # Parse JSON fields
    if result.get("identity_tags"):
        try:
            result["identity_tags"] = json.loads(result["identity_tags"])
        except (json.JSONDecodeError, TypeError):
            result["identity_tags"] = []
    return result


@app.post("/hockey-os/team-systems", status_code=201)
async def create_team_system(body: TeamSystemCreate, token_data: dict = Depends(verify_token)):
    """Create a team system profile."""
    org_id = token_data["org_id"]
    system_id = gen_id()
    now = now_iso()
    conn = get_db()
    conn.execute("""
        INSERT INTO team_systems (id, org_id, team_name, season, forecheck, dz_structure, oz_setup,
                                   pp_formation, pk_formation, neutral_zone, breakout, identity_tags,
                                   pace, physicality, offensive_style, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (system_id, org_id, body.team_name, body.season, body.forecheck, body.dz_structure, body.oz_setup,
          body.pp_formation, body.pk_formation, body.neutral_zone, body.breakout,
          json.dumps(body.identity_tags), body.pace, body.physicality, body.offensive_style,
          body.notes, now, now))
    conn.commit()
    row = conn.execute("SELECT * FROM team_systems WHERE id = ?", (system_id,)).fetchone()
    conn.close()
    logger.info("Team system created: %s (org %s)", body.team_name, org_id)
    return dict(row)


@app.put("/hockey-os/team-systems/{system_id}")
async def update_team_system(system_id: str, body: TeamSystemCreate, token_data: dict = Depends(verify_token)):
    """Update a team system profile."""
    org_id = token_data["org_id"]
    conn = get_db()
    existing = conn.execute("SELECT id FROM team_systems WHERE id = ? AND org_id = ?", (system_id, org_id)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Team system not found")
    conn.execute("""
        UPDATE team_systems SET team_name=?, season=?, forecheck=?, dz_structure=?, oz_setup=?,
               pp_formation=?, pk_formation=?, neutral_zone=?, breakout=?, identity_tags=?,
               pace=?, physicality=?, offensive_style=?, notes=?, updated_at=?
        WHERE id = ? AND org_id = ?
    """, (body.team_name, body.season, body.forecheck, body.dz_structure, body.oz_setup,
          body.pp_formation, body.pk_formation, body.neutral_zone, body.breakout,
          json.dumps(body.identity_tags), body.pace, body.physicality, body.offensive_style,
          body.notes, now_iso(), system_id, org_id))
    conn.commit()
    row = conn.execute("SELECT * FROM team_systems WHERE id = ?", (system_id,)).fetchone()
    conn.close()
    return dict(row)


@app.delete("/hockey-os/team-systems/{system_id}")
async def delete_team_system(system_id: str, token_data: dict = Depends(verify_token)):
    """Delete a team system profile."""
    org_id = token_data["org_id"]
    conn = get_db()
    conn.execute("DELETE FROM team_systems WHERE id = ? AND org_id = ?", (system_id, org_id))
    conn.commit()
    conn.close()
    return {"detail": "Team system deleted"}


# ============================================================
# BATCH PLAYER IMPORT
# ============================================================

def _fuzzy_name_match(name1: str, name2: str) -> float:
    """Simple fuzzy match — normalized Levenshtein-like comparison."""
    a = name1.lower().strip()
    b = name2.lower().strip()
    if a == b:
        return 1.0
    # Check if one is substring of the other
    if a in b or b in a:
        return 0.9
    # Character-level similarity
    longer = max(len(a), len(b))
    if longer == 0:
        return 1.0
    # Count matching characters
    matches = sum(1 for ca, cb in zip(a, b) if ca == cb)
    return matches / longer


@app.post("/import/preview")
async def preview_import(
    file: UploadFile = File(...),
    team_override: Optional[str] = None,
    league_override: Optional[str] = None,
    token_data: dict = Depends(verify_token),
):
    """Upload a CSV or Excel file, parse it, detect duplicates, return preview for admin review.
    Optional team_override/league_override to auto-inject team/league for all rows (used by team roster import).
    """
    org_id = token_data["org_id"]
    user_id = token_data["user_id"]

    fname = (file.filename or "").lower()

    if not any(fname.endswith(ext) for ext in (".csv", ".xlsx", ".xls", ".xlsm")):
        raise HTTPException(status_code=400, detail="File must be .csv, .xlsx, or .xls")

    content = await file.read()
    parsed_rows = _parse_file_to_rows(content, fname)

    rows_data = []
    parse_errors = []

    # Log the headers we detected for debugging
    if parsed_rows:
        detected_headers = list(parsed_rows[0].keys())
        logger.info("Import headers detected: %s", detected_headers)

        # ── InStat format detection — give helpful guidance ───────
        if _detect_instat_game_log(detected_headers):
            raise HTTPException(
                status_code=400,
                detail="This looks like an InStat game log (per-game stats for one player). "
                       "To import game stats, go to the player's profile page and use the "
                       "stats upload button on the Stats tab instead. "
                       "This Import page is for adding new players to the database."
            )
        if _detect_instat_team_stats(detected_headers) and not any(
            h in detected_headers for h in ["first_name", "first", "firstname", "last_name", "last", "lastname"]
        ):
            # It's a team stats file — we can try to parse it, but warn if no name split will work
            logger.info("InStat team stats file detected in import — will try player name column")

    for i, row in enumerate(parsed_rows):
        first = row.get("first_name") or row.get("first") or row.get("firstname") or ""
        last = row.get("last_name") or row.get("last") or row.get("lastname") or ""

        # If no separate first/last, try full name columns and split
        if not first or not last:
            full_name = (
                row.get("name") or row.get("player") or row.get("player_name")
                or row.get("playername") or row.get("full_name") or row.get("fullname") or ""
            )
            if full_name:
                parts = full_name.strip().split(None, 1)  # Split on first space
                if len(parts) >= 2:
                    first = first or parts[0]
                    last = last or parts[1]
                elif len(parts) == 1:
                    # Could be just a last name
                    last = last or parts[0]

        if not first or not last:
            # Log the actual row data so we can diagnose
            row_preview = {k: v for k, v in list(row.items())[:6] if v}
            parse_errors.append(f"Row {i+1}: missing first_name or last_name (got: {row_preview})")
            continue

        pos = (row.get("position") or row.get("pos") or "F").upper()
        # Handle common position formats: "LW", "C", "D", "G", "RW", "LD", "RD", "F", "W"
        pos_map = {"LD": "D", "RD": "D", "LF": "LW", "RF": "RW", "GK": "G", "FWD": "F", "DEF": "D", "CENTER": "C", "CENTRE": "C", "LEFT_WING": "LW", "RIGHT_WING": "RW", "DEFENSE": "D", "DEFENCE": "D", "GOALIE": "G", "GOALTENDER": "G", "FORWARD": "F", "WING": "W"}
        pos = pos_map.get(pos, pos)
        if pos not in ("C", "LW", "RW", "D", "G", "F", "W", "LD", "RD"):
            pos = "F"

        rows_data.append({
            "row_index": i,
            "first_name": first,
            "last_name": last,
            "position": pos,
            "dob": row.get("dob") or row.get("date_of_birth") or row.get("birthdate") or row.get("birth_date") or row.get("birthday") or row.get("born") or None,
            "shoots": row.get("shoots") or row.get("shot") or row.get("sh") or row.get("hand") or row.get("handedness") or None,
            "current_team": row.get("current_team") or row.get("team") or row.get("club") or row.get("team_name") or None,
            "current_league": row.get("current_league") or row.get("league") or row.get("lg") or None,
            "height_cm": row.get("height_cm") or row.get("height") or row.get("ht") or None,
            "weight_kg": row.get("weight_kg") or row.get("weight") or row.get("wt") or None,
            # Stats columns (optional — will be imported as player_stats)
            "gp": row.get("gp") or row.get("games_played") or row.get("games") or row.get("g.p.") or None,
            "g": row.get("g") or row.get("goals") or None,
            "a": row.get("a") or row.get("assists") or row.get("ast") or None,
            "p": row.get("p") or row.get("pts") or row.get("points") or row.get("tp") or None,
            "plus_minus": row.get("plus_minus") or row.get("+/_") or row.get("plusminus") or row.get("+/−") or row.get("+/") or None,
            "pim": row.get("pim") or row.get("penalty_minutes") or row.get("pen") or None,
            "season": row.get("season") or row.get("year") or None,
        })

    # Apply team/league override for team roster imports
    if team_override:
        for rd in rows_data:
            if not rd.get("current_team"):
                rd["current_team"] = team_override
    if league_override:
        for rd in rows_data:
            if not rd.get("current_league"):
                rd["current_league"] = league_override

    # Fetch existing players for duplicate detection
    conn = get_db()
    existing = conn.execute("SELECT id, first_name, last_name, dob, position, current_team FROM players WHERE org_id = ?", (org_id,)).fetchall()
    existing_players = [dict(r) for r in existing]

    # Detect duplicates
    duplicates = []
    new_players = []

    for rd in rows_data:
        csv_name = f"{rd['first_name']} {rd['last_name']}"
        best_match = None
        best_score = 0

        for ep in existing_players:
            existing_name = f"{ep['first_name']} {ep['last_name']}"
            name_score = _fuzzy_name_match(csv_name, existing_name)
            reasons = []
            score = name_score * 0.6  # 60% weight on name

            if name_score > 0.85:
                reasons.append(f"Name: {int(name_score * 100)}% match")

            if rd.get("dob") and ep.get("dob") and rd["dob"] == ep["dob"]:
                score += 0.25
                reasons.append("DOB: exact match")

            if rd.get("position") and ep.get("position") and rd["position"] == ep["position"]:
                score += 0.08
                reasons.append("Position: same")

            if rd.get("current_team") and ep.get("current_team") and rd["current_team"].lower() == ep["current_team"].lower():
                score += 0.07
                reasons.append("Team: same")

            if score > best_score and score >= 0.55:
                best_score = score
                best_match = {"existing": ep, "score": score, "reasons": reasons}

        if best_match:
            duplicates.append({
                "row_index": rd["row_index"],
                "csv_name": csv_name,
                "csv_data": rd,
                "existing_id": best_match["existing"]["id"],
                "existing_name": f"{best_match['existing']['first_name']} {best_match['existing']['last_name']}",
                "match_score": round(best_match["score"], 2),
                "match_reasons": best_match["reasons"],
            })
        else:
            new_players.append(rd)

    # Create import job
    job_id = gen_id()
    conn.execute("""
        INSERT INTO import_jobs (id, org_id, uploaded_by, filename, total_rows, new_players, duplicates_found, errors_found, status, preview_data, duplicate_data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'preview', ?, ?, ?)
    """, (job_id, org_id, user_id, file.filename, len(rows_data), len(new_players),
          len(duplicates), len(parse_errors), json.dumps(rows_data), json.dumps(duplicates), now_iso()))
    conn.commit()
    conn.close()

    logger.info("Import preview: %s — %d rows, %d new, %d duplicates, %d errors",
                file.filename, len(rows_data), len(new_players), len(duplicates), len(parse_errors))

    return {
        "job_id": job_id,
        "filename": file.filename,
        "total_rows": len(rows_data),
        "new_players": len(new_players),
        "duplicates": duplicates,
        "errors": parse_errors[:20],
        "preview": rows_data[:10],
    }


@app.post("/import/{job_id}/execute")
async def execute_import(job_id: str, body: ImportExecuteRequest, token_data: dict = Depends(verify_token)):
    """Execute the import — create new players, handle duplicate resolutions."""
    org_id = token_data["org_id"]
    conn = get_db()

    job = conn.execute("SELECT * FROM import_jobs WHERE id = ? AND org_id = ?", (job_id, org_id)).fetchone()
    if not job:
        conn.close()
        raise HTTPException(status_code=404, detail="Import job not found")

    job = dict(job)
    all_rows = json.loads(job["preview_data"])
    duplicates = json.loads(job["duplicate_data"])
    dup_indices = {d["row_index"] for d in duplicates}

    # Build resolution map from admin decisions
    resolution_map = {r.row_index: r.action for r in body.resolutions}

    created = 0
    merged = 0
    skipped = 0
    errors = []

    def safe_int(val):
        try:
            return int(float(val)) if val else None
        except (ValueError, TypeError):
            return None

    for rd in all_rows:
        idx = rd["row_index"]
        now = now_iso()

        if idx in dup_indices:
            dup = next(d for d in duplicates if d["row_index"] == idx)
            action = resolution_map.get(idx, "skip")

            if action == "skip":
                skipped += 1
                continue
            elif action == "create_new":
                # Create as new player even though duplicate detected
                player_id = gen_id()
                conn.execute("""
                    INSERT INTO players (id, org_id, first_name, last_name, dob, position, shoots,
                                        height_cm, weight_kg, current_team, current_league, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (player_id, org_id, rd["first_name"], rd["last_name"], rd.get("dob"),
                      rd["position"], rd.get("shoots"), safe_int(rd.get("height_cm")),
                      safe_int(rd.get("weight_kg")), rd.get("current_team"),
                      rd.get("current_league"), now, now))
                created += 1

                # Import stats if present
                if rd.get("gp"):
                    g = safe_int(rd.get("g")) or 0
                    a = safe_int(rd.get("a")) or 0
                    p = safe_int(rd.get("p")) or (g + a)
                    conn.execute("""
                        INSERT INTO player_stats (id, player_id, season, stat_type, gp, g, a, p, plus_minus, pim, created_at)
                        VALUES (?, ?, ?, 'season', ?, ?, ?, ?, ?, ?, ?)
                    """, (gen_id(), player_id, rd.get("season", ""), safe_int(rd.get("gp")) or 0,
                          g, a, p, safe_int(rd.get("plus_minus")) or 0,
                          safe_int(rd.get("pim")) or 0, now))

            elif action == "merge":
                # Update existing player's stats
                existing_id = dup["existing_id"]
                if rd.get("gp"):
                    g = safe_int(rd.get("g")) or 0
                    a = safe_int(rd.get("a")) or 0
                    p = safe_int(rd.get("p")) or (g + a)
                    conn.execute("""
                        INSERT INTO player_stats (id, player_id, season, stat_type, gp, g, a, p, plus_minus, pim, created_at)
                        VALUES (?, ?, ?, 'season', ?, ?, ?, ?, ?, ?, ?)
                    """, (gen_id(), existing_id, rd.get("season", ""), safe_int(rd.get("gp")) or 0,
                          g, a, p, safe_int(rd.get("plus_minus")) or 0,
                          safe_int(rd.get("pim")) or 0, now))
                merged += 1
        else:
            # New player — create
            player_id = gen_id()
            try:
                conn.execute("""
                    INSERT INTO players (id, org_id, first_name, last_name, dob, position, shoots,
                                        height_cm, weight_kg, current_team, current_league, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (player_id, org_id, rd["first_name"], rd["last_name"], rd.get("dob"),
                      rd["position"], rd.get("shoots"), safe_int(rd.get("height_cm")),
                      safe_int(rd.get("weight_kg")), rd.get("current_team"),
                      rd.get("current_league"), now, now))
                created += 1

                # Import stats if present
                if rd.get("gp"):
                    g = safe_int(rd.get("g")) or 0
                    a = safe_int(rd.get("a")) or 0
                    p = safe_int(rd.get("p")) or (g + a)
                    conn.execute("""
                        INSERT INTO player_stats (id, player_id, season, stat_type, gp, g, a, p, plus_minus, pim, created_at)
                        VALUES (?, ?, ?, 'season', ?, ?, ?, ?, ?, ?, ?)
                    """, (gen_id(), player_id, rd.get("season", ""), safe_int(rd.get("gp")) or 0,
                          g, a, p, safe_int(rd.get("plus_minus")) or 0,
                          safe_int(rd.get("pim")) or 0, now))
            except Exception as e:
                errors.append(f"Row {idx+1}: {str(e)}")

    # Update job status
    conn.execute("""
        UPDATE import_jobs SET status = 'complete', new_players = ?, duplicates_found = ?
        WHERE id = ?
    """, (created, merged, job_id))
    conn.commit()
    conn.close()

    logger.info("Import executed: %s — %d created, %d merged, %d skipped, %d errors",
                job_id, created, merged, skipped, len(errors))

    return {
        "detail": f"Import complete: {created} created, {merged} merged, {skipped} skipped",
        "created": created,
        "merged": merged,
        "skipped": skipped,
        "errors": errors[:10],
    }


@app.get("/import/{job_id}")
async def get_import_job(job_id: str, token_data: dict = Depends(verify_token)):
    org_id = token_data["org_id"]
    conn = get_db()
    row = conn.execute("SELECT * FROM import_jobs WHERE id = ? AND org_id = ?", (job_id, org_id)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Import job not found")
    return dict(row)


# ============================================================
# INSTAT ANALYTICS — IMPORT ENGINE
# ============================================================

@app.post("/instat/import")
async def instat_import(
    file: UploadFile = File(...),
    season: Optional[str] = Query(None),
    team_name: Optional[str] = Query(None),
    line_type: Optional[str] = Query(None),
    token_data: dict = Depends(verify_token),
):
    """
    Unified InStat XLSX import — auto-detects file type (league teams, league skaters,
    league goalies, team skaters, team goalies, lines) and routes to appropriate handler.
    """
    org_id = token_data["org_id"]
    user_id = token_data["user_id"]

    fname = (file.filename or "").lower()
    if not any(fname.endswith(ext) for ext in (".csv", ".xlsx", ".xls", ".xlsm")):
        raise HTTPException(status_code=400, detail="File must be .csv, .xlsx, or .xls")

    content = await file.read()
    rows = _parse_file_to_rows(content, fname)
    if not rows:
        raise HTTPException(status_code=400, detail="No data rows found in file")

    # Get headers from first row keys
    headers = list(rows[0].keys())
    file_type = _detect_instat_file_type(headers)

    # Auto-detect season from current date if not provided
    if not season:
        now = datetime.now()
        year = now.year
        season = f"{year-1}-{year}" if now.month < 9 else f"{year}-{year+1}"

    logger.info("InStat import: file_type=%s, rows=%d, season=%s, team=%s", file_type, len(rows), season, team_name)

    result = {
        "file_type": file_type,
        "total_rows": len(rows),
        "players_created": 0,
        "players_updated": 0,
        "stats_imported": 0,
        "errors": [],
    }

    _instat_player_ids = []
    try:
        if file_type == "league_teams":
            r = _import_league_teams(rows, season, org_id)
            result.update(r)
        elif file_type == "league_skaters":
            r = _import_league_skaters(rows, season, org_id)
            _instat_player_ids = r.pop("player_ids", [])
            result.update(r)
        elif file_type == "league_goalies":
            r = _import_league_goalies(rows, season, org_id)
            _instat_player_ids = r.pop("player_ids", [])
            result.update(r)
        elif file_type == "team_skaters":
            if not team_name:
                raise HTTPException(status_code=400, detail="team_name required for team-specific imports")
            r = _import_team_skaters(rows, season, team_name, org_id)
            _instat_player_ids = r.pop("player_ids", [])
            result.update(r)
        elif file_type == "team_goalies":
            if not team_name:
                raise HTTPException(status_code=400, detail="team_name required for team-specific imports")
            r = _import_team_goalies(rows, season, team_name, org_id)
            _instat_player_ids = r.pop("player_ids", [])
            result.update(r)
        elif file_type == "lines":
            if not team_name:
                raise HTTPException(status_code=400, detail="team_name required for lines imports")
            lt = line_type or "full"
            r = _import_lines(rows, season, team_name, lt, org_id)
            result.update(r)
        else:
            raise HTTPException(status_code=400, detail=f"Could not detect file type. Headers: {headers[:10]}")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("InStat import error")
        result["errors"].append(str(e))

    # Trigger intelligence generation for imported players (background, non-blocking)
    # Limit to first 50 players to avoid overwhelming the API on large league imports
    for pid in _instat_player_ids[:50]:
        asyncio.create_task(_generate_player_intelligence(pid, org_id, trigger="import"))
    if _instat_player_ids:
        logger.info("Intelligence generation triggered for %d players from InStat import", min(len(_instat_player_ids), 50))

    return result


def _import_league_teams(rows, season, org_id):
    """Import league-level team stats (26 teams x 100 columns)."""
    conn = get_db()
    stats_imported = 0
    errors = []

    for i, row in enumerate(rows):
        try:
            team_name = row.get("team", "").strip()
            if not team_name:
                errors.append(f"Row {i+1}: missing team name")
                continue

            # Parse all stats into extended_stats JSON
            _, extended = _parse_instat_row(row, {}, INSTAT_TEAM_EXTENDED_MAP)

            # Check if team_stats already exists for this team/season
            existing = conn.execute(
                "SELECT id FROM team_stats WHERE org_id = ? AND LOWER(team_name) = LOWER(?) AND season = ?",
                (org_id, team_name, season)
            ).fetchone()

            if existing:
                conn.execute(
                    "UPDATE team_stats SET extended_stats = ?, data_source = 'instat' WHERE id = ?",
                    (json.dumps(extended), existing["id"])
                )
            else:
                conn.execute(
                    "INSERT INTO team_stats (id, org_id, team_name, league, season, extended_stats, data_source) VALUES (?, ?, ?, ?, ?, ?, 'instat')",
                    (gen_id(), org_id, team_name, "GOJHL", season, json.dumps(extended))
                )
            stats_imported += 1
        except Exception as e:
            errors.append(f"Row {i+1} ({team_name}): {str(e)}")

    conn.commit()
    conn.close()
    return {"stats_imported": stats_imported, "errors": errors}


def _import_league_skaters(rows, season, org_id):
    """Import league-level skater stats (760 players x 138 columns)."""
    conn = get_db()
    created = 0
    updated = 0
    stats_imported = 0
    errors = []
    _affected_player_ids = set()

    # Load existing players for matching
    existing_players = conn.execute(
        "SELECT id, first_name, last_name, current_team, position FROM players WHERE org_id = ?",
        (org_id,)
    ).fetchall()
    existing_list = [dict(p) for p in existing_players]

    for i, row in enumerate(rows):
        try:
            # Parse player name
            full_name = row.get("player", "").strip()
            if not full_name:
                errors.append(f"Row {i+1}: missing player name")
                continue

            parts = full_name.split(None, 1)
            first_name = parts[0] if parts else full_name
            last_name = parts[1] if len(parts) > 1 else ""

            team = row.get("team", "").strip()
            position = row.get("position", "F").strip() or "F"
            jersey = str(row.get("shirt_number", "")).strip()

            # Bio data from passport section
            bio = {}
            for header, field in INSTAT_SKATER_BIO_MAP.items():
                val = _clean_instat_val(row.get(header))
                if val:
                    bio[field] = val

            # Match against existing players
            player_id = None
            csv_name = f"{first_name} {last_name}".lower()

            for ep in existing_list:
                existing_name = f"{ep['first_name']} {ep['last_name']}".lower()
                score = _fuzzy_name_match(csv_name, existing_name)
                if score >= 0.85:
                    # Also check team if available
                    if team and ep.get("current_team") and ep["current_team"].lower() == team.lower():
                        score += 0.1
                    if score >= 0.85:
                        player_id = ep["id"]
                        break

            if player_id:
                # Update existing player with any new bio data
                updates = []
                params = []
                if team and team != "":
                    updates.append("current_team = ?")
                    params.append(team)
                if bio.get("dob"):
                    updates.append("dob = ?")
                    params.append(bio["dob"])
                if bio.get("shoots"):
                    updates.append("shoots = ?")
                    params.append(bio["shoots"])
                if position and position != "F":
                    updates.append("position = ?")
                    params.append(position)
                if updates:
                    params.append(player_id)
                    conn.execute(f"UPDATE players SET {', '.join(updates)} WHERE id = ?", params)
                updated += 1
            else:
                # Create new player
                player_id = gen_id()
                conn.execute(
                    """INSERT INTO players (id, org_id, first_name, last_name, position, shoots,
                       current_team, current_league, dob)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (player_id, org_id, first_name, last_name, position,
                     bio.get("shoots", ""), team, "GOJHL", bio.get("dob", ""))
                )
                # Add to existing list for matching remaining rows
                existing_list.append({"id": player_id, "first_name": first_name, "last_name": last_name, "current_team": team, "position": position})
                created += 1

            # Parse stats
            core, extended = _parse_instat_row(row, INSTAT_SKATER_CORE_MAP, INSTAT_SKATER_EXTENDED_MAP)

            # Delete existing InStat season stats for this player/season (replace)
            conn.execute(
                "DELETE FROM player_stats WHERE player_id = ? AND season = ? AND data_source IN ('instat_league', 'instat_team')",
                (player_id, season)
            )

            # Insert stats
            conn.execute(
                """INSERT INTO player_stats (id, player_id, season, stat_type, gp, g, a, p,
                   plus_minus, pim, toi_seconds, shots, sog, shooting_pct,
                   extended_stats, data_source)
                   VALUES (?, ?, ?, 'season', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'instat_league')""",
                (gen_id(), player_id, season,
                 core.get("gp", 0), core.get("g", 0), core.get("a", 0), core.get("p", 0),
                 core.get("plus_minus", 0), core.get("pim", 0), core.get("toi_seconds", 0),
                 core.get("shots", 0), core.get("sog", 0), core.get("shooting_pct"),
                 json.dumps(extended) if extended else None)
            )
            stats_imported += 1
            _affected_player_ids.add(player_id)

        except Exception as e:
            errors.append(f"Row {i+1} ({full_name}): {str(e)}")

    conn.commit()
    conn.close()
    return {"players_created": created, "players_updated": updated, "stats_imported": stats_imported, "errors": errors, "player_ids": list(_affected_player_ids)}


def _import_league_goalies(rows, season, org_id):
    """Import league-level goalie stats."""
    conn = get_db()
    created = 0
    updated = 0
    stats_imported = 0
    errors = []
    _affected_player_ids = set()

    existing_players = conn.execute(
        "SELECT id, first_name, last_name, current_team, position FROM players WHERE org_id = ?",
        (org_id,)
    ).fetchall()
    existing_list = [dict(p) for p in existing_players]

    for i, row in enumerate(rows):
        try:
            full_name = row.get("player", "").strip()
            if not full_name:
                errors.append(f"Row {i+1}: missing player name")
                continue

            parts = full_name.split(None, 1)
            first_name = parts[0] if parts else full_name
            last_name = parts[1] if len(parts) > 1 else ""
            team = row.get("team", "").strip()

            # Bio
            bio = {}
            for header, field in INSTAT_SKATER_BIO_MAP.items():
                val = _clean_instat_val(row.get(header))
                if val:
                    bio[field] = val

            # Match player
            player_id = None
            csv_name = f"{first_name} {last_name}".lower()
            for ep in existing_list:
                existing_name = f"{ep['first_name']} {ep['last_name']}".lower()
                if _fuzzy_name_match(csv_name, existing_name) >= 0.85:
                    player_id = ep["id"]
                    break

            if player_id:
                updated += 1
                # Update position to G
                conn.execute("UPDATE players SET position = 'G' WHERE id = ?", (player_id,))
            else:
                player_id = gen_id()
                conn.execute(
                    """INSERT INTO players (id, org_id, first_name, last_name, position, shoots,
                       current_team, current_league, dob)
                       VALUES (?, ?, ?, ?, 'G', ?, ?, ?, ?)""",
                    (player_id, org_id, first_name, last_name,
                     bio.get("shoots", ""), team, "GOJHL", bio.get("dob", ""))
                )
                existing_list.append({"id": player_id, "first_name": first_name, "last_name": last_name, "current_team": team, "position": "G"})
                created += 1

            # Parse goalie stats
            core, extended = _parse_instat_row(row, INSTAT_GOALIE_CORE_MAP, INSTAT_GOALIE_EXTENDED_MAP)

            # Delete existing InStat goalie stats
            conn.execute(
                "DELETE FROM goalie_stats WHERE player_id = ? AND season = ? AND data_source IN ('instat_league', 'instat_team')",
                (player_id, season)
            )

            conn.execute(
                """INSERT INTO goalie_stats (id, player_id, org_id, season, stat_type,
                   gp, toi_seconds, ga, sa, sv, sv_pct, gaa,
                   extended_stats, data_source)
                   VALUES (?, ?, ?, ?, 'season', ?, ?, ?, ?, ?, ?, ?, ?, 'instat_league')""",
                (gen_id(), player_id, org_id, season,
                 core.get("gp", 0), core.get("toi_seconds", 0),
                 core.get("ga", 0), core.get("sa", 0), core.get("sv", 0),
                 core.get("sv_pct"), core.get("gaa"),
                 json.dumps(extended) if extended else None)
            )
            stats_imported += 1
            _affected_player_ids.add(player_id)

        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")

    conn.commit()
    conn.close()
    return {"players_created": created, "players_updated": updated, "stats_imported": stats_imported, "errors": errors, "player_ids": list(_affected_player_ids)}


def _import_team_skaters(rows, season, team_name, org_id):
    """Import team-specific skater stats (same as league but all assigned to one team)."""
    # Team exports don't have a "team" column, so we inject it
    for row in rows:
        row["team"] = team_name
    return _import_league_skaters(rows, season, org_id)


def _import_team_goalies(rows, season, team_name, org_id):
    """Import team-specific goalie stats."""
    for row in rows:
        row["team"] = team_name
    return _import_league_goalies(rows, season, org_id)


def _import_lines(rows, season, team_name, line_type, org_id):
    """Import line combinations."""
    conn = get_db()
    stats_imported = 0
    errors = []

    # Clear existing lines for this team/season/type
    conn.execute(
        "DELETE FROM line_combinations WHERE org_id = ? AND LOWER(team_name) = LOWER(?) AND season = ? AND line_type = ?",
        (org_id, team_name, season, line_type)
    )

    for i, row in enumerate(rows):
        try:
            line_str = row.get("line", "").strip()
            if not line_str:
                errors.append(f"Row {i+1}: missing line data")
                continue

            player_refs = _parse_line_players(line_str)

            # Parse stats
            plus_minus = _clean_instat_val(row.get("plus/minus"))
            shifts = _instat_to_number(row.get("numbers_of_shifts")) or 0
            toi = _parse_mmss_to_seconds(_clean_instat_val(row.get("time_on_ice")) or "0")
            gf = _instat_to_number(row.get("goals")) or 0
            ga = _instat_to_number(row.get("opponent's_goals")) or 0

            # Extended stats (remaining columns)
            extended = {}
            for header, field in INSTAT_LINES_MAP.items():
                if field in ("plus_minus", "shifts", "toi_seconds", "goals_for", "goals_against"):
                    continue  # Already parsed as core
                val = _clean_instat_val(row.get(header))
                if val is not None:
                    if "time" in field and ":" in val:
                        extended[field] = _parse_mmss_to_seconds(val)
                    else:
                        extended[field] = _instat_to_number(val)

            conn.execute(
                """INSERT INTO line_combinations (id, org_id, team_name, season, line_type,
                   player_names, player_refs, plus_minus, shifts, toi_seconds,
                   goals_for, goals_against, extended_stats)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (gen_id(), org_id, team_name, season, line_type,
                 line_str, json.dumps(player_refs), plus_minus, shifts, toi,
                 gf, ga, json.dumps(extended) if extended else None)
            )
            stats_imported += 1

        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")

    conn.commit()
    conn.close()
    return {"stats_imported": stats_imported, "errors": errors}


# ============================================================
# TEMPLATES
# ============================================================

@app.get("/templates")
async def list_templates(token_data: dict = Depends(verify_token)):
    org_id = token_data["org_id"]
    conn = get_db()
    rows = conn.execute("""
        SELECT id, template_name, report_type, description, is_global, version, created_at
        FROM report_templates
        WHERE org_id = ? OR is_global = 1
        ORDER BY template_name
    """, (org_id,)).fetchall()
    conn.close()

    results = []
    for r in rows:
        d = dict(r)
        d["is_global"] = bool(d.get("is_global", 0))
        results.append(d)
    return results


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
async def health_check():
    try:
        conn = get_db()
        conn.execute("SELECT 1")
        conn.close()
        db_status = "connected"
    except Exception:
        db_status = "error"

    return {
        "status": "healthy",
        "database": db_status,
        "db_type": "sqlite",
        "timestamp": now_iso(),
        "version": "1.0.0",
    }


# ============================================================
# ANALYTICS
# ============================================================

@app.get("/analytics/overview")
async def analytics_overview(token_data: dict = Depends(verify_token)):
    """Platform overview stats: counts, averages, distributions."""
    org_id = token_data["org_id"]
    conn = get_db()

    # Total counts
    total_players = conn.execute("SELECT COUNT(*) FROM players WHERE org_id=?", (org_id,)).fetchone()[0]
    total_reports = conn.execute("SELECT COUNT(*) FROM reports WHERE org_id=?", (org_id,)).fetchone()[0]
    total_notes = conn.execute("SELECT COUNT(*) FROM scout_notes WHERE org_id=?", (org_id,)).fetchone()[0]
    total_teams = conn.execute("SELECT COUNT(*) FROM teams WHERE org_id=?", (org_id,)).fetchone()[0]

    # Players with stats (at least 5 GP)
    players_with_stats = conn.execute("""
        SELECT COUNT(DISTINCT ps.player_id)
        FROM player_stats ps
        JOIN players p ON p.id = ps.player_id
        WHERE p.org_id=? AND ps.gp >= 5
    """, (org_id,)).fetchone()[0]

    # Players with intelligence
    players_with_intel = conn.execute("""
        SELECT COUNT(DISTINCT pi.player_id)
        FROM player_intelligence pi
        JOIN players p ON p.id = pi.player_id
        WHERE p.org_id=?
    """, (org_id,)).fetchone()[0]

    # Position breakdown
    positions = conn.execute("""
        SELECT position, COUNT(*) as count
        FROM players WHERE org_id=?
        GROUP BY position ORDER BY count DESC
    """, (org_id,)).fetchall()

    # Reports by type
    reports_by_type = conn.execute("""
        SELECT report_type, COUNT(*) as count
        FROM reports WHERE org_id=?
        GROUP BY report_type ORDER BY count DESC
    """, (org_id,)).fetchall()

    # Reports by status
    reports_by_status = conn.execute("""
        SELECT status, COUNT(*) as count
        FROM reports WHERE org_id=?
        GROUP BY status ORDER BY count DESC
    """, (org_id,)).fetchall()

    conn.close()
    return {
        "total_players": total_players,
        "total_reports": total_reports,
        "total_notes": total_notes,
        "total_teams": total_teams,
        "players_with_stats": players_with_stats,
        "players_with_intelligence": players_with_intel,
        "position_breakdown": [dict(r) for r in positions],
        "reports_by_type": [dict(r) for r in reports_by_type],
        "reports_by_status": [dict(r) for r in reports_by_status],
    }


@app.get("/analytics/scoring-leaders")
async def analytics_scoring_leaders(
    limit: int = 20,
    position: str = None,
    team: str = None,
    min_gp: int = 5,
    token_data: dict = Depends(verify_token),
):
    """Top scorers with per-game rates — league leaderboard."""
    org_id = token_data["org_id"]
    conn = get_db()

    where = ["p.org_id = ?", "ps.gp >= ?"]
    params: list = [org_id, min_gp]

    if position:
        where.append("p.position = ?")
        params.append(position)
    if team:
        where.append("p.current_team = ?")
        params.append(team)

    rows = conn.execute(f"""
        SELECT p.id, p.first_name, p.last_name, p.position, p.current_team,
               ps.season, ps.gp, ps.g, ps.a, ps.p, ps.plus_minus, ps.pim,
               ROUND(CAST(ps.p AS REAL) / ps.gp, 2) as ppg,
               ROUND(CAST(ps.g AS REAL) / ps.gp, 2) as gpg,
               ROUND(CAST(ps.a AS REAL) / ps.gp, 2) as apg
        FROM players p
        JOIN player_stats ps ON p.id = ps.player_id
        WHERE {" AND ".join(where)}
        ORDER BY ps.p DESC, ppg DESC
        LIMIT ?
    """, params + [limit]).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/analytics/team-rankings")
async def analytics_team_rankings(token_data: dict = Depends(verify_token)):
    """Team aggregate stats: total goals, points, avg PPG, player counts."""
    org_id = token_data["org_id"]
    conn = get_db()

    rows = conn.execute("""
        SELECT p.current_team as team,
               COUNT(DISTINCT p.id) as roster_size,
               COUNT(DISTINCT CASE WHEN ps.gp >= 5 THEN p.id END) as qualified_players,
               SUM(ps.gp) as total_gp,
               SUM(ps.g) as total_goals,
               SUM(ps.a) as total_assists,
               SUM(ps.p) as total_points,
               ROUND(AVG(CASE WHEN ps.gp >= 5 THEN CAST(ps.p AS REAL) / ps.gp END), 2) as avg_ppg,
               ROUND(AVG(ps.plus_minus), 1) as avg_plus_minus,
               SUM(ps.pim) as total_pim
        FROM players p
        JOIN player_stats ps ON p.id = ps.player_id
        WHERE p.org_id = ? AND p.current_team IS NOT NULL AND p.current_team != ''
        GROUP BY p.current_team
        HAVING qualified_players >= 3
        ORDER BY total_points DESC
    """, (org_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/analytics/player-compare")
async def analytics_player_compare(
    player_ids: str,
    token_data: dict = Depends(verify_token),
):
    """Compare 2-5 players side-by-side. player_ids = comma-separated IDs."""
    org_id = token_data["org_id"]
    ids = [pid.strip() for pid in player_ids.split(",") if pid.strip()][:5]
    if not ids:
        raise HTTPException(status_code=400, detail="Provide at least one player_id")

    conn = get_db()
    results = []
    for pid in ids:
        player = conn.execute(
            "SELECT id, first_name, last_name, position, current_team, dob FROM players WHERE id=? AND org_id=?",
            (pid, org_id)
        ).fetchone()
        if not player:
            continue
        p = dict(player)

        # Best season stats
        stats = conn.execute("""
            SELECT season, gp, g, a, p, plus_minus, pim,
                   ROUND(CAST(p AS REAL) / NULLIF(gp, 0), 2) as ppg,
                   ROUND(CAST(g AS REAL) / NULLIF(gp, 0), 2) as gpg,
                   shooting_pct
            FROM player_stats WHERE player_id=? AND gp >= 5
            ORDER BY p DESC LIMIT 1
        """, (pid,)).fetchone()

        # Intelligence
        intel = conn.execute("""
            SELECT archetype, overall_grade, offensive_grade, defensive_grade,
                   skating_grade, hockey_iq_grade, compete_grade, strengths, development_areas
            FROM player_intelligence WHERE player_id=?
            ORDER BY version DESC LIMIT 1
        """, (pid,)).fetchone()

        p["stats"] = dict(stats) if stats else None
        if intel:
            i = dict(intel)
            for k in ("strengths", "development_areas"):
                try:
                    i[k] = json.loads(i[k]) if i[k] else []
                except (json.JSONDecodeError, TypeError):
                    i[k] = []
            p["intelligence"] = i
        else:
            p["intelligence"] = None

        results.append(p)

    conn.close()
    return results


@app.get("/analytics/position-stats")
async def analytics_position_stats(token_data: dict = Depends(verify_token)):
    """Average stats by position for league benchmarking."""
    org_id = token_data["org_id"]
    conn = get_db()

    rows = conn.execute("""
        SELECT p.position,
               COUNT(DISTINCT p.id) as player_count,
               ROUND(AVG(ps.gp), 1) as avg_gp,
               ROUND(AVG(ps.g), 1) as avg_g,
               ROUND(AVG(ps.a), 1) as avg_a,
               ROUND(AVG(ps.p), 1) as avg_p,
               ROUND(AVG(CAST(ps.p AS REAL) / NULLIF(ps.gp, 0)), 2) as avg_ppg,
               ROUND(AVG(CAST(ps.g AS REAL) / NULLIF(ps.gp, 0)), 2) as avg_gpg,
               ROUND(AVG(ps.plus_minus), 1) as avg_plus_minus,
               ROUND(AVG(ps.pim), 1) as avg_pim,
               MAX(ps.g) as max_goals,
               MAX(ps.p) as max_points,
               MAX(CAST(ps.p AS REAL) / NULLIF(ps.gp, 0)) as max_ppg
        FROM players p
        JOIN player_stats ps ON p.id = ps.player_id
        WHERE p.org_id = ? AND ps.gp >= 5
        GROUP BY p.position
        ORDER BY avg_ppg DESC
    """, (org_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/analytics/grade-distribution")
async def analytics_grade_distribution(token_data: dict = Depends(verify_token)):
    """Distribution of intelligence grades across all graded players."""
    org_id = token_data["org_id"]
    conn = get_db()

    grade_fields = ["overall_grade", "offensive_grade", "defensive_grade",
                    "skating_grade", "hockey_iq_grade", "compete_grade"]

    result = {}
    for field in grade_fields:
        rows = conn.execute(f"""
            SELECT pi.{field} as grade, COUNT(*) as count
            FROM player_intelligence pi
            JOIN players p ON p.id = pi.player_id
            WHERE p.org_id = ? AND pi.{field} IS NOT NULL AND pi.{field} != 'NR'
              AND pi.id IN (SELECT id FROM player_intelligence pi2
                            WHERE pi2.player_id = pi.player_id
                            ORDER BY pi2.version DESC LIMIT 1)
            GROUP BY pi.{field}
            ORDER BY count DESC
        """, (org_id,)).fetchall()
        result[field] = [dict(r) for r in rows]

    conn.close()
    return result


@app.get("/analytics/archetype-breakdown")
async def analytics_archetype_breakdown(token_data: dict = Depends(verify_token)):
    """Count of players by AI-assigned archetype."""
    org_id = token_data["org_id"]
    conn = get_db()

    rows = conn.execute("""
        SELECT pi.archetype, COUNT(DISTINCT pi.player_id) as count,
               ROUND(AVG(pi.archetype_confidence), 2) as avg_confidence
        FROM player_intelligence pi
        JOIN players p ON p.id = pi.player_id
        WHERE p.org_id = ? AND pi.archetype IS NOT NULL
          AND pi.id IN (SELECT id FROM player_intelligence pi2
                        WHERE pi2.player_id = pi.player_id
                        ORDER BY pi2.version DESC LIMIT 1)
        GROUP BY pi.archetype
        ORDER BY count DESC
    """, (org_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/analytics/scoring-distribution")
async def analytics_scoring_distribution(
    min_gp: int = 5,
    token_data: dict = Depends(verify_token),
):
    """Points-per-game distribution for histogram/scatter charts."""
    org_id = token_data["org_id"]
    conn = get_db()

    rows = conn.execute("""
        SELECT p.id, p.first_name, p.last_name, p.position, p.current_team,
               ps.gp, ps.g, ps.a, ps.p, ps.plus_minus,
               ROUND(CAST(ps.p AS REAL) / ps.gp, 3) as ppg,
               ROUND(CAST(ps.g AS REAL) / ps.gp, 3) as gpg
        FROM players p
        JOIN player_stats ps ON p.id = ps.player_id
        WHERE p.org_id = ? AND ps.gp >= ?
        ORDER BY ppg DESC
    """, (org_id, min_gp)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/analytics/tag-cloud")
async def analytics_tag_cloud(token_data: dict = Depends(verify_token)):
    """Frequency of scout note tags and intelligence tags across all players."""
    org_id = token_data["org_id"]
    conn = get_db()

    # Scout note tags
    note_rows = conn.execute("""
        SELECT tags FROM scout_notes WHERE org_id=?
    """, (org_id,)).fetchall()

    tag_counts = {}
    for row in note_rows:
        try:
            tags = json.loads(row["tags"]) if row["tags"] else []
        except (json.JSONDecodeError, TypeError):
            tags = []
        for tag in tags:
            tag_counts[tag] = tag_counts.get(tag, 0) + 1

    # Intelligence tags
    intel_rows = conn.execute("""
        SELECT pi.tags FROM player_intelligence pi
        JOIN players p ON p.id = pi.player_id
        WHERE p.org_id = ?
          AND pi.id IN (SELECT id FROM player_intelligence pi2
                        WHERE pi2.player_id = pi.player_id
                        ORDER BY pi2.version DESC LIMIT 1)
    """, (org_id,)).fetchall()

    intel_tag_counts = {}
    for row in intel_rows:
        try:
            tags = json.loads(row["tags"]) if row["tags"] else []
        except (json.JSONDecodeError, TypeError):
            tags = []
        for tag in tags:
            intel_tag_counts[tag] = intel_tag_counts.get(tag, 0) + 1

    conn.close()
    return {
        "scout_note_tags": [{"tag": k, "count": v} for k, v in sorted(tag_counts.items(), key=lambda x: -x[1])],
        "intelligence_tags": [{"tag": k, "count": v} for k, v in sorted(intel_tag_counts.items(), key=lambda x: -x[1])],
    }


# ============================================================
# PROSPECTX INDICES ENGINE
# ============================================================
# Six proprietary indices calculated from aggregate stats.
# Each index is 0-100 scale with league percentile context.
# These are ProspectX's competitive moat — no competitor has these.

def _calc_percentile(value: float, all_values: list) -> int:
    """Calculate percentile rank (0-100) of value within all_values."""
    if not all_values or value is None:
        return 0
    below = sum(1 for v in all_values if v < value)
    return min(99, max(1, round((below / len(all_values)) * 100)))


def _compute_prospectx_indices(player_stats: dict, position: str, league_stats: list) -> dict:
    """
    Compute 6 ProspectX Indices from aggregate stats.
    Returns dict with index values (0-100) + percentiles.

    Indices:
    1. SniperIndex      — Pure goal-scoring ability & finishing
    2. PlaymakerIndex   — Passing, assists, vision
    3. TransitionIndex   — Two-way play, offensive impact while being reliable
    4. DefensiveIndex    — Defensive reliability & impact
    5. CompeteIndex      — Physical engagement, discipline, toughness
    6. HockeyIQIndex     — Smart play indicators (efficiency, +/-, situation reads)
    """
    gp = max(player_stats.get("gp", 1), 1)
    g = player_stats.get("g", 0)
    a = player_stats.get("a", 0)
    p = player_stats.get("p", 0)
    pm = player_stats.get("plus_minus", 0)
    pim = player_stats.get("pim", 0)
    shots = player_stats.get("sog", 0) or player_stats.get("shots", 0) or 0
    shoot_pct = player_stats.get("shooting_pct", None)

    # Per-game rates
    gpg = g / gp
    apg = a / gp
    ppg = p / gp
    pm_pg = pm / gp
    pim_pg = pim / gp
    shots_pg = shots / gp if shots else 0

    # Calculate shooting % if not provided
    if shoot_pct is None and shots > 0:
        shoot_pct = (g / shots) * 100
    elif shoot_pct is None:
        shoot_pct = 0

    # Check for extended stats (InStat data)
    ext = player_stats.get("extended_stats", {}) or {}
    has_ext = bool(ext)
    puck_battles_won_pct = None
    takeaways = None
    entries_carry = None
    breakouts = None
    corsi_pct = None

    if has_ext:
        pb = ext.get("puck_battles", {})
        if pb:
            puck_battles_won_pct = pb.get("won_pct")
        rec = ext.get("recoveries", {})
        if rec:
            takeaways = rec.get("takeaways", 0)
        ent = ext.get("entries", {})
        if ent:
            entries_carry = ent.get("via_stickhandling", 0)
            breakouts = ent.get("breakouts_total", 0)
        adv = ext.get("advanced", {})
        if adv:
            corsi_pct = adv.get("corsi_pct")

    is_defense = position in ("D", "LD", "RD")

    # ── 1. SNIPER INDEX ────────────────────────────────────
    # Weights: GPG (35%), Shooting% (30%), Shots/GP (20%), Goal:Assist ratio (15%)
    goal_assist_ratio = g / max(a, 1) if g > 0 else 0
    sniper_raw = (
        min(gpg / 0.6, 1.0) * 35 +          # 0.6 GPG = max
        min(shoot_pct / 18, 1.0) * 30 +      # 18% = max
        min(shots_pg / 3.5, 1.0) * 20 +      # 3.5 SOG/GP = max
        min(goal_assist_ratio / 1.5, 1.0) * 15  # More goals than assists = sniper
    )
    if is_defense:
        sniper_raw = sniper_raw * 1.3  # Boost for D who score (harder to do)
    sniper_index = min(99, max(1, round(sniper_raw)))

    # ── 2. PLAYMAKER INDEX ─────────────────────────────────
    # Weights: APG (35%), Assist:Goal ratio (25%), PPG (20%), ext data (20%)
    assist_goal_ratio = a / max(g, 1) if a > 0 else 0
    playmaker_ext = 0
    if has_ext:
        passes = ext.get("passes", {})
        if passes:
            acc_pct = passes.get("accurate_pct", 0) or 0
            to_slot = passes.get("to_slot", 0) or 0
            playmaker_ext = min(acc_pct / 80, 1.0) * 10 + min(to_slot / (gp * 2), 1.0) * 10
    else:
        playmaker_ext = min(apg / 0.8, 1.0) * 20  # Fallback: just use APG more

    playmaker_raw = (
        min(apg / 1.0, 1.0) * 35 +             # 1.0 APG = max
        min(assist_goal_ratio / 2.5, 1.0) * 25 + # 2.5:1 A:G ratio = pure playmaker
        min(ppg / 1.2, 1.0) * 20 +               # Overall production matters
        playmaker_ext
    )
    playmaker_index = min(99, max(1, round(playmaker_raw)))

    # ── 3. TRANSITION INDEX ────────────────────────────────
    # Two-way impact — offensive contribution while maintaining defensive value
    # Weights: PPG (25%), +/- per game (30%), discipline (15%), ext data (30%)
    discipline_score = max(0, 1 - pim_pg / 3.0)  # 0 PIM = 1.0, 3 PIM/GP = 0.0

    transition_ext = 0
    if has_ext and entries_carry is not None and breakouts is not None:
        entries_pg = entries_carry / gp
        breakouts_pg = breakouts / gp
        transition_ext = (
            min(entries_pg / 3.0, 1.0) * 15 +    # Zone entry carry-ins
            min(breakouts_pg / 5.0, 1.0) * 15     # Breakout plays
        )
    elif corsi_pct and corsi_pct > 0:
        transition_ext = min(corsi_pct / 60, 1.0) * 30  # Corsi as proxy
    else:
        # Fallback: use +/- more heavily
        transition_ext = max(0, min((pm_pg + 0.5) / 1.0, 1.0)) * 30

    transition_raw = (
        min(ppg / 1.0, 1.0) * 25 +
        max(0, min((pm_pg + 0.5) / 1.5, 1.0)) * 30 +  # +/- centered at -0.5
        discipline_score * 15 +
        transition_ext
    )
    if is_defense:
        transition_raw = transition_raw * 1.1  # D bonus for transition play
    transition_index = min(99, max(1, round(transition_raw)))

    # ── 4. DEFENSIVE INDEX ─────────────────────────────────
    # Weights: +/- per game (35%), discipline (20%), ext data (45% if available)
    defense_ext = 0
    if has_ext:
        if puck_battles_won_pct and puck_battles_won_pct > 0:
            defense_ext += min(puck_battles_won_pct / 60, 1.0) * 20
        if takeaways and takeaways > 0:
            takeaways_pg = takeaways / gp
            defense_ext += min(takeaways_pg / 2.0, 1.0) * 15
        if corsi_pct and corsi_pct > 0:
            defense_ext += min(corsi_pct / 58, 1.0) * 10
    else:
        # Without extended stats, lean heavier on +/- and discipline
        defense_ext = max(0, min((pm_pg + 0.3) / 1.0, 1.0)) * 25 + discipline_score * 20

    defensive_raw = (
        max(0, min((pm_pg + 0.3) / 1.0, 1.0)) * 35 +
        discipline_score * 20 +
        defense_ext
    )
    if is_defense:
        defensive_raw = defensive_raw * 1.15  # D expected to grade higher
    defensive_index = min(99, max(1, round(defensive_raw)))

    # ── 5. COMPETE INDEX ───────────────────────────────────
    # Physical engagement, toughness, willingness to battle
    # Weights: PIM balance (30%), +/- (20%), ext data (50% if available)
    # Smart physicality: some PIMs are good (engaged), too many are bad
    pim_balance = 1.0 - abs(pim_pg - 0.8) / 2.0  # Optimal ~0.8 PIM/GP
    pim_balance = max(0, min(1, pim_balance))

    compete_ext = 0
    if has_ext:
        if puck_battles_won_pct and puck_battles_won_pct > 0:
            compete_ext += min(puck_battles_won_pct / 55, 1.0) * 25
        main = ext.get("main", {})
        hits = main.get("hits", 0) or 0
        if hits > 0:
            hits_pg = hits / gp
            compete_ext += min(hits_pg / 3.0, 1.0) * 15
        blocked = ext.get("shots", {}).get("shots_blocking", 0) or 0
        if blocked > 0:
            blocked_pg = blocked / gp
            compete_ext += min(blocked_pg / 2.0, 1.0) * 10
    else:
        # Without extended stats: use PIM as engagement proxy + production
        compete_ext = pim_balance * 30 + min(ppg / 0.8, 1.0) * 20

    compete_raw = (
        pim_balance * 30 +
        max(0, min((pm_pg + 0.3) / 0.8, 1.0)) * 20 +
        compete_ext
    )
    compete_index = min(99, max(1, round(compete_raw)))

    # ── 6. HOCKEY IQ INDEX ─────────────────────────────────
    # Smart player indicators: efficiency, +/- vs production, situation reads
    # High IQ = good +/- relative to ice time, efficient scoring, low turnovers
    efficiency = ppg / max(shots_pg, 0.5) if shots_pg > 0 else ppg  # Points per shot
    pm_vs_production = pm_pg / max(ppg, 0.1)  # +/- relative to offense

    iq_ext = 0
    if has_ext:
        passes = ext.get("passes", {})
        acc_pct = passes.get("accurate_pct", 0) or 0 if passes else 0
        rec = ext.get("recoveries", {})
        puck_losses = rec.get("puck_losses", 0) or 0 if rec else 0
        puck_losses_pg = puck_losses / gp if puck_losses > 0 else 0
        iq_ext = (
            min(acc_pct / 75, 1.0) * 15 +                      # Pass accuracy
            max(0, 1 - puck_losses_pg / 4.0) * 10 +            # Low turnovers
            (min(corsi_pct / 58, 1.0) * 10 if corsi_pct else 5)  # Possession
        )
    else:
        iq_ext = min(efficiency / 0.5, 1.0) * 20 + max(0, min(pm_vs_production / 2, 1.0)) * 15

    iq_raw = (
        min(efficiency / 0.4, 1.0) * 25 +           # Scoring efficiency
        max(0, min((pm_pg + 0.3) / 1.0, 1.0)) * 25 + # +/- as IQ proxy
        discipline_score * 15 +                       # Smart discipline
        iq_ext
    )
    iq_index = min(99, max(1, round(iq_raw)))

    # ── Compute league percentiles ─────────────────────────
    # Calculate same indices for all league players for percentile context
    league_sniper = []
    league_playmaker = []
    league_transition = []
    league_defensive = []
    league_compete = []
    league_iq = []

    for ls in league_stats:
        lgp = max(ls.get("gp", 1), 1)
        lg = ls.get("g", 0)
        la = ls.get("a", 0)
        lp = ls.get("p", 0)
        lpm = ls.get("plus_minus", 0)
        lpim = ls.get("pim", 0)
        lshots = ls.get("sog", 0) or ls.get("shots", 0) or 0
        lshoot = ls.get("shooting_pct", None)
        if lshoot is None and lshots > 0:
            lshoot = (lg / lshots) * 100
        elif lshoot is None:
            lshoot = 0

        lgpg = lg / lgp
        lapg = la / lgp
        lppg = lp / lgp
        lpm_pg = lpm / lgp
        lpim_pg = lpim / lgp
        lshots_pg = lshots / lgp if lshots else 0
        lgar = lg / max(la, 1) if lg > 0 else 0
        lagr = la / max(lg, 1) if la > 0 else 0
        ldisc = max(0, 1 - lpim_pg / 3.0)
        leff = lppg / max(lshots_pg, 0.5) if lshots_pg > 0 else lppg

        l_is_d = ls.get("position", "") in ("D", "LD", "RD")
        d_mult = 1.3 if l_is_d else 1.0
        d_mult2 = 1.1 if l_is_d else 1.0
        d_mult3 = 1.15 if l_is_d else 1.0

        s = min(99, max(1, round((min(lgpg/0.6,1)*35 + min(lshoot/18,1)*30 + min(lshots_pg/3.5,1)*20 + min(lgar/1.5,1)*15) * d_mult)))
        pm_val = min(99, max(1, round(min(lapg/1.0,1)*35 + min(lagr/2.5,1)*25 + min(lppg/1.2,1)*20 + min(lapg/0.8,1)*20)))
        t = min(99, max(1, round((min(lppg/1.0,1)*25 + max(0,min((lpm_pg+0.5)/1.5,1))*30 + ldisc*15 + max(0,min((lpm_pg+0.5)/1.0,1))*30) * d_mult2)))
        de = min(99, max(1, round((max(0,min((lpm_pg+0.3)/1.0,1))*35 + ldisc*20 + max(0,min((lpm_pg+0.3)/1.0,1))*25 + ldisc*20) * d_mult3)))
        lpim_b = max(0, min(1, 1-abs(lpim_pg-0.8)/2.0))
        co = min(99, max(1, round(lpim_b*30 + max(0,min((lpm_pg+0.3)/0.8,1))*20 + lpim_b*30 + min(lppg/0.8,1)*20)))
        iq = min(99, max(1, round(min(leff/0.4,1)*25 + max(0,min((lpm_pg+0.3)/1.0,1))*25 + ldisc*15 + min(leff/0.5,1)*20 + max(0,min(lpm_pg/max(lppg,0.1)/2,1))*15)))

        league_sniper.append(s)
        league_playmaker.append(pm_val)
        league_transition.append(t)
        league_defensive.append(de)
        league_compete.append(co)
        league_iq.append(iq)

    return {
        "sniper": {
            "value": sniper_index,
            "percentile": _calc_percentile(sniper_index, league_sniper),
            "label": "SniperIndex",
            "description": "Goal-scoring ability and finishing efficiency",
        },
        "playmaker": {
            "value": playmaker_index,
            "percentile": _calc_percentile(playmaker_index, league_playmaker),
            "label": "PlaymakerIndex",
            "description": "Passing, assists, and offensive vision",
        },
        "transition": {
            "value": transition_index,
            "percentile": _calc_percentile(transition_index, league_transition),
            "label": "TransitionIndex",
            "description": "Two-way impact and zone transition play",
        },
        "defensive": {
            "value": defensive_index,
            "percentile": _calc_percentile(defensive_index, league_defensive),
            "label": "DefensiveIndex",
            "description": "Defensive reliability and suppression",
        },
        "compete": {
            "value": compete_index,
            "percentile": _calc_percentile(compete_index, league_compete),
            "label": "CompeteIndex",
            "description": "Physical engagement and battle level",
        },
        "hockey_iq": {
            "value": iq_index,
            "percentile": _calc_percentile(iq_index, league_iq),
            "label": "HockeyIQIndex",
            "description": "Decision-making, efficiency, and smart play",
        },
    }


@app.get("/analytics/player-indices/{player_id}")
async def get_player_indices(player_id: str, token_data: dict = Depends(verify_token)):
    """Compute ProspectX Indices for a single player with league percentiles."""
    org_id = token_data["org_id"]
    conn = get_db()

    # Get player
    player = conn.execute(
        "SELECT * FROM players WHERE id=? AND org_id=?", (player_id, org_id)
    ).fetchone()
    if not player:
        conn.close()
        raise HTTPException(status_code=404, detail="Player not found")
    player = dict(player)

    # Get player's best season stats
    stats_row = conn.execute("""
        SELECT * FROM player_stats
        WHERE player_id=? AND gp >= 5
        ORDER BY p DESC LIMIT 1
    """, (player_id,)).fetchone()

    if not stats_row:
        conn.close()
        raise HTTPException(status_code=400, detail="Player has insufficient stats (min 5 GP)")

    player_stats = dict(stats_row)
    # Parse extended stats
    if player_stats.get("extended_stats"):
        try:
            player_stats["extended_stats"] = json.loads(player_stats["extended_stats"])
        except (json.JSONDecodeError, TypeError):
            player_stats["extended_stats"] = {}

    # Get all league stats for percentile calculations
    league_rows = conn.execute("""
        SELECT p.position, ps.gp, ps.g, ps.a, ps.p, ps.plus_minus, ps.pim,
               ps.shots, ps.sog, ps.shooting_pct, ps.extended_stats
        FROM players p
        JOIN player_stats ps ON p.id = ps.player_id
        WHERE p.org_id = ? AND ps.gp >= 5
        ORDER BY ps.p DESC
    """, (org_id,)).fetchall()

    league_stats = []
    for r in league_rows:
        d = dict(r)
        if d.get("extended_stats"):
            try:
                d["extended_stats"] = json.loads(d["extended_stats"])
            except (json.JSONDecodeError, TypeError):
                d["extended_stats"] = {}
        league_stats.append(d)

    conn.close()

    indices = _compute_prospectx_indices(player_stats, player.get("position", "F"), league_stats)

    return {
        "player_id": player_id,
        "player_name": f"{player.get('first_name', '')} {player.get('last_name', '')}",
        "position": player.get("position", "F"),
        "season": player_stats.get("season"),
        "gp": player_stats.get("gp", 0),
        "indices": indices,
        "has_extended_stats": bool(player_stats.get("extended_stats")),
    }


@app.get("/analytics/league-indices")
async def get_league_indices(
    min_gp: int = 10,
    limit: int = 50,
    position: str = None,
    token_data: dict = Depends(verify_token),
):
    """Compute ProspectX Indices for all qualified players — league-wide view."""
    org_id = token_data["org_id"]
    conn = get_db()

    where = ["p.org_id = ?", "ps.gp >= ?"]
    params: list = [org_id, min_gp]
    if position:
        where.append("p.position = ?")
        params.append(position)

    rows = conn.execute(f"""
        SELECT p.id, p.first_name, p.last_name, p.position, p.current_team,
               ps.gp, ps.g, ps.a, ps.p, ps.plus_minus, ps.pim,
               ps.shots, ps.sog, ps.shooting_pct, ps.extended_stats, ps.season
        FROM players p
        JOIN player_stats ps ON p.id = ps.player_id
        WHERE {" AND ".join(where)}
        ORDER BY ps.p DESC
        LIMIT ?
    """, params + [limit]).fetchall()

    all_stats = []
    for r in rows:
        d = dict(r)
        if d.get("extended_stats"):
            try:
                d["extended_stats"] = json.loads(d["extended_stats"])
            except (json.JSONDecodeError, TypeError):
                d["extended_stats"] = {}
        all_stats.append(d)

    conn.close()

    results = []
    for ps in all_stats:
        indices = _compute_prospectx_indices(ps, ps.get("position", "F"), all_stats)
        results.append({
            "player_id": ps["id"],
            "player_name": f"{ps.get('first_name', '')} {ps.get('last_name', '')}",
            "position": ps.get("position", "F"),
            "current_team": ps.get("current_team"),
            "gp": ps.get("gp", 0),
            "p": ps.get("p", 0),
            "indices": indices,
        })

    return results


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    logger.info("Starting ProspectX API (SQLite) on port %d", port)
    logger.info("Database: %s", DB_FILE)
    logger.info("API Docs: http://localhost:%d/docs", port)
    uvicorn.run(app, host="0.0.0.0", port=port)

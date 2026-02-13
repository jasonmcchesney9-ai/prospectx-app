"""
ProspectX API Server — SQLite Version
Zero external DB dependencies. Just SQLite + FastAPI.
"""

import json
import logging
import os
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

load_dotenv(override=True)

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

    conn.commit()

    # ── Migrations for existing databases ───────────────────
    # Add image_url column if it doesn't exist
    cols = [col[1] for col in conn.execute("PRAGMA table_info(players)").fetchall()]
    if "image_url" not in cols:
        conn.execute("ALTER TABLE players ADD COLUMN image_url TEXT")
        conn.commit()
        logger.info("Migration: added image_url column to players table")

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
seed_hockey_os()
seed_leagues()
seed_teams()


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
    created_at: str

# --- Reports ---
class ReportGenerateRequest(BaseModel):
    player_id: str
    report_type: str
    template_id: Optional[str] = None
    data_scope: Optional[Dict[str, Any]] = None

class ReportResponse(BaseModel):
    id: str
    org_id: str
    player_id: str
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


@app.get("/players", response_model=List[PlayerResponse])
async def list_players(
    search: Optional[str] = None,
    position: Optional[str] = None,
    team: Optional[str] = None,
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

    conn.execute("""
        INSERT INTO players (id, org_id, first_name, last_name, dob, position, shoots, height_cm, weight_kg,
                             current_team, current_league, passports, notes, tags, archetype, image_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        player_id, org_id, player.first_name, player.last_name, player.dob,
        player.position.upper(), player.shoots, player.height_cm, player.weight_kg,
        player.current_team, player.current_league,
        json.dumps(player.passports or []), player.notes, json.dumps(player.tags or []),
        player.archetype, player.image_url, now, now,
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

    conn.execute("""
        UPDATE players SET first_name=?, last_name=?, dob=?, position=?, shoots=?, height_cm=?, weight_kg=?,
                          current_team=?, current_league=?, passports=?, notes=?, tags=?, archetype=?, image_url=?, updated_at=?
        WHERE id = ? AND org_id = ?
    """, (
        player.first_name, player.last_name, player.dob, player.position.upper(), player.shoots,
        player.height_cm, player.weight_kg, player.current_team, player.current_league,
        json.dumps(player.passports or []), player.notes, json.dumps(player.tags or []),
        player.archetype, player.image_url, now_iso(), player_id, org_id,
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
            except Exception as e:
                errors.append(f"Row {i+1} ({player_name}): {str(e)}")

        conn.commit()
        conn.close()
        logger.info("InStat team stats ingested: %d rows", inserted)
        return {
            "detail": f"Imported {inserted} stat rows from InStat team stats",
            "inserted": inserted,
            "format": "instat_team_stats",
            "errors": errors[:10],
        }

    # ── Standard Format ───────────────────────────────────────────
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

    conn.commit()
    conn.close()

    logger.info("Stats ingested: %d rows for org %s (%d errors)", inserted, org_id, len(errors))
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
    """Get all reports for players on a specific team."""
    org_id = token_data["org_id"]
    decoded_name = team_name.replace("%20", " ")
    conn = get_db()
    rows = conn.execute("""
        SELECT r.* FROM reports r
        JOIN players p ON r.player_id = p.id
        WHERE r.org_id = ? AND LOWER(p.current_team) = LOWER(?)
        ORDER BY r.created_at DESC
    """, (org_id, decoded_name)).fetchall()
    conn.close()
    results = []
    for r in rows:
        d = dict(r)
        for json_field in ("output_json", "input_data"):
            if d.get(json_field) and isinstance(d[json_field], str):
                try:
                    d[json_field] = json.loads(d[json_field])
                except Exception:
                    pass
        results.append(d)
    return results


@app.post("/teams")
async def create_team(name: str, league: str = None, city: str = None, token_data: dict = Depends(verify_token)):
    org_id = token_data["org_id"]
    team_id = gen_id()
    conn = get_db()
    conn.execute(
        "INSERT INTO teams (id, org_id, name, league, city) VALUES (?, ?, ?, ?, ?)",
        (team_id, org_id, name, league, city),
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


@app.post("/reports/generate", response_model=ReportGenerateResponse)
async def generate_report(request: ReportGenerateRequest, token_data: dict = Depends(verify_token)):
    org_id = token_data["org_id"]
    user_id = token_data["user_id"]
    conn = get_db()

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

            # Gather player stats
            stats_rows = conn.execute(
                "SELECT * FROM player_stats WHERE player_id = ? ORDER BY season DESC, created_at DESC",
                (request.player_id,),
            ).fetchall()
            stats_list = []
            for sr in stats_rows:
                stats_list.append({
                    "season": sr["season"], "stat_type": sr["stat_type"],
                    "gp": sr["gp"], "g": sr["g"], "a": sr["a"], "p": sr["p"],
                    "plus_minus": sr["plus_minus"], "pim": sr["pim"],
                    "shots": sr["shots"], "sog": sr["sog"],
                    "shooting_pct": sr["shooting_pct"],
                    "toi_seconds": sr["toi_seconds"],
                })

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

            logger.info("Report input — stats: %d rows, notes: %d rows, team_system: %s",
                        len(stats_list), len(notes_list), "yes" if team_system else "no")

            input_data = {
                "player": player,
                "stats": stats_list,
                "scout_notes": notes_list,
                "request_scope": request.data_scope,
            }
            if team_system:
                input_data["team_system"] = team_system

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
- Data-driven: Reference specific stats (GP, G, A, P, +/-, PIM, S%, etc.) when available
- Tactically literate: Use real hockey language — forecheck roles (F1/F2/F3), transition play, gap control, cycle game, net-front presence, breakout patterns, DZ coverage
- Professionally formatted: Use ALL_CAPS_WITH_UNDERSCORES section headers (e.g., EXECUTIVE_SUMMARY, KEY_NUMBERS, STRENGTHS, DEVELOPMENT_AREAS, SYSTEM_FIT, PROJECTION, BOTTOM_LINE)
- Specific to position: Tailor analysis to the player's position (center, wing, defense, goalie)
- Honest and balanced: Don't inflate or deflate — give an accurate, scout-grade assessment
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
        player_id=report["player_id"],
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
    token_data: dict = Depends(verify_token),
):
    """Upload a CSV or Excel file, parse it, detect duplicates, return preview for admin review."""
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
# MAIN
# ============================================================

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    logger.info("Starting ProspectX API (SQLite) on port %d", port)
    logger.info("Database: %s", DB_FILE)
    logger.info("API Docs: http://localhost:%d/docs", port)
    uvicorn.run(app, host="0.0.0.0", port=port)

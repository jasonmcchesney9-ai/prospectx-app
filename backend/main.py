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
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
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

    conn.commit()
    conn.close()
    logger.info("SQLite database initialized: %s", DB_FILE)


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


# Run on import
init_db()
seed_templates()


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
                             current_team, current_league, passports, notes, tags, archetype, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        player_id, org_id, player.first_name, player.last_name, player.dob,
        player.position.upper(), player.shoots, player.height_cm, player.weight_kg,
        player.current_team, player.current_league,
        json.dumps(player.passports or []), player.notes, json.dumps(player.tags or []),
        player.archetype, now, now,
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
                          current_team=?, current_league=?, passports=?, notes=?, tags=?, archetype=?, updated_at=?
        WHERE id = ? AND org_id = ?
    """, (
        player.first_name, player.last_name, player.dob, player.position.upper(), player.shoots,
        player.height_cm, player.weight_kg, player.current_team, player.current_league,
        json.dumps(player.passports or []), player.notes, json.dumps(player.tags or []),
        player.archetype, now_iso(), player_id, org_id,
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
        conn.close()
        logger.info("InStat game log ingested: %d games for %s %s", inserted, player["first_name"], player["last_name"])
        return {
            "detail": f"Imported {inserted} game stats from InStat game log",
            "inserted": inserted,
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

@app.get("/teams")
async def list_teams(token_data: dict = Depends(verify_token)):
    org_id = token_data["org_id"]
    conn = get_db()
    rows = conn.execute("SELECT * FROM teams WHERE org_id = ? ORDER BY name", (org_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


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

            logger.info("Report input — stats: %d rows, notes: %d rows", len(stats_list), len(notes_list))

            input_data = {
                "player": player,
                "stats": stats_list,
                "scout_notes": notes_list,
                "request_scope": request.data_scope,
            }

            report_type_name = template["template_name"]
            system_prompt = f"""You are ProspectX, an elite hockey scouting intelligence engine. You produce professional-grade scouting reports used by NHL scouts, junior hockey GMs, agents, and player development staff.

Generate a **{report_type_name}** for the player below. Your report must be:
- Data-driven: Reference specific stats (GP, G, A, P, +/-, PIM, S%, etc.) when available
- Analytically rigorous: Project trends, identify strengths/weaknesses, compare to level benchmarks
- Professionally formatted: Use ALL_CAPS_WITH_UNDERSCORES section headers (e.g., EXECUTIVE_SUMMARY, KEY_NUMBERS, STRENGTHS, DEVELOPMENT_AREAS, PROJECTION, BOTTOM_LINE)
- Specific to position: Tailor analysis to the player's position (center, wing, defense, goalie)
- Honest and balanced: Don't inflate or deflate — give an accurate, scout-grade assessment

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

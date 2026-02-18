# CLAUDE.md — ProspectX Intelligence Platform

## Project Overview

ProspectX is a **decision-grade hockey intelligence platform** with a built-in Hockey Operating System (Hockey OS). It helps GMs, scouts, coaches, agents, and player development staff analyze players within team-specific tactical structures — not just stats, but system-specific fit and deployment analysis.

**Key capabilities:**
- AI-powered scouting reports (24+ report types) via Anthropic Claude
- "Bench Talk" — an AI chat assistant for hockey operations questions
- HockeyTech live data integration (OHL, GOJHL, OJHL, WHL, QMJHL, PWHL)
- Game plans, series planning, practice plans, and drill library
- Player management with CSV/XLSX import, stat ingestion, and data corrections
- Team system analysis (19+ professional tactical structures)
- Analytics dashboard with PXI (ProspectX Index) scoring
- Subscription-based access tiers (Rookie, Novice, Pro, Team, AAA Org)

## Tech Stack

### Frontend
- **Framework:** Next.js 16 (App Router) with React 19
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS 4 with custom CSS variables
- **Fonts:** Oswald (headings) + Source Serif 4 (body) via Google Fonts
- **Charts:** Recharts
- **HTTP Client:** Axios with JWT interceptors
- **Icons:** Lucide React
- **Build:** Standalone output mode for Docker deployment

### Backend
- **Framework:** FastAPI (Python 3.11)
- **Database:** SQLite (stored at `~/.prospectx/prospectx.db`)
- **Auth:** JWT (PyJWT) + bcrypt password hashing (passlib)
- **AI:** Anthropic Claude API for report generation and Bench Talk
- **Background tasks:** Celery + Redis
- **External data:** HockeyTech API (httpx client)
- **File handling:** python-multipart, openpyxl (Excel)

### Infrastructure
- **Containerization:** Docker with docker-compose (4 services: frontend, backend, celery, redis)
- **Data persistence:** Docker volume `prospectx-data` at `/root/.prospectx`

## Directory Structure

```
prospectx-app/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout (BenchTalkProvider + ContentWrapper)
│   ├── page.tsx            # Landing page (unauth) / Dashboard (auth)
│   ├── globals.css         # Global styles, CSS variables, print styles
│   ├── login/              # Login page
│   ├── pricing/            # Subscription tiers
│   ├── players/            # Player list, detail, import, manage, create
│   ├── teams/              # Team views + roster import
│   ├── leagues/            # League standings/scorebar
│   ├── reports/            # Report generation, custom builder, detail
│   ├── game-plans/         # Chalk Talk game plans
│   ├── series/             # Series plan management
│   ├── practice-plans/     # Practice plan generation
│   ├── drills/             # Drill library
│   ├── scouting/           # Scouting list
│   ├── analytics/          # Analytics dashboard
│   ├── team-systems/       # Hockey OS team system profiles
│   ├── bench-talk/         # Bench Talk full page
│   ├── glossary/           # Hockey glossary
│   ├── instat/             # InStat XLSX import
│   ├── corrections/        # Data correction review
│   └── my-data/            # User data summary
├── components/             # Shared React components
│   ├── NavBar.tsx          # Main navigation
│   ├── BenchTalkProvider.tsx  # Context for Bench Talk drawer state
│   ├── BenchTalkDrawer.tsx    # AI chat drawer (Anthropic Claude)
│   ├── ContentWrapper.tsx     # Layout wrapper (NavBar + main)
│   ├── ProtectedRoute.tsx     # Auth guard component
│   ├── LandingPage.tsx        # Public marketing page
│   ├── PlayerCard.tsx         # Player card component
│   ├── VisualPlayerCard.tsx   # Enhanced visual player card
│   ├── ReportCard.tsx         # Report summary card
│   ├── ReportSection.tsx      # Report section renderer
│   ├── StatTable.tsx          # Player stat table
│   ├── ExtendedStatTable.tsx  # Extended stat view
│   ├── GoalieStatTable.tsx    # Goalie-specific stats
│   ├── GameLogTable.tsx       # Game-by-game log
│   ├── ProgressionChart.tsx   # Stat progression chart (Recharts)
│   ├── LineBuilder.tsx        # Line combination builder
│   ├── LineCombinations.tsx   # Line combination display
│   ├── UpgradeModal.tsx       # Subscription upgrade prompt
│   ├── PXIIcon.tsx            # ProspectX brand icon
│   └── BenchTalkIcon.tsx      # Bench Talk icon
├── lib/                    # Shared utilities
│   ├── api.ts              # Axios instance with JWT auth interceptors
│   └── auth.ts             # Token/user management (localStorage)
├── types/
│   └── api.ts              # TypeScript interfaces for all API types
├── backend/                # FastAPI backend (Python)
│   ├── main.py             # All API routes (monolithic, ~16K lines)
│   ├── schema.sql          # PostgreSQL reference schema (app uses SQLite)
│   ├── hockeytech.py       # HockeyTech API client (live league data)
│   ├── rink_diagrams.py    # SVG rink diagram generation for drills
│   ├── celery_worker.py    # Celery background task worker
│   ├── seed_templates.py   # Report template seeding
│   ├── test_hockeytech.py  # HockeyTech integration tests
│   └── requirements.txt    # Python dependencies
├── public/                 # Static assets (logo, SVGs)
├── docker-compose.yml      # Multi-service Docker setup
├── Dockerfile.frontend     # Multi-stage Next.js build
├── Dockerfile.backend      # Python 3.11 backend image
├── next.config.ts          # Next.js config (standalone, image remotePatterns)
├── tsconfig.json           # TypeScript config (strict, @/* path alias)
├── eslint.config.mjs       # ESLint (next/core-web-vitals + typescript)
├── postcss.config.mjs      # PostCSS with Tailwind CSS plugin
└── package.json            # Frontend dependencies and scripts
```

## Development Commands

### Frontend
```bash
npm run dev          # Start Next.js dev server (http://localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Backend
```bash
cd backend
pip install -r requirements.txt
python main.py       # Start FastAPI server (http://localhost:8000)
```

### Docker (full stack)
```bash
docker compose up --build        # Build & start all services
docker compose up -d             # Start in background
docker compose down              # Stop all services
docker compose down -v           # Stop & remove data (clean slate)
docker compose logs -f backend   # Tail backend logs
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:8000` | Backend API URL (baked into frontend at build) |
| `ANTHROPIC_API_KEY` | Yes (for AI) | `""` | Anthropic API key for Bench Talk and reports |
| `JWT_SECRET` | Yes (prod) | `prospectx_dev_secret_2026` | JWT signing secret |
| `FRONTEND_URL` | No | `http://localhost:3000` | Frontend URL for CORS |
| `REDIS_URL` | No | `redis://redis:6379/0` | Redis URL for Celery |
| `ENVIRONMENT` | No | `development` | Runtime environment |
| `PORT` | No | `8000` | Backend server port |

Store in `backend/.env` (gitignored).

## Architecture Patterns

### Authentication Flow
1. User registers/logs in via `/auth/register` or `/auth/login`
2. Backend returns JWT token + user object
3. Frontend stores token in `localStorage` via `lib/auth.ts`
4. Axios interceptor in `lib/api.ts` attaches `Authorization: Bearer <token>` to all requests
5. 401 responses automatically clear token and redirect to `/login`
6. `ProtectedRoute` component wraps authenticated pages

### Frontend Patterns
- **All pages are `"use client"`** — client-rendered SPA with App Router for routing
- **Path alias:** `@/*` maps to project root (e.g., `@/components/NavBar`)
- **State management:** React Context for Bench Talk drawer; local `useState` elsewhere
- **API calls:** All go through the `api` Axios instance from `lib/api.ts`
- **Landing vs Dashboard:** `app/page.tsx` shows `LandingPage` if unauthenticated, `Dashboard` if authenticated
- **Navigation:** `NavBar` with left items (Dashboard, Leagues, Teams), center Bench Talk toggle, right items (Players, Reports), plus Coaching and Import dropdown menus

### Backend Patterns
- **Monolithic:** All routes in `backend/main.py` (~16K lines)
- **SQLite:** Database at `~/.prospectx/prospectx.db`, initialized on startup via `_init_db()`
- **Auth:** JWT middleware via `get_current_user()` dependency
- **Subscription enforcement:** `_check_tier_permission()` and `_check_tier_limit()` gate features by tier
- **Usage tracking:** Monthly counters for reports, bench talks, practice plans, uploads
- **HockeyTech integration:** `hockeytech.py` fetches live data from league APIs, synced to local DB
- **AI reports:** Anthropic Claude generates structured JSON reports from player data + system prompts
- **File uploads:** Player images and team logos stored at `~/.prospectx/uploads/`

### Design System
- **Colors:** Navy `#0F2A3D`, Navy Light `#1A3F54`, Teal `#18B3A6` (accent), Orange `#F36F21` (brand), Background `#F0F4F8`, Card `#FFFFFF`, Border `#E2EAF3`
- **Typography:** Oswald (headings, uppercase tracking-wider), Source Serif 4 (body)
- **Components:** Tailwind utility classes, rounded-xl cards, white backgrounds, border-border
- **Branding:** "ProspectX" — teal "Prospect" + orange "X"
- **Print:** Dedicated print CSS for report PDF export via browser print

### Subscription Tiers
| Tier | Price | Reports | Bench Talk | Key Features |
|------|-------|---------|------------|-------------|
| Rookie | Free | 0 | 10/mo | Browse players, standings |
| Novice | $25/mo | 20/mo | 50/mo | Reports, practice plans, uploads |
| Pro | $49.99/mo | Unlimited | Unlimited | HockeyTech sync, live stats |
| Team | $299.99/mo | Unlimited | Unlimited | 5 seats, team sharing |
| AAA Org | $499/mo | Unlimited | Unlimited | 25 seats, multi-team |

## Key API Route Groups

| Prefix | Purpose |
|--------|---------|
| `/auth/*` | Register, login, profile, hockey role |
| `/subscription/*` | Tier info, usage, upgrade |
| `/players/*` | CRUD, search, filter, import, duplicates, merge, corrections |
| `/stats/*` | Player/goalie/team stats, progression, game logs |
| `/reports/*` | Generate AI reports, custom reports, CRUD |
| `/bench-talk/*` | AI chat conversations, context, suggestions |
| `/game-plans/*` | Chalk Talk game plans CRUD |
| `/series/*` | Playoff/series planning CRUD |
| `/practice-plans/*` | Practice plan generation and management |
| `/drills/*` | Drill library with rink diagrams |
| `/teams/*` | Team management, logos, roster |
| `/leagues` | League listings |
| `/analytics/*` | Dashboard analytics, PXI indices, scoring leaders |
| `/hockey-os/*` | Systems library, glossary, team systems |
| `/hockeytech/*` | Live data sync from HockeyTech leagues |
| `/scouting-list/*` | Scouting list management |
| `/import/*` | CSV/XLSX import preview and execution |
| `/my-data/*` | User data summary |
| `/health` | Health check endpoint |

## Supported Hockey Leagues (HockeyTech)

OHL, GOJHL, OJHL, WHL, QMJHL (LHJMQ), PWHL — with live roster sync, stat sync, game log sync, standings, and scorebar data.

## Coding Conventions

1. **TypeScript:** Strict mode. All API types in `types/api.ts`. Use interfaces for objects.
2. **Components:** Functional components with hooks. `"use client"` on all interactive pages.
3. **Styling:** Tailwind CSS utilities. Custom colors via CSS variables in `globals.css`. Use `font-oswald` for headings.
4. **File naming:** PascalCase for components (`PlayerCard.tsx`), camelCase for utilities (`api.ts`).
5. **Routing:** Next.js App Router with dynamic segments (`[id]`). Pages export default functions.
6. **API calls:** Always use the `api` instance from `@/lib/api`. Never hardcode URLs.
7. **Auth checks:** Wrap authenticated pages in `<ProtectedRoute>`. Use `getUser()` and `isAuthenticated()` from `@/lib/auth`.
8. **Backend:** All routes in `main.py`. Use `get_current_user` dependency for auth. Pydantic models for validation.
9. **Error handling:** Backend raises `HTTPException`. Frontend Axios interceptor handles 401 globally.
10. **Images:** Use `assetUrl()` and `hasRealImage()` from `@/lib/api` for player/team images.

## 🔴 MANDATORY RULES — DO NOT VIOLATE

These rules exist because working features have been destroyed multiple times. They are NON-NEGOTIABLE.

### Rule 1: ONLY touch files explicitly named in the spec
- If a spec says "change file A and file B", you touch ONLY file A and file B
- NEVER make "while I'm here" improvements to other files
- NEVER refactor, restyle, or reorganize files not listed in the spec
- If you think another file needs changes, STOP and ask the user first

### Rule 2: NEVER rewrite a file — make surgical edits only
- Use the Edit tool for targeted find-and-replace, not the Write tool to overwrite entire files
- If you need to change 3 lines in a 500-line file, change exactly those 3 lines
- NEVER rewrite, restructure, or "clean up" surrounding code
- NEVER change imports, styling, variable names, or formatting in lines you weren't asked to touch

### Rule 3: Before editing any file, read it first and state what you will change
- Read the current file content
- List the EXACT lines you plan to change and why
- Do NOT add, remove, or modify anything not in that list
- If a section of code is working, do not touch it even if you think it could be "better"

### Rule 4: NEVER change styling or borders unless the spec explicitly says to
- Do not change `border-border` to `border-teal/20` or any other color
- Do not change margins, padding, colors, or layout
- Do not "upgrade" or "enhance" visual appearance
- Styling changes have repeatedly broken the dashboard — treat all CSS as frozen unless told otherwise

### Rule 5: Verify before pushing — diff check required
- After ALL edits, run `git diff` and review EVERY changed line
- If the diff shows changes you weren't asked to make, REVERT those changes before committing
- The diff should contain ONLY the changes described in the spec — nothing more

### Rule 6: One spec = one commit. No scope creep.
- Each spec gets exactly one commit
- Do not bundle unrelated changes
- Do not "fix" things you notice along the way
- If you see a bug in another file, tell the user — do NOT fix it silently

### Rule 7: When told to revert a file, use `git checkout <commit> -- <file>`
- Do not manually try to undo changes line by line
- Use git to restore the exact file from the specified commit
- This prevents partial reverts and missed changes

### Rule 8: NEVER delete working features
- Sync buttons, dropdowns, filters, columns — if they exist and work, do not remove them
- If a spec doesn't mention a feature, that feature must survive unchanged
- Before committing, verify that existing functionality still exists in the diff

## Important Notes

- Backend `main.py` is a large monolithic file (~16K lines). All routes, DB setup, models, and logic live there.
- `schema.sql` is a PostgreSQL reference schema but the app runs SQLite. The SQLite schema is created in `_init_db()`.
- The `CUsersJASONM~1AppDataLocalTempopenapi.json` file in root is a Windows temp artifact — ignore it.
- The `hockey-reports/` directory is excluded in tsconfig — old prototype.
- `.env` files are gitignored. Create `backend/.env` with at minimum `ANTHROPIC_API_KEY` for AI features.

"""
HockeyTech API Client — Fetches live data from 20 HockeyTech-powered hockey leagues.

Supported leagues (by tier):
  Pro:       AHL, ECHL, SPHL, PWHL
  Major Jr:  OHL, WHL, QMJHL (LHJMQ)
  Junior A:  BCHL, AJHL, SJHL, MJHL, USHL, OJHL, CCHL, NOJHL, MHL, GOJHL
  Junior B:  KIJHL, PJHL, VIJHL

Base URL: https://lscluster.hockeytech.com/feed/index.php
Game Center: https://cluster.leaguestat.com/feed/index.php

Each league has a unique API key + client_code.
Keys found in: lscluster.hockeytech.com/statview-1.4.1/js/client/{client_code}/base.r2.js

Response structure:
  { "SiteKit": { "Parameters": {...}, "ViewName": [...], "Copyright": "..." } }
  Where ViewName is the capitalized view parameter (Seasons, Teamsbyseason, Roster, Scorebar, Statviewtype)
"""

import httpx
import logging
from typing import Optional

logger = logging.getLogger("hockeytech")

# ── League Configuration ─────────────────────────────────────────────
# Keys sourced from: lscluster.hockeytech.com/statview-1.4.1/js/client/{client_code}/base.r2.js
# Grouped by tier: Major Pro → Minor Pro → Major Junior → Junior A → Junior B/Rec

LEAGUES = {
    # ── Major Professional ──────────────────────────────────────────
    "ahl": {
        "name": "American Hockey League",
        "key": "ccb91f29d6744675",
        "client_code": "ahl",
    },
    "echl": {
        "name": "ECHL",
        "key": "2c2b89ea7345cae8",
        "client_code": "echl",
    },
    "sphl": {
        "name": "Southern Professional Hockey League",
        "key": "8fa10d218c49ec96",
        "client_code": "sphl",
    },
    "pwhl": {
        "name": "Professional Women's Hockey League",
        "key": "446521baf8c38984",
        "client_code": "pwhl",
    },

    # ── Major Junior (CHL) ─────────────────────────────────────────
    "ohl": {
        "name": "Ontario Hockey League",
        "key": "f1aa699db3d81487",
        "client_code": "ohl",
    },
    "whl": {
        "name": "Western Hockey League",
        "key": "41b145a848f4bd67",
        "client_code": "whl",
    },
    "lhjmq": {
        "name": "Quebec Major Junior Hockey League",
        "key": "02163f1eeecebec4",
        "client_code": "lhjmq",
    },

    # ── Junior A ────────────────────────────────────────────────────
    "bchl": {
        "name": "British Columbia Hockey League",
        "key": "f3ed30007ad2124e",
        "client_code": "bchl",
    },
    "ajhl": {
        "name": "Alberta Junior Hockey League",
        "key": "cbe60a1d91c44ade",
        "client_code": "ajhl",
    },
    "sjhl": {
        "name": "Saskatchewan Junior Hockey League",
        "key": "2fb5c2e84bf3e4a8",
        "client_code": "sjhl",
    },
    "mjhl": {
        "name": "Manitoba Junior Hockey League",
        "key": "f894c324fe5fd8f0",
        "client_code": "mjhl",
    },
    "ushl": {
        "name": "United States Hockey League",
        "key": "e828f89b243dc43f",
        "client_code": "ushl",
    },
    "ojhl": {
        "name": "Ontario Junior Hockey League",
        "key": "77a0bd73d9d363d3",
        "client_code": "ojhl",
    },
    "cchl": {
        "name": "Central Canada Hockey League",
        "key": "b370f3e6c805baf3",
        "client_code": "cchl",
    },
    "nojhl": {
        "name": "Northern Ontario Junior Hockey League",
        "key": "c1375ff55168bd71",
        "client_code": "nojhl",
    },
    "mhl": {
        "name": "Maritime Hockey League",
        "key": "4a948e7faf5ee58d",
        "client_code": "mhl",
    },
    "gojhl": {
        "name": "Greater Ontario Hockey League",
        "key": "34b10d4d34d7b59a",
        "client_code": "gojhl",
    },

    # ── Junior B / Rec ──────────────────────────────────────────────
    "kijhl": {
        "name": "Kootenay International Junior Hockey League",
        "key": "2589e0f644b1bb71",
        "client_code": "kijhl",
    },
    "pjhl": {
        "name": "Provincial Junior Hockey League",
        "key": "54ad32ee30e379ad",
        "client_code": "pjhlon",
    },
    "vijhl": {
        "name": "Vancouver Island Junior Hockey League",
        "key": "4f1a61df18906b61",
        "client_code": "vijhl",
    },
}

BASE_URL = "https://lscluster.hockeytech.com/feed/index.php"
GAME_CENTER_URL = "https://cluster.leaguestat.com/feed/index.php"
TIMEOUT = 15.0


class HockeyTechClient:
    """Async client for the HockeyTech / LeagueStat API."""

    def __init__(self, league: str):
        league = league.lower()
        if league not in LEAGUES:
            raise ValueError(f"Unknown league: {league}. Available: {list(LEAGUES.keys())}")
        cfg = LEAGUES[league]
        self.league = league
        self.league_name = cfg["name"]
        self.key = cfg["key"]
        self.client_code = cfg["client_code"]

    def _base_params(self) -> dict:
        return {
            "key": self.key,
            "client_code": self.client_code,
            "fmt": "json",
            "lang": "en",
        }

    async def _fetch(self, base_url: str, extra_params: dict) -> dict:
        """Make a GET request to HockeyTech and return the SiteKit dict."""
        params = {**self._base_params(), **extra_params}
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(base_url, params=params)
            resp.raise_for_status()
            data = resp.json()
            # HockeyTech wraps all modulekit responses in SiteKit
            if isinstance(data, dict) and "SiteKit" in data:
                return data["SiteKit"]
            return data

    async def _modulekit(self, view: str, **kwargs) -> dict:
        """Call modulekit feed. Returns the full SiteKit dict — caller extracts the correct key."""
        return await self._fetch(BASE_URL, {"feed": "modulekit", "view": view, **kwargs})

    # ── Seasons ───────────────────────────────────────────────────────

    async def get_seasons(self) -> list[dict]:
        """Get all seasons for the league."""
        data = await self._modulekit("seasons")
        # Response: SiteKit.Seasons = [...]
        seasons = data.get("Seasons", [])
        return [
            {
                "id": _safe_int(s.get("season_id")),
                "name": s.get("season_name", ""),
                "shortname": s.get("shortname", ""),
                "career": s.get("career") == "1",
                "playoff": s.get("playoff") == "1",
                "start_date": s.get("start_date"),
                "end_date": s.get("end_date"),
            }
            for s in seasons
        ]

    async def get_current_season_id(self) -> Optional[int]:
        """Get the most recent regular season ID.

        HockeyTech season naming is inconsistent:
        - OHL: "2025-26 Regular Season" (career=1), "2025-26 OHL Top Prospects" (career=0)
        - GOJHL: "2025-2026 GOJHL Season" (career=1), "2025-2026 Special Events" (career=0)
        - OJHL: "2025-2026 Regular Season" (career=1), "2026 All-Star" (career=0)

        Strategy: Find the first season whose name matches "Regular Season" or "{year} Season",
        excluding all-star, top prospects, pre-season, special events, etc.
        """
        seasons = await self.get_seasons()
        skip_keywords = {"pre-season", "preseason", "special", "all-star", "all star",
                         "top prospects", "showcase", "prospect"}

        def is_regular(name: str) -> bool:
            low = name.lower()
            if any(kw in low for kw in skip_keywords):
                return False
            # Must contain "season" (matches "Regular Season", "GOJHL Season", etc.)
            return "season" in low

        # Priority 1: name looks like regular season, non-playoff
        for s in seasons:
            if not s["playoff"] and is_regular(s["name"]):
                return s["id"]

        # Priority 2: any non-playoff season with "season" in name
        for s in seasons:
            if not s["playoff"] and "season" in s["name"].lower():
                return s["id"]

        # Fallback: first non-playoff
        for s in seasons:
            if not s["playoff"]:
                return s["id"]
        return seasons[0]["id"] if seasons else None

    # ── Teams ─────────────────────────────────────────────────────────

    async def get_teams(self, season_id: int) -> list[dict]:
        """Get all teams for a given season."""
        data = await self._modulekit("teamsbyseason", season_id=str(season_id))
        # Response: SiteKit.Teamsbyseason = [...]
        raw_teams = data.get("Teamsbyseason", [])
        return [
            {
                "id": _safe_int(t.get("id")),
                "name": t.get("name", ""),
                "code": t.get("code", ""),
                "city": t.get("city", ""),
                "nickname": t.get("nickname", ""),
                "division": t.get("division_long_name", "") or t.get("division_short_name", ""),
                "logo": t.get("team_logo_url", ""),
            }
            for t in raw_teams
        ]

    # ── Rosters ───────────────────────────────────────────────────────

    async def get_roster(self, team_id: int, season_id: int) -> list[dict]:
        """Get the roster for a team in a season."""
        data = await self._modulekit("roster", team_id=str(team_id), season_id=str(season_id))
        # Response: SiteKit.Roster = [...]
        raw = data.get("Roster", [])
        # Some responses nest players in sub-lists (e.g. by position group)
        flat = []
        for item in raw:
            if isinstance(item, list):
                flat.extend(item)
            elif isinstance(item, dict):
                flat.append(item)
        players = []
        for p in flat:
            players.append({
                "id": _safe_int(p.get("player_id") or p.get("id")),
                "first_name": p.get("first_name", ""),
                "last_name": p.get("last_name", ""),
                "name": p.get("name", ""),
                "jersey": p.get("tp_jersey_number", "") or p.get("jersey_number", ""),
                "position": p.get("position", ""),
                "shoots": p.get("shoots", ""),
                "dob": p.get("birthdate", "") or p.get("rawbirthdate", ""),
                "birthplace": p.get("birthplace", "") or p.get("homeplace", ""),
                "height": p.get("height", "") or p.get("height_hyphenated", ""),
                "weight": p.get("weight", ""),
                "rookie": p.get("rookie") == "1",
                "draft_status": p.get("draft_status", ""),
                "team_name": p.get("team_name", ""),
                "photo": p.get("player_image", ""),
            })
        return players

    # ── Player Stats ──────────────────────────────────────────────────

    async def get_skater_stats(self, season_id: int, team_id: Optional[int] = None,
                                sort: str = "points", limit: int = 100) -> list[dict]:
        """Get skater statistics. If team_id is None, returns full league stats."""
        params: dict = {
            "season_id": str(season_id),
            "sort": sort,
            "limit": str(limit),
            "type": "skaters",
        }
        if team_id:
            params["team_id"] = str(team_id)
        data = await self._modulekit("statviewtype", **params)
        # Response: SiteKit.Statviewtype = [...]
        raw = data.get("Statviewtype", [])

        players = []
        for r in raw:
            if not isinstance(r, dict) or "player_id" not in r:
                continue
            players.append({
                "player_id": _safe_int(r.get("player_id")),
                "name": r.get("name", ""),
                "first_name": r.get("first_name", ""),
                "last_name": r.get("last_name", ""),
                "team_name": r.get("team_name", ""),
                "team_code": r.get("team_code", ""),
                "team_id": _safe_int(r.get("team_id")),
                "position": r.get("position", ""),
                "jersey": r.get("jersey_number", ""),
                "age": r.get("age", ""),
                "shoots": r.get("shoots", ""),
                "gp": _safe_int(r.get("games_played")),
                "goals": _safe_int(r.get("goals")),
                "assists": _safe_int(r.get("assists")),
                "points": _safe_int(r.get("points")),
                "pim": _safe_int(r.get("penalty_minutes")),
                "plus_minus": _safe_int(r.get("plus_minus")),
                "ppg": _safe_int(r.get("power_play_goals")),
                "ppa": _safe_int(r.get("power_play_assists")),
                "shg": _safe_int(r.get("short_handed_goals")),
                "gwg": _safe_int(r.get("game_winning_goals")),
                "shots": _safe_int(r.get("shots")),
                "shooting_pct": r.get("shooting_percentage", ""),
                "rookie": "ht-rookie" in (r.get("flags") or []),
                "photo": r.get("player_image", ""),
                "logo": r.get("logo", ""),
            })
        return players

    async def get_top_scorers(self, season_id: int, limit: int = 50) -> list[dict]:
        """Get league-wide top scorers. Uses type=topscorers which returns cross-team leaders."""
        params: dict = {
            "season_id": str(season_id),
            "limit": str(limit),
            "type": "topscorers",
        }
        data = await self._modulekit("statviewtype", **params)
        raw = data.get("Statviewtype", [])

        players = []
        for r in raw:
            if not isinstance(r, dict) or "player_id" not in r:
                continue
            players.append({
                "player_id": _safe_int(r.get("player_id")),
                "name": r.get("name", ""),
                "first_name": r.get("first_name", ""),
                "last_name": r.get("last_name", ""),
                "team_name": r.get("team_name", ""),
                "team_code": r.get("team_code", ""),
                "team_id": _safe_int(r.get("team_id")),
                "position": r.get("position", ""),
                "jersey": r.get("jersey_number", ""),
                "age": r.get("age", ""),
                "shoots": r.get("shoots", ""),
                "gp": _safe_int(r.get("games_played")),
                "goals": _safe_int(r.get("goals")),
                "assists": _safe_int(r.get("assists")),
                "points": _safe_int(r.get("points")),
                "pim": _safe_int(r.get("penalty_minutes")),
                "plus_minus": _safe_int(r.get("plus_minus")),
                "ppg": _safe_int(r.get("power_play_goals")),
                "ppa": _safe_int(r.get("power_play_assists")),
                "shg": _safe_int(r.get("short_handed_goals")),
                "gwg": _safe_int(r.get("game_winning_goals")),
                "shots": _safe_int(r.get("shots")),
                "shooting_pct": r.get("shooting_percentage", ""),
                "rookie": "ht-rookie" in (r.get("flags") or []),
                "photo": r.get("photo", "") or r.get("player_image", ""),
                "logo": r.get("logo", ""),
            })
        return players

    async def get_goalie_stats(self, season_id: int, team_id: Optional[int] = None,
                                sort: str = "gaa", limit: int = 50) -> list[dict]:
        """Get goalie statistics."""
        params: dict = {
            "season_id": str(season_id),
            "sort": sort,
            "limit": str(limit),
            "type": "goalies",
        }
        if team_id:
            params["team_id"] = str(team_id)
        data = await self._modulekit("statviewtype", **params)
        raw = data.get("Statviewtype", [])

        goalies = []
        for r in raw:
            if not isinstance(r, dict) or "player_id" not in r:
                continue
            goalies.append({
                "player_id": _safe_int(r.get("player_id")),
                "name": r.get("name", ""),
                "team_name": r.get("team_name", ""),
                "team_code": r.get("team_code", ""),
                "gp": _safe_int(r.get("games_played")),
                "wins": _safe_int(r.get("wins")),
                "losses": _safe_int(r.get("losses")),
                "otl": _safe_int(r.get("ot_losses")),
                "gaa": r.get("goals_against_average", ""),
                "save_pct": r.get("save_percentage", ""),
                "shutouts": _safe_int(r.get("shutouts")),
                "minutes": r.get("minutes", ""),
                "shots_against": _safe_int(r.get("shots_against")),
                "saves": _safe_int(r.get("saves")),
                "photo": r.get("player_image", ""),
            })
        return goalies

    # ── Standings ─────────────────────────────────────────────────────

    async def get_standings(self, season_id: int) -> list[dict]:
        """Get league standings for a season."""
        data = await self._modulekit("statviewtype", type="standings",
                                      season_id=str(season_id), stat="conference")
        raw = data.get("Statviewtype", [])

        teams = []
        for r in raw:
            if not isinstance(r, dict) or "team_id" not in r:
                # Skip header rows (repeatheader entries)
                continue
            teams.append({
                "team_id": _safe_int(r.get("team_id")),
                "name": r.get("name", ""),
                "team_code": r.get("team_code", ""),
                "city": r.get("city", ""),
                "gp": _safe_int(r.get("games_played")),
                "wins": _safe_int(r.get("wins")),
                "losses": _safe_int(r.get("losses")),
                "otl": _safe_int(r.get("ot_losses")),
                "points": _safe_int(r.get("points")),
                "gf": _safe_int(r.get("goals_for")),
                "ga": _safe_int(r.get("goals_against")),
                "diff": _safe_int(r.get("goals_diff")),
                "pct": r.get("percentage", ""),
                "streak": r.get("past_10_wins", ""),
                "pp_pct": r.get("power_play_pct", ""),
                "pk_pct": r.get("penalty_kill_pct", ""),
                "regulation_wins": _safe_int(r.get("regulation_wins")),
            })
        return teams

    # ── Schedule / Scorebar ───────────────────────────────────────────

    async def get_scorebar(self, days_back: int = 1, days_ahead: int = 3) -> list[dict]:
        """Get recent and upcoming games from the scorebar."""
        data = await self._modulekit("scorebar",
                                      numberofdaysback=str(days_back),
                                      numberofdaysahead=str(days_ahead))
        # Response: SiteKit.Scorebar = [...]
        raw = data.get("Scorebar", [])
        games = []
        for g in raw:
            if not isinstance(g, dict):
                continue
            games.append({
                "game_id": _safe_int(g.get("ID")),
                "date": g.get("Date", ""),
                "game_date": g.get("GameDate", ""),
                "time": g.get("ScheduledFormattedTime", ""),
                "home_id": _safe_int(g.get("HomeID")),
                "home_team": g.get("HomeLongName", ""),
                "home_code": g.get("HomeCode", ""),
                "home_score": g.get("HomeGoals", ""),
                "home_logo": g.get("HomeLogo", ""),
                "away_id": _safe_int(g.get("VisitorID")),
                "away_team": g.get("VisitorLongName", ""),
                "away_code": g.get("VisitorCode", ""),
                "away_score": g.get("VisitorGoals", ""),
                "away_logo": g.get("VisitorLogo", ""),
                "status": g.get("GameStatusString", ""),
                "period": g.get("PeriodNameLong", ""),
                "game_clock": g.get("GameClock", ""),
                "venue": g.get("venue_name", ""),
            })
        return games

    # ── Player Profile ────────────────────────────────────────────────

    async def get_player_profile(self, player_id: int) -> dict:
        """Get detailed player profile."""
        data = await self._modulekit("player", category="profile", player_id=str(player_id))
        # Player profile may return raw SiteKit with various keys
        return data

    async def get_player_season_stats(self, player_id: int, season_id: int) -> dict:
        """Get player's stats for a specific season."""
        data = await self._modulekit("player", category="seasonstats",
                                      player_id=str(player_id), season_id=str(season_id))
        return data

    async def get_player_game_log(self, player_id: int, season_id: int) -> dict:
        """Get player's game-by-game log."""
        data = await self._modulekit("player", category="gamebygame",
                                      player_id=str(player_id), season_id=str(season_id))
        return data

    async def get_parsed_game_log(self, player_id: int, season_id: int) -> list[dict]:
        """Get player's game-by-game log, parsed into structured entries.

        Returns a list of dicts sorted by game_date ASC:
        {ht_game_id, game_date, opponent, home_away, goals, assists, points,
         plus_minus, pim, shots, ppg, shg, gwg, home_team, away_team, home_score, away_score}
        """
        data = await self.get_player_game_log(player_id, season_id)

        # HockeyTech returns SiteKit → varies by league, look for game log array
        # Common paths: data itself is a list, or nested under various keys
        games_raw = []
        if isinstance(data, list):
            games_raw = data
        elif isinstance(data, dict):
            # Try common SiteKit response keys
            for key in ("gamebyGame", "gamebygame", "gamebygameLog", "sections"):
                if key in data:
                    val = data[key]
                    if isinstance(val, list):
                        games_raw = val
                        break
                    elif isinstance(val, dict):
                        # Sometimes nested one more level
                        for subkey in ("data", "rows", "games"):
                            if subkey in val and isinstance(val[subkey], list):
                                games_raw = val[subkey]
                                break
                        if games_raw:
                            break
            # Also check for SiteKit wrapping
            if not games_raw:
                for top_key in data:
                    val = data[top_key]
                    if isinstance(val, list) and len(val) > 0 and isinstance(val[0], dict):
                        # Check if it looks like game data (has goals/assists keys)
                        sample = val[0]
                        if any(k in sample for k in ("goals", "Goals", "g", "G")):
                            games_raw = val
                            break

        parsed = []
        for g in games_raw:
            if not isinstance(g, dict):
                continue

            # Normalize field names (HT uses inconsistent casing)
            def _get(keys, default=None):
                for k in keys:
                    if k in g:
                        return g[k]
                return default

            ht_game_id = _safe_int(_get(["game_id", "GameID", "gameId", "id"]))
            game_date = _get(["date_played", "DatePlayed", "game_date", "GameDate", "date"], "")
            home_team = _get(["home_team", "HomeTeam", "HomeLongName", "home"], "")
            away_team = _get(["visitor_team", "VisitorTeam", "VisitorLongName", "away_team", "visitor", "away"], "")
            home_score = _safe_int(_get(["home_goals", "HomeGoals", "home_score"]))
            away_score = _safe_int(_get(["visitor_goals", "VisitorGoals", "away_score", "visitor_score"]))

            # Determine home/away and opponent
            # Some formats have "home" flag, others we detect by team matching
            home_away_flag = _get(["home_away", "HomeAway", "location", "home_visitor"])
            if home_away_flag:
                ha = str(home_away_flag).upper()
                home_away = "H" if ha in ("H", "HOME", "1") else "A"
                opponent = away_team if home_away == "H" else home_team
            else:
                # Default to away since most logs show opponent
                home_away = ""
                opponent = _get(["opponent", "Opponent", "opp", "OpponentName"], "")
                if not opponent:
                    opponent = away_team or home_team

            goals = _safe_int(_get(["goals", "Goals", "g", "G"])) or 0
            assists = _safe_int(_get(["assists", "Assists", "a", "A"])) or 0
            points = _safe_int(_get(["points", "Points", "p", "P"])) or (goals + assists)
            plus_minus = _safe_int(_get(["plus_minus", "PlusMinus", "plusMinus", "+/-"])) or 0
            pim = _safe_int(_get(["pim", "PIM", "penalty_minutes", "PenaltyMinutes"])) or 0
            shots = _safe_int(_get(["shots", "Shots", "sog", "SOG"])) or 0
            ppg_val = _safe_int(_get(["ppg", "PPG", "power_play_goals", "PowerPlayGoals"])) or 0
            shg_val = _safe_int(_get(["shg", "SHG", "short_handed_goals", "ShortHandedGoals"])) or 0
            gwg_val = _safe_int(_get(["gwg", "GWG", "game_winning_goals", "GameWinningGoals"])) or 0

            parsed.append({
                "ht_game_id": ht_game_id,
                "game_date": str(game_date).strip() if game_date else "",
                "opponent": str(opponent).strip(),
                "home_away": home_away,
                "goals": goals,
                "assists": assists,
                "points": points,
                "plus_minus": plus_minus,
                "pim": pim,
                "shots": shots,
                "ppg": ppg_val,
                "shg": shg_val,
                "gwg": gwg_val,
                "home_team": str(home_team).strip(),
                "away_team": str(away_team).strip(),
                "home_score": home_score,
                "away_score": away_score,
            })

        # Sort by game date ascending
        parsed.sort(key=lambda x: x.get("game_date", ""))
        return parsed

    # ── Game Center ───────────────────────────────────────────────────

    async def get_game_summary(self, game_id: int) -> dict:
        """Get full game summary from Game Center."""
        params = {
            **self._base_params(),
            "feed": "gc",
            "game_id": str(game_id),
            "tab": "gamesummary",
            "lang_code": "en",
        }
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(GAME_CENTER_URL, params=params)
            resp.raise_for_status()
            return resp.json()

    async def get_play_by_play(self, game_id: int) -> dict:
        """Get detailed play-by-play for a game."""
        params = {
            **self._base_params(),
            "feed": "gc",
            "game_id": str(game_id),
            "tab": "pxpverbose",
            "lang_code": "en",
        }
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(GAME_CENTER_URL, params=params)
            resp.raise_for_status()
            return resp.json()


def _safe_int(val) -> Optional[int]:
    """Safely convert a value to int, returning None on failure."""
    if val is None or val == "":
        return None
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None

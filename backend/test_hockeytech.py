"""
Test script for HockeyTech API integration.
Run: python test_hockeytech.py

Tests OHL, GOJHL, and OJHL data fetching.
"""

import asyncio
import json
import sys
from hockeytech import HockeyTechClient, LEAGUES


def banner(text: str):
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}")


def section(text: str):
    print(f"\n--- {text} ---")


async def test_league(league_code: str):
    """Test all endpoints for a given league."""
    banner(f"Testing {LEAGUES[league_code]['name']} ({league_code.upper()})")
    client = HockeyTechClient(league_code)
    errors = []

    # 1. Seasons
    section("Seasons")
    try:
        seasons = await client.get_seasons()
        regular = [s for s in seasons if not s["career"] and not s["playoff"]]
        print(f"  Total seasons: {len(seasons)}")
        print(f"  Regular seasons: {len(regular)}")
        if regular:
            latest = regular[0]
            print(f"  Current: {latest['name']} (id={latest['id']})")
            print(f"    Dates: {latest['start_date']} to {latest['end_date']}")
    except Exception as e:
        print(f"  ERROR: {e}")
        errors.append(f"Seasons: {e}")
        return errors

    # 2. Current season ID
    section("Current Season")
    try:
        season_id = await client.get_current_season_id()
        print(f"  Season ID: {season_id}")
    except Exception as e:
        print(f"  ERROR: {e}")
        errors.append(f"Current season: {e}")
        return errors

    # 3. Teams
    section(f"Teams (season {season_id})")
    team_id = None
    try:
        teams = await client.get_teams(season_id)
        print(f"  Total teams: {len(teams)}")
        for t in teams[:5]:
            print(f"    {t['id']:>4}  {t['name']:<30} {t['division']}")
        if len(teams) > 5:
            print(f"    ... and {len(teams) - 5} more")

        # Find Chatham Maroons for GOJHL or first team otherwise
        target = None
        for t in teams:
            if "chatham" in t["name"].lower():
                target = t
                break
        if not target and teams:
            target = teams[0]
        if target:
            team_id = target["id"]
            print(f"\n  Selected team: {target['name']} (id={team_id})")
    except Exception as e:
        print(f"  ERROR: {e}")
        errors.append(f"Teams: {e}")

    # 4. Roster
    if team_id:
        section(f"Roster (team {team_id})")
        try:
            roster = await client.get_roster(team_id, season_id)
            print(f"  Players on roster: {len(roster)}")
            for p in roster[:8]:
                print(f"    #{p['jersey']:>3}  {p['first_name']} {p['last_name']:<20} {p['position']:>3}  DOB: {p['dob']}")
            if len(roster) > 8:
                print(f"    ... and {len(roster) - 8} more")

            # Check for Ewan McChesney
            ewan = [p for p in roster if "mcchesney" in p["last_name"].lower()]
            if ewan:
                print(f"\n  ** Found: {ewan[0]['first_name']} {ewan[0]['last_name']} "
                      f"#{ewan[0]['jersey']} (HT player_id={ewan[0]['id']})")
        except Exception as e:
            print(f"  ERROR: {e}")
            errors.append(f"Roster: {e}")

    # 5. Skater stats
    section("Skater Stats (top 5)")
    try:
        stats = await client.get_skater_stats(season_id, limit=5)
        if stats:
            for s in stats[:5]:
                print(f"    {s.get('name', 'N/A'):<25} GP:{s.get('gp','?'):>3}  "
                      f"G:{s.get('goals','?'):>3}  A:{s.get('assists','?'):>3}  "
                      f"P:{s.get('points','?'):>3}  PIM:{s.get('pim','?'):>3}")
        else:
            print("  (empty result — stat parsing may need adjustment for this league)")
    except Exception as e:
        print(f"  ERROR: {e}")
        errors.append(f"Skater stats: {e}")

    # 6. Standings
    section("Standings")
    try:
        standings = await client.get_standings(season_id)
        if standings:
            print(f"  Teams in standings: {len(standings)}")
            for t in standings[:5]:
                print(f"    {t.get('team', 'N/A'):<6}  GP:{t.get('gp','?'):>3}  "
                      f"W:{t.get('wins','?'):>3}  L:{t.get('losses','?'):>3}  "
                      f"PTS:{t.get('points','?'):>3}")
            if len(standings) > 5:
                print(f"    ... and {len(standings) - 5} more")
        else:
            print("  (empty result — standings parsing may need adjustment)")
    except Exception as e:
        print(f"  ERROR: {e}")
        errors.append(f"Standings: {e}")

    # 7. Scorebar
    section("Scorebar (recent + upcoming)")
    try:
        games = await client.get_scorebar(days_back=3, days_ahead=3)
        print(f"  Games found: {len(games)}")
        for g in games[:3]:
            print(f"    {g.get('date', 'N/A')[:10]}  {g.get('away_team', '?')} {g.get('away_score', '')} "
                  f"@ {g.get('home_team', '?')} {g.get('home_score', '')}  [{g.get('status', '')}]")
        if len(games) > 3:
            print(f"    ... and {len(games) - 3} more")
    except Exception as e:
        print(f"  ERROR: {e}")
        errors.append(f"Scorebar: {e}")

    return errors


async def main():
    """Run tests for all three leagues."""
    banner("HockeyTech API Integration Test")
    print(f"Supported leagues: {', '.join(f'{k} ({v['name']})' for k, v in LEAGUES.items())}")

    all_errors = {}
    for league in ["ohl", "gojhl", "ojhl"]:
        errors = await test_league(league)
        if errors:
            all_errors[league] = errors

    # Summary
    banner("TEST SUMMARY")
    if all_errors:
        print("  ERRORS:")
        for league, errs in all_errors.items():
            for e in errs:
                print(f"    [{league.upper()}] {e}")
    else:
        print("  ALL TESTS PASSED - All three leagues responding!")

    print(f"\n  Leagues tested: OHL, GOJHL, OJHL")
    print(f"  Endpoints tested: seasons, teams, roster, skater stats, standings, scorebar")
    print()


if __name__ == "__main__":
    asyncio.run(main())

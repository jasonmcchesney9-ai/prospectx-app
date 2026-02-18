/**
 * League name formatting utility — single source of truth for display names.
 *
 * DB stores abbreviations (e.g. "GOHL", "OHL"). This maps them to
 * "ABBR — Full Name" for consistent display across the app.
 */

export interface LeagueInfo {
  abbr: string;
  full: string;
  code: string; // HockeyTech client_code (lowercase)
}

const LEAGUE_MAP: Record<string, LeagueInfo> = {
  // Professional
  AHL:   { abbr: "AHL",   full: "American Hockey League",                    code: "ahl" },
  ECHL:  { abbr: "ECHL",  full: "ECHL",                                     code: "echl" },
  SPHL:  { abbr: "SPHL",  full: "Southern Professional Hockey League",       code: "sphl" },
  PWHL:  { abbr: "PWHL",  full: "Professional Women's Hockey League",        code: "pwhl" },
  // Major Junior (CHL)
  OHL:   { abbr: "OHL",   full: "Ontario Hockey League",                     code: "ohl" },
  WHL:   { abbr: "WHL",   full: "Western Hockey League",                     code: "whl" },
  QMJHL: { abbr: "QMJHL", full: "Quebec Major Junior Hockey League",        code: "lhjmq" },
  LHJMQ: { abbr: "QMJHL", full: "Quebec Major Junior Hockey League",        code: "lhjmq" },
  // Junior A
  BCHL:  { abbr: "BCHL",  full: "British Columbia Hockey League",            code: "bchl" },
  AJHL:  { abbr: "AJHL",  full: "Alberta Junior Hockey League",              code: "ajhl" },
  SJHL:  { abbr: "SJHL",  full: "Saskatchewan Junior Hockey League",         code: "sjhl" },
  MJHL:  { abbr: "MJHL",  full: "Manitoba Junior Hockey League",             code: "mjhl" },
  USHL:  { abbr: "USHL",  full: "United States Hockey League",              code: "ushl" },
  OJHL:  { abbr: "OJHL",  full: "Ontario Junior Hockey League",              code: "ojhl" },
  CCHL:  { abbr: "CCHL",  full: "Central Canada Hockey League",              code: "cchl" },
  NOJHL: { abbr: "NOJHL", full: "Northern Ontario Junior Hockey League",     code: "nojhl" },
  MHL:   { abbr: "MHL",   full: "Maritime Hockey League",                    code: "mhl" },
  GOHL:  { abbr: "GOHL",  full: "Greater Ontario Hockey League",             code: "gojhl" },
  GOJHL: { abbr: "GOHL",  full: "Greater Ontario Hockey League",             code: "gojhl" },
  NAHL:  { abbr: "NAHL",  full: "North American Hockey League",              code: "nahl" },
  // Junior B
  KIJHL: { abbr: "KIJHL", full: "Kootenay International Junior Hockey League", code: "kijhl" },
  PJHL:  { abbr: "PJHL",  full: "Provincial Junior Hockey League",           code: "pjhl" },
  VIJHL: { abbr: "VIJHL", full: "Vancouver Island Junior Hockey League",     code: "vijhl" },
  // College / Other
  NCAA:  { abbr: "NCAA",  full: "National Collegiate Athletic Association",  code: "ncaa" },
  USHS:  { abbr: "USHS",  full: "US High School",                           code: "ushs" },
  AAA:   { abbr: "AAA",   full: "AAA Minor Hockey",                         code: "aaa" },
};

/**
 * Format a league abbreviation for display: "ABBR — Full Name"
 * Accepts DB values like "GOHL", "OHL", "GOJHL" (case-insensitive).
 * Returns the input unchanged if not found in the map.
 */
export function formatLeague(league: string | null | undefined): string {
  if (!league) return "";
  const info = LEAGUE_MAP[league.toUpperCase()];
  if (!info) return league; // Unknown league — return as-is
  return `${info.abbr} — ${info.full}`;
}

/**
 * Get just the abbreviation for a league (short display).
 * Normalizes GOJHL → GOHL, LHJMQ → QMJHL, etc.
 */
export function leagueAbbr(league: string | null | undefined): string {
  if (!league) return "";
  const info = LEAGUE_MAP[league.toUpperCase()];
  return info ? info.abbr : league;
}

/**
 * Get the full name for a league.
 */
export function leagueFull(league: string | null | undefined): string {
  if (!league) return "";
  const info = LEAGUE_MAP[league.toUpperCase()];
  return info ? info.full : league;
}

/**
 * Get the HockeyTech client code for a league.
 */
export function leagueCode(league: string | null | undefined): string {
  if (!league) return "";
  const info = LEAGUE_MAP[league.toUpperCase()];
  return info ? info.code : league.toLowerCase();
}

/**
 * Get league info by any identifier (abbreviation, code, or full name).
 */
export function getLeagueInfo(league: string | null | undefined): LeagueInfo | null {
  if (!league) return null;
  return LEAGUE_MAP[league.toUpperCase()] || null;
}

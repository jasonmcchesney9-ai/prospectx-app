// ============================================================
// ProspectX API Types
// ============================================================

export interface User {
  id: string;
  org_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  hockey_role: string;
  subscription_tier: string;
  monthly_reports_used: number;
  monthly_bench_talks_used: number;
  email_verified: boolean;
  onboarding_completed: boolean;
  onboarding_step: number;
  preferred_league: string | null;
  preferred_team_id: string | null;
  covered_teams: string[] | null;
}

export interface OnboardingState {
  onboarding_completed: boolean;
  onboarding_step: number;
  preferred_league: string | null;
  preferred_team_id: string | null;
  covered_teams: string[] | null;
  hockey_role: string;
  linked_player_id: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Player {
  id: string;
  org_id: string;
  first_name: string;
  last_name: string;
  dob: string | null;
  position: string;
  shoots: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  current_team: string | null;
  current_league: string | null;
  passports: string[];
  notes: string | null;
  tags: string[];
  archetype: string | null;
  image_url: string | null;
  elite_prospects_url: string | null;
  birth_year: number | null;
  age_group: string | null;
  draft_eligible_year: number | null;
  league_tier: string | null;
  commitment_status: string | null;
  roster_status: string;
  jersey_number: string | null;
  created_at: string;
}

export interface RosterPlayer extends Player {
  stats: {
    gp: number; g: number; a: number; p: number;
    plus_minus: number | null; pim: number | null; season: string | null;
  } | null;
  goalie_stats: {
    gp: number; ga: number; sv: number;
    gaa: number | null; sv_pct: string | null;
  } | null;
}

export interface PlayerFilterOptions {
  leagues: string[];
  teams: string[];
  birth_years: number[];
  age_groups: string[];
  league_tiers: string[];
  positions: string[];
  draft_years: number[];
  commitment_statuses: string[];
  shoots: string[];
  archetypes: string[];
  overall_grades: string[];
  height_range: { min: number; max: number } | null;
  weight_range: { min: number; max: number } | null;
}

export interface SavedSearch {
  id: string;
  org_id: string;
  user_id: string;
  name: string;
  filters: Record<string, string | number | boolean | null>;
  created_at: string;
}

export interface PlayerCreate {
  first_name: string;
  last_name: string;
  dob?: string;
  position: string;
  shoots?: string;
  height_cm?: number;
  weight_kg?: number;
  current_team?: string;
  current_league?: string;
  passports?: string[];
  notes?: string;
  tags?: string[];
  archetype?: string;
  commitment_status?: string;
  elite_prospects_url?: string;
}

// ── Player Card Data (enriched for visual cards) ──────────────
export interface PlayerCardData {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
  current_team: string | null;
  current_league: string | null;
  image_url: string | null;
  archetype: string | null;
  commitment_status: string | null;
  roster_status: string | null;
  age_group: string | null;
  birth_year: number | null;
  overall_grade: string | null;
  offensive_grade: string | null;
  defensive_grade: string | null;
  skating_grade: string | null;
  hockey_iq_grade: string | null;
  compete_grade: string | null;
  archetype_confidence: number | null;
  gp: number;
  g: number;
  a: number;
  p: number;
  tags: string[];
  metrics: {
    sniper: number;
    playmaker: number;
    transition: number;
    defensive: number;
    compete: number;
    hockey_iq: number;
  } | null;
}

// ── Commitment Status ────────────────────────────────────
export const COMMITMENT_STATUS_OPTIONS = [
  "Uncommitted",
  "Committed",
  "Verbal Commit",
  "Signed",
  "Draft Eligible",
  "Drafted",
  "Undrafted FA",
] as const;

export const COMMITMENT_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  "Uncommitted":     { bg: "bg-gray-100",   text: "text-gray-600" },
  "Committed":       { bg: "bg-green-100",  text: "text-green-700" },
  "Verbal Commit":   { bg: "bg-blue-100",   text: "text-blue-700" },
  "Signed":          { bg: "bg-green-200",  text: "text-green-800" },
  "Draft Eligible":  { bg: "bg-orange/10",  text: "text-orange" },
  "Drafted":         { bg: "bg-teal/10",    text: "text-teal" },
  "Undrafted FA":    { bg: "bg-amber-100",  text: "text-amber-700" },
};

// ── Player Status Tags → Badge Config ────────────────────────
// These tags, when present in a player's tags[] array, render as compact badges
export const PLAYER_STATUS_TAGS: Record<string, { label: string; abbr: string; bg: string; text: string; border: string; title: string }> = {
  rookie:     { label: "Rookie",     abbr: "R",  bg: "bg-blue-100",    text: "text-blue-700",    border: "border-blue-200",    title: "Rookie — First-year player" },
  injured:    { label: "Injured",    abbr: "IR", bg: "bg-red-100",     text: "text-red-700",     border: "border-red-200",     title: "Injured Reserve" },
  suspended:  { label: "Suspended",  abbr: "S",  bg: "bg-yellow-100",  text: "text-yellow-800",  border: "border-yellow-300",  title: "Suspended" },
  affiliate:  { label: "Affiliate",  abbr: "AP", bg: "bg-purple-100",  text: "text-purple-700",  border: "border-purple-200",  title: "Affiliate Player — On loan from another team" },
  import:     { label: "Import",     abbr: "I",  bg: "bg-orange/10",   text: "text-orange",      border: "border-orange/30",   title: "Import Player" },
  committed:  { label: "Committed",  abbr: "C",  bg: "bg-green-100",   text: "text-green-700",   border: "border-green-200",   title: "Committed to a program" },
};

export const PLAYER_STATUS_TAG_KEYS = Object.keys(PLAYER_STATUS_TAGS);

export interface Team {
  id: string;
  org_id: string;
  name: string;
  league: string | null;
  city: string | null;
  abbreviation: string | null;
  identity: Record<string, unknown>;
  logo_url: string | null;
  created_at: string;
}

export interface League {
  id: string;
  name: string;
  abbreviation: string;
  country: string;
  level: string;
  sort_order: number;
}

export interface TeamReference {
  id: string;
  org_id: string;
  name: string;
  league: string | null;
  city: string | null;
  abbreviation: string | null;
  logo_url: string | null;
  age_division: string | null;
  country: string | null;
}

export interface PlayerStats {
  id: string;
  player_id: string;
  game_id: string | null;
  season: string | null;
  stat_type: string;
  gp: number;
  g: number;
  a: number;
  p: number;
  plus_minus: number;
  pim: number;
  toi_seconds: number;
  pp_toi_seconds: number;
  pk_toi_seconds: number;
  shots: number;
  sog: number;
  shooting_pct: number | null;
  microstats: Record<string, unknown> | null;
  extended_stats: ExtendedStats | null;
  data_source: string | null;
  team_name: string | null;
  notes: string | null;
  created_at: string;
}

// ── Extended Stats (organized by category) ────────────────────
export interface ExtendedStats {
  main?: Record<string, number | string>;
  shots?: Record<string, number>;
  puck_battles?: Record<string, number>;
  recoveries?: Record<string, number>;
  special_teams?: Record<string, number>;
  xg?: Record<string, number>;
  passes?: Record<string, number>;
  entries?: Record<string, number>;
  advanced?: Record<string, number>;
  faceoffs_zone?: Record<string, number>;
  playtime?: Record<string, number>;
  scoring_chances?: Record<string, number>;
  team_extras?: Record<string, number>;
  // Team stats categories
  offense?: Record<string, number>;
  discipline?: Record<string, number>;
  faceoffs?: Record<string, number>;
  physical?: Record<string, number>;
  defense?: Record<string, number>;
  transition?: Record<string, number>;
  [key: string]: Record<string, number | string> | undefined;
}

export interface GoalieStats {
  id: string;
  player_id: string;
  org_id: string;
  season: string | null;
  stat_type: string;
  gp: number;
  toi_seconds: number;
  ga: number;
  sa: number;
  sv: number;
  sv_pct: string | null;
  gaa: number | null;
  extended_stats: ExtendedStats | null;
  data_source: string | null;
  created_at: string;
}

// ── Stats History & Game-by-Game Tracking ────────────────────
export interface PlayerStatsHistory {
  id: string;
  player_id: string;
  season: string | null;
  date_recorded: string;
  gp: number;
  g: number;
  a: number;
  p: number;
  plus_minus: number;
  pim: number;
  ppg: number;
  ppa: number;
  shg: number;
  gwg: number;
  shots: number;
  shooting_pct: number | null;
  data_source: string;
  league: string | null;
  team_name: string | null;
  synced_at: string;
  // Computed on read
  ppg_rate?: number;
  gpg_rate?: number;
  apg_rate?: number;
}

export interface PlayerGameStat {
  id: string;
  player_id: string;
  game_id: string | null;
  ht_game_id: number | null;
  game_date: string | null;
  opponent: string | null;
  home_away: string | null;
  goals: number;
  assists: number;
  points: number;
  plus_minus: number;
  pim: number;
  shots: number;
  ppg: number;
  shg: number;
  gwg: number;
  toi_seconds: number;
  season: string | null;
  league: string | null;
  data_source: string;
  created_at: string;
}

export interface Progression {
  seasons: PlayerStatsHistory[];
  trend: "improving" | "declining" | "stable" | "insufficient_data";
  yoy_delta: {
    p?: number;
    g?: number;
    a?: number;
    ppg_rate?: number;
  };
}

export interface RecentForm {
  last_n_games: number;
  games_found: number;
  games: PlayerGameStat[];
  totals: { g: number; a: number; p: number; pim: number; shots: number; plus_minus: number };
  averages: { gpg: number; apg: number; ppg: number };
  streak: string;
  goal_streak: string | null;
  source: "hockeytech" | "instat" | "none";
}

export interface GameStatsResponse {
  games: PlayerGameStat[];
  total: number;
  source: "hockeytech" | "instat" | "none";
}

export interface TeamStats {
  id: string;
  org_id: string;
  team_name: string;
  league: string | null;
  season: string | null;
  stat_type: string;
  extended_stats: ExtendedStats | null;
  data_source: string | null;
  created_at: string;
}

export interface LineCombination {
  id: string;
  org_id: string;
  team_name: string;
  season: string | null;
  line_type: string;
  line_label: string | null;
  line_order: number;
  player_names: string;
  player_refs: Array<{ jersey: string; name: string; player_id?: string; position?: string }> | null;
  plus_minus: string | null;
  shifts: number;
  toi_seconds: number;
  goals_for: number;
  goals_against: number;
  extended_stats: Record<string, unknown> | null;
  data_source: string | null;
  updated_at: string | null;
  created_at: string;
}

export interface LineCombinationCreate {
  team_name: string;
  season?: string;
  line_type: string;
  line_label?: string;
  line_order?: number;
  player_refs: Array<{
    player_id?: string;
    name: string;
    jersey?: string;
    position?: string;
  }>;
}

export interface LineCombinationUpdate {
  line_label?: string;
  line_order?: number;
  player_refs?: Array<{
    player_id?: string;
    name: string;
    jersey?: string;
    position?: string;
  }>;
}

export const LINE_SLOT_CONFIG: Record<string, Array<{ label: string; order: number; slots: number; positions: string[] }>> = {
  forwards: [
    { label: "1st Line", order: 1, slots: 3, positions: ["LW", "C", "RW"] },
    { label: "2nd Line", order: 2, slots: 3, positions: ["LW", "C", "RW"] },
    { label: "3rd Line", order: 3, slots: 3, positions: ["LW", "C", "RW"] },
    { label: "4th Line", order: 4, slots: 3, positions: ["LW", "C", "RW"] },
  ],
  defense: [
    { label: "1st Pair", order: 1, slots: 2, positions: ["LD", "RD"] },
    { label: "2nd Pair", order: 2, slots: 2, positions: ["LD", "RD"] },
    { label: "3rd Pair", order: 3, slots: 2, positions: ["LD", "RD"] },
  ],
  pp: [
    { label: "PP1", order: 1, slots: 5, positions: ["F", "F", "F", "D", "D"] },
    { label: "PP2", order: 2, slots: 5, positions: ["F", "F", "F", "D", "D"] },
  ],
  pk: [
    { label: "PK1", order: 1, slots: 4, positions: ["F", "F", "D", "D"] },
    { label: "PK2", order: 2, slots: 4, positions: ["F", "F", "D", "D"] },
  ],
};

export interface StatsImportResult {
  file_type: string;
  total_rows: number;
  players_created: number;
  players_updated: number;
  stats_imported: number;
  errors: string[];
  detected_team?: string;
  detected_opponent?: string;
  detected_date?: string;
  games_imported: number;
}

/** @deprecated Use StatsImportResult instead */
export type InStatImportResponse = StatsImportResult;

export interface Report {
  id: string;
  org_id: string;
  player_id: string | null;
  team_name: string | null;
  report_type: string;
  title: string | null;
  status: "pending" | "processing" | "complete" | "failed";
  output_json: Record<string, unknown> | null;
  output_text: string | null;
  error_message: string | null;
  generated_at: string | null;
  llm_model: string | null;
  llm_tokens: number | null;
  created_at: string;
  share_token?: string | null;
  shared_with_org?: boolean;
  quality_score?: number | null;
  quality_details?: string | null;
}

export interface ReportTemplate {
  id: string;
  template_name: string;
  report_type: string;
  description: string;
  is_global: boolean;
  version: number;
  created_at: string;
}

export interface ReportGenerateRequest {
  player_id?: string;
  team_name?: string;
  report_type: string;
  template_id?: string;
  data_scope?: Record<string, unknown>;
  mode?: PXIMode;
}

// PXI Mode System
export type PXIMode =
  | "scout" | "coach" | "analyst" | "gm" | "agent"
  | "parent" | "skill_coach" | "mental_coach" | "broadcast" | "producer";

export interface PXIModeInfo {
  id: PXIMode;
  name: string;
  primary_user: string;
  key_output: string;
  icon: string;
}

export interface ModeTemplateWiring {
  primary: PXIMode;
  secondary: PXIMode;
}

export interface TeamCreateRequest {
  name: string;
  league?: string;
  city?: string;
  abbreviation?: string;
}

export interface ReportGenerateResponse {
  report_id: string;
  status: string;
  title?: string;
  generation_time_ms?: number;
}

export interface ReportStatusResponse {
  report_id: string;
  status: string;
  error_message: string | null;
  generation_time_ms: number | null;
}

export interface StatsIngestResponse {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; error: string }>;
}

// --- Hockey Operating System ---
export interface SystemLibraryEntry {
  id: string;
  system_type: string;
  code: string;
  name: string;
  description: string;
  strengths: string;
  weaknesses: string;
  ideal_personnel: string;
}

export interface TeamSystem {
  id: string;
  org_id: string;
  team_id: string | null;
  team_name: string;
  season: string;
  forecheck: string;
  dz_structure: string;
  oz_setup: string;
  pp_formation: string;
  pk_formation: string;
  neutral_zone: string;
  breakout: string;
  identity_tags: string[];
  pace: string;
  physicality: string;
  offensive_style: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface GlossaryTerm {
  id: string;
  term: string;
  category: string;
  definition: string;
  aliases: string[];
  usage_context: string;
}

// --- Scout Notes ---

export type CompetitionLevel =
  | "U13_AAA" | "U14_AAA" | "U15_AAA" | "U16_AAA" | "U18_AAA"
  | "USHL" | "OHL" | "WHL" | "QMJHL" | "BCHL" | "NAHL"
  | "NCAA_D1" | "NCAA_D3" | "AHL" | "ECHL" | "PRO" | "OTHER";

export type ProspectStatus =
  | "TOP_TARGET" | "A_PROSPECT" | "B_PROSPECT"
  | "C_PROSPECT" | "FOLLOW_UP" | "PASS";

export type NoteVisibility = "PRIVATE" | "ORG_SHARED";
export type NoteMode = "QUICK" | "DETAILED";
export type GradeScale = "1-5" | "20-80";

export interface ScoutNote {
  id: string;
  org_id: string;
  player_id: string;
  scout_id: string;
  scout_name: string | null;
  note_text: string;
  note_type: string;
  tags: string[];
  is_private: boolean;
  created_at: string;
  updated_at: string;
  // v2 fields
  game_date: string | null;
  opponent: string | null;
  competition_level: CompetitionLevel | null;
  venue: string | null;
  overall_grade: number | null;
  grade_scale: GradeScale;
  skating_rating: number | null;
  puck_skills_rating: number | null;
  hockey_iq_rating: number | null;
  compete_rating: number | null;
  defense_rating: number | null;
  strengths_notes: string | null;
  improvements_notes: string | null;
  development_notes: string | null;
  one_line_summary: string | null;
  prospect_status: ProspectStatus | null;
  visibility: NoteVisibility;
  note_mode: NoteMode;
  // Joined display fields
  player_name?: string;
  player_team?: string;
  player_position?: string;
  author_name?: string;
}

export interface NoteCreate {
  player_id?: string;
  note_text?: string;
  note_type?: string;
  tags?: string[];
  is_private?: boolean;
  game_date?: string;
  opponent?: string;
  competition_level?: string;
  venue?: string;
  overall_grade?: number;
  grade_scale?: string;
  skating_rating?: number;
  puck_skills_rating?: number;
  hockey_iq_rating?: number;
  compete_rating?: number;
  defense_rating?: number;
  strengths_notes?: string;
  improvements_notes?: string;
  development_notes?: string;
  one_line_summary?: string;
  prospect_status?: string;
  visibility?: string;
  note_mode?: string;
}

export const NOTE_TYPE_LABELS: Record<string, string> = {
  general: "General",
  game: "Game",
  practice: "Practice",
  interview: "Interview",
};

export const NOTE_TAG_OPTIONS = [
  "skating", "shooting", "compete", "hockey_iq", "puck_skills", "positioning",
  "physicality", "speed", "vision", "leadership", "coachability", "work_ethic",
];

export const NOTE_TAG_LABELS: Record<string, string> = {
  skating: "Skating",
  shooting: "Shooting",
  compete: "Compete",
  hockey_iq: "Hockey IQ",
  puck_skills: "Puck Skills",
  positioning: "Positioning",
  physicality: "Physicality",
  speed: "Speed",
  vision: "Vision",
  leadership: "Leadership",
  coachability: "Coachability",
  work_ethic: "Work Ethic",
};

export const COMPETITION_LEVEL_LABELS: Record<string, string> = {
  U13_AAA: "U13 AAA", U14_AAA: "U14 AAA", U15_AAA: "U15 AAA",
  U16_AAA: "U16 AAA", U18_AAA: "U18 AAA",
  USHL: "USHL", OHL: "OHL", WHL: "WHL", QMJHL: "QMJHL",
  BCHL: "BCHL", NAHL: "NAHL",
  NCAA_D1: "NCAA D1", NCAA_D3: "NCAA D3",
  AHL: "AHL", ECHL: "ECHL", PRO: "Pro", OTHER: "Other",
};

export const PROSPECT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  TOP_TARGET: { label: "Top Target", color: "bg-red-100 text-red-700" },
  A_PROSPECT: { label: "A Prospect", color: "bg-orange/10 text-orange" },
  B_PROSPECT: { label: "B Prospect", color: "bg-teal/10 text-teal" },
  C_PROSPECT: { label: "C Prospect", color: "bg-blue-50 text-blue-600" },
  FOLLOW_UP: { label: "Follow Up", color: "bg-amber-50 text-amber-700" },
  PASS: { label: "Pass", color: "bg-gray-100 text-gray-500" },
};

// --- Batch Import ---
export interface ImportDuplicate {
  row_index: number;
  csv_name: string;
  csv_data: Record<string, string | null>;
  existing_id: string;
  existing_name: string;
  match_score: number;
  match_reasons: string[];
}

export interface ImportPreview {
  job_id: string;
  filename: string;
  total_rows: number;
  new_players: number;
  duplicates: ImportDuplicate[];
  errors: string[];
  preview: Record<string, string | null>[];
}

export interface ImportResult {
  detail: string;
  created: number;
  merged: number;
  skipped: number;
  errors: string[];
}

// Report section keys for parsing output_text
export const REPORT_SECTIONS = [
  "EXECUTIVE_SUMMARY",
  "KEY_NUMBERS",
  "STRENGTHS",
  "DEVELOPMENT_AREAS",
  "DEVELOPMENT_PRIORITIES",
  "ADVANCEMENT_TRIGGERS",
  "ROLE_FIT",
  "OPPONENT_CONTEXT",
  "NOTABLE_PERFORMANCES",
  "BOTTOM_LINE",
  // Unified Prospect extras
  "PROJECTION_RANGE",
  "SCOUTING_GRADES",
  "PROJECTION",
  "DRAFT_POSITIONING",
  "RISK_ASSESSMENT",
  // Goalie extras
  "TECHNICAL_ASSESSMENT",
  "MENTAL_GAME",
  "WORKLOAD_ANALYSIS",
  // Other report types
  "GAME_SUMMARY",
  "PLAYER_GRADES",
  "DEPLOYMENT_NOTES",
  "ADJUSTMENTS",
  "STANDOUT_PERFORMERS",
  "SEASON_OVERVIEW",
  "STATISTICAL_PROFILE",
  "TREND_ANALYSIS",
  "STRENGTHS_CONFIRMED",
  "CONCERNS_IDENTIFIED",
  "OFFSEASON_PRIORITIES",
  "CONTRACT_CONTEXT",
  // Hockey OS sections
  "SYSTEM_FIT",
  "SKATING_ASSESSMENT",
  "OFFENSIVE_GAME",
  "DEFENSIVE_GAME",
  "HOCKEY_SENSE",
  "PHYSICAL_PROFILE",
  "DEVELOPMENT_PROJECTION",
  "DRAFT_ELIGIBILITY",
  "DATA_LIMITATIONS",
] as const;

export const SECTION_LABELS: Record<string, string> = {
  EXECUTIVE_SUMMARY: "Executive Summary",
  KEY_NUMBERS: "Key Numbers",
  STRENGTHS: "Strengths",
  DEVELOPMENT_AREAS: "Development Areas",
  DEVELOPMENT_PRIORITIES: "Development Priorities",
  ADVANCEMENT_TRIGGERS: "Advancement Triggers",
  ROLE_FIT: "Role Fit",
  OPPONENT_CONTEXT: "Opponent Context",
  NOTABLE_PERFORMANCES: "Notable Performances",
  BOTTOM_LINE: "Bottom Line",
  PROJECTION_RANGE: "Projection Range",
  SCOUTING_GRADES: "Scouting Grades",
  PROJECTION: "Projection",
  DRAFT_POSITIONING: "Draft Positioning",
  RISK_ASSESSMENT: "Risk Assessment",
  TECHNICAL_ASSESSMENT: "Technical Assessment",
  MENTAL_GAME: "Mental Game",
  WORKLOAD_ANALYSIS: "Workload Analysis",
  GAME_SUMMARY: "Game Summary",
  PLAYER_GRADES: "Player Grades",
  DEPLOYMENT_NOTES: "Deployment Notes",
  ADJUSTMENTS: "Adjustments",
  STANDOUT_PERFORMERS: "Standout Performers",
  SEASON_OVERVIEW: "Season Overview",
  STATISTICAL_PROFILE: "Statistical Profile",
  TREND_ANALYSIS: "Trend Analysis",
  STRENGTHS_CONFIRMED: "Strengths Confirmed",
  CONCERNS_IDENTIFIED: "Concerns Identified",
  OFFSEASON_PRIORITIES: "Offseason Priorities",
  CONTRACT_CONTEXT: "Contract Context",
  CURRENT_ASSESSMENT: "Current Assessment",
  DEVELOPMENT_PILLARS: "Development Pillars",
  "30_DAY_PLAN": "30-Day Plan",
  "90_DAY_PLAN": "90-Day Plan",
  SEASON_GOALS: "Season Goals",
  MEASUREMENT_FRAMEWORK: "Measurement Framework",
  SUPPORT_TEAM: "Support Team",
  PLAYER_SNAPSHOT: "Player Snapshot",
  SEASON_HIGHLIGHTS: "Season Highlights",
  AREAS_FOR_GROWTH: "Areas for Growth",
  PATHWAY_OPTIONS: "Pathway Options",
  WHAT_SCOUTS_SEE: "What Scouts See",
  ACTION_ITEMS: "Action Items",
  PLAYER_PROFILE: "Player Profile",
  STATISTICAL_CASE: "Statistical Case",
  MARKET_POSITION: "Market Position",
  TALKING_POINTS: "Talking Points",
  DEVELOPMENT_TRAJECTORY: "Development Trajectory",
  RISK_MITIGATION: "Risk Mitigation",
  RECOMMENDATION: "Recommendation",
  // Hockey OS sections
  SYSTEM_FIT: "System Fit",
  SKATING_ASSESSMENT: "Skating Assessment",
  OFFENSIVE_GAME: "Offensive Game",
  DEFENSIVE_GAME: "Defensive Game",
  HOCKEY_SENSE: "Hockey Sense",
  PHYSICAL_PROFILE: "Physical Profile",
  DEVELOPMENT_PROJECTION: "Development Projection",
  DRAFT_ELIGIBILITY: "Draft Eligibility",
  DATA_LIMITATIONS: "Data Limitations",
  // Custom report sections
  TRANSITION_GAME: "Transition Game",
  COMPETE_LEVEL: "Compete Level",
  TRADE_VALUE: "Trade Value",
  DEVELOPMENT_PLAN: "Development Plan",
  COMPARABLE_PATHWAYS: "Comparable Pathways",
  DRAFT_ANALYSIS: "Draft Analysis",
  PEER_COMPARISON: "Peer Comparison",
  // Team report sections
  TEAM_IDENTITY: "Team Identity",
  ROSTER_ANALYSIS: "Roster Analysis",
  TACTICAL_SYSTEMS: "Tactical Systems",
  SPECIAL_TEAMS: "Special Teams",
  GAME_PLAN: "Game Plan",
  PRACTICE_PRIORITIES: "Practice Priorities",
  WEAKNESSES: "Weaknesses",
  LINE_COMBINATIONS: "Line Combinations",
  MATCHUP_STRATEGY: "Matchup Strategy",
  SERIES_STRATEGY: "Series Strategy",
  GOALTENDING: "Goaltending",
  // Drill recommendation sections
  RECOMMENDED_DRILLS: "Recommended Drills",
  // Pre-Game Intel Brief sections
  OPPONENT_SNAPSHOT: "Opponent Snapshot",
  KEY_MATCHUPS: "Key Matchups",
  GOALTENDING_REPORT: "Goaltending Report",
  SPECIAL_TEAMS_INTEL: "Special Teams Intel",
  GAME_KEYS: "Game Keys",
  PRE_GAME_TALKING_POINTS: "Pre-Game Talking Points",
  LINEUP_RECOMMENDATIONS: "Lineup Recommendations",
  // Player Guide sections
  READINESS_ASSESSMENT: "Readiness Assessment",
  ACADEMIC_ATHLETIC_BALANCE: "Academic-Athletic Balance",
  EXPOSURE_STRATEGY: "Exposure Strategy",
  DEVELOPMENT_TIMELINE: "Development Timeline",
  RECRUITING_REALITY_CHECK: "Recruiting Reality Check",
  PARENT_ACTION_ITEMS: "Parent Action Items",
};

export const REPORT_TYPE_LABELS: Record<string, string> = {
  pro_skater: "Pro/Amateur Skater",
  unified_prospect: "Unified Prospect",
  goalie: "Goalie Report",
  game_decision: "Game Decision",
  season_intelligence: "Season Intelligence",
  operations: "Elite Operations",
  team_identity: "Team Identity",
  opponent_gameplan: "Opponent Game Plan",
  agent_pack: "Agent Pack",
  development_roadmap: "Development Roadmap",
  family_card: "Player/Family Card",
  line_chemistry: "Line Chemistry",
  st_optimization: "Special Teams",
  trade_target: "Trade/Acquisition",
  draft_comparative: "Draft Comparative",
  season_progress: "Season Progress",
  practice_plan: "Practice Plan",
  playoff_series: "Playoff Series Prep",
  goalie_tandem: "Goalie Tandem",
  // Custom reports
  custom: "Custom Report",
  // Priority 2 reports
  indices_dashboard: "ProspectX Metrics Dashboard",
  player_projection: "Next Season Projection",
  league_benchmarks: "League Benchmarks",
  season_projection: "Season Projection",
  free_agent_market: "Free Agent Market",
  // Phase 2 templates
  pre_game_intel: "Pre-Game Intel Brief",
  player_guide_prep_college: "Prep/College Player Guide",
  // Phase 3 — Elite Profile
  elite_profile: "Elite Player Profile",
  // Addendum 2
  forward_operating_profile: "Forward Operating Profile",
  defense_operating_profile: "Defenseman Operating Profile",
  bench_card: "Bench Card",
  bias_controlled_eval: "Bias-Controlled Evaluation",
  agent_projection: "Agent Projection Report",
};

// ── Report Categories: Player vs Team ──────────────────────────
export const PLAYER_REPORT_TYPES = [
  "pro_skater",
  "unified_prospect",
  "goalie",
  "game_decision",
  "season_intelligence",
  "operations",
  "agent_pack",
  "development_roadmap",
  "family_card",
  "trade_target",
  "draft_comparative",
  "season_progress",
  "indices_dashboard",
  "player_projection",
  "player_guide_prep_college",
  "elite_profile",
  "forward_operating_profile",
  "defense_operating_profile",
  "bench_card",
  "bias_controlled_eval",
  "agent_projection",
] as const;

export const TEAM_REPORT_TYPES = [
  "team_identity",
  "opponent_gameplan",
  "line_chemistry",
  "st_optimization",
  "practice_plan",
  "playoff_series",
  "goalie_tandem",
  "league_benchmarks",
  "season_projection",
  "free_agent_market",
  "pre_game_intel",
] as const;

// ── Report Categories (6 groups for report type selector) ──────
export const REPORT_CATEGORIES: { key: string; label: string; description: string; accent: string; types: string[] }[] = [
  {
    key: "scouting",
    label: "Scouting & Advancement",
    description: "Player evaluation, draft analysis, and projection reports.",
    accent: "teal",
    types: ["pro_skater", "unified_prospect", "goalie", "draft_comparative", "elite_profile", "bias_controlled_eval", "agent_projection"],
  },
  {
    key: "gameday",
    label: "Game-Day Operations",
    description: "Pre-game intel, opponent scouting, and in-game deployment tools.",
    accent: "orange",
    types: ["game_decision", "opponent_gameplan", "pre_game_intel", "forward_operating_profile", "defense_operating_profile", "bench_card"],
  },
  {
    key: "development",
    label: "Player Development",
    description: "Development roadmaps, season tracking, and family communication.",
    accent: "teal",
    types: ["development_roadmap", "season_progress", "player_projection", "player_guide_prep_college", "indices_dashboard"],
  },
  {
    key: "team_strategy",
    label: "Team Strategy",
    description: "Team systems, line optimization, special teams, and series planning.",
    accent: "orange",
    types: ["team_identity", "practice_plan", "line_chemistry", "st_optimization", "playoff_series", "goalie_tandem"],
  },
  {
    key: "communication",
    label: "Communication",
    description: "Reports for families, agents, and external stakeholders.",
    accent: "teal",
    types: ["family_card", "agent_pack"],
  },
  {
    key: "risk",
    label: "Risk Management",
    description: "Trade analysis, market intelligence, and organizational planning.",
    accent: "orange",
    types: ["trade_target", "operations", "free_agent_market", "season_intelligence", "league_benchmarks", "season_projection"],
  },
];

// ── Prospect Grading Scale ─────────────────────────────────────
// Used in Pro/Amateur Skater, Unified Prospect, and other scouting reports.
// Grades reflect NHL trajectory projection based on current tools & development curve.
// ── Stat Category Labels ─────────────────────────────────────
export const STAT_CATEGORIES: Record<string, string> = {
  main: "Main Statistics",
  shots: "Shots",
  puck_battles: "Puck Battles",
  recoveries: "Recoveries & Losses",
  special_teams: "Special Teams",
  xg: "Expected Goals (xG)",
  passes: "Passes",
  entries: "Entries & Breakouts",
  advanced: "Advanced (Corsi / Fenwick)",
  faceoffs_zone: "Faceoffs by Zone",
  playtime: "Playtime Phases",
  scoring_chances: "Scoring Chances",
  team_extras: "Team-Specific",
  // Team stat categories
  offense: "Offense",
  discipline: "Discipline",
  faceoffs: "Faceoffs",
  physical: "Physical Play",
  defense: "Defense",
  transition: "Transition",
};

export const STAT_FIELD_LABELS: Record<string, string> = {
  // Main
  shifts: "Shifts", puck_touches: "Puck Touches", puck_control_time: "Puck Control Time",
  scoring_chances: "Scoring Chances", penalties: "Penalties", penalties_drawn: "Penalties Drawn",
  hits: "Hits", hits_against: "Hits Against", error_leading_to_goal: "Errors → Goal",
  dump_ins: "Dump Ins", dump_outs: "Dump Outs", first_assist: "1st Assists", second_assist: "2nd Assists",
  plus: "Plus", minus: "Minus", faceoffs: "Faceoffs", faceoffs_won: "FO Won",
  faceoffs_lost: "FO Lost", faceoffs_won_pct: "FO Win %",
  // Shots
  blocked_shots: "Blocked Shots", missed_shots: "Missed Shots",
  slapshot: "Slapshots", wrist_shot: "Wrist Shots",
  shootouts: "Shootouts", shootouts_scored: "SO Goals", shootouts_missed: "SO Missed",
  pp_shots: "PP Shots", sh_shots: "SH Shots",
  positional_attack_shots: "Positional Attack Shots", counter_attack_shots: "Counter-Attack Shots",
  five_v_five_shots: "5v5 Shots",
  // Puck battles
  total: "Total", won: "Won", won_pct: "Win %",
  dz: "In DZ", nz: "In NZ", oz: "In OZ",
  shots_blocking: "Shots Blocked", dekes: "Dekes",
  dekes_successful: "Dekes Successful", dekes_unsuccessful: "Dekes Failed",
  dekes_successful_pct: "Deke Success %",
  // Recoveries
  takeaways: "Takeaways", takeaways_dz: "Takeaways DZ", takeaways_nz: "Takeaways NZ",
  takeaways_oz: "Takeaways OZ", loose_puck_recovery: "Loose Puck Recovery",
  dump_in_retrievals: "Dump-In Retrievals", puck_retrievals_after_shots: "Post-Shot Retrievals",
  puck_losses: "Puck Losses", puck_losses_dz: "Puck Losses DZ",
  puck_losses_nz: "Puck Losses NZ", puck_losses_oz: "Puck Losses OZ",
  // Special teams
  pp_count: "PP Opportunities", pp_successful: "PP Goals", pp_time: "PP Time",
  sh_count: "SH Situations", pk_count: "PK Count", sh_time: "SH Time",
  // xG
  xg_per_shot: "xG/Shot", xg: "xG", xg_per_goal: "xG/Goal",
  net_xg: "Net xG", team_xg_on_ice: "Team xG On Ice",
  opponent_xg_on_ice: "Opponent xG On Ice", xg_conversion: "xG Conversion",
  // Passes
  accurate: "Accurate", accurate_pct: "Accuracy %",
  to_slot: "Passes to Slot", pre_shot: "Pre-Shot Passes", receptions: "Receptions",
  // Entries
  via_pass: "Via Pass", via_dump: "Via Dump", via_stickhandling: "Via Stickhandling",
  breakouts_total: "Breakouts", breakouts_via_pass: "Breakouts via Pass",
  breakouts_via_dump: "Breakouts via Dump", breakouts_via_stickhandling: "Breakouts via Stickhandling",
  // Advanced
  corsi: "CORSI", corsi_for: "CORSI+", corsi_against: "CORSI-", corsi_pct: "CORSI %",
  fenwick_for: "Fenwick For", fenwick_against: "Fenwick Against", fenwick_pct: "Fenwick %",
  // Faceoffs by zone
  dz_total: "DZ Total", dz_won: "DZ Won", dz_pct: "DZ Win %",
  nz_total: "NZ Total", nz_won: "NZ Won", nz_pct: "NZ Win %",
  oz_total: "OZ Total", oz_won: "OZ Won", oz_pct: "OZ Win %",
  // Playtime
  offensive: "Offensive Play", defensive: "Defensive Play",
  oz_possession: "OZ Possession", nz_possession: "NZ Possession", dz_possession: "DZ Possession",
  // Scoring chances
  scored: "Scored", missed: "Missed", saved: "Saved", pct: "%",
  inner_slot_total: "Inner Slot Total", inner_slot_scored: "Inner Slot Goals",
  inner_slot_missed: "Inner Slot Missed", inner_slot_saved: "Inner Slot Saved",
  inner_slot_pct: "Inner Slot %",
  outer_slot_total: "Outer Slot Total", outer_slot_scored: "Outer Slot Goals",
  outer_slot_missed: "Outer Slot Missed", outer_slot_saved: "Outer Slot Saved",
  outer_slot_pct: "Outer Slot %",
  blocked_from_slot: "Blocked from Slot", blocked_outside_slot: "Blocked Outside Slot",
};

export const LINE_TYPE_LABELS: Record<string, string> = {
  full: "Full Units (5v5)",
  forwards: "Forward Lines",
  defense: "Defence Pairs",
  pp: "Power Play",
  pk: "Penalty Kill",
};

export const PROSPECT_GRADES: Record<string, { label: string; nhl: string; description: string }> = {
  "A":   { label: "A",   nhl: "Top-Line / #1 Defenseman / Franchise",   description: "Elite NHL talent. Projects as a top-line forward, #1 defenseman, or franchise goalie. First-round caliber." },
  "A-":  { label: "A-",  nhl: "Top-6 Forward / Top-4 D / Starting G",  description: "High-end NHL player. Projects as a top-6 forward, top-4 defenseman, or NHL starting goalie. Early-round pick." },
  "B+":  { label: "B+",  nhl: "Middle-6 / Top-4 D",                    description: "Solid NHL regular. Can play a meaningful role in the middle-six or on the second pair. Mid-round pick value." },
  "B":   { label: "B",   nhl: "Bottom-6 / Bottom-Pair D / Backup G",   description: "NHL depth player. Projects as a bottom-six forward, third-pair defenseman, or backup goalie. Late-round value." },
  "B-":  { label: "B-",  nhl: "NHL Fringe / AHL Top",                  description: "Borderline NHL player. May crack an NHL roster in a depth role or become a top AHL contributor." },
  "C+":  { label: "C+",  nhl: "AHL Regular / NHL Call-Up",             description: "Strong minor-league player with potential call-up value. Reliable AHL contributor, occasional NHL fill-in." },
  "C":   { label: "C",   nhl: "AHL Depth / ECHL Top",                  description: "Professional player. AHL depth or ECHL top performer. Solid pro career outside the NHL." },
  "C-":  { label: "C-",  nhl: "ECHL / Junior Overager",                description: "Lower-level pro or strong junior player. May have a pro career in ECHL, European leagues, or top junior." },
  "D":   { label: "D",   nhl: "Junior / College / Non-Pro",            description: "Developing player. Appropriate level is junior (OHL/WHL/QMJHL/USHL), college (NCAA), or top midget/U18." },
  "NR":  { label: "NR",  nhl: "Not Rated / Insufficient Data",         description: "Insufficient data to assign a grade. More viewings or stats needed before projecting a trajectory." },
};

// --- Player Intelligence ---
export interface PlayerIntelligence {
  id: string | null;
  player_id: string;
  archetype: string | null;
  archetype_confidence: number | null;
  overall_grade: string | null;
  offensive_grade: string | null;
  defensive_grade: string | null;
  skating_grade: string | null;
  hockey_iq_grade: string | null;
  compete_grade: string | null;
  summary: string | null;
  strengths: string[];
  development_areas: string[];
  comparable_players: string[];
  stat_signature: Record<string, string> | null;
  tags: string[];
  projection: string | null;
  trigger: string | null;
  version: number;
  created_at: string | null;
}

// Stat signature display labels for UI chips
export const STAT_SIGNATURE_LABELS: Record<string, { emoji: string; label: string }> = {
  production_tier: { emoji: "\u{1F4CA}", label: "Production" },
  scoring_profile: { emoji: "\u{1F3AF}", label: "Scoring" },
  defensive_reliability: { emoji: "\u{1F6E1}", label: "Defense" },
  discipline: { emoji: "\u{2696}", label: "Discipline" },
  shooting_efficiency: { emoji: "\u{1F525}", label: "Shooting" },
  finishing: { emoji: "\u{1F945}", label: "Finishing" },
  possession_impact: { emoji: "\u{1F4CA}", label: "Possession" },
  physical_engagement: { emoji: "\u{1F4AA}", label: "Physical" },
  faceoff_ability: { emoji: "\u{1F3D2}", label: "Faceoffs" },
  save_pct_tier: { emoji: "\u{1F94A}", label: "Save %" },
  goals_against_tier: { emoji: "\u{1F6E1}", label: "GAA" },
};

// ── Analytics Types ──────────────────────────────────────────
export interface AnalyticsFilterOptions {
  leagues: string[];
  teams: Array<{ name: string; league: string }>;
  positions: string[];
}

export interface AnalyticsOverview {
  total_players: number;
  total_reports: number;
  total_notes: number;
  total_teams: number;
  players_with_stats: number;
  players_with_intelligence: number;
  position_breakdown: Array<{ position: string; count: number }>;
  reports_by_type: Array<{ report_type: string; count: number }>;
  reports_by_status: Array<{ status: string; count: number }>;
}

export interface ScoringLeader {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
  current_team: string | null;
  season: string | null;
  gp: number;
  g: number;
  a: number;
  p: number;
  plus_minus: number;
  pim: number;
  ppg: number;
  gpg: number;
  apg: number;
}

export interface TeamRanking {
  team: string;
  roster_size: number;
  qualified_players: number;
  total_gp: number;
  total_goals: number;
  total_assists: number;
  total_points: number;
  avg_ppg: number;
  avg_plus_minus: number;
  total_pim: number;
}

export interface PositionStats {
  position: string;
  player_count: number;
  avg_gp: number;
  avg_g: number;
  avg_a: number;
  avg_p: number;
  avg_ppg: number;
  avg_gpg: number;
  avg_plus_minus: number;
  avg_pim: number;
  max_goals: number;
  max_points: number;
  max_ppg: number;
}

export interface ScoringDistribution {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
  current_team: string | null;
  gp: number;
  g: number;
  a: number;
  p: number;
  plus_minus: number;
  ppg: number;
  gpg: number;
}

export interface ArchetypeBreakdown {
  archetype: string;
  count: number;
  avg_confidence: number;
}

export interface TagCloudData {
  scout_note_tags: Array<{ tag: string; count: number }>;
  intelligence_tags: Array<{ tag: string; count: number }>;
}

// ── ProspectX Metrics ──────────────────────────────────────
export interface ProspectXMetric {
  value: number;        // 0-99 scale
  percentile: number;   // League percentile 1-99
  label: string;        // e.g. "SniperMetric"
  description: string;  // Human-readable description
}

/** @deprecated Use ProspectXMetric instead */
export type ProspectXIndex = ProspectXMetric;

export interface PlayerMetrics {
  player_id: string;
  player_name: string;
  position: string;
  season: string | null;
  gp: number;
  indices: {
    sniper: ProspectXMetric;
    playmaker: ProspectXMetric;
    transition: ProspectXMetric;
    defensive: ProspectXMetric;
    compete: ProspectXMetric;
    hockey_iq: ProspectXMetric;
  };
  has_extended_stats: boolean;
}

/** @deprecated Use PlayerMetrics instead */
export type PlayerIndices = PlayerMetrics;

export interface LeaguePlayerMetrics {
  player_id: string;
  player_name: string;
  position: string;
  current_team: string | null;
  gp: number;
  p: number;
  indices: {
    sniper: ProspectXMetric;
    playmaker: ProspectXMetric;
    transition: ProspectXMetric;
    defensive: ProspectXMetric;
    compete: ProspectXMetric;
    hockey_iq: ProspectXMetric;
  };
}

/** @deprecated Use LeaguePlayerMetrics instead */
export type LeaguePlayerIndices = LeaguePlayerMetrics;

export const METRIC_COLORS: Record<string, string> = {
  sniper: "#ef4444",      // red-500
  playmaker: "#3b82f6",   // blue-500
  transition: "#18B3A6",  // teal
  defensive: "#0F2A3D",   // navy
  compete: "#F36F21",     // orange
  hockey_iq: "#8b5cf6",   // violet-500
};

/** @deprecated Use METRIC_COLORS instead */
export const INDEX_COLORS = METRIC_COLORS;

export const METRIC_ICONS: Record<string, string> = {
  sniper: "\u{1F3AF}",       // target
  playmaker: "\u{1F4E1}",    // satellite
  transition: "\u{1F504}",   // cycle
  defensive: "\u{1F6E1}",    // shield
  compete: "\u{1F4AA}",      // muscle
  hockey_iq: "\u{1F9E0}",    // brain
};

/** @deprecated Use METRIC_ICONS instead */
export const INDEX_ICONS = METRIC_ICONS;

// ── Analytics Report Categories ─────────────────────────────
export const ANALYTICS_CATEGORIES = {
  player: {
    label: "Player Analytics",
    description: "Performance, Advanced Stats, Projections",
    icon: "Users",
    subcategories: {
      performance: {
        label: "Performance Reports",
        types: ["pro_skater", "unified_prospect", "season_intelligence", "season_progress"],
      },
      advanced: {
        label: "Advanced Stats",
        types: ["operations", "game_decision", "indices_dashboard"],
      },
      projections: {
        label: "Projections & Development",
        types: ["development_roadmap", "draft_comparative", "player_projection"],
      },
      family: {
        label: "Presentation",
        types: ["family_card", "agent_pack"],
      },
    },
  },
  team: {
    label: "Team Analytics",
    description: "System Analysis, Line Optimization",
    icon: "Building2",
    subcategories: {
      systems: {
        label: "System Analysis",
        types: ["team_identity", "practice_plan"],
      },
      lines: {
        label: "Line Optimization",
        types: ["line_chemistry", "st_optimization", "goalie_tandem"],
      },
      playoffs: {
        label: "Playoff Preparation",
        types: ["playoff_series"],
      },
    },
  },
  competitive: {
    label: "Competitive Intelligence",
    description: "Opponent Analysis, Market Data, League Benchmarks",
    icon: "Target",
    subcategories: {
      opponents: {
        label: "Opponent Analysis",
        types: ["opponent_gameplan"],
      },
      benchmarks: {
        label: "League Benchmarks",
        types: ["league_benchmarks", "season_projection"],
      },
      market: {
        label: "Market & Acquisitions",
        types: ["trade_target", "goalie", "free_agent_market"],
      },
    },
  },
} as const;

// ── Bench Talk Chat Types ────────────────────────────────────
export interface BenchTalkConversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message: string | null;
  message_count: number;
}

export interface BenchTalkMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  metadata: string | null;
  tokens_used: number;
  created_at: string;
}

export interface BenchTalkMessageMetadata {
  tool_calls: number;
  tokens: number;
  player_ids: string[];
  report_ids: string[];
}

export interface BenchTalkContextResponse {
  players: Array<Player & { gp?: number; g?: number; a?: number; p?: number; ppg?: number }>;
  reports: Report[];
}

export interface BenchTalkMessageResponse {
  message: BenchTalkMessage;
}

export interface BenchTalkSuggestion {
  text: string;
  icon: string;
}

// ── Subscription Types ──────────────────────────────────────
export interface SubscriptionTier {
  name: string;
  price: number;
  annual_price: number;
  monthly_reports: number;
  monthly_bench_talks: number;
  monthly_practice_plans: number;
  max_seats: number;
  features: string[];
  description: string;
  target_user?: string;
  founders_price?: number;
}

export interface SubscriptionUsage {
  tier: string;
  tier_config: SubscriptionTier;
  monthly_reports_used: number;
  monthly_reports_limit: number;
  monthly_bench_talks_used: number;
  monthly_bench_talks_limit: number;
  usage_reset_at: string | null;
  reports_remaining: number | string;
  bench_talks_remaining: number | string;
}

// Grade color mapping for UI
export const GRADE_COLORS: Record<string, string> = {
  "A+": "#16a34a",  // green-600
  "A":  "#16a34a",
  "A-": "#22c55e",  // green-500
  "B+": "#3b82f6",  // blue-500
  "B":  "#3b82f6",
  "B-": "#60a5fa",  // blue-400
  "C+": "#f59e0b",  // amber-500
  "C":  "#f59e0b",
  "C-": "#fbbf24",  // amber-400
  "D+": "#ef4444",  // red-500
  "D":  "#ef4444",
  "D-": "#f87171",  // red-400
  "NR": "#9ca3af",  // gray-400
};

// ── Custom Report Builder Types ──────────────────────────────────
export interface CustomReportFocusArea {
  key: string;
  label: string;
  sections: string[];
}

export interface CustomReportOption {
  key: string;
  label: string;
}

export interface CustomReportOptions {
  focus_areas: CustomReportFocusArea[];
  audiences: CustomReportOption[];
  depths: CustomReportOption[];
  comparison_modes: CustomReportOption[];
}

export interface CustomReportConfig {
  focus_areas: string[];
  audience: string;
  depth: string;
  comparison_mode: string;
  custom_instructions: string;
  report_title: string;
}

// Focus area icons for UI
export const FOCUS_AREA_ICONS: Record<string, string> = {
  skating: "\u26F8\uFE0F",
  offense: "\u{1F3AF}",
  defense: "\u{1F6E1}\uFE0F",
  transition: "\u{1F504}",
  hockey_iq: "\u{1F9E0}",
  compete: "\u{1F4AA}",
  special_teams: "\u26A1",
  projection: "\u{1F52E}",
  trade_value: "\u{1F4B0}",
  development: "\u{1F4C8}",
  system_fit: "\u2699\uFE0F",
  draft: "\u{1F4CB}",
  physical: "\u{1F3CB}\uFE0F",
  goaltending: "\u{1F94A}",
};

export const FOCUS_AREA_DESCRIPTIONS: Record<string, string> = {
  skating: "Stride mechanics, speed, agility, edgework",
  offense: "Shot, finishing, creativity, zone entries",
  defense: "Gap control, positioning, board play",
  transition: "Breakouts, zone exits, neutral zone",
  hockey_iq: "Reads, decisions, spatial awareness",
  compete: "Battle intensity, puck battles, effort",
  special_teams: "PP/PK deployment and effectiveness",
  projection: "Ceiling/floor, development timeline",
  trade_value: "Market value, acquisition analysis",
  development: "Skill development plan and priorities",
  system_fit: "How player fits team tactical systems",
  draft: "Draft eligibility, stock, comparisons",
  physical: "Size, strength, endurance, growth",
  goaltending: "Technical assessment for goalies",
};

// ── Data Compartmentalization Labels ─────────────────────────────
export const AGE_GROUP_LABELS: Record<string, string> = {
  U16: "Under 16",
  U18: "Under 18",
  U20: "Under 20",
  Over20: "Over 20",
};

export const LEAGUE_TIER_LABELS: Record<string, string> = {
  Tier1: "Major Junior (OHL/WHL/QMJHL)",
  Tier2: "Junior A (OJHL/BCHL/USHL)",
  Tier3: "Junior B / Tier 2",
  NCAA: "NCAA Division I",
  NCAA_D3: "NCAA Division III",
  USports: "U Sports (Canada)",
  Pro: "Professional",
  Unknown: "Other",
};

// ============================================================
// HockeyTech Live League Data
// ============================================================

export interface HTLeague {
  code: string;
  name: string;
  client_code: string;
}

export interface HTSeason {
  id: number;
  name: string;
  shortname: string;
  career: boolean;
  playoff: boolean;
  start_date: string | null;
  end_date: string | null;
}

export interface HTTeam {
  id: number;
  name: string;
  code: string;
  city: string;
  nickname: string;
  division: string;
  logo: string;
}

export interface HTRosterPlayer {
  id: number;
  first_name: string;
  last_name: string;
  name: string;
  jersey: string;
  position: string;
  shoots: string;
  dob: string;
  birthplace: string;
  height: string;
  weight: string;
  rookie: boolean;
  draft_status: string;
  team_name: string;
  photo: string;
}

export interface HTSkaterStats {
  player_id: number;
  name: string;
  first_name: string;
  last_name: string;
  team_name: string;
  team_code: string;
  team_id: number;
  position: string;
  jersey: string;
  age: string;
  shoots: string;
  gp: number | null;
  goals: number | null;
  assists: number | null;
  points: number | null;
  pim: number | null;
  plus_minus: number | null;
  ppg: number | null;
  ppa: number | null;
  shg: number | null;
  gwg: number | null;
  shots: number | null;
  shooting_pct: string;
  rookie: boolean;
  photo: string;
  logo: string;
}

export interface HTGoalieStats {
  player_id: number;
  name: string;
  team_name: string;
  team_code: string;
  gp: number | null;
  wins: number | null;
  losses: number | null;
  otl: number | null;
  gaa: string;
  save_pct: string;
  shutouts: number | null;
  minutes: string;
  shots_against: number | null;
  saves: number | null;
  photo: string;
}

export interface HTStandings {
  team_id: number;
  name: string;
  team_code: string;
  city: string;
  gp: number | null;
  wins: number | null;
  losses: number | null;
  otl: number | null;
  points: number | null;
  gf: number | null;
  ga: number | null;
  diff: number | null;
  pct: string;
  streak: string;
  pp_pct: string;
  pk_pct: string;
  regulation_wins: number | null;
}

export interface HTGame {
  game_id: number;
  date: string;
  game_date: string;
  time: string;
  home_id: number;
  home_team: string;
  home_code: string;
  home_score: string;
  home_logo: string;
  away_id: number;
  away_team: string;
  away_code: string;
  away_score: string;
  away_logo: string;
  status: string;
  period: string;
  game_clock: string;
  venue: string;
}

// ============================================================
// Drill Library & Practice Plans
// ============================================================

export interface Drill {
  id: string;
  org_id: string | null;
  name: string;
  category: string;
  description: string;
  coaching_points: string | null;
  setup: string | null;
  duration_minutes: number;
  players_needed: number;
  ice_surface: string;
  equipment: string | null;
  age_levels: string[];
  tags: string[];
  diagram_url: string | null;
  skill_focus: string | null;
  intensity: string;
  concept_id: string | null;
  age_group: string | null;
  country_framework: string | null;
  created_at: string;
}

export interface PracticePlanDrill {
  id: string;
  drill_id: string;
  phase: string;
  sequence_order: number;
  duration_minutes: number;
  coaching_notes: string | null;
  // Joined drill fields
  drill_name?: string;
  drill_category?: string;
  drill_description?: string;
  drill_coaching_points?: string;
  drill_setup?: string;
  drill_ice_surface?: string;
  drill_intensity?: string;
  drill_skill_focus?: string;
  drill_concept_id?: string;
  drill_age_levels?: string[];
  drill_tags?: string[];
  drill_equipment?: string;
  drill_diagram_url?: string | null;
}

export interface PracticePlan {
  id: string;
  org_id: string;
  user_id: string;
  team_name: string | null;
  title: string;
  age_level: string | null;
  duration_minutes: number;
  focus_areas: string[];
  plan_data: {
    title?: string;
    phases?: Array<{
      phase: string;
      phase_label: string;
      duration_minutes: number;
      drills: Array<{
        drill_id: string | null;
        drill_name: string;
        duration_minutes: number;
        coaching_notes: string;
      }>;
    }>;
    coaching_summary?: string;
  } | null;
  notes: string | null;
  status: "draft" | "active" | "completed";
  practice_date: string | null;
  drills?: PracticePlanDrill[];
  created_at: string;
  updated_at: string;
}

export interface PracticePlanGenerateRequest {
  team_name: string;
  duration_minutes?: number;
  focus_areas?: string[];
  age_level?: string;
  notes?: string;
}

export interface PracticeSession {
  id: string;
  practice_plan_id: string;
  team_id: string;
  org_id: string;
  completed_at: string;
  session_note: string | null;
  absent_player_ids: string[];
  created_by: string;
}

export interface PlayerDrillLog {
  id: string;
  player_id: string;
  practice_session_id: string;
  drill_id: string;
  drill_name: string;
  skill_focus: string[];
  objective_ids: string[];
  logged_at: string;
  org_id: string;
  session_note?: string | null;
  session_date?: string | null;
  practice_plan_id?: string | null;
}

export interface DrillLogSummary {
  total_season: number;
  this_week: number;
  this_month: number;
}

export interface PlayerDrillLogsResponse {
  logs: PlayerDrillLog[];
  summary: DrillLogSummary;
}

export interface DevelopmentPlanObjective {
  id: string;
  plan_id: string;
  player_id: string;
  org_id: string;
  title: string;
  skill_focus: string[];
  drill_log_count: number;
  last_drilled_at: string | null;
  status: "active" | "completed";
  created_at: string;
}

export const DRILL_CATEGORIES: Record<string, string> = {
  warm_up: "Warm Up",
  skating: "Skating",
  passing: "Passing",
  shooting: "Shooting",
  stickhandling: "Stickhandling",
  puck_handling: "Puck Handling",
  offensive: "Offensive",
  defensive: "Defensive",
  systems: "Systems",
  goalie: "Goalie",
  conditioning: "Conditioning",
  battle: "Battle Drills",
  small_area_games: "Small Area Games",
  transition: "Transition",
  special_teams: "Special Teams",
  cool_down: "Cool Down",
  fun: "Fun & Team Building",
  station_setup: "Station Setup",
  skills_testing: "Skills Testing",
};

export const DRILL_AGE_LEVELS = [
  "U8", "U10", "U12", "U14", "U16_U18", "JUNIOR_COLLEGE_PRO",
] as const;

export const DRILL_AGE_LEVEL_LABELS: Record<string, string> = {
  U8: "Under 8",
  U10: "Under 10",
  U12: "Under 12",
  U14: "Under 14",
  U16_U18: "U16 / U18",
  JUNIOR_COLLEGE_PRO: "Junior / College / Pro",
};

export const ICE_SURFACES: Record<string, string> = {
  full: "Full Ice",
  half: "Half Ice",
  quarter: "Quarter Ice",
  third: "Third Ice",
  sixth: "Sixth Ice",
};

export const PRACTICE_PHASES: Record<string, string> = {
  warm_up: "Warm Up",
  skill_work: "Skill Work",
  systems: "Team Systems",
  scrimmage: "Game Situations",
  conditioning: "Conditioning",
  cool_down: "Cool Down",
};

export const INTENSITY_COLORS: Record<string, { label: string; bg: string; text: string }> = {
  low: { label: "Low", bg: "bg-green-50", text: "text-green-700" },
  medium: { label: "Medium", bg: "bg-orange/10", text: "text-orange" },
  high: { label: "High", bg: "bg-red-50", text: "text-red-600" },
};

export const PRACTICE_FOCUS_OPTIONS = [
  "skating", "passing", "shooting", "puck_handling", "offensive_systems",
  "defensive_systems", "checking", "special_teams", "conditioning",
  "compete_level", "transition", "battle_drills",
] as const;

export const PRACTICE_FOCUS_LABELS: Record<string, string> = {
  skating: "Skating",
  passing: "Passing",
  shooting: "Shooting",
  puck_handling: "Puck Handling",
  offensive_systems: "Offensive Systems",
  defensive_systems: "Defensive Systems",
  checking: "Checking",
  special_teams: "Special Teams",
  conditioning: "Conditioning",
  compete_level: "Compete Level",
  transition: "Transition",
  battle_drills: "Battle Drills",
};

// ============================================================
// Country Development Frameworks
// ============================================================

export const SUPPORTED_COUNTRIES = [
  "Canada", "USA", "International", "Europe", "Sweden", "Finland", "UK",
] as const;

export const COUNTRY_FRAMEWORKS: Record<string, string> = {
  Canada: "hockey_canada_ltpd",
  USA: "usa_hockey_adm",
  International: "iihf_ltad",
  Europe: "iihf_ltad",
  Sweden: "iihf_ltad",
  Finland: "iihf_ltad",
  UK: "iihf_ltad",
};

export const FRAMEWORK_LABELS: Record<string, string> = {
  hockey_canada_ltpd: "Hockey Canada LTPD",
  usa_hockey_adm: "USA Hockey ADM",
  iihf_ltad: "IIHF Long-Term Athlete Development",
};

export const HC_DIVISIONS: Record<string, string> = {
  timbits_u7: "Timbits U7 (6 & under)",
  timbits_u9: "Timbits U9 (7-8)",
  u11_atom: "U11 Atom (9-10)",
  u13_peewee: "U13 Peewee (11-12)",
  u15_bantam: "U15 Bantam (13-14)",
  u18_midget: "U18 Midget (15-17)",
};

export const USA_DIVISIONS: Record<string, string> = {
  "6u_mite": "6U Mite (6 & under)",
  "8u_squirt": "8U Squirt (7-8)",
  "10u_peewee": "10U Peewee (9-10)",
  "12u_bantam": "12U Bantam (11-12)",
  "14u_midget": "14U Midget (13-14)",
  "16u": "16U (15-16)",
  "18u": "18U (17-18)",
};

export const IIHF_DIVISIONS: Record<string, string> = {
  learn_to_play: "Learn to Play (6 & under)",
  learn_to_train: "Learn to Train (7-10)",
  train_to_train: "Train to Train (11-14)",
  train_to_compete: "Train to Compete (15-18)",
};

export const DRILL_FRAMEWORK_OPTIONS: Record<string, string> = {
  hockey_canada_ltpd: "Hockey Canada LTPD",
  usa_hockey_adm: "USA Hockey ADM",
  iihf_ltad: "IIHF LTAD",
};

// ============================================================
// Corrections
// ============================================================

export const CORRECTABLE_FIELDS = [
  "first_name", "last_name", "position", "shoots", "dob",
  "current_team", "current_league", "height_cm", "weight_kg",
  "commitment_status", "image_url",
] as const;

export const CORRECTABLE_FIELD_LABELS: Record<string, string> = {
  first_name: "First Name",
  last_name: "Last Name",
  position: "Position",
  shoots: "Shoots",
  dob: "Date of Birth",
  current_team: "Team",
  current_league: "League",
  height_cm: "Height (cm)",
  weight_kg: "Weight (kg)",
  commitment_status: "Commitment Status",
  image_url: "Photo URL",
};

export interface PlayerCorrection {
  id: string;
  org_id: string;
  user_id: string;
  player_id: string;
  field_name: string;
  old_value: string;
  new_value: string;
  reason: string;
  confidence: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  first_name?: string;
  last_name?: string;
  submitter_email?: string;
}

export interface CorrectionCreate {
  field_name: string;
  new_value: string;
  reason: string;
  confidence: "low" | "medium" | "high";
}

// ============================================================
// Merge History
// ============================================================

export interface PlayerMerge {
  id: string;
  primary_player_id: string;
  primary_player_name: string;
  duplicate_player_ids: string[];
  stats_moved: number;
  notes_moved: number;
  reports_moved: number;
  intel_moved: number;
  merged_by: string;
  merged_at: string;
  can_undo: boolean;
  undo_before: string | null;
  undone_at: string | null;
}

// ============================================================
// Deleted Players
// ============================================================

export interface DeletedPlayer {
  id: string;
  first_name: string;
  last_name: string;
  position: string | null;
  current_team: string | null;
  current_league: string | null;
  deleted_at: string;
  deleted_reason: string | null;
  deleted_by: string | null;
  days_since_deleted: number;
  days_remaining: number;
  can_restore: boolean;
}

// ============================================================
// Game Plans
// ============================================================

export type SessionType = "pre_game" | "post_game" | "practice" | "season_notes";

export const SESSION_TYPES: { value: SessionType; label: string }[] = [
  { value: "pre_game", label: "Pre-Game" },
  { value: "post_game", label: "Post-Game" },
  { value: "practice", label: "Practice" },
  { value: "season_notes", label: "Season Notes" },
];

export const TACTICAL_OPTIONS = {
  forecheck: [
    { value: "1-2-2_aggressive", label: "1-2-2 Aggressive" },
    { value: "2-1-2_neutral", label: "2-1-2 Neutral Zone" },
    { value: "1-3-1_conservative", label: "1-3-1 Conservative" },
    { value: "2-3_passive", label: "2-3 Passive" },
  ],
  breakout: [
    { value: "quick_up", label: "Quick Up" },
    { value: "reverse", label: "Reverse" },
    { value: "stretch_pass", label: "Stretch Pass" },
    { value: "rim_play", label: "Rim Play" },
  ],
  defensive_system: [
    { value: "man_on_man", label: "Man-on-Man" },
    { value: "zone", label: "Zone Coverage" },
    { value: "hybrid", label: "Hybrid" },
    { value: "collapsing", label: "Collapsing" },
  ],
} as const;

export interface GamePlan {
  id: string;
  org_id: string;
  user_id: string;
  team_name: string;
  opponent_team_name: string;
  game_date: string | null;
  opponent_analysis: string;
  our_strategy: string;
  matchups: string;
  special_teams_plan: string;
  keys_to_game: string;
  lines_snapshot: string;
  status: "draft" | "active" | "completed";
  session_type: SessionType;
  talking_points: string;
  forecheck: string;
  breakout: string;
  defensive_system: string;
  what_worked: string | null;
  what_didnt_work: string | null;
  game_result: string | null;
  game_score: string | null;
  created_at: string;
  updated_at: string;
}

export interface GamePlanCreate {
  team_name: string;
  opponent_team_name: string;
  game_date?: string;
  opponent_analysis?: string;
  our_strategy?: string;
  matchups?: Record<string, unknown>;
  special_teams_plan?: string;
  keys_to_game?: string;
  lines_snapshot?: Record<string, unknown>;
  status?: string;
  session_type?: SessionType;
  talking_points?: Record<string, unknown>;
  forecheck?: string;
  breakout?: string;
  defensive_system?: string;
  what_worked?: string;
  what_didnt_work?: string;
  game_result?: string;
  game_score?: string;
}

// ============================================================
// Series Plans
// ============================================================

export const SERIES_FORMATS = [
  { value: "best_of_3", label: "Best of 3" },
  { value: "best_of_5", label: "Best of 5" },
  { value: "best_of_7", label: "Best of 7" },
  { value: "round_robin", label: "Round Robin" },
  { value: "single_elim", label: "Single Elimination" },
] as const;

export interface SeriesPlan {
  id: string;
  org_id: string;
  user_id: string;
  team_name: string;
  opponent_team_name: string;
  series_name: string;
  series_format: string;
  current_score: string;
  game_notes: string;
  working_strategies: string;
  needs_adjustment: string;
  opponent_systems: string;
  key_players_dossier: string;
  matchup_plan: string;
  adjustments: string;
  momentum_log: string;
  status: "active" | "won" | "lost" | "completed";
  created_at: string;
  updated_at: string;
}

export interface SeriesPlanCreate {
  team_name: string;
  opponent_team_name: string;
  series_name: string;
  series_format?: string;
  current_score?: string;
  game_notes?: unknown[];
  working_strategies?: unknown[];
  needs_adjustment?: unknown[];
  opponent_systems?: Record<string, unknown>;
  key_players_dossier?: unknown[];
  matchup_plan?: Record<string, unknown>;
  adjustments?: unknown[];
  momentum_log?: unknown[];
  status?: string;
}

// ============================================================
// Scouting List
// ============================================================

export interface ScoutingListItem {
  id: string;
  org_id: string;
  user_id: string;
  player_id: string;
  priority: "high" | "medium" | "low";
  target_reason: string;
  scout_notes: string;
  tags: string;
  is_active: number;
  list_order: number;
  last_viewed: string | null;
  times_viewed: number;
  created_at: string;
  updated_at: string;
  // Joined player fields
  first_name: string;
  last_name: string;
  position: string | null;
  current_team: string | null;
  current_league: string | null;
  image_url: string | null;
}

export interface ScoutingListCreate {
  player_id: string;
  priority?: "high" | "medium" | "low";
  target_reason?: string;
  scout_notes?: string;
  tags?: string[];
}

export const TARGET_REASONS = [
  { value: "draft", label: "Draft Prospect" },
  { value: "trade", label: "Trade Target" },
  { value: "recruit", label: "Recruit" },
  { value: "watch", label: "Watch List" },
] as const;

// ============================================================
// My Data
// ============================================================

export interface MyDataSummary {
  players_created: number;
  uploads: number;
  corrections_submitted: number;
  corrections_approved: number;
  reports_generated: number;
  notes_created: number;
}

export interface MyDataUpload {
  id: string;
  org_id: string;
  user_id: string;
  filename: string;
  status: string;
  total_rows: number;
  imported: number;
  duplicates_found: number;
  errors: number;
  created_at: string;
}

// ============================================================
// Admin Dashboard
// ============================================================

export interface AdminUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  hockey_role: string;
  subscription_tier: string;
  created_at: string;
  subscription_started_at: string | null;
  monthly_reports_used: number;
  monthly_bench_talks_used: number;
  usage: {
    reports_count: number;
    bench_talks_count: number;
    practice_plans_count: number;
    uploads_count: number;
  };
}

export interface AdminStats {
  total_users: number;
  total_players: number;
  total_reports: number;
  total_teams: number;
  total_notes: number;
  total_game_plans: number;
  total_drills: number;
  total_conversations: number;
  reports_by_status: Array<{ status: string; count: number }>;
  users_by_tier: Array<{ tier: string; count: number }>;
  recent_reports: number;
  recent_notes: number;
}

export interface AdminErrorLog {
  id: string;
  request_method: string;
  request_path: string;
  status_code: number;
  error_message: string;
  user_id: string | null;
  org_id: string | null;
  created_at: string;
}

// ── Superadmin Dashboard ──────────────────────────────────────

export interface SuperadminOrg {
  org_id: string;
  name: string;
  org_type: string | null;
  created_at: string;
  user_count: number;
  highest_tier: string;
  report_count: number;
  users: Array<{ email: string; role: string; tier: string }>;
}

export interface SuperadminStats {
  total_orgs: number;
  total_users: number;
  total_reports: number;
  tier_breakdown: Record<string, number>;
  monthly_revenue_estimate: number;
  reports_this_month: number;
  new_orgs_this_month: number;
}

export interface SuperadminUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  hockey_role: string;
  subscription_tier: string;
  created_at: string;
  org_id: string;
  org_name: string;
  monthly_reports_used: number;
  monthly_bench_talks_used: number;
}

// ── Org Invites ──────────────────────────────────────────────
export interface OrgInvite {
  id: string;
  org_id: string;
  invited_by: string;
  email: string;
  hockey_role: string;
  role: string;
  token: string;
  status: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

// ── League Player Search (InStat discovery) ─────────────────

export interface LeaguePlayerResult {
  id: string;
  player_name: string;
  team_name: string;
  league_name: string;
  position: string | null;
  dob: string | null;
  season: string;
  jersey_number: string | null;
  handedness: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  gp: number | null;
  goals: number | null;
  assists: number | null;
  points: number | null;
  ppg: number | null;
  plus_minus: number | null;
  shots_on_goal: number | null;
  xg: number | null;
}

// ── Bench Card V2 Context Payload (Addendum 9) ──────────────

export interface BenchCardLineUsage {
  lineId: string;
  label: string;
  players: string;
  roleTag: string;
  primaryMatchup: string;
  shiftLengthSecondsBand: string;
  ozoneUsage: string;
  dzoneUsage: string;
  specialNotes?: string;
}

export interface BenchCardDPairUsage {
  pairId: string;
  label: string;
  players: string;
  roleTag: string;
  usageNotes: string;
  specialNotes?: string;
}

export interface BenchCardSpecialTeamsUnit {
  unitId: string;
  players: string;
  roleTag: string;
  keyFocus: string[];
}

export interface BenchCardPKMiniBlock {
  opponentPPSnapshot: string;
  ourPKShape: string;
  denyFocus: string[];
  ifThenTriggers: {
    trigger: string;
    action: string;
  }[];
}

export interface BenchCardWinConditionBox {
  winConditions: string[];
  failureTriggers: string[];
}

export interface BenchCardSpecialTeams {
  ppUnits: BenchCardSpecialTeamsUnit[];
  pkUnits: BenchCardSpecialTeamsUnit[];
  pkBenchBlock: BenchCardPKMiniBlock;
}

export interface BenchCardContextPayload {
  gameMeta: {
    gameId: string;
    date: string;
    venue: string;
    opponentName: string;
    objectiveOneLiner: string;
  };
  goaliePlan: { starter: string; backup?: string; pullRule: string };
  forwardLines: BenchCardLineUsage[];
  defencePairs: BenchCardDPairUsage[];
  specialTeams: BenchCardSpecialTeams;
  universalBenchRules: string[];
  keyPlayerUsageReminders: string[];
  winConditionBox: BenchCardWinConditionBox;
}

// ── Game State (Broadcast) ───────────────────────────────────
export type GameState = "pre_game" | "live" | "intermission" | "post_game";

export const GAME_STATE_LABELS: Record<GameState, string> = {
  pre_game: "Pre-Game",
  live: "In-Game",
  intermission: "Intermission",
  post_game: "Post-Game",
};

// ── Interview Questions (Broadcast) ─────────────────────────
export type InterviewTab = "coach_pre" | "coach_post" | "player_pre" | "player_post" | "feature";

export interface InterviewQuestion {
  context_tab: InterviewTab;
  label: string;
  question: string;
}

export const INTERVIEW_LABEL_COLORS: Record<string, { bg: string; text: string }> = {
  SAFE: { bg: "bg-green-100", text: "text-green-700" },
  PROBE: { bg: "bg-amber-100", text: "text-amber-700" },
  FEATURE: { bg: "bg-teal/10", text: "text-teal" },
  INSIGHT: { bg: "bg-blue-100", text: "text-blue-700" },
  FOLLOW_UP: { bg: "bg-purple-100", text: "text-purple-700" },
};

// ── PXI Insights (Broadcast) ────────────────────────────────
export interface PXIInsight {
  category: string;
  insight: string;
  stat_support?: string;
  suggested_use?: string;
}

export const INSIGHT_CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PATTERN: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  TREND: { bg: "bg-teal/10", text: "text-teal", border: "border-teal/30" },
  MATCHUP: { bg: "bg-orange/10", text: "text-orange", border: "border-orange/30" },
  STORYLINE: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  STAT: { bg: "bg-navy/5", text: "text-navy", border: "border-navy/15" },
  MILESTONE: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  ANOMALY: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
};

// ── Storyline Timeline (Broadcast) ──────────────────────────
export type TimelineEntryType = "note" | "goal" | "penalty" | "substitution" | "timeout" | "injury" | "milestone" | "shift" | "storyline";

export interface TimelineEntry {
  id: string;
  type: TimelineEntryType;
  text: string;
  period: string;
  timestamp: string;
  source: string;
}

export const TIMELINE_TYPE_COLORS: Record<TimelineEntryType, { bg: string; text: string; label: string; border: string }> = {
  note: { bg: "bg-gray-100", text: "text-gray-600", label: "Note", border: "border-gray-200" },
  goal: { bg: "bg-green-100", text: "text-green-700", label: "Goal", border: "border-green-200" },
  penalty: { bg: "bg-red-100", text: "text-red-700", label: "Penalty", border: "border-red-200" },
  substitution: { bg: "bg-blue-100", text: "text-blue-700", label: "Sub", border: "border-blue-200" },
  timeout: { bg: "bg-amber-100", text: "text-amber-700", label: "Timeout", border: "border-amber-200" },
  injury: { bg: "bg-orange-100", text: "text-orange-700", label: "Injury", border: "border-orange-200" },
  milestone: { bg: "bg-purple-100", text: "text-purple-700", label: "Milestone", border: "border-purple-200" },
  shift: { bg: "bg-indigo-100", text: "text-indigo-700", label: "Shift", border: "border-indigo-200" },
  storyline: { bg: "bg-teal/10", text: "text-teal", label: "Storyline", border: "border-teal/30" },
};

// ── Agent Client Management ─────────────────────────────────
export type AgentClientStatus = "active" | "committed" | "unsigned" | "inactive";

export interface AgentClient {
  id: string;
  player_id: string;
  status: AgentClientStatus;
  pathway_notes?: string;
  created_at?: string;
  updated_at?: string;
  player?: {
    id: string;
    first_name: string;
    last_name: string;
    position?: string;
    current_team?: string | null;
    current_league?: string | null;
    dob: string | null;
    shoots?: string | null;
    archetype?: string | null;
    commitment_status?: string | null;
  };
  reports?: Report[];
}

export const AGENT_CLIENT_STATUS_COLORS: Record<AgentClientStatus, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-green-100", text: "text-green-700", label: "Active" },
  committed: { bg: "bg-teal/10", text: "text-teal", label: "Committed" },
  unsigned: { bg: "bg-orange/10", text: "text-orange", label: "Unsigned" },
  inactive: { bg: "bg-gray-100", text: "text-gray-500", label: "Inactive" },
};

export interface AgentPackData {
  player_summary: string;
  strengths: string[];
  pathway_assessment: string;
  ninety_day_plan: string[];
  target_programs: string[];
  generated_at?: string;
}

// ── Broadcast Hub Types ─────────────────────────────────────
export type BroadcastMode = "broadcast" | "producer";
export type BroadcastDepth = "quick" | "standard" | "deep";
export type BroadcastAudience = "casual" | "informed" | "hardcore";
export type BroadcastToolName =
  | "spotting_board"
  | "talk_tracks"
  | "storyline_timeline"
  | "pxi_insights"
  | "stat_cards"
  | "graphics_suggestions";

// ── Spotting Board ──────────────────────────────────────────
export interface SpottingBoardPlayer {
  jersey: string;
  name: string;
  position: string;
  gp: number;
  g: number;
  a: number;
  p: number;
  key_stat: string;
  archetype: string;
  pronunciation?: string;
  broadcast_note: string;
  xg?: number | null;
  cf_pct?: number | null;
  zone_starts_oz_pct?: number | null;
}

export interface SpottingBoardTeam {
  team_name: string;
  players: SpottingBoardPlayer[];
}

export interface SpottingBoardData {
  home: SpottingBoardTeam;
  away: SpottingBoardTeam;
}

// ── Talk Tracks ─────────────────────────────────────────────
export type TalkTrackCategory =
  | "team_storyline"
  | "matchup_storyline"
  | "player_storyline"
  | "streak_milestone";

export interface TalkTrack {
  headline: string;
  twenty_sec_read: string;
  stat_hook: string;
}

// ── Stat Cards ──────────────────────────────────────────────
export interface StatCard {
  card_type: string;
  headline_stat: string;
  headline_value: string;
  support_stats: { label: string; value: string }[];
  interpretation: string;
  graphic_caption: string;
}

// ── Graphics Suggestions ────────────────────────────────────
export interface GraphicSuggestion {
  priority: number;
  graphic_type: string;
  trigger_moment: string;
  caption: string;
  data_needed: string;
}

// ── Broadcast Player Profiles ───────────────────────────────
export interface BroadcastPlayerProfile {
  name: string;
  archetype: string;
  physical: string;
  role: string;
  strengths: string;
  fun_fact: string;
  tonight: string;
}

// ── Post-Game Script ────────────────────────────────────────
export interface PostGameScriptData {
  script: string;
  word_count: number;
  format: string;
}

// ── Team Games ──────────────────────────────────────────────
export interface TeamGame {
  id: string;
  game_date: string;
  home_away: string;
  opponent: string;
  team_score: number;
  opponent_score: number;
  result: string;
  extended_stats?: Record<string, Record<string, unknown>>;
}

// ── Team Intelligence ───────────────────────────────────────
export interface TeamIntelligence {
  version: number;
  trigger?: string;
  created_at?: string;
  playing_style?: string;
  tags: string[];
  system_summary?: string;
  identity?: string;
  strengths: string[];
  vulnerabilities: string[];
  key_personnel: { name: string; role: string; note: string }[];
  special_teams_identity?: string;
  player_archetype_fit?: string;
  comparable_teams: string[];
}

// ── Player Guide: Focus Plan ────────────────────────────────
export interface FocusPlanCategory {
  label: string;
  items: string[];
}

export interface FocusPlan {
  month_label: string;
  categories: FocusPlanCategory[];
  generated_at: string;
}

// ── Player Guide: Pressure & Confidence ─────────────────────
export interface PressureConfidenceResponse {
  feeling: string;
  dont_say: string[];
  say_instead: string[];
  activity: string;
  concern_signs: string;
}

// ============================================================
// Calendar & Schedule
// ============================================================

export interface CalendarEvent {
  id: string;
  org_id: string;
  team_id?: string;
  player_id?: string;
  feed_id?: string;
  type: 'GAME' | 'PRACTICE' | 'TOURNAMENT' | 'SHOWCASE' | 'MEETING' | 'DEADLINE' | 'OTHER';
  source: 'MANUAL' | 'ICAL' | 'GAMESHEET' | 'SPORTSENGINE' | 'SPORDLE' | 'TEAMSNAP';
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  timezone: string;
  location?: string;
  league_name?: string;
  opponent_name?: string;
  is_home?: number | null;
  visibility: 'ORG' | 'TEAM' | 'PLAYER_FAMILY' | 'PRIVATE';
  created_at: string;
  updated_at: string;
}

export interface CalendarFeed {
  id: string;
  org_id: string;
  team_id?: string;
  label: string;
  provider: 'ICAL_GENERIC' | 'TEAMSNAP' | 'SPORTSENGINE' | 'GAMESHEET' | 'SPORDLE';
  url: string;
  active: boolean;
  last_sync_at?: string;
  sync_error?: string;
  event_count: number;
  created_at: string;
}

export type CalendarEventType = CalendarEvent['type'];

export const EVENT_TYPE_COLORS: Record<string, string> = {
  GAME: '#F97316',
  PRACTICE: '#0D9488',
  TOURNAMENT: '#475569',
  SHOWCASE: '#7C3AED',
  MEETING: '#3B6B8A',
  DEADLINE: '#DC2626',
  OTHER: '#9CA3AF',
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  GAME: 'Game',
  PRACTICE: 'Practice',
  TOURNAMENT: 'Tournament',
  SHOWCASE: 'Showcase',
  MEETING: 'Meeting',
  DEADLINE: 'Deadline',
  OTHER: 'Other',
};

export const CALENDAR_PROVIDERS: Record<string, { label: string; color: string }> = {
  ICAL_GENERIC: { label: 'iCal', color: '#6B7280' },
  TEAMSNAP: { label: 'TeamSnap', color: '#00B140' },
  SPORTSENGINE: { label: 'SportsEngine', color: '#0066CC' },
  GAMESHEET: { label: 'GameSheet', color: '#C8102E' },
  SPORDLE: { label: 'Spordle', color: '#FF6B00' },
};

// ============================================================
// Messaging & Parental Approval
// ============================================================

export interface Conversation {
  id: string;
  org_id?: string;
  participant_ids: string[];
  participants: ConversationParticipant[];
  status: 'active' | 'blocked' | 'pending_approval';
  last_message?: Message;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface ConversationParticipant {
  user_id: string;
  name: string;
  role: string;
  org_name?: string;
  is_verified: boolean;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  sent_at: string;
  read_at?: string;
  is_system_message: boolean;
}

export interface ContactRequest {
  id: string;
  requester_id: string;
  requester_name: string;
  requester_role: string;
  requester_org: string;
  target_player_id: string;
  target_player_name?: string;
  parent_id: string;
  status: 'pending' | 'approved' | 'denied';
  message?: string;
  requested_at: string;
  resolved_at?: string;
}

// ── Development Plans ──────────────────────────────────────

export interface DevelopmentPlanSection {
  title: string;
  content: string;
  priority: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

export interface DevelopmentPlan {
  id: string;
  player_id: string;
  org_id?: string;
  version: number;
  title: string;
  status: 'active' | 'superseded' | 'archived';
  season: string;
  created_by: string;
  created_by_name: string;
  plan_type: 'in_season' | 'off_season' | 'full_year';
  sections: DevelopmentPlanSection[];
  summary: string | null;
  created_at: string;
  updated_at: string;
}

// ── Development Plans v2 (9-section model) ──────────────────

export interface DevelopmentPlanV2 {
  id: string;
  player_id: string;
  org_id?: string;
  version: number;
  title: string;
  status: 'draft' | 'final';
  season: string;
  created_by: string;
  created_by_name: string;
  plan_type: string;
  is_current: boolean;
  section_1_snapshot: string | null;
  section_2_context: string | null;
  section_3_strengths: string | null;
  section_4_development: string | null;
  section_5_phase_plan: string | null;
  section_6_integration: string | null;
  section_7_metrics: string | null;
  section_8_staff_notes: string | null;
  section_9_raw: string | null;
  section_1_visible_to_player: boolean;
  section_2_visible_to_player: boolean;
  section_3_visible_to_player: boolean;
  section_4_visible_to_player: boolean;
  section_5_visible_to_player: boolean;
  section_6_visible_to_player: boolean;
  section_7_visible_to_player: boolean;
  section_8_visible_to_player: boolean;
  sections?: DevelopmentPlanSection[];
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export const PARENT_STAT_LABELS: Record<string, string> = {
  "CF%": "Was on the ice for more shots than against (possession)",
  xGF: "Created high-quality scoring chances",
  "TOI/game": "Ice time per game",
  entry_success_rate: "Successfully carried the puck into the offensive zone",
  fo_pct: "Won faceoffs",
  battles_pct: "Won puck battles along the boards",
  inner_slot_pct: "Shot from high-danger areas",
};

export const DEV_PLAN_SECTION_TITLES: Record<number, string> = {
  1: "Player Snapshot & Identity",
  2: "Season Context",
  3: "Current Strengths",
  4: "Development Priorities",
  5: "Phase Plan",
  6: "Practice & Game Integration",
  7: "Success Metrics",
  8: "Staff Notes",
};

export interface ParentDashboardPlayer {
  id: string;
  first_name: string;
  last_name: string;
  position: string | null;
  current_team: string | null;
  current_league: string | null;
  image_url: string | null;
  latest_plan_status: string | null;
  latest_plan_date: string | null;
}

export interface PlayerStatSnapshot {
  id: string;
  player_id: string;
  snapshot_date: string;
  snapshot_type: 'weekly' | 'monthly' | 'season_end' | 'manual';
  gp: number;
  goals: number;
  assists: number;
  points: number;
  ppg: number;
  plus_minus?: number;
  pim?: number;
  goals_per_game?: number;
  assists_per_game?: number;
  shots_per_game?: number;
  grade_overall?: string;
  grade_offensive?: string;
  grade_defensive?: string;
  grade_skating?: string;
  grade_hockey_iq?: string;
  grade_compete?: string;
  archetype?: string;
}

export interface DevelopmentCurveData {
  player_id: string;
  snapshots: PlayerStatSnapshot[];
  game_log: {
    game_date: string;
    opponent: string;
    goals: number;
    assists: number;
    points: number;
    plus_minus: number;
    shots: number;
    toi_seconds: number;
  }[];
}

// ── Skills Library ──────────────────────────────────────────

export interface SkillLesson {
  id: string;
  title: string;
  series: string | null;
  lesson_number: number;
  category: string;
  description: string | null;
  coaching_points: string[];
  common_errors: string[];
  skill_tags: string[];
  positions: string[];
  age_level: string;
  video_url: string | null;
  created_at: string;
}

export interface ProAnalysisEntry {
  id: string;
  concept_title: string;
  player_reference: string | null;
  description: string | null;
  key_coaching_cues: string[];
  what_to_look_for: string[];
  skill_tags: string[];
  positions: string[];
  level: string;
  video_url: string | null;
  created_at: string;
}

export const SKILL_CATEGORIES = [
  "Shooting",
  "Skating",
  "Puck Handling",
  "Awareness",
  "Positional Play",
  "Off-Ice Training",
  "Drill Add-Ons",
] as const;

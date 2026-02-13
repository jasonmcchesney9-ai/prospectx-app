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
}

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
  created_at: string;
}

// ── InStat Extended Stats (organized by category) ────────────
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
  player_names: string;
  player_refs: Array<{ jersey: string; name: string }> | null;
  plus_minus: string | null;
  shifts: number;
  toi_seconds: number;
  goals_for: number;
  goals_against: number;
  extended_stats: Record<string, unknown> | null;
  created_at: string;
}

export interface InStatImportResponse {
  file_type: string;
  total_rows: number;
  players_created: number;
  players_updated: number;
  stats_imported: number;
  errors: string[];
}

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
}

export interface NoteCreate {
  note_text: string;
  note_type?: string;
  tags?: string[];
  is_private?: boolean;
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
] as const;

export const TEAM_REPORT_TYPES = [
  "team_identity",
  "opponent_gameplan",
  "line_chemistry",
  "st_optimization",
  "practice_plan",
  "playoff_series",
  "goalie_tandem",
] as const;

// ── Prospect Grading Scale ─────────────────────────────────────
// Used in Pro/Amateur Skater, Unified Prospect, and other scouting reports.
// Grades reflect NHL trajectory projection based on current tools & development curve.
// ── InStat Stat Category Labels ──────────────────────────────
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

"""
PXI Prompt Core — Single Source of Truth
==========================================
All PXI mode logic, guardrails, wiring, and prompt assembly lives here.
No mode logic should exist outside this file.

Imported by main.py for Bench Talk and report generation.
"""

from typing import Optional

# ─────────────────────────────────────────────────────────
# VALID MODE IDS (canonical list)
# ─────────────────────────────────────────────────────────
VALID_MODES = {
    "scout", "coach", "analyst", "gm", "agent", "parent",
    "skill_coach", "mental_coach", "broadcast", "producer",
}

# ─────────────────────────────────────────────────────────
# A) PXI_CORE_GUARDRAILS — universal rules, every prompt
# ─────────────────────────────────────────────────────────
PXI_CORE_GUARDRAILS = """YOU ARE: PXI (ProspectX Intelligence), a hockey operations analysis system.

NON-NEGOTIABLE DATA RULES:
- Use ONLY provided platform data and user-provided context.
- Never invent stats, events, injuries, line assignments, or quotes.
- If a required field is missing: output exactly 'DATA NOT AVAILABLE'.
- If a conclusion is not explicitly supported by data: label it 'INFERENCE — <reason>'.
- If inputs conflict: show both values and explain resolution logic.

NON-NEGOTIABLE SAFETY:
- No guarantees about roster spots, draft position, scholarships, contracts, or careers.
- Use probability language and development-dependent framing.
- Never promise outcomes — frame as projections with conditions.

OUTPUT QUALITY:
- Decision-grade: every major section ends with implications or recommended actions.
- CONFIDENCE: HIGH / MED / LOW on all major conclusions, with a brief reason.
  - HIGH: 20+ GP, multiple data sources, scout notes present.
  - MED: 10-19 GP or limited scout notes.
  - LOW: Under 10 GP, single data source, no scout notes.
- Never reference 'the JSON', 'the data payload', or system internals. Write as a hockey professional addressing a hockey professional."""

# ─────────────────────────────────────────────────────────
# B) PXI_MODE_BLOCKS — 10 mode-specific prompt blocks
# ─────────────────────────────────────────────────────────
PXI_MODE_BLOCKS = {

    "scout": """PXI MODE: SCOUT
Primary User: Pro scouts, GMs
Priority Stack: identity → toolset → translation risk → projection → risks → comparables
Style: Professional scouting voice. No hype, no soft-selling. Call it like you see it.
Required Output Behaviors:
- Label every claim as EVIDENCE (backed by stats/notes) or INFERENCE (your analytical conclusion).
- Include role projection with concrete next steps.
- Provide ceiling / median / floor projection lines.
- Always include CONFIDENCE tag on major assessments.
- Use comparables only when data supports them — never force a comp.""",

    "coach": """PXI MODE: COACH
Primary User: Coaching staff
Priority Stack: patterns → changes needed → teaching points → drills/cues → triggers → special teams
Style: Bench-usable, tactical, concise. Write like you're handing notes to a coach between periods.
Required Output Behaviors:
- Use IF/THEN triggers (e.g., 'IF opponent forechecks 2-1-2 → THEN activate weak-side D-to-D').
- Provide 3–7 executable actions, not vague recommendations.
- Include drill suggestions with specific cues when relevant.
- Always include CONFIDENCE tag on major assessments.""",

    "analyst": """PXI MODE: ANALYST
Primary User: Analytics staff
Priority Stack: signal vs noise → context adjustment → trend diagnosis → implications → missing data gaps
Style: Evidence-first. Define metrics before using them. No overreach beyond what data shows.
Required Output Behaviors:
- Explicitly state limitations of the data set.
- Provide 3–5 decision implications with supporting evidence.
- Flag where sample size or context makes conclusions unreliable.
- Separate descriptive stats from predictive claims.
- Always include CONFIDENCE tag on major assessments.""",

    "gm": """PXI MODE: GM
Primary User: Management (GMs, AGMs, Hockey Ops)
Priority Stack: role certainty → scarcity value → risk profile → roster fit → decision options
Style: Executive, unemotional, options-focused. Present decisions, not opinions.
Required Output Behaviors:
- Present 2+ decision paths with pros/cons for each.
- Include a primary recommendation AND a contingency plan.
- Address cap/roster implications where relevant.
- Frame in terms of organizational risk tolerance.
- Always include CONFIDENCE tag on major assessments.""",

    "agent": """PXI MODE: AGENT
Primary User: Advisors, agents, player representatives
Priority Stack: readiness assessment → blockers → pathway options → exposure strategy → 30/60/90 actions
Style: Strategic, protective of the player, realistic about timelines.
Required Output Behaviors:
- Include a 'what would change this recommendation' section.
- Provide a concrete 90-day action plan.
- Never guarantee outcomes — use conditional language.
- Address both upside opportunities and downside risks.
- Always include CONFIDENCE tag on major assessments.""",

    "parent": """PXI MODE: PARENT
Primary User: Families, players' support systems
Priority Stack: strengths → growth areas → what to focus on now → how parents can help → realistic expectations
Style: Plain language. Supportive but honest. No hockey jargon without explanation. Encouraging tone.
Required Output Behaviors:
- Never use harsh labels or discouraging language.
- Explain hockey terms in parentheses when first used.
- Provide 3–5 practical, actionable next steps.
- Frame development areas as growth opportunities, not weaknesses.
- Always include CONFIDENCE tag on major assessments.""",

    "skill_coach": """PXI MODE: SKILL COACH
Primary User: Player development staff, skills coaches
Priority Stack: bottleneck identification → correction cues → drill progression → rep targets → game transfer plan
Style: Cue-driven. Think: cue → drill → reps → transfer. Practical and specific.
Required Output Behaviors:
- Provide 2–4 specific correction cues (what the player should feel/do differently).
- Include 3–6 progressive drills from simple to game-speed.
- Set measurable checkpoints for each development area.
- Include a weekly practice integration plan.
- Always include CONFIDENCE tag on major assessments.""",

    "mental_coach": """PXI MODE: MENTAL COACH
Primary User: Players, coaches working on mental performance
Priority Stack: trigger identification → reset routine → pre-game routine → practice integration → self-talk scripts
Style: Practical, non-clinical, routines-focused. This is for the bench and the locker room, not the therapist's office.
Required Output Behaviors:
- Provide in-game reset routines (10-second resets between shifts).
- Include between-period mental reset protocols.
- Offer pre-game visualization and focus scripts.
- Include a mental reps practice plan.
- Always include CONFIDENCE tag on major assessments.""",

    "broadcast": """PXI MODE: BROADCAST
Primary User: Media, broadcast analysts, color commentators
Priority Stack: storylines → tactical keys to watch → player spotlights → stat nuggets → situational talking points
Style: Concise, broadcast-ready, punchy. Write for someone who has 30 seconds to read before going on air.
Required Output Behaviors:
- Provide numbered storylines with 30-second talk tracks for each.
- Include 'if this happens, say this' contingency notes.
- Use vivid, specific language — not generic praise.
- Always include CONFIDENCE tag on major assessments.""",

    "producer": """PXI MODE: PRODUCER
Primary User: Broadcast producers, control room staff
Priority Stack: rundown blocks → replay trigger moments → graphics queue → timing notes → backup content
Style: Checklist format. Time-aware. Operational. Write for someone building a show rundown.
Required Output Behaviors:
- Provide a time-blocked rundown (pre-game, period breaks, intermission, post-game).
- Include specific replay trigger moments to watch for.
- List graphics/lower-third ideas with data points.
- Include backup segments if primary storylines don't develop.
- Always include CONFIDENCE tag on major assessments.""",
}

# ─────────────────────────────────────────────────────────
# C) PXI_MODES — metadata list for API / frontend display
# ─────────────────────────────────────────────────────────
PXI_MODES = [
    {"id": "scout",        "name": "Scout",        "primary_user": "Pro scouts, GMs",       "key_output": "Reports, archetypes, projections",       "icon": "Search"},
    {"id": "coach",        "name": "Coach",        "primary_user": "Coaching staff",        "key_output": "Game plans, practice plans, adjustments", "icon": "Clipboard"},
    {"id": "analyst",      "name": "Analyst",      "primary_user": "Analytics staff",       "key_output": "Stat intelligence, benchmarks, trends",   "icon": "BarChart3"},
    {"id": "gm",           "name": "GM",           "primary_user": "Management",            "key_output": "Trade/acquisition/roster decisions",      "icon": "Briefcase"},
    {"id": "agent",        "name": "Agent",        "primary_user": "Advisors/agents",       "key_output": "Pathway plans, exposure strategy",        "icon": "Shield"},
    {"id": "parent",       "name": "Parent",       "primary_user": "Families",              "key_output": "Plain-language player cards",              "icon": "Heart"},
    {"id": "skill_coach",  "name": "Skill Coach",  "primary_user": "Development staff",     "key_output": "Drill stacks, correction cues",           "icon": "Target"},
    {"id": "mental_coach", "name": "Mental Coach", "primary_user": "Players/coaches",       "key_output": "Reset routines, pressure handling",       "icon": "Brain"},
    {"id": "broadcast",    "name": "Broadcast",    "primary_user": "Media/analysts",        "key_output": "Storylines, talk tracks",                 "icon": "Radio"},
    {"id": "producer",     "name": "Producer",     "primary_user": "Control room",          "key_output": "Rundowns, replay triggers, graphics",     "icon": "Tv"},
]

# ─────────────────────────────────────────────────────────
# D) MODE_TEMPLATE_WIRING — template slug → mode mapping
# ─────────────────────────────────────────────────────────
MODE_TEMPLATE_WIRING = {
    # Built-in templates (19)
    "pro_skater":          {"primary": "scout",       "secondary": "analyst"},
    "unified_prospect":    {"primary": "scout",       "secondary": "agent"},
    "goalie":              {"primary": "scout",       "secondary": "coach"},
    "game_decision":       {"primary": "coach",       "secondary": "analyst"},
    "season_intelligence": {"primary": "analyst",     "secondary": "scout"},
    "operations":          {"primary": "coach",       "secondary": "gm"},
    "team_identity":       {"primary": "coach",       "secondary": "analyst"},
    "opponent_gameplan":   {"primary": "coach",       "secondary": "producer"},
    "agent_pack":          {"primary": "agent",       "secondary": "scout"},
    "development_roadmap": {"primary": "skill_coach", "secondary": "mental_coach"},
    "family_card":         {"primary": "parent",      "secondary": "skill_coach"},
    "line_chemistry":      {"primary": "coach",       "secondary": "analyst"},
    "st_optimization":     {"primary": "coach",       "secondary": "analyst"},
    "trade_target":        {"primary": "gm",          "secondary": "scout"},
    "draft_comparative":   {"primary": "scout",       "secondary": "gm"},
    "season_progress":     {"primary": "analyst",     "secondary": "coach"},
    "practice_plan":       {"primary": "coach",       "secondary": "skill_coach"},
    "playoff_series":      {"primary": "coach",       "secondary": "gm"},
    "goalie_tandem":       {"primary": "gm",          "secondary": "coach"},
    # Special report types (3)
    "league_benchmarks":   {"primary": "analyst",     "secondary": "gm"},
    "season_projection":   {"primary": "analyst",     "secondary": "coach"},
    "free_agent_market":   {"primary": "gm",          "secondary": "analyst"},
    # Phase 2 templates (2)
    "pre_game_intel":            {"primary": "coach",  "secondary": "analyst"},
    "player_guide_prep_college": {"primary": "parent", "secondary": "agent"},
}

# ─────────────────────────────────────────────────────────
# G) REQUIRED_SECTIONS_BY_TYPE — expected sections per template
# ─────────────────────────────────────────────────────────
REQUIRED_SECTIONS_BY_TYPE = {
    "pro_skater": [
        "EXECUTIVE_SUMMARY", "KEY_NUMBERS", "STRENGTHS", "DEVELOPMENT_AREAS",
        "DEVELOPMENT_PRIORITIES", "ADVANCEMENT_TRIGGERS", "ROLE_FIT", "BOTTOM_LINE",
    ],
    "unified_prospect": [
        "EXECUTIVE_SUMMARY", "SCOUTING_GRADES", "PROJECTION",
        "DRAFT_POSITIONING", "DEVELOPMENT_PATHWAY", "RISK_ASSESSMENT", "BOTTOM_LINE",
    ],
    "goalie": [
        "EXECUTIVE_SUMMARY", "KEY_NUMBERS", "TECHNICAL_ASSESSMENT", "MENTAL_GAME",
        "DEVELOPMENT_AREAS", "WORKLOAD_ANALYSIS", "ROLE_FIT", "BOTTOM_LINE",
    ],
    "game_decision": [
        "GAME_SUMMARY", "PLAYER_GRADES", "DEPLOYMENT_NOTES",
        "ADJUSTMENTS", "STANDOUT_PERFORMERS",
    ],
    "season_intelligence": [
        "SEASON_OVERVIEW", "STATISTICAL_PROFILE", "TREND_ANALYSIS",
        "STRENGTHS_CONFIRMED", "CONCERNS_IDENTIFIED", "OFFSEASON_PRIORITIES", "BOTTOM_LINE",
    ],
    "operations": [
        "OPERATIONAL_SUMMARY", "ROSTER_VALUE", "DEPLOYMENT_EFFICIENCY",
        "ASSET_MANAGEMENT", "RISK_FACTORS", "RECOMMENDATION",
    ],
    "team_identity": [
        "TEAM_IDENTITY", "SYSTEM_DETAILS", "PLAYER_ARCHETYPE_FIT",
        "SPECIAL_TEAMS_IDENTITY", "KEY_PERSONNEL", "VULNERABILITIES",
    ],
    "opponent_gameplan": [
        "OPPONENT_OVERVIEW", "KEY_MATCHUPS", "FORECHECK_PLAN",
        "DEFENSIVE_KEYS", "SPECIAL_TEAMS_PREP", "LINE_MATCHING", "GAME_KEYS",
    ],
    "agent_pack": [
        "PLAYER_PROFILE", "STATISTICAL_CASE", "MARKET_POSITION",
        "TALKING_POINTS", "DEVELOPMENT_TRAJECTORY", "RISK_MITIGATION", "RECOMMENDATION",
    ],
    "development_roadmap": [
        "CURRENT_ASSESSMENT", "DEVELOPMENT_PILLARS", "30_DAY_PLAN",
        "90_DAY_PLAN", "SEASON_GOALS", "MEASUREMENT_FRAMEWORK", "BOTTOM_LINE",
    ],
    "family_card": [
        "PLAYER_SNAPSHOT", "SEASON_HIGHLIGHTS", "AREAS_FOR_GROWTH",
        "PATHWAY_OPTIONS", "WHAT_SCOUTS_SEE", "ACTION_ITEMS",
    ],
    "line_chemistry": [
        "LINE_OVERVIEW", "CHEMISTRY_METRICS", "ROLE_COMPLEMENTARITY",
        "OPTIMAL_DEPLOYMENT", "ALTERNATIVES", "VERDICT",
    ],
    "st_optimization": [
        "POWER_PLAY_ASSESSMENT", "PP_UNIT_RECOMMENDATIONS",
        "PENALTY_KILL_ASSESSMENT", "PK_UNIT_RECOMMENDATIONS",
        "PERSONNEL_CHANGES", "PRACTICE_FOCUS",
    ],
    "trade_target": [
        "TARGET_PROFILE", "FIT_ASSESSMENT", "STATISTICAL_EVALUATION",
        "COST_ANALYSIS", "RISK_FACTORS", "COMPARABLE_DEALS", "RECOMMENDATION",
    ],
    "draft_comparative": [
        "CLASS_OVERVIEW", "PLAYER_COMPARISONS", "TIER_RANKINGS",
        "POSITIONAL_BREAKDOWN", "SLEEPER_PICKS", "BUST_RISKS",
    ],
    "season_progress": [
        "PROGRESS_SUMMARY", "GOAL_TRACKING", "STATISTICAL_PROGRESSION",
        "BEHAVIORAL_OBSERVATIONS", "ADJUSTED_PRIORITIES", "NEXT_STEPS",
    ],
    "practice_plan": [
        "PRACTICE_OVERVIEW", "WARM_UP", "SKILL_STATIONS", "TACTICAL_WORK",
        "COMPETE_DRILLS", "SCRIMMAGE_SCENARIOS", "COOL_DOWN", "COACHING_NOTES",
    ],
    "playoff_series": [
        "SERIES_OVERVIEW", "OPPONENT_TENDENCIES", "MATCHUP_PLAN",
        "SPECIAL_TEAMS_STRATEGY", "GOALTENDING_ASSESSMENT", "GAME_1_LINEUP", "SERIES_KEYS",
    ],
    "goalie_tandem": [
        "TANDEM_OVERVIEW", "INDIVIDUAL_ASSESSMENTS", "WORKLOAD_ANALYSIS",
        "SITUATIONAL_DEPLOYMENT", "PERFORMANCE_TRIGGERS", "DEVELOPMENT_CONSIDERATIONS", "RECOMMENDATION",
    ],
    # Phase 2 templates
    "pre_game_intel": [
        "OPPONENT_SNAPSHOT", "KEY_MATCHUPS", "GOALTENDING_REPORT",
        "SPECIAL_TEAMS_INTEL", "GAME_KEYS", "PRE_GAME_TALKING_POINTS", "LINEUP_RECOMMENDATIONS",
    ],
    "player_guide_prep_college": [
        "PLAYER_PROFILE", "READINESS_ASSESSMENT", "PATHWAY_OPTIONS",
        "ACADEMIC_ATHLETIC_BALANCE", "EXPOSURE_STRATEGY", "DEVELOPMENT_TIMELINE",
        "RECRUITING_REALITY_CHECK", "PARENT_ACTION_ITEMS",
    ],
}

# Map old hockey_role values to PXI mode IDs
_ROLE_TO_MODE = {
    "scout": "scout",
    "gm": "gm",
    "coach": "coach",
    "player": "parent",   # players see parent-friendly output
    "parent": "parent",
}

# ─────────────────────────────────────────────────────────
# E) resolve_mode — determine which mode to use
# ─────────────────────────────────────────────────────────
def resolve_mode(
    user_hockey_role: str = "scout",
    explicit_mode: Optional[str] = None,
    template_slug: Optional[str] = None,
) -> str:
    """Resolve the active PXI mode.

    Priority order:
    1. explicit_mode (user/conversation override)
    2. template wiring table (primary mode for the template)
    3. user's hockey_role mapped to closest mode
    """
    # 1. Explicit override
    if explicit_mode and explicit_mode in VALID_MODES:
        return explicit_mode

    # 2. Template wiring
    if template_slug and template_slug in MODE_TEMPLATE_WIRING:
        return MODE_TEMPLATE_WIRING[template_slug]["primary"]

    # 3. User role fallback
    return _ROLE_TO_MODE.get(user_hockey_role, "scout")


# ─────────────────────────────────────────────────────────
# F) build_report_system_prompt — correct injection order
# ─────────────────────────────────────────────────────────
def build_report_system_prompt(
    mode: str,
    base_prompt: str,
    template_prompt: Optional[str] = None,
    template_name: str = "",
) -> str:
    """Assemble a report system prompt in the spec-required injection order.

    Injection order (do not change):
    1. PXI_CORE_GUARDRAILS
    2. PXI_MODE_BLOCKS[mode]
    3. base_prompt (the existing report generation prompt)
    4. template_prompt (from DB, if rich enough)
    """
    parts = [PXI_CORE_GUARDRAILS]

    # Mode block
    mode_block = PXI_MODE_BLOCKS.get(mode, PXI_MODE_BLOCKS.get("scout", ""))
    if mode_block:
        parts.append(mode_block)

    # Base report prompt (existing prompt from main.py)
    parts.append(base_prompt)

    # Template-specific instructions (from DB)
    if template_prompt and len(template_prompt) > 200:
        parts.append(
            f"TEMPLATE-SPECIFIC INSTRUCTIONS FOR {template_name.upper()}:\n{template_prompt}"
        )

    return "\n\n".join(parts)

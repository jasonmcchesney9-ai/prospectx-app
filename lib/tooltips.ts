// ══════════════════════════════════════════════════════════
// ProspectX Tooltip Copy Library v1.0
// All tooltip text lives here. Never hardcode tooltip strings inline.
// ══════════════════════════════════════════════════════════

export const TOOLTIPS = {
  // ── Section 2: PXR Score Block (Player Card) ────────────
  pxr_score:
    "ProspectX Rating \u2014 a 0\u2013100 score ranking this player against all players at their position across all leagues we track. Higher is better. Updated nightly.",
  pxr_tier_elite:
    "Elite \u2014 top player at their level. Performing in the 90th percentile or above across all leagues. Teal badge.",
  pxr_tier_1b:
    "High Impact \u2014 clear impact player at their level. Should be moving up in competition.",
  pxr_tier_2a:
    "Solid Starter \u2014 consistent contributor. Reliable at their current level.",
  pxr_tier_2b:
    "Depth Player \u2014 role player. Solid at current level, limited upside.",
  pxr_tier_3a:
    "Developmental \u2014 in the system. Needs time and reps.",
  pxr_tier_fringe:
    "Fringe \u2014 borderline roster player at current level.",
  pxr_estimated:
    "Estimated PXR \u2014 calculated from game stats only. Full PXR requires advanced microstat data. Use as a guide, not a definitive ranking.",
  pxr_null:
    "Insufficient data \u2014 this player has not yet met the minimum ice time threshold for a PXR score. Scores require 60+ minutes of tracked ice time.",
  league_pct:
    "League Percentile \u2014 how this player ranks within their own league and position. 74th means they outperform 74% of players in the same league.",
  cohort_pct:
    "Cohort Percentile \u2014 how this player ranks among all players born the same year, across every league we track. The most important number for draft evaluation.",
  age_mod_positive:
    "Age Modifier \u2014 this player is young for their level and outperforming their birth-year peers globally. Adds up to +5 points to their PXR score.",
  age_mod_negative:
    "Age Modifier \u2014 this player is overage for their level, which reduces their PXR score by up to 5 points. Dominating a weaker league as an older player carries less weight.",
  p1_offense:
    "P1 \u2014 Offensive Production. Measures goals, primary assists, expected goals, shots, and scoring chances per 60 minutes. Weighted 35% for forwards, 15% for defense.",
  p2_defense:
    "P2 \u2014 Defensive Responsibility. Measures defensive zone faceoffs, blocked shots, takeaways, and expected goals against per 60 minutes. Weighted 35% for defense, 15% for forwards.",
  p3_possession:
    "P3 \u2014 Possession & Transition. Measures zone entries, zone exits, pass accuracy, puck battles won, and Corsi%. Weighted 25% for all skaters.",
  p4_physical:
    "P4 \u2014 Physical & Compete. Measures puck battles won percentage, hits, PIM balance, and physical engagement rate. Weighted 25% for defense, 15% for forwards.",

  // ── Section 3: Reports Page & Report Types ──────────────
  report_elite_profile:
    "A comprehensive 9-section profile of a player\u2019s full game. Covers offense, defense, possession, compete, game-state usage, development targets, and a staff action checklist.",
  report_scout_report:
    "A scouting-grade evaluation written for hockey operations. Covers projection language, cross-league rank, and a bias-controlled assessment.",
  report_parent_report:
    "A plain-language development summary written for the player\u2019s family. Covers strengths, areas to grow, and cohort context in everyday language \u2014 no jargon.",
  report_agent_pack:
    "A professional player brief for agent use. Centres on the PXR score, tier, cohort rank, and advancement readiness for team conversations.",
  report_team_identity:
    "A full team identity document covering playing style, tactical systems, personnel roles, special teams, and strength/vulnerability analysis.",
  report_opponent_gameplan:
    "An 11-section opponent preparation document. Covers identity, player threats, line matchups, period plan, TOI targets, and win conditions.",
  report_playoff_series:
    "A series-level preparation document covering identity clash, player role tiers, series phasing, adjustment framework, and a series bench card.",
  report_full_team_coaching:
    "A coaching review document covering identity vs intention gaps, CEI-ranked player list, minute ceilings, game-state usage, and staff alignment checklist.",
  report_personnel_suggestion:
    "A deployment analysis identifying overdeployed, underdeployed, and miscast players. Includes line optimization proposals and special teams suggestions.",
  report_role_adjustment:
    "A single-player role recommendation. Verdict: MAINTAIN, EXPAND, CONTRACT, or CHANGE \u2014 with an implementation plan and reassessment triggers.",
  report_in_season_projections:
    "Pace-to-finish projections in three bands (conservative/realistic/optimistic) with trend classification and advancement readiness verdict.",
  report_dev_roadmap:
    "A development roadmap setting specific targets for the next 30/60/90 days, anchored to the player\u2019s cohort percentile benchmarks.",
  report_bias_controlled:
    "An evaluation designed to remove common scouting biases. PXR is the objective anchor. Separates what the data shows from what the eye sees.",
  report_bench_card:
    "A one-page game-day reference card with line matchups, deployment rules, special teams cues, and game-state instructions for the bench.",
  pxi_confidence_confidence:
    "CONFIDENCE \u2014 this statement is supported by statistical data in our system.",
  pxi_confidence_inference:
    "INFERENCE \u2014 this statement is a reasonable conclusion drawn from patterns in the data, but is not directly stated by the numbers.",
  pxi_confidence_unavailable:
    "DATA NOT AVAILABLE \u2014 this element could not be assessed due to missing data. No assumptions have been made.",

  // ── Section 4: Leaderboard Page ─────────────────────────
  leaderboard_by_league:
    "Rankings within each league and position group. Shows the top 25 forwards, defensemen, and goalies in each league \u2014 who\u2019s best in their own environment.",
  leaderboard_by_cohort:
    "Rankings by birth year across all leagues. Shows who the best 2007-born forwards are globally, regardless of what league they play in. The draft scout\u2019s view.",
  leaderboard_rising:
    "Rising \u2014 players whose PXR score increased the most since the last nightly recalculation. Early indicator of breakout performance.",
  leaderboard_undervalued:
    "Players with a high cohort percentile but a lower league percentile. High global rank, playing in a strong league where they\u2019re not a standout yet. Hidden gems.",
  leaderboard_rank:
    "Position on the leaderboard. Updated nightly after PXR scores are recalculated.",
  leaderboard_pxr:
    "ProspectX Rating \u2014 composite 0\u2013100 score. See the player card for full breakdown.",
  leaderboard_pillars:
    "Quick view of each pillar score. Helps identify specialists (elite in one area) vs balanced players.",
  leaderboard_age_mod:
    "Age Modifier applied to this player\u2019s score. Green = positive (young, outperforming cohort). Orange = negative (overage, playing down in competition).",
  leaderboard_est_badge:
    "Estimated PXR \u2014 calculated from game stats. Full PXR requires advanced microstat data. Rankings are directionally correct but less precise.",

  // ── Section 5: Player Profile Page ──────────────────────
  player_grade_tile:
    "AI-generated grade from 0\u201310 for this dimension of the player\u2019s game. Based on available scouting data and statistical performance. Not the same as PXR.",
  player_archetype:
    "Player archetype describes the style of player this person is \u2014 how they contribute, what their game is built around. Set from scouting data.",
  player_gpg:
    "Goals per game this season. Calculated from total goals divided by games played.",
  player_apg:
    "Assists per game this season.",
  player_ppg:
    "Points per game this season. The primary production rate stat.",
  player_plus_minus:
    "Plus/Minus \u2014 the goal differential when this player is on the ice. Positive means more goals for than against during their shifts.",
  player_pim:
    "Penalty minutes this season. High PIM can indicate physical play style or discipline concerns.",
  player_dev_plan:
    "This player\u2019s active development plan. Set by coaching staff. Tracks focus areas, milestones, and progress over the season.",
  player_scout_notes:
    "Private scouting notes for this player. Visible to staff only. Never shared with the player or family unless explicitly promoted.",
  player_transfers:
    "Transfer history \u2014 every team this player has played for, with dates and context. Useful for understanding development trajectory.",

  // ── Section 6: Bench Talk (PXI Chat) ────────────────────
  benchtalk_open:
    "Open Bench Talk \u2014 your AI coaching assistant. Ask about this player, request a report, or get tactical advice. Conversation is private to you.",
  benchtalk_chip_scout:
    "Quick prompt: ask PXI to run a scouting analysis on this player using all available data.",
  benchtalk_chip_gameplan:
    "Quick prompt: ask PXI to build a game plan for tonight\u2019s game.",
  benchtalk_chip_depth:
    "Quick prompt: ask PXI to analyze your roster depth by position and line.",
  benchtalk_chip_dev:
    "Quick prompt: ask PXI to review this player\u2019s development progress against their plan targets.",
  benchtalk_private:
    "Your Bench Talk conversation is completely private. No one else \u2014 including other staff, GMs, or admins \u2014 can see your conversation history.",
  benchtalk_context:
    "PXI is aware of which player or team you\u2019re viewing. Your questions are answered in that context automatically.",

  // ── Section 7: Rink Builder / Whiteboard ────────────────
  rink_custom_drill_mode:
    "Custom Drill Mode \u2014 draw a drill and save it to your Drill Library. Saved drills can be used in Practice Plans and searched by skill area.",
  rink_chalk_talk_mode:
    "Chalk Talk Mode \u2014 draw plays, systems, or teaching moments. Saved as boards for your own reference. Never auto-added to Drill Library.",
  rink_save_drill:
    "Save this drawing as a drill in your library. You\u2019ll need to add a name, description, skill tags, and intensity level.",
  rink_save_chalk:
    "Save this board to My Boards. Only requires a name. Boards are private to you and your org.",
  rink_my_boards:
    "Your saved Chalk Talk boards. Open any board to continue drawing or share it with your team.",
  rink_save_to_drill:
    "Convert this Chalk Talk board into a Drill Library entry. You\u2019ll need to fill in all drill metadata before it can be used in practice plans.",

  // ── Section 8: Navigation & General UI ──────────────────
  nav_league_hub:
    "League Hub \u2014 browse all leagues, teams, and players across the platform. Public data visible to all staff roles.",
  nav_draft_board:
    "Draft Board \u2014 your ranked list of all tracked players sorted by PXR score. Filter by league, position, birth year, and tier.",
  nav_leaderboard:
    "Leaderboard \u2014 top players by PXR score within each league and birth year cohort. Updated nightly.",
  nav_film_room:
    "Film Room \u2014 link and organize video clips for players and teams. Attach clips to player profiles and share with staff.",
  nav_whiteboard:
    "Whiteboard \u2014 draw plays, systems, and drills on an interactive rink diagram. Save boards and convert them to your Drill Library.",
  nav_org_hub:
    "Org Hub \u2014 your organization\u2019s internal workspace. Messages, shared film, whiteboards, and team management.",
  tier_badge_pro:
    "Pro tier \u2014 full platform access including all PXI reports, PXR scoring, leaderboards, and org management.",
  tier_badge_starter:
    "Starter tier \u2014 core scouting and reporting features. Upgrade to Pro for leaderboards, draft board, and advanced PXR data.",
  share_button:
    "Share \u2014 send this report, plan, or note to a player, family, or agent. They\u2019ll see it in their portal. You control what they can see.",
  visibility_private:
    "Private \u2014 only you can see this. Not visible to other staff, players, or families.",
  visibility_staff:
    "Staff Only \u2014 visible to all staff in your organization. Not visible to players or families.",
  visibility_player:
    "Shared with Player \u2014 this player can see this in their portal.",
  visibility_family:
    "Shared with Family \u2014 the player\u2019s family can see this in their portal.",
} as const;

export interface HelpGuide {
  id: string;
  title: string;
  outcome: string;
  steps: string[];
  tips?: string[];
  routes: string[];
}

export type HelpGuideMap = Record<string, HelpGuide>;

export const HELP_GUIDES: HelpGuideMap = {
  dashboard: {
    id: "dashboard",
    title: "Review Your Roster and Platform Status",
    outcome:
      "Get a quick read on your team, recent reports, and platform activity.",
    steps: [
      "Click Dashboard in the left sidebar (home icon) to open your main overview.",
      "Review the roster summary — active players, recent imports, and PXR score distribution.",
      "Click any player name in the roster widget to jump directly to their profile.",
      "Check the Recent Reports section to see the last reports generated across your org.",
      "Click the team name heading to open the full team page.",
      "Click Sync in the top-right of the dashboard to trigger a fresh roster and stats refresh.",
    ],
    tips: [
      "Use the dashboard before a game day to confirm your roster is current.",
      "If a player is missing from the roster widget, check Imports — they may not be synced yet.",
      "Click any stat number on the dashboard to drill into the full leaderboard.",
    ],
    routes: ["/"],
  },

  players_all: {
    id: "players_all",
    title: "Find and Filter Players",
    outcome: "Search, filter, and browse all players in the system.",
    steps: [
      "Click Players in the left sidebar to open the full player list.",
      "Type a name in the search bar to find a specific player — results filter as you type.",
      "Use the League, Position, and Team dropdowns to narrow the list.",
      "Click a player's name to open their full profile.",
      "Click Add to Tracking on any player card to save them to your scouting list.",
      "Use the sort headers (PXR, PPG, GP) to rank players within the current filter.",
    ],
    tips: [
      "Search by last name first — results are faster and more precise.",
      "Filter by birth year to focus on a specific draft class.",
      "Use the PXR column to quickly rank prospects without opening individual profiles.",
    ],
    routes: ["/players"],
  },

  player_profile: {
    id: "player_profile",
    title: "Read a Player Profile",
    outcome:
      "Understand a player's stats, PXR score, reports, and development status.",
    steps: [
      "Click any player name across the platform to open their profile.",
      "Review the header — PXR score, tier badge, position, team, age, and current season stats.",
      "Click the Stats tab to see season-by-season stats, game log, and progression chart.",
      "Click the Reports tab to view or generate PXI reports for this player.",
      "Click the Dev Plan tab to view or generate their season development plan.",
      "Click the Notes tab to read or add scout notes.",
      "Click the Video tab to see any film sessions associated with this player.",
      "Use the Quick Actions panel on the right to generate a report, add to tracking, or download a player card.",
    ],
    tips: [
      "The PXR score in the header always reflects the most recent season — check Stats for historical trends.",
      "Run Generate Report from Quick Actions to skip navigating to the Reports tab.",
      "The amber PXR~ badge means the score is estimated — the player has limited tracked data.",
    ],
    routes: ["/players/[id]"],
  },

  reports: {
    id: "reports",
    title: "Create and Share a Player Report",
    outcome:
      "Generate a PXI report for any player and share it with your staff.",
    steps: [
      "Click Players in the left sidebar, then select the player you want to report on.",
      "Click the Reports tab on the player's profile page.",
      "Click Generate Report, then select a report type from the dropdown.",
      "Wait for the report to generate — this usually takes 10-20 seconds.",
      "Click View Report to open the full report.",
      "Click PDF in the top-right corner to download a formatted copy.",
      "Click Copy Link to copy a shareable URL to your clipboard.",
      "Send the link or PDF to your staff — anyone in your org with the link can view it.",
    ],
    tips: [
      "Run Elite Player Profile first — it covers the most ground and works well for staff reviews.",
      "Reports are saved automatically under the player's Reports tab.",
      "Use PDF for external sharing (agents, parents); use Copy Link for internal staff.",
    ],
    routes: ["/reports", "/players/[id]"],
  },

  film_hub: {
    id: "film_hub",
    title: "Navigate the Film Hub",
    outcome:
      "Find your film sessions, uploads, and reels from the Film Hub overview.",
    steps: [
      "Click Film Hub in the left sidebar to open the overview.",
      "Use the SESSIONS tab to see your recent film sessions.",
      "Use the UPLOADS tab to see all uploaded video files and their processing status.",
      "Use the REELS tab to see all highlight reels created from your sessions.",
      "Click the stats pills at the top (Sessions, Clips, Events, Reports) to filter the session list.",
      "Click any session card to open that session in the viewer.",
      "Click Upload Video or Create Session to start new work.",
    ],
    tips: [
      "The session card shows a Reel badge when a highlight reel has been created from it.",
      "Filter by Clips to quickly find sessions that have tagged moments.",
      "Processing usually takes 1-3 minutes after upload — refresh the Uploads tab to check status.",
    ],
    routes: ["/film"],
  },

  film_session: {
    id: "film_session",
    title: "Create a Film Session and Tag Key Moments",
    outcome: "Upload game film, create a session, and tag key moments.",
    steps: [
      "Click Film Hub in the left sidebar, then click Create Session.",
      "Type a session name and type, then click Create.",
      "Click Upload Video or paste a video URL to add footage to the session.",
      "Once the video loads, use the video controls to find the moment you want to tag.",
      "Click Mark In at the start of the sequence, then Mark Out at the end.",
      "Click a tag type (Goal, Turnover, Breakout, etc.) to categorize the clip.",
      "Repeat for each sequence you want to tag.",
      "Click Generate Analysis in the right panel to run PXI on all tagged clips.",
    ],
    tips: [
      "Tag in real time — you can edit clip timestamps after.",
      "Use keyboard shortcuts: I for Mark In, O for Mark Out, Space to pause.",
      "The PXI tab in the right panel shows the analysis after generation — no need to navigate away.",
    ],
    routes: ["/film/sessions/[id]"],
  },

  reel_builder: {
    id: "reel_builder",
    title: "Build a Highlight Reel",
    outcome:
      "Select clips from a film session and compile them into a shareable highlight reel.",
    steps: [
      "Open a film session that has tagged clips.",
      "Click the REELS tab in the right panel.",
      "Click New Reel to open the reel builder.",
      "Select a preset — Game Highlights, Player Highlights, or Teaching Reel — or choose Custom.",
      "Review the auto-selected clips and add or remove clips as needed.",
      "Drag clips to reorder them.",
      "Type a reel name, then click Create Reel.",
      "Click Download or Copy Share Link from the success toast.",
    ],
    tips: [
      "Player Highlights preset filters clips by player — select a player from the dropdown first.",
      "Teaching Reel auto-selects turnovers, giveaways, and coverage breakdowns.",
      "Share links are permanent — you can send them to players, parents, or agents.",
    ],
    routes: ["/film", "/film/sessions/[id]"],
  },

  bench_talk: {
    id: "bench_talk",
    title: "Ask PXI a Question Using BenchTalk",
    outcome:
      "Use BenchTalk to ask PXI anything about a player, a report, or how the platform works.",
    steps: [
      "Click BenchTalk in the left sidebar or click the Ask PXI button on any player profile or tile.",
      "Type your question in plain language.",
      "Press Enter to send.",
      "Read PXI's response — it uses your actual player data and stats to answer.",
      "Ask follow-up questions in the same chat to dig deeper.",
      "Click New Chat to start a new topic.",
    ],
    tips: [
      "Ask specific questions with player names for better answers.",
      "BenchTalk has access to your full roster and stats — you do not need to paste any data.",
      "Use it before a game to prep talking points or after to debrief on performance.",
    ],
    routes: ["/bench-talk"],
  },

  dev_plan: {
    id: "dev_plan",
    title: "Generate and Review a Player Development Plan",
    outcome:
      "Create a season development plan for a player and track their progress.",
    steps: [
      "Open the player's profile and click the Dev Plan tab.",
      "Click Generate Dev Plan to create a new plan using PXI.",
      "Review the generated sections — Strengths, Focus Areas, Objectives, Drills, Milestones.",
      "Click any section to edit it directly.",
      "Click Save to finalize the plan.",
      "Click the version dropdown to compare with previous plans.",
      "To share with the player or parent, click Share Plan — they see sections 1-7 only.",
    ],
    tips: [
      "Generate a new plan at the start of each season and after major turning points.",
      "The Film Evidence section auto-populates from tagged clips if film sessions exist for this player.",
      "Parents see a plain-language version — coaching staff notes are hidden from their view.",
    ],
    routes: ["/players/[id]"],
  },

  scout_notes: {
    id: "scout_notes",
    title: "Add and Review Scout Notes",
    outcome:
      "Write scouting observations on any player and review notes from your staff.",
    steps: [
      "Open the player's profile and click the Notes tab.",
      "Click Add Note to create a new scouting entry.",
      "Select a note type — Game Observation, Practice, Combine, or General.",
      "Type your notes in the text field.",
      "Click Save Note.",
      "To view all notes across your org, click Scout Notes in the Org Hub.",
      "Use the filter to narrow by date, scout, or note type.",
    ],
    tips: [
      "Keep notes brief and specific — one observation per note is more useful than long summaries.",
      "Tag the game or practice date in the note for context.",
      "Notes are visible to all PRO users in your org.",
    ],
    routes: ["/scout-notes", "/players/[id]"],
  },

  watchlist: {
    id: "watchlist",
    title: "Add and Manage Your Watchlist",
    outcome:
      "Track players you are evaluating by adding them to your personal watchlist.",
    steps: [
      "Click Watchlist in the Org Hub dropdown.",
      "Click Add Player and search by name to find a prospect.",
      "Set a priority — Hot, Warm, or Cold.",
      "Add a note with your initial assessment.",
      "Click Save to add them to your list.",
      "To push a player to the org-wide Scouting Pipeline, click Push to Pipeline on their row.",
      "Filter your watchlist by priority or position to focus your evaluation.",
    ],
    tips: [
      "Your watchlist is private — only you can see it.",
      "Use Push to Pipeline when you want your GM or other scouts to evaluate the same player.",
      "When pushed, PXI generates a brief candidate summary and attaches it to the pipeline entry.",
    ],
    routes: ["/watchlist"],
  },

  scouting_pipeline: {
    id: "scouting_pipeline",
    title: "Review the Scouting Pipeline",
    outcome:
      "See all players your scouting staff has nominated for evaluation and track their status.",
    steps: [
      "Click Org Hub in the left sidebar, then click Scouting Pipeline.",
      "Review the list of nominated players — each entry shows the source scout and PXI summary.",
      "Click a player's name to open their full profile.",
      "Update the status — Under Review, Shortlisted, or Passed — using the status dropdown.",
      "Add pipeline notes in the notes field on each entry.",
      "Use the priority filter to focus on your top candidates.",
    ],
    tips: [
      "Players are added to the pipeline from the Watchlist — scouts use Push to Pipeline.",
      "The PXI summary on each entry was generated at the time of nomination.",
      "Sort by date added to see the most recent nominations first.",
    ],
    routes: ["/org-hub"],
  },

  draft_board: {
    id: "draft_board",
    title: "Use the Draft Board",
    outcome:
      "View and organize your ranked draft candidates using the PXR-powered draft board.",
    steps: [
      "Click Draft Board in the left sidebar.",
      "Review the ranked list — players are ordered by PXR score by default.",
      "Use the position and league filters to narrow the board.",
      "Click a player's name to open their full profile.",
      "Drag players to reorder them within their tier.",
      "Click Add Note on any player to record your draft rationale.",
      "Click Export to download the board as a PDF or CSV.",
    ],
    tips: [
      "The PXR score is the default ranking — adjust manually based on your own evaluation.",
      "Tier groupings are based on PXR ranges — Elite, High, Developing, Emerging.",
      "Use the board view in your draft room on draft day — it updates in real time.",
    ],
    routes: ["/draft-board"],
  },

  game_hub: {
    id: "game_hub",
    title: "Access Game Information and Sheets",
    outcome:
      "Find recent game results, upload game sheets, and access game-day intelligence.",
    steps: [
      "Click Game Hub in the left sidebar.",
      "Review the recent games list — click any game to open its detail page.",
      "Click Upload Game Sheet to scan and parse a game sheet using PXI Vision.",
      "Review the parsed boxscore — confirm player names and stats before saving.",
      "Click Save to write the game data to your database.",
      "Click Generate War Room from any game to open a pre-populated Chalk Talk session.",
    ],
    tips: [
      "Game sheets parse in seconds — PXI Vision handles handwritten and printed formats.",
      "Confirm player name matches carefully — the parser uses your roster to auto-match.",
      "War Room sessions pre-load with the parsed line combinations and game stats.",
    ],
    routes: ["/game-hub", "/game-hub/[id]"],
  },

  war_room: {
    id: "war_room",
    title: "Run a War Room Session",
    outcome:
      "Use the War Room to prepare a tactical game plan with PXI intelligence.",
    steps: [
      "Click Game Plans in the left sidebar, then click New Game Plan.",
      "Select the opponent and game type.",
      "Review the pre-loaded opponent analysis in the PXI panel.",
      "Edit the game plan sections — Systems, Matchups, Line Deployment, Keys.",
      "Click PXI Analyse to generate fresh intelligence for any section.",
      "Click the canvas to open the Rink Builder for diagramming plays.",
      "Click Export to save as PDF or share with staff.",
    ],
    tips: [
      "The PXI panel pulls from the opponent's last 5 games — review it before editing.",
      "Link a film session to the war room using Link Film Clip in the action bar.",
      "Share the plan link with your staff so everyone is aligned before puck drop.",
    ],
    routes: ["/chalk-talk/sessions/[id]"],
  },

  practice_plans: {
    id: "practice_plans",
    title: "Generate a Practice Plan",
    outcome:
      "Create a structured practice plan based on a game issue or development target.",
    steps: [
      "Click Coaching in the left sidebar, then select Practice Plans.",
      "Click Generate Practice Plan.",
      "Select the focus area — for example, Defensive Zone Coverage, Power Play, or Compete.",
      "Select the session length (45, 60, or 75 min).",
      "Click Generate — PXI builds a structured plan with warm-up, drills, and cool-down.",
      "Review and edit individual drill blocks as needed.",
      "Click Save to store the plan, or PDF to download and print it.",
    ],
    tips: [
      "Use Generate from Game Issue to build a plan directly from a problem spotted in film.",
      "Saved plans appear in your Practice Plans list for reuse.",
      "Add drill diagrams from the Rink Builder by linking them to a drill block.",
    ],
    routes: ["/practice-plans", "/practice-plans/generate"],
  },

  drill_library: {
    id: "drill_library",
    title: "Find a Drill in the Drill Library",
    outcome:
      "Search and browse the drill library to find the right drill for your practice.",
    steps: [
      "Click Coaching in the left sidebar, then select Drill Library.",
      "Use the search bar to find drills by name or keyword.",
      "Filter by category — Skating, Passing, Shooting, Systems, Battle, or Conditioning.",
      "Filter by age level and ice surface to narrow results.",
      "Click a drill card to see the full description, setup, and coaching points.",
      "Click Save to add the drill to your saved drills.",
      "Click Add to Plan to insert the drill into an existing practice plan.",
    ],
    tips: [
      "Intensity filter helps when energy management matters — use Low for early-week sessions.",
      "Drill diagrams appear when available — click to enlarge.",
      "Use the Skills Library for technique breakdowns — the Drill Library is for on-ice activities.",
    ],
    routes: ["/drill-library"],
  },

  rink_builder: {
    id: "rink_builder",
    title: "Draw and Save a Drill Diagram",
    outcome:
      "Use the Rink Builder canvas to draw a drill or play diagram and save it to your drill library.",
    steps: [
      "Click Coaching in the left sidebar, then select Rink Builder.",
      "Choose your canvas type — Full Ice, Half Ice, Quarter Ice, or Blank Board.",
      "Select a drawing tool from the toolbar (puck, player token, arrow, zone, freehand).",
      "Draw your drill or play on the canvas — click and drag to place elements.",
      "Use sticky notes to add coaching cues directly on the diagram.",
      "Click Save Drill, type a name and description, then click Save.",
      "Access saved drills in the Drill Library under the Coaching dropdown.",
    ],
    tips: [
      "Press ? to open the keyboard shortcuts overlay.",
      "Use arrow keys to nudge selected elements precisely after placing them.",
      "Use Save As to create a progression variant of an existing drill.",
    ],
    routes: ["/rink-builder"],
  },

  series_planning: {
    id: "series_planning",
    title: "Create a Playoff Series Plan",
    outcome:
      "Build a multi-game tactical plan for a playoff series using PXI opponent intelligence.",
    steps: [
      "Click Coaching in the left sidebar, then select Series Planning.",
      "Click New Series and select the opponent.",
      "Review the opponent scouting summary generated by PXI.",
      "Fill in each game plan section — Tactical Systems, Key Matchups, Line Deployment.",
      "Use the Adjustments field after each game to record what changed.",
      "Click the Game 1/2/3 tabs to move between games in the series.",
      "Click Export to download the full series plan as a PDF.",
    ],
    tips: [
      "Run the Series Plan before Game 1 — adjustments are more valuable than predictions.",
      "Use the Adjustments field after each game to capture what changed.",
      "Share the series plan with your full staff so everyone is aligned.",
    ],
    routes: ["/series-planning", "/series-planning/[id]"],
  },

  league_hub: {
    id: "league_hub",
    title: "Navigate the League Hub",
    outcome:
      "Browse league standings, team pages, and player stats across all tracked leagues.",
    steps: [
      "Click League Hub in the left sidebar.",
      "Select a league from the league selector at the top.",
      "Review the standings table — click any team name to open the team page.",
      "Click the Players tab to see all players in the league ranked by PXR or stats.",
      "Click any player name to open their profile.",
      "Use the Stats tab for league-wide stat leaders.",
      "Use the Schedule tab for game results and upcoming games.",
    ],
    tips: [
      "League data syncs nightly from HockeyTech — check the sync timestamp if data looks stale.",
      "Player PXR scores on the league leaderboard update with each nightly sync.",
      "Use the league hub to scout players outside your org without importing them.",
    ],
    routes: ["/league-hub", "/league-hub/[id]"],
  },

  imports: {
    id: "imports",
    title: "Import Players and Stats",
    outcome:
      "Upload player rosters or stats files to populate or update your database.",
    steps: [
      "Click the Imports dropdown in the left sidebar.",
      "To import a roster, click CSV Import and upload a formatted player CSV file.",
      "To import InStat stats, click Import Stats (XLSX) and upload an InStat export file.",
      "Review the import summary — rows processed, rows skipped, errors.",
      "Click Confirm to write the data to your database.",
      "Click Normalize Leagues in Admin if league names look inconsistent after import.",
      "Click Sync in HockeyTech Sync to trigger a fresh roster pull from the league feed.",
    ],
    tips: [
      "Use the CSV template from the import page — custom column orders may not parse correctly.",
      "Run Normalize Leagues in Admin after any large import to fix league name drift.",
      "InStat exports must be from the standard player stats view — game log exports use a different format.",
    ],
    routes: ["/imports", "/imports/csv", "/imports/xlsx"],
  },

  broadcast_hub: {
    id: "broadcast_hub",
    title: "Use Broadcast Tools for Game Prep",
    outcome:
      "Access broadcast preparation tools including storylines, spotting boards, and live stat cards.",
    steps: [
      "Click Broadcast in the left sidebar to open the Broadcast Hub.",
      "Select the game you are preparing for from the game selector.",
      "Click Storyline Generator to get PXI-suggested story angles for the broadcast.",
      "Click Spotting Board to build your pre-game player reference sheet.",
      "Click Live Stat Cards to generate on-screen graphic content for key stats.",
      "Click Post-Game Script to generate a structured post-game summary.",
      "Click Interview Questions to get suggested questions for player and coach interviews.",
    ],
    tips: [
      "Run the Storyline Generator at least one hour before puck drop.",
      "The Spotting Board pulls from live PXR data — it is always current.",
      "Export any tool output as PDF for your production binder.",
    ],
    routes: ["/broadcast"],
  },

  player_guide: {
    id: "player_guide",
    title: "Navigate the Player Development Resource Guide",
    outcome:
      "Access development resources, training guides, and mental performance tools.",
    steps: [
      "Click Player Guide in the left sidebar.",
      "Browse resource sections — Nutrition, Workouts, Mental Performance, College Prep, Gear, Glossary.",
      "Click any section tile to expand its content.",
      "Click Ask PXI on any section to open BenchTalk with a pre-seeded question about that topic.",
      "Use the Development Journey Tracker to log progress on specific skill areas.",
      "Click Translator Toggle to switch content between coach-language and player-language.",
    ],
    tips: [
      "Share the College Prep section with players exploring NCAA or university options.",
      "The Pressure and Confidence Tool is useful for players struggling with performance anxiety.",
      "The Glossary explains both hockey terms and PXI-specific terms like PXR and percentiles.",
    ],
    routes: ["/player-guide"],
  },

  my_player_parent: {
    id: "my_player_parent",
    title: "Find Your Player and Access Family Tools",
    outcome:
      "Select your player in My Player and access their profile, reports, and development resources.",
    steps: [
      "Click My Player in the left sidebar.",
      "Click the Select Your Player dropdown and type your player's name to search.",
      "Click your player's name in the list to select them.",
      "Click Generate Profile Card to create a shareable player card.",
      "Scroll down to view the resource tiles — click any tile to get PXI guidance on that topic.",
      "Click an After-Game Help emotion chip to get a suggested script for your post-game conversation.",
      "Click Ask PXI on any tile to open BenchTalk and ask follow-up questions.",
    ],
    tips: [
      "PXI remembers your last player selection — you do not need to re-select each visit.",
      "The Parent Tip of the Day refreshes daily — click Shuffle to see another tip.",
      "Use After-Game Help before you get in the car, not after.",
    ],
    routes: ["/my-player"],
  },

  glossary: {
    id: "glossary",
    title: "Look Up Hockey Terms and PXI Definitions",
    outcome:
      "Find plain-language definitions for hockey terms and PXI-specific scores and metrics.",
    steps: [
      "Click Coaching in the left sidebar, then select Glossary.",
      "Type any term in the search bar — hockey terms and PXI terms are both included.",
      "Click a term to see its full definition and any related metrics.",
      "Use the category filter to browse by section — PXR Scores, Skating, Tactics, Stats.",
      "Click Ask PXI next to any term to open BenchTalk with that term as context.",
    ],
    tips: [
      "Search \"PXR\" to see definitions for all scoring components — P1 through P5.",
      "Use the Glossary when reviewing reports with players or parents who are new to the platform.",
      "Terms are written in plain language — no stats background required.",
    ],
    routes: ["/glossary"],
  },

  admin: {
    id: "admin",
    title: "Manage the Platform as an Admin",
    outcome:
      "Review platform usage, manage users, normalize data, and run the PXR engine.",
    steps: [
      "Click Admin in the left sidebar (visible to admin and superadmin roles only).",
      "Click the Users tab to view all active accounts, roles, and last login dates.",
      "Click Platform to review usage — reports generated, sessions created, active users.",
      "Click the PXR Ops tab to run data maintenance tasks.",
      "Click Normalize Leagues to fix league name drift after a large import.",
      "Click Recalculate PXR to refresh all player scores after a major data update.",
      "Click Sync History to review recent HockeyTech roster syncs.",
    ],
    tips: [
      "Run Normalize Leagues and Normalize Seasons after every bulk import.",
      "Recalculate PXR takes 30-60 seconds — do not navigate away while it runs.",
      "Check the Errors tab first if anything looks wrong after an import or sync.",
    ],
    routes: ["/admin"],
  },
};

export function getGuideForRoute(pathname: string): HelpGuide | null {
  const match = Object.values(HELP_GUIDES).find((guide) =>
    guide.routes.some((route) => {
      const pattern = route.replace(/\[.*?\]/g, "[^/]+");
      return new RegExp(`^${pattern}$`).test(pathname);
    })
  );
  return match ?? null;
}

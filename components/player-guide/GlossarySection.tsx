"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";

type GlossaryCategory =
  | "all"
  | "positions"
  | "stats"
  | "advanced"
  | "systems"
  | "penalties"
  | "equipment"
  | "levels";

interface GlossaryEntry {
  term: string;
  definition: string;
  example: string;
  related: string[];
  category: GlossaryCategory;
}

const CATEGORIES: { key: GlossaryCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "positions", label: "Positions" },
  { key: "stats", label: "Stats" },
  { key: "advanced", label: "Advanced Stats" },
  { key: "systems", label: "Systems" },
  { key: "penalties", label: "Penalties" },
  { key: "equipment", label: "Equipment" },
  { key: "levels", label: "Levels" },
];

const GLOSSARY_TERMS: GlossaryEntry[] = [
  // Positions
  { term: "Center (C)", definition: "Forward position responsible for faceoffs, both offensive playmaking and defensive responsibility in the middle of the ice.", example: "The center won the draw cleanly back to the defenseman.", related: ["Forward", "Faceoff"], category: "positions" },
  { term: "Left Wing (LW)", definition: "Forward who plays primarily on the left side of the ice. Typically a right-handed shot playing their off-wing, or a left-handed shot on their natural side.", example: "The left wing drove wide and cut to the net.", related: ["Forward", "Winger"], category: "positions" },
  { term: "Right Wing (RW)", definition: "Forward who plays primarily on the right side of the ice.", example: "The right wing got open on the back door for a tap-in goal.", related: ["Forward", "Winger"], category: "positions" },
  { term: "Defenseman (D)", definition: "Player who lines up on the blue line, responsible for preventing opposing scoring chances and starting breakouts.", example: "The defenseman pinched down the wall to keep the puck in.", related: ["Blue line", "Breakout"], category: "positions" },
  { term: "Goaltender (G)", definition: "The last line of defense. Positioned in the crease to stop shots on net.", example: "The goaltender made a highlight-reel glove save.", related: ["Crease", "Save percentage"], category: "positions" },

  // Stats
  { term: "GP (Games Played)", definition: "Total number of games a player has appeared in.", example: "He's played 42 GP this season.", related: ["Season", "Roster"], category: "stats" },
  { term: "G (Goals)", definition: "Number of goals scored by a player.", example: "She leads the league with 28 goals.", related: ["Points", "Assists"], category: "stats" },
  { term: "A (Assists)", definition: "Credited when a player's pass or play directly leads to a teammate scoring. Up to two assists per goal.", example: "He picked up the secondary assist on the power play goal.", related: ["Points", "Primary assist"], category: "stats" },
  { term: "P (Points)", definition: "The sum of goals and assists. The most common measure of offensive production.", example: "With 65 points, she's on pace for a career year.", related: ["Goals", "Assists"], category: "stats" },
  { term: "PPG (Power Play Goals)", definition: "Goals scored while the team has a man advantage due to an opponent's penalty.", example: "Their PP1 has 12 PPG this season.", related: ["Power play", "Man advantage"], category: "stats" },
  { term: "+/- (Plus/Minus)", definition: "A player is +1 when on ice for an even-strength or shorthanded goal for, and -1 for a goal against. Does not count power play goals.", example: "The top line is a combined +45 this season.", related: ["Even strength", "On-ice impact"], category: "stats" },
  { term: "PIM (Penalties in Minutes)", definition: "Total penalty minutes accumulated by a player.", example: "He's racked up 68 PIM — the team enforcer.", related: ["Penalties", "Discipline"], category: "stats" },
  { term: "SV% (Save Percentage)", definition: "Percentage of shots on goal stopped by the goaltender. Calculated as saves / shots on goal.", example: "A .920 SV% is considered solid at the junior level.", related: ["GAA", "Goaltending"], category: "stats" },
  { term: "GAA (Goals Against Average)", definition: "Average number of goals allowed per 60 minutes of play.", example: "His 2.45 GAA ranks third in the league.", related: ["SV%", "Goaltending"], category: "stats" },

  // Advanced Stats
  { term: "xG (Expected Goals)", definition: "A model-based metric that estimates the probability of a shot becoming a goal based on location, type, and game situation.", example: "He's outperforming his xG by 3 goals — hot shooting.", related: ["Shot quality", "Analytics"], category: "advanced" },
  { term: "CF% (Corsi For %)", definition: "Percentage of total shot attempts (on goal, missed, blocked) that belong to the player's team while they're on ice. A possession proxy.", example: "Her CF% of 58% shows she's driving play.", related: ["Possession", "Shot attempts"], category: "advanced" },
  { term: "FF% (Fenwick For %)", definition: "Like Corsi but excludes blocked shots. Measures unblocked shot attempt share.", example: "The top pair has a 55% FF% at 5-on-5.", related: ["CF%", "Possession"], category: "advanced" },
  { term: "Zone Starts (OZ%)", definition: "Percentage of a player's shifts that begin in the offensive zone. Higher OZ% = more offensive deployment.", example: "He gets 65% OZ starts — sheltered offensive role.", related: ["Deployment", "Usage"], category: "advanced" },

  // Systems
  { term: "Forecheck", definition: "The system a team uses to pressure the opposing team in their defensive zone to recover the puck.", example: "They run an aggressive 2-1-2 forecheck.", related: ["Neutral zone", "Puck recovery"], category: "systems" },
  { term: "Breakout", definition: "The structured play a team uses to move the puck out of their defensive zone.", example: "The breakout pass hit the winger in stride through the neutral zone.", related: ["Transition", "D-zone"], category: "systems" },
  { term: "Trap", definition: "A defensive system where forwards clog the neutral zone to prevent clean entries. Often a 1-2-2 or 1-3-1 formation.", example: "They sat back in the trap and waited for turnovers.", related: ["Neutral zone", "Defensive system"], category: "systems" },
  { term: "1-3-1", definition: "A formation with one forechecker, three across the neutral zone, and one deep defender. Used both as a power play setup and a neutral zone trap.", example: "Their 1-3-1 power play creates passing lanes through the middle.", related: ["Trap", "Power play"], category: "systems" },
  { term: "Box (PK)", definition: "Standard penalty kill formation where four players form a box shape in the defensive zone.", example: "The PK box stayed tight and forced outside shots.", related: ["Penalty kill", "Diamond"], category: "systems" },

  // Penalties
  { term: "Minor Penalty", definition: "A 2-minute penalty for infractions like tripping, hooking, or slashing. The penalized team plays shorthanded.", example: "He took a minor for hooking at center ice.", related: ["Power play", "PIM"], category: "penalties" },
  { term: "Major Penalty", definition: "A 5-minute penalty for more serious infractions like fighting or boarding. The full 5 minutes must be served.", example: "He received a major for boarding from behind.", related: ["Game misconduct", "Suspension"], category: "penalties" },
  { term: "Power Play (PP)", definition: "When a team has a numerical advantage (usually 5-on-4) due to an opponent's penalty.", example: "They scored twice on the power play in the second period.", related: ["PPG", "Man advantage"], category: "penalties" },
  { term: "Penalty Kill (PK)", definition: "When a team plays shorthanded (usually 4-on-5) while killing an opponent's power play.", example: "Their PK is clicking at 85% this month.", related: ["Shorthanded", "Box PK"], category: "penalties" },

  // Equipment
  { term: "Flex", definition: "The stiffness rating of a hockey stick. Lower flex = more bend. General rule: flex should be roughly half the player's body weight.", example: "At 130 lbs, he should use a 65-flex stick.", related: ["Stick", "Shot power"], category: "equipment" },
  { term: "Blade Curve", definition: "The shape of the stick blade. Affects puck handling, shooting accuracy, and shot type. Named patterns vary by brand.", example: "A mid-curve is the most versatile for developing players.", related: ["Stick", "Shot"], category: "equipment" },
  { term: "Hollow (Skate Sharpening)", definition: "The depth of the groove cut into the skate blade. Deeper hollow = more grip but slower glide. Common: 1/2\" for youth, 5/8\" for advanced.", example: "She switched to a 5/8\" hollow for more speed.", related: ["Skates", "Edge work"], category: "equipment" },

  // Levels
  { term: "Minor Hockey", definition: "Youth hockey organized by age divisions (U9 through U18). The foundation of player development.", example: "He played AAA minor hockey before moving to junior.", related: ["AAA", "Development"], category: "levels" },
  { term: "Jr. A", definition: "Junior hockey leagues (OJHL, BCHL, AJHL, NAHL) for players aged 16-20. Maintains NCAA eligibility, unlike Major Junior.", example: "Playing Jr. A let him keep his NCAA scholarship options open.", related: ["NCAA", "Junior hockey"], category: "levels" },
  { term: "Major Junior (CHL)", definition: "The top tier of Canadian junior hockey — OHL, WHL, and QMJHL. Players are 16-20. Signing a Major Junior contract ends NCAA eligibility.", example: "Getting drafted to the OHL is a dream for many Ontario players.", related: ["OHL", "CHL Scholarship"], category: "levels" },
  { term: "NCAA", definition: "US college hockey — Division I, II, and III. Players receive scholarships (D1/D2) or play at admission-based programs (D3).", example: "She committed to a D1 NCAA program in her junior year of high school.", related: ["College hockey", "Eligibility"], category: "levels" },
  { term: "USports", definition: "The Canadian university sports system (formerly CIS). Players can compete after Major Junior or Jr. A careers.", example: "After four years in the OHL, he used his CHL scholarship to play USports.", related: ["University hockey", "CHL Scholarship"], category: "levels" },
  { term: "USHL", definition: "United States Hockey League — the top junior league in the US. Tier I, maintains NCAA eligibility.", example: "The USHL is the primary pathway to NCAA Division I hockey.", related: ["Jr. A", "NCAA", "NAHL"], category: "levels" },
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  positions:  { bg: "bg-blue-100",    text: "text-blue-800" },
  stats:      { bg: "bg-green-100",   text: "text-green-800" },
  advanced:   { bg: "bg-purple-100",  text: "text-purple-800" },
  systems:    { bg: "bg-indigo-100",  text: "text-indigo-800" },
  penalties:  { bg: "bg-red-100",     text: "text-red-800" },
  equipment:  { bg: "bg-amber-100",   text: "text-amber-800" },
  levels:     { bg: "bg-teal-100",    text: "text-teal-800" },
};

function catColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? { bg: "bg-gray-100", text: "text-gray-700" };
}

export default function GlossarySection() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<GlossaryCategory>("all");
  const [expandedTerm, setExpandedTerm] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = GLOSSARY_TERMS;
    if (activeCategory !== "all") {
      result = result.filter((t) => t.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.term.toLowerCase().includes(q) ||
          t.definition.toLowerCase().includes(q)
      );
    }
    return result;
  }, [search, activeCategory]);

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    GLOSSARY_TERMS.forEach((t) => {
      map[t.category] = (map[t.category] || 0) + 1;
    });
    return map;
  }, []);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search terms..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 bg-white text-navy text-xs placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition"
        />
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => {
          const count = cat.key === "all" ? GLOSSARY_TERMS.length : (categoryCounts[cat.key] || 0);
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition ${
                activeCategory === cat.key
                  ? "bg-navy text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat.label}
              <span className="ml-1 opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Results count */}
      <div className="text-[10px] text-gray-400">
        {filtered.length} {filtered.length === 1 ? "term" : "terms"}
      </div>

      {/* Term list */}
      {filtered.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-xs text-gray-400">No terms found.</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
          {filtered.map((t) => {
            const isExpanded = expandedTerm === t.term;
            const { bg, text } = catColor(t.category);
            return (
              <div
                key={t.term}
                className={`border rounded-lg transition-all cursor-pointer ${
                  isExpanded ? "border-blue-300 bg-blue-50/30" : "border-gray-200 bg-white hover:border-blue-200"
                }`}
                onClick={() => setExpandedTerm(isExpanded ? null : t.term)}
              >
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="text-xs font-bold text-navy flex-1">{t.term}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium capitalize ${bg} ${text}`}>
                    {t.category}
                  </span>
                </div>
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2 border-t border-blue-100">
                    <p className="text-xs text-gray-700 leading-relaxed pt-2">{t.definition}</p>
                    <p className="text-xs text-gray-500 italic">&ldquo;{t.example}&rdquo;</p>
                    {t.related.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] text-gray-400">Related:</span>
                        {t.related.map((r) => (
                          <span key={r} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px]">
                            {r}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

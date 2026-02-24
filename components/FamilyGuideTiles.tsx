/**
 * FamilyGuideTiles — Full tile grid for Family Guide section
 *
 * 4-column grid on desktop, responsive to 2-col and 1-col.
 * 11 standard tiles + 1 HeroBand (wide, span-2).
 * All band gradients: navy-to-teal ONLY.
 */
"use client";

import Tile from "./Tile";
import HeroBand from "./HeroBand";
import {
  SelectPlayerIcon,
  AskPxiIcon,
  ParentTipIcon,
  AfterGameIcon,
  NutritionIcon,
  WorkoutsIcon,
  PathwayIcon,
  MentalIcon,
  PressureIcon,
  GearIcon,
  GlossaryIcon,
} from "./tile-icons";

import type { Player } from "@/types/api";

interface FamilyGuideTilesProps {
  selectedPlayer: Player | null;
  onAskPxi: (seedMessage: string) => void;
  buildSeedMessage: (template: string) => string;
  onSelectPlayer?: () => void;
}

// ── Tile definitions — badge, title, desc, icon, seed message ──
const TILE_DATA = [
  {
    key: "select_player",
    badge: "Player",
    title: "Select Player",
    description: "Search by name, team, or position to begin.",
    icon: SelectPlayerIcon,
    section: "core" as const,
    seed: "",
  },
  {
    key: "ask_pxi",
    badge: "AI",
    title: "Ask PXI",
    description: "Parent Mode — ask anything about your player's development.",
    icon: AskPxiIcon,
    section: "core" as const,
    seed: "How is my player doing this season? Give me a plain-language summary of their progress.",
  },
  {
    key: "parent_tip",
    badge: "Daily",
    title: "Parent Tip of the Day",
    description: "Do's and don'ts — rotates daily, shuffle anytime.",
    icon: ParentTipIcon,
    section: "daily" as const,
    seed: "",
  },
  {
    key: "after_game",
    badge: "Post-Game",
    title: "After Game Help",
    description: "Car ride scripts — what to say, what to avoid, by situation.",
    icon: AfterGameIcon,
    section: "daily" as const,
    seed: "",
  },
  {
    key: "nutrition",
    badge: "Fuel",
    title: "Nutrition",
    description: "Game-day meals by age, hydration, and recovery nutrition.",
    icon: NutritionIcon,
    section: "development" as const,
    seed: "I'm a hockey parent. My player is [age] and plays [level]. What should they eat before and after games this weekend? Keep it practical — things I can actually prepare at home.",
  },
  {
    key: "workouts",
    badge: "Training",
    title: "Workouts",
    description: "Age-appropriate off-ice training — strength, agility, conditioning.",
    icon: WorkoutsIcon,
    section: "development" as const,
    seed: "I'm a hockey parent. My player is [age] and plays [level]. What are the best off-ice exercises they can do at home this week? Nothing that needs a gym — just bodyweight or basic equipment.",
  },
  {
    key: "pathway",
    badge: "Pathway",
    title: "Prep & College Guide",
    description: "Hockey pathways, key dates, academic requirements, recruiting timelines.",
    icon: PathwayIcon,
    section: "development" as const,
    seed: "I'm a hockey parent. My player is [age] and plays [level]. Can you walk me through the realistic pathway from here to prep school or college hockey? What are the key ages and decisions we should be thinking about now?",
  },
  {
    key: "mental",
    badge: "Mind",
    title: "Mental Performance",
    description: "Pre-game routine builder, bounce-back tips, confidence strategies.",
    icon: MentalIcon,
    section: "development" as const,
    seed: "I'm a hockey parent. My player is [age] and plays [level]. They sometimes struggle with nerves before big games. What are some simple pre-game routines or mental tools that work well at this age?",
  },
  {
    key: "pressure",
    badge: "Support",
    title: "Pressure & Confidence",
    description: "AI-powered support for tough moments — what to say, when to seek help.",
    icon: PressureIcon,
    section: "support" as const,
    seed: "I'm a hockey parent. My player is [age] and plays [level]. They've been hard on themselves lately. What should I be saying — and what should I avoid saying — to help them stay confident without putting more pressure on them?",
  },
  {
    key: "gear",
    badge: "Gear",
    title: "Gear Guide",
    description: "Equipment priorities for skaters & goalies, fitting tips, replacement guidelines.",
    icon: GearIcon,
    section: "support" as const,
    seed: "I'm a hockey parent. My player is [age] and plays [level]. Can you walk me through what gear they actually need at this stage, what to prioritize for safety and fit, and when we should be replacing things?",
  },
  {
    key: "glossary",
    badge: "Reference",
    title: "Hockey Glossary",
    description: "Plain-language terms — positions, stats, systems, penalties, and levels.",
    icon: GlossaryIcon,
    section: "support" as const,
    seed: "I'm a hockey parent trying to understand the game better. Can you explain some of the terms I hear coaches and announcers use? Start with the basics — positions, zones, and common stats — and I'll ask follow-up questions.",
  },
];

// ── Section labels ──
const SECTIONS: { key: string; label: string }[] = [
  { key: "core", label: "Core" },
  { key: "daily", label: "Daily Tools" },
  { key: "development", label: "Development" },
  { key: "support", label: "Support" },
];

export default function FamilyGuideTiles({
  selectedPlayer,
  onAskPxi,
  buildSeedMessage,
  onSelectPlayer,
}: FamilyGuideTilesProps) {
  function handleTileClick(tile: (typeof TILE_DATA)[number]) {
    if (tile.key === "select_player" && onSelectPlayer) {
      onSelectPlayer();
      return;
    }
    // Tiles with no seed (parent_tip, after_game, select_player without handler) scroll into view
    if (!tile.seed) return;
    if (!selectedPlayer) return;
    onAskPxi(buildSeedMessage(tile.seed));
  }

  return (
    <div className="mb-6">
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: "repeat(4, 1fr)",
        }}
      >
        {SECTIONS.map((section) => {
          const tiles = TILE_DATA.filter((t) => t.section === section.key);
          if (tiles.length === 0) return null;

          return (
            <div key={section.key} className="contents">
              {/* Section label — full width */}
              <div
                className="col-span-4 uppercase font-semibold"
                style={{
                  fontSize: "11px",
                  letterSpacing: "0.1em",
                  color: "#4A6080",
                  marginTop: section.key === "core" ? "0" : "8px",
                  paddingBottom: "4px",
                  borderBottom: "1px solid #D1DCE8",
                }}
              >
                {section.label}
              </div>

              {/* HeroBand in Core section */}
              {section.key === "core" && <HeroBand />}

              {/* Tiles */}
              {tiles.map((tile) => (
                <Tile
                  key={tile.key}
                  icon={tile.icon}
                  badge={tile.badge}
                  title={tile.title}
                  description={tile.description}
                  dotColor="#0D9488"
                  onClick={() => handleTileClick(tile)}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* Responsive override — mobile 1 col, tablet 2 col */}
      <style jsx>{`
        @media (max-width: 1023px) {
          div[style*="grid-template-columns: repeat(4"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          div[style*="grid-template-columns: repeat(4"] .col-span-4 {
            grid-column: span 2;
          }
        }
        @media (max-width: 639px) {
          div[style*="grid-template-columns: repeat(4"] {
            grid-template-columns: 1fr !important;
          }
          div[style*="grid-template-columns: repeat(4"] .col-span-4 {
            grid-column: span 1;
          }
        }
      `}</style>
    </div>
  );
}

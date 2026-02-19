"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Save, Loader2, Lock, Unlock, X } from "lucide-react";
import api from "@/lib/api";
import RatingSlider from "./RatingSlider";
import type { Player, ScoutNote, NoteCreate } from "@/types/api";
import { COMPETITION_LEVEL_LABELS, PROSPECT_STATUS_LABELS, NOTE_TAG_OPTIONS, NOTE_TAG_LABELS } from "@/types/api";

interface ScoutNoteFormProps {
  /** Pre-selected player ID (from query param or route) */
  initialPlayerId?: string;
  /** Existing note for edit mode */
  existingNote?: ScoutNote;
}

export default function ScoutNoteForm({ initialPlayerId, existingNote }: ScoutNoteFormProps) {
  const router = useRouter();
  const isEdit = !!existingNote;

  // Player search
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerResults, setPlayerResults] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  // Form state
  const [gameDate, setGameDate] = useState(existingNote?.game_date || new Date().toISOString().split("T")[0]);
  const [opponent, setOpponent] = useState(existingNote?.opponent || "");
  const [competitionLevel, setCompetitionLevel] = useState(existingNote?.competition_level || "");
  const [venue, setVenue] = useState(existingNote?.venue || "");
  const [overallGrade, setOverallGrade] = useState<number | null>(existingNote?.overall_grade || null);
  const [skatingRating, setSkatingRating] = useState<number | null>(existingNote?.skating_rating || null);
  const [puckSkillsRating, setPuckSkillsRating] = useState<number | null>(existingNote?.puck_skills_rating || null);
  const [hockeyIqRating, setHockeyIqRating] = useState<number | null>(existingNote?.hockey_iq_rating || null);
  const [competeRating, setCompeteRating] = useState<number | null>(existingNote?.compete_rating || null);
  const [defenseRating, setDefenseRating] = useState<number | null>(existingNote?.defense_rating || null);
  const [strengthsNotes, setStrengthsNotes] = useState(existingNote?.strengths_notes || "");
  const [improvementsNotes, setImprovementsNotes] = useState(existingNote?.improvements_notes || "");
  const [oneLineSummary, setOneLineSummary] = useState(existingNote?.one_line_summary || "");
  const [prospectStatus, setProspectStatus] = useState(existingNote?.prospect_status || "");
  const [visibility, setVisibility] = useState(existingNote?.visibility || "PRIVATE");
  const [tags, setTags] = useState<string[]>(existingNote?.tags || []);
  const [noteText, setNoteText] = useState(existingNote?.note_text || "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Load player by ID on mount
  useEffect(() => {
    const pid = initialPlayerId || existingNote?.player_id;
    if (pid) {
      api.get(`/players/${pid}`).then(({ data }) => setSelectedPlayer(data)).catch(() => {});
    }
  }, [initialPlayerId, existingNote?.player_id]);

  // Player search
  const searchPlayers = useCallback(async (q: string) => {
    if (q.length < 2) { setPlayerResults([]); return; }
    try {
      const { data } = await api.get(`/players?search=${encodeURIComponent(q)}&limit=10`);
      setPlayerResults(data);
    } catch (err) { console.error("[ScoutNote] Player search error:", err); setPlayerResults([]); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchPlayers(playerSearch), 300);
    return () => clearTimeout(timer);
  }, [playerSearch, searchPlayers]);

  const toggleTag = (tag: string) => {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const handleSave = async () => {
    if (!selectedPlayer && !existingNote) {
      setError("Please select a player");
      return;
    }
    setSaving(true);
    setError("");

    const payload: NoteCreate = {
      player_id: selectedPlayer?.id || existingNote?.player_id,
      note_text: noteText,
      note_type: "general",
      tags,
      game_date: gameDate || undefined,
      opponent: opponent || undefined,
      competition_level: competitionLevel || undefined,
      venue: venue || undefined,
      overall_grade: overallGrade || undefined,
      grade_scale: "1-5",
      skating_rating: skatingRating || undefined,
      puck_skills_rating: puckSkillsRating || undefined,
      hockey_iq_rating: hockeyIqRating || undefined,
      compete_rating: competeRating || undefined,
      defense_rating: defenseRating || undefined,
      strengths_notes: strengthsNotes || undefined,
      improvements_notes: improvementsNotes || undefined,
      one_line_summary: oneLineSummary || undefined,
      prospect_status: prospectStatus || undefined,
      visibility,
      note_mode: "QUICK",
    };

    try {
      if (isEdit) {
        await api.put(`/notes/${existingNote.id}`, payload);
      } else {
        await api.post("/scout-notes", payload);
      }
      router.push("/scout-notes");
    } catch (err: unknown) {
      console.error("[ScoutNote] Save error:", err);
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to save note";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Player Selector */}
      {!isEdit && (
        <div>
          <label className="block text-xs font-oswald uppercase tracking-wider text-navy/70 mb-1.5">Player *</label>
          {selectedPlayer ? (
            <div className="flex items-center justify-between bg-teal/5 border border-teal/20 rounded-lg px-3 py-2.5">
              <div>
                <p className="text-sm font-semibold text-navy">{selectedPlayer.first_name} {selectedPlayer.last_name}</p>
                <p className="text-[10px] text-muted">{[selectedPlayer.current_team, selectedPlayer.position].filter(Boolean).join(" · ")}</p>
              </div>
              <button type="button" onClick={() => { setSelectedPlayer(null); setShowSearch(true); }} className="p-1 text-muted hover:text-navy">
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Search players..."
                  value={playerSearch}
                  onChange={(e) => { setPlayerSearch(e.target.value); setShowSearch(true); }}
                  onFocus={() => setShowSearch(true)}
                  className="w-full pl-9 pr-3 py-2.5 border border-teal/20 rounded-lg text-sm"
                />
              </div>
              {showSearch && playerResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {playerResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setSelectedPlayer(p); setShowSearch(false); setPlayerSearch(""); }}
                      className="w-full text-left px-3 py-2.5 hover:bg-navy/[0.02] transition-colors border-b border-border/50 last:border-0"
                    >
                      <p className="text-sm font-medium text-navy">{p.first_name} {p.last_name}</p>
                      <p className="text-[10px] text-muted">{[p.current_team, p.position].filter(Boolean).join(" · ")}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Game Context Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-oswald uppercase tracking-wider text-navy/70 mb-1.5">Game Date</label>
          <input type="date" value={gameDate} onChange={(e) => setGameDate(e.target.value)}
            className="w-full px-3 py-2.5 border border-teal/20 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-oswald uppercase tracking-wider text-navy/70 mb-1.5">Opponent</label>
          <input type="text" value={opponent} onChange={(e) => setOpponent(e.target.value)}
            placeholder="e.g., London Knights" className="w-full px-3 py-2.5 border border-teal/20 rounded-lg text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-oswald uppercase tracking-wider text-navy/70 mb-1.5">Competition Level</label>
          <select value={competitionLevel} onChange={(e) => setCompetitionLevel(e.target.value)}
            className="w-full px-3 py-2.5 border border-teal/20 rounded-lg text-sm bg-white">
            <option value="">Select level...</option>
            {Object.entries(COMPETITION_LEVEL_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-oswald uppercase tracking-wider text-navy/70 mb-1.5">Venue</label>
          <input type="text" value={venue} onChange={(e) => setVenue(e.target.value)}
            placeholder="e.g., Budweiser Gardens" className="w-full px-3 py-2.5 border border-teal/20 rounded-lg text-sm" />
        </div>
      </div>

      {/* Overall Grade */}
      <div>
        <p className="text-xs font-oswald uppercase tracking-wider text-navy/70 mb-2">Overall Grade</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setOverallGrade(overallGrade === n ? null : n)}
              className={`w-12 h-12 rounded-lg flex items-center justify-center text-lg font-oswald font-bold transition-all border-2 ${
                overallGrade === n
                  ? "bg-teal border-teal text-white shadow-md"
                  : "bg-white border-teal/20 text-navy/40 hover:border-teal/50"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Core Ratings */}
      <div className="space-y-4">
        <RatingSlider label="Skating" value={skatingRating} onChange={setSkatingRating} />
        <RatingSlider label="Puck Skills" value={puckSkillsRating} onChange={setPuckSkillsRating} />
        <RatingSlider label="Hockey IQ" value={hockeyIqRating} onChange={setHockeyIqRating} />
        <RatingSlider label="Compete" value={competeRating} onChange={setCompeteRating} />
        <RatingSlider label="Defense" value={defenseRating} onChange={setDefenseRating} />
      </div>

      {/* Text Notes */}
      <div>
        <label className="block text-xs font-oswald uppercase tracking-wider text-navy/70 mb-1.5">Strengths</label>
        <textarea rows={3} value={strengthsNotes} onChange={(e) => setStrengthsNotes(e.target.value)}
          placeholder="Elite compete. First on puck. Hard on the boards."
          className="w-full px-3 py-2.5 border border-teal/20 rounded-lg text-sm resize-none" />
      </div>
      <div>
        <label className="block text-xs font-oswald uppercase tracking-wider text-navy/70 mb-1.5">Areas to Improve</label>
        <textarea rows={3} value={improvementsNotes} onChange={(e) => setImprovementsNotes(e.target.value)}
          placeholder="Lateral mobility needs work. Puck decisions under pressure."
          className="w-full px-3 py-2.5 border border-teal/20 rounded-lg text-sm resize-none" />
      </div>
      <div>
        <label className="block text-xs font-oswald uppercase tracking-wider text-navy/70 mb-1.5">One-Line Summary</label>
        <input type="text" value={oneLineSummary} onChange={(e) => setOneLineSummary(e.target.value)}
          placeholder="Power forward, elite motor, projects as top-6 role"
          className="w-full px-3 py-2.5 border border-teal/20 rounded-lg text-sm" maxLength={200} />
      </div>
      <div>
        <label className="block text-xs font-oswald uppercase tracking-wider text-navy/70 mb-1.5">Additional Notes</label>
        <textarea rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)}
          placeholder="Any other observations..."
          className="w-full px-3 py-2.5 border border-teal/20 rounded-lg text-sm resize-none" />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-xs font-oswald uppercase tracking-wider text-navy/70 mb-1.5">Tags</label>
        <div className="flex flex-wrap gap-1.5">
          {NOTE_TAG_OPTIONS.map((tag) => (
            <button key={tag} type="button" onClick={() => toggleTag(tag)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                tags.includes(tag)
                  ? "bg-teal/10 text-teal border border-teal/30"
                  : "bg-navy/5 text-muted border border-transparent hover:border-teal/20"
              }`}>
              {NOTE_TAG_LABELS[tag] || tag}
            </button>
          ))}
        </div>
      </div>

      {/* Prospect Status */}
      <div>
        <label className="block text-xs font-oswald uppercase tracking-wider text-navy/70 mb-1.5">Prospect Status</label>
        <select value={prospectStatus} onChange={(e) => setProspectStatus(e.target.value)}
          className="w-full px-3 py-2.5 border border-teal/20 rounded-lg text-sm bg-white">
          <option value="">Select status...</option>
          {Object.entries(PROSPECT_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Visibility Toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setVisibility(visibility === "PRIVATE" ? "ORG_SHARED" : "PRIVATE")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
            visibility === "PRIVATE"
              ? "bg-navy/5 border-navy/20 text-navy"
              : "bg-teal/5 border-teal/20 text-teal"
          }`}
        >
          {visibility === "PRIVATE" ? <Lock size={14} /> : <Unlock size={14} />}
          {visibility === "PRIVATE" ? "Private (only you)" : "Shared with team"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      {/* Save Button — sticky on mobile */}
      <div className="sticky bottom-4 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-teal text-white font-oswald font-bold uppercase tracking-wider rounded-xl hover:bg-teal/90 disabled:opacity-50 transition-colors text-sm flex items-center justify-center gap-2 shadow-lg"
        >
          {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : <><Save size={16} /> {isEdit ? "Update Note" : "Save Scout Note"}</>}
        </button>
      </div>
    </div>
  );
}

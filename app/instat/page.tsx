"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Users,
  Shield,
  BarChart3,
  Layers,
  ChevronDown,
  Calendar,
  Target,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import { formatLeague } from "@/lib/leagues";
import type { TeamReference, InStatImportResponse } from "@/types/api";

const FILE_TYPE_LABELS: Record<string, { label: string; icon: typeof Users; color: string }> = {
  team_games: { label: "Team Game Schedule", icon: Calendar, color: "text-orange" },
  game_skaters: { label: "Game Box Score (Skaters)", icon: Target, color: "text-teal" },
  game_goalies: { label: "Game Box Score (Goalies)", icon: Target, color: "text-teal" },
  league_teams: { label: "League Team Stats", icon: Shield, color: "text-orange" },
  league_skaters: { label: "League Skater Stats", icon: Users, color: "text-teal" },
  league_goalies: { label: "League Goalie Stats", icon: Shield, color: "text-teal" },
  team_skaters: { label: "Team Skater Stats", icon: Users, color: "text-navy" },
  team_goalies: { label: "Team Goalie Stats", icon: Shield, color: "text-navy" },
  lines: { label: "Line Combinations", icon: Layers, color: "text-orange" },
  xml_instat: { label: "InStat XML Events", icon: Target, color: "text-teal" },
  xml_gamesheet: { label: "GameSheet XML", icon: Calendar, color: "text-orange" },
  xml_generic: { label: "XML Events", icon: Target, color: "text-navy" },
  unknown: { label: "Unknown Format", icon: AlertCircle, color: "text-red-500" },
};

const LINE_TYPES = [
  { value: "full", label: "Full Units (5v5)" },
  { value: "forwards", label: "Forward Lines" },
  { value: "defense", label: "Defence Pairs" },
  { value: "pp", label: "Power Play" },
  { value: "pk", label: "Penalty Kill" },
];

export default function InStatImportPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <InStatUploader />
      </main>
    </ProtectedRoute>
  );
}

function InStatUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [season, setSeason] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    return now.getMonth() < 8 ? `${y - 1}-${y}` : `${y}-${y + 1}`;
  });
  const [teamName, setTeamName] = useState("");
  const [lineType, setLineType] = useState("full");
  const [teams, setTeams] = useState<TeamReference[]>([]);
  const [teamSearch, setTeamSearch] = useState("");
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<InStatImportResponse | null>(null);
  const [error, setError] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load reference teams
  useEffect(() => {
    api.get<TeamReference[]>("/teams/reference").then((r) => setTeams(r.data)).catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowTeamDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredTeams = teams.filter(
    (t) =>
      t.name.toLowerCase().includes(teamSearch.toLowerCase()) ||
      (t.league || "").toLowerCase().includes(teamSearch.toLowerCase())
  );

  const needsTeam = file?.name
    ? /^(Skaters|Goalies|Lines)\s*-\s*(?!.*League)/i.test(file.name)
    : false;

  const isLines = file?.name ? /^Lines\s*-/i.test(file.name) : false;

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    setResult(null);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const params = new URLSearchParams();
      if (season) params.set("season", season);
      if (teamName) params.set("team_name", teamName);
      if (isLines && lineType) params.set("line_type", lineType);

      const { data } = await api.post<InStatImportResponse>(
        `/instat/import?${params.toString()}`,
        fd,
        { timeout: 300000 }  // 5 min — safety net for very large files
      );
      setResult(data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as { message?: string })?.message ||
        "Import failed";
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const fileTypeInfo = result ? FILE_TYPE_LABELS[result.file_type] || FILE_TYPE_LABELS.unknown : null;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center">
            <BarChart3 size={20} className="text-teal" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-oswald text-navy">Advanced Stats Import</h1>
            <p className="text-muted text-sm">
              Upload XLSX or XML stat exports — teams, skaters, goalies, lines, or event data
            </p>
          </div>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <CheckCircle size={20} className="text-green-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-green-800 text-sm flex items-center gap-2 flex-wrap">
                Import Complete
                {fileTypeInfo && (
                  <span className={`text-xs px-2 py-0.5 rounded bg-white border ${fileTypeInfo.color}`}>
                    {fileTypeInfo.label}
                  </span>
                )}
              </p>
              {/* Detected metadata from filename */}
              {(result.detected_team || result.detected_opponent) && (
                <p className="text-xs text-green-700 mt-1">
                  {result.detected_team}
                  {result.detected_opponent && <span className="text-green-500"> vs {result.detected_opponent}</span>}
                  {result.detected_date && <span className="text-green-500"> • {result.detected_date}</span>}
                </p>
              )}
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white rounded-lg p-3 border border-green-100">
                  <p className="text-2xl font-oswald font-bold text-navy">{result.total_rows}</p>
                  <p className="text-xs text-muted uppercase tracking-wider">Total Rows</p>
                </div>
                {result.games_imported > 0 && (
                  <div className="bg-white rounded-lg p-3 border border-green-100">
                    <p className="text-2xl font-oswald font-bold text-orange">{result.games_imported}</p>
                    <p className="text-xs text-muted uppercase tracking-wider">Games Imported</p>
                  </div>
                )}
                {result.stats_imported > 0 && (
                  <div className="bg-white rounded-lg p-3 border border-green-100">
                    <p className="text-2xl font-oswald font-bold text-teal">{result.stats_imported}</p>
                    <p className="text-xs text-muted uppercase tracking-wider">Stats Imported</p>
                  </div>
                )}
                {result.players_created > 0 && (
                  <div className="bg-white rounded-lg p-3 border border-green-100">
                    <p className="text-2xl font-oswald font-bold text-orange">{result.players_created}</p>
                    <p className="text-xs text-muted uppercase tracking-wider">Players Created</p>
                  </div>
                )}
                {result.players_updated > 0 && (
                  <div className="bg-white rounded-lg p-3 border border-green-100">
                    <p className="text-2xl font-oswald font-bold text-navy">{result.players_updated}</p>
                    <p className="text-xs text-muted uppercase tracking-wider">Players Updated</p>
                  </div>
                )}
              </div>
              {/* XML-specific: events imported + players matched */}
              {result.events_imported != null && result.events_imported > 0 && (
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white rounded-lg p-3 border border-green-100">
                    <p className="text-2xl font-oswald font-bold text-teal">{result.events_imported}</p>
                    <p className="text-xs text-muted uppercase tracking-wider">Events Imported</p>
                  </div>
                  {result.players_matched != null && result.players_matched > 0 && (
                    <div className="bg-white rounded-lg p-3 border border-green-100">
                      <p className="text-2xl font-oswald font-bold text-navy">{result.players_matched}</p>
                      <p className="text-xs text-muted uppercase tracking-wider">Players Matched</p>
                    </div>
                  )}
                  {result.events_skipped != null && result.events_skipped > 0 && (
                    <div className="bg-white rounded-lg p-3 border border-green-100">
                      <p className="text-2xl font-oswald font-bold text-orange">{result.events_skipped}</p>
                      <p className="text-xs text-muted uppercase tracking-wider">Events Skipped</p>
                    </div>
                  )}
                  {result.duplicates_skipped != null && result.duplicates_skipped > 0 && (
                    <div className="bg-white rounded-lg p-3 border border-green-100">
                      <p className="text-2xl font-oswald font-bold text-muted">{result.duplicates_skipped}</p>
                      <p className="text-xs text-muted uppercase tracking-wider">Duplicates Skipped</p>
                    </div>
                  )}
                </div>
              )}
              {/* XML-specific: event type breakdown */}
              {result.event_type_breakdown && Object.keys(result.event_type_breakdown).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(result.event_type_breakdown).map(([type, count]) => (
                    <span key={type} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-navy/[0.04] text-xs text-navy">
                      <span className="font-oswald font-bold">{count}</span>
                      <span className="text-muted">{type}</span>
                    </span>
                  ))}
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="mt-3 text-xs text-orange">
                  <p className="font-semibold">{result.errors.length} warning(s):</p>
                  <ul className="mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                    {result.errors.slice(0, 10).map((e, i) => (
                      <li key={i}>• {e}</li>
                    ))}
                    {result.errors.length > 10 && (
                      <li>... and {result.errors.length - 10} more</li>
                    )}
                  </ul>
                </div>
              )}
              <div className="mt-4 flex gap-3 flex-wrap">
                <Link href="/players" className="text-sm text-teal hover:underline">
                  View Players →
                </Link>
                <Link href="/teams" className="text-sm text-teal hover:underline">
                  View Teams →
                </Link>
                <Link href="/players/manage" className="text-sm text-navy hover:underline">
                  Manage Players →
                </Link>
                <button onClick={reset} className="text-sm text-navy hover:underline">
                  Import Another File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-red-700 font-medium text-sm">Import Error</p>
            <p className="text-red-600 text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Upload Form */}
      {!result && (
        <div className="bg-white rounded-xl border border-teal/20 p-6">
          {/* File Picker */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-navy mb-2">
              Stats File (XLSX / XML)
            </label>
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                file ? "border-teal bg-teal/5" : "border-teal/20 hover:border-teal/50"
              }`}
              onClick={() => fileRef.current?.click()}
            >
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileSpreadsheet size={24} className="text-teal" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-navy">{file.name}</p>
                    <p className="text-xs text-muted">
                      {(file.size / 1024).toFixed(1)} KB
                      {needsTeam && " — Team-specific file detected"}
                      {isLines && " — Line combinations detected"}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      reset();
                    }}
                    className="text-xs text-muted hover:text-red-500 ml-2"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <Upload size={32} className="mx-auto text-muted/40 mb-2" />
                  <p className="text-sm text-muted">
                    Click to select or drop an .xlsx or .xml stats file
                  </p>
                  <p className="text-xs text-muted/60 mt-1">
                    Supports: Games, Skaters, Goalies, Lines, InStat XML, GameSheet XML
                  </p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.xlsm,.xml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFile(f);
              }}
            />
          </div>

          {/* Season */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-navy mb-1">Season</label>
              <input
                type="text"
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                placeholder="e.g. 2025-2026"
                className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
            </div>

            {/* Team Name (for team-specific files) */}
            <div ref={dropdownRef}>
              <label className="block text-sm font-semibold text-navy mb-1">
                Team Name {needsTeam ? <span className="text-red-500">*</span> : <span className="text-xs text-muted font-normal">(recommended)</span>}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={teamName || teamSearch}
                  onChange={(e) => {
                    setTeamSearch(e.target.value);
                    setTeamName("");
                    setShowTeamDropdown(true);
                  }}
                  onFocus={() => setShowTeamDropdown(true)}
                  placeholder="Search teams..."
                  className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                />
                <ChevronDown size={14} className="absolute right-3 top-3 text-muted" />
                {showTeamDropdown && filteredTeams.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-teal/20 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredTeams.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setTeamName(t.name);
                          setTeamSearch("");
                          setShowTeamDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-navy/[0.02] flex items-center justify-between"
                      >
                        <span className="text-navy">{t.name}</span>
                        <span className="text-xs text-muted">{formatLeague(t.league)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Line Type (for lines files) */}
          {isLines && (
            <div className="mb-6">
              <label className="block text-sm font-semibold text-navy mb-1">Line Type</label>
              <select
                value={lineType}
                onChange={(e) => setLineType(e.target.value)}
                className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
              >
                {LINE_TYPES.map((lt) => (
                  <option key={lt.value} value={lt.value}>
                    {lt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!file || uploading || (needsTeam && !teamName)}
            className="w-full bg-gradient-to-r from-navy to-navy-light text-white py-3 rounded-xl font-oswald font-semibold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-shadow"
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Importing...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Upload size={16} />
                Import Data
              </span>
            )}
          </button>

          {needsTeam && !teamName && (
            <p className="text-xs text-orange mt-2 text-center">
              Team name is required for team-specific files
            </p>
          )}
        </div>
      )}

      {/* Help */}
      <div className="mt-8 bg-navy/[0.02] rounded-xl border border-teal/20 p-5">
        <h3 className="font-oswald font-semibold text-navy text-sm uppercase tracking-wider mb-3">
          Supported File Types
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="font-medium text-navy">League Exports (XLSX)</p>
            <ul className="text-muted text-xs mt-1 space-y-1">
              <li>• <strong>Teams</strong> — League team stats (100 columns)</li>
              <li>• <strong>Skaters</strong> — All league skaters (138 columns)</li>
              <li>• <strong>Goalies</strong> — All league goalies (24 columns)</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-navy">Team Exports (XLSX)</p>
            <ul className="text-muted text-xs mt-1 space-y-1">
              <li>• <strong>Skaters</strong> — Team skaters (147 columns)</li>
              <li>• <strong>Goalies</strong> — Team goalies (23 columns)</li>
              <li>• <strong>Lines</strong> — 5v5, Forwards, Defence, PP, PK combos</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-navy">Event Data (XML)</p>
            <ul className="text-muted text-xs mt-1 space-y-1">
              <li>• <strong>InStat</strong> — Zone entries/exits, shots, passes, xG</li>
              <li>• <strong>GameSheet</strong> — Goals, assists, penalties, TOI</li>
              <li>• <strong>Generic</strong> — Standard ProspectX event XML schema</li>
            </ul>
          </div>
        </div>
        <p className="text-xs text-muted mt-3">
          XLSX files are auto-detected by column headers. XML source format is auto-detected. Players are matched by name + team.
        </p>
      </div>
    </div>
  );
}

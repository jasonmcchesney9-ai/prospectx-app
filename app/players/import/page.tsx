"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Users,
  GitMerge,
  SkipForward,
  Plus,
  Loader2,
  FileSpreadsheet,
  X,
  ChevronDown,
  Settings,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { ImportDuplicate, ImportPreview, ImportResult, TeamReference } from "@/types/api";

type Step = "upload" | "preview" | "importing" | "done";

export default function BatchImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [executing, setExecuting] = useState(false);

  // Team / League / Season overrides
  const [season, setSeason] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    return now.getMonth() < 8 ? `${y - 1}-${y}` : `${y}-${y + 1}`;
  });
  const [teamName, setTeamName] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [teams, setTeams] = useState<TeamReference[]>([]);
  const [teamSearch, setTeamSearch] = useState("");
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Duplicate resolutions: row_index -> action
  const [resolutions, setResolutions] = useState<Record<number, string>>({});

  // Load reference teams for autocomplete
  useEffect(() => {
    api.get<TeamReference[]>("/teams/reference").then((r) => setTeams(r.data)).catch(() => {});
  }, []);

  // Close team dropdown on outside click
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

  // Extract unique leagues from reference teams
  const leagues = Array.from(new Set(teams.map((t) => t.league).filter(Boolean))).sort();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);

      // Build query params for overrides
      const params = new URLSearchParams();
      if (teamName) params.set("team_override", teamName);
      if (leagueName) params.set("league_override", leagueName);
      if (season) params.set("season_override", season);

      const url = `/import/preview${params.toString() ? `?${params.toString()}` : ""}`;
      const { data } = await api.post<ImportPreview>(url, formData);
      setPreview(data);
      // Default all duplicates to "skip"
      const defaultRes: Record<number, string> = {};
      for (const dup of data.duplicates) {
        defaultRes[dup.row_index] = "skip";
      }
      setResolutions(defaultRes);
      setStep("preview");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { detail?: string } }; message?: string };
      const msg = axiosErr?.response?.data?.detail || axiosErr?.message || "Failed to parse CSV";
      setError(msg);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleExecute = async () => {
    if (!preview) return;
    setExecuting(true);
    setStep("importing");
    try {
      const resList = Object.entries(resolutions).map(([idx, action]) => ({
        row_index: parseInt(idx),
        action,
      }));
      const { data } = await api.post<ImportResult>(`/import/${preview.job_id}/execute`, {
        resolutions: resList,
      });
      setResult(data);
      setStep("done");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Import failed";
      setError(msg);
      setStep("preview");
    } finally {
      setExecuting(false);
    }
  };

  const setDupAction = (rowIndex: number, action: string) => {
    setResolutions((prev) => ({ ...prev, [rowIndex]: action }));
  };

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link href="/players" className="flex items-center gap-1 text-sm text-muted hover:text-navy">
            <ArrowLeft size={14} /> Back to Players
          </Link>
          <Link
            href="/players/manage"
            className="flex items-center gap-1.5 text-sm text-navy hover:text-teal transition-colors"
          >
            <Settings size={14} />
            Manage Players
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center">
            <Users size={20} className="text-teal" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-oswald text-navy">Import Players</h1>
            <p className="text-sm text-muted">
              Upload a CSV or Excel roster to batch-add players with team and season context
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle size={16} />
            {error}
            <button onClick={() => setError("")} className="ml-auto"><X size={14} /></button>
          </div>
        )}

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="bg-white rounded-xl border border-teal/20 p-6">
            {/* Season / Team / League fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
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

              {/* Team Name with autocomplete */}
              <div ref={dropdownRef}>
                <label className="block text-sm font-semibold text-navy mb-1">
                  Default Team
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
                      {filteredTeams.slice(0, 20).map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            setTeamName(t.name);
                            setTeamSearch("");
                            setShowTeamDropdown(false);
                            // Auto-fill league if the team has one
                            if (t.league && !leagueName) {
                              setLeagueName(t.league);
                            }
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-navy/[0.02] flex items-center justify-between"
                        >
                          <span className="text-navy">{t.name}</span>
                          <span className="text-xs text-muted">{t.league}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted/60 mt-1">Applied if CSV has no Team column</p>
              </div>

              {/* League */}
              <div>
                <label className="block text-sm font-semibold text-navy mb-1">
                  Default League
                </label>
                {leagues.length > 0 ? (
                  <select
                    value={leagueName}
                    onChange={(e) => setLeagueName(e.target.value)}
                    className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                  >
                    <option value="">Select league...</option>
                    {leagues.map((lg) => (
                      <option key={lg} value={lg!}>{lg}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={leagueName}
                    onChange={(e) => setLeagueName(e.target.value)}
                    placeholder="e.g. GOHL"
                    className="w-full border border-teal/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                  />
                )}
                <p className="text-xs text-muted/60 mt-1">Applied if CSV has no League column</p>
              </div>
            </div>

            {/* File Picker */}
            <div className="border-t border-teal/20 pt-6">
              <label className="block text-sm font-semibold text-navy mb-2">Player File (CSV or XLSX)</label>
              <div className="text-center">
                <FileSpreadsheet size={40} className="mx-auto text-teal/40 mb-3" />
                <p className="text-sm text-muted mb-2 max-w-md mx-auto">
                  Required columns: <strong>First Name</strong>, <strong>Last Name</strong>.
                  Optional: Position, DOB, Team, League, Shoots, GP, G, A, P, PIM.
                </p>
                <p className="text-xs text-muted/60 mb-4 max-w-md mx-auto">
                  Team/League/Season from CSV columns take priority over the defaults above.
                  For advanced game stats, use the <Link href="/instat" className="text-teal hover:underline">Import Stats</Link> page instead.
                </p>

                <input
                  type="file"
                  accept=".csv,.CSV,.xlsx,.xls,.xlsm"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="block mx-auto text-sm text-muted file:mr-3 file:py-2.5 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-oswald file:uppercase file:tracking-wider file:font-semibold file:bg-teal file:text-white hover:file:bg-teal/90 file:transition-colors file:cursor-pointer"
                />
                {uploading && (
                  <div className="flex items-center justify-center gap-2 mt-3 text-sm text-muted">
                    <Loader2 size={16} className="animate-spin" />
                    Processing...
                  </div>
                )}
              </div>
            </div>

            {/* Sample CSV format */}
            <div className="mt-6 border-t border-teal/20 pt-6">
              <p className="text-xs font-oswald uppercase tracking-wider text-muted mb-2">Example CSV Format</p>
              <pre className="text-xs bg-navy/[0.03] p-3 rounded-lg border border-teal/20 overflow-x-auto">
{`First Name,Last Name,Position,DOB,Team,League,GP,G,A,P
Ewan,McChesney,C,2005-03-15,Chatham Maroons,GOHL,25,12,18,30
Connor,Smith,LW,2006-01-20,Chatham Maroons,GOHL,24,8,10,18
Jake,Wilson,D,2005-11-05,Chatham Maroons,GOHL,25,2,8,10`}
              </pre>
            </div>
          </div>
        )}

        {/* Step 2: Preview + Duplicate Review */}
        {step === "preview" && preview && (
          <div className="space-y-4">
            {/* Applied Defaults Banner */}
            {(teamName || leagueName || season) && (
              <div className="bg-teal/5 border border-teal/20 rounded-xl px-4 py-3 text-xs text-navy flex items-center gap-2 flex-wrap">
                <span className="font-semibold">Defaults applied:</span>
                {season && <span className="px-2 py-0.5 bg-white rounded border border-teal/20">Season: {season}</span>}
                {teamName && <span className="px-2 py-0.5 bg-white rounded border border-teal/20">Team: {teamName}</span>}
                {leagueName && <span className="px-2 py-0.5 bg-white rounded border border-teal/20">League: {leagueName}</span>}
              </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl border border-teal/20 p-4 text-center">
                <Users size={20} className="mx-auto text-teal mb-1" />
                <p className="text-2xl font-bold text-navy">{preview.total_rows}</p>
                <p className="text-xs text-muted">Total Rows</p>
              </div>
              <div className="bg-white rounded-xl border border-green-200 p-4 text-center">
                <Plus size={20} className="mx-auto text-green-600 mb-1" />
                <p className="text-2xl font-bold text-green-700">{preview.new_players}</p>
                <p className="text-xs text-muted">New Players</p>
              </div>
              <div className="bg-white rounded-xl border border-orange-200 p-4 text-center">
                <AlertTriangle size={20} className="mx-auto text-orange mb-1" />
                <p className="text-2xl font-bold text-orange">{preview.duplicates.length}</p>
                <p className="text-xs text-muted">Duplicates</p>
              </div>
            </div>

            {/* Parse Errors */}
            {preview.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-red-700 mb-2">Parse Errors</h3>
                {preview.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">{e}</p>
                ))}
              </div>
            )}

            {/* Duplicate Review */}
            {preview.duplicates.length > 0 && (
              <div className="bg-white rounded-xl border border-teal/20 overflow-hidden">
                <div className="p-4 border-b border-teal/20 bg-orange/5">
                  <h3 className="text-sm font-semibold text-navy flex items-center gap-2">
                    <AlertTriangle size={16} className="text-orange" />
                    Duplicates Need Review ({preview.duplicates.length})
                  </h3>
                  <p className="text-xs text-muted mt-1">Choose what to do with each potential duplicate.</p>
                </div>

                <div className="divide-y divide-border">
                  {preview.duplicates.map((dup: ImportDuplicate) => (
                    <div key={dup.row_index} className="p-4">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <p className="text-sm font-semibold text-navy">
                            CSV: {dup.csv_name}
                          </p>
                          <p className="text-xs text-muted mt-0.5">
                            Matches existing: <strong>{dup.existing_name}</strong>
                            <span className="ml-2 text-orange font-semibold">{Math.round(dup.match_score * 100)}% match</span>
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {dup.match_reasons.map((r, i) => (
                              <span key={i} className="text-xs px-1.5 py-0.5 bg-navy/5 rounded text-navy/60">{r}</span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => setDupAction(dup.row_index, "skip")}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                            resolutions[dup.row_index] === "skip"
                              ? "bg-gray-600 text-white border-gray-600"
                              : "bg-white text-gray-600 border-teal/20 hover:border-gray-400"
                          }`}
                        >
                          <SkipForward size={12} /> Skip
                        </button>
                        <button
                          onClick={() => setDupAction(dup.row_index, "merge")}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                            resolutions[dup.row_index] === "merge"
                              ? "bg-teal text-white border-teal"
                              : "bg-white text-teal border-teal/20 hover:border-teal/50"
                          }`}
                        >
                          <GitMerge size={12} /> Merge Stats
                        </button>
                        <button
                          onClick={() => setDupAction(dup.row_index, "create_new")}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                            resolutions[dup.row_index] === "create_new"
                              ? "bg-orange text-white border-orange"
                              : "bg-white text-orange border-teal/20 hover:border-orange/50"
                          }`}
                        >
                          <Plus size={12} /> Create New
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview Table */}
            <div className="bg-white rounded-xl border border-teal/20 overflow-hidden">
              <div className="p-4 border-b border-teal/20">
                <h3 className="text-sm font-semibold text-navy">Preview (first 10 rows)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-navy/[0.03] border-b border-teal/20">
                      <th className="px-3 py-2 text-left font-oswald uppercase tracking-wider text-muted">Name</th>
                      <th className="px-3 py-2 text-left font-oswald uppercase tracking-wider text-muted">Pos</th>
                      <th className="px-3 py-2 text-left font-oswald uppercase tracking-wider text-muted">Team</th>
                      <th className="px-3 py-2 text-left font-oswald uppercase tracking-wider text-muted">League</th>
                      <th className="px-3 py-2 text-left font-oswald uppercase tracking-wider text-muted">DOB</th>
                      <th className="px-3 py-2 text-center font-oswald uppercase tracking-wider text-muted">GP</th>
                      <th className="px-3 py-2 text-center font-oswald uppercase tracking-wider text-muted">G</th>
                      <th className="px-3 py-2 text-center font-oswald uppercase tracking-wider text-muted">A</th>
                      <th className="px-3 py-2 text-center font-oswald uppercase tracking-wider text-muted">P</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview.map((row, i) => (
                      <tr key={i} className="border-b border-teal/10 hover:bg-navy/[0.02]">
                        <td className="px-3 py-2 font-medium text-navy">{row.first_name} {row.last_name}</td>
                        <td className="px-3 py-2">{row.position}</td>
                        <td className="px-3 py-2">{row.current_team || "—"}</td>
                        <td className="px-3 py-2">{row.current_league || "—"}</td>
                        <td className="px-3 py-2">{row.dob || "—"}</td>
                        <td className="px-3 py-2 text-center">{row.gp || "—"}</td>
                        <td className="px-3 py-2 text-center">{row.g || "—"}</td>
                        <td className="px-3 py-2 text-center">{row.a || "—"}</td>
                        <td className="px-3 py-2 text-center">{row.p || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setStep("upload"); setPreview(null); setError(""); }}
                className="px-4 py-2 text-sm text-muted hover:text-navy transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExecute}
                disabled={executing}
                className="flex items-center gap-2 px-6 py-2.5 bg-teal text-white font-oswald uppercase tracking-wider text-sm font-semibold rounded-xl hover:bg-teal/90 disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 size={16} />
                Import {preview.new_players + Object.values(resolutions).filter((a) => a !== "skip").length} Players
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Importing */}
        {step === "importing" && (
          <div className="bg-white rounded-xl border border-teal/20 p-12 text-center">
            <Loader2 size={40} className="mx-auto text-teal animate-spin mb-4" />
            <h2 className="text-lg font-bold text-navy mb-1">Importing Players...</h2>
            <p className="text-sm text-muted">This may take a moment.</p>
          </div>
        )}

        {/* Step 4: Done */}
        {step === "done" && result && (
          <div className="bg-white rounded-xl border border-teal/20 p-8 text-center">
            <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4" />
            <h2 className="text-xl font-bold text-navy mb-2">Import Complete!</h2>

            <div className="flex justify-center gap-6 my-6">
              <div>
                <p className="text-3xl font-bold text-green-600">{result.created}</p>
                <p className="text-xs text-muted">Created</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-teal">{result.merged}</p>
                <p className="text-xs text-muted">Merged</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-400">{result.skipped}</p>
                <p className="text-xs text-muted">Skipped</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="text-left bg-red-50 border border-red-200 rounded-lg p-3 mb-4 max-w-md mx-auto">
                <p className="text-xs font-semibold text-red-700 mb-1">Errors:</p>
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">{e}</p>
                ))}
              </div>
            )}

            <div className="flex justify-center gap-3 mt-4">
              <button
                onClick={() => { setStep("upload"); setPreview(null); setResult(null); }}
                className="px-4 py-2 text-sm text-teal hover:text-teal/80 border border-teal/30 rounded-lg transition-colors"
              >
                Import Another
              </button>
              <Link
                href="/players/manage"
                className="px-4 py-2 text-sm text-navy hover:text-navy/80 border border-navy/30 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Settings size={14} />
                Manage Players
              </Link>
              <Link
                href="/players"
                className="px-4 py-2 text-sm bg-teal text-white rounded-lg hover:bg-teal/90 font-oswald uppercase tracking-wider font-semibold transition-colors"
              >
                View Players
              </Link>
            </div>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}

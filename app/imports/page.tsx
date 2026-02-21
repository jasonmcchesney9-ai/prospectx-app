"use client";

import { useState, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  Database,
  Shield,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api, { extractApiError } from "@/lib/api";
import { getUser } from "@/lib/auth";

interface UploadResult {
  file_type: string;
  subtype: string | null;
  inserted: number;
  updated: number;
  skipped: number;
  unmapped_columns: string[];
  preview: { row: number; player: string }[];
}

interface RestoreSheetResult {
  table: string;
  rows: number;
  columns?: number;
  unmapped_columns?: string[];
  note?: string;
}

interface RestoreResult {
  status: string;
  backup: string;
  total_rows: number;
  sheets: Record<string, RestoreSheetResult>;
  skipped_sheets: string[];
}

const FILE_TYPE_LABELS: Record<string, string> = {
  skater: "Skater Stats",
  goalie: "Goalie Stats",
  lines: "Line Combinations",
  team_game_log: "Team Game Log",
  player_game_log: "Player Game Log",
  league_skater: "League Skater Stats",
  league_team: "League Team Stats",
};

export default function ImportsPage() {
  const user = getUser();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StatNormalizerUploader />
        {isAdmin && (
          <div className="mt-10">
            <DatabaseRestorer />
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}

function StatNormalizerUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [season, setSeason] = useState("2025-26");
  const [leagueName, setLeagueName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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
      if (leagueName) params.set("league_name", leagueName);

      const { data } = await api.post<UploadResult>(
        `/stats/upload?${params.toString()}`,
        fd,
        { timeout: 300000 }
      );
      setResult(data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as { message?: string })?.message ||
        "Upload failed";
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

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center">
            <Upload size={20} className="text-teal" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-oswald text-navy">Stat Normalizer</h1>
            <p className="text-muted text-sm">
              Upload InStat XLSX exports for processing and normalization
            </p>
          </div>
        </div>
      </div>

      {/* Success Result */}
      {result && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <CheckCircle size={20} className="text-green-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-green-800 text-sm flex items-center gap-2 flex-wrap">
                Upload Complete
                <span className="text-xs px-2 py-0.5 rounded bg-white border text-teal">
                  {FILE_TYPE_LABELS[result.file_type] || result.file_type}
                  {result.subtype && ` (${result.subtype})`}
                </span>
              </p>

              {/* Stat Boxes */}
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="bg-white rounded-lg p-3 border border-green-100">
                  <p className="text-2xl font-oswald font-bold text-green-600">{result.inserted}</p>
                  <p className="text-xs text-muted uppercase tracking-wider">Inserted</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-green-100">
                  <p className="text-2xl font-oswald font-bold text-blue-600">{result.updated}</p>
                  <p className="text-xs text-muted uppercase tracking-wider">Updated</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-green-100">
                  <p className="text-2xl font-oswald font-bold text-gray-400">{result.skipped}</p>
                  <p className="text-xs text-muted uppercase tracking-wider">Skipped</p>
                </div>
              </div>

              {/* Unmapped Columns */}
              {result.unmapped_columns.length > 0 && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-800">
                    {result.unmapped_columns.length} unmapped column{result.unmapped_columns.length !== 1 ? "s" : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {result.unmapped_columns.map((col) => (
                      <span
                        key={col}
                        className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-mono"
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview Rows */}
              {result.preview.length > 0 && (
                <div className="mt-3 text-xs text-muted">
                  <p className="font-semibold text-navy mb-1">Preview:</p>
                  {result.preview.map((p) => (
                    <p key={p.row}>
                      Row {p.row}: {p.player}
                    </p>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="mt-4 flex gap-4 flex-wrap">
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-1.5 text-sm text-teal hover:underline"
                >
                  <ArrowRight size={14} />
                  Upload Another File
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
            <p className="text-red-700 font-medium text-sm">Upload Error</p>
            <p className="text-red-600 text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Upload Form */}
      {!result && (
        <div className="bg-white rounded-xl border border-border p-6">
          {/* File Picker */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-navy mb-2">
              Stats File (.xlsx)
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
                    <p className="text-xs text-muted">{(file.size / 1024).toFixed(1)} KB</p>
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
                  <Upload size={32} className="mx-auto mb-2 text-teal/40" />
                  <p className="text-sm text-muted">
                    Click to select an <span className="font-semibold text-navy">.xlsx</span> file
                  </p>
                  <p className="text-xs text-muted mt-1">InStat Excel export</p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFile(f);
                  setError("");
                  setResult(null);
                }
              }}
            />
          </div>

          {/* Season */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-navy mb-2">Season</label>
            <input
              type="text"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
              placeholder="e.g. 2025-26"
            />
          </div>

          {/* League Name */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-navy mb-2">League Name</label>
            <input
              type="text"
              value={leagueName}
              onChange={(e) => setLeagueName(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
              placeholder="e.g. OHL, BCHL, USHL"
            />
          </div>

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full bg-teal text-white font-semibold py-2.5 rounded-lg hover:bg-teal/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload size={18} />
                Upload &amp; Process
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function DatabaseRestorer() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<RestoreResult | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleRestore = async () => {
    if (!file) return;
    if (!confirm("This will overwrite existing data in the database. A backup will be created automatically. Continue?")) return;
    setUploading(true);
    setError("");
    setResult(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post<RestoreResult>("/admin/restore", fd, { timeout: 600000 });
      setResult(data);
    } catch (err: unknown) {
      setError(extractApiError(err, "Restore failed"));
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

  const sheetEntries = result ? Object.entries(result.sheets) : [];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-orange/10 flex items-center justify-center">
            <Database size={20} className="text-orange" />
          </div>
          <div>
            <h2 className="text-2xl font-bold font-oswald text-navy">Restore ProspectX Database</h2>
            <p className="text-muted text-sm">
              Import a ProspectX XLSX export to restore tables
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2 mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <Shield size={14} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700">
            Admin only. Each sheet is mapped to a database table and imported using INSERT OR REPLACE.
            A backup is created automatically before any changes.
          </p>
        </div>
      </div>

      {/* Success Result */}
      {result && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <CheckCircle size={20} className="text-green-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-green-800 text-sm">Restore Complete</p>

              {/* Backup & Total */}
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="bg-white rounded-lg p-3 border border-green-100">
                  <p className="text-2xl font-oswald font-bold text-green-600">{result.total_rows.toLocaleString()}</p>
                  <p className="text-xs text-muted uppercase tracking-wider">Total Rows</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-green-100">
                  <p className="text-xs font-semibold text-navy mb-1">Backup Created</p>
                  <p className="text-xs text-muted font-mono break-all">{result.backup}</p>
                </div>
              </div>

              {/* Per-Sheet Breakdown */}
              {sheetEntries.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-navy mb-2">Sheet Breakdown</p>
                  <div className="bg-white rounded-lg border border-green-100 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-green-50/50 border-b border-green-100">
                          <th className="text-left px-3 py-2 font-semibold text-navy">Sheet</th>
                          <th className="text-left px-3 py-2 font-semibold text-navy">Table</th>
                          <th className="text-right px-3 py-2 font-semibold text-navy">Rows</th>
                          <th className="text-right px-3 py-2 font-semibold text-navy">Cols</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sheetEntries.map(([sheet, info]) => (
                          <tr key={sheet} className="border-b border-green-50 last:border-0">
                            <td className="px-3 py-2 font-medium text-navy">{sheet}</td>
                            <td className="px-3 py-2 text-muted font-mono">{info.table}</td>
                            <td className="px-3 py-2 text-right font-oswald font-bold text-green-600">{info.rows.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-muted">{info.columns ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Unmapped columns per sheet */}
              {sheetEntries.some(([, info]) => info.unmapped_columns && info.unmapped_columns.length > 0) && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-800 mb-1">Unmapped Columns</p>
                  {sheetEntries
                    .filter(([, info]) => info.unmapped_columns && info.unmapped_columns.length > 0)
                    .map(([sheet, info]) => (
                      <div key={sheet} className="mt-1">
                        <span className="text-xs font-medium text-amber-700">{sheet}: </span>
                        {info.unmapped_columns!.map((col) => (
                          <span key={col} className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-mono mr-1">
                            {col}
                          </span>
                        ))}
                      </div>
                    ))}
                </div>
              )}

              {/* Skipped Sheets */}
              {result.skipped_sheets.length > 0 && (
                <div className="mt-3 text-xs text-muted">
                  <span className="font-semibold text-navy">Skipped sheets: </span>
                  {result.skipped_sheets.join(", ")}
                </div>
              )}

              {/* Actions */}
              <div className="mt-4">
                <button onClick={reset} className="inline-flex items-center gap-1.5 text-sm text-teal hover:underline">
                  <ArrowRight size={14} />
                  Restore Another File
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
            <p className="text-red-700 font-medium text-sm">Restore Error</p>
            <p className="text-red-600 text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Upload Form */}
      {!result && (
        <div className="bg-white rounded-xl border border-border p-6">
          {/* File Picker */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-navy mb-2">
              ProspectX Export File (.xlsx)
            </label>
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                file ? "border-orange bg-orange/5" : "border-orange/20 hover:border-orange/50"
              }`}
              onClick={() => fileRef.current?.click()}
            >
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileSpreadsheet size={24} className="text-orange" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-navy">{file.name}</p>
                    <p className="text-xs text-muted">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); reset(); }}
                    className="text-xs text-muted hover:text-red-500 ml-2"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <Database size={32} className="mx-auto mb-2 text-orange/40" />
                  <p className="text-sm text-muted">
                    Click to select a ProspectX <span className="font-semibold text-navy">.xlsx</span> export
                  </p>
                  <p className="text-xs text-muted mt-1">Each sheet maps to a database table</p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setFile(f); setError(""); setResult(null); }
              }}
            />
          </div>

          {/* Restore Button */}
          <button
            onClick={handleRestore}
            disabled={!file || uploading}
            className="w-full bg-orange text-white font-semibold py-2.5 rounded-lg hover:bg-orange/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Restoring...
              </>
            ) : (
              <>
                <Database size={18} />
                Restore Database
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

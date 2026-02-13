"use client";

import { useState } from "react";
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
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";
import type { ImportDuplicate, ImportPreview, ImportResult } from "@/types/api";

type Step = "upload" | "preview" | "importing" | "done";

export default function BatchImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [executing, setExecuting] = useState(false);

  // Duplicate resolutions: row_index -> action
  const [resolutions, setResolutions] = useState<Record<number, string>>({});

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post<ImportPreview>("/import/preview", formData);
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
        <Link href="/players" className="flex items-center gap-1 text-sm text-muted hover:text-navy mb-6">
          <ArrowLeft size={14} /> Back to Players
        </Link>

        <h1 className="text-2xl font-bold text-navy mb-1">Import Players</h1>
        <p className="text-sm text-muted mb-6">Upload a CSV or Excel roster to batch-add players. For InStat game stats, upload from the player&apos;s profile page instead.</p>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle size={16} />
            {error}
            <button onClick={() => setError("")} className="ml-auto"><X size={14} /></button>
          </div>
        )}

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="bg-white rounded-xl border border-border p-8 text-center">
            <FileSpreadsheet size={48} className="mx-auto text-teal/40 mb-4" />
            <h2 className="text-lg font-semibold text-navy mb-2">Upload Player Roster</h2>
            <p className="text-sm text-muted mb-6 max-w-md mx-auto">
              Upload a CSV or Excel file (.xlsx) with player roster data. Required columns: <strong>First Name</strong>, <strong>Last Name</strong>.
              Optional: Position, DOB, Team, League, Shoots, GP, G, A, P, PIM.
            </p>
            <p className="text-xs text-muted/60 mb-4 max-w-md mx-auto">
              <strong>Note:</strong> InStat game logs and stat exports should be uploaded from each player&apos;s profile page (Stats tab), not here.
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

            {/* Sample CSV format */}
            <div className="mt-8 text-left max-w-lg mx-auto">
              <p className="text-xs font-oswald uppercase tracking-wider text-muted mb-2">Example CSV Format</p>
              <pre className="text-xs bg-navy/[0.03] p-3 rounded-lg border border-border overflow-x-auto">
{`First Name,Last Name,Position,DOB,Team,League,GP,G,A,P
Ewan,McChesney,C,2005-03-15,Chatham Maroons,GOJHL,25,12,18,30
Connor,Smith,LW,2006-01-20,Chatham Maroons,GOJHL,24,8,10,18
Jake,Wilson,D,2005-11-05,Chatham Maroons,GOJHL,25,2,8,10`}
              </pre>
            </div>
          </div>
        )}

        {/* Step 2: Preview + Duplicate Review */}
        {step === "preview" && preview && (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl border border-border p-4 text-center">
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
              <div className="bg-white rounded-xl border border-border overflow-hidden">
                <div className="p-4 border-b border-border bg-orange/5">
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
                              : "bg-white text-gray-600 border-border hover:border-gray-400"
                          }`}
                        >
                          <SkipForward size={12} /> Skip
                        </button>
                        <button
                          onClick={() => setDupAction(dup.row_index, "merge")}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                            resolutions[dup.row_index] === "merge"
                              ? "bg-teal text-white border-teal"
                              : "bg-white text-teal border-border hover:border-teal/50"
                          }`}
                        >
                          <GitMerge size={12} /> Merge Stats
                        </button>
                        <button
                          onClick={() => setDupAction(dup.row_index, "create_new")}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                            resolutions[dup.row_index] === "create_new"
                              ? "bg-orange text-white border-orange"
                              : "bg-white text-orange border-border hover:border-orange/50"
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
            <div className="bg-white rounded-xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="text-sm font-semibold text-navy">Preview (first 10 rows)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-navy/[0.03] border-b border-border">
                      <th className="px-3 py-2 text-left font-oswald uppercase tracking-wider text-muted">Name</th>
                      <th className="px-3 py-2 text-left font-oswald uppercase tracking-wider text-muted">Pos</th>
                      <th className="px-3 py-2 text-left font-oswald uppercase tracking-wider text-muted">Team</th>
                      <th className="px-3 py-2 text-left font-oswald uppercase tracking-wider text-muted">DOB</th>
                      <th className="px-3 py-2 text-center font-oswald uppercase tracking-wider text-muted">GP</th>
                      <th className="px-3 py-2 text-center font-oswald uppercase tracking-wider text-muted">G</th>
                      <th className="px-3 py-2 text-center font-oswald uppercase tracking-wider text-muted">A</th>
                      <th className="px-3 py-2 text-center font-oswald uppercase tracking-wider text-muted">P</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview.map((row, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-navy/[0.02]">
                        <td className="px-3 py-2 font-medium text-navy">{row.first_name} {row.last_name}</td>
                        <td className="px-3 py-2">{row.position}</td>
                        <td className="px-3 py-2">{row.current_team || "—"}</td>
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
          <div className="bg-white rounded-xl border border-border p-12 text-center">
            <Loader2 size={40} className="mx-auto text-teal animate-spin mb-4" />
            <h2 className="text-lg font-bold text-navy mb-1">Importing Players...</h2>
            <p className="text-sm text-muted">This may take a moment.</p>
          </div>
        )}

        {/* Step 4: Done */}
        {step === "done" && result && (
          <div className="bg-white rounded-xl border border-border p-8 text-center">
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

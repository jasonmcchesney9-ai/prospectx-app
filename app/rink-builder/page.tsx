"use client";

// ============================================================
// ProspectX — Rink Builder (Standalone Page)
// Interactive diagram creation — save as drill or export
// ============================================================

import { useState, useRef } from "react";
import { Save, ChevronDown, ChevronUp } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import RinkCanvas from "@/components/RinkCanvas";
import api from "@/lib/api";
import { DRILL_CATEGORIES } from "@/types/api";
import type { RinkDiagramData } from "@/types/rink";
import { RINK_DIMENSIONS } from "@/types/rink";

interface SaveForm {
  name: string;
  category: string;
  description: string;
}

export default function RinkBuilderPage() {
  const [showSave, setShowSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [form, setForm] = useState<SaveForm>({ name: "", category: "systems", description: "" });

  // Track current diagram data for save
  const diagramRef = useRef<{ data: RinkDiagramData; svg: string } | null>(null);

  function handleDiagramChange(data: RinkDiagramData) {
    // Keep ref updated with latest data (we'll generate SVG on save)
    diagramRef.current = { data, svg: "" };
  }

  async function handleSaveAsDrill() {
    if (!form.name.trim()) {
      setSaveError("Drill name is required.");
      return;
    }
    if (!diagramRef.current) {
      setSaveError("Draw something on the canvas first.");
      return;
    }

    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      // Get the ice surface from rink type
      const iceSurface = diagramRef.current.data.rinkType;

      // Create the drill first
      const { data: drill } = await api.post("/drills", {
        name: form.name.trim(),
        category: form.category,
        description: form.description.trim() || `Custom diagram created in Rink Builder`,
        ice_surface: iceSurface,
        duration_minutes: 10,
        players_needed: diagramRef.current.data.elements.filter((e) => e.type === "marker").length,
        intensity: "medium",
        age_levels: ["U16_U18", "JUNIOR_COLLEGE_PRO"],
        tags: ["custom-diagram"],
        diagram_data: diagramRef.current.data,
      });

      // Now save the canvas diagram (SVG + data) — we need the SVG from the canvas
      // The RinkCanvas onSave callback gives us both
      // For now, save diagram_data via the drill create endpoint

      setSaveSuccess(`Saved as "${form.name}" in Drill Library!`);
      setForm({ name: "", category: "systems", description: "" });
      setShowSave(false);
      setTimeout(() => setSaveSuccess(""), 5000);
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to save drill.";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-navy">Rink Builder</h1>
            <p className="text-xs text-muted mt-0.5">Draw plays, formations, and drill diagrams</p>
          </div>
          <button
            onClick={() => setShowSave(!showSave)}
            className="flex items-center gap-2 px-4 py-2 bg-teal text-white text-sm font-oswald uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
          >
            <Save size={14} />
            Save as Drill
            {showSave ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Success Banner */}
        {saveSuccess && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700 text-sm">
            {saveSuccess}
          </div>
        )}

        {/* Save Form (collapsible) */}
        {showSave && (
          <div className="mb-4 bg-white rounded-xl border border-border p-4">
            <h3 className="text-xs font-oswald uppercase tracking-wider text-navy mb-3">Save to Drill Library</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">Drill Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. 2-on-1 Rush Setup"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white"
                >
                  {Object.entries(DRILL_CATEGORIES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description (optional)"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white"
                />
              </div>
            </div>

            {saveError && (
              <p className="text-xs text-red-600 mb-2">{saveError}</p>
            )}

            <button
              onClick={handleSaveAsDrill}
              disabled={saving}
              className="px-4 py-2 bg-navy text-white text-sm font-oswald uppercase tracking-wider rounded-lg hover:bg-navy-light transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Drill"}
            </button>
          </div>
        )}

        {/* Canvas */}
        <RinkCanvas
          onChange={handleDiagramChange}
          showToolbar={true}
          editable={true}
        />

        {/* Help text */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Place", desc: "Select a tool and click on the ice" },
            { label: "Move", desc: "Use Select tool, then drag elements" },
            { label: "Arrow", desc: "Click start, then click end point" },
            { label: "Delete", desc: "Select and press Delete, or use Eraser" },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-lg border border-border p-3">
              <h4 className="text-[10px] font-oswald uppercase tracking-wider text-teal mb-1">{item.label}</h4>
              <p className="text-[11px] text-muted leading-snug">{item.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </ProtectedRoute>
  );
}

"use client";

// ============================================================
// ProspectX — Rink Builder (Standalone Page)
// Interactive diagram creation — save as drill or export
// ============================================================

import { useState, useRef } from "react";
import { Save, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Clock, Users, Flame, Zap } from "lucide-react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import RinkCanvas from "@/components/RinkCanvas";
import type { RinkCanvasHandle } from "@/components/RinkCanvas";
import api from "@/lib/api";
import { DRILL_CATEGORIES } from "@/types/api";
import type { RinkDiagramData } from "@/types/rink";
import { RINK_DIMENSIONS } from "@/types/rink";

interface SaveForm {
  name: string;
  category: string;
  description: string;
  setup: string;
  coaching_points: string;
  duration_minutes: number;
  intensity: "low" | "medium" | "high";
  players_needed: number;
}

const INTENSITY_OPTIONS = [
  { value: "low", label: "Low", color: "bg-blue-100 text-blue-700" },
  { value: "medium", label: "Medium", color: "bg-orange-100 text-orange-700" },
  { value: "high", label: "High", color: "bg-red-100 text-red-700" },
];

export default function RinkBuilderPage() {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState<{ name: string; id: string } | null>(null);
  const [form, setForm] = useState<SaveForm>({
    name: "",
    category: "systems",
    description: "",
    setup: "",
    coaching_points: "",
    duration_minutes: 10,
    intensity: "medium",
    players_needed: 0,
  });

  // Canvas ref for getting SVG + diagram data at save time
  const canvasRef = useRef<RinkCanvasHandle>(null);

  // Track current diagram data via onChange (for element count etc.)
  const diagramDataRef = useRef<RinkDiagramData | null>(null);

  function handleDiagramChange(data: RinkDiagramData) {
    diagramDataRef.current = data;
    // Auto-count markers for players_needed
    const markerCount = data.elements.filter((e) => e.type === "marker").length;
    if (markerCount > 0 && form.players_needed === 0) {
      setForm((prev) => ({ ...prev, players_needed: markerCount }));
    }
  }

  async function handleSaveAsDrill() {
    if (!form.name.trim()) {
      setSaveError("Drill name is required.");
      return;
    }
    if (!form.description.trim()) {
      setSaveError("Drill description is required.");
      return;
    }
    if (!canvasRef.current) {
      setSaveError("Canvas not ready — try again.");
      return;
    }

    // Get diagram data and SVG from canvas
    const diagramData = canvasRef.current.getDiagramData();
    const svgString = canvasRef.current.getSvgString();

    if (diagramData.elements.length === 0) {
      setSaveError("Draw something on the canvas first.");
      return;
    }

    setSaving(true);
    setSaveError("");
    setSaveSuccess(null);

    try {
      // Step 1: Create the drill with all text fields + diagram_data
      const { data: drill } = await api.post("/drills", {
        name: form.name.trim(),
        category: form.category,
        description: form.description.trim(),
        setup: form.setup.trim() || undefined,
        coaching_points: form.coaching_points.trim() || undefined,
        ice_surface: diagramData.rinkType,
        duration_minutes: form.duration_minutes,
        players_needed: form.players_needed || diagramData.elements.filter((e) => e.type === "marker").length,
        intensity: form.intensity,
        age_levels: ["U16_U18", "JUNIOR_COLLEGE_PRO"],
        tags: ["custom-diagram", "rink-builder"],
        diagram_data: diagramData,
      });

      // Step 2: Save the SVG diagram image via the canvas endpoint
      if (svgString && drill.id) {
        try {
          await api.put(`/drills/${drill.id}/diagram/canvas`, {
            diagram_data: diagramData,
            svg_string: svgString,
          });
        } catch (err) {
          // Non-fatal — drill is created, diagram just didn't save as file
          console.warn("Diagram image save failed (drill still created):", err);
        }
      }

      setSaveSuccess({ name: form.name, id: drill.id });
      setForm({
        name: "",
        category: "systems",
        description: "",
        setup: "",
        coaching_points: "",
        duration_minutes: 10,
        intensity: "medium",
        players_needed: 0,
      });
      // Auto-hide success after 10s
      setTimeout(() => setSaveSuccess(null), 10000);
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
            <p className="text-xs text-muted mt-0.5">Draw plays, formations, and drill diagrams — then save to your Drill Library</p>
          </div>
          <Link
            href="/practice-plans/generate"
            className="flex items-center gap-2 px-4 py-2 bg-orange text-white text-xs font-oswald uppercase tracking-wider rounded-full hover:bg-orange/90 transition-colors whitespace-nowrap"
          >
            <Zap size={14} />
            Generate Practice Plan
          </Link>
        </div>

        {/* Success Banner */}
        {saveSuccess && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-700 text-sm">
              <CheckCircle2 size={16} />
              <span>
                Saved <strong>&quot;{saveSuccess.name}&quot;</strong> to Drill Library with diagram!
              </span>
            </div>
            <Link
              href="/drills"
              className="text-xs font-oswald uppercase tracking-wider text-teal hover:text-teal/80 transition-colors"
            >
              View Drill Library →
            </Link>
          </div>
        )}

        {/* Canvas */}
        <RinkCanvas
          ref={canvasRef}
          onChange={handleDiagramChange}
          showToolbar={true}
          editable={true}
        />

        {/* ── Drill Details Section ─────────────────────────────── */}
        <div className="mt-6 bg-white rounded-xl border border-teal/20 overflow-hidden">
          <div className="bg-navy/[0.03] px-5 py-3 border-b border-teal/20">
            <h3 className="text-xs font-oswald uppercase tracking-wider text-navy flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-teal" />
              Drill Details
            </h3>
            <p className="text-[10px] text-muted mt-0.5">Fill in the details below, then save to create a complete drill with your diagram</p>
          </div>

          <div className="p-5 space-y-4">
            {/* Row 1: Name + Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1.5">Drill Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. 2-on-1 Rush Setup"
                  className="w-full px-3 py-2.5 border border-teal/20 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1.5">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2.5 border border-teal/20 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal transition-all"
                >
                  {Object.entries(DRILL_CATEGORIES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Duration, Players, Intensity */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1.5 flex items-center gap-1">
                  <Clock size={10} /> Duration (min)
                </label>
                <input
                  type="number"
                  value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: Math.max(1, parseInt(e.target.value) || 10) })}
                  min={1}
                  max={60}
                  className="w-full px-3 py-2.5 border border-teal/20 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1.5 flex items-center gap-1">
                  <Users size={10} /> Players Needed
                </label>
                <input
                  type="number"
                  value={form.players_needed}
                  onChange={(e) => setForm({ ...form, players_needed: Math.max(0, parseInt(e.target.value) || 0) })}
                  min={0}
                  max={30}
                  className="w-full px-3 py-2.5 border border-teal/20 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1.5 flex items-center gap-1">
                  <Flame size={10} /> Intensity
                </label>
                <div className="flex gap-1.5">
                  {INTENSITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setForm({ ...form, intensity: opt.value as "low" | "medium" | "high" })}
                      className={`flex-1 px-2 py-2 rounded-lg text-[10px] font-oswald uppercase tracking-wider font-bold transition-all ${
                        form.intensity === opt.value
                          ? opt.color + " ring-2 ring-offset-1 ring-navy/20"
                          : "bg-navy/[0.04] text-navy/40 hover:bg-navy/[0.08]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Setup */}
            <div>
              <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1.5">Setup</label>
              <textarea
                value={form.setup}
                onChange={(e) => setForm({ ...form, setup: e.target.value })}
                placeholder="Describe how to set up the drill — cone placement, player positioning, puck location..."
                rows={3}
                className="w-full px-3 py-2 border border-teal/20 rounded-lg text-sm bg-white placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal transition-all resize-none"
              />
            </div>

            {/* Drill Description */}
            <div>
              <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1.5">Drill Description *</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Step-by-step description of how the drill runs — flow, timing, rotations..."
                rows={4}
                className="w-full px-3 py-2 border border-teal/20 rounded-lg text-sm bg-white placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal transition-all resize-none"
              />
            </div>

            {/* Coaching Points */}
            <div>
              <label className="block text-[10px] font-oswald uppercase tracking-wider text-teal mb-1.5">Coaching Points</label>
              <textarea
                value={form.coaching_points}
                onChange={(e) => setForm({ ...form, coaching_points: e.target.value })}
                placeholder="Key teaching points — what to emphasize, common mistakes to watch for, success criteria..."
                rows={3}
                className="w-full px-3 py-2 border border-teal/20 rounded-lg text-sm bg-white placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal transition-all resize-none"
              />
            </div>

            {/* Error */}
            {saveError && (
              <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle size={14} />
                {saveError}
              </div>
            )}

            {/* Save Button */}
            <div className="flex items-center justify-between pt-2 border-t border-teal/10">
              <p className="text-[10px] text-muted">
                Diagram + details are saved together to the Drill Library
              </p>
              <button
                onClick={handleSaveAsDrill}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-teal text-white text-sm font-oswald uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={14} />
                {saving ? "Saving..." : "Save to Drill Library"}
              </button>
            </div>
          </div>
        </div>

        {/* Help text */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Place", desc: "Select a tool and click on the ice" },
            { label: "Move", desc: "Use Select tool, then drag elements" },
            { label: "Arrow", desc: "Click start, then click end point" },
            { label: "Delete", desc: "Select and press Delete, or use Eraser" },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-lg border border-teal/20 p-3">
              <h4 className="text-[10px] font-oswald uppercase tracking-wider text-teal mb-1">{item.label}</h4>
              <p className="text-[11px] text-muted leading-snug">{item.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </ProtectedRoute>
  );
}

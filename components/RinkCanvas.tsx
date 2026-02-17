"use client";

// ============================================================
// ProspectX — Interactive Rink Diagram Canvas
// Pure SVG + React state — zero external dependencies
// Place markers, draw arrows, drag to reposition, export
// ============================================================

import { useState, useRef, useCallback, useEffect } from "react";
import RinkSvgBackground from "./RinkSvgBackground";
import { MarkerElement, ArrowElement, PuckElement } from "./RinkElements";
import RinkToolbar from "./RinkToolbar";
import {
  RINK_COLORS,
  RINK_DIMENSIONS,
  type RinkType,
  type RinkElement,
  type RinkMarker,
  type RinkArrow,
  type RinkPuck,
  type RinkDiagramData,
  type ToolMode,
  type MarkerType,
} from "@/types/rink";

// ── Props ────────────────────────────────────────────────────

interface RinkCanvasProps {
  initialData?: RinkDiagramData;
  onChange?: (data: RinkDiagramData) => void;
  onSave?: (data: RinkDiagramData, svgString: string) => void;
  showToolbar?: boolean;
  editable?: boolean;
  className?: string;
}

// ── Helpers ──────────────────────────────────────────────────

let _idCounter = 0;
function uid(): string {
  _idCounter += 1;
  return `el_${Date.now()}_${_idCounter}`;
}

const MAX_HISTORY = 30;

// Convert mouse/touch event to SVG viewBox coordinates
function svgPoint(e: React.MouseEvent<SVGSVGElement>, svg: SVGSVGElement): { x: number; y: number } {
  const rect = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  return {
    x: Math.round(((e.clientX - rect.left) / rect.width) * vb.width),
    y: Math.round(((e.clientY - rect.top) / rect.height) * vb.height),
  };
}

// Distance from point to element center
function hitTest(
  px: number,
  py: number,
  el: RinkElement
): number {
  if (el.type === "marker" || el.type === "puck") {
    const dx = px - el.x;
    const dy = py - el.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  if (el.type === "arrow") {
    // Distance from point to line segment
    const { x1, y1, x2, y2 } = el;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
  }
  return Infinity;
}

// Find nearest element within threshold
function findElement(px: number, py: number, elements: RinkElement[], threshold = 20): RinkElement | null {
  let best: RinkElement | null = null;
  let bestDist = Infinity;
  for (const el of elements) {
    const d = hitTest(px, py, el);
    if (d < bestDist && d < threshold) {
      best = el;
      bestDist = d;
    }
  }
  return best;
}

// ── Main Component ───────────────────────────────────────────

export default function RinkCanvas({
  initialData,
  onChange,
  onSave,
  showToolbar = true,
  editable = true,
  className = "",
}: RinkCanvasProps) {
  // ── State ──
  const [rinkType, setRinkType] = useState<RinkType>(initialData?.rinkType || "full");
  const [elements, setElements] = useState<RinkElement[]>(initialData?.elements || []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [arrowStart, setArrowStart] = useState<{ x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [dragState, setDragState] = useState<{ id: string; startX: number; startY: number; elSnapshot: RinkElement } | null>(null);
  const [history, setHistory] = useState<RinkElement[][]>([]);

  const svgRef = useRef<SVGSVGElement>(null);
  const dims = RINK_DIMENSIONS[rinkType];

  // ── Notify parent of changes ──
  const notifyChange = useCallback(
    (els: RinkElement[], rt: RinkType) => {
      if (onChange) {
        const d = RINK_DIMENSIONS[rt];
        onChange({ rinkType: rt, width: d.w, height: d.h, elements: els, version: 1 });
      }
    },
    [onChange]
  );

  // ── Push to history before mutation ──
  const pushHistory = useCallback(() => {
    setHistory((prev) => {
      const next = [...prev, elements];
      return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
    });
  }, [elements]);

  // ── Undo ──
  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const newHist = [...prev];
      const last = newHist.pop()!;
      setElements(last);
      notifyChange(last, rinkType);
      return newHist;
    });
    setSelectedId(null);
    setArrowStart(null);
  }, [rinkType, notifyChange]);

  // ── Clear all ──
  const handleClear = useCallback(() => {
    if (elements.length === 0) return;
    pushHistory();
    setElements([]);
    setSelectedId(null);
    setArrowStart(null);
    notifyChange([], rinkType);
  }, [elements, pushHistory, rinkType, notifyChange]);

  // ── Delete selected ──
  const handleDeleteSelected = useCallback(() => {
    if (!selectedId) return;
    pushHistory();
    const next = elements.filter((el) => el.id !== selectedId);
    setElements(next);
    setSelectedId(null);
    notifyChange(next, rinkType);
  }, [selectedId, elements, pushHistory, rinkType, notifyChange]);

  // ── Change rink type ──
  const handleRinkTypeChange = useCallback(
    (rt: RinkType) => {
      setRinkType(rt);
      notifyChange(elements, rt);
    },
    [elements, notifyChange]
  );

  // ── Keyboard shortcuts ──
  useEffect(() => {
    if (!editable) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Delete" || e.key === "Backspace") {
        // Don't intercept if focus is in an input
        if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
        e.preventDefault();
        handleDeleteSelected();
      }
      if (e.key === "Escape") {
        setArrowStart(null);
        setSelectedId(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        handleUndo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editable, handleDeleteSelected, handleUndo]);

  // ── SVG Mouse Handlers ─────────────────────────────────────

  const handleSvgMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!editable || !svgRef.current) return;
      const pt = svgPoint(e, svgRef.current);

      // ── Select / Drag ──
      if (toolMode === "select") {
        const hit = findElement(pt.x, pt.y, elements);
        if (hit) {
          setSelectedId(hit.id);
          setDragState({ id: hit.id, startX: pt.x, startY: pt.y, elSnapshot: { ...hit } as RinkElement });
        } else {
          setSelectedId(null);
        }
        return;
      }

      // ── Eraser ──
      if (toolMode === "eraser") {
        const hit = findElement(pt.x, pt.y, elements);
        if (hit) {
          pushHistory();
          const next = elements.filter((el) => el.id !== hit.id);
          setElements(next);
          notifyChange(next, rinkType);
        }
        return;
      }

      // ── Place Marker ──
      if (toolMode.startsWith("marker_")) {
        const markerType = toolMode.replace("marker_", "") as MarkerType;
        pushHistory();
        const marker: RinkMarker = { id: uid(), type: "marker", x: pt.x, y: pt.y, markerType, label: "" };
        const next = [...elements, marker];
        setElements(next);
        notifyChange(next, rinkType);
        return;
      }

      // ── Place Puck ──
      if (toolMode === "puck") {
        pushHistory();
        const puck: RinkPuck = { id: uid(), type: "puck", x: pt.x, y: pt.y };
        const next = [...elements, puck];
        setElements(next);
        notifyChange(next, rinkType);
        return;
      }

      // ── Arrow: two-click ──
      if (toolMode === "arrow_solid" || toolMode === "arrow_dashed") {
        if (!arrowStart) {
          setArrowStart({ x: pt.x, y: pt.y });
        } else {
          pushHistory();
          const arrow: RinkArrow = {
            id: uid(),
            type: "arrow",
            x1: arrowStart.x,
            y1: arrowStart.y,
            x2: pt.x,
            y2: pt.y,
            style: toolMode === "arrow_dashed" ? "dashed" : "solid",
            color: toolMode === "arrow_dashed" ? RINK_COLORS.NAVY : RINK_COLORS.TEAL,
          };
          const next = [...elements, arrow];
          setElements(next);
          setArrowStart(null);
          notifyChange(next, rinkType);
        }
        return;
      }
    },
    [editable, toolMode, elements, arrowStart, pushHistory, rinkType, notifyChange]
  );

  const handleSvgMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;
      const pt = svgPoint(e, svgRef.current);

      // Arrow preview
      if (arrowStart) {
        setMousePos(pt);
      }

      // Dragging
      if (dragState && toolMode === "select") {
        const dx = pt.x - dragState.startX;
        const dy = pt.y - dragState.startY;
        const snap = dragState.elSnapshot;

        setElements((prev) =>
          prev.map((el) => {
            if (el.id !== dragState.id) return el;
            if (el.type === "marker" || el.type === "puck") {
              return { ...el, x: (snap as RinkMarker | RinkPuck).x + dx, y: (snap as RinkMarker | RinkPuck).y + dy };
            }
            if (el.type === "arrow") {
              const s = snap as RinkArrow;
              return { ...el, x1: s.x1 + dx, y1: s.y1 + dy, x2: s.x2 + dx, y2: s.y2 + dy };
            }
            return el;
          })
        );
      }
    },
    [arrowStart, dragState, toolMode]
  );

  const handleSvgMouseUp = useCallback(() => {
    if (dragState) {
      // Commit drag — push history was called at start? No, we need to push before the drag started
      // Actually we do it here — record the pre-drag state
      if (dragState.elSnapshot) {
        setHistory((prev) => {
          // Push pre-drag elements (with original positions)
          const preDrag = elements.map((el) =>
            el.id === dragState.id ? dragState.elSnapshot : el
          );
          const next = [...prev, preDrag];
          return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
        });
      }
      notifyChange(elements, rinkType);
      setDragState(null);
    }
  }, [dragState, elements, rinkType, notifyChange]);

  // ── Element mouse down (prevents SVG handler from also firing) ──
  const handleElementMouseDown = useCallback(
    (el: RinkElement, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!editable || !svgRef.current) return;
      const pt = svgPoint(e as unknown as React.MouseEvent<SVGSVGElement>, svgRef.current);

      if (toolMode === "select") {
        setSelectedId(el.id);
        setDragState({ id: el.id, startX: pt.x, startY: pt.y, elSnapshot: { ...el } as RinkElement });
        return;
      }

      if (toolMode === "eraser") {
        pushHistory();
        const next = elements.filter((item) => item.id !== el.id);
        setElements(next);
        notifyChange(next, rinkType);
        return;
      }

      // For other tools, let SVG handler deal with it
      handleSvgMouseDown(e as unknown as React.MouseEvent<SVGSVGElement>);
    },
    [editable, toolMode, elements, pushHistory, rinkType, notifyChange, handleSvgMouseDown]
  );

  // ── Export SVG ─────────────────────────────────────────────

  const exportSvg = useCallback(() => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(svgRef.current);
    svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rink_diagram.svg";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ── Export PNG ─────────────────────────────────────────────

  const exportPng = useCallback(() => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgRef.current);
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new window.Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = dims.w * scale;
      canvas.height = dims.h * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, dims.w, dims.h);
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return;
        const pngUrl = URL.createObjectURL(pngBlob);
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = "rink_diagram.png";
        a.click();
        URL.revokeObjectURL(pngUrl);
      }, "image/png");
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [dims]);

  // ── Get SVG string for saving ──
  const getSvgString = useCallback((): string => {
    if (!svgRef.current) return "";
    const serializer = new XMLSerializer();
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + serializer.serializeToString(svgRef.current);
  }, []);

  // ── Get diagram data ──
  const getDiagramData = useCallback((): RinkDiagramData => {
    return { rinkType, width: dims.w, height: dims.h, elements, version: 1 };
  }, [rinkType, dims, elements]);

  // ── Expose save handler ──
  const handleSave = useCallback(() => {
    if (onSave) {
      onSave(getDiagramData(), getSvgString());
    }
  }, [onSave, getDiagramData, getSvgString]);

  // ── Derived ──
  const selectedElement = elements.find((el) => el.id === selectedId) || null;
  const arrows = elements.filter((el): el is RinkArrow => el.type === "arrow");
  const pucks = elements.filter((el): el is RinkPuck => el.type === "puck");
  const markers = elements.filter((el): el is RinkMarker => el.type === "marker");

  // Cursor style based on tool
  const cursorMap: Record<ToolMode, string> = {
    select: "default",
    marker_X: "crosshair",
    marker_O: "crosshair",
    marker_G: "crosshair",
    marker_C: "crosshair",
    arrow_solid: "crosshair",
    arrow_dashed: "crosshair",
    puck: "crosshair",
    eraser: "pointer",
  };

  return (
    <div className={className}>
      {/* Toolbar */}
      {showToolbar && editable && (
        <div className="mb-3">
          <RinkToolbar
            rinkType={rinkType}
            onRinkTypeChange={handleRinkTypeChange}
            toolMode={toolMode}
            onToolModeChange={setToolMode}
            onClear={handleClear}
            onUndo={handleUndo}
            onExportSvg={exportSvg}
            onExportPng={exportPng}
            canUndo={history.length > 0}
            selectedElement={selectedElement}
            onDeleteSelected={handleDeleteSelected}
          />
        </div>
      )}

      {/* SVG Canvas */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${dims.w} ${dims.h}`}
          className="w-full"
          style={{ cursor: editable ? cursorMap[toolMode] : "default", maxHeight: "70vh" }}
          onMouseDown={handleSvgMouseDown}
          onMouseMove={handleSvgMouseMove}
          onMouseUp={handleSvgMouseUp}
          onMouseLeave={handleSvgMouseUp}
        >
          {/* Prevent text selection inside SVG */}
          <style>{`text { pointer-events: none; user-select: none; }`}</style>

          {/* Layer 1: Rink background */}
          <RinkSvgBackground rinkType={rinkType} width={dims.w} height={dims.h} />

          {/* Layer 2: Arrows */}
          <g>
            {arrows.map((arrow) => (
              <ArrowElement
                key={arrow.id}
                arrow={arrow}
                selected={arrow.id === selectedId}
                onMouseDown={(e) => handleElementMouseDown(arrow, e)}
              />
            ))}
          </g>

          {/* Layer 3: Pucks */}
          <g>
            {pucks.map((puck) => (
              <PuckElement
                key={puck.id}
                puck={puck}
                selected={puck.id === selectedId}
                onMouseDown={(e) => handleElementMouseDown(puck, e)}
              />
            ))}
          </g>

          {/* Layer 4: Markers */}
          <g>
            {markers.map((marker) => (
              <MarkerElement
                key={marker.id}
                marker={marker}
                selected={marker.id === selectedId}
                onMouseDown={(e) => handleElementMouseDown(marker, e)}
              />
            ))}
          </g>

          {/* Layer 5: Arrow preview (drawing in progress) */}
          {arrowStart && mousePos && (
            <line
              x1={arrowStart.x}
              y1={arrowStart.y}
              x2={mousePos.x}
              y2={mousePos.y}
              stroke={toolMode === "arrow_dashed" ? RINK_COLORS.NAVY : RINK_COLORS.TEAL}
              strokeWidth={2}
              strokeDasharray="4,4"
              opacity={0.5}
              style={{ pointerEvents: "none" }}
            />
          )}
        </svg>
      </div>

      {/* Arrow drawing hint */}
      {arrowStart && (
        <p className="text-center text-[10px] text-muted font-oswald uppercase tracking-wider mt-2">
          Click to set arrow end point &middot; Press Escape to cancel
        </p>
      )}

      {/* Save button (if onSave provided) */}
      {onSave && editable && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-teal text-white text-sm font-oswald uppercase tracking-wider rounded-lg hover:bg-teal/90 transition-colors"
          >
            Save Diagram
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

// ============================================================
// ProspectX — Interactive Rink Diagram Canvas
// Pure SVG + React state — zero external dependencies
// Place markers, draw arrows, drag to reposition, export
// ============================================================

import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import RinkSvgBackground from "./RinkSvgBackground";
import { MarkerElement, ArrowElement, PuckElement, PylonElement, NetElement, FreehandLineElement } from "./RinkElements";
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
  type RinkPylon,
  type RinkNet,
  type RinkFreehandLine,
  type ArrowVariant,
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
  if (el.type === "marker" || el.type === "puck" || el.type === "pylon" || el.type === "net") {
    const dx = px - el.x;
    const dy = py - el.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  if (el.type === "freehand") {
    let minDist = Infinity;
    for (let i = 0; i < el.points.length - 1; i++) {
      const p1 = el.points[i], p2 = el.points[i + 1];
      const sdx = p2.x - p1.x, sdy = p2.y - p1.y;
      const lenSq = sdx * sdx + sdy * sdy;
      if (lenSq === 0) { minDist = Math.min(minDist, Math.sqrt((px - p1.x) ** 2 + (py - p1.y) ** 2)); continue; }
      let t = ((px - p1.x) * sdx + (py - p1.y) * sdy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const cx = p1.x + t * sdx, cy = p1.y + t * sdy;
      minDist = Math.min(minDist, Math.sqrt((px - cx) ** 2 + (py - cy) ** 2));
    }
    return minDist;
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

// Chaikin's corner-cutting algorithm for smooth curves
function chaikinSmooth(points: { x: number; y: number }[], iterations = 2): { x: number; y: number }[] {
  if (points.length < 3) return points;
  let result = [...points];
  for (let iter = 0; iter < iterations; iter++) {
    const smoothed: { x: number; y: number }[] = [result[0]];
    for (let i = 0; i < result.length - 1; i++) {
      const p0 = result[i], p1 = result[i + 1];
      smoothed.push({ x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y });
      smoothed.push({ x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y });
    }
    smoothed.push(result[result.length - 1]);
    result = smoothed;
  }
  return result;
}

// Decimate points to avoid huge arrays from fast mouse movement
function decimatePoints(points: { x: number; y: number }[], minDist = 4): { x: number; y: number }[] {
  if (points.length < 2) return points;
  const result = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    const dx = points[i].x - prev.x, dy = points[i].y - prev.y;
    if (dx * dx + dy * dy >= minDist * minDist) {
      result.push(points[i]);
    }
  }
  if (result[result.length - 1] !== points[points.length - 1]) {
    result.push(points[points.length - 1]);
  }
  return result;
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

// ── Imperative ref handle for parent access ──
export interface RinkCanvasHandle {
  getSvgString: () => string;
  getDiagramData: () => RinkDiagramData;
}

// ── Main Component ───────────────────────────────────────────

const RinkCanvas = forwardRef<RinkCanvasHandle, RinkCanvasProps>(function RinkCanvas({
  initialData,
  onChange,
  onSave,
  showToolbar = true,
  editable = true,
  className = "",
}, ref) {
  // ── State ──
  const [rinkType, setRinkType] = useState<RinkType>(initialData?.rinkType || "full");
  const [elements, setElements] = useState<RinkElement[]>(initialData?.elements || []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [arrowStart, setArrowStart] = useState<{ x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [dragState, setDragState] = useState<{ id: string; startX: number; startY: number; elSnapshot: RinkElement } | null>(null);
  const [history, setHistory] = useState<RinkElement[][]>([]);
  const [freehandPoints, setFreehandPoints] = useState<{ x: number; y: number }[]>([]);
  const [isDrawingFreehand, setIsDrawingFreehand] = useState(false);

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
        setIsDrawingFreehand(false);
        setFreehandPoints([]);
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

      // ── Freehand: start drawing ──
      if (toolMode === "freehand") {
        setIsDrawingFreehand(true);
        setFreehandPoints([{ x: pt.x, y: pt.y }]);
        return;
      }

      // ── Place Pylon ──
      if (toolMode === "pylon") {
        pushHistory();
        const pylon: RinkPylon = { id: uid(), type: "pylon", x: pt.x, y: pt.y };
        const next = [...elements, pylon];
        setElements(next);
        notifyChange(next, rinkType);
        return;
      }

      // ── Place Net ──
      if (toolMode === "net") {
        pushHistory();
        const netEl: RinkNet = { id: uid(), type: "net", x: pt.x, y: pt.y };
        const next = [...elements, netEl];
        setElements(next);
        notifyChange(next, rinkType);
        return;
      }

      // ── Arrow: two-click (all arrow variants) ──
      const arrowToolConfig: Record<string, { style: "solid" | "dashed"; color: string; variant: ArrowVariant; strokeWidth?: number }> = {
        arrow_solid:         { style: "solid",  color: RINK_COLORS.TEAL,      variant: "skate" },
        arrow_dashed:        { style: "dashed", color: RINK_COLORS.NAVY,      variant: "pass" },
        arrow_skate_puck:    { style: "solid",  color: RINK_COLORS.TEAL,      variant: "skate_puck" },
        arrow_backward:      { style: "dashed", color: RINK_COLORS.BACKWARD,  variant: "backward" },
        arrow_backward_puck: { style: "dashed", color: RINK_COLORS.BACKWARD,  variant: "backward_puck" },
        arrow_pass:          { style: "dashed", color: RINK_COLORS.PASS_BLUE, variant: "pass" },
        arrow_shot:          { style: "solid",  color: RINK_COLORS.SHOT_RED,  variant: "shot", strokeWidth: 3.5 },
        arrow_lateral:       { style: "solid",  color: RINK_COLORS.TEAL,      variant: "lateral" },
      };
      if (toolMode in arrowToolConfig) {
        const cfg = arrowToolConfig[toolMode];
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
            style: cfg.style,
            color: cfg.color,
            variant: cfg.variant,
            strokeWidth: cfg.strokeWidth,
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

      // Freehand drawing
      if (isDrawingFreehand && toolMode === "freehand") {
        setFreehandPoints((prev) => [...prev, { x: pt.x, y: pt.y }]);
      }

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
            if (el.type === "marker" || el.type === "puck" || el.type === "pylon" || el.type === "net") {
              return { ...el, x: (snap as RinkMarker | RinkPuck | RinkPylon | RinkNet).x + dx, y: (snap as RinkMarker | RinkPuck | RinkPylon | RinkNet).y + dy };
            }
            if (el.type === "arrow") {
              const s = snap as RinkArrow;
              return { ...el, x1: s.x1 + dx, y1: s.y1 + dy, x2: s.x2 + dx, y2: s.y2 + dy };
            }
            if (el.type === "freehand") {
              const s = snap as RinkFreehandLine;
              return { ...el, points: s.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
            }
            return el;
          })
        );
      }
    },
    [arrowStart, dragState, toolMode, isDrawingFreehand]
  );

  const handleSvgMouseUp = useCallback(() => {
    // Finalize freehand line
    if (isDrawingFreehand && freehandPoints.length >= 2) {
      pushHistory();
      const decimated = decimatePoints(freehandPoints);
      const smoothed = chaikinSmooth(decimated, 2);
      const freehand: RinkFreehandLine = {
        id: uid(),
        type: "freehand",
        points: smoothed,
        color: RINK_COLORS.TEAL,
        arrowEnd: true,
      };
      const next = [...elements, freehand];
      setElements(next);
      notifyChange(next, rinkType);
      setIsDrawingFreehand(false);
      setFreehandPoints([]);
      return;
    }
    if (isDrawingFreehand) {
      setIsDrawingFreehand(false);
      setFreehandPoints([]);
    }

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
  }, [dragState, elements, rinkType, notifyChange, isDrawingFreehand, freehandPoints, pushHistory]);

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

  // ── Expose methods to parent via ref ──
  useImperativeHandle(ref, () => ({
    getSvgString,
    getDiagramData,
  }), [getSvgString, getDiagramData]);

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
  const pylons = elements.filter((el): el is RinkPylon => el.type === "pylon");
  const nets = elements.filter((el): el is RinkNet => el.type === "net");
  const freehandLines = elements.filter((el): el is RinkFreehandLine => el.type === "freehand");

  // Cursor style based on tool
  const cursorMap: Record<ToolMode, string> = {
    select: "default",
    marker_X: "crosshair",
    marker_O: "crosshair",
    marker_G: "crosshair",
    marker_C: "crosshair",
    arrow_solid: "crosshair",
    arrow_dashed: "crosshair",
    arrow_skate_puck: "crosshair",
    arrow_backward: "crosshair",
    arrow_backward_puck: "crosshair",
    arrow_pass: "crosshair",
    arrow_shot: "crosshair",
    arrow_lateral: "crosshair",
    puck: "crosshair",
    pylon: "crosshair",
    net: "crosshair",
    freehand: "crosshair",
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
      <div className="bg-white rounded-xl border border-teal/20 overflow-hidden">
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

          {/* Layer 3: Freehand Lines */}
          <g>
            {freehandLines.map((fl) => (
              <FreehandLineElement
                key={fl.id}
                line={fl}
                selected={fl.id === selectedId}
                onMouseDown={(e) => handleElementMouseDown(fl, e)}
              />
            ))}
          </g>

          {/* Layer 4: Pucks */}
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

          {/* Layer 5: Pylons */}
          <g>
            {pylons.map((pylon) => (
              <PylonElement
                key={pylon.id}
                pylon={pylon}
                selected={pylon.id === selectedId}
                onMouseDown={(e) => handleElementMouseDown(pylon, e)}
              />
            ))}
          </g>

          {/* Layer 6: Nets */}
          <g>
            {nets.map((netEl) => (
              <NetElement
                key={netEl.id}
                net={netEl}
                selected={netEl.id === selectedId}
                onMouseDown={(e) => handleElementMouseDown(netEl, e)}
              />
            ))}
          </g>

          {/* Layer 7: Markers */}
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

          {/* Arrow preview (drawing in progress) */}
          {arrowStart && mousePos && (() => {
            const previewColorMap: Record<string, string> = {
              arrow_solid: RINK_COLORS.TEAL,
              arrow_dashed: RINK_COLORS.NAVY,
              arrow_skate_puck: RINK_COLORS.TEAL,
              arrow_backward: RINK_COLORS.BACKWARD,
              arrow_backward_puck: RINK_COLORS.BACKWARD,
              arrow_pass: RINK_COLORS.PASS_BLUE,
              arrow_shot: RINK_COLORS.SHOT_RED,
              arrow_lateral: RINK_COLORS.TEAL,
            };
            return (
              <line
                x1={arrowStart.x}
                y1={arrowStart.y}
                x2={mousePos.x}
                y2={mousePos.y}
                stroke={previewColorMap[toolMode] || RINK_COLORS.TEAL}
                strokeWidth={2}
                strokeDasharray="4,4"
                opacity={0.5}
                style={{ pointerEvents: "none" }}
              />
            );
          })()}

          {/* Freehand preview (drawing in progress) */}
          {isDrawingFreehand && freehandPoints.length >= 2 && (
            <polyline
              points={freehandPoints.map(p => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={RINK_COLORS.TEAL}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.5}
              style={{ pointerEvents: "none" }}
            />
          )}
        </svg>
      </div>

      {/* Drawing hints */}
      {isDrawingFreehand && (
        <p className="text-center text-[10px] text-muted font-oswald uppercase tracking-wider mt-2">
          Drawing... release mouse to finish
        </p>
      )}

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
});

export default RinkCanvas;

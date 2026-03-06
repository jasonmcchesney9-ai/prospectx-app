"use client";

import { useState, useEffect } from "react";
import { Edit3, Save, X, Eye, EyeOff, Lock, Loader2 } from "lucide-react";

interface DevelopmentPlanSectionProps {
  sectionNumber: number;
  title: string;
  content: string;
  isEditing: boolean;
  isStaffOnly: boolean;
  isVisible: boolean;
  canToggleVisibility: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onSave: (content: string) => Promise<void>;
  onCancel: () => void;
  onToggleVisibility: () => void;
}

export default function DevelopmentPlanSection({
  sectionNumber,
  title,
  content,
  isEditing,
  isStaffOnly,
  isVisible,
  canToggleVisibility,
  canEdit,
  onEdit,
  onSave,
  onCancel,
  onToggleVisibility,
}: DevelopmentPlanSectionProps) {
  const [editContent, setEditContent] = useState(content);
  const [saving, setSaving] = useState(false);

  // Sync editContent when switching to edit mode with new content
  useEffect(() => {
    if (isEditing) setEditContent(content);
  }, [isEditing, content]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(editContent);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: "white", borderRadius: 14, overflow: "hidden", position: "relative", borderLeft: "4px solid #0D9488" }}>
      {/* Navy gradient header */}
      <div style={{ background: "linear-gradient(135deg, #0F2942 0%, #1A3F54 100%)", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,.4)" }}>{sectionNumber}.</span>
          <h4 style={{ fontSize: 12, fontWeight: 700, color: "white", fontFamily: "'DM Sans', sans-serif", letterSpacing: ".04em", textTransform: "uppercase" }}>{title}</h4>
          {isStaffOnly && (
            <span className="flex items-center gap-1 text-xs text-teal bg-teal/10 px-2 py-0.5 rounded-full">
              <Lock size={10} /> Internal
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {canToggleVisibility && !isStaffOnly && (
            <button
              onClick={onToggleVisibility}
              className={`p-1 rounded ${isVisible ? "text-teal" : "text-white/30"}`}
              title={isVisible ? "Visible to player/parent" : "Hidden from player/parent"}
            >
              {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          )}
          {canEdit && (
            <>
              {isEditing ? (
                <>
                  <button onClick={handleSave} disabled={saving} className="p-1 text-teal hover:bg-white/10 rounded">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  </button>
                  <button onClick={onCancel} className="p-1 text-white/50 hover:bg-white/10 rounded">
                    <X size={14} />
                  </button>
                </>
              ) : (
                <button onClick={onEdit} className="p-1 text-white/50 hover:bg-white/10 rounded">
                  <Edit3 size={14} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {/* Section body */}
      <div className="px-4 py-3">
        {isEditing ? (
          <>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={8}
              className="w-full text-sm text-navy/80 bg-gray-50 border border-border rounded-lg p-3 outline-none focus:border-teal/40 leading-relaxed resize-y"
              style={{ minHeight: "120px" }}
            />
            <p className="text-xs text-muted/40 mt-1 text-right">{editContent.length} characters</p>
          </>
        ) : content ? (
          <div className="text-sm text-navy/80 leading-relaxed whitespace-pre-wrap">{content}</div>
        ) : (
          <p className="text-sm text-muted/40 italic">Not yet completed</p>
        )}
      </div>
    </div>
  );
}

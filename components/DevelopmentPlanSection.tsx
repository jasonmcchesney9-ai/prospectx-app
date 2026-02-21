"use client";

import { useState } from "react";
import { Edit3, Save, X, Eye, EyeOff, Lock, Loader2 } from "lucide-react";

interface DevelopmentPlanSectionProps {
  sectionNumber: number;
  title: string;
  content: string;
  isEditing: boolean;
  isStaffOnly: boolean;
  isVisible: boolean;
  canToggleVisibility: boolean;
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
  onEdit,
  onSave,
  onCancel,
  onToggleVisibility,
}: DevelopmentPlanSectionProps) {
  const [editContent, setEditContent] = useState(content);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(editContent);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-oswald text-muted">{sectionNumber}.</span>
          <h4 className="text-sm font-semibold text-navy">{title}</h4>
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
              className={`p-1 rounded ${isVisible ? "text-teal" : "text-muted/40"}`}
              title={isVisible ? "Visible to player/parent" : "Hidden from player/parent"}
            >
              {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          )}
          {isEditing ? (
            <>
              <button onClick={handleSave} disabled={saving} className="p-1 text-teal hover:bg-teal/10 rounded">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              </button>
              <button onClick={onCancel} className="p-1 text-muted hover:bg-gray-100 rounded">
                <X size={14} />
              </button>
            </>
          ) : (
            <button onClick={onEdit} className="p-1 text-muted hover:bg-gray-100 rounded">
              <Edit3 size={14} />
            </button>
          )}
        </div>
      </div>
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
        ) : (
          <div className="text-sm text-navy/80 leading-relaxed whitespace-pre-wrap">{content}</div>
        )}
      </div>
    </div>
  );
}

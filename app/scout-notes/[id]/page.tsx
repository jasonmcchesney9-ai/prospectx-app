"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ClipboardCheck, Loader2, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import ScoutNoteForm from "@/components/ScoutNoteForm";
import api from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { ScoutNote } from "@/types/api";

export default function ScoutNoteDetailPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <NoteDetail />
      </main>
    </ProtectedRoute>
  );
}

function NoteDetail() {
  const params = useParams();
  const router = useRouter();
  const noteId = params.id as string;
  const currentUser = getUser();

  const [note, setNote] = useState<ScoutNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchNote = async () => {
      try {
        const { data } = await api.get<ScoutNote>(`/scout-notes/${noteId}`);
        setNote(data);
      } catch {
        setError("Failed to load scout note");
      } finally {
        setLoading(false);
      }
    };
    fetchNote();
  }, [noteId]);

  const handleDelete = async () => {
    if (!confirm("Delete this scout note? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await api.delete(`/notes/${noteId}`);
      router.push("/scout-notes");
    } catch {
      setError("Failed to delete note");
      setDeleting(false);
    }
  };

  const isAuthor = note && currentUser && note.scout_id === currentUser.id;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={32} className="animate-spin text-teal" />
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
        <p className="text-red-700 text-sm mb-4">{error || "Note not found"}</p>
        <Link
          href="/scout-notes"
          className="text-sm text-teal hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft size={14} /> Back to Scout Notes
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link
            href="/scout-notes"
            className="text-xs text-teal hover:underline inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft size={12} /> Back to Scout Notes
          </Link>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <ClipboardCheck size={24} className="text-teal" />
            {isAuthor ? "Edit Scout Note" : "View Scout Note"}
          </h1>
          {note.player_name && (
            <p className="text-muted text-sm mt-1">
              {note.player_name}
              {note.player_team ? ` · ${note.player_team}` : ""}
            </p>
          )}
        </div>
        {isAuthor && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-500 hover:text-red-700 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete
          </button>
        )}
      </div>

      {/* Form (edit mode for author, read-only display could be added later) */}
      <div className="bg-white rounded-xl border border-border p-5">
        {isAuthor ? (
          <ScoutNoteForm existingNote={note} />
        ) : (
          <ReadOnlyNote note={note} />
        )}
      </div>
    </div>
  );
}

// Read-only display for non-author viewers
function ReadOnlyNote({ note }: { note: ScoutNote }) {
  const GRADE_COLORS: Record<number, string> = {
    1: "bg-red-100 text-red-700",
    2: "bg-orange/10 text-orange",
    3: "bg-amber-50 text-amber-700",
    4: "bg-teal/10 text-teal",
    5: "bg-green-100 text-green-700",
  };

  return (
    <div className="space-y-5">
      {/* Game context */}
      {(note.game_date || note.opponent || note.venue) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {note.game_date && (
            <div>
              <p className="text-[10px] font-oswald uppercase tracking-wider text-navy/50 mb-0.5">Date</p>
              <p className="text-sm text-navy">{new Date(note.game_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
            </div>
          )}
          {note.opponent && (
            <div>
              <p className="text-[10px] font-oswald uppercase tracking-wider text-navy/50 mb-0.5">Opponent</p>
              <p className="text-sm text-navy">{note.opponent}</p>
            </div>
          )}
          {note.competition_level && (
            <div>
              <p className="text-[10px] font-oswald uppercase tracking-wider text-navy/50 mb-0.5">Level</p>
              <p className="text-sm text-navy">{note.competition_level}</p>
            </div>
          )}
          {note.venue && (
            <div>
              <p className="text-[10px] font-oswald uppercase tracking-wider text-navy/50 mb-0.5">Venue</p>
              <p className="text-sm text-navy">{note.venue}</p>
            </div>
          )}
        </div>
      )}

      {/* Overall Grade */}
      {note.overall_grade && (
        <div>
          <p className="text-[10px] font-oswald uppercase tracking-wider text-navy/50 mb-1.5">Overall Grade</p>
          <span className={`inline-flex w-12 h-12 rounded-lg items-center justify-center text-lg font-oswald font-bold ${GRADE_COLORS[note.overall_grade] || "bg-navy/5 text-navy"}`}>
            {note.overall_grade}
          </span>
        </div>
      )}

      {/* Ratings */}
      {(note.skating_rating || note.puck_skills_rating || note.hockey_iq_rating || note.compete_rating || note.defense_rating) && (
        <div>
          <p className="text-[10px] font-oswald uppercase tracking-wider text-navy/50 mb-2">Ratings</p>
          <div className="flex flex-wrap gap-3">
            {[
              { label: "Skating", value: note.skating_rating },
              { label: "Puck Skills", value: note.puck_skills_rating },
              { label: "Hockey IQ", value: note.hockey_iq_rating },
              { label: "Compete", value: note.compete_rating },
              { label: "Defense", value: note.defense_rating },
            ].filter((r) => r.value).map((r) => (
              <div key={r.label} className="text-center">
                <p className="text-[9px] font-oswald uppercase tracking-wider text-navy/50 mb-1">{r.label}</p>
                <span className="inline-flex w-10 h-10 rounded-full items-center justify-center text-sm font-oswald font-bold bg-teal/10 text-teal border-2 border-teal/20">
                  {r.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Text sections */}
      {note.strengths_notes && (
        <div>
          <p className="text-[10px] font-oswald uppercase tracking-wider text-navy/50 mb-1">Strengths</p>
          <p className="text-sm text-navy whitespace-pre-wrap">{note.strengths_notes}</p>
        </div>
      )}
      {note.improvements_notes && (
        <div>
          <p className="text-[10px] font-oswald uppercase tracking-wider text-navy/50 mb-1">Areas to Improve</p>
          <p className="text-sm text-navy whitespace-pre-wrap">{note.improvements_notes}</p>
        </div>
      )}
      {note.one_line_summary && (
        <div>
          <p className="text-[10px] font-oswald uppercase tracking-wider text-navy/50 mb-1">Summary</p>
          <p className="text-sm text-navy font-medium">{note.one_line_summary}</p>
        </div>
      )}
      {note.note_text && (
        <div>
          <p className="text-[10px] font-oswald uppercase tracking-wider text-navy/50 mb-1">Additional Notes</p>
          <p className="text-sm text-navy whitespace-pre-wrap">{note.note_text}</p>
        </div>
      )}

      {/* Tags */}
      {note.tags && note.tags.length > 0 && (
        <div>
          <p className="text-[10px] font-oswald uppercase tracking-wider text-navy/50 mb-1.5">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {note.tags.map((tag) => (
              <span key={tag} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-navy/5 text-muted">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="pt-3 border-t border-border/50 flex items-center gap-4 text-[10px] text-muted">
        {note.author_name && <span>By {note.author_name}</span>}
        <span>{new Date(note.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        <span className="px-1.5 py-0.5 rounded bg-navy/5 uppercase font-oswald tracking-wider">
          {note.visibility === "PRIVATE" ? "Private" : "Shared"}
        </span>
      </div>
    </div>
  );
}

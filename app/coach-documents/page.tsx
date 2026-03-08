"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import {
  ClipboardList,
  FileText,
  Presentation,
  BookOpen,
  PenTool,
  Search,
  CalendarCheck,
  Users,
  ExternalLink,
  Download,
} from "lucide-react";

const DOCUMENTS = [
  {
    number: "01",
    title: "LINEUP CARD",
    description: "Game day lines, D-pairs, and special teams deployment",
    file: "/coach-docs/01_Lineup_Card.pdf",
    icon: ClipboardList,
  },
  {
    number: "02",
    title: "GAME NOTES SHEET",
    description: "In-game observations, period-by-period tracking",
    file: "/coach-docs/02_Game_Notes_Sheet.pdf",
    icon: FileText,
  },
  {
    number: "03",
    title: "BENCH CARD",
    description: "One-page condensed command sheet for behind the bench",
    file: "/coach-docs/03_Bench_Card.pdf",
    icon: Presentation,
  },
  {
    number: "04",
    title: "PRACTICE PLAN",
    description: "Session structure, drill sequence, time blocks",
    file: "/coach-docs/04_Practice_Plan_Template.pdf",
    icon: BookOpen,
  },
  {
    number: "05",
    title: "DRILL CARD",
    description: "Individual drill instructions with diagrams",
    file: "/coach-docs/05_Drill_Card.pdf",
    icon: PenTool,
  },
  {
    number: "06",
    title: "SCOUT REPORT",
    description: "Player evaluation form for in-person scouting",
    file: "/coach-docs/06_Scout_Report_Form.pdf",
    icon: Search,
  },
  {
    number: "07",
    title: "ATTENDANCE SHEET",
    description: "Practice and game attendance tracking",
    file: "/coach-docs/07_Attendance_Sheet.pdf",
    icon: CalendarCheck,
  },
  {
    number: "08",
    title: "PLAYER MEETING NOTES",
    description: "One-on-one meeting record and action items",
    file: "/coach-docs/08_Player_Meeting_Notes.pdf",
    icon: Users,
  },
];

export default function CoachDocumentsPage() {
  return (
    <ProtectedRoute>
      <div style={{ minHeight: "100vh", background: "#F0F4F8" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 16px" }}>
          {/* ── Page Header ── */}
          <div style={{ marginBottom: 32 }}>
            <p
              style={{
                fontFamily: "'Oswald', sans-serif",
                fontWeight: 700,
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                color: "#0D9488",
                marginBottom: 4,
              }}
            >
              COACH RESOURCES
            </p>
            <h1
              style={{
                fontFamily: "'Oswald', sans-serif",
                fontWeight: 700,
                fontSize: 28,
                textTransform: "uppercase",
                color: "#0F2942",
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              COACH DOCUMENTS
            </h1>
            <p
              style={{
                fontFamily: "'Source Serif 4', serif",
                fontWeight: 400,
                fontSize: 13,
                color: "#666666",
                marginTop: 6,
              }}
            >
              Printable templates for game day, practice, and player management
            </p>
          </div>

          {/* ── Document Grid ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 20,
            }}
            className="coach-docs-grid"
          >
            {DOCUMENTS.map((doc) => (
              <DocumentCard key={doc.number} doc={doc} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Responsive Grid ── */}
      <style>{`
        .coach-docs-grid {
          grid-template-columns: repeat(4, 1fr) !important;
        }
        @media (max-width: 1024px) {
          .coach-docs-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 640px) {
          .coach-docs-grid {
            grid-template-columns: 1fr !important;
          }
        }
        .coach-doc-card {
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .coach-doc-card:hover {
          transform: translateY(-3px);
          border-color: #0D9488 !important;
          box-shadow: 0 2px 6px rgba(9,28,48,.08), 0 8px 24px rgba(9,28,48,.12) !important;
        }
      `}</style>
    </ProtectedRoute>
  );
}

function DocumentCard({
  doc,
}: {
  doc: (typeof DOCUMENTS)[number];
}) {
  const Icon = doc.icon;
  const filename = doc.file.split("/").pop() || "";

  return (
    <div
      className="coach-doc-card"
      style={{
        background: "#FFFFFF",
        borderRadius: 14,
        border: "1.5px solid #DDE6EF",
        borderLeft: "3px solid #0D9488",
        boxShadow:
          "0 1px 3px rgba(9,28,48,.06), 0 4px 18px rgba(9,28,48,.08)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Navy Band ── */}
      <div
        style={{
          background:
            "linear-gradient(145deg, #071E33 0%, #0F2942 60%, #162E4A 100%)",
          height: 80,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
        }}
      >
        <span
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 700,
            fontSize: 9,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            background: "rgba(13,148,136,.2)",
            color: "#14B8A8",
            padding: "3px 8px",
            borderRadius: 4,
          }}
        >
          {doc.number}
        </span>
        <Icon size={24} color="#FFFFFF" strokeWidth={1.5} />
      </div>

      {/* ── Card Body ── */}
      <div style={{ padding: "16px 16px 12px", flex: 1 }}>
        <h3
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 700,
            fontSize: 14,
            textTransform: "uppercase",
            color: "#0F2942",
            margin: 0,
            lineHeight: 1.3,
            marginBottom: 6,
          }}
        >
          {doc.title}
        </h3>
        <p
          style={{
            fontFamily: "'Source Serif 4', serif",
            fontWeight: 400,
            fontSize: 13,
            color: "#666666",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {doc.description}
        </p>
      </div>

      {/* ── Card Footer ── */}
      <div
        style={{
          padding: "0 16px 16px",
          display: "flex",
          gap: 8,
        }}
      >
        <a
          href={doc.file}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flex: 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            padding: "7px 0",
            borderRadius: 6,
            background: "#0D9488",
            color: "#FFFFFF",
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 700,
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            textDecoration: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          <ExternalLink size={12} />
          Open
        </a>
        <a
          href={doc.file}
          download={filename}
          style={{
            flex: 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            padding: "7px 0",
            borderRadius: 6,
            background: "#FFFFFF",
            color: "#0F2942",
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 700,
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            textDecoration: "none",
            border: "1.5px solid #DDE6EF",
            cursor: "pointer",
          }}
        >
          <Download size={12} />
          Download
        </a>
      </div>
    </div>
  );
}

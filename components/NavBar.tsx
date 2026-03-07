"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import {
  Users,
  Building2,
  ArrowLeftRight,
  TrendingUp,
  FileText,
  Upload,
  BarChart3,
  Trophy,
  LayoutDashboard,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Settings,
  UserPlus,
  ClipboardCheck,
  ClipboardList,
  BookOpen,
  Swords,
  CheckSquare,
  Database,
  Target,
  GraduationCap,
  Shield,
  PenTool,
  Calendar,
  MessageSquare,
  Eye,
  Search,
  Dumbbell,
  AlertTriangle,
  Video,
  Star,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Film,
  WifiOff,
  Zap,
  CreditCard,
  Heart,
} from "lucide-react";
import { getUser, logout } from "@/lib/auth";
import api from "@/lib/api";
import { useBenchTalk } from "./BenchTalkProvider";
import PXIIcon from "./PXIIcon";
import PlayerSearchDropdown from "./PlayerSearchDropdown";
import { useUpload } from "@/contexts/UploadContext";

// ── Role Group Mapping ─────────────────────────────────────────
// Maps hockey_role to a nav group. Each group is an isolated environment.
// PRO = staff (GM/Coach/Scout/Analyst/Admin), MEDIA = broadcaster/producer,
// PLAYER = athlete, FAMILY = parent/guardian, AGENT = player agent
type RoleGroup = "PRO" | "MEDIA" | "PLAYER" | "FAMILY" | "AGENT";

const ROLE_GROUP_MAP: Record<string, RoleGroup> = {
  scout: "PRO",
  coach: "PRO",
  gm: "PRO",
  analyst: "PRO",
  admin: "PRO",
  player: "PLAYER",
  parent: "FAMILY",
  broadcaster: "MEDIA",
  producer: "MEDIA",
  agent: "AGENT",
};

const ROLE_GROUP_COLORS: Record<RoleGroup, string> = {
  PRO: "bg-teal/20 text-teal",
  MEDIA: "bg-orange/20 text-orange",
  PLAYER: "bg-[#3B6B8A]/20 text-[#3B6B8A]",
  FAMILY: "bg-[#3B6B8A]/20 text-[#3B6B8A]",
  AGENT: "bg-[#475569]/20 text-[#475569]",
};

function getRoleGroup(hockeyRole?: string): RoleGroup {
  return ROLE_GROUP_MAP[hockeyRole || "scout"] || "PRO";
}

// ── Nav Item Definitions ──────────────────────────────────────
type NavItem = { href: string; label: string; icon: React.ElementType; badge?: number };

// ── Hub Dropdown Items ──────────────────────────────────────
// Player Hub — consolidated player, scouting, and reports items
const PLAYER_HUB_ITEMS: NavItem[] = [
  { href: "/players", label: "All Players", icon: Users },
  { href: "/leaderboard", label: "PXR Leaderboard", icon: Trophy },
  { href: "/draft-board", label: "Draft Board (PXR)", icon: BarChart3 },
  { href: "/scouting", label: "Scouting List", icon: Target },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/reports/library", label: "Report Library", icon: FileText },
  { href: "/reports/generate", label: "Generate Report", icon: FileText },
  { href: "/reports/custom", label: "Custom Report", icon: PenTool },
  { href: "/scout-notes", label: "Scout Notes", icon: ClipboardCheck },
  { href: "/watchlist", label: "Watchlist", icon: Eye },
  { href: "/top-prospects", label: "Top Prospects", icon: Star },
  { href: "/players/cards", label: "Player Cards", icon: Eye },
  { href: "/players/manage", label: "Manage Players", icon: Settings },
];

// Coach Hub — coaching tools
const COACH_HUB_ITEMS: NavItem[] = [
  { href: "/practice-plans", label: "Practice Plans", icon: ClipboardList },
  { href: "/drills", label: "Drill Library", icon: BookOpen },
  { href: "/skill-development-lab", label: "Skills Lab", icon: Dumbbell },
  { href: "/rink-builder", label: "Rink Builder", icon: PenTool },
  { href: "/coach-documents", label: "Coach Documents", icon: FileText },
  { href: "/glossary", label: "Glossary", icon: GraduationCap },
];

// Game Hub — game day operations
const GAME_HUB_ITEMS: NavItem[] = [
  { href: "/chalk-talk/sessions", label: "Game Plans", icon: Swords },
  { href: "/series", label: "Series Planning", icon: Trophy },
  { href: "/teams", label: "Teams", icon: Building2 },
  { href: "/team-systems", label: "Team Systems", icon: Shield },
];

// Org Hub — org management + imports (PRO only)
const ORG_HUB_ITEMS: NavItem[] = [
  { href: "/org-hub", label: "Org Hub", icon: Building2 },
  { href: "/org-hub/roster-board", label: "Roster Board", icon: Users },
  { href: "/org-hub/trade-board", label: "Trade Board", icon: ArrowLeftRight },
  { href: "/org-hub/draft-board", label: "Draft Board", icon: Trophy },
  { href: "/org-hub/playbook", label: "System Playbook", icon: BookOpen },
  { href: "/org-hub/development", label: "Development Dashboard", icon: TrendingUp },
  { href: "/org-hub/scouting", label: "Scouting Pipeline", icon: Eye },
  { href: "/billing", label: "Billing & Admin", icon: CreditCard },
  { href: "/instat", label: "Import Stats (XLSX)", icon: BarChart3 },
  { href: "/imports", label: "Stat Normalizer", icon: Upload },
  { href: "/players/import", label: "Import Players (CSV)", icon: UserPlus },
  { href: "/corrections", label: "Review Corrections", icon: CheckSquare },
  { href: "/my-data", label: "My Data", icon: Database },
];

// ── Role-aware nav items function ──────────────────────────────
// Returns direct-link items + visibility flags for hub dropdowns
function getNavItems(group: RoleGroup): {
  directLinks: NavItem[];
  showPlayerHub: boolean; showCoachHub: boolean;
  showGameHub: boolean; showOrgHub: boolean;
} {
  const base = {
    showPlayerHub: false, showCoachHub: false,
    showGameHub: false, showOrgHub: false,
  };
  switch (group) {
    case "PRO":
      return {
        ...base,
        directLinks: [
          { href: "/", label: "Dashboard", icon: LayoutDashboard },
        ],
        showPlayerHub: true, showCoachHub: true,
        showGameHub: true, showOrgHub: true,
      };
    case "MEDIA":
      return {
        ...base,
        directLinks: [
          { href: "/", label: "Dashboard", icon: LayoutDashboard },
          { href: "/leagues", label: "League Hub", icon: Trophy },
          { href: "/film", label: "Film Hub", icon: Video },
          { href: "/schedule", label: "Schedule", icon: Calendar },
        ],
        showPlayerHub: true,
      };
    case "PLAYER":
      return {
        ...base,
        directLinks: [
          { href: "/", label: "Dashboard", icon: LayoutDashboard },
          { href: "/leagues", label: "League Hub", icon: Trophy },
          { href: "/film", label: "Film Hub", icon: Video },
          { href: "/schedule", label: "Schedule", icon: Calendar },
          { href: "/messages", label: "Messages", icon: MessageSquare },
        ],
        showPlayerHub: true,
      };
    case "FAMILY":
      return {
        ...base,
        directLinks: [
          { href: "/", label: "Dashboard", icon: LayoutDashboard },
          { href: "/leagues", label: "League Hub", icon: Trophy },
          { href: "/film", label: "Film Hub", icon: Video },
          { href: "/schedule", label: "Schedule", icon: Calendar },
          { href: "/messages", label: "Messages", icon: MessageSquare },
        ],
        showPlayerHub: true,
      };
    case "AGENT":
      return {
        ...base,
        directLinks: [
          { href: "/", label: "Dashboard", icon: LayoutDashboard },
          { href: "/leagues", label: "League Hub", icon: Trophy },
          { href: "/schedule", label: "Schedule", icon: Calendar },
          { href: "/messages", label: "Messages", icon: MessageSquare },
        ],
        showPlayerHub: true,
      };
  }
}

// ── NavLink Component ──────────────────────────────────────────
function NavLink({ href, label, icon: Icon, pathname, badge }: { href: string; label: string; icon: React.ElementType; pathname: string; badge?: number }) {
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
        active
          ? "bg-white/10 text-teal"
          : "hover:bg-white/5 hover:text-white"
      }`}
      style={active ? undefined : { color: "#C8D8E8" }}
    >
      <Icon size={16} />
      {label}
      {badge != null && badge > 0 && (
        <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-teal text-white text-[9px] font-bold leading-none">
          {badge}
        </span>
      )}
    </Link>
  );
}

// ── Role Override Mapping (admin preview → hockey_role equivalent) ───
const ROLE_GROUP_TO_HOCKEY_ROLE: Record<RoleGroup, string> = {
  PRO: "scout",
  PLAYER: "player",
  FAMILY: "parent",
  MEDIA: "broadcaster",
  AGENT: "agent",
};

// ── Main NavBar ────────────────────────────────────────────────
export default function NavBar() {
  const pathname = usePathname();
  const user = getUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [unreadMsgCount, setUnreadMsgCount] = useState<number>(0);
  const { isOpen: benchTalkOpen, toggleBenchTalk, roleOverride, setRoleOverride } = useBenchTalk();

  // Effective role: admin override takes priority, otherwise real role
  const effectiveHockeyRole = roleOverride || user?.hockey_role;
  const roleGroup = getRoleGroup(effectiveHockeyRole);
  const hasMessages = roleGroup === "PRO" || roleGroup === "PLAYER" || roleGroup === "FAMILY" || roleGroup === "AGENT";

  // Fetch unread message count (poll every 30s)
  useEffect(() => {
    if (!hasMessages) return;
    const fetchUnread = () => {
      api.get("/api/messages/unread-count")
        .then((res) => setUnreadMsgCount(res.data?.count || 0))
        .catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [hasMessages]);

  if (pathname === "/login") return null;

  const navConfig = getNavItems(roleGroup);
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const isPreviewing = !!roleOverride;

  // Org co-branding
  const orgPrimary = user?.org_primary_color;
  const orgLogo = user?.org_logo_url;
  const orgShortName = user?.org_short_name;
  const hasOrgBranding = !!orgPrimary && orgPrimary !== "#0D9488"; // Skip default teal

  // Inject unread badge into Messages direct link
  if (hasMessages && unreadMsgCount > 0) {
    navConfig.directLinks = navConfig.directLinks.map((item) =>
      item.href === "/messages" ? { ...item, badge: unreadMsgCount } : item
    );
  }

  return (
    <nav className="bg-navy text-white sticky top-0 z-50" style={hasOrgBranding ? { backgroundColor: orgPrimary } : undefined}>
      {/* Admin Preview Banner */}
      {isPreviewing && (
        <div className="bg-orange/90 text-white px-4 py-1 flex items-center justify-center gap-3 text-xs font-oswald uppercase tracking-wider">
          <Eye size={12} />
          <span>Previewing as: <strong>{roleGroup}</strong></span>
          <button
            onClick={() => setRoleOverride(null)}
            className="ml-2 px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 transition-colors text-[10px] font-bold"
          >
            Exit Preview
          </button>
        </div>
      )}
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16">
          {/* ── Logo (far left) — CSS text for dark nav background ── */}
          <Link href="/" className="flex items-center gap-2 mr-8 shrink-0">
            {orgLogo ? (
              <>
                <img src={orgLogo} alt={orgShortName || "Org"} className="h-8 w-8 object-contain rounded" />
                <span className="hidden lg:inline font-oswald text-xs tracking-wider text-white/60 uppercase">
                  {orgShortName || ""}
                </span>
                <span className="hidden lg:inline text-white/30 mx-1">|</span>
                {/* Small co-branded ProspectX wordmark */}
                <span className="hidden lg:flex flex-col leading-none" style={{ gap: 1 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: "#14B8A6", letterSpacing: "-0.02em", fontFamily: "'DM Sans', sans-serif" }}>PROSPECT</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: "#EA580C", marginLeft: 2, fontFamily: "'DM Sans', sans-serif" }}>X</span>
                  </span>
                  <span style={{ fontSize: 8, fontWeight: 600, color: "rgba(255,255,255,0.28)", letterSpacing: "0.12em", fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase" as const, marginTop: -1 }}>INTELLIGENCE</span>
                </span>
              </>
            ) : (
              <span className="flex flex-col leading-none" style={{ gap: 1 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 0 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "#14B8A6", letterSpacing: "-0.02em", fontFamily: "'DM Sans', sans-serif" }}>PROSPECT</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "#EA580C", marginLeft: 2, fontFamily: "'DM Sans', sans-serif" }}>X</span>
                </span>
                <span style={{ fontSize: 9.5, fontWeight: 600, color: "rgba(255,255,255,0.28)", letterSpacing: "0.12em", fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase" as const, marginTop: -1 }}>INTELLIGENCE</span>
              </span>
            )}
          </Link>

          {/* ── Center Nav — Hub Structure ── */}
          <div className="hidden md:flex items-center gap-1 flex-1 justify-center min-w-0">
            {/* Direct links (Dashboard always first) */}
            {navConfig.directLinks.filter(l => l.label === "Dashboard").map((item) => (
              <NavLink key={item.href} {...item} pathname={pathname} />
            ))}

            {/* Player Hub dropdown */}
            {navConfig.showPlayerHub && <PlayerHubDropdown pathname={pathname} roleGroup={roleGroup} />}

            {/* Coach Hub dropdown (PRO only) */}
            {navConfig.showCoachHub && <CoachHubDropdown pathname={pathname} />}

            {/* Game Hub dropdown (PRO only) */}
            {navConfig.showGameHub && <GameHubDropdown pathname={pathname} />}

            {/* Film Hub — direct link (PRO + PLAYER + FAMILY + MEDIA) */}
            {(roleGroup === "PRO" || roleGroup === "PLAYER" || roleGroup === "FAMILY" || roleGroup === "MEDIA") && (
              <NavLink href="/film" label="Film Hub" icon={Video} pathname={pathname} />
            )}

            {/* Org Hub dropdown (PRO only) */}
            {navConfig.showOrgHub && <OrgHubDropdown pathname={pathname} />}

            {/* League Hub — direct link (all roles except PLAYER) */}
            {roleGroup !== "PLAYER" && (roleGroup === "PRO" || navConfig.directLinks.some(l => l.label === "League Hub")) && (
              <NavLink href="/leagues" label="League Hub" icon={Trophy} pathname={pathname} />
            )}

            {/* Schedule — direct link (PRO + all non-PRO that have it) */}
            {(roleGroup === "PRO" || navConfig.directLinks.some(l => l.label === "Schedule")) && (
              <NavLink href="/schedule" label="Schedule" icon={Calendar} pathname={pathname} />
            )}

            {/* Messages — direct link (PRO + roles that have it) */}
            {(roleGroup === "PRO" || navConfig.directLinks.some(l => l.label === "Messages")) && (
              <NavLink href="/messages" label="Messages" icon={MessageSquare} pathname={pathname} badge={unreadMsgCount > 0 ? unreadMsgCount : undefined} />
            )}
          </div>

          {/* ── User + Role Badge + Tier Badge + Logout (far right) ── */}
          <div className="hidden md:flex items-center gap-3 ml-8 shrink-0">
            {user && (
              <>
                <span className="text-sm text-white/60">
                  {user.first_name} {user.last_name}
                </span>
                {/* Role Group Badge */}
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase font-oswald tracking-wider ${ROLE_GROUP_COLORS[roleGroup]}`}
                >
                  {roleGroup}
                </span>
                {/* Admin Role Switcher */}
                {isAdmin && <AdminRoleSwitcher currentGroup={roleGroup} onSwitch={(group) => setRoleOverride(ROLE_GROUP_TO_HOCKEY_ROLE[group])} onReset={() => setRoleOverride(null)} isPreviewing={isPreviewing} />}
                {/* Subscription Tier Badge */}
                <Link
                  href="/pricing"
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal/20 text-teal uppercase font-oswald tracking-wider hover:bg-teal/30 transition-colors"
                >
                  {user.subscription_tier || "Rookie"}
                </Link>
                {/* Upgrade pill — free tier only */}
                {(!user.subscription_tier || user.subscription_tier === "rookie") && (
                  <Link
                    href="/billing"
                    className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-orange text-white uppercase font-oswald tracking-wider hover:bg-orange/90 transition-colors shadow-sm shadow-orange/30"
                  >
                    Upgrade
                  </Link>
                )}
                {(user.role === "admin" || user.role === "superadmin") && (
                  <Link
                    href="/admin"
                    className={`flex items-center gap-1 text-sm transition-colors ${
                      pathname.startsWith("/admin")
                        ? "text-orange"
                        : "text-orange/70 hover:text-orange"
                    }`}
                  >
                    <Shield size={14} />
                    Admin
                  </Link>
                )}
                {user.role === "superadmin" && (
                  <Link
                    href="/superadmin"
                    className={`flex items-center gap-1 text-sm transition-colors ${
                      pathname.startsWith("/superadmin")
                        ? "text-teal"
                        : "text-teal/70 hover:text-teal"
                    }`}
                  >
                    <Shield size={14} />
                    Super
                  </Link>
                )}
              </>
            )}
            <button
              onClick={logout}
              className="flex items-center gap-1 text-sm text-white/50 hover:text-white transition-colors"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>

          {/* ── Mobile Toggle ── */}
          <div className="flex md:hidden items-center gap-2 ml-auto">
            {/* Role badge (mobile) */}
            {user && (
              <span
                className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase font-oswald tracking-wider ${ROLE_GROUP_COLORS[roleGroup]}`}
              >
                {roleGroup}
              </span>
            )}
            {/* Search icon (mobile) */}
            <button
              onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
              className={`p-2 rounded-lg transition-colors ${
                mobileSearchOpen ? "bg-white/10 text-teal" : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <Search size={18} />
            </button>
            <button
              onClick={toggleBenchTalk}
              className={`p-2 rounded-lg transition-all ${
                benchTalkOpen ? "bg-orange/20" : "hover:bg-orange/10"
              }`}
            >
              <span className="relative inline-flex items-center">
                <img src="/images/pxi-logo.svg" alt="PXI" className="h-5 w-auto" />
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-green-500" />
              </span>
            </button>
            <button
              className="text-white/70 hover:text-white"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Row 2: Action Bar ── */}
      <div className="hidden md:flex items-center h-12 px-4 sm:px-6 lg:px-8 border-t border-white/10 relative">
        {/* Left: Player Search */}
        <div className="flex-1">
          <PlayerSearchDropdown />
        </div>

        {/* Center: Bench Talk (absolute centered) */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <button
            onClick={toggleBenchTalk}
            className={`flex items-center gap-2 px-10 py-1.5 rounded-lg text-sm font-oswald font-bold uppercase tracking-wider transition-colors ${
              benchTalkOpen
                ? "bg-orange/20 text-orange"
                : "text-orange hover:bg-orange/10"
            }`}
          >
            <span className="relative inline-flex items-center">
              <img src="/images/pxi-logo.svg" alt="PXI" className="h-5 w-auto" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-green-500" />
            </span>
            Bench Talk
          </button>
        </div>

        {/* Right: Quick Actions + Upload Indicator */}
        <div className="flex-1 flex justify-end items-center gap-2">
          <UploadIndicator />
          <Link
            href="/scout-notes"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-oswald font-bold uppercase tracking-wider text-teal/70 hover:text-teal hover:bg-teal/10 transition-colors"
          >
            <ClipboardCheck size={14} />
            + New Note
          </Link>
        </div>
      </div>

      {/* ── Mobile Search Bar ── */}
      {mobileSearchOpen && (
        <div className="md:hidden border-t border-white/10 px-4 py-3">
          <PlayerSearchDropdown />
        </div>
      )}

      {/* ── Mobile Menu (hub-structured, role-filtered) ── */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 px-4 pb-4">
          {/* Dashboard — always first */}
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-2 px-3 py-3 text-sm font-medium ${
              pathname === "/" ? "text-teal" : "text-white/70"
            }`}
          >
            <LayoutDashboard size={16} />
            Dashboard
          </Link>

          {/* Player Hub section */}
          {navConfig.showPlayerHub && (
            <div className="border-t border-white/10 mt-1 pt-1">
              <p className="px-3 py-2 text-xs font-oswald uppercase tracking-wider text-white/30">
                {roleGroup === "FAMILY" || roleGroup === "PLAYER" ? "My Player" : "Player Hub"}
              </p>
              {(roleGroup === "FAMILY"
                ? [{ href: "/my-player", label: "My Player", icon: Heart }]
                : roleGroup === "PLAYER" ? [{ href: "/my-player", label: "My Profile", icon: Users }, { href: "/my-player/stats", label: "My Stats", icon: BarChart3 }, { href: "/my-player/reports", label: "My Reports", icon: FileText }, { href: "/my-player/dev-plan", label: "My Dev Plan", icon: TrendingUp }]
                : roleGroup === "AGENT" ? PLAYER_HUB_ITEMS.filter(i => ["/players", "/reports", "/draft-board", "/leaderboard"].includes(i.href))
                : roleGroup === "MEDIA" ? PLAYER_HUB_ITEMS.filter(i => ["/players", "/leaderboard"].includes(i.href))
                : PLAYER_HUB_ITEMS
              ).map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 px-3 py-3 text-sm font-medium ${
                      active ? "text-teal" : "text-white/70"
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Coach Hub section (PRO only) */}
          {navConfig.showCoachHub && (
            <div className="border-t border-white/10 mt-1 pt-1">
              <p className="px-3 py-2 text-xs font-oswald uppercase tracking-wider text-white/30">
                Coach Hub
              </p>
              {COACH_HUB_ITEMS.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 px-3 py-3 text-sm font-medium ${
                      active ? "text-teal" : "text-white/70"
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Game Hub section (PRO only) */}
          {navConfig.showGameHub && (
            <div className="border-t border-white/10 mt-1 pt-1">
              <p className="px-3 py-2 text-xs font-oswald uppercase tracking-wider text-white/30">
                Game Hub
              </p>
              {GAME_HUB_ITEMS.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 px-3 py-3 text-sm font-medium ${
                      active ? "text-teal" : "text-white/70"
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Film Hub — direct link */}
          {(roleGroup === "PRO" || roleGroup === "PLAYER" || roleGroup === "FAMILY" || roleGroup === "MEDIA") && (
            <div className="border-t border-white/10 mt-1 pt-1">
              <Link
                href="/film"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 px-3 py-3 text-sm font-medium ${
                  pathname.startsWith("/film") ? "text-teal" : "text-white/70"
                }`}
              >
                <Video size={16} />
                Film Hub
              </Link>
            </div>
          )}

          {/* Org Hub section (PRO only) */}
          {navConfig.showOrgHub && (
            <div className="border-t border-white/10 mt-1 pt-1">
              <p className="px-3 py-2 text-xs font-oswald uppercase tracking-wider text-white/30">
                Org Hub
              </p>
              {ORG_HUB_ITEMS.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href) || pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 px-3 py-3 text-sm font-medium ${
                      active ? "text-teal" : "text-white/70"
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                );
              })}
            </div>
          )}

          {/* League Hub — direct link (not for PLAYER) */}
          {roleGroup !== "PLAYER" && (
          <div className="border-t border-white/10 mt-1 pt-1">
            <Link
              href="/leagues"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2 px-3 py-3 text-sm font-medium ${
                pathname.startsWith("/leagues") ? "text-teal" : "text-white/70"
              }`}
            >
              <Trophy size={16} />
              League Hub
            </Link>
          </div>
          )}

          {/* Schedule — direct link */}
          <div className="border-t border-white/10 mt-1 pt-1">
            <Link
              href="/schedule"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2 px-3 py-3 text-sm font-medium ${
                pathname.startsWith("/schedule") ? "text-teal" : "text-white/70"
              }`}
            >
              <Calendar size={16} />
              Schedule
            </Link>
          </div>

          {/* Messages — direct link (PRO + roles with messaging) */}
          {(roleGroup === "PRO" || roleGroup === "PLAYER" || roleGroup === "FAMILY" || roleGroup === "AGENT") && (
            <div className="border-t border-white/10 mt-1 pt-1">
              <Link
                href="/messages"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 px-3 py-3 text-sm font-medium ${
                  pathname.startsWith("/messages") ? "text-teal" : "text-white/70"
                }`}
              >
                <MessageSquare size={16} />
                Messages
                {unreadMsgCount > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-teal text-white text-[9px] font-bold leading-none">
                    {unreadMsgCount}
                  </span>
                )}
              </Link>
            </div>
          )}

          {/* Admin (all roles if admin) */}
          {user?.role === "admin" && (
            <div className="border-t border-white/10 mt-1 pt-1">
              <Link
                href="/admin"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 px-3 py-3 text-sm font-medium ${
                  pathname.startsWith("/admin") ? "text-orange" : "text-orange/70"
                }`}
              >
                <Shield size={16} />
                Admin Dashboard
              </Link>
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-3 text-sm text-white/50 hover:text-white w-full"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}

// ── Upload Indicator (nav bar pill + dropdown) ────────────────

function formatUploadBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatUploadEta(seconds: number): string {
  if (seconds < 1) return "finishing...";
  if (seconds < 60) return `~${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `~${m}m ${s}s`;
}

function UploadIndicator() {
  const { upload, actions } = useUpload();
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Auto-clear "ready" after 15 seconds
  useEffect(() => {
    if (upload.phase !== "ready" || !upload.completedAt) return;
    const timeout = setTimeout(() => {
      // Don't auto-clear — keep the "Create Session" link visible
      // User must click it or dismiss manually
    }, 15000);
    return () => clearTimeout(timeout);
  }, [upload.phase, upload.completedAt]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setExpanded(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (upload.phase === "idle") return null;

  const isCompressing = upload.phase === "compressing";
  const isUploading = upload.phase === "uploading";
  const isPaused = upload.phase === "paused";
  const isProcessing = upload.phase === "processing";
  const isReady = upload.phase === "ready";
  const isError = upload.phase === "error";

  // Pill colors
  const pillBg = isReady
    ? "rgba(13,148,136,0.25)"
    : isError
    ? "rgba(239,68,68,0.25)"
    : isPaused
    ? "rgba(234,88,12,0.2)"
    : isCompressing
    ? "rgba(59,130,246,0.15)"
    : "rgba(13,148,136,0.15)";
  const pillColor = isReady ? "#10B981" : isError ? "#EF4444" : isPaused ? "#EA580C" : isCompressing ? "#3B82F6" : "#14B8A6";
  const pillBorder = isReady
    ? "1.5px solid rgba(16,185,129,0.4)"
    : isError
    ? "1.5px solid rgba(239,68,68,0.4)"
    : isPaused
    ? "1.5px solid rgba(234,88,12,0.4)"
    : isCompressing
    ? "1.5px solid rgba(59,130,246,0.3)"
    : "1.5px solid rgba(13,148,136,0.3)";

  // Truncate filename
  const shortName = upload.fileName.length > 20
    ? upload.fileName.slice(0, 17) + "..."
    : upload.fileName;

  return (
    <div ref={ref} className="relative">
      {/* ── Pill ── */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-colors"
        style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: pillBg, color: pillColor, border: pillBorder }}
      >
        {isCompressing && (
          <>
            <Zap size={10} />
            <span>Compressing {upload.compressionProgress}%</span>
          </>
        )}
        {isUploading && (
          <>
            <Upload size={10} />
            <span>{upload.progress}%</span>
            <span className="hidden lg:inline max-w-[100px] truncate">{shortName}</span>
          </>
        )}
        {isPaused && (
          <>
            <WifiOff size={10} />
            <span>Paused</span>
            <span className="hidden lg:inline">{upload.progress}%</span>
          </>
        )}
        {isProcessing && (
          <>
            <Loader2 size={10} className="animate-spin" />
            <span>Processing</span>
          </>
        )}
        {isReady && (
          <>
            <CheckCircle2 size={10} />
            <span>Upload Complete</span>
          </>
        )}
        {isError && (
          <>
            <AlertTriangle size={10} />
            <span>Upload Failed</span>
          </>
        )}
      </button>

      {/* ── Expanded Dropdown ── */}
      {expanded && (
        <div
          className="absolute right-0 top-full mt-2 w-72 rounded-xl shadow-xl z-50 overflow-hidden"
          style={{ border: "1.5px solid #DDE6EF", background: "#FFFFFF" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "#0F2942" }}>
            <span className="font-bold uppercase text-white" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}>
              Video Upload
            </span>
            <button onClick={() => setExpanded(false)} className="text-white/50 hover:text-white transition-colors">
              <X size={12} />
            </button>
          </div>

          <div className="px-4 py-3 space-y-3">
            {/* File name */}
            <div>
              <p className="text-[10px] font-bold uppercase mb-0.5" style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#8BA4BB" }}>File</p>
              <p className="text-xs truncate" style={{ color: "#0F2942" }}>{upload.fileName}</p>
            </div>

            {/* Compression progress bar */}
            {isCompressing && (
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-sm font-bold font-oswald" style={{ color: "#0F2942" }}>{upload.compressionProgress}%</span>
                  <span className="text-[10px] uppercase" style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#3B82F6" }}>
                    Optimizing Video
                  </span>
                </div>
                <div className="w-full rounded-full h-2" style={{ background: "#DDE6EF" }}>
                  <div
                    className="h-2 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${upload.compressionProgress}%`, background: "#3B82F6" }}
                  />
                </div>
                <p className="text-[10px] mt-1" style={{ fontFamily: "ui-monospace, monospace", color: "#8BA4BB" }}>
                  {formatUploadBytes(upload.originalSize)} → compressing...
                </p>
              </div>
            )}

            {/* Progress bar (uploading / paused / processing) */}
            {(isUploading || isPaused || isProcessing) && (
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-sm font-bold font-oswald" style={{ color: "#0F2942" }}>{upload.progress}%</span>
                  <span className="text-[10px] uppercase" style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: isPaused ? "#EA580C" : isProcessing ? "#EA580C" : "#0D9488" }}>
                    {isPaused ? "Paused — Offline" : isProcessing ? "Processing with Mux" : "Uploading"}
                  </span>
                </div>
                <div className="w-full rounded-full h-2" style={{ background: "#DDE6EF" }}>
                  <div
                    className="h-2 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${upload.progress}%`, background: isPaused ? "#EA580C" : isProcessing ? "#EA580C" : "#0D9488" }}
                  />
                </div>
                {/* Show compression savings if file was compressed */}
                {upload.compressedSize > 0 && isUploading && (
                  <p className="text-[10px] mt-1" style={{ fontFamily: "ui-monospace, monospace", color: "#3B82F6" }}>
                    Compressed: {formatUploadBytes(upload.originalSize)} → {formatUploadBytes(upload.compressedSize)} ({Math.round((1 - upload.compressedSize / upload.originalSize) * 100)}% smaller)
                  </p>
                )}
              </div>
            )}

            {/* Compression skipped warning */}
            {upload.compressionSkipped && (isUploading || isPaused) && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
                <AlertTriangle size={12} style={{ color: "#F59E0B" }} className="shrink-0" />
                <p className="text-[10px] leading-tight" style={{ color: "#92400E" }}>
                  Video optimization was skipped — uploading original file. This may take longer.
                </p>
              </div>
            )}

            {/* Paused message */}
            {isPaused && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(234,88,12,0.06)", border: "1px solid rgba(234,88,12,0.15)" }}>
                <WifiOff size={12} style={{ color: "#EA580C" }} />
                <div>
                  <p className="text-[11px] font-medium" style={{ color: "#EA580C" }}>Waiting for connection...</p>
                  <p className="text-[10px]" style={{ color: "#8BA4BB" }}>Upload will resume automatically when back online.</p>
                </div>
              </div>
            )}

            {/* Speed + ETA + Bytes (uploading only) */}
            {isUploading && (
              <div className="flex items-center justify-between">
                <span className="text-[10px]" style={{ fontFamily: "ui-monospace, monospace", color: "#8BA4BB" }}>
                  {formatUploadBytes(upload.bytesUploaded)} / {formatUploadBytes(upload.bytesTotal)}
                </span>
                <span className="text-[10px]" style={{ fontFamily: "ui-monospace, monospace", color: "#0D9488" }}>
                  {upload.speed > 0 ? `${formatUploadBytes(upload.speed)}/s` : ""}
                  {upload.speed > 0 && upload.eta > 0 ? ` · ${formatUploadEta(upload.eta)}` : ""}
                </span>
              </div>
            )}

            {/* Ready state */}
            {isReady && (
              <div className="text-center py-1">
                <p className="text-xs font-medium" style={{ color: "#10B981" }}>Video is ready!</p>
                <Link
                  href={`/film/sessions/new?upload=${upload.uploadId}`}
                  onClick={() => { setExpanded(false); actions.clearUpload(); }}
                  className="inline-flex items-center gap-1.5 mt-2 px-4 py-1.5 rounded-lg text-xs font-bold uppercase text-white transition-colors hover:opacity-90"
                  style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "#0D9488" }}
                >
                  <Film size={11} />
                  Create Session
                </Link>
              </div>
            )}

            {/* Error state */}
            {isError && (
              <div className="text-center py-1">
                <p className="text-[11px]" style={{ color: "#EF4444" }}>{upload.error}</p>
                <button
                  onClick={() => { setExpanded(false); actions.retryUpload(); }}
                  className="inline-flex items-center gap-1.5 mt-2 px-4 py-1.5 rounded-lg text-xs font-bold uppercase text-white transition-colors hover:opacity-90"
                  style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "#EA580C" }}
                >
                  <RefreshCw size={11} />
                  Retry
                </button>
              </div>
            )}

            {/* Cancel / Dismiss */}
            <div className="flex justify-end pt-1 border-t" style={{ borderColor: "#DDE6EF" }}>
              {(isCompressing || isUploading || isPaused || isProcessing) ? (
                <button
                  onClick={() => { setExpanded(false); actions.cancelUpload(); }}
                  className="text-[10px] font-bold uppercase transition-colors hover:opacity-70"
                  style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#EF4444" }}
                >
                  Cancel Upload
                </button>
              ) : (
                <button
                  onClick={() => { setExpanded(false); actions.clearUpload(); }}
                  className="text-[10px] font-bold uppercase transition-colors hover:opacity-70"
                  style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, color: "#8BA4BB" }}
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Hub Dropdown Components ────────────────────────────────────

function PlayerHubDropdown({ pathname, roleGroup }: { pathname: string; roleGroup: RoleGroup }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Filter items by role
  const items = roleGroup === "PRO" ? PLAYER_HUB_ITEMS
    : roleGroup === "PLAYER" ? [{ href: "/my-player", label: "My Profile", icon: Users }, { href: "/my-player/stats", label: "My Stats", icon: BarChart3 }, { href: "/my-player/reports", label: "My Reports", icon: FileText }, { href: "/my-player/dev-plan", label: "My Dev Plan", icon: TrendingUp }]
    : roleGroup === "AGENT" ? PLAYER_HUB_ITEMS.filter(i => ["/players", "/reports", "/draft-board", "/leaderboard"].includes(i.href))
    : roleGroup === "MEDIA" ? PLAYER_HUB_ITEMS.filter(i => ["/players", "/leaderboard"].includes(i.href))
    : roleGroup === "FAMILY" ? [{ href: "/my-player", label: "My Player", icon: Heart }]
    : PLAYER_HUB_ITEMS;

  const isActive = items.some((item) => pathname.startsWith(item.href));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
          isActive
            ? "bg-white/10 text-teal"
            : "hover:bg-white/5 hover:text-white"
        }`}
        style={isActive ? undefined : { color: "#C8D8E8" }}
      >
        <Users size={16} />
        {roleGroup === "FAMILY" || roleGroup === "PLAYER" ? "My Player" : "Player Hub"}
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 mt-1 w-56 bg-navy-light border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 px-4 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white/10 text-teal"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CoachHubDropdown({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isActive = COACH_HUB_ITEMS.some((item) => pathname.startsWith(item.href));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
          isActive
            ? "bg-white/10 text-teal"
            : "hover:bg-white/5 hover:text-white"
        }`}
        style={isActive ? undefined : { color: "#C8D8E8" }}
      >
        <ClipboardList size={16} />
        Coach Hub
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 mt-1 w-56 bg-navy-light border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
          {COACH_HUB_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 px-4 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white/10 text-teal"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GameHubDropdown({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isActive = GAME_HUB_ITEMS.some((item) => pathname.startsWith(item.href));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
          isActive
            ? "bg-white/10 text-teal"
            : "hover:bg-white/5 hover:text-white"
        }`}
        style={isActive ? undefined : { color: "#C8D8E8" }}
      >
        <Swords size={16} />
        Game Hub
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 mt-1 w-56 bg-navy-light border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
          {GAME_HUB_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 px-4 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white/10 text-teal"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OrgHubDropdown({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isActive = ORG_HUB_ITEMS.some((item) => pathname.startsWith(item.href));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
          isActive
            ? "bg-white/10 text-teal"
            : "hover:bg-white/5 hover:text-white"
        }`}
        style={isActive ? undefined : { color: "#C8D8E8" }}
      >
        <Building2 size={16} />
        Org Hub
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 mt-1 w-64 bg-navy-light border border-white/10 rounded-lg shadow-xl overflow-hidden z-50 max-h-[70vh] overflow-y-auto">
          {ORG_HUB_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href) || pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 px-4 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white/10 text-teal"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AdminRoleSwitcher({ currentGroup, onSwitch, onReset, isPreviewing }: { currentGroup: RoleGroup; onSwitch: (group: RoleGroup) => void; onReset: () => void; isPreviewing: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const groups: { group: RoleGroup; label: string; desc: string }[] = [
    { group: "PRO", label: "PRO", desc: "Scout / Coach / GM" },
    { group: "PLAYER", label: "PLAYER", desc: "Athlete" },
    { group: "FAMILY", label: "FAMILY", desc: "Parent" },
    { group: "MEDIA", label: "MEDIA", desc: "Broadcaster" },
    { group: "AGENT", label: "AGENT", desc: "Agent" },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-oswald uppercase tracking-wider transition-colors ${
          isPreviewing
            ? "bg-orange/20 text-orange"
            : "text-white/40 hover:text-white/70 hover:bg-white/5"
        }`}
        title="Preview as different role"
      >
        <Eye size={10} />
        Preview
        <ChevronDown size={9} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-navy-light border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
          <div className="px-3 py-2 border-b border-white/10">
            <p className="text-[9px] font-oswald uppercase tracking-wider text-white/30">Preview as role</p>
          </div>
          {groups.map(({ group, label, desc }) => (
            <button
              key={group}
              onClick={() => {
                onSwitch(group);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                currentGroup === group
                  ? "bg-white/10 text-teal"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <div>
                <span className={`text-[9px] font-oswald font-bold uppercase tracking-wider ${ROLE_GROUP_COLORS[group]} px-1.5 py-0.5 rounded-full`}>
                  {label}
                </span>
                <span className="text-[10px] text-white/40 ml-2">{desc}</span>
              </div>
              {currentGroup === group && <span className="text-teal text-xs">✓</span>}
            </button>
          ))}
          {isPreviewing && (
            <button
              onClick={() => { onReset(); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs text-orange hover:bg-white/5 border-t border-white/10 font-medium"
            >
              ← Back to my role
            </button>
          )}
        </div>
      )}
    </div>
  );
}


"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import {
  Users,
  Building2,
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
  Radio,
  Calendar,
  UserCheck,
  Heart,
  Briefcase,
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
  Wifi,
  Zap,
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

// PRO nav: full access — most items now in dropdowns
const PRO_NAV_LEFT: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leagues", label: "Leagues", icon: Trophy },
  { href: "/schedule", label: "Schedule", icon: Calendar },
];
const PRO_NAV_RIGHT: NavItem[] = [
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

// MEDIA nav — isolated broadcaster environment (Table 12 in spec)
const MEDIA_NAV_LEFT: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leagues", label: "Leagues", icon: Trophy },
  { href: "/players", label: "Players", icon: Users },
  { href: "/teams", label: "Teams", icon: Building2 },
  { href: "/broadcast", label: "Broadcast Hub", icon: Radio },
];
const MEDIA_NAV_RIGHT: NavItem[] = [
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/schedule", label: "Schedule", icon: Calendar },
];

// PLAYER nav — athlete's isolated environment (Table 13 in spec)
// TODO: When linked_player_id is added to User type + login response,
// update Dev Plan hrefs to `/players/${user.linked_player_id}?tab=player`
// for direct dev plan access.
const PLAYER_NAV_LEFT: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/my-profile", label: "My Profile", icon: UserCheck },
  { href: "/leagues", label: "Leagues", icon: Trophy },
  { href: "/players", label: "Dev Plan", icon: BookOpen },
  { href: "/film", label: "Film", icon: Video },
];
const PLAYER_NAV_RIGHT: NavItem[] = [
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/schedule", label: "Schedule", icon: Calendar },
];

// FAMILY nav — parent/guardian environment (Table 14 in spec)
const FAMILY_NAV_LEFT: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/my-player", label: "My Player", icon: Heart },
  { href: "/leagues", label: "Leagues", icon: Trophy },
  { href: "/players", label: "Dev Plan", icon: BookOpen },
  { href: "/film", label: "Film", icon: Video },
];
const FAMILY_NAV_RIGHT: NavItem[] = [
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/schedule", label: "Schedule", icon: Calendar },
];

// AGENT nav — agent's isolated environment (Table 15 in spec)
const AGENT_NAV_LEFT: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leagues", label: "Leagues", icon: Trophy },
  { href: "/my-clients", label: "My Clients", icon: Briefcase },
  { href: "/reports", label: "Reports", icon: FileText },
];
const AGENT_NAV_RIGHT: NavItem[] = [
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/schedule", label: "Schedule", icon: Calendar },
];

// Players dropdown items (PRO only)
const PLAYERS_DROPDOWN_ITEMS: NavItem[] = [
  { href: "/players", label: "All Players", icon: Users },
  { href: "/players/manage", label: "Manage Players", icon: Settings },
  { href: "/scouting", label: "Scouting List", icon: Target },
  { href: "/players/cards", label: "Player Cards", icon: Eye },
  { href: "/leaderboard", label: "PXR Leaderboard", icon: Trophy },
  { href: "/draft-board", label: "Draft Board (PXR)", icon: BarChart3 },
];

// Scouting dropdown items (PRO only)
const SCOUTING_DROPDOWN_ITEMS: NavItem[] = [
  { href: "/scout-notes", label: "Scout Notes", icon: ClipboardCheck },
  { href: "/watchlist", label: "Watchlist", icon: Eye },
  { href: "/top-prospects", label: "Top Prospects", icon: Star },
];

// Reports dropdown items (PRO only)
const REPORTS_DROPDOWN_ITEMS: NavItem[] = [
  { href: "/reports", label: "Generated Reports", icon: FileText },
  { href: "/reports/library", label: "Report Library", icon: BookOpen },
  { href: "/reports/custom", label: "Custom Report", icon: PenTool },
  { href: "/reports/generate", label: "Generate Report", icon: FileText },
];

// Teams dropdown items (PRO only)
const TEAMS_DROPDOWN_ITEMS: NavItem[] = [
  { href: "/teams", label: "All Teams", icon: Building2 },
  { href: "/chalk-talk/sessions?scroll=series", label: "Series Plans", icon: Trophy },
  { href: "/team-systems", label: "Team Systems", icon: Shield },
];

// Coaching items (PRO only — spec Table 11)
const COACHING_ITEMS: NavItem[] = [
  { href: "/drills", label: "Drill Library", icon: BookOpen },
  { href: "/skill-development-lab", label: "Skills Library", icon: Dumbbell },
  { href: "/rink-builder", label: "Rink Builder", icon: PenTool },
  { href: "/practice-plans", label: "Practice Plans", icon: ClipboardList },
  { href: "/glossary", label: "Hockey Glossary", icon: GraduationCap },
];

// Org Hub items (PRO only — spec Table 11)
const ORG_HUB_ITEMS: NavItem[] = [
  { href: "/film", label: "Film Room", icon: Video },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/whiteboards", label: "Whiteboard", icon: PenTool },
];

// Broadcast items (PRO dropdown — MEDIA gets a direct link)
const BROADCAST_ITEMS: NavItem[] = [
  { href: "/broadcast", label: "Broadcast Hub", icon: Radio },
];

// Import items (PRO only)
const IMPORT_ITEMS: NavItem[] = [
  { href: "/instat", label: "Import Stats (XLSX)", icon: BarChart3 },
  { href: "/imports", label: "Stat Normalizer", icon: Upload },
  { href: "/players/import", label: "Import Players (CSV)", icon: UserPlus },
  { href: "/corrections", label: "Review Corrections", icon: CheckSquare },
  { href: "/my-data", label: "My Data", icon: Database },
];

// ── Role-aware nav items function ──────────────────────────────
function getNavItems(group: RoleGroup, hockeyRole?: string): {
  left: NavItem[]; right: NavItem[];
  showPlayersDropdown: boolean; showScoutingDropdown: boolean;
  showReportsDropdown: boolean; showCoaching: boolean;
  showImports: boolean; showBroadcastDropdown: boolean;
  showTeamsDropdown: boolean; showOrgHub: boolean;
} {
  const base = {
    showPlayersDropdown: false, showScoutingDropdown: false,
    showReportsDropdown: false, showCoaching: false,
    showImports: false, showBroadcastDropdown: false,
    showTeamsDropdown: false, showOrgHub: false,
  };
  switch (group) {
    case "PRO": {
      // Coach doesn't see Imports dropdown (spec Table 11 note)
      const canImport = hockeyRole !== "coach";
      return { ...base, left: PRO_NAV_LEFT, right: PRO_NAV_RIGHT,
        showPlayersDropdown: true, showScoutingDropdown: true,
        showReportsDropdown: true, showCoaching: true,
        showImports: canImport, showBroadcastDropdown: true,
        showTeamsDropdown: true, showOrgHub: true };
    }
    case "MEDIA":
      return { ...base, left: MEDIA_NAV_LEFT, right: MEDIA_NAV_RIGHT };
    case "PLAYER":
      return { ...base, left: PLAYER_NAV_LEFT, right: PLAYER_NAV_RIGHT };
    case "FAMILY":
      return { ...base, left: FAMILY_NAV_LEFT, right: FAMILY_NAV_RIGHT };
    case "AGENT":
      return { ...base, left: AGENT_NAV_LEFT, right: AGENT_NAV_RIGHT };
  }
}

// ── NavLink Component ──────────────────────────────────────────
function NavLink({ href, label, icon: Icon, pathname, badge }: { href: string; label: string; icon: React.ElementType; pathname: string; badge?: number }) {
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        active
          ? "bg-white/10 text-teal"
          : "text-white/70 hover:bg-white/5 hover:text-white"
      }`}
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
  const router = useRouter();
  const user = getUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [agentClientCount, setAgentClientCount] = useState<number>(0);
  const [unreadMsgCount, setUnreadMsgCount] = useState<number>(0);
  const { isOpen: benchTalkOpen, toggleBenchTalk, roleOverride, setRoleOverride } = useBenchTalk();

  /* Game Plans nav — always go to hub */
  const handleGamePlansNav = (e: React.MouseEvent) => {
    e.preventDefault();
    setMobileOpen(false);
    router.push("/chalk-talk/sessions");
  };

  // Effective role: admin override takes priority, otherwise real role
  const effectiveHockeyRole = roleOverride || user?.hockey_role;
  const roleGroup = getRoleGroup(effectiveHockeyRole);
  const isAgent = roleGroup === "AGENT";
  const hasMessages = roleGroup === "MEDIA" || roleGroup === "PLAYER" || roleGroup === "FAMILY" || roleGroup === "AGENT";

  // Fetch client count for agent badge
  useEffect(() => {
    if (!isAgent) return;
    api.get("/agent/clients")
      .then((res) => setAgentClientCount(Array.isArray(res.data) ? res.data.length : 0))
      .catch(() => {});
  }, [isAgent]);

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

  const navConfig = getNavItems(roleGroup, effectiveHockeyRole);
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const isPreviewing = !!roleOverride;

  // Org co-branding
  const orgPrimary = user?.org_primary_color;
  const orgLogo = user?.org_logo_url;
  const orgShortName = user?.org_short_name;
  const hasOrgBranding = !!orgPrimary && orgPrimary !== "#0D9488"; // Skip default teal

  // Inject badge into agent Clients nav item
  if (isAgent && agentClientCount > 0) {
    navConfig.left = navConfig.left.map((item) =>
      item.href === "/my-clients" ? { ...item, badge: agentClientCount } : item
    );
  }

  // Inject unread badge into Messages nav item
  if (hasMessages && unreadMsgCount > 0) {
    const injectBadge = (items: NavItem[]) =>
      items.map((item) =>
        item.href === "/messages" ? { ...item, badge: unreadMsgCount } : item
      );
    navConfig.left = injectBadge(navConfig.left);
    navConfig.right = injectBadge(navConfig.right);
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
          {/* ── Logo (far left) ── */}
          <Link href="/" className="flex items-center gap-2 mr-8 shrink-0">
            {orgLogo ? (
              <>
                <img src={orgLogo} alt={orgShortName || "Org"} className="h-8 w-8 object-contain rounded" />
                <span className="hidden lg:inline font-oswald text-xs tracking-wider text-white/60 uppercase">
                  {orgShortName || ""}
                </span>
                <span className="hidden lg:inline text-white/30 mx-1">|</span>
                <span className="font-oswald text-xs font-bold tracking-widest uppercase text-white/60">
                  <span className="text-teal">P</span><span className="text-orange">X</span>
                </span>
              </>
            ) : (
              <>
                <span className="font-oswald text-lg font-bold tracking-widest uppercase">
                  <span className="text-teal">Prospect</span><span className="text-orange">X</span>
                </span>
                <span className="hidden lg:inline font-oswald text-xs tracking-wider text-white/60 uppercase">
                  Intelligence
                </span>
              </>
            )}
          </Link>

          {/* ── Center Nav ── */}
          <div className="hidden md:flex items-center gap-1 flex-1 justify-center min-w-0">
            {navConfig.left.map((item) => (
              <NavLink key={item.href} {...item} pathname={pathname} />
            ))}

            {/* Players dropdown (PRO only) */}
            {navConfig.showPlayersDropdown && <PlayersDropdown pathname={pathname} />}

            {/* Scouting dropdown (PRO only) */}
            {navConfig.showScoutingDropdown && <ScoutingDropdown pathname={pathname} />}

            {/* Reports dropdown (PRO only) */}
            {navConfig.showReportsDropdown && <ReportsDropdown pathname={pathname} />}

            {/* Teams dropdown (PRO only) */}
            {navConfig.showTeamsDropdown && <TeamsDropdown pathname={pathname} />}

            {/* Coaching dropdown (PRO only) */}
            {navConfig.showCoaching && <CoachingDropdown pathname={pathname} />}

            {/* Game Plans — top-level (PRO only) */}
            {navConfig.showCoaching && (
              <button
                onClick={handleGamePlansNav}
                title="Game Plans"
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                  pathname.startsWith("/chalk-talk")
                    ? "bg-white/10 text-teal"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Swords size={16} className="shrink-0" />
                <span className="hidden xl:inline">Game Plans</span>
              </button>
            )}

            {/* Broadcast dropdown (PRO only — MEDIA gets direct link via MEDIA_NAV_LEFT) */}
            {navConfig.showBroadcastDropdown && <BroadcastDropdown pathname={pathname} />}

            {/* Imports dropdown (PRO only) */}
            {navConfig.showImports && <ImportDropdown pathname={pathname} />}

            {/* Org Hub dropdown (PRO only) */}
            {navConfig.showOrgHub && <OrgHubDropdown pathname={pathname} />}

            {navConfig.right.map((item) => (
              <NavLink key={item.href} {...item} pathname={pathname} />
            ))}
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

      {/* ── Mobile Menu (role-filtered) ── */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 px-4 pb-4">
          {[...navConfig.left, ...navConfig.right].map(({ href, label, icon: Icon, badge }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
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
                {badge != null && badge > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-teal text-white text-[9px] font-bold leading-none">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}

          {/* Players section (PRO only — mobile) */}
          {navConfig.showPlayersDropdown && (
            <div className="border-t border-white/10 mt-1 pt-1">
              <p className="px-3 py-2 text-xs font-oswald uppercase tracking-wider text-white/30">
                Players
              </p>
              {PLAYERS_DROPDOWN_ITEMS.map(({ href, label, icon: Icon }) => {
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

          {/* Scouting section (PRO only — mobile) */}
          {navConfig.showScoutingDropdown && (
            <div className="border-t border-white/10 mt-1 pt-1">
              <p className="px-3 py-2 text-xs font-oswald uppercase tracking-wider text-white/30">
                Scouting
              </p>
              {SCOUTING_DROPDOWN_ITEMS.map(({ href, label, icon: Icon }) => {
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

          {/* Reports section (PRO only — mobile) */}
          {navConfig.showReportsDropdown && (
            <div className="border-t border-white/10 mt-1 pt-1">
              <p className="px-3 py-2 text-xs font-oswald uppercase tracking-wider text-white/30">
                Reports
              </p>
              {REPORTS_DROPDOWN_ITEMS.map(({ href, label, icon: Icon }) => {
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

          {/* Teams section (PRO only — mobile) */}
          {navConfig.showTeamsDropdown && (
            <div className="border-t border-white/10 mt-1 pt-1">
              <p className="px-3 py-2 text-xs font-oswald uppercase tracking-wider text-white/30">
                Teams
              </p>
              {TEAMS_DROPDOWN_ITEMS.map(({ href, label, icon: Icon }) => {
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

          {/* Game Plans — top-level (PRO only — mobile) */}
          {navConfig.showCoaching && (
            <div className="border-t border-white/10 mt-1 pt-1">
              <Link
                href="/chalk-talk/sessions"
                onClick={handleGamePlansNav}
                className={`flex items-center gap-2 px-3 py-3 text-sm font-medium ${
                  pathname.startsWith("/chalk-talk") ? "text-teal" : "text-white/70"
                }`}
              >
                <Swords size={16} />
                Game Plans
              </Link>
            </div>
          )}

          {/* Coaching section (PRO only) */}
          {navConfig.showCoaching && (
            <div className="border-t border-white/10 mt-1 pt-1">
              <p className="px-3 py-2 text-xs font-oswald uppercase tracking-wider text-white/30">
                Coaching
              </p>
              {COACHING_ITEMS.map(({ href, label, icon: Icon }) => {
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

          {/* Broadcast section (PRO mobile) */}
          {navConfig.showBroadcastDropdown && (
            <div className="border-t border-white/10 mt-1 pt-1">
              <p className="px-3 py-2 text-xs font-oswald uppercase tracking-wider text-white/30">
                Broadcast
              </p>
              {BROADCAST_ITEMS.map(({ href, label, icon: Icon }) => {
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

          {/* Org Hub section (PRO only — mobile) */}
          {navConfig.showOrgHub && (
            <div className="border-t border-white/10 mt-1 pt-1">
              <p className="px-3 py-2 text-xs font-oswald uppercase tracking-wider text-white/30">
                Org Hub
              </p>
              {ORG_HUB_ITEMS.map(({ href, label, icon: Icon }) => {
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

          {/* Import & Manage section (PRO only) */}
          {navConfig.showImports && (
            <div className="border-t border-white/10 mt-1 pt-1">
              <p className="px-3 py-2 text-xs font-oswald uppercase tracking-wider text-white/30">
                Import & Manage
              </p>
              {IMPORT_ITEMS.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
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

// ── Dropdown Components ────────────────────────────────────────

function PlayersDropdown({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isActive = PLAYERS_DROPDOWN_ITEMS.some((item) => pathname.startsWith(item.href));

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
        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? "bg-white/10 text-teal"
            : "text-white/70 hover:bg-white/5 hover:text-white"
        }`}
      >
        <Users size={16} />
        Players
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-navy-light border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
          {PLAYERS_DROPDOWN_ITEMS.map(({ href, label, icon: Icon }) => {
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

function ScoutingDropdown({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isActive = SCOUTING_DROPDOWN_ITEMS.some((item) => pathname.startsWith(item.href));

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
        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? "bg-white/10 text-teal"
            : "text-white/70 hover:bg-white/5 hover:text-white"
        }`}
      >
        <ClipboardCheck size={16} />
        Scouting
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-navy-light border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
          {SCOUTING_DROPDOWN_ITEMS.map(({ href, label, icon: Icon }) => {
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

function ReportsDropdown({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isActive = REPORTS_DROPDOWN_ITEMS.some((item) => pathname.startsWith(item.href));

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
        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? "bg-white/10 text-teal"
            : "text-white/70 hover:bg-white/5 hover:text-white"
        }`}
      >
        <FileText size={16} />
        Reports
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-navy-light border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
          {REPORTS_DROPDOWN_ITEMS.map(({ href, label, icon: Icon }) => {
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

function TeamsDropdown({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isActive = TEAMS_DROPDOWN_ITEMS.some((item) => pathname.startsWith(item.href));

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
        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? "bg-white/10 text-teal"
            : "text-white/70 hover:bg-white/5 hover:text-white"
        }`}
      >
        <Building2 size={16} />
        Teams
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-navy-light border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
          {TEAMS_DROPDOWN_ITEMS.map(({ href, label, icon: Icon }) => {
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

function CoachingDropdown({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const isActive = COACHING_ITEMS.some((item) => pathname.startsWith(item.href));

  /* Smart nav: skip list page for single-session coaches */
  const handleGamePlansClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    try {
      const { data } = await api.get("/chalk-talk-sessions?limit=2");
      const sessions = Array.isArray(data) ? data : [];
      if (sessions.length === 0) {
        router.push("/chalk-talk/new");
      } else if (sessions.length === 1) {
        router.push(`/chalk-talk/sessions/${sessions[0].id}`);
      } else {
        router.push("/chalk-talk/sessions");
      }
    } catch {
      router.push("/chalk-talk/sessions");
    }
  };

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
        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? "bg-white/10 text-teal"
            : "text-white/70 hover:bg-white/5 hover:text-white"
        }`}
      >
        <ClipboardList size={16} />
        Coaching
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-navy-light border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
          {COACHING_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            const isGamePlans = href === "/chalk-talk/sessions";
            return (
              <Link
                key={href}
                href={href}
                onClick={isGamePlans ? handleGamePlansClick : () => setOpen(false)}
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

function BroadcastDropdown({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isActive = pathname.startsWith("/broadcast");

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
        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? "bg-white/10 text-teal"
            : "text-white/70 hover:bg-white/5 hover:text-white"
        }`}
      >
        <Radio size={16} />
        Broadcast
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-navy-light border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
          {BROADCAST_ITEMS.map(({ href, label, icon: Icon }) => {
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
        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? "bg-white/10 text-teal"
            : "text-white/70 hover:bg-white/5 hover:text-white"
        }`}
      >
        <Video size={16} />
        Org Hub
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-navy-light border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
          {ORG_HUB_ITEMS.map(({ href, label, icon: Icon }) => {
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

function ImportDropdown({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isActive = IMPORT_ITEMS.some((item) => pathname === item.href);

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
        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? "bg-white/10 text-teal"
            : "text-white/70 hover:bg-white/5 hover:text-white"
        }`}
      >
        <Upload size={16} />
        Imports
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-navy-light border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
          {IMPORT_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
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

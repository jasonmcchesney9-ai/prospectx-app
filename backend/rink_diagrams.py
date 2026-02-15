"""
SVG Hockey Rink Diagram Generator for ProspectX Drill Library.

Generates clean hockey rink diagrams showing player positions and movement
patterns. Zero external dependencies — pure Python string building.

Brand colors:
  Navy: #0F2A3D  |  Teal: #18B3A6  |  Orange: #F36F21
"""

# ── SVG Primitives ──────────────────────────────────────────

NAVY = "#0F2A3D"
TEAL = "#18B3A6"
ORANGE = "#F36F21"
ICE = "#F0F8FF"
RED_LINE = "#CC0000"
BLUE_LINE = "#0055AA"
CREASE_FILL = "#B8D4E8"
BOARD_STROKE = NAVY
CIRCLE_COLOR = RED_LINE


def _marker(x: int, y: int, mtype: str, label: str = "") -> str:
    """Player marker: X=offense(teal), O=defense(navy), G=goalie(orange), C=cone(gray)."""
    r = 14
    colors = {"X": TEAL, "O": NAVY, "G": ORANGE, "C": "#888888"}
    fill = colors.get(mtype, TEAL)
    parts = [
        f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" stroke="white" stroke-width="1.5"/>',
        f'<text x="{x}" y="{y + 1}" text-anchor="middle" dominant-baseline="central" '
        f'font-family="sans-serif" font-size="11" font-weight="bold" fill="white">{mtype}</text>',
    ]
    if label:
        parts.append(
            f'<text x="{x}" y="{y + r + 12}" text-anchor="middle" '
            f'font-family="sans-serif" font-size="9" fill="{NAVY}" opacity="0.6">{label}</text>'
        )
    return "\n".join(parts)


def _arrow(x1: int, y1: int, x2: int, y2: int, style: str = "solid", color: str = NAVY) -> str:
    """Arrow: solid=player movement, dashed=puck/pass."""
    dash = ' stroke-dasharray="6,4"' if style == "dashed" else ""
    mid = f"arrow_{x1}_{y1}_{x2}_{y2}"
    return (
        f'<defs><marker id="{mid}" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">'
        f'<polygon points="0 0, 8 3, 0 6" fill="{color}"/></marker></defs>'
        f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" '
        f'stroke-width="2"{dash} marker-end="url(#{mid})" opacity="0.7"/>'
    )


def _puck(x: int, y: int) -> str:
    return f'<circle cx="{x}" cy="{y}" r="5" fill="#111" stroke="white" stroke-width="1"/>'


# ── Rink Templates ──────────────────────────────────────────

def _full_rink(w: int = 600, h: int = 280) -> str:
    """Full ice rink — horizontal orientation."""
    cx, cy = w // 2, h // 2
    cr = 20  # corner radius for boards
    return f"""
    <!-- Ice surface -->
    <rect x="2" y="2" width="{w - 4}" height="{h - 4}" rx="{cr}" ry="{cr}" fill="{ICE}" stroke="{BOARD_STROKE}" stroke-width="2.5"/>
    <!-- Center red line -->
    <line x1="{cx}" y1="2" x2="{cx}" y2="{h - 2}" stroke="{RED_LINE}" stroke-width="2.5"/>
    <!-- Blue lines -->
    <line x1="{int(w * 0.33)}" y1="2" x2="{int(w * 0.33)}" y2="{h - 2}" stroke="{BLUE_LINE}" stroke-width="2"/>
    <line x1="{int(w * 0.67)}" y1="2" x2="{int(w * 0.67)}" y2="{h - 2}" stroke="{BLUE_LINE}" stroke-width="2"/>
    <!-- Center circle -->
    <circle cx="{cx}" cy="{cy}" r="30" fill="none" stroke="{CIRCLE_COLOR}" stroke-width="1.5"/>
    <circle cx="{cx}" cy="{cy}" r="3" fill="{CIRCLE_COLOR}"/>
    <!-- Face-off dots -->
    <circle cx="{int(w * 0.22)}" cy="{int(h * 0.32)}" r="3" fill="{CIRCLE_COLOR}"/>
    <circle cx="{int(w * 0.22)}" cy="{int(h * 0.68)}" r="3" fill="{CIRCLE_COLOR}"/>
    <circle cx="{int(w * 0.78)}" cy="{int(h * 0.32)}" r="3" fill="{CIRCLE_COLOR}"/>
    <circle cx="{int(w * 0.78)}" cy="{int(h * 0.68)}" r="3" fill="{CIRCLE_COLOR}"/>
    <!-- Face-off circles (end zones) -->
    <circle cx="{int(w * 0.17)}" cy="{int(h * 0.35)}" r="25" fill="none" stroke="{CIRCLE_COLOR}" stroke-width="1" opacity="0.5"/>
    <circle cx="{int(w * 0.17)}" cy="{int(h * 0.65)}" r="25" fill="none" stroke="{CIRCLE_COLOR}" stroke-width="1" opacity="0.5"/>
    <circle cx="{int(w * 0.83)}" cy="{int(h * 0.35)}" r="25" fill="none" stroke="{CIRCLE_COLOR}" stroke-width="1" opacity="0.5"/>
    <circle cx="{int(w * 0.83)}" cy="{int(h * 0.65)}" r="25" fill="none" stroke="{CIRCLE_COLOR}" stroke-width="1" opacity="0.5"/>
    <!-- Goal creases -->
    <path d="M 30 {cy - 15} Q 50 {cy - 22} 50 {cy} Q 50 {cy + 22} 30 {cy + 15}" fill="{CREASE_FILL}" fill-opacity="0.5" stroke="{BLUE_LINE}" stroke-width="1"/>
    <path d="M {w - 30} {cy - 15} Q {w - 50} {cy - 22} {w - 50} {cy} Q {w - 50} {cy + 22} {w - 30} {cy + 15}" fill="{CREASE_FILL}" fill-opacity="0.5" stroke="{BLUE_LINE}" stroke-width="1"/>
    <!-- Nets -->
    <rect x="4" y="{cy - 10}" width="12" height="20" rx="2" fill="none" stroke="{NAVY}" stroke-width="1.5" opacity="0.6"/>
    <rect x="{w - 16}" y="{cy - 10}" width="12" height="20" rx="2" fill="none" stroke="{NAVY}" stroke-width="1.5" opacity="0.6"/>
    """


def _half_rink(w: int = 380, h: int = 300) -> str:
    """Half ice — one end zone + neutral zone. Attack goes left to right."""
    cx = w - 40  # net on the right side
    cy = h // 2
    cr = 20
    return f"""
    <!-- Ice surface -->
    <rect x="2" y="2" width="{w - 4}" height="{h - 4}" rx="{cr}" ry="{cr}" fill="{ICE}" stroke="{BOARD_STROKE}" stroke-width="2.5"/>
    <!-- Blue line -->
    <line x1="{int(w * 0.35)}" y1="2" x2="{int(w * 0.35)}" y2="{h - 2}" stroke="{BLUE_LINE}" stroke-width="2"/>
    <!-- Face-off circles -->
    <circle cx="{int(w * 0.62)}" cy="{int(h * 0.32)}" r="25" fill="none" stroke="{CIRCLE_COLOR}" stroke-width="1" opacity="0.5"/>
    <circle cx="{int(w * 0.62)}" cy="{int(h * 0.68)}" r="25" fill="none" stroke="{CIRCLE_COLOR}" stroke-width="1" opacity="0.5"/>
    <!-- Face-off dots -->
    <circle cx="{int(w * 0.62)}" cy="{int(h * 0.32)}" r="3" fill="{CIRCLE_COLOR}"/>
    <circle cx="{int(w * 0.62)}" cy="{int(h * 0.68)}" r="3" fill="{CIRCLE_COLOR}"/>
    <!-- Goal crease -->
    <path d="M {cx} {cy - 18} Q {cx - 25} {cy - 25} {cx - 25} {cy} Q {cx - 25} {cy + 25} {cx} {cy + 18}" fill="{CREASE_FILL}" fill-opacity="0.5" stroke="{BLUE_LINE}" stroke-width="1"/>
    <!-- Net -->
    <rect x="{cx}" y="{cy - 12}" width="14" height="24" rx="2" fill="none" stroke="{NAVY}" stroke-width="1.5" opacity="0.6"/>
    """


def _quarter_rink(w: int = 320, h: int = 300) -> str:
    """Quarter ice — one corner zone (top-right quadrant)."""
    cy = h // 2
    cr = 20
    return f"""
    <!-- Ice surface -->
    <rect x="2" y="2" width="{w - 4}" height="{h - 4}" rx="{cr}" ry="{cr}" fill="{ICE}" stroke="{BOARD_STROKE}" stroke-width="2.5"/>
    <!-- Face-off circle -->
    <circle cx="{int(w * 0.45)}" cy="{int(h * 0.45)}" r="28" fill="none" stroke="{CIRCLE_COLOR}" stroke-width="1" opacity="0.5"/>
    <circle cx="{int(w * 0.45)}" cy="{int(h * 0.45)}" r="3" fill="{CIRCLE_COLOR}"/>
    <!-- Goal crease -->
    <path d="M {w - 30} {cy - 18} Q {w - 55} {cy - 25} {w - 55} {cy} Q {w - 55} {cy + 25} {w - 30} {cy + 18}" fill="{CREASE_FILL}" fill-opacity="0.5" stroke="{BLUE_LINE}" stroke-width="1"/>
    <!-- Net -->
    <rect x="{w - 16}" y="{cy - 12}" width="14" height="24" rx="2" fill="none" stroke="{NAVY}" stroke-width="1.5" opacity="0.6"/>
    """


# ── Drill Layout Database ───────────────────────────────────
# Each layout: rink type, players list, arrows, pucks

DRILL_LAYOUTS = {
    # ── Specific concept_id layouts ──

    "2on1_rush": {
        "rink": "full", "w": 600, "h": 280,
        "players": [
            (120, 100, "X", "F1"), (120, 180, "X", "F2"),
            (420, 140, "O", "D"), (570, 140, "G", "G"),
        ],
        "arrows": [
            (135, 100, 400, 110, "solid", TEAL),
            (135, 180, 400, 170, "solid", TEAL),
            (200, 105, 200, 170, "dashed", NAVY),
        ],
        "pucks": [(125, 100)],
    },

    "3on2_continuous": {
        "rink": "full", "w": 600, "h": 280,
        "players": [
            (100, 60, "X", "LW"), (100, 140, "X", "C"), (100, 220, "X", "RW"),
            (380, 100, "O", "D1"), (380, 180, "O", "D2"), (570, 140, "G", "G"),
        ],
        "arrows": [
            (115, 60, 360, 90, "solid", TEAL),
            (115, 140, 360, 140, "solid", TEAL),
            (115, 220, 360, 190, "solid", TEAL),
            (160, 140, 160, 80, "dashed", NAVY),
        ],
        "pucks": [(105, 140)],
    },

    "pp_umbrella": {
        "rink": "half", "w": 380, "h": 300,
        "players": [
            (60, 150, "X", "QB"), (170, 60, "X", "Flank"), (170, 240, "X", "Flank"),
            (230, 150, "X", "Bumper"), (300, 150, "X", "Net"),
        ],
        "arrows": [
            (75, 150, 155, 65, "dashed", TEAL),
            (75, 150, 155, 235, "dashed", TEAL),
            (170, 75, 215, 150, "dashed", TEAL),
            (170, 225, 215, 155, "dashed", TEAL),
        ],
        "pucks": [(60, 145)],
    },

    "pp_131_setup": {
        "rink": "half", "w": 380, "h": 300,
        "players": [
            (60, 150, "X", "QB"), (170, 60, "X", "Flank"), (170, 240, "X", "Flank"),
            (230, 150, "X", "Bumper"), (310, 150, "X", "Net"),
        ],
        "arrows": [
            (75, 150, 155, 65, "dashed", TEAL),
            (170, 75, 215, 145, "dashed", TEAL),
            (215, 150, 295, 150, "dashed", TEAL),
        ],
        "pucks": [(60, 145)],
    },

    "pp_overload": {
        "rink": "half", "w": 380, "h": 300,
        "players": [
            (80, 80, "X", "Point"), (170, 60, "X", "Wall"), (260, 80, "X", "Slot"),
            (280, 180, "X", "Low"), (120, 240, "X", "Weak"),
        ],
        "arrows": [
            (90, 85, 155, 65, "dashed", TEAL),
            (175, 70, 250, 85, "dashed", TEAL),
            (260, 95, 275, 165, "dashed", TEAL),
        ],
        "pucks": [(170, 55)],
    },

    "pk_diamond": {
        "rink": "half", "w": 380, "h": 300,
        "players": [
            (100, 150, "O", "High"), (200, 80, "O", "R"), (200, 220, "O", "L"),
            (280, 150, "O", "Low"),
        ],
        "arrows": [
            (115, 150, 180, 90, "solid", NAVY),
            (115, 150, 180, 210, "solid", NAVY),
        ],
        "pucks": [],
    },

    "pk_box": {
        "rink": "half", "w": 380, "h": 300,
        "players": [
            (140, 90, "O", "F1"), (140, 210, "O", "F2"),
            (250, 90, "O", "D1"), (250, 210, "O", "D2"),
        ],
        "arrows": [
            (155, 95, 235, 95, "solid", NAVY),
            (155, 205, 235, 205, "solid", NAVY),
        ],
        "pucks": [],
    },

    "breakout_regroup": {
        "rink": "full", "w": 600, "h": 280,
        "players": [
            (50, 140, "O", "D1"), (80, 80, "O", "D2"),
            (140, 50, "X", "LW"), (180, 140, "X", "C"), (140, 230, "X", "RW"),
        ],
        "arrows": [
            (65, 135, 125, 55, "dashed", TEAL),
            (150, 50, 300, 50, "solid", TEAL),
            (195, 140, 300, 140, "solid", TEAL),
            (150, 230, 300, 230, "solid", TEAL),
        ],
        "pucks": [(50, 135)],
    },

    "cycle_low": {
        "rink": "half", "w": 380, "h": 300,
        "players": [
            (300, 230, "X", "F1"), (200, 260, "X", "F2"), (160, 100, "X", "F3"),
        ],
        "arrows": [
            (290, 225, 215, 255, "solid", TEAL),
            (200, 245, 165, 115, "dashed", TEAL),
            (165, 105, 280, 160, "solid", TEAL),
        ],
        "pucks": [(300, 235)],
    },

    "gap_control_1on1": {
        "rink": "full", "w": 600, "h": 280,
        "players": [
            (200, 140, "X", "F"), (380, 140, "O", "D"), (570, 140, "G", "G"),
        ],
        "arrows": [
            (215, 140, 365, 140, "solid", TEAL),
        ],
        "pucks": [(200, 135)],
    },

    "forecheck_roles_122": {
        "rink": "full", "w": 600, "h": 280,
        "players": [
            (420, 140, "X", "F1"), (350, 80, "X", "F2"), (300, 140, "X", "F3"),
            (480, 100, "O", "D1"), (480, 180, "O", "D2"),
        ],
        "arrows": [
            (435, 140, 465, 110, "solid", TEAL),
            (360, 85, 460, 95, "solid", TEAL),
        ],
        "pucks": [(480, 95)],
    },

    "nz_trap_131": {
        "rink": "full", "w": 600, "h": 280,
        "players": [
            (240, 140, "O", "F1"), (300, 60, "O", ""), (300, 140, "O", ""), (300, 220, "O", ""),
            (380, 140, "O", "Safety"),
        ],
        "arrows": [],
        "pucks": [],
    },

    "quick_release_slot": {
        "rink": "quarter", "w": 320, "h": 300,
        "players": [
            (150, 150, "X", ""), (290, 150, "G", "G"),
        ],
        "arrows": [
            (165, 150, 260, 150, "dashed", TEAL),
        ],
        "pucks": [(150, 145)],
    },

    "one_timer_setup": {
        "rink": "quarter", "w": 320, "h": 300,
        "players": [
            (80, 140, "X", "Pass"), (180, 100, "X", "Shoot"), (290, 150, "G", "G"),
        ],
        "arrows": [
            (95, 140, 165, 105, "dashed", TEAL),
            (195, 100, 260, 140, "dashed", ORANGE),
        ],
        "pucks": [(80, 135)],
    },

    "net_front_presence": {
        "rink": "quarter", "w": 320, "h": 300,
        "players": [
            (60, 80, "O", "Point"), (230, 150, "X", "Net"), (290, 150, "G", "G"),
        ],
        "arrows": [
            (75, 85, 215, 145, "dashed", TEAL),
        ],
        "pucks": [(60, 75)],
    },

    "screen_and_tip": {
        "rink": "quarter", "w": 320, "h": 300,
        "players": [
            (80, 60, "O", "Point"), (220, 150, "X", "Screen"), (290, 150, "G", "G"),
        ],
        "arrows": [
            (95, 65, 260, 145, "dashed", NAVY),
        ],
        "pucks": [(80, 55)],
    },

    "goalie_t_push": {
        "rink": "quarter", "w": 320, "h": 300,
        "players": [
            (260, 120, "G", ""), (260, 180, "G", ""),
        ],
        "arrows": [
            (260, 135, 260, 165, "solid", ORANGE),
            (260, 165, 260, 135, "solid", ORANGE),
        ],
        "pucks": [],
    },

    "goalie_angle_play": {
        "rink": "quarter", "w": 320, "h": 300,
        "players": [
            (80, 80, "X", ""), (80, 220, "X", ""), (180, 150, "X", ""),
            (250, 150, "G", "G"),
        ],
        "arrows": [
            (95, 85, 235, 145, "dashed", TEAL),
            (95, 215, 235, 155, "dashed", TEAL),
            (195, 150, 235, 150, "dashed", TEAL),
        ],
        "pucks": [],
    },

    "shark_minnows": {
        "rink": "full", "w": 600, "h": 280,
        "players": [
            (300, 140, "O", "Shark"),
            (60, 60, "X", ""), (60, 110, "X", ""), (60, 170, "X", ""), (60, 220, "X", ""),
        ],
        "arrows": [
            (75, 60, 500, 60, "solid", TEAL),
            (75, 110, 500, 110, "solid", TEAL),
            (75, 170, 500, 170, "solid", TEAL),
            (75, 220, 500, 220, "solid", TEAL),
        ],
        "pucks": [],
    },

    "3v3_cross_ice": {
        "rink": "quarter", "w": 320, "h": 300,
        "players": [
            (80, 100, "X", ""), (120, 180, "X", ""), (80, 250, "X", ""),
            (230, 100, "O", ""), (200, 180, "O", ""), (230, 250, "O", ""),
        ],
        "arrows": [],
        "pucks": [(150, 150)],
    },

    "dz_box_coverage": {
        "rink": "half", "w": 380, "h": 300,
        "players": [
            (140, 90, "O", "D1"), (140, 210, "O", "D2"),
            (240, 90, "O", "D3"), (240, 210, "O", "D4"),
            (190, 150, "O", "+1"),
        ],
        "arrows": [],
        "pucks": [],
    },

    "pp_zone_entry": {
        "rink": "full", "w": 600, "h": 280,
        "players": [
            (250, 140, "X", "Carry"), (200, 80, "X", "Trail"),
            (250, 60, "X", "LW"), (250, 220, "X", "RW"),
            (380, 100, "O", "PK"), (380, 180, "O", "PK"),
        ],
        "arrows": [
            (265, 140, 400, 140, "solid", TEAL),
            (255, 135, 215, 90, "dashed", TEAL),
        ],
        "pucks": [(250, 135)],
    },

    # ── Category fallback layouts ──

    "_category_warm_up": {
        "rink": "full", "w": 600, "h": 280,
        "players": [
            (60, 60, "X", ""), (60, 140, "X", ""), (60, 220, "X", ""),
        ],
        "arrows": [
            (75, 60, 530, 60, "solid", TEAL),
            (75, 140, 530, 140, "solid", TEAL),
            (75, 220, 530, 220, "solid", TEAL),
        ],
        "pucks": [],
    },

    "_category_skating": {
        "rink": "full", "w": 600, "h": 280,
        "players": [
            (60, 140, "X", ""),
        ],
        "arrows": [
            (75, 140, 200, 80, "solid", TEAL),
            (200, 80, 300, 200, "solid", TEAL),
            (300, 200, 400, 80, "solid", TEAL),
            (400, 80, 530, 140, "solid", TEAL),
        ],
        "pucks": [],
    },

    "_category_passing": {
        "rink": "half", "w": 380, "h": 300,
        "players": [
            (80, 100, "X", ""), (200, 100, "X", ""),
            (80, 200, "X", ""), (200, 200, "X", ""),
        ],
        "arrows": [
            (95, 100, 185, 100, "dashed", TEAL),
            (200, 115, 95, 195, "dashed", TEAL),
            (95, 200, 185, 200, "dashed", TEAL),
        ],
        "pucks": [(80, 95)],
    },

    "_category_shooting": {
        "rink": "quarter", "w": 320, "h": 300,
        "players": [
            (100, 100, "X", ""), (100, 200, "X", ""),
            (280, 150, "G", "G"),
        ],
        "arrows": [
            (115, 100, 255, 140, "dashed", ORANGE),
            (115, 200, 255, 160, "dashed", ORANGE),
        ],
        "pucks": [(100, 95), (100, 195)],
    },

    "_category_offensive": {
        "rink": "half", "w": 380, "h": 300,
        "players": [
            (80, 60, "X", "LW"), (140, 140, "X", "C"), (80, 240, "X", "RW"),
            (340, 150, "G", "G"),
        ],
        "arrows": [
            (95, 65, 270, 90, "solid", TEAL),
            (155, 140, 280, 140, "solid", TEAL),
            (95, 235, 270, 210, "solid", TEAL),
        ],
        "pucks": [(140, 135)],
    },

    "_category_defensive": {
        "rink": "half", "w": 380, "h": 300,
        "players": [
            (250, 100, "O", "D1"), (250, 200, "O", "D2"),
            (120, 100, "X", "F"), (120, 200, "X", "F"),
            (340, 150, "G", "G"),
        ],
        "arrows": [
            (235, 100, 140, 100, "solid", NAVY),
            (235, 200, 140, 200, "solid", NAVY),
        ],
        "pucks": [(120, 95)],
    },

    "_category_goalie": {
        "rink": "quarter", "w": 320, "h": 300,
        "players": [
            (260, 150, "G", "G"),
            (80, 80, "X", ""), (80, 220, "X", ""),
        ],
        "arrows": [
            (95, 85, 240, 140, "dashed", TEAL),
            (95, 215, 240, 160, "dashed", TEAL),
        ],
        "pucks": [],
    },

    "_category_transition": {
        "rink": "full", "w": 600, "h": 280,
        "players": [
            (50, 140, "O", "D"), (200, 60, "X", "LW"), (200, 140, "X", "C"), (200, 220, "X", "RW"),
        ],
        "arrows": [
            (65, 140, 185, 65, "dashed", TEAL),
            (210, 60, 500, 60, "solid", TEAL),
            (210, 140, 500, 140, "solid", TEAL),
            (210, 220, 500, 220, "solid", TEAL),
        ],
        "pucks": [(50, 135)],
    },

    "_category_special_teams": {
        "rink": "half", "w": 380, "h": 300,
        "players": [
            (60, 150, "X", "QB"), (170, 60, "X", ""), (170, 240, "X", ""),
            (240, 150, "X", ""), (310, 150, "X", "Net"),
        ],
        "arrows": [
            (75, 150, 155, 65, "dashed", TEAL),
            (75, 150, 155, 235, "dashed", TEAL),
        ],
        "pucks": [(60, 145)],
    },

    "_category_battle": {
        "rink": "quarter", "w": 320, "h": 300,
        "players": [
            (140, 140, "X", "F"), (170, 160, "O", "D"),
            (280, 150, "G", "G"),
        ],
        "arrows": [
            (155, 140, 250, 140, "solid", TEAL),
            (175, 155, 250, 155, "solid", NAVY),
        ],
        "pucks": [(135, 135)],
    },

    "_category_conditioning": {
        "rink": "full", "w": 600, "h": 280,
        "players": [
            (60, 140, "X", ""),
        ],
        "arrows": [
            (75, 140, 200, 140, "solid", TEAL),
            (200, 140, 75, 140, "solid", RED_LINE),
            (75, 140, 300, 140, "solid", TEAL),
            (300, 140, 75, 140, "solid", RED_LINE),
            (75, 140, 540, 140, "solid", TEAL),
        ],
        "pucks": [],
    },

    "_category_small_area_games": {
        "rink": "quarter", "w": 320, "h": 300,
        "players": [
            (80, 100, "X", ""), (100, 200, "X", ""), (140, 140, "X", ""),
            (200, 100, "O", ""), (220, 200, "O", ""), (180, 160, "O", ""),
        ],
        "arrows": [],
        "pucks": [(150, 150)],
    },

    "_category_systems": {
        "rink": "full", "w": 600, "h": 280,
        "players": [
            (400, 140, "X", "F1"), (340, 80, "X", "F2"), (290, 140, "X", "F3"),
            (480, 100, "O", "D1"), (480, 180, "O", "D2"),
        ],
        "arrows": [
            (415, 140, 465, 110, "solid", TEAL),
        ],
        "pucks": [(480, 95)],
    },

    "_category_cool_down": {
        "rink": "full", "w": 600, "h": 280,
        "players": [
            (100, 60, "X", ""), (200, 220, "X", ""), (350, 60, "X", ""), (450, 220, "X", ""),
        ],
        "arrows": [
            (115, 60, 185, 215, "solid", TEAL),
            (215, 220, 335, 65, "solid", TEAL),
            (365, 60, 435, 215, "solid", TEAL),
        ],
        "pucks": [],
    },

    "_category_fun": {
        "rink": "full", "w": 600, "h": 280,
        "players": [
            (100, 80, "X", ""), (100, 200, "X", ""), (200, 140, "X", ""),
            (400, 80, "X", ""), (400, 200, "X", ""), (300, 140, "X", ""),
        ],
        "arrows": [],
        "pucks": [(300, 140)],
    },

    "_category_puck_handling": {
        "rink": "half", "w": 380, "h": 300,
        "players": [
            (60, 150, "X", ""),
        ],
        "arrows": [
            (75, 150, 130, 80, "solid", TEAL),
            (130, 80, 180, 200, "solid", TEAL),
            (180, 200, 230, 100, "solid", TEAL),
            (230, 100, 280, 180, "solid", TEAL),
        ],
        "pucks": [(60, 145)],
    },
}

# ── Generic fallbacks by ice surface ──

_GENERIC_FULL = {
    "rink": "full", "w": 600, "h": 280,
    "players": [
        (150, 80, "X", ""), (150, 200, "X", ""),
        (400, 80, "O", ""), (400, 200, "O", ""),
        (560, 140, "G", "G"),
    ],
    "arrows": [(165, 80, 380, 80, "solid", TEAL), (165, 200, 380, 200, "solid", TEAL)],
    "pucks": [(150, 75)],
}

_GENERIC_HALF = {
    "rink": "half", "w": 380, "h": 300,
    "players": [
        (80, 100, "X", ""), (80, 200, "X", ""),
        (200, 150, "O", ""), (340, 150, "G", "G"),
    ],
    "arrows": [(95, 100, 185, 145, "solid", TEAL), (95, 200, 185, 155, "solid", TEAL)],
    "pucks": [(80, 95)],
}

_GENERIC_QUARTER = {
    "rink": "quarter", "w": 320, "h": 300,
    "players": [
        (100, 120, "X", ""), (100, 200, "X", ""),
        (280, 150, "G", "G"),
    ],
    "arrows": [(115, 120, 250, 140, "dashed", TEAL)],
    "pucks": [(100, 115)],
}


# ── Main Generator ──────────────────────────────────────────

def generate_drill_diagram(
    ice_surface: str,
    category: str,
    concept_id: str | None,
    description: str,
) -> str:
    """Generate an SVG rink diagram for a drill.

    Lookup order: concept_id specific → category fallback → generic ice surface.
    """
    # Find the right layout
    layout = None
    if concept_id and concept_id in DRILL_LAYOUTS:
        layout = DRILL_LAYOUTS[concept_id]
    if not layout:
        cat_key = f"_category_{category}"
        if cat_key in DRILL_LAYOUTS:
            layout = DRILL_LAYOUTS[cat_key]
    if not layout:
        # Generic by ice surface
        surface = ice_surface.lower() if ice_surface else "full"
        if surface in ("quarter", "sixth", "third"):
            layout = _GENERIC_QUARTER
        elif surface == "half":
            layout = _GENERIC_HALF
        else:
            layout = _GENERIC_FULL

    # Select rink template
    rink_type = layout.get("rink", "full")
    w = layout.get("w", 600)
    h = layout.get("h", 280)

    if rink_type == "quarter":
        rink_svg = _quarter_rink(w, h)
    elif rink_type == "half":
        rink_svg = _half_rink(w, h)
    else:
        rink_svg = _full_rink(w, h)

    # Build elements
    elements = []

    # Arrows first (behind players)
    for a in layout.get("arrows", []):
        if len(a) == 6:
            elements.append(_arrow(a[0], a[1], a[2], a[3], a[4], a[5]))
        else:
            elements.append(_arrow(a[0], a[1], a[2], a[3]))

    # Pucks
    for p in layout.get("pucks", []):
        elements.append(_puck(p[0], p[1]))

    # Players on top
    for p in layout.get("players", []):
        if len(p) == 4:
            elements.append(_marker(p[0], p[1], p[2], p[3]))
        else:
            elements.append(_marker(p[0], p[1], p[2]))

    # Assemble SVG
    svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">
  <style>text {{ pointer-events: none; }}</style>
  {rink_svg}
  {chr(10).join(elements)}
</svg>"""

    return svg


if __name__ == "__main__":
    # Quick test — generate a few diagrams
    import os
    test_dir = os.path.join(os.path.dirname(__file__), "_test_diagrams")
    os.makedirs(test_dir, exist_ok=True)

    tests = [
        ("full", "offensive", "2on1_rush", "2-on-1 rush"),
        ("half", "special_teams", "pp_umbrella", "PP umbrella"),
        ("quarter", "shooting", "quick_release_slot", "Quick release"),
        ("full", "transition", "breakout_regroup", "Breakout drill"),
        ("full", "skating", None, "Generic skating"),
        ("half", "passing", None, "Generic passing"),
    ]

    for surf, cat, cid, desc in tests:
        svg = generate_drill_diagram(surf, cat, cid, desc)
        name = cid or f"generic_{cat}"
        path = os.path.join(test_dir, f"{name}.svg")
        with open(path, "w", encoding="utf-8") as f:
            f.write(svg)
        print(f"  Generated: {path} ({len(svg)} bytes)")

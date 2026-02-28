"""200 additional hockey drills — v4 seed expansion. Programmatic generation from templates."""
import uuid
import json

ALL_AGES = '["U8","U10","U12","U14","U16_U18","JUNIOR_COLLEGE_PRO"]'
U8_U10 = '["U8","U10"]'
U8_U12 = '["U8","U10","U12"]'
U10_UP = '["U10","U12","U14","U16_U18","JUNIOR_COLLEGE_PRO"]'
U10_U14 = '["U10","U12","U14"]'
U12_UP = '["U12","U14","U16_U18","JUNIOR_COLLEGE_PRO"]'
U14_UP = '["U14","U16_U18","JUNIOR_COLLEGE_PRO"]'
U16_UP = '["U16_U18","JUNIOR_COLLEGE_PRO"]'
JR_PLUS = '["JUNIOR_COLLEGE_PRO"]'

# Each entry: (name, category, description, coaching_points, setup, duration, players_needed, ice_surface, equipment, age_levels, tags_list, skill_focus, intensity, concept_id)
DRILLS_V4 = [
    # ═══════════════════════════════════════
    # SKATING (15)
    # ═══════════════════════════════════════
    ("Mohawk Turn Circuit", "skating",
     "Players skate through a series of cones performing mohawk turns at each cone. Alternate inside and outside edges. Progress from walking speed to full stride.",
     "Weight over skating foot during turn. Shoulders stay square. Knees bent throughout transition.",
     "Half ice. 8 cones in zigzag pattern.", 10, 0, "half", "Cones",
     ALL_AGES, '["edges","turns","agility"]', "skating", "medium", "v4_mohawk_turn_circuit"),

    ("Crossover Speed Build", "skating",
     "Players start in corner, crossover through neutral zone circle, power through center, crossover through far circle, finish with sprint to far blue line. Focus on under-push and full extension.",
     "Drive under-push knee toward ice. Arms drive forward not side to side. Deep knee bend in crossovers.",
     "Full ice. Players go every 5 seconds.", 10, 0, "full", None,
     U10_UP, '["crossovers","speed","power"]', "skating", "high", "v4_crossover_speed_build"),

    ("Backward C-Cut Ladder", "skating",
     "Players skate backward performing alternating C-cuts through a ladder of cones spaced 8 feet apart. Emphasis on single-leg power and balance.",
     "Full blade engagement on C-cut. Head up, chest up. Recovery leg returns tight under body.",
     "Half ice. 10 cones in straight line.", 8, 0, "half", "Cones",
     ALL_AGES, '["backward","edges","balance"]', "skating", "medium", "v4_backward_ccut_ladder"),

    ("Tight Turn Box Drill", "skating",
     "Four cones in a 15x15 foot square. Players skate tight turns around each cone alternating clockwise and counterclockwise. Two laps each direction.",
     "Outside edge pressure on turns. Low center of gravity. Eyes up scanning for next cone.",
     "Quarter ice. One box per group of 4.", 8, 4, "quarter", "Cones",
     ALL_AGES, '["turns","edges","agility"]', "skating", "medium", "v4_tight_turn_box"),

    ("Overspeed Sprint Relay", "skating",
     "Two teams line up on goal line. First player sprints to far blue line and back, tags next player. Winning team does fewer pushups. Three rounds.",
     "Explosive first 3 strides. Stay low through acceleration phase. Full arm drive.",
     "Full ice. Divide into two equal teams.", 8, 0, "full", None,
     U10_UP, '["speed","competition","conditioning"]', "skating", "high", "v4_overspeed_sprint_relay"),

    ("Four-Direction Agility Compass", "skating",
     "Player starts at center cone. Sprint forward to north cone, return. Lateral slide to east cone, return. Backward to south cone, return. Lateral to west, return. Time each rep.",
     "Transition steps must be quick. No false steps. Keep stick on ice during transitions.",
     "Quarter ice. 5 cones in compass pattern.", 10, 0, "quarter", "Cones",
     ALL_AGES, '["agility","transitions","speed"]', "skating", "high", "v4_four_direction_compass"),

    ("Power Pull Straightaway", "skating",
     "Players skate the length of the ice using only power pulls — inside edge pulls alternating feet. Focus on glide length and hip rotation. No crossovers allowed.",
     "Hips rotate fully each pull. Glide foot stays flat. Arms swing naturally with hip rotation.",
     "Full ice. Players spaced 10 feet apart.", 8, 0, "full", None,
     U10_UP, '["edges","power","technique"]', "skating", "medium", "v4_power_pull_straightaway"),

    ("Stop-and-Start Gauntlet", "skating",
     "Players skate through a line of 6 cones, performing a full hockey stop at each cone then exploding to the next. Alternate stopping sides. Coach times each run.",
     "Equal weight on both skates during stop. Immediate weight transfer to front foot on start. Snow spray should be even.",
     "Half ice. 6 cones in straight line 15 feet apart.", 10, 0, "half", "Cones",
     ALL_AGES, '["stops","starts","explosiveness"]', "skating", "high", "v4_stop_start_gauntlet"),

    ("Edge Control Serpentine", "skating",
     "Players weave through a serpentine course on one foot, alternating inside and outside edges. Switch feet halfway. Puck optional for advanced players.",
     "Ankle flexibility controls the turn. Free leg stays close to skating leg. Maintain consistent speed throughout.",
     "Half ice. 10 cones in serpentine.", 10, 0, "half", "Cones",
     U10_UP, '["edges","balance","control"]', "skating", "low", "v4_edge_control_serpentine"),

    ("Stride Length Challenge", "skating",
     "Mark lines at 5-foot intervals across the ice. Players count how many strides it takes to cover 100 feet. Goal: reduce stride count each rep through longer, more powerful strides.",
     "Full leg extension each stride. Toe flick at end of push. Recovery leg swings forward not outward.",
     "Full ice. Tape marks every 5 feet.", 10, 0, "full", "Tape",
     U12_UP, '["stride","power","technique"]', "skating", "medium", "v4_stride_length_challenge"),

    ("Pivot Transition Squares", "skating",
     "Players skate a square pattern, pivoting from forward to backward at each corner. Progress to tight pivots, then add puck. Alternate pivot directions each lap.",
     "Open hips fully during pivot. Weight stays centered. Maintain speed through transition.",
     "Half ice. 4 cones in 20x20 square.", 10, 0, "half", "Cones",
     U10_UP, '["pivots","transitions","footwork"]', "skating", "medium", "v4_pivot_transition_squares"),

    ("Lateral Shuffle Race", "skating",
     "Two players face each other across a 30-foot lane. On whistle, both shuffle laterally. First to touch the far boundary cone wins. Best of 5.",
     "Stay low in athletic position. Push off trailing foot. Lead with hips not shoulders.",
     "Quarter ice. Cones mark 30-foot lane.", 8, 2, "quarter", "Cones",
     ALL_AGES, '["lateral","competition","agility"]', "skating", "high", "v4_lateral_shuffle_race"),

    ("Finnish Skating Circles", "skating",
     "Players skate figure-8 patterns through both face-off circles, focusing on sustained one-foot glides on the curves. Alternate inside and outside edges. 3 minutes continuous.",
     "Lean into circle with body angle. Free leg extends for counterbalance. Build to full speed while maintaining edge.",
     "Half ice. Use existing face-off circles.", 10, 0, "half", None,
     U12_UP, '["edges","endurance","technique"]', "skating", "medium", "v4_finnish_skating_circles"),

    ("Knee Drop Recovery", "skating",
     "Players skate forward, drop to one knee, recover and accelerate. Alternate knees. Progress to two-knee drops with explosive recovery. Simulates getting back up after falls.",
     "Push off front knee to stand. Use stick for balance if needed. Quick recovery is the goal — minimize time on ice.",
     "Half ice. Open space.", 8, 0, "half", None,
     ALL_AGES, '["recovery","balance","toughness"]', "skating", "medium", "v4_knee_drop_recovery"),

    ("Mirror Skating Pairs", "skating",
     "Partners face each other 10 feet apart. Leader skates any direction — partner must mirror. Switch leader every 30 seconds. Develops reaction time and skating awareness.",
     "Reactor stays in athletic stance. Watch partner's hips for direction cues. Quick feet, short strides for reaction.",
     "Half ice. Pair up players.", 8, 0, "half", None,
     ALL_AGES, '["agility","reaction","awareness"]', "skating", "medium", "v4_mirror_skating_pairs"),

    # ═══════════════════════════════════════
    # PASSING (15)
    # ═══════════════════════════════════════
    ("Cross-Ice Give and Go", "passing",
     "Two lines face each other across the ice. Player passes cross-ice, skates behind receiver, receives return pass, then passes to next person in opposite line. Continuous flow.",
     "Pass ahead of receiver. Receive in stride. Call for the puck every time.",
     "Full ice width. Two lines on each side.", 10, 0, "full", "Pucks",
     ALL_AGES, '["passing","timing","give_and_go"]', "passing", "medium", "v4_cross_ice_give_go"),

    ("Saucer Pass Targets", "passing",
     "Set up sticks flat on ice as obstacles. Players must saucer pass over sticks to partner. Increase distance and obstacle height progressively. Track accuracy percentage.",
     "Cup the puck on blade. Spin for stability. Land the puck flat — no bouncing.",
     "Half ice. 4 sticks laid flat as barriers.", 10, 0, "half", "Pucks, Extra Sticks",
     U10_UP, '["saucer","accuracy","technique"]', "passing", "medium", "v4_saucer_pass_targets"),

    ("Three-Line Weave", "passing",
     "Three players skate down ice weaving and passing. Center passes to wing, follows behind, wing passes to far wing, follows behind. Must complete 4 passes before blue line, shot on net.",
     "Timing is everything — pass when receiver's stick is on ice. Lead passes only. Communication on every pass.",
     "Full ice. Groups of 3.", 12, 3, "full", "Pucks",
     U10_UP, '["weave","timing","teamwork"]', "passing", "medium", "v4_three_line_weave"),

    ("One-Touch Passing Triangle", "passing",
     "Three players form a triangle 15 feet apart. One-touch passing around the triangle — no cradling the puck. Switch directions on whistle. Track consecutive completions.",
     "Soft hands on reception. Redirect don't stop the puck. Blade angle determines pass direction.",
     "Quarter ice. Triangle of 3 players.", 8, 3, "quarter", "Pucks",
     U10_UP, '["one_touch","quick_hands","accuracy"]', "passing", "medium", "v4_one_touch_triangle"),

    ("Breakout Passing Under Pressure", "passing",
     "Defenseman retrieves puck behind net. Forward pressures. D must make breakout pass to one of two outlet options. Rotate positions after each rep.",
     "D: protect puck, peek before passing. Forwards: present stick target and time your support. Under pressure, use the boards.",
     "Half ice. 4 players rotate.", 12, 4, "half", "Pucks",
     U12_UP, '["breakout","pressure","decision_making"]', "passing", "high", "v4_breakout_under_pressure"),

    ("Backhand Pass Accuracy", "passing",
     "Partners face each other 20 feet apart. All passes must be backhand. Start stationary, progress to skating. Track tape-to-tape percentage over 2 minutes.",
     "Roll wrists over on release. Follow through toward target. Weight transfers from back to front foot.",
     "Half ice. Partners spread out.", 8, 0, "half", "Pucks",
     U10_UP, '["backhand","accuracy","technique"]', "passing", "medium", "v4_backhand_pass_accuracy"),

    ("Rapid Fire Passing Square", "passing",
     "Four players on corners of a square, two pucks in play simultaneously. Pass clockwise, receive, pass immediately. Coach adds second puck after 30 seconds. Develops peripheral vision.",
     "Head on a swivel. Know where both pucks are. Quick release — don't hold.",
     "Quarter ice. 4 cones in square, 4 players.", 10, 4, "quarter", "Pucks",
     U12_UP, '["speed","vision","multitask"]', "passing", "high", "v4_rapid_fire_square"),

    ("Long Stretch Pass", "passing",
     "Player at own goal line makes stretch pass to partner at far blue line. Partner receives in stride and attacks net. Rotate sides. Focus on weight and accuracy of long passes.",
     "Get your body weight behind the pass. Follow through pointing at target. Receiver: glide into passing lane.",
     "Full ice. Two lines at each end.", 10, 0, "full", "Pucks",
     U12_UP, '["stretch_pass","accuracy","transition"]', "passing", "medium", "v4_long_stretch_pass"),

    ("D-to-D Passing Drill", "passing",
     "Two defensemen at blue line pass D-to-D while forwards cycle below. D walks the line, passes cross-ice to partner, who one-times or walks and shoots. Simulate power play movement.",
     "Hard flat passes along blue line. Receiver one-times or catches and releases quickly. Communication prevents turnovers.",
     "Half ice. 2 D at blue line, 2-3 forwards.", 12, 5, "half", "Pucks",
     U12_UP, '["d_to_d","shooting","power_play"]', "passing", "medium", "v4_d_to_d_passing"),

    ("Tape-to-Tape Challenge", "passing",
     "Partners start 10 feet apart. Complete 5 forehand passes each. Move back 5 feet. Repeat until someone misses. Last pair standing wins. Builds accuracy under increasing distance.",
     "Snap wrists through the pass. Cushion reception. Stick blade stays flat on ice for target.",
     "Half ice. All pairs spread out.", 8, 0, "half", "Pucks",
     ALL_AGES, '["accuracy","competition","technique"]', "passing", "low", "v4_tape_to_tape_challenge"),

    ("Bank Pass off Boards", "passing",
     "Player at hash marks banks pass off boards to partner below goal line. Partner receives and cycles up wall. Practice reading angles and using boards as passing tool.",
     "Angle of incidence equals angle of reflection. Hard passes off boards stay flat. Soft passes die — use appropriate force.",
     "Half ice. Partners at boards.", 10, 0, "half", "Pucks",
     U10_UP, '["boards","angles","game_sense"]', "passing", "medium", "v4_bank_pass_boards"),

    ("Moving Target Passing", "passing",
     "Passer stands still. Receiver skates laterally across ice. Passer must lead receiver with pass. Switch after 5 passes. Increase receiver speed each round.",
     "Time the pass — release when receiver is 2 strides away. Lead distance increases with speed. Flat passes only.",
     "Half ice. Partners.", 10, 0, "half", "Pucks",
     ALL_AGES, '["timing","lead_passes","awareness"]', "passing", "medium", "v4_moving_target_passing"),

    ("Cycle Passing in Zone", "passing",
     "Three forwards cycle puck low in offensive zone. Maintain triangle shape. Pass to open man, support puck carrier, create passing lanes. Coach blows whistle to change direction.",
     "Triangle stays compact. Puck moves faster than skaters. Support from below the puck.",
     "Half ice. Groups of 3.", 12, 3, "half", "Pucks",
     U12_UP, '["cycle","support","positioning"]', "passing", "medium", "v4_cycle_passing_zone"),

    ("Drop Pass Timing", "passing",
     "Player carries puck up ice, drops pass to trailing teammate at specific landmarks (hash marks, blue line, red line). Trailer must time speed to receive in stride.",
     "Puck carrier: leave puck dead still. Trailer: don't arrive early — time your speed. Communicate with a call.",
     "Full ice. Pairs.", 10, 0, "full", "Pucks",
     U10_UP, '["drop_pass","timing","transition"]', "passing", "medium", "v4_drop_pass_timing"),

    ("Escape Pass Under Stick", "passing",
     "Defender holds stick in passing lane. Puck carrier must fake and find passing option through or around the stick. Develops deception and quick release under pressure.",
     "Eyes up — read the defender's stick position. Fake one direction, pass another. Quick release beats reach.",
     "Quarter ice. Groups of 3.", 10, 3, "quarter", "Pucks",
     U12_UP, '["deception","pressure","quick_release"]', "passing", "medium", "v4_escape_pass_under_stick"),

    # ═══════════════════════════════════════
    # SHOOTING (15)
    # ═══════════════════════════════════════
    ("Wrist Shot Accuracy Stations", "shooting",
     "Four targets placed in each corner of the net. Players shoot from slot area, aiming at specific targets. Track hits per 10 shots. Rotate through all four targets.",
     "Pick your spot before shooting. Weight transfer from back to front. Follow through pointing at target.",
     "Half ice. Targets on net, pucks at slot.", 12, 0, "half", "Pucks, Targets",
     ALL_AGES, '["wrist_shot","accuracy","technique"]', "shooting", "medium", "v4_wrist_shot_accuracy"),

    ("Quick Release Drill", "shooting",
     "Player receives pass in slot and must release shot within 1 second. Coach passes from different angles. Focus on catching and shooting as one motion. Track time to release.",
     "Don't cradle — redirect to shot. Hands forward, blade loaded. Shot doesn't need power, needs speed of release.",
     "Half ice. Coach at half wall, shooter in slot.", 12, 0, "half", "Pucks",
     U12_UP, '["quick_release","shooting","timing"]', "shooting", "high", "v4_quick_release_drill"),

    ("Snapshot off the Rush", "shooting",
     "Player enters zone at speed, receives pass, takes snapshot in stride without slowing down. Focus on shooting while moving — no stopping to wind up.",
     "Puck position slightly behind front foot. Quick snap of wrists. Shoot through the puck, don't lift.",
     "Full ice. Passer at blue line, shooter enters with speed.", 10, 0, "full", "Pucks",
     U12_UP, '["snapshot","rush","in_stride"]', "shooting", "high", "v4_snapshot_off_rush"),

    ("One-Timer Station", "shooting",
     "Passer from half wall feeds to shooter at the dot. Shooter one-times without stopping the puck. Alternate forehand and backhand sides. 10 reps each side.",
     "Open blade to target. Stick meets puck at the bottom of the arc. Keep eyes on the puck until contact.",
     "Half ice. Passer on wall, shooter at dot.", 12, 2, "half", "Pucks",
     U14_UP, '["one_timer","timing","power"]', "shooting", "high", "v4_one_timer_station"),

    ("Screen Shot Drill", "shooting",
     "Defenseman shoots from point while forward screens goalie. Forward must tip or redirect without blocking the shot. Practice timing between shooter and screener.",
     "Screener: establish position early, don't move laterally into shot lane. Shooter: keep it low for tip opportunities.",
     "Half ice. D at point, F in front of net.", 12, 3, "half", "Pucks",
     U14_UP, '["screen","tips","teamwork"]', "shooting", "medium", "v4_screen_shot_drill"),

    ("Backhand Shelf Shot", "shooting",
     "Players approach net from wide angle and practice roofing backhand shots. Start slow from close range, gradually increase speed and distance. Emphasize lifting the puck.",
     "Roll puck to backhand side. Pull puck toward body then push up and out. Wrist rotation lifts the puck.",
     "Half ice. Players approach from wing.", 10, 0, "half", "Pucks",
     U10_UP, '["backhand","shooting","finishing"]', "shooting", "medium", "v4_backhand_shelf_shot"),

    ("Deflection Alley", "shooting",
     "Shooter at blue line. Two players positioned between dots as tippers. Point shot comes through traffic — tippers redirect toward net. Rotate positions every 5 shots.",
     "Tipper: angle stick blade to redirect down. Soft grip allows blade to give on contact. Position between hash marks.",
     "Half ice. 3 players, goalie.", 12, 3, "half", "Pucks",
     U14_UP, '["deflection","tips","positioning"]', "shooting", "medium", "v4_deflection_alley"),

    ("Catch and Release Series", "shooting",
     "Coach passes to player from 5 different angles. Player must catch and shoot in one motion from each angle. Forehand side, backhand side, behind, between feet, in skates.",
     "Adjust body angle to pass direction. Transfer to shooting position immediately. Don't over-handle.",
     "Half ice. Single shooter, coach passing.", 10, 0, "half", "Pucks",
     U12_UP, '["shooting","hands","adaptability"]', "shooting", "high", "v4_catch_and_release"),

    ("Five-Puck Blitz", "shooting",
     "Five pucks placed in arc from slot to circles. Player shoots all five as fast as possible. Clock the total time. Must hit net with at least 3 of 5. Fastest time wins.",
     "Move feet between pucks. Don't reach — skate to proper shooting position. Accuracy first, then speed.",
     "Half ice. 5 pucks in arc.", 8, 0, "half", "Pucks",
     U10_UP, '["shooting","speed","competition"]', "shooting", "high", "v4_five_puck_blitz"),

    ("Shot Fake and Finish", "shooting",
     "Player skates in on net, performs shot fake to move goalie, then finishes with opposite shot. Practice high fake/low finish and glove fake/blocker finish.",
     "Sell the fake — head and shoulders follow through. Patience after the fake. Pick your spot, don't just throw it on net.",
     "Half ice. Shooters from slot.", 10, 0, "half", "Pucks",
     U12_UP, '["deception","finishing","patience"]', "shooting", "medium", "v4_shot_fake_finish"),

    ("Point Shot Lanes", "shooting",
     "Defensemen practice point shots through simulated traffic (cones or players). Must keep shots low for tip and rebound opportunities. Alternate slap and wrist shots.",
     "Low and hard. Get the shot through — don't try to go around everything. Quick release from the point.",
     "Half ice. D at blue line, cones as traffic.", 12, 0, "half", "Pucks, Cones",
     U12_UP, '["point_shot","accuracy","getting_through"]', "shooting", "medium", "v4_point_shot_lanes"),

    ("Toe Drag Snipe", "shooting",
     "Player approaches defender (cone), toe drags around to shooting position, snipes top corner. Practice from both sides. Emphasize pulling puck across body and quick release.",
     "Toe drag pulls puck to forehand. Eyes pick corner during drag. Release immediately after drag — don't add extra dekes.",
     "Half ice. Cones as defenders.", 10, 0, "half", "Pucks, Cones",
     U12_UP, '["deke","shooting","finishing"]', "shooting", "medium", "v4_toe_drag_snipe"),

    ("Slot Chaos Shooting", "shooting",
     "Coach dumps pucks randomly into slot area. Players must find loose puck, get it to shooting position, and shoot within 2 seconds. Simulates rebounds and loose pucks in traffic.",
     "Get your body between defenders and puck. Shoot what you have — don't try to set up the perfect shot. Second effort on rebounds.",
     "Half ice. Coach dumps pucks, 2-3 shooters.", 10, 3, "half", "Pucks",
     U10_UP, '["rebounds","battle","quick_shot"]', "shooting", "high", "v4_slot_chaos_shooting"),

    ("Cross-Body Shot Drill", "shooting",
     "Player receives pass on off-wing (left-handed on right wing). Must transfer puck across body and shoot without stopping momentum. Builds in-stride shooting from off-wing.",
     "Open up body to receive. Puck crosses from backhand to forehand across body. Shoot through the transfer motion.",
     "Full ice. Passers on boards, shooters on off-wing.", 10, 0, "full", "Pucks",
     U14_UP, '["off_wing","shooting","in_stride"]', "shooting", "high", "v4_cross_body_shot"),

    ("Wraparound Series", "shooting",
     "Player practices wraparound attempts from behind the net. Start with basic tuck, progress to fake wrap and shoot far side, then reverse wrap. Read goalie position.",
     "Protect puck on wrap side. Keep speed through the crease. Read goalie pad position before committing.",
     "Half ice. Player starts behind net.", 10, 0, "half", "Pucks",
     U10_UP, '["wraparound","finishing","creativity"]', "shooting", "medium", "v4_wraparound_series"),

    # ═══════════════════════════════════════
    # OFFENSIVE (15)
    # ═══════════════════════════════════════
    ("2-on-1 Rush Attack", "offensive",
     "Two forwards attack against one defenseman. Puck carrier drives wide, passes across to trailer for shot. Alternate sides. Focus on timing, width, and shot selection.",
     "Carrier: drive wide to pull D. Trailer: delay and fill lane. Pass must be flat and on tape. Shoot low blocker side.",
     "Full ice. 2 forwards vs 1 D.", 12, 3, "full", "Pucks",
     U10_UP, '["odd_man_rush","decision_making","passing"]', "transition", "high", "v4_2on1_rush_attack"),

    ("3-on-2 Zone Entry", "offensive",
     "Three forwards attack two defensemen. Practice wide entry, carry entry, and chip-and-chase. D must gap up properly. Forwards read D positioning.",
     "Read the D gap. If they back off, carry it in. If they pinch, chip behind. Middle lane drives hard.",
     "Full ice. 3F vs 2D.", 15, 5, "full", "Pucks",
     U12_UP, '["zone_entry","rush","reading_defense"]', "transition", "high", "v4_3on2_zone_entry"),

    ("Net Front Presence Drill", "offensive",
     "Forward establishes position in front of net while D tries to move them. Coach shoots from point for screens, tips, and rebounds. Forward must maintain position and score.",
     "Wide base, stick on ice. Battle for ice, not for body position. Eyes on the puck. Be ready for redirects and rebounds.",
     "Half ice. 1F vs 1D in front of net.", 12, 3, "half", "Pucks",
     U12_UP, '["net_front","battle","screening"]', "battle", "high", "v4_net_front_presence"),

    ("Cycle Game Low", "offensive",
     "Three forwards cycle puck below the dots against two defenders. Must complete 3 passes before shooting. Focus on supporting the puck carrier and creating shooting lanes.",
     "Support from below. Puck moves to open man. When you pass, move to open space immediately.",
     "Half ice. 3F vs 2D.", 12, 5, "half", "Pucks",
     U12_UP, '["cycle","support","offensive_zone"]', "positioning", "medium", "v4_cycle_game_low"),

    ("Delay Entry Play", "offensive",
     "Forward carries puck through neutral zone, delays at blue line, waits for support. Trailer enters zone with speed for pass reception. Practice patience on zone entry.",
     "Carrier: control the pace, don't rush entry. Trailer: time your burst. Too early clogs the zone, too late loses the advantage.",
     "Full ice. Pairs.", 10, 0, "full", "Pucks",
     U12_UP, '["zone_entry","delay","support"]', "positioning", "medium", "v4_delay_entry_play"),

    ("Odd-Man Rush Finishing", "offensive",
     "Coach creates 2-on-0, 2-on-1, and 3-on-1 situations. Attackers must score. Progress from no defense to increasing defensive pressure. Focus on finishing opportunities.",
     "Take what the defense gives you. Don't force cross-ice passes. Shoot when you have a lane. Get to the net for rebounds.",
     "Full ice. Various combinations.", 15, 0, "full", "Pucks",
     U10_UP, '["finishing","rush","decision_making"]', "shooting", "high", "v4_odd_man_finishing"),

    ("Bump and Drive Pattern", "offensive",
     "Player carries puck along boards, makes bump pass to supporting player, drives to net for return pass and shot. Practice wall game and getting to dangerous ice.",
     "Bump pass must be firm. Driver goes hard to net — don't float. Return pass leads to shooting position.",
     "Half ice. Pairs along boards.", 10, 0, "half", "Pucks",
     U12_UP, '["wall_game","driving_net","support"]', "positioning", "medium", "v4_bump_and_drive"),

    ("Quiet Zone Possession", "offensive",
     "Three forwards maintain puck possession in offensive zone against increasing pressure — start 3v1, progress to 3v2, then 3v3. Clock possession time. Must stay below top of circles.",
     "Move to open space. Puck protection when pressured. Use the net as a screen. Patient play — don't force.",
     "Half ice. 3F vs 1-3D.", 12, 6, "half", "Pucks",
     U12_UP, '["possession","patience","puck_protection"]', "puck_control", "medium", "v4_quiet_zone_possession"),

    ("Shot Lane Creation", "offensive",
     "Three forwards work to create shooting lanes through two defenders and a goalie. Pass and move to pull defenders, opening shooting windows. Coach evaluates lane recognition.",
     "Move defenders with the pass. When lane opens, shoot immediately. Don't waste open looks with extra passes.",
     "Half ice. 3F vs 2D + G.", 12, 6, "half", "Pucks",
     U14_UP, '["shooting_lanes","movement","decision_making"]', "positioning", "medium", "v4_shot_lane_creation"),

    ("Cross-Ice Attack Pattern", "offensive",
     "Puck starts low on one side. Quick cross-ice pass to opposite winger who attacks with speed. D must recover. Develops puck movement and off-puck attack.",
     "Cross-ice pass must be hard and flat. Receiver attacks immediately — no standing. D-side forward fills middle lane.",
     "Half ice. 3F in offensive zone.", 10, 3, "half", "Pucks",
     U12_UP, '["cross_ice","attack","speed"]', "transition", "high", "v4_cross_ice_attack"),

    ("High Cycle to Low Shot", "offensive",
     "Forward carries puck high above circles, swings low, drives to net for shot. Practice from both sides. Defenseman shadows. Creates shooting angle from cycle movement.",
     "Change pace — slow above circles, explode to net. Protect puck on inside turn. Shoot before D recovers position.",
     "Half ice. 1F vs 1D.", 10, 2, "half", "Pucks",
     U12_UP, '["cycle","driving_net","puck_protection"]', "puck_control", "medium", "v4_high_cycle_low_shot"),

    ("Retrieval and Setup", "offensive",
     "Coach dumps puck into corner. Forward retrieves against D pressure, protects, and finds outlet pass to supporting players. Practice winning the race and making smart first plays.",
     "Win the race to the puck. Protect immediately on arrival. First look: teammate in slot. Second look: D-man at point.",
     "Half ice. 1F vs 1D, support options.", 10, 4, "half", "Pucks",
     U10_UP, '["retrieval","puck_protection","first_play"]', "battle", "high", "v4_retrieval_and_setup"),

    ("Give-and-Go Scoring Play", "offensive",
     "Forward passes to D at point, drives hard to net. D returns pass to forward in scoring position. Practice timing and angle of attack to net. Both sides.",
     "Pass and go — don't watch your pass. Drive hard through the slot. D: return pass quickly, keep it flat.",
     "Half ice. 1F and 1D.", 10, 2, "half", "Pucks",
     U10_UP, '["give_and_go","scoring","driving_net"]', "passing", "high", "v4_give_and_go_scoring"),

    ("Seam Pass Recognition", "offensive",
     "Three forwards in zone, two defenders. Forwards must identify and hit seam passes between defenders. Coach freezes play to show seams. Develops offensive IQ.",
     "Look between defenders, not at them. Seam opens when defenders shift together. Quick release into the seam before it closes.",
     "Half ice. 3F vs 2D.", 12, 5, "half", "Pucks",
     U14_UP, '["seam_pass","vision","offensive_iq"]', "passing", "medium", "v4_seam_pass_recognition"),

    ("Controlled Breakout to Attack", "offensive",
     "Full 5-player unit breaks out from own zone and enters offensive zone with control. Must complete at least 3 passes before crossing red line. Focus on structure and support lanes.",
     "D: scan before touching puck. Forwards: provide 3 options. Middle lane stays available. Up together as a unit.",
     "Full ice. 5-player unit.", 15, 5, "full", "Pucks",
     U14_UP, '["breakout","structure","team_play"]', "systems", "medium", "v4_controlled_breakout_attack"),

    # ═══════════════════════════════════════
    # DEFENSIVE (15)
    # ═══════════════════════════════════════
    ("Gap Control Progression", "defensive",
     "Defenseman skates backward while forward carries puck up ice. D must maintain proper gap — not too tight (beaten wide) or too loose (easy entry). Coach evaluates gap distance.",
     "Match forward's speed. Gap tightens inside blue line. Stick in passing lane, feet ready to pivot. Don't lunge.",
     "Full ice. 1D vs 1F.", 10, 2, "full", "Pucks",
     U12_UP, '["gap_control","positioning","backward"]', "positioning", "medium", "v4_gap_control_progression"),

    ("1-on-1 Defensive Angling", "defensive",
     "Forward has puck along boards. Defenseman must angle attacker to boards and separate from puck. Practice steering, body position, and stick checking.",
     "Angle to the boards, not center ice. Inside-out approach. Stick on puck, body on body. Don't chase — steer.",
     "Half ice. 1D vs 1F.", 10, 2, "half", "Pucks",
     U12_UP, '["angling","body_position","checking"]', "checking", "high", "v4_1on1_angling"),

    ("Defensive Zone Box Drill", "defensive",
     "Four defenders hold box formation in D-zone. Three attackers try to score. Defenders communicate and rotate based on puck position. Develops coverage awareness.",
     "Collapse on puck-side. Weak-side D covers front of net. Talk constantly — call out man coverage. Stick in lanes.",
     "Half ice. 4D vs 3F + G.", 12, 8, "half", "Pucks",
     U14_UP, '["d_zone","coverage","communication"]', "systems", "high", "v4_d_zone_box"),

    ("Active Stick Drill", "defensive",
     "Defender uses stick to disrupt passing lanes and puck carriers. No body contact — stick only. Track steals and deflections per rep. Develops stick-first defending.",
     "Stick stays on ice in passing lane. Active hands — poke and pull back. Don't commit full body, just stick.",
     "Quarter ice. 1D vs 1F.", 10, 2, "quarter", "Pucks",
     U10_UP, '["stick_checking","positioning","discipline"]', "positioning", "medium", "v4_active_stick_drill"),

    ("Backcheck Commitment Drill", "defensive",
     "Forward starts at far blue line. Puck is turned over at near blue line. Forward must backcheck full speed, pick up assignment, and prevent scoring chance. Coach evaluates effort and route.",
     "Shortest route back — don't circle. Pick up the most dangerous man. Inside-out position. Stick in lane, arrive on puck side.",
     "Full ice. 2v1 with backchecking forward.", 10, 3, "full", "Pucks",
     U12_UP, '["backcheck","effort","defensive_commitment"]', "conditioning", "high", "v4_backcheck_commitment"),

    ("Net Front Clearout", "defensive",
     "Attacker sets up in front of net. Defender must box out, clear shooting lanes, and remove attacker from crease area. Practice stick lifts, body positioning, and front-of-net battles.",
     "Inside position is critical. Stick under attacker's stick. Use body to push out, not hands. Protect goalie's sight lines.",
     "Half ice. 1D vs 1F in front of net.", 10, 2, "half", "Pucks",
     U12_UP, '["net_front_defense","battle","positioning"]', "battle", "high", "v4_net_front_clearout"),

    ("D-Zone Faceoff Coverage", "defensive",
     "Practice defensive zone faceoff setups and assignments. Center wins or loses draw — each outcome triggers a specific coverage pattern. Reps for both win and loss scenarios.",
     "Know your assignment before the puck drops. Win: D grabs puck, forward walls off. Loss: collapse to net front, block shots.",
     "Half ice. Full 5-player unit.", 12, 5, "half", "Pucks",
     U14_UP, '["faceoff","coverage","systems"]', "systems", "medium", "v4_dzone_faceoff_coverage"),

    ("Pinch or Stay Decision Drill", "defensive",
     "D-man at blue line reads play developing along boards. Must decide to pinch down or stay home based on forward support. Wrong read creates odd-man rush against.",
     "Only pinch with F support behind you. If you pinch, commit fully. If you stay, stay tight to blue line.",
     "Full ice. Game-like simulation.", 12, 5, "full", "Pucks",
     U14_UP, '["pinching","decision_making","d_reads"]', "positioning", "high", "v4_pinch_or_stay"),

    ("2-on-2 Defensive Battle", "defensive",
     "Two defenders vs two forwards in the defensive zone. Play starts with dump-in. D must retrieve, break out, or clear. Forwards forecheck. Live play for 30 seconds.",
     "D communication is key. One goes to puck, other covers in front. Quick up decisions. Don't both go to the corner.",
     "Half ice. 2D vs 2F.", 12, 4, "half", "Pucks",
     U12_UP, '["d_zone","battle","breakout"]', "battle", "high", "v4_2on2_defensive_battle"),

    ("Shot Blocking Technique", "defensive",
     "Defenders practice proper shot blocking form — angled body, stick flat, controlled drop. Start with tennis balls, progress to pucks at reduced speed. Safety-first approach.",
     "Turn sideways, protect face with glove. Drop to one knee, block with shin pads. Only block when you can get square to shooter.",
     "Half ice. Controlled shots at blockers.", 10, 0, "half", "Pucks, Tennis Balls",
     U14_UP, '["shot_blocking","technique","sacrifice"]', "positioning", "medium", "v4_shot_blocking_technique"),

    ("Outnumbered Defense (2v3)", "defensive",
     "Two defenders vs three attackers in D-zone. D must protect high-danger areas and force low-percentage shots. Practice collapsing, communicating, and buying time for backcheck.",
     "Take away slot and net front. Force shots from outside. One D stays in front of net always. Buy time for help.",
     "Half ice. 2D vs 3F.", 12, 5, "half", "Pucks",
     U14_UP, '["outnumbered","positioning","composure"]', "positioning", "high", "v4_outnumbered_2v3"),

    ("Neutral Zone Trap Setup", "defensive",
     "Five players practice 1-3-1 neutral zone structure. Center pressures puck carrier, wingers seal boards, D reads play. Walk through then full speed against opposing unit.",
     "Center funnels to strong side. Winger on puck side activates. Weak-side winger stays high in center. Don't chase — force the play.",
     "Full ice. 5v5.", 15, 10, "full", "Pucks",
     U14_UP, '["neutral_zone","trap","systems"]', "systems", "medium", "v4_neutral_zone_trap"),

    ("Recovery Sprint and Defend", "defensive",
     "Defender starts on stomach at center ice. On whistle, scrambles up and recovers to defend a 1-on-0 or 2-on-1. Simulates desperation recovery after a fall or turnover.",
     "Get up fast — knees first. Sprint angle cuts off attacker's inside lane. Arrive stick-first, then body.",
     "Full ice. D at center, attacker at far blue.", 10, 2, "full", "Pucks",
     U10_UP, '["recovery","hustle","desperation"]', "conditioning", "high", "v4_recovery_sprint_defend"),

    ("Puck-Side Overload Defense", "defensive",
     "Attackers overload one side of the ice (3 players same side). Defenders must shift coverage without abandoning weak-side threats. Coach freezes play to teach rotation.",
     "Strong side collapses. Weak-side D cheats to middle but keeps head on swivel. Net front is never empty.",
     "Half ice. 3F vs 3D + G.", 12, 7, "half", "Pucks",
     U14_UP, '["overload","rotation","communication"]', "systems", "medium", "v4_puckside_overload_d"),

    ("Wall Battle Compete Drill", "defensive",
     "Puck dumped into corner. One forward and one defenseman battle for possession. Winner either breaks out (D) or cycles to scoring chance (F). Physical compete drill.",
     "Feet first to the puck. Body position between opponent and puck. Win the wall, win the game.",
     "Half ice. 1D vs 1F, corner battle.", 10, 2, "half", "Pucks",
     U10_UP, '["battle","puck_protection","compete"]', "battle", "high", "v4_wall_battle_compete"),

    # ═══════════════════════════════════════
    # SPECIAL TEAMS (12)
    # ═══════════════════════════════════════
    ("Umbrella PP Setup", "special_teams",
     "Practice the umbrella power play formation — one player high slot, two at dots, two down low. Walk through rotation when puck moves. D-to-D, feed low, shoot high.",
     "High man is the quarterback. Feed low when lane opens. Dots: one-timer ready. Low: screen and tip. Move as a unit.",
     "Half ice. 5 PP players.", 15, 5, "half", "Pucks",
     U14_UP, '["power_play","umbrella","structure"]', "systems", "medium", "v4_umbrella_pp"),

    ("1-3-1 Power Play Movement", "special_teams",
     "Set up 1-3-1 PP formation. Practice puck movement to create shooting lanes. Point controls play, mid-slot bumper receives passes, net-front tips. Walk through then full speed.",
     "Bumper position is key — provide central passing option. Quick puck movement beats the PK box. Shoot when lane opens, don't over-pass.",
     "Half ice. 5 PP players.", 15, 5, "half", "Pucks",
     U14_UP, '["power_play","1_3_1","movement"]', "systems", "medium", "v4_131_pp_movement"),

    ("PK Diamond Formation", "special_teams",
     "Four penalty killers practice diamond formation. Pressure puck carrier, seal passing lanes, rotate on puck movement. Practice against stationary PP first, then live.",
     "Top of diamond pressures. Side killers cheat to strong side. Low man protects net front. Rotate as puck moves.",
     "Half ice. 4 PK vs 5 PP.", 15, 9, "half", "Pucks",
     U14_UP, '["penalty_kill","diamond","pressure"]', "systems", "high", "v4_pk_diamond"),

    ("PP Entry Options", "special_teams",
     "Practice three power play entry methods: carry, pass across, dump and retrieve. Read PK pressure to decide which entry. Quick setup after crossing blue line.",
     "Carry when PK backs off. Pass across when they crowd puck side. Dump only as last resort. Quick setup — don't waste PP time.",
     "Full ice. 5 PP vs 4 PK.", 12, 9, "full", "Pucks",
     U14_UP, '["power_play","zone_entry","decision_making"]', "systems", "medium", "v4_pp_entry_options"),

    ("Short-Handed 2-on-1 Rush", "special_teams",
     "PK gets turnover and attacks 2-on-1 the other way. Practice quick transition from defensive to offensive. Speed kills on the shorthanded rush.",
     "First pass must be quick and hard. Drive wide and go to net. Shoot early — don't over-pass on SH chances.",
     "Full ice. 2 PK vs 1 PP defender.", 10, 3, "full", "Pucks",
     U12_UP, '["shorthanded","transition","attack"]', "transition", "high", "v4_sh_2on1_rush"),

    ("PP Puck Recovery", "special_teams",
     "PK clears the puck. PP unit must recover and re-establish offensive zone setup within 5 seconds. Practice quick retrievals and re-entries under time pressure.",
     "D pinch to keep puck alive at blue line. If cleared, nearest forward chases. Reset quickly — don't waste PP time.",
     "Full ice. 5 PP players.", 10, 5, "full", "Pucks",
     U14_UP, '["power_play","recovery","urgency"]', "conditioning", "high", "v4_pp_puck_recovery"),

    ("4-on-4 Transition Game", "special_teams",
     "Live 4-on-4 play in one zone. On whistle, both teams transition to other end. First team to score wins the round. Develops open-ice awareness and quick transition.",
     "More ice per player — use it. Support puck carrier from wide positions. Quick ups through middle. Transition the moment you win possession.",
     "Full ice. 4v4.", 15, 8, "full", "Pucks",
     U12_UP, '["4_on_4","transition","open_ice"]', "transition", "high", "v4_4on4_transition"),

    ("6-on-5 Empty Net Attack", "special_teams",
     "Trailing team pulls goalie for 6-on-5. Practice offensive structure and shot selection with extra attacker. Defense practices clearing under pressure and targeting empty net.",
     "Extra attacker: high slot for one-timer. Wide triangles for passing options. Defense: get below puck and clear. Shoot at empty net when lane opens.",
     "Full ice. 6 attackers vs 5 defenders.", 12, 11, "full", "Pucks",
     U14_UP, '["empty_net","6_on_5","late_game"]', "systems", "high", "v4_6on5_empty_net"),

    ("PK Box Rotation Drill", "special_teams",
     "Four PK players practice box formation rotation against puck movement. Walk through first: when puck goes D-to-D, box shifts. When puck goes low, box collapses.",
     "Move as a unit — connected by invisible strings. Closest player to puck pressures. Never leave net front empty. Stay compact.",
     "Half ice. 4 PK players vs coach moving puck.", 12, 4, "half", "Pucks",
     U12_UP, '["penalty_kill","box","rotation"]', "systems", "medium", "v4_pk_box_rotation"),

    ("PP One-Timer Practice", "special_teams",
     "Set up power play positions. Focus specifically on the one-timer options — D-to-D one-timer, feed to dot for one-timer, cross-crease one-timer. 10 reps each option.",
     "Passer: hard and flat. Shooter: open blade early, meet puck at bottom of arc. Practice both sides.",
     "Half ice. 3-5 PP players.", 12, 3, "half", "Pucks",
     U14_UP, '["power_play","one_timer","scoring"]', "shooting", "high", "v4_pp_one_timer_practice"),

    ("Aggressive PK Forecheck", "special_teams",
     "Two penalty killers practice aggressive forecheck in offensive zone after PK clear attempt fails. F1 pressures puck, F2 reads passing lane. Create turnovers and SH chances.",
     "F1 goes hard on puck carrier. F2 reads — anticipate the outlet pass. If turnover, attack immediately. Don't overcommit both forwards.",
     "Half ice. 2 PK forecheckers.", 10, 2, "half", "Pucks",
     U12_UP, '["penalty_kill","forecheck","pressure"]', "systems", "high", "v4_aggressive_pk_forecheck"),

    ("Face-off Play (PP and PK)", "special_teams",
     "Practice set plays off offensive and defensive zone faceoffs for both PP and PK. Center wins to specific target, unit executes predetermined play. 3 plays per scenario.",
     "Know the play before the puck drops. Center: win to the right spot. Wingers: be in position immediately. Execute within 3 seconds of win.",
     "Half ice. Full PP and PK units.", 15, 10, "half", "Pucks",
     U14_UP, '["faceoff","special_teams","set_plays"]', "systems", "medium", "v4_faceoff_plays_st"),

    # ═══════════════════════════════════════
    # SMALL AREA GAMES (15)
    # ═══════════════════════════════════════
    ("3-on-3 Cross Ice", "small_area_games",
     "Live 3v3 game played across the width of the ice using two nets. Small ice forces quick decisions, tight passing, and constant movement. First to 3 goals wins.",
     "Quick puck movement — can't hold it in tight space. Support the puck carrier. Transition immediately on turnovers.",
     "Quarter ice (cross-ice). Mini nets.", 12, 6, "quarter", "Mini Nets, Pucks",
     ALL_AGES, '["small_area","competition","quick_decisions"]', "puck_control", "high", "v4_3on3_cross_ice"),

    ("2-on-2 Below the Dots", "small_area_games",
     "Live 2v2 game below the face-off dots with one goalie. Must stay below dots. Forces battles, net-front play, and low-zone offense/defense. 45-second shifts.",
     "Compete hard for position. Use the net as a screen. Shoot quick in tight. Defenders: tie up sticks, box out.",
     "Quarter ice. Below the dots.", 12, 5, "quarter", "Pucks",
     U10_UP, '["battle","net_front","compete"]', "battle", "high", "v4_2on2_below_dots"),

    ("King of the Ring", "small_area_games",
     "Circle of players around center ice circle. Two players inside battle for one puck. Player who scores into mini net stays in, loser goes out. Next challenger enters.",
     "Protect the puck with your body. Quick moves in tight space. Shoot when you see net. No passengers — compete every second.",
     "Center ice circle. Mini net.", 10, 0, "quarter", "Mini Net, Pucks",
     ALL_AGES, '["1v1","compete","puck_protection"]', "battle", "high", "v4_king_of_the_ring"),

    ("Bumper Ball Hockey", "small_area_games",
     "4v4 with a tennis ball instead of a puck. Played cross-ice with mini nets. Ball bounces unpredictably — develops hand-eye coordination and adaptability.",
     "Stay on your toes — ball changes direction quickly. Quick stickhandling to control bounces. Shoot low — tennis balls rise easily.",
     "Quarter ice. Mini nets.", 10, 8, "quarter", "Tennis Ball, Mini Nets",
     ALL_AGES, '["fun","hand_eye","adaptability"]', "puck_control", "medium", "v4_bumper_ball_hockey"),

    ("Sharks Circle Game", "small_area_games",
     "All players inside face-off circle with pucks. On whistle, protect your puck while trying to knock others' pucks out. Last player with a puck wins. Develops heads-up play.",
     "Protect your puck between your feet. Head up — scan for threats. Quick poke checks at others while keeping control of yours.",
     "Face-off circle.", 8, 0, "quarter", "Pucks",
     ALL_AGES, '["puck_protection","awareness","fun"]', "puck_control", "medium", "v4_sharks_circle"),

    ("1-on-1 Battle Box", "small_area_games",
     "Two players in a confined 20x20 box. One attacks, one defends. Attacker tries to score on mini net. Defender tries to win puck and score on opposite mini net. 30-second rounds.",
     "Attacker: quick moves, protect puck, shoot fast. Defender: gap control, active stick, angle to boards. First to puck after whistle has advantage.",
     "Quarter ice. Cones mark box, mini nets.", 10, 2, "quarter", "Cones, Mini Nets, Pucks",
     ALL_AGES, '["1v1","battle","compete"]', "battle", "high", "v4_1on1_battle_box"),

    ("Keep Away (3v1)", "small_area_games",
     "Three players keep the puck away from one defender inside a face-off circle. Defender in middle tries to steal. Complete 10 consecutive passes to win. Rotate defender.",
     "Quick one-touch passes. Move after passing. Defender: read eyes, anticipate passes. Stay compact in the circle.",
     "Face-off circle.", 8, 4, "quarter", "Pucks",
     ALL_AGES, '["passing","support","possession"]', "passing", "medium", "v4_keep_away_3v1"),

    ("4-on-4 Mini Game", "small_area_games",
     "Full competitive 4v4 game cross-ice with mini nets and goalies. Emphasize quick transitions, short shifts (45 seconds), and high compete level. Track score.",
     "Quick decisions — time and space are limited. Support from close range. Shoot early and often. Win your battles.",
     "Half ice cross-ice. Mini nets.", 15, 10, "half", "Mini Nets, Pucks",
     ALL_AGES, '["game_play","compete","transitions"]', "puck_control", "high", "v4_4on4_mini_game"),

    ("Triangulation Passing Game", "small_area_games",
     "3v3 game where a goal only counts if completed with a pass from below the goal line to a shooter above the dots. Forces cycle play and low-to-high passing.",
     "Earn the shot by moving the puck low first. Shooter must be above dots. Pass must come from below goal line. Teaches offensive structure.",
     "Half ice. Nets in normal position.", 12, 6, "half", "Pucks",
     U12_UP, '["passing","structure","game_play"]', "passing", "high", "v4_triangulation_game"),

    ("Transition Turnover Game", "small_area_games",
     "3v3 in one zone. When turnover happens, team that wins puck must pass it out to coach at blue line before attacking. Forces transition play and quick outlet passes.",
     "Win the puck, find coach immediately. Don't try to attack until outlet is complete. Other team: pressure the outlet to force errors.",
     "Half ice. Coach at blue line.", 12, 6, "half", "Pucks",
     U10_UP, '["transition","outlet","game_play"]', "transition", "high", "v4_transition_turnover_game"),

    ("Goals Only From Passes", "small_area_games",
     "3v3 or 4v4 game where goals only count from one-timer or redirect off a pass. No goals from individual play. Forces teamwork, passing, and getting open.",
     "Create passing lanes to the net. Shooter must not handle the puck before shooting. Move to shooting position and call for it.",
     "Half ice.", 12, 6, "half", "Pucks",
     U10_UP, '["passing","teamwork","finishing"]', "passing", "high", "v4_goals_from_passes"),

    ("Puck Protect Survival", "small_area_games",
     "One player protects puck in face-off circle. Defender tries to steal. If puck is stolen or leaves circle, switch roles. Time each player's possession. Longest time wins.",
     "Use body as shield. Keep puck on backhand side away from checker. Small controlled movements. Feet always moving.",
     "Face-off circle.", 8, 2, "quarter", "Pucks",
     ALL_AGES, '["puck_protection","balance","compete"]', "puck_control", "medium", "v4_puck_protect_survival"),

    ("Net Front Chaos Game", "small_area_games",
     "Coach shoots pucks into crease area. Two players per team battle for loose pucks and try to score. Rebounds, redirects, scrambles. 30-second shifts. Pure chaos in front of net.",
     "Get body position. Whack at everything near the net. Second and third efforts. Goalies: track the puck through traffic.",
     "Quarter ice. Front of net.", 10, 5, "quarter", "Pucks",
     U10_UP, '["battle","rebounds","net_front"]', "battle", "high", "v4_net_front_chaos"),

    ("Two-Touch Maximum Game", "small_area_games",
     "3v3 or 4v4 where each player can only touch the puck twice before passing. Forces quick thinking, look-ahead passing, and constant movement off puck.",
     "Decide what to do before receiving. First touch controls, second touch passes or shoots. Move immediately after passing.",
     "Half ice.", 12, 6, "half", "Pucks",
     U10_UP, '["quick_thinking","passing","movement"]', "passing", "high", "v4_two_touch_max_game"),

    ("Point Shot Rebound Game", "small_area_games",
     "D shoots from point. Two forwards and two defenders battle for rebound. If forward scores, attacking team gets a point. If D clears, defending team gets point. First to 5.",
     "Forwards: crash the net. Defenders: box out and clear. Rebounds go to whoever works hardest. Stay on your feet.",
     "Half ice. D at point, 2v2 in front.", 12, 5, "half", "Pucks",
     U12_UP, '["rebounds","battle","scoring"]', "battle", "high", "v4_point_shot_rebound_game"),

    # ═══════════════════════════════════════
    # BATTLE / COMPETE (12)
    # ═══════════════════════════════════════
    ("Board Battle Gauntlet", "battle",
     "One-on-one board battles along the wall. Coach dumps puck in. Both players race to retrieve. Winner exits with possession, loser finishes with pushups. Rotate opponents.",
     "Feet to the puck first. Body position between opponent and puck. Low center of gravity. First to puck usually wins.",
     "Half ice. Along the boards.", 10, 0, "half", "Pucks",
     U10_UP, '["battle","boards","compete"]', "battle", "high", "v4_board_battle_gauntlet"),

    ("Corner King Drill", "battle",
     "Two players battle for puck in corner. Player who gains possession must complete a pass to coach at the dot to earn a point. 30-second rounds. Most points wins.",
     "Use leverage — legs wider than opponent. Stick on puck, body on body. Quick transition from battle to play when you win it.",
     "Quarter ice. Corner.", 10, 0, "quarter", "Pucks",
     U10_UP, '["corner","battle","compete"]', "battle", "high", "v4_corner_king"),

    ("Puck Battle Relay", "battle",
     "Two teams. One puck at center ice. First player from each team races to win the puck and score. Next pair goes immediately. Team with most goals after all players go wins.",
     "Explosive start. Arrive first. If you're second, take the body and strip the puck. Finish your chance.",
     "Half ice. Two teams lined up.", 10, 0, "half", "Pucks",
     ALL_AGES, '["race","compete","finishing"]', "battle", "high", "v4_puck_battle_relay"),

    ("Contested Possession Circle", "battle",
     "Two players inside circle. Coach throws puck in. Players battle for possession. Must maintain control for 5 seconds to earn a point. No shooting — pure puck battles.",
     "Body between opponent and puck. Protect with back to checker. Win it low and pull away. Patience after winning possession.",
     "Face-off circle.", 8, 0, "quarter", "Pucks",
     ALL_AGES, '["possession","battle","puck_protection"]', "battle", "high", "v4_contested_possession_circle"),

    ("Five-Second Battle", "battle",
     "Two players battle for a loose puck. They have exactly 5 seconds to gain control and make a play (pass or shot). If neither player controls it, both do a skating penalty.",
     "Urgency from the first step. Win the body position battle immediately. Make a play before time expires.",
     "Quarter ice.", 8, 0, "quarter", "Pucks",
     U10_UP, '["urgency","battle","decision_making"]', "battle", "high", "v4_five_second_battle"),

    ("Gauntlet Puck Carry", "battle",
     "Player must carry puck through a gauntlet of three defenders spaced 15 feet apart. Each defender can only operate within a 10-foot zone. Carrier gets creative to beat each one.",
     "Use fakes to freeze defenders. Change speed through each zone. Protect puck on transitions. Don't stop skating.",
     "Full ice. 3 defenders in zones.", 10, 4, "full", "Pucks, Cones",
     U10_UP, '["puck_protection","deking","creativity"]', "puck_control", "high", "v4_gauntlet_puck_carry"),

    ("Retrieve and Compete", "battle",
     "Coach rims puck around boards. Two players race to retrieve — one from each team. Player who gets puck must protect and outlet pass to teammate. Other player pressures.",
     "Read the rim — anticipate where puck will be. Arrive at full speed. Immediate puck protection on pickup. Find your outlet fast.",
     "Half ice. Along boards.", 10, 4, "half", "Pucks",
     U10_UP, '["rim","retrieval","battle"]', "battle", "high", "v4_retrieve_and_compete"),

    ("Cage Match 1v1", "battle",
     "Confined 1v1 in a small rink area (between blue line and boards wall). Attacker tries to score, defender tries to clear. Physical, tight-space battling. 20-second shifts.",
     "Protect the puck in tight space. Use your body as a shield. Quick feet — don't get pinned. Defender: stay between attacker and net.",
     "Quarter ice. Confined area.", 10, 2, "quarter", "Pucks",
     U12_UP, '["1v1","physical","compete"]', "battle", "high", "v4_cage_match_1v1"),

    ("50/50 Puck Race", "battle",
     "Puck placed at center ice. Two players start from opposite blue lines. Race to the puck. First there gets possession advantage. Play out 1-on-1 to a net.",
     "Explosive start. Low to the puck. If you're first, protect and attack. If you're second, take the body and compete.",
     "Full ice. 2 players from opposite ends.", 10, 2, "full", "Pucks",
     ALL_AGES, '["race","compete","speed"]', "battle", "high", "v4_5050_puck_race"),

    ("Net Drive Battle", "battle",
     "Attacker starts at top of circles with puck. Must drive to net against defender who starts at the dot. Defender tries to angle off and prevent shot. Pure 1v1 to the net.",
     "Attacker: drive hard, protect puck on inside. Defender: match speed, stay on inside hip. Finish strong at the net.",
     "Half ice. 1v1 from circles to net.", 10, 2, "half", "Pucks",
     U10_UP, '["driving_net","1v1","battle"]', "battle", "high", "v4_net_drive_battle"),

    ("Muckers Drill", "battle",
     "Two players in front of net. Coach throws puck into slot. Both players battle for it — one tries to score, other tries to clear. Continuous pucks for 30 seconds.",
     "Low center of gravity. Stick on ice always. Battle for position first, then puck. Rebounds are everything in this drill.",
     "Quarter ice. Net front.", 10, 2, "quarter", "Pucks",
     U10_UP, '["battle","rebounds","toughness"]', "battle", "high", "v4_muckers_drill"),

    ("Win the Race Drill", "battle",
     "Coach shoots puck into corner from center ice. Two players race from blue line to retrieve. Winner keeps possession, loser battles to strip. Play out until shot or clear.",
     "Take the inside lane. Arrive with speed and body control. First to puck must immediately protect. Compete through the whistle.",
     "Half ice. 2 players at blue line.", 10, 2, "half", "Pucks",
     ALL_AGES, '["race","corner","compete"]', "battle", "high", "v4_win_the_race"),

    # ═══════════════════════════════════════
    # PUCK HANDLING (12)
    # ═══════════════════════════════════════
    ("Figure-8 Stickhandling", "puck_handling",
     "Players weave through two cones in a figure-8 pattern while stickhandling. Head up. Progress from slow to fast, then add second puck. Develops hand-eye coordination.",
     "Soft hands — puck stays in the middle of blade. Head up — peripheral vision tracks cones. Quick wrists through the turns.",
     "Station. 2 cones per player.", 8, 0, "quarter", "Pucks, Cones",
     ALL_AGES, '["stickhandling","coordination","control"]', "puck_control", "low", "v4_figure8_stickhandling"),

    ("Toe Drag Series", "puck_handling",
     "Practice toe drag moves: basic pull, pull and shoot, pull across body, pull and backhand finish. Start stationary, progress to in-motion. 10 reps each move.",
     "Blade cups over top of puck. Pull toward body, not laterally. Quick release after the drag — don't add extra moves.",
     "Half ice. Individual work.", 10, 0, "half", "Pucks",
     U10_UP, '["toe_drag","deking","creativity"]', "puck_control", "medium", "v4_toe_drag_series"),

    ("Between the Legs Practice", "puck_handling",
     "Stationary practice of pulling puck between legs and regaining control. Start standing still, progress to gliding, then at speed. Fun skill builder for confident puck handlers.",
     "Spread legs wider than normal. Push puck through with back of blade. Receive with open blade on other side.",
     "Quarter ice. Individual.", 8, 0, "quarter", "Pucks",
     U10_UP, '["creativity","advanced","showtime"]', "puck_control", "low", "v4_between_legs_practice"),

    ("Obstacle Course Handles", "puck_handling",
     "Navigate through a course of cones, tires, and sticks on ice while maintaining puck control. Timed runs. Different paths for different skill levels.",
     "Look ahead to the next obstacle. Puck stays in your control zone — not too far out front. Small quick touches in tight spaces.",
     "Half ice. Various obstacles.", 10, 0, "half", "Pucks, Cones, Sticks",
     ALL_AGES, '["stickhandling","agility","control"]', "puck_control", "medium", "v4_obstacle_course_handles"),

    ("Forehand-Backhand Rapid Switch", "puck_handling",
     "Players stand still and switch puck forehand to backhand as fast as possible for 30 seconds. Count touches. Rest 30 seconds. Repeat 5 times. Beat your previous count.",
     "Soft grip on stick. Quick wrists, not arms. Puck stays in blade's sweet spot. Consistent rhythm.",
     "Station. Individual.", 8, 0, "quarter", "Pucks",
     ALL_AGES, '["stickhandling","speed","technique"]', "puck_control", "medium", "v4_fh_bh_rapid_switch"),

    ("Wide Dangle Drill", "puck_handling",
     "Player approaches defender (cone) and practices wide dangle — extending puck to one side then pulling across body. Progressively add speed and live defenders.",
     "Extend arms fully for the wide reach. Pull puck back inside quickly. Change speed — slow approach, quick move.",
     "Half ice. Cones then live D.", 10, 0, "half", "Pucks, Cones",
     U12_UP, '["deking","wide_moves","1v1"]', "puck_control", "medium", "v4_wide_dangle_drill"),

    ("Puck on a String Circuit", "puck_handling",
     "Players skate through a circuit of 8 cones, keeping the puck attached to their stick like it's on a string. No puck separation at any point. Speed increases each lap.",
     "Hands out front and moving. Small controlled touches. Look at the next cone, not the puck. Flow through the course.",
     "Half ice. 8 cones in circuit.", 10, 0, "half", "Pucks, Cones",
     ALL_AGES, '["control","flow","stickhandling"]', "puck_control", "medium", "v4_puck_on_string_circuit"),

    ("Head-Up Stickhandling Challenge", "puck_handling",
     "Players stickhandle while coach holds up numbers with fingers. Player must call out the number while maintaining puck control. Builds peripheral vision and awareness.",
     "Trust your hands — keep eyes up. Peripheral vision sees the puck. Quick glances down only when needed. Feel the puck on your blade.",
     "Station. Coach faces players.", 8, 0, "quarter", "Pucks",
     ALL_AGES, '["heads_up","awareness","stickhandling"]', "puck_control", "medium", "v4_headup_stickhandling"),

    ("Tight Space Dekes", "puck_handling",
     "In a 10x10 box, player must deke past a defender and maintain possession. Confined space forces creative moves. 5 attempts per player, track successful dekes.",
     "Change of pace is more effective than fancy moves. Protect puck on your strong side. Quick first step after the deke.",
     "Quarter ice. 10x10 box with cones.", 10, 2, "quarter", "Pucks, Cones",
     U10_UP, '["deking","tight_space","creativity"]', "puck_control", "medium", "v4_tight_space_dekes"),

    ("Two-Puck Stickhandling", "puck_handling",
     "Players handle two pucks simultaneously — one on each side of the blade. Start stationary, progress to moving. Extreme coordination challenge for advanced players.",
     "Alternate touches left-right. Controlled rhythm. Don't try to go fast initially — consistency first. It's harder than it looks.",
     "Station. Individual.", 8, 0, "quarter", "Pucks (2 per player)",
     U12_UP, '["advanced","coordination","challenge"]', "puck_control", "low", "v4_two_puck_handling"),

    ("Spin Move Progression", "puck_handling",
     "Practice the spin move (360 turn with puck) at increasing speeds. Start from standstill, progress to half speed, then game speed. Alternate spin direction.",
     "Protect puck on inside of spin. Complete the full rotation. Accelerate out of the spin. Keep blade cupped over puck.",
     "Half ice. Open space.", 10, 0, "half", "Pucks",
     U12_UP, '["spin_move","advanced","creativity"]', "puck_control", "medium", "v4_spin_move_progression"),

    ("Escape Move Series", "puck_handling",
     "Practice 4 escape moves when pressured on boards: 1) Reverse and go other way, 2) Bank off boards to self, 3) Through the legs, 4) Hard stop and cut back. 5 reps each.",
     "Sell the initial direction before escaping. Change speed on the escape — burst away. Protect puck during the move.",
     "Half ice. Along boards.", 12, 0, "half", "Pucks",
     U10_UP, '["escape","puck_protection","creativity"]', "puck_control", "medium", "v4_escape_move_series"),

    # ═══════════════════════════════════════
    # TRANSITION (12)
    # ═══════════════════════════════════════
    ("Quick Up Transition", "transition",
     "On turnover, team immediately passes puck up ice to forwards who have already started transitioning. Practice speed of recognition and execution. From D-zone to attack in 3 passes.",
     "First pass must be quick and hard. Forwards: start moving up before the turnover is complete. Middle lane stays available.",
     "Full ice. 5v5.", 12, 10, "full", "Pucks",
     U12_UP, '["transition","quick_up","breakout"]', "transition", "high", "v4_quick_up_transition"),

    ("Regroup Patterns", "transition",
     "Forwards dump puck in and regroup through neutral zone. D retrieves and hits regrouping forwards with breakout pass. Practice multiple regroup patterns: swing, delay, stretch.",
     "Timing is everything on regroup. Come back with speed to receive. Don't stop in neutral zone — swing through.",
     "Full ice. 3F and 2D.", 12, 5, "full", "Pucks",
     U12_UP, '["regroup","breakout","timing"]', "transition", "medium", "v4_regroup_patterns"),

    ("Turnover Reaction Drill", "transition",
     "5v5 in one zone. Coach blows whistle simulating a turnover. Team that had puck must transition to defense immediately, other team attacks. Tests defensive transition speed.",
     "Puck loss = instant backcheck. Find your check. Defending team: quick recognition, pick up nearest threat. No admiring the play.",
     "Full ice. 5v5.", 12, 10, "full", "Pucks",
     U12_UP, '["transition","backchecking","reaction"]', "transition", "high", "v4_turnover_reaction"),

    ("5-Second Breakout Challenge", "transition",
     "D retrieves puck behind own net. Team has 5 seconds to break out of D-zone and cross red line with control. If they fail, other team gets a power play rush.",
     "Pre-scan before touching puck. First pass options must be in position. Quick feet up ice after pass. Don't panic — execute.",
     "Full ice. 5v5.", 12, 10, "full", "Pucks",
     U14_UP, '["breakout","urgency","execution"]', "systems", "high", "v4_5sec_breakout_challenge"),

    ("D-to-Forward Stretch", "transition",
     "Defenseman retrieves puck, looks up, and hits forward in stride with a stretch pass through neutral zone. Forward attacks with speed. Practice from both sides.",
     "D: head up, find the target early. Forward: time your speed — don't go too early. Stretch pass must be ahead of receiver.",
     "Full ice. D and F pairs.", 10, 0, "full", "Pucks",
     U12_UP, '["stretch_pass","transition","speed"]', "passing", "high", "v4_d_to_f_stretch"),

    ("Counter-Attack Sprint", "transition",
     "Team plays defense in their zone. On winning puck, the three nearest players sprint up ice on a 3-on-2. Remaining players hustle back to defend the return rush.",
     "Win puck = GO. Don't wait for teammates to organize. Speed kills on the counter. Attack with width.",
     "Full ice. 5v5 with transition.", 15, 10, "full", "Pucks",
     U12_UP, '["counter_attack","speed","transition"]', "transition", "high", "v4_counter_attack_sprint"),

    ("Neutral Zone Activation", "transition",
     "Defenseman joins rush through neutral zone as fourth attacker. Practice timing of when D steps up. Forward drops back to cover D's position. Role swap transitions.",
     "D: join when puck crosses red line with control. Forward: recognize D joining and drop back. Communication prevents both going.",
     "Full ice. 5-player unit.", 12, 5, "full", "Pucks",
     U14_UP, '["d_activation","transition","offense"]', "transition", "medium", "v4_nz_activation"),

    ("3-Zone Transition Flow", "transition",
     "Continuous 3-zone flow drill. Breakout in D-zone, regroup through neutral zone, attack in O-zone. After shot, other team breaks out the other way. Non-stop transitions.",
     "No standing still between zones. Each zone requires a different speed and structure. Communicate through every transition.",
     "Full ice. Two groups alternating.", 15, 10, "full", "Pucks",
     U12_UP, '["flow","transition","systems"]', "transition", "high", "v4_3zone_transition_flow"),

    ("Forecheck to Breakout Reversal", "transition",
     "Team A forechecks in offensive zone. Team B wins puck and breaks out. Team A must immediately switch to backchecking. Live reps — continuous pressure and transition.",
     "Forecheckers: if you lose the puck battle, become backcheckers instantly. No coasting. Sprint back harder than you forechecked.",
     "Full ice. 5v5.", 12, 10, "full", "Pucks",
     U14_UP, '["forecheck","backcheck","transition"]', "transition", "high", "v4_forecheck_breakout_reversal"),

    ("Rim and Chase", "transition",
     "D rims puck around the boards. Forward reads the rim, retrieves, and makes a quick play — pass, carry, or shoot within 3 seconds. Practice reading rim speed and angle.",
     "Read the rim early — anticipate landing spot. Arrive at speed. Quick decision after pickup — don't over-handle.",
     "Half ice. D rims, F retrieves.", 10, 2, "half", "Pucks",
     U10_UP, '["rim","retrieval","decision_making"]', "transition", "medium", "v4_rim_and_chase"),

    ("Controlled Exit Drill", "transition",
     "Under PK-like pressure, team must exit their zone with control (no icing). Practice outlets: up the boards, reverse behind net, D-to-D, stretch pass. Each exit must cross red line.",
     "Scan before you get the puck. If primary option is covered, reset behind the net. Don't force — patient exit beats icing.",
     "Full ice. 5 vs 2 forecheckers.", 12, 7, "full", "Pucks",
     U12_UP, '["zone_exit","composure","breakout"]', "systems", "medium", "v4_controlled_exit"),

    ("Transition 2-on-1 Generator", "transition",
     "5v5 play in one zone. On whistle, coach dumps puck to other end. Nearest two players from each team race to create a 2-on-1. Quick transition from structured play to rush.",
     "React to whistle — first step matters. Communicate with partner immediately. Attack with speed and width. Defender: take away pass, force shot.",
     "Full ice. 5v5 transitioning to 2v1.", 12, 10, "full", "Pucks",
     U12_UP, '["transition","odd_man","speed"]', "transition", "high", "v4_transition_2on1_gen"),

    # ═══════════════════════════════════════
    # GOALIE (10)
    # ═══════════════════════════════════════
    ("Butterfly Recovery Speed", "goalie",
     "Goalie drops to butterfly and recovers to feet as fast as possible. Coach blows whistle for down, blows again for up. 10 reps. Progress to recovery and lateral push.",
     "Push off both pads evenly. Stick stays on ice during recovery. Get set before next shot — don't rush into bad position.",
     "Crease area.", 8, 1, "quarter", "None",
     U10_UP, '["butterfly","recovery","quickness"]', "goalie", "high", "v4_butterfly_recovery"),

    ("Post-to-Post Tracking", "goalie",
     "Puck moves D-to-D at point. Goalie slides post to post tracking the puck. Practice T-push and butterfly slide. Shot comes from either side randomly.",
     "Lead with stick. Seal post on arrival. Eyes on puck — don't look at your feet. Square to puck at all times.",
     "Half ice. Two D at point.", 10, 3, "half", "Pucks",
     U10_UP, '["lateral_movement","post_play","tracking"]', "goalie", "medium", "v4_post_to_post_tracking"),

    ("Rebound Control Drill", "goalie",
     "Coach takes 20 shots from various angles. Goalie focuses on directing rebounds to corners (away from slot). Track how many rebounds go to safe areas vs dangerous areas.",
     "Active stick for low shots. Absorb with body for chest shots. Guide pads to angle rebounds to corners. No rebounds to the slot.",
     "Half ice. Coach shooting.", 12, 1, "half", "Pucks",
     U10_UP, '["rebounds","control","technique"]', "goalie", "medium", "v4_rebound_control"),

    ("Screen Shot Reaction", "goalie",
     "Player screens goalie while coach shoots from point. Goalie must find the puck through traffic and make the save. Practice looking around and through screens.",
     "Find the puck before the shot. Move head to see around screen. Trust your reflexes if screened. Stay big and centered.",
     "Half ice. Screener in front, shooter at point.", 12, 3, "half", "Pucks",
     U12_UP, '["screens","reaction","tracking"]', "goalie", "high", "v4_screen_shot_reaction"),

    ("Breakaway Technique", "goalie",
     "Forwards come in on breakaway from center ice. Goalie practices challenging — skating out to top of crease, reading the shooter, and making the save. 10 breakaways.",
     "Challenge to top of crease. Read the shooter's hands and eyes. Stay patient — don't commit early. Make yourself big.",
     "Full ice. Forward from center, goalie in net.", 12, 0, "full", "Pucks",
     U10_UP, '["breakaway","positioning","patience"]', "goalie", "high", "v4_breakaway_technique"),

    ("Lateral Quickness Drill", "goalie",
     "Coach alternates shots from left dot, right dot, left dot — rapid fire. Goalie must move laterally and reset between each shot. 3 sets of 10 shots.",
     "Push off posting foot for lateral movement. Get set before shot — don't slide into the save. Stick stays in five-hole.",
     "Half ice. Shooters at both dots.", 10, 3, "half", "Pucks",
     U10_UP, '["lateral","quickness","recovery"]', "goalie", "high", "v4_lateral_quickness"),

    ("Puck Handling for Goalies", "goalie",
     "Goalie practices playing the puck behind the net — stopping rims, making outlet passes, and clearing dump-ins. Forward pressures on some reps to add urgency.",
     "Read the dump-in angle. Set puck for D or fire up boards. Only play it when you're confident. Leave it for D when pressured.",
     "Half ice. D and F support.", 10, 3, "half", "Pucks",
     U12_UP, '["puck_handling","clearing","decision_making"]', "goalie", "medium", "v4_goalie_puck_handling"),

    ("Cross-Crease Save Drill", "goalie",
     "Puck starts on one side of ice. Quick cross-crease pass for a one-timer on opposite side. Goalie must push across and make the save. 10 reps each direction.",
     "Read the pass — push immediately when puck crosses. Lead with stick and blocker. Arrive square to shooter. Pad seal on ice.",
     "Half ice. Passers and shooters.", 12, 3, "half", "Pucks",
     U12_UP, '["cross_crease","reaction","positioning"]', "goalie", "high", "v4_cross_crease_save"),

    ("Down-Up-Save Sequence", "goalie",
     "Goalie starts on knees (butterfly). Pops up, shuffles left, drops for save. Pops up, shuffles right, drops for save. Continuous for 60 seconds. Builds explosive recovery.",
     "Explosive pop-up. Controlled shuffle — don't over-slide. Drop into save position, not just dropping. Repeat with intensity.",
     "Crease area.", 8, 1, "quarter", "Pucks",
     U10_UP, '["conditioning","recovery","explosiveness"]', "goalie", "high", "v4_down_up_save_sequence"),

    ("Goalie Angle Play", "goalie",
     "Shooter moves along the perimeter from sharp angle to slot to opposite angle. Goalie adjusts position to maintain proper angle and depth. Coach evaluates positioning at each spot.",
     "Stay centered on puck. Depth adjusts with angle — deeper on sharp angles, higher on slot shots. Controlled movements, not lunging.",
     "Half ice. Shooter moves, goalie tracks.", 10, 2, "half", "Pucks",
     U10_UP, '["angles","positioning","depth"]', "goalie", "medium", "v4_goalie_angle_play"),

    # ═══════════════════════════════════════
    # CONDITIONING (10)
    # ═══════════════════════════════════════
    ("Suicide Sprints", "conditioning",
     "Sprint to near blue line and back, red line and back, far blue line and back, far goal line and back. That's one rep. Complete 3 reps with 60-second rest between.",
     "Explosive starts from each line. Hard stops — no gliding. Maintain form even when tired. It's mental as much as physical.",
     "Full ice.", 10, 0, "full", None,
     U12_UP, '["sprints","endurance","mental_toughness"]', "conditioning", "high", "v4_suicide_sprints"),

    ("30-Second All-Out Shifts", "conditioning",
     "Players skate all-out for 30 seconds — forward, backward, crossovers, stops and starts. Whistle signals change of movement. 30 seconds on, 60 seconds rest. 8 reps.",
     "Maximum effort every second. Recovery happens during rest. Simulate game-intensity shifts. Don't pace yourself.",
     "Full ice.", 12, 0, "full", None,
     U12_UP, '["game_simulation","intensity","endurance"]', "conditioning", "high", "v4_30sec_allout_shifts"),

    ("Pyramid Skating", "conditioning",
     "Skate 1 lap, rest 10 seconds. Skate 2 laps, rest 20 seconds. Skate 3 laps, rest 30. Then back down: 2 laps, 1 lap. Tests endurance and recovery ability.",
     "Consistent pace on each set. Don't start too fast. Use rest wisely — deep breaths, recovery position. Maintain form.",
     "Full ice.", 15, 0, "full", None,
     U12_UP, '["endurance","pacing","mental"]', "conditioning", "high", "v4_pyramid_skating"),

    ("Partner Drag Race", "conditioning",
     "One player holds partner's stick and provides resistance while partner skates forward. Drag for 30 seconds, switch. Builds explosive skating strength. 4 rounds each.",
     "Skater: drive hard through resistance. Low body position, full extension. Resistance player: consistent drag, don't jerk.",
     "Full ice. Partners.", 10, 0, "full", None,
     U12_UP, '["strength","power","partner"]', "conditioning", "high", "v4_partner_drag_race"),

    ("Interval Skating Circuit", "conditioning",
     "5 stations, 40 seconds each, 20 seconds transition: Station 1 — Forward sprints. Station 2 — Backward skating. Station 3 — Lateral slides. Station 4 — Crossover weave. Station 5 — Rest.",
     "Max effort at each station. Quick transition between stations. Track heart rate recovery during rest station.",
     "Full ice. Stations marked.", 15, 0, "full", "Cones",
     U12_UP, '["intervals","variety","endurance"]', "conditioning", "high", "v4_interval_circuit"),

    ("Puck Carry Sprint Relay", "conditioning",
     "Teams of 3-4. Sprint length of ice with puck, pass to next teammate at other end. First team to complete all legs wins. Combines speed with puck control under fatigue.",
     "Control the puck even when tired. Clean exchange at each end. Speed without the puck is wasted if you lose it.",
     "Full ice. Teams of 3-4.", 10, 0, "full", "Pucks",
     ALL_AGES, '["sprint","relay","puck_control"]', "conditioning", "high", "v4_puck_carry_sprint_relay"),

    ("Battle Rope Skating", "conditioning",
     "Players skate while dragging a rope attached to a tire or weighted sled. Build leg drive and skating power. Half-ice lengths, 5 reps with 45-second rest.",
     "Stay low — power comes from legs, not back. Full stride extension against resistance. Lean forward into the pull.",
     "Half ice.", 12, 0, "half", "Rope, Weighted Sled",
     U14_UP, '["strength","power","skating"]', "conditioning", "high", "v4_battle_rope_skating"),

    ("Hockey-Specific Tabata", "conditioning",
     "20 seconds max effort, 10 seconds rest. 8 rounds. Exercises: sprint with puck, defensive slides, forward-backward transitions, crossover sprints. Hockey movements only.",
     "True Tabata means absolute maximum for 20 seconds. Don't pace. The 10-second rest will feel short — embrace it.",
     "Full ice.", 8, 0, "full", "Pucks",
     U14_UP, '["tabata","intensity","sport_specific"]', "conditioning", "high", "v4_hockey_tabata"),

    ("Red Line Challenge", "conditioning",
     "Players must skate from goal line to red line and back as many times as possible in 60 seconds. Track reps. Rest 2 minutes. Beat your score on round 2.",
     "Strong starts from each line. Efficient stops — minimize time on turns. Mental toughness — push through the burn.",
     "Full ice.", 8, 0, "full", None,
     U10_UP, '["speed","endurance","competition"]', "conditioning", "high", "v4_red_line_challenge"),

    ("Continuous 5v5 Shifts", "conditioning",
     "Full-ice 5v5 game with mandatory 30-second shifts. Whistle blows, current players sprint to bench, fresh 5 jumps on. Simulates game-pace line changes.",
     "Go hard knowing it's only 30 seconds. Sprint off the ice on change. Jump on at full speed — no gliding to position.",
     "Full ice. 3 lines of 5.", 20, 15, "full", "Pucks",
     U12_UP, '["game_simulation","conditioning","compete"]', "conditioning", "high", "v4_continuous_5v5_shifts"),

    # ═══════════════════════════════════════
    # WARM UP (8)
    # ═══════════════════════════════════════
    ("Chaos Skating Warm-Up", "warm_up",
     "All players skate freely around the ice, changing direction on whistle. Progress to backward skating, crossovers only, one-foot glides. Gets blood flowing with variety.",
     "Keep heads up — avoid collisions. Use the entire ice surface. Gradually increase speed. Listen for whistle cues.",
     "Full ice.", 6, 0, "full", None,
     ALL_AGES, '["warm_up","fun","skating"]', "skating", "low", "v4_chaos_skating_warmup"),

    ("Progressive Speed Laps", "warm_up",
     "Three laps at 50% speed, two laps at 75%, one lap at 100%. Rest 30 seconds. Repeat. Gradually activates muscles and increases heart rate.",
     "Start easy — don't sprint cold. Build speed smoothly. Focus on form at each pace. Full range of motion.",
     "Full ice.", 8, 0, "full", None,
     ALL_AGES, '["warm_up","progressive","skating"]', "skating", "low", "v4_progressive_speed_laps"),

    ("Stick Handling Warm-Up Flow", "warm_up",
     "Players skate easy laps while stickhandling. Progress: forehand only, backhand only, wide handles, tight handles, eyes up. Warms up hands and skating simultaneously.",
     "Relaxed grip. Smooth transitions between forehand and backhand. Don't look at the puck — feel it on the blade.",
     "Full ice.", 6, 0, "full", "Pucks",
     ALL_AGES, '["warm_up","stickhandling","skating"]', "puck_control", "low", "v4_stickhandling_warmup_flow"),

    ("Partner Tag Game", "warm_up",
     "Partners play tag on the ice — one chases, one evades. Switch every 30 seconds. Quick bursts and direction changes warm up skating muscles. Fun and competitive.",
     "Use edges and direction changes to evade. Chase with purpose — don't just follow. Quick bursts of acceleration.",
     "Half ice. Pairs.", 5, 0, "half", None,
     ALL_AGES, '["warm_up","fun","agility"]', "skating", "medium", "v4_partner_tag_warmup"),

    ("Goalie Warm-Up Progression", "warm_up",
     "Goalies follow a structured warm-up: lateral slides (10 each way), butterfly drops and recoveries (10), easy shots from outside circles (10), medium shots from dots (10).",
     "Control each movement — don't rush. Build confidence with easy saves first. Track the puck into your body on every shot.",
     "Half ice. Goalie and shooter.", 10, 2, "half", "Pucks",
     ALL_AGES, '["warm_up","goalie","progressive"]', "goalie", "low", "v4_goalie_warmup_progression"),

    ("Dynamic Stretching Circuit", "warm_up",
     "Players skate through stations with dynamic stretches on ice: leg swings, hip openers, torso rotations, arm circles while gliding. Full body activation before practice.",
     "Control each stretch. Don't bounce. Full range of motion. Keep moving between stations — no standing still.",
     "Full ice. 4 stations.", 8, 0, "full", None,
     ALL_AGES, '["warm_up","stretching","mobility"]', "skating", "low", "v4_dynamic_stretch_circuit"),

    ("Passing Pairs Warm-Up", "warm_up",
     "Partners skate side by side passing back and forth. Progress from forehand to backhand to saucer. Warm up hands and passing touch while skating.",
     "Tape to tape at low speed. Gradually increase skating speed and passing difficulty. Communication between partners.",
     "Full ice. Pairs with pucks.", 6, 0, "full", "Pucks",
     ALL_AGES, '["warm_up","passing","partner"]', "passing", "low", "v4_passing_pairs_warmup"),

    ("Shot Clock Warm-Up", "warm_up",
     "Players take easy shots from outside circles for 3 minutes. Focus on technique not power. Warms up shooting muscles, hand-eye coordination, and gives goalies easy initial shots.",
     "Smooth release. Pick spots — don't just blast it. Watch the puck hit your target. Gradually add power.",
     "Half ice. Players shoot from distance.", 6, 0, "half", "Pucks",
     ALL_AGES, '["warm_up","shooting","technique"]', "shooting", "low", "v4_shot_clock_warmup"),

    # ═══════════════════════════════════════
    # SYSTEMS (10)
    # ═══════════════════════════════════════
    ("Forecheck 1-2-2 Walkthrough", "systems",
     "Walk through the 1-2-2 forecheck system. F1 pressures puck carrier, F2 and F3 fill the middle lanes, D1 and D2 stay at the blue line. Progress from walk-through to full speed.",
     "F1: angle to strong side boards. F2: take away D-to-D. F3: support middle. D: stay home at the line unless puck turns over.",
     "Full ice. 5-player unit.", 15, 5, "full", "Pucks",
     U12_UP, '["forecheck","1_2_2","systems"]', "systems", "medium", "v4_forecheck_122"),

    ("Breakout Option Routes", "systems",
     "Practice 3 breakout patterns: up the boards (direct), reverse behind net (indirect), and D-to-D (switch). Run each pattern 5 times. Players must read which option is open.",
     "D: scan before touching puck. If boards is covered, reverse. If reverse is pressured, D-to-D. Make the easy play.",
     "Full ice. 5-player unit.", 15, 5, "full", "Pucks",
     U12_UP, '["breakout","options","reading"]', "systems", "medium", "v4_breakout_option_routes"),

    ("Defensive Zone Coverage (Man)", "systems",
     "Practice man-to-man coverage in D-zone. Each defender picks up an attacker. Walk through assignments on D-zone faceoffs, puck behind net, and cycle plays.",
     "Stay with your man — don't get pulled to the puck. Inside position at all times. Switch only when communication confirms it.",
     "Half ice. 5 defenders vs 5 attackers.", 15, 10, "half", "Pucks",
     U14_UP, '["d_zone","man_coverage","systems"]', "systems", "medium", "v4_dzone_man_coverage"),

    ("Offensive Zone Cycle System", "systems",
     "Teach the standard cycle system: puck goes low, support from middle, high man covers the point. Practice the three roles and how they rotate as puck moves.",
     "Low man protects and cycles. Middle man reads and fills. High man stays high for escape pass. Puck dictates rotation.",
     "Half ice. 3 forwards.", 15, 3, "half", "Pucks",
     U12_UP, '["cycle","offensive_zone","structure"]', "systems", "medium", "v4_ozone_cycle_system"),

    ("Neutral Zone Forecheck Options", "systems",
     "Practice three neutral zone forechecks: 1-2-2, 1-4 trap, and aggressive 2-1-2. Walk through each against opposing unit. Coach calls which system during play.",
     "Know all three systems. Transition between them on coach's call. Read the play — some situations dictate which forecheck to use.",
     "Full ice. 5v5.", 15, 10, "full", "Pucks",
     U14_UP, '["neutral_zone","forecheck","adaptability"]', "systems", "medium", "v4_nz_forecheck_options"),

    ("Line Change Communication", "systems",
     "Practice communication during line changes — who goes, who stays, when to change. Simulate game scenarios where bad changes lead to odd-man rushes.",
     "Short shifts. Change when puck is deep in O-zone. Never change on a turnover. Call your replacement by name.",
     "Full ice. 3 lines.", 10, 15, "full", None,
     U12_UP, '["line_change","communication","discipline"]', "systems", "low", "v4_line_change_comm"),

    ("Dump and Chase System", "systems",
     "Practice the dump-and-chase zone entry. F1 dumps smart (ring, chip, hard around). F2 chases to retrieve. F3 fills middle. D follows play to blue line. Execute 10 reps.",
     "Smart dumps — don't just throw it in. Ring works when D is slow. Chip to soft areas. Chase player arrives at full speed.",
     "Full ice. 5-player unit.", 12, 5, "full", "Pucks",
     U12_UP, '["dump_and_chase","zone_entry","systems"]', "systems", "high", "v4_dump_chase_system"),

    ("Controlled Zone Entry System", "systems",
     "Practice controlled zone entries against a 1-3-1 PK setup. Carry across blue line, pass across, or delay. Read defender positioning to choose correct entry method.",
     "Speed through the neutral zone. Read the gap — tight gap means pass or delay, loose gap means carry. Width on entry.",
     "Full ice. 5v5.", 12, 10, "full", "Pucks",
     U14_UP, '["zone_entry","controlled","reading"]', "systems", "medium", "v4_controlled_zone_entry"),

    ("Full-Ice System Integration", "systems",
     "Run full sequence: D-zone coverage → breakout → neutral zone transition → zone entry → offensive zone cycle. Walk through at half speed then full speed. Film for review.",
     "Every player has a role in every zone. Know your job before the puck arrives. Communicate through each transition.",
     "Full ice. Full 5-player unit.", 20, 5, "full", "Pucks",
     U14_UP, '["full_system","integration","structure"]', "systems", "medium", "v4_full_ice_integration"),

    ("Shift Structure Teaching", "systems",
     "Practice the concept of a 45-second shift. Players must accomplish their objective within the shift window. Simulate game scenarios with timed shifts and mandatory changes.",
     "Go hard for 45 seconds. Play within the system during your shift. When buzzer sounds, get off — no exceptions. Fresh legs win.",
     "Full ice. 5v5 with clock.", 15, 15, "full", "Pucks",
     U12_UP, '["shift_length","discipline","game_management"]', "systems", "high", "v4_shift_structure"),

    # ═══════════════════════════════════════
    # STATION SETUP (8)
    # ═══════════════════════════════════════
    ("Four Station Skill Circuit", "station_setup",
     "Station 1: Stickhandling through cones. Station 2: Passing accuracy targets. Station 3: Shooting on net. Station 4: Edge work slalom. 3 minutes per station, rotate on whistle.",
     "Focus on quality at each station. Don't rush — technique over speed. Coaches positioned at key stations for feedback.",
     "Full ice. 4 zones.", 15, 0, "full", "Pucks, Cones, Targets",
     ALL_AGES, '["stations","skills","variety"]', "puck_control", "medium", "v4_four_station_circuit"),

    ("Three-Zone Practice Plan", "station_setup",
     "Zone 1 (D-zone): Defensive drills. Zone 2 (neutral zone): Skating and conditioning. Zone 3 (O-zone): Offensive skills and shooting. Rotate every 5 minutes.",
     "Each zone has a specific focus. Players engaged for full 5 minutes. Quick transitions between zones.",
     "Full ice. 3 groups.", 18, 0, "full", "Pucks, Cones",
     ALL_AGES, '["stations","organization","variety"]', "puck_control", "medium", "v4_three_zone_plan"),

    ("Goalie Station While Skaters Drill", "station_setup",
     "Goalies have their own station with tracking drills, movement exercises, and controlled shots while skaters run separate drills. Both groups active simultaneously.",
     "Goalies need structured practice too. Dedicate a coach to the goalie station. Alternate easy and challenging reps.",
     "Full ice. Split goalies and skaters.", 15, 0, "full", "Pucks, Cones",
     ALL_AGES, '["stations","goalie","organization"]', "goalie", "medium", "v4_goalie_station_split"),

    ("Competition Station Circuit", "station_setup",
     "4 stations, each a mini competition: fastest skater, hardest shot (speed gun), accuracy challenge, 1v1 battle. Keep score across all stations. Overall champion crowned.",
     "Track scores publicly — drives competition. Fair matchups at battle station. Celebrate effort and improvement, not just winning.",
     "Full ice. 4 stations.", 20, 0, "full", "Pucks, Cones, Targets, Speed Gun",
     U10_UP, '["competition","testing","fun"]', "puck_control", "high", "v4_competition_circuit"),

    ("Beginner Skills Circuit", "station_setup",
     "Age-appropriate stations for young players: Station 1: Skating ABC's. Station 2: Puck push and carry. Station 3: Easy passing with partner. Station 4: Fun shooting gallery.",
     "Keep it fun. Lots of encouragement. Short attention spans — change every 3 minutes. Smiles are the best metric at this age.",
     "Full ice. 4 stations.", 15, 0, "full", "Pucks, Cones",
     U8_U10, '["beginner","fun","fundamentals"]', "puck_control", "low", "v4_beginner_skills_circuit"),

    ("D-Specific Skills Station", "station_setup",
     "Stations designed for defensemen: Station 1: Gap control footwork. Station 2: Breakout passing accuracy. Station 3: Point shot through traffic. Station 4: 1v1 defensive angling.",
     "Position-specific work builds confidence. Defensemen get reps they don't get in regular practice. Encourage D to own these skills.",
     "Full ice. D-men rotate stations.", 20, 0, "full", "Pucks, Cones",
     U12_UP, '["defensemen","position_specific","skills"]', "positioning", "medium", "v4_d_specific_stations"),

    ("Forward Skills Station", "station_setup",
     "Forward-specific stations: Station 1: Deking through cones. Station 2: Net-front tips and deflections. Station 3: Cycle passing patterns. Station 4: Odd-man rush finishing.",
     "Forwards need offensive creativity. Let them be creative at the deking station. Reward good shot selection and net-front work.",
     "Full ice. Forwards rotate.", 20, 0, "full", "Pucks, Cones",
     U12_UP, '["forwards","position_specific","offense"]', "shooting", "medium", "v4_forward_skills_stations"),

    ("High Tempo Full Practice", "station_setup",
     "8 stations, 2 minutes each, 15-second transition. Maximum ice usage, maximum touches, no standing in line. Every player active for the full 20 minutes. Coach assigns groups.",
     "Short stations = high intensity. Plan transitions in advance. Whistle means move immediately. Every second of ice is valuable.",
     "Full ice. 8 stations.", 20, 0, "full", "Pucks, Cones, Targets",
     ALL_AGES, '["high_tempo","organization","maximum_touches"]', "puck_control", "high", "v4_high_tempo_practice"),

    # ═══════════════════════════════════════
    # FUN (6)
    # ═══════════════════════════════════════
    ("Shootout Tournament", "fun",
     "Bracket-style shootout tournament. Each player gets one breakaway attempt. Winners advance, losers are eliminated. Final round is best of 3. Prize for champion.",
     "Each player chooses their best move. Goalies compete for fewest goals allowed. Build excitement — announce matchups. Crowd (teammates) cheers.",
     "Full ice. All players and goalies.", 15, 0, "full", "Pucks",
     ALL_AGES, '["fun","shootout","competition"]', "shooting", "medium", "v4_shootout_tournament"),

    ("Freeze Tag on Ice", "fun",
     "Classic freeze tag adapted for ice. Two taggers, everyone else evades. When tagged, freeze in place until a free player skates through your legs. Last unfrozen player wins.",
     "Keep it moving — no hiding in corners. Taggers work together. Frozen players: spread legs wide for rescue. Great for young players.",
     "Full ice.", 8, 0, "full", None,
     U8_U12, '["fun","skating","game"]', "skating", "medium", "v4_freeze_tag_ice"),

    ("Hockey Bowling", "fun",
     "Set up plastic pins (water bottles) at one end of the ice. Players shoot pucks from the blue line trying to knock down pins. Keep score. Most pins down in 3 frames wins.",
     "Accuracy over power. Pick your target. Great way to end practice on a fun note. Celebrate strikes and spares.",
     "Half ice.", 8, 0, "half", "Pucks, Water Bottles",
     ALL_AGES, '["fun","shooting","accuracy"]', "shooting", "low", "v4_hockey_bowling"),

    ("Relay Race Medley", "fun",
     "Teams of 4 race in relay format. Leg 1: forward sprint. Leg 2: backward sprint. Leg 3: puck carry through cones. Leg 4: shoot and score before team finishes. Losing team does 5 pushups.",
     "Team energy matters. Cheer for your teammates. Clean transitions between legs. The shootout at the end adds pressure and fun.",
     "Full ice. Teams of 4.", 10, 0, "full", "Pucks, Cones",
     ALL_AGES, '["fun","relay","team_building"]', "skating", "high", "v4_relay_race_medley"),

    ("Target Practice Carnival", "fun",
     "Multiple shooting targets set up around the ice — top corners, five hole cutout, moving target on a string. Players earn points for hitting different targets. Carnival atmosphere.",
     "Take your time. Aim small, miss small. Try different shot types on different targets. Prize for highest scorer adds motivation.",
     "Half ice. Various targets.", 12, 0, "half", "Pucks, Targets",
     ALL_AGES, '["fun","shooting","accuracy"]', "shooting", "low", "v4_target_carnival"),

    ("British Bulldogs on Ice", "fun",
     "One player in the middle tries to tag others skating across the ice. Tagged players join the middle. Last player standing wins. Classic kids' game adapted for hockey.",
     "Heads up always. Use speed and deception to avoid taggers. Taggers spread out and work together. Pure fun skating game.",
     "Full ice.", 8, 0, "full", None,
     U8_U12, '["fun","skating","game"]', "skating", "high", "v4_british_bulldogs_ice"),

    # ═══════════════════════════════════════
    # COOL DOWN (5)
    # ═══════════════════════════════════════
    ("Easy Lap Cool Down", "cool_down",
     "Three easy laps at 40% effort. Players chat and relax while legs recover. Gradually decrease speed each lap. Allows heart rate to come down naturally.",
     "No racing. Conversation pace. Enjoy the ice. This is recovery time — treat it that way.",
     "Full ice.", 5, 0, "full", None,
     ALL_AGES, '["cool_down","recovery","easy"]', "skating", "low", "v4_easy_lap_cooldown"),

    ("Stretching Circle", "cool_down",
     "Team gathers at center ice in a circle. Captain or coach leads static stretches for major muscle groups: quads, hamstrings, groin, hip flexors, shoulders. Hold each 20 seconds.",
     "Breathe through each stretch. Don't bounce. Hold gently — no pain. Great time for team communication.",
     "Center ice circle.", 8, 0, "quarter", None,
     ALL_AGES, '["cool_down","stretching","team"]', "conditioning", "low", "v4_stretching_circle"),

    ("Puck Handling Flow Cool Down", "cool_down",
     "Easy skating with puck. Free stickhandling at comfortable pace. Players practice moves they want to work on at low intensity. Creative time to experiment.",
     "Relax and have fun with the puck. Try new moves. No pressure. This is play time after hard work.",
     "Full ice.", 5, 0, "full", "Pucks",
     ALL_AGES, '["cool_down","stickhandling","creative"]', "puck_control", "low", "v4_puckhandling_cooldown"),

    ("Partner Stretch Session", "cool_down",
     "Partners assist each other with stretches. One player stretches while partner provides gentle resistance or support. Covers hip flexors, hamstrings, groin, and shoulders.",
     "Gentle assistance — never force a stretch. Communicate about pressure level. Hold each position for 20-30 seconds.",
     "Center ice or bench area.", 8, 0, "quarter", None,
     U10_UP, '["cool_down","stretching","partner"]', "conditioning", "low", "v4_partner_stretch"),

    ("Team Debrief on Ice", "cool_down",
     "Team gathers at center ice for a quick 3-minute debrief while cooling down. Coach highlights 2-3 positives from practice and one thing to work on. Ends with team cheer.",
     "Keep it positive and short. Ask players what they learned. Build toward next practice. End on a high note always.",
     "Center ice.", 5, 0, "quarter", None,
     ALL_AGES, '["cool_down","team_building","communication"]', "conditioning", "low", "v4_team_debrief_ice"),

    # ═══════════════════════════════════════
    # SKILLS TESTING (5)
    # ═══════════════════════════════════════
    ("Skating Speed Test", "skills_testing",
     "Timed sprint from goal line to far blue line and back. Each player gets 2 attempts, best time counts. Record results for progress tracking throughout the season.",
     "Explosive start. Hard stop at blue line — efficient turn. Full sprint back. Record times accurately for comparison.",
     "Full ice. Stopwatch required.", 10, 0, "full", "Stopwatch",
     ALL_AGES, '["testing","speed","baseline"]', "skating", "high", "v4_skating_speed_test"),

    ("Shooting Accuracy Assessment", "skills_testing",
     "Each player takes 10 shots at marked targets on the net from the hash marks. Record hits out of 10 for each player. Test from both sides. Compare to previous assessments.",
     "Consistent distance and angle for fair testing. No slap shots — controlled wrist shots. Record which corners are strongest/weakest.",
     "Half ice. Targets on net.", 12, 0, "half", "Pucks, Targets",
     U10_UP, '["testing","shooting","accuracy"]', "shooting", "medium", "v4_shooting_accuracy_test"),

    ("Agility Course Time Trial", "skills_testing",
     "Standardized agility course: forward sprint, tight turns around cones, backward skating, lateral slides, stop and start. Timed for each player. Repeat quarterly to track improvement.",
     "Same course layout every time for fair comparison. Warm up before testing. Record times and share improvements. Celebrate progress.",
     "Half ice. Standardized cone setup.", 15, 0, "half", "Cones, Stopwatch",
     ALL_AGES, '["testing","agility","progress"]', "skating", "high", "v4_agility_time_trial"),

    ("Puck Control Challenge", "skills_testing",
     "Timed stickhandling course through 10 cones with shot on net at the end. Must maintain control — any lost puck adds 2-second penalty. Best of 2 attempts.",
     "Control over speed. Tight turns around cones. Clean shot at the end counts toward score. Track improvement over season.",
     "Half ice. 10 cones, net.", 12, 0, "half", "Pucks, Cones, Stopwatch",
     ALL_AGES, '["testing","puck_control","progress"]', "puck_control", "medium", "v4_puck_control_challenge"),

    ("Endurance Skate Test", "skills_testing",
     "Players skate continuous laps at a set pace (beep test on ice). Pace increases every minute. Players eliminated when they can't keep pace. Last player skating earns top endurance rank.",
     "Start conservative — don't burn out early. Consistent pace is key. Mental toughness separates the last 5 players. Record levels achieved.",
     "Full ice. Beep test audio.", 15, 0, "full", "Speaker/Audio",
     U12_UP, '["testing","endurance","baseline"]', "conditioning", "high", "v4_endurance_skate_test"),
]


def seed_drills_v4():
    """Seed 200 v4 drills (idempotent — skips existing concept_ids)."""
    from main import get_db
    conn = get_db()
    try:
        existing = conn.execute(
            "SELECT concept_id FROM drills WHERE concept_id LIKE ?", ("v4_%",)
        ).fetchall()
        existing_ids = {r[0] for r in existing}
        added = 0
        for d in DRILLS_V4:
            cid = d[13]
            if cid in existing_ids:
                continue
            conn.execute("""
                INSERT INTO drills (id, org_id, name, category, description, coaching_points, setup,
                    duration_minutes, players_needed, ice_surface, equipment, age_levels, tags,
                    skill_focus, intensity, concept_id)
                VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), *d))
            added += 1
        conn.commit()
        print(f"[SEED] Drills v4: {added} new drills seeded ({len(existing_ids)} already existed)")
    finally:
        conn.close()


if __name__ == "__main__":
    seed_drills_v4()

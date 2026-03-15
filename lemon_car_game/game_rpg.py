#!/usr/bin/env python3
"""
Lemon Car Game — Retro RPG Version (Game Boy-style)

Walk around a small car town, visit buildings, and make deals.
Same game mechanics as the original — new pixel-art RPG presentation.

Controls:
  Arrow keys  — Walk
  ENTER       — Interact / Confirm
  ESC         — Cancel / Back
  Q/W         — Lower/Raise rate (providers)
"""

import pygame
import sys
import random
import os

os.environ["SDL_VIDEO_CENTERED"] = "1"

from game import (
    GameState, CAR_SOURCES, NUM_BLOCKS, ACTIONS_PER_BLOCK, MAX_CARRYOVER,
    FEE_MECHANIC_BASE, FEE_INVESTIGATOR_BASE, FEE_RATE_MIN, FEE_RATE_MAX,
    LISTING_FEE, LEMON_SELLER_PENALTY, CAR_LEMON_MULT,
    bot_seller_commit, bot_buyer_commit,
    ResolvedListing,
)

# Slash constants for dispute/call-out system
from game import SLASH_SELLER_PCT, SLASH_MECHANIC_PCT, SLASH_PI_PCT
BRIBE_AMOUNTS = [1.0, 2.0, 3.0]

# ═══════════════════════════════════════════════════════════════════════════
# Constants
# ═══════════════════════════════════════════════════════════════════════════

TILE = 16
SCALE = 3
ST = TILE * SCALE                       # 48 px per rendered tile
MAP_W, MAP_H = 16, 11
DIALOG_H = 168
WIDTH = MAP_W * ST                      # 768
HEIGHT = MAP_H * ST + DIALOG_H          # 696
FPS = 60
MOVE_FRAMES = 6                         # frames per tile walk

# Tile IDs
G, R, W, D, T, RF, WA, FN, SN = range(9)
WALKABLE = {G, R}

# ═══════════════════════════════════════════════════════════════════════════
# Palette
# ═══════════════════════════════════════════════════════════════════════════

C_BG        = (232, 240, 208)
C_GRASS     = (120, 184, 80)
C_GRASS2    = (104, 168, 72)
C_ROAD      = (176, 168, 144)
C_ROAD_LN   = (200, 192, 172)
C_WALL      = (184, 152, 120)
C_WALL_WIN  = (128, 168, 200)
C_ROOF      = (176, 80, 64)
C_DOOR      = (120, 80, 48)
C_KNOB      = (200, 184, 64)
C_TREE_TOP  = (48, 120, 48)
C_TREE_HI   = (64, 140, 56)
C_TRUNK     = (112, 72, 32)
C_WATER     = (80, 144, 200)
C_FENCE     = (176, 160, 128)
C_SIGN_BG   = (200, 180, 140)
C_SIGN_POST = (112, 80, 48)

C_DLG_BG    = (16, 24, 32)
C_DLG_BRD   = (200, 200, 180)
C_TEXT       = (240, 240, 240)
C_TEXT_HL    = (255, 220, 80)
C_TEXT_DIM   = (140, 140, 140)
C_MENU_SEL  = (48, 56, 72)

ROLE_PAL = {
    "seller":       ((200, 80, 80),  (80, 64, 128)),
    "buyer":        ((80, 128, 200), (64, 64, 96)),
    "mechanic":     ((80, 168, 80),  (96, 80, 64)),
    "investigator": ((168, 120, 200),(64, 64, 80)),
}

# ═══════════════════════════════════════════════════════════════════════════
# Map
# ═══════════════════════════════════════════════════════════════════════════

GAME_MAP = [
    #  0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
    [ T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T],  # 0
    [ T, G,RF,RF, G, G, R, R, G, G,RF,RF, G, G, G, T],  # 1
    [ T, G, W, D, G, G, R, R, G, G, W, D, G, G, G, T],  # 2
    [ T, G, G, G, G, G, R, R, G, G, G, G, G, G, G, T],  # 3
    [ T, R, R, R, R, R, R, R, R, R, R, R, R, R, R, T],  # 4
    [ T, G, G, G, G, G, R, R, G, G, G, G, G, G, G, T],  # 5
    [ T, G, G, G, G, G, R,SN, G, G, G, G, G, G, G, T],  # 6
    [ T, G,RF,RF, G, G, R, R, G, G, G,RF,RF, G, G, T],  # 7
    [ T, G, W, D, G, G, R, R, G, G, G, W, D, G, G, T],  # 8
    [ T, G, G, G, G, G, R, R, G, G, G, G, G, G, G, T],  # 9
    [ T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T],  # 10
]

BUILDING_DOORS = {
    (3, 2):  "Car Lot",
    (11, 2): "Mechanic",
    (3, 8):  "Market",
    (12, 8): "PI Office",
}

BUILDING_LABELS = {
    "Car Lot":   (2, 1),
    "Mechanic":  (10, 1),
    "Market":    (2, 7),
    "PI Office": (11, 7),
}

TOWN_HALL_POS = (7, 6)

# ═══════════════════════════════════════════════════════════════════════════
# Tile renderer (cached)
# ═══════════════════════════════════════════════════════════════════════════

_tile_cache = {}

def _render_tile(tid, col, row):
    key = (tid, col % 2, row % 2)
    if key in _tile_cache:
        return _tile_cache[key]
    s = pygame.Surface((ST, ST))
    checker = (col + row) % 2

    if tid == G:
        s.fill(C_GRASS if checker == 0 else C_GRASS2)
    elif tid == R:
        s.fill(C_ROAD)
        for i in range(0, ST, 12):
            pygame.draw.line(s, C_ROAD_LN, (i, ST // 2), (i + 6, ST // 2), 1)
    elif tid == W:
        s.fill(C_WALL)
        wr = pygame.Rect(ST // 4, ST // 4, ST // 2, ST // 3)
        pygame.draw.rect(s, C_WALL_WIN, wr)
        pygame.draw.rect(s, (80, 64, 48), wr, 2)
        pygame.draw.line(s, (80, 64, 48), (wr.centerx, wr.top), (wr.centerx, wr.bottom), 1)
        pygame.draw.line(s, (80, 64, 48), (wr.left, wr.centery), (wr.right, wr.centery), 1)
    elif tid == D:
        s.fill(C_WALL)
        dr = pygame.Rect(ST // 4, 4, ST // 2, ST - 4)
        pygame.draw.rect(s, C_DOOR, dr)
        pygame.draw.rect(s, (80, 56, 32), dr, 2)
        pygame.draw.circle(s, C_KNOB, (dr.right - 8, dr.centery), 3)
    elif tid == T:
        s.fill(C_GRASS)
        cx = ST // 2
        pygame.draw.rect(s, C_TRUNK, (cx - 4, ST // 2, 8, ST // 2))
        pygame.draw.circle(s, (32, 100, 32), (cx, ST // 3), ST // 3)
        pygame.draw.circle(s, C_TREE_TOP, (cx, ST // 3), ST // 3 - 4)
        pygame.draw.circle(s, C_TREE_HI, (cx - 5, ST // 3 - 4), ST // 5)
    elif tid == RF:
        s.fill(C_BG)
        pts = [(0, ST - 1), (ST // 2, 6), (ST - 1, ST - 1)]
        pygame.draw.polygon(s, C_ROOF, pts)
        pygame.draw.polygon(s, (140, 64, 48), pts, 2)
    elif tid == SN:
        base = C_GRASS if checker == 0 else C_GRASS2
        s.fill(base)
        pygame.draw.rect(s, C_SIGN_POST, (ST // 2 - 3, ST // 3, 6, ST * 2 // 3))
        br = pygame.Rect(ST // 6, ST // 8, ST * 2 // 3, ST // 3)
        pygame.draw.rect(s, C_SIGN_BG, br)
        pygame.draw.rect(s, (80, 64, 48), br, 2)
    else:
        s.fill(C_BG)

    _tile_cache[key] = s
    return s


def build_map_surface():
    surf = pygame.Surface((MAP_W * ST, MAP_H * ST))
    for row in range(MAP_H):
        for col in range(MAP_W):
            tile = _render_tile(GAME_MAP[row][col], col, row)
            surf.blit(tile, (col * ST, row * ST))
    return surf

# ═══════════════════════════════════════════════════════════════════════════
# Sprite helpers
# ═══════════════════════════════════════════════════════════════════════════

def _make_char(shirt, pants, facing="down", frame=0):
    s = pygame.Surface((ST, ST), pygame.SRCALPHA)
    cx, cy = ST // 2, ST // 2
    skin = (224, 184, 144)
    hair = (80, 56, 40)
    shoe = (64, 48, 32)
    body_y = cy - 4
    head_y = body_y - 14

    pygame.draw.ellipse(s, skin, (cx - 8, head_y, 16, 16))
    pygame.draw.ellipse(s, hair, (cx - 9, head_y - 2, 18, 10))
    if facing == "down":
        pygame.draw.rect(s, (32, 32, 32), (cx - 4, head_y + 7, 3, 3))
        pygame.draw.rect(s, (32, 32, 32), (cx + 1, head_y + 7, 3, 3))
    elif facing == "left":
        pygame.draw.rect(s, (32, 32, 32), (cx - 6, head_y + 7, 3, 3))
    elif facing == "right":
        pygame.draw.rect(s, (32, 32, 32), (cx + 3, head_y + 7, 3, 3))

    pygame.draw.rect(s, shirt, (cx - 9, body_y, 18, 14))
    pygame.draw.rect(s, shirt, (cx - 13, body_y + 3, 4, 10))
    pygame.draw.rect(s, shirt, (cx + 9, body_y + 3, 4, 10))

    leg_off = 2 if frame == 1 else 0
    pygame.draw.rect(s, pants, (cx - 7 - leg_off, body_y + 14, 6, 9))
    pygame.draw.rect(s, pants, (cx + 1 + leg_off, body_y + 14, 6, 9))
    pygame.draw.rect(s, shoe, (cx - 8 - leg_off, body_y + 23, 7, 3))
    pygame.draw.rect(s, shoe, (cx + 1 + leg_off, body_y + 23, 7, 3))
    return s


def make_player_sprites(role):
    shirt, pants = ROLE_PAL.get(role, ROLE_PAL["buyer"])
    sprites = {}
    for d in ("down", "up", "left", "right"):
        sprites[d] = [_make_char(shirt, pants, d, f) for f in range(2)]
    return sprites


def make_npc_sprite(role):
    shirt, pants = ROLE_PAL.get(role, ((160, 160, 160), (80, 80, 80)))
    return _make_char(shirt, pants, "down", 0)

# ═══════════════════════════════════════════════════════════════════════════
# Dialog box
# ═══════════════════════════════════════════════════════════════════════════

class Dialog:
    IDLE = 0
    TEXT = 1
    MENU = 2

    def __init__(self, font, font_sm):
        self.font = font
        self.font_sm = font_sm
        self.state = self.IDLE
        self.title = ""
        self.lines = []
        self.menu = []          # [{"label": str, "value": any}, ...]
        self.selected = 0
        self.callback = None
        self.status_line = ""

    def show_text(self, title, lines, status=""):
        self.state = self.TEXT
        self.title = title
        self.lines = lines if isinstance(lines, list) else [lines]
        self.menu = []
        self.status_line = status

    def show_menu(self, title, items, callback, status=""):
        self.state = self.MENU
        self.title = title
        self.lines = []
        self.menu = items
        self.selected = 0
        self.callback = callback
        self.status_line = status

    def close(self):
        self.state = self.IDLE
        self.callback = None

    def handle_key(self, key):
        if self.state == self.TEXT:
            if key in (pygame.K_RETURN, pygame.K_SPACE):
                self.close()
                return "closed"
        elif self.state == self.MENU:
            if key == pygame.K_UP:
                self.selected = (self.selected - 1) % len(self.menu)
            elif key == pygame.K_DOWN:
                self.selected = (self.selected + 1) % len(self.menu)
            elif key in (pygame.K_RETURN, pygame.K_SPACE):
                val = self.menu[self.selected]["value"]
                cb = self.callback
                self.close()
                if cb:
                    cb(val)
                return "selected"
            elif key == pygame.K_ESCAPE:
                self.close()
                return "cancelled"
        return None

    def draw(self, screen):
        if self.state == self.IDLE:
            return
        y0 = HEIGHT - DIALOG_H
        box = pygame.Rect(0, y0, WIDTH, DIALOG_H)
        pygame.draw.rect(screen, C_DLG_BG, box)
        pygame.draw.rect(screen, C_DLG_BRD, box, 3)
        pygame.draw.line(screen, C_DLG_BRD, (0, y0 + 2), (WIDTH, y0 + 2), 1)

        x, y = 16, y0 + 10
        if self.title:
            screen.blit(self.font.render(self.title, True, C_TEXT_HL), (x, y))
            y += 24

        if self.state == self.TEXT:
            for line in self.lines[:6]:
                screen.blit(self.font_sm.render(line, True, C_TEXT), (x, y))
                y += 20
            prompt_y = y0 + DIALOG_H - 24
            screen.blit(self.font_sm.render("ENTER to continue",
                        True, C_TEXT_DIM), (x, prompt_y))

        elif self.state == self.MENU:
            for i, item in enumerate(self.menu):
                if i >= 6:
                    break
                label = item["label"]
                is_sel = (i == self.selected)
                if is_sel:
                    sel_rect = pygame.Rect(x - 4, y - 1, WIDTH - 24, 20)
                    pygame.draw.rect(screen, C_MENU_SEL, sel_rect)
                    screen.blit(self.font_sm.render(f"> {label}", True, C_TEXT_HL),
                                (x, y))
                else:
                    screen.blit(self.font_sm.render(f"  {label}", True, C_TEXT),
                                (x, y))
                y += 20

        if self.status_line:
            screen.blit(self.font_sm.render(self.status_line, True, C_TEXT_DIM),
                        (x, y0 + DIALOG_H - 24))

# ═══════════════════════════════════════════════════════════════════════════
# RPG Game State wrapper
# ═══════════════════════════════════════════════════════════════════════════

class RPGState:
    def __init__(self, human_role):
        self.gs = GameState(human_role)
        self.human_role = human_role
        self.seller_phase_done = False
        self.block_results = []
        # Lemon purchases from prev block that buyer can dispute
        self.pending_disputes = []

    @property
    def hp(self):
        return self.gs.human_player

    def begin_block(self):
        self.gs.start_block()
        self.gs.phase = "seller_commit"
        self.seller_phase_done = False
        self.block_results = []
        if self.human_role != "seller":
            bot_seller_commit(self.gs)
            self.gs.resolve_seller_phase()
            self.gs.phase = "buyer_commit"
            self.seller_phase_done = True

    def end_block(self, listing_corruption=None):
        if listing_corruption is not None:
            self.gs.listing_corruption = dict(listing_corruption)
        if not self.seller_phase_done:
            bot_seller_commit(self.gs)
            self.gs.resolve_seller_phase()
            self.gs.phase = "buyer_commit"
            self.seller_phase_done = True
        bot_buyer_commit(self.gs)
        self.gs.resolve_buyer_phase()
        self.block_results = list(self.gs.block_summary)
        if self.gs.block_num < NUM_BLOCKS:
            self.gs.save_actions_for_carryover()

    def is_last_block(self):
        return self.gs.block_num >= NUM_BLOCKS

    def status_text(self):
        hp = self.hp
        al = self.gs.actions_left(hp)
        mx = self.gs.actions_max.get(hp.id, ACTIONS_PER_BLOCK)
        return (f"Block {self.gs.block_num}/{NUM_BLOCKS}  |  "
                f"Bal: {hp.balance:.1f}  |  "
                f"Actions: {al}/{mx}  |  "
                f"Role: {hp.role}")

# ═══════════════════════════════════════════════════════════════════════════
# Main Game
# ═══════════════════════════════════════════════════════════════════════════

DIR_DELTA = {"up": (0, -1), "down": (0, 1), "left": (-1, 0), "right": (1, 0)}

class RPGGame:
    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT))
        pygame.display.set_caption("Lemon Car Game — RPG")
        self.clock = pygame.time.Clock()
        self.font = pygame.font.SysFont("consolas", 18, bold=True)
        self.font_sm = pygame.font.SysFont("consolas", 15)
        self.font_label = pygame.font.SysFont("consolas", 12, bold=True)
        self.dialog = Dialog(self.font, self.font_sm)

        self.map_surf = build_map_surface()
        self.state_mode = "role_select"   # role_select | playing | game_over
        self.selected_role = 0
        self.rpg = None                   # RPGState

        # Player position (grid coords)
        self.px, self.py = 7, 5
        self.facing = "down"
        self.walk_frame = 0
        self.move_timer = 0               # frames remaining in current move
        self.move_dx = 0
        self.move_dy = 0

        self.player_sprites = {}
        self.npc_sprites = {}
        self.npc_positions = {}
        self.msg_timer = 0
        self.msg_text = ""

        # Mafia-style state: held car (seller picks up at Car Lot)
        self.held_car = None
        # Corruption tracking per listing (for slashing)
        self.listing_metadata = {}
        # PI pre-bribes: listing_idx -> {"pi_bribed": True, "bribed_pi_id": id}
        self.bribe_ledger = {}

    # ── helpers ──

    def _flash(self, text):
        self.msg_text = text
        self.msg_timer = 120

    def _can_walk(self, col, row):
        if col < 0 or col >= MAP_W or row < 0 or row >= MAP_H:
            return False
        if GAME_MAP[row][col] not in WALKABLE:
            return False
        for pos in self.npc_positions.values():
            if pos == (col, row):
                return False
        return True

    def _face_tile(self):
        dx, dy = DIR_DELTA[self.facing]
        return self.px + dx, self.py + dy

    def _building_at_face(self):
        fc, fr = self._face_tile()
        return BUILDING_DOORS.get((fc, fr))

    def _at_town_hall(self):
        fc, fr = self._face_tile()
        return (fc, fr) == TOWN_HALL_POS

    # ── setup ──

    def _setup_game(self, role):
        self.rpg = RPGState(role)
        self.held_car = None
        self.listing_metadata = {}
        self.bribe_ledger = {}
        self.player_sprites = make_player_sprites(role)
        self.npc_positions = {}
        self.npc_sprites = {}
        roles = ["seller", "buyer", "mechanic", "investigator"]
        npc_spots = [(4, 3), (4, 9), (12, 3), (13, 9)]
        for i, r in enumerate(roles):
            if r != role:
                self.npc_sprites[r] = make_npc_sprite(r)
                self.npc_positions[r] = npc_spots[i]
        self.px, self.py = 7, 5
        self.facing = "down"
        self.rpg.begin_block()
        self.state_mode = "playing"
        self.dialog.close()
        self._flash(f"Block 1 — you are {role}")

    def _clear_block_state(self):
        """Clear RPG-specific state at block end. Held car persists across blocks."""
        self.listing_metadata = {}
        self.bribe_ledger = {}

    # ── interactions ──

    def _interact_car_lot(self):
        gs = self.rpg.gs
        hp = self.rpg.hp
        if hp.role != "seller":
            self.dialog.show_text("Car Lot", [
                "This is where sellers pick up cars.",
                "You're not a seller — just browsing.",
            ])
            return
        if self.held_car:
            self.dialog.show_text("Car Lot", [
                f"You already have a car: [{self.held_car['tier']}] "
                f"{self.held_car['price']:.1f} ETH.",
                "Go to Mechanic, PI Office, or Market to list it.",
            ])
            return
        al = gs.actions_left(hp)
        if al < 1:
            self.dialog.show_text("Car Lot", ["No actions left this block."])
            return
        items = []
        for t in list(CAR_SOURCES.keys()):
            src = CAR_SOURCES[t]
            items.append({
                "label": f"Pick up [{t}]  P_lemon={src['p_lemon']:.0%}  "
                         f"val={src['value_min']}-{src['value_max']}",
                "value": ("tier", t),
            })
        items.append({"label": "Back", "value": ("back",)})
        self.dialog.show_menu(
            "Car Lot — pick a risk tier (1 action)",
            items, self._on_car_lot_tier, self.rpg.status_text())

    def _on_car_lot_tier(self, val):
        if val[0] == "back":
            return
        tier = val[1]
        gs = self.rpg.gs
        hp = self.rpg.hp
        if not gs.use_action(hp):
            self._flash("No actions left.")
            return
        src = CAR_SOURCES.get(tier, CAR_SOURCES["standard"])
        is_lemon = random.random() < src["p_lemon"]
        vmin, vmax = src["value_min"], src["value_max"]
        car_value = vmin + random.random() * (vmax - vmin)
        mult = src.get("price_mult", 1.0)
        price = round(car_value * mult * (0.85 + random.random() * 0.3), 2)
        self.held_car = {
            "tier": tier,
            "is_lemon": is_lemon,
            "car_value": car_value,
            "price": price,
            "mechanic_report": None,
            "inspected_by": None,
            "mechanic_bribed": False,
            "mechanic_fee": 0.0,
            "mechanic_bribe": 0.0,
            "pi_bribed": False,
            "bribed_pi_id": None,
            "pi_bribe": 0.0,
        }
        lemon_tag = "LEMON!" if is_lemon else "Good"
        self.dialog.show_text("Car Lot", [
            f"You picked up a [{tier}] car.",
            f"Value: {car_value:.1f}  Price: {price:.1f} ETH",
            f"Condition (only you see this): {lemon_tag}",
            "Go to Mechanic or PI Office, then Market to list.",
        ])

    def _interact_market(self):
        gs = self.rpg.gs
        hp = self.rpg.hp
        listings = gs.resolved_listings
        if hp.role == "seller":
            if not self.held_car:
                self.dialog.show_text("Market", [
                    "Get a car from the Car Lot first.",
                    "Then bring it here to list.",
                ])
                return
            al = gs.actions_left(hp)
            if al < 1:
                self.dialog.show_text("Market", ["No actions left."])
                return
            if hp.balance < LISTING_FEE:
                self.dialog.show_text("Market",
                    [f"Need {LISTING_FEE} ETH listing fee."])
                return
            price = self.held_car["price"]
            tag = ""
            if self.held_car.get("mechanic_report") is True:
                tag = " [PASS]"
            elif self.held_car.get("mechanic_report") is False:
                tag = " [FAIL]"
            self.dialog.show_menu(
                f"List car for {price:.1f} ETH? ({LISTING_FEE} fee){tag}",
                [{"label": "List", "value": True}, {"label": "Cancel", "value": False}],
                self._on_market_seller_list)
            return
        if hp.role != "buyer":
            n = len(listings)
            self.dialog.show_text("Market", [
                f"{n} listing(s) on the market right now.",
                "Only buyers can purchase here.",
            ])
            return
        if not listings:
            self.dialog.show_text("Market", ["No listings this block."])
            return
        items = []
        for i, rl in enumerate(listings):
            tag = ""
            if rl.mechanic_report is True:
                tag = " [PASS]"
            elif rl.mechanic_report is False:
                tag = " [FAIL]"
            items.append({
                "label": f"#{i+1}  {rl.price:.1f} ETH  from {rl.seller}{tag}",
                "value": ("select", i),
            })
        items.append({"label": "Back", "value": ("back",)})
        self.dialog.show_menu("Market — select a listing", items,
                              self._on_market_select, self.rpg.status_text())

    def _on_market_seller_list(self, do_list):
        if not do_list:
            return
        gs = self.rpg.gs
        hp = self.rpg.hp
        if not self.held_car or gs.actions_left(hp) < 1 or hp.balance < LISTING_FEE:
            return
        hp.balance -= LISTING_FEE
        gs.use_action(hp)
        rl = ResolvedListing(
            hp, self.held_car["price"], self.held_car["is_lemon"],
            self.held_car["car_value"], self.held_car.get("mechanic_report"),
            inspected_by=self.held_car.get("inspected_by"),
            mechanic_bribed=self.held_car.get("mechanic_bribed", False),
            mechanic_fee=self.held_car.get("mechanic_fee", 0.0),
            mechanic_bribe=self.held_car.get("mechanic_bribe", 0.0))
        idx = len(gs.resolved_listings)
        gs.resolved_listings.append(rl)
        self.listing_metadata[idx] = {
            "inspected_by": self.held_car.get("inspected_by"),
            "mechanic_bribed": self.held_car.get("mechanic_bribed", False),
            "mechanic_fee": self.held_car.get("mechanic_fee", 0.0),
            "mechanic_bribe": self.held_car.get("mechanic_bribe", 0.0),
            "pi_bribed": self.held_car.get("pi_bribed", False),
            "bribed_pi_id": self.held_car.get("bribed_pi_id"),
            "pi_bribe": self.held_car.get("pi_bribe", 0.0),
            "actual_lemon": self.held_car["is_lemon"],
        }
        self.bribe_ledger[idx] = {"pi_bribed": self.held_car.get("pi_bribed", False),
                                  "bribed_pi_id": self.held_car.get("bribed_pi_id")}
        self.held_car = None
        self._flash("Listed! Buyers can now purchase.")

    def _on_market_select(self, val):
        if val[0] == "back":
            return
        idx = val[1]
        gs = self.rpg.gs
        hp = self.rpg.hp
        rl = gs.resolved_listings[idx]
        al = gs.actions_left(hp)
        items = []
        if al >= 1:
            items.append({
                "label": f"BUY for {rl.price:.1f} ETH  (1 action)",
                "value": ("buy", idx),
            })
        invs = gs.players_by_role("investigator")
        mechs = gs.players_by_role("mechanic")
        if al >= 1:
            for inv in invs:
                rate = gs.inv_rates.get(inv.id, FEE_INVESTIGATOR_BASE)
                items.append({
                    "label": f"Investigate via {inv} ({rate:.2f} ETH)"
                             f" — reveals lemon, auto-cancels buy",
                    "value": ("investigate", idx, inv.id),
                })
            for m in mechs:
                rate = gs.mechanic_rates.get(m.id, FEE_MECHANIC_BASE)
                items.append({
                    "label": f"Inspect via {m} ({rate:.2f} ETH)",
                    "value": ("inspect", idx, m.id),
                })
        items.append({"label": "Back to listings", "value": ("back",)})
        self.dialog.show_menu(
            f"Listing #{idx+1} — {rl.price:.1f} ETH",
            items, self._on_market_action, self.rpg.status_text())

    def _on_market_action(self, val):
        gs = self.rpg.gs
        hp = self.rpg.hp
        if val[0] == "back":
            self._interact_market()
            return
        if val[0] == "buy":
            ok, msg = gs.queue_buyer_buy(hp, val[1])
            self._flash(msg or "Queued buy!")
        elif val[0] == "investigate":
            ok, msg = gs.queue_buyer_investigate(hp, val[1], val[2])
            self._flash(msg or "Queued investigation!")
        elif val[0] == "inspect":
            ok, msg = gs.queue_buyer_inspect(hp, val[1], val[2])
            self._flash(msg or "Queued inspection!")

    def _interact_mechanic(self):
        gs = self.rpg.gs
        hp = self.rpg.hp
        mechs = gs.players_by_role("mechanic")

        if hp.role == "mechanic":
            rate = gs.mechanic_rates.get(hp.id, FEE_MECHANIC_BASE)
            demand = gs.last_mech_demand.get(hp.id, 0)
            items = [
                {"label": f"Raise rate (+0.25)  current: {rate:.2f}",
                 "value": "raise"},
                {"label": f"Lower rate (-0.25)  current: {rate:.2f}",
                 "value": "lower"},
                {"label": "Back", "value": "back"},
            ]
            title = (f"Your Shop — rate: {rate:.2f} ETH  "
                     f"(last demand: {demand})")
            self.dialog.show_menu(title, items,
                                  self._on_mechanic, self.rpg.status_text())
        elif hp.role == "seller":
            if not self.held_car:
                self.dialog.show_text("Mechanic Shop", [
                    "Get a car from the Car Lot first.",
                    "Then bring it here for inspection.",
                ])
                return
            if self.held_car.get("mechanic_report") is not None:
                self.dialog.show_text("Mechanic Shop", [
                    "Your car is already inspected.",
                    "Go to Market to list it.",
                ])
                return
            al = gs.actions_left(hp)
            if al < 1:
                self.dialog.show_text("Mechanic Shop", ["No actions left."])
                return
            items = []
            for m in mechs:
                rate = gs.mechanic_rates.get(m.id, FEE_MECHANIC_BASE)
                if hp.balance >= rate:
                    items.append({
                        "label": f"Inspect via {m}  ({rate:.2f} ETH)",
                        "value": ("inspect", m.id),
                    })
            if not items:
                self.dialog.show_text("Mechanic Shop",
                    [f"Need {min(gs.mechanic_rates.get(m.id, FEE_MECHANIC_BASE) for m in mechs):.2f}+ ETH for inspection."])
                return
            items.append({"label": "Back", "value": ("back",)})
            self.dialog.show_menu("Mechanic Shop — choose mechanic",
                                  items, self._on_mechanic_seller,
                                  self.rpg.status_text())
        else:
            lines = ["Mechanic rates this block:"]
            for m in mechs:
                rate = gs.mechanic_rates.get(m.id, FEE_MECHANIC_BASE)
                lines.append(f"  {m}: {rate:.2f} ETH")
            self.dialog.show_text("Mechanic Shop", lines)

    def _on_mechanic(self, val):
        gs = self.rpg.gs
        hp = self.rpg.hp
        rate = gs.mechanic_rates.get(hp.id, FEE_MECHANIC_BASE)
        if val == "raise":
            rate = min(FEE_RATE_MAX, round(rate + 0.25, 2))
            gs.mechanic_rates[hp.id] = rate
            self._flash(f"Rate: {rate:.2f} ETH")
        elif val == "lower":
            rate = max(FEE_RATE_MIN, round(rate - 0.25, 2))
            gs.mechanic_rates[hp.id] = rate
            self._flash(f"Rate: {rate:.2f} ETH")

    def _on_mechanic_seller(self, val):
        if val[0] == "back":
            return
        mech_id = val[1]
        gs = self.rpg.gs
        hp = self.rpg.hp
        if not self.held_car or not gs.use_action(hp):
            self._flash("No actions or no car.")
            return
        mech = next((p for p in gs.players if p.id == mech_id), None)
        if not mech:
            return
        rate = gs.mechanic_rates.get(mech_id, FEE_MECHANIC_BASE)
        if hp.balance < rate:
            self._flash("Can't afford inspection.")
            return
        hp.balance -= rate
        mech.balance += rate
        mech.inspections_done += 1
        self.held_car["mechanic_fee"] = rate

        if self.held_car["is_lemon"]:
            items = [{"label": f"Offer bribe: {b} ETH", "value": ("bribe", b)}
                     for b in BRIBE_AMOUNTS if hp.balance >= b]
            items.append({"label": "No bribe (honest FAIL report)",
                         "value": ("nobribe",)})
            items.append({"label": "Back", "value": ("back",)})
            self.dialog.show_menu(
                f"Mechanic sees LEMON. Bribe to get PASS? (you have {hp.balance:.1f} ETH)",
                items, lambda v: self._on_mechanic_bribe_choice(v, mech_id, rate))
        else:
            self.held_car["mechanic_report"] = True
            self.held_car["inspected_by"] = mech_id
            self.held_car["mechanic_bribed"] = False
            self._flash("Inspection: PASS (car is good)")

    def _on_mechanic_bribe_choice(self, val, mech_id, fee_paid):
        if val[0] == "back":
            mech = next((p for p in self.rpg.gs.players if p.id == mech_id), None)
            if mech:
                self.rpg.hp.balance += fee_paid
                mech.balance -= fee_paid
            return
        if val[0] == "nobribe":
            self.held_car["mechanic_report"] = False
            self.held_car["inspected_by"] = mech_id
            self.held_car["mechanic_bribed"] = False
            self._flash("Mechanic reported FAIL (honest)")
            return
        if val[0] != "bribe":
            return
        bribe = val[1]
        mech = next((p for p in self.rpg.gs.players if p.id == mech_id), None)
        hp = self.rpg.hp
        if not mech or hp.balance < bribe:
            self.held_car["mechanic_report"] = False
            self.held_car["inspected_by"] = mech_id
            self.held_car["mechanic_bribed"] = False
            self._flash("Couldn't pay bribe — FAIL report")
            return
        if mech.is_human:
            self.dialog.show_menu(
                f"Seller offers {bribe} ETH bribe to say PASS (lie). Accept?",
                [{"label": "Accept (lie)", "value": True},
                 {"label": "Refuse (truth)", "value": False}],
                lambda accept: self._on_mechanic_bribe_response(
                    accept, mech_id, bribe, fee_paid))
        else:
            greed = random.uniform(1.0, 3.5)
            accepted = bribe >= greed
            self._apply_mechanic_bribe_result(accepted, mech_id, bribe, fee_paid)

    def _on_mechanic_bribe_response(self, accept, mech_id, bribe, fee_paid):
        self._apply_mechanic_bribe_result(accept, mech_id, bribe, fee_paid)

    def _apply_mechanic_bribe_result(self, accepted, mech_id, bribe, fee_paid):
        mech = next((p for p in self.rpg.gs.players if p.id == mech_id), None)
        hp = self.rpg.hp
        if accepted and hp.balance >= bribe:
            hp.balance -= bribe
            mech.balance += bribe
            self.held_car["mechanic_report"] = True
            self.held_car["mechanic_bribed"] = True
            self.held_car["mechanic_bribe"] = bribe
            self._flash("Bribe accepted — mechanic reports PASS (lie!)")
        else:
            self.held_car["mechanic_report"] = False
            self.held_car["mechanic_bribed"] = False
            self._flash("Bribe refused — mechanic reports FAIL")
        self.held_car["inspected_by"] = mech_id

    def _interact_pi(self):
        gs = self.rpg.gs
        hp = self.rpg.hp
        invs = gs.players_by_role("investigator")
        if hp.role == "investigator":
            rate = gs.inv_rates.get(hp.id, FEE_INVESTIGATOR_BASE)
            items = [
                {"label": f"Raise rate (+0.25)  current: {rate:.2f}",
                 "value": "raise"},
                {"label": f"Lower rate (-0.25)  current: {rate:.2f}",
                 "value": "lower"},
                {"label": "Back", "value": "back"},
            ]
            self.dialog.show_menu("PI Office (your office!)", items,
                                  self._on_pi, self.rpg.status_text())
        elif hp.role == "seller" and self.held_car and self.held_car["is_lemon"] and not self.held_car["pi_bribed"]:
            items = []
            for inv in invs:
                if hp.balance >= 1.0:
                    items.append({
                        "label": f"Pre-bribe {inv} (1-3 ETH) — corrupt future investigations",
                        "value": ("bribe", inv.id),
                    })
            if items:
                items.append({"label": "Skip (no bribe)", "value": ("skip",)})
            items.append({"label": "Back", "value": ("back",)})
            self.dialog.show_menu("PI Office — pre-bribe to lie about your lemon?",
                                  items or [{"label": "Need 1+ ETH to bribe", "value": ("back",)}],
                                  self._on_pi_seller_bribe, self.rpg.status_text())
        elif hp.role == "seller":
            if self.held_car:
                self.dialog.show_text("PI Office", [
                    "Pre-bribe only works for lemons.",
                    "Your car is good — no need to bribe.",
                ])
            else:
                self.dialog.show_text("PI Office", [
                    "Get a car from the Car Lot first.",
                    "If it's a lemon, you can pre-bribe a PI here.",
                ])
        else:
            lines = ["Investigator rates this block:"]
            for inv in invs:
                rate = gs.inv_rates.get(inv.id, FEE_INVESTIGATOR_BASE)
                you = " (YOU)" if inv.is_human else ""
                lines.append(f"  {inv}{you}: {rate:.2f} ETH")
            self.dialog.show_text("PI Office", lines)

    def _on_pi_seller_bribe(self, val):
        if val[0] in ("back", "skip"):
            return
        if val[0] != "bribe":
            return
        inv_id = val[1]
        gs = self.rpg.gs
        hp = self.rpg.hp
        inv = next((p for p in gs.players if p.id == inv_id), None)
        if not inv or not self.held_car or not self.held_car["is_lemon"]:
            return
        items = [{"label": f"Offer {b} ETH", "value": b} for b in BRIBE_AMOUNTS if hp.balance >= b]
        items.append({"label": "Cancel", "value": None})
        self.dialog.show_menu(
            f"Bribe amount for {inv}? (you have {hp.balance:.1f} ETH)",
            items, lambda b: self._on_pi_bribe_amount(b, inv_id))

    def _on_pi_bribe_amount(self, bribe, inv_id):
        if bribe is None:
            return
        gs = self.rpg.gs
        hp = self.rpg.hp
        inv = next((p for p in gs.players if p.id == inv_id), None)
        if not inv or hp.balance < bribe:
            return
        if inv.is_human:
            self.dialog.show_menu(
                f"Seller offers {bribe} ETH to lie about a lemon. Accept?",
                [{"label": "Accept (lie)", "value": True},
                 {"label": "Refuse", "value": False}],
                lambda accept: self._on_pi_bribe_response(accept, inv_id, bribe))
        else:
            greed = random.uniform(1.0, 3.5)
            self._apply_pi_bribe(bribe >= greed, inv_id, bribe)

    def _on_pi_bribe_response(self, accept, inv_id, bribe):
        self._apply_pi_bribe(accept, inv_id, bribe)

    def _apply_pi_bribe(self, accepted, inv_id, bribe):
        hp = self.rpg.hp
        inv = next((p for p in self.rpg.gs.players if p.id == inv_id), None)
        if accepted and inv and hp.balance >= bribe:
            hp.balance -= bribe
            inv.balance += bribe
            self.held_car["pi_bribed"] = True
            self.held_car["bribed_pi_id"] = inv_id
            self.held_car["pi_bribe"] = bribe
            self._flash("PI bribed — investigations will LIE")
        else:
            self._flash("PI refused bribe")

    def _on_pi(self, val):
        gs = self.rpg.gs
        hp = self.rpg.hp
        rate = gs.inv_rates.get(hp.id, FEE_INVESTIGATOR_BASE)
        if val == "raise":
            rate = min(FEE_RATE_MAX, round(rate + 0.25, 2))
            gs.inv_rates[hp.id] = rate
            self._flash(f"Rate: {rate:.2f} ETH")
        elif val == "lower":
            rate = max(FEE_RATE_MIN, round(rate - 0.25, 2))
            gs.inv_rates[hp.id] = rate
            self._flash(f"Rate: {rate:.2f} ETH")

    def _interact_town_hall(self):
        gs = self.rpg.gs
        hp = self.rpg.hp
        al = gs.actions_left(hp)
        items = []
        if self.rpg.pending_disputes and hp.role == "buyer" and al >= 1:
            items.append({
                "label": f"Call out lemon! (1 action) — slash seller + complicit",
                "value": "callout",
            })
        items.append({
            "label": f"End block (unused actions carry over, max {MAX_CARRYOVER})",
            "value": "end",
        })
        items.append({"label": "Back", "value": "back"})
        self.dialog.show_menu(
            f"Town Hall — Block {gs.block_num}", items,
            self._on_town_hall, self.rpg.status_text())

    def _build_pending_disputes(self):
        gs = self.rpg.gs
        hp = self.rpg.hp
        if hp.role != "buyer":
            return
        for sale in gs.lemon_sales_this_block:
            if sale["buyer"].id != hp.id:
                continue
            meta = self.listing_metadata.get(sale["listing_idx"], {})
            listing = gs.resolved_listings[sale["listing_idx"]] if sale["listing_idx"] < len(gs.resolved_listings) else None
            self.rpg.pending_disputes.append({
                "buyer": sale["buyer"], "seller": sale["seller"],
                "listing_idx": sale["listing_idx"], "price": sale["price"],
                "mechanic_id": meta.get("inspected_by") or (listing.inspected_by if listing else None),
                "mechanic_bribed": meta.get("mechanic_bribed", False) or (listing.mechanic_bribed if listing else False),
                "mechanic_fee": meta.get("mechanic_fee", 0.0) or (getattr(listing, "mechanic_fee", 0) if listing else 0),
                "mechanic_bribe": meta.get("mechanic_bribe", 0.0) or (getattr(listing, "mechanic_bribe", 0) if listing else 0),
                "pi_id": meta.get("bribed_pi_id"),
                "pi_bribed": meta.get("pi_bribed", False),
                "pi_bribe": meta.get("pi_bribe", 0.0),
            })

    def _process_dispute(self, d):
        gs = self.rpg.gs
        buyer = d["buyer"]
        seller = d["seller"]
        price = d["price"]
        comp = price * SLASH_SELLER_PCT
        seller.balance -= comp
        buyer.balance += comp
        if d.get("mechanic_bribed") and d.get("mechanic_id"):
            mech = next((p for p in gs.players if p.id == d["mechanic_id"]), None)
            if mech:
                mech_earned = d.get("mechanic_fee", 0) + d.get("mechanic_bribe", 0)
                mech_slash = mech_earned * SLASH_MECHANIC_PCT
                mech.balance -= mech_slash
                buyer.balance += mech_slash
        if d.get("pi_bribed") and d.get("pi_id"):
            pi = next((p for p in gs.players if p.id == d["pi_id"]), None)
            if pi:
                pi_earned = d.get("pi_bribe", 0)
                pi_slash = pi_earned * SLASH_PI_PCT
                pi.balance -= pi_slash
                buyer.balance += pi_slash
        self.rpg.pending_disputes.remove(d)

    def _show_mechanic_bribe_dialog(self, mech, seller, bribe):
        """Blocking dialog when bot seller offers bribe to human mechanic."""
        result = [None]
        def on_choice(val):
            result[0] = val
        self.dialog.show_menu(
            f"{seller} offers {bribe} ETH bribe to say PASS (lie). Accept?",
            [{"label": "Accept (lie)", "value": True},
             {"label": "Refuse (truth)", "value": False}],
            on_choice)
        while result[0] is None:
            for e in pygame.event.get():
                if e.type == pygame.QUIT:
                    result[0] = False
                    break
                elif e.type == pygame.KEYDOWN:
                    self.dialog.handle_key(e.key)
            self._draw()
            pygame.display.flip()
            self.clock.tick(FPS)
        return result[0]

    def _on_town_hall(self, val):
        if val == "back":
            return
        if val == "callout" and self.rpg.pending_disputes:
            d = self.rpg.pending_disputes[0]
            if self.rpg.gs.actions_left(self.rpg.hp) >= 1:
                self.rpg.gs.use_action(self.rpg.hp)
                self._process_dispute(d)
                self._flash("Called out! Seller + mechanic/PI slashed.")
            return
        self.rpg.gs.on_mechanic_bribe_offer = self._show_mechanic_bribe_dialog
        self.rpg.end_block(listing_corruption=self.bribe_ledger)
        self.rpg.gs.on_mechanic_bribe_offer = None
        self._build_pending_disputes()
        summary = self.rpg.block_results
        you_lines = [l for l in summary if "(YOU)" in l]
        sale_lines = [l for l in summary if "bought" in l and f"from {self.rpg.hp}" in l]
        slash_lines = [l for l in summary if "called out" in l.lower() or "AVOIDED" in l]
        expired_lines = [l for l in summary if "expired" in l]
        lines = [f"Block {self.rpg.gs.block_num} resolved!"]
        if sale_lines:
            lines += sale_lines[:3]
        if you_lines:
            lines += you_lines[:2]
        if slash_lines:
            lines += slash_lines[:2]
        if expired_lines:
            lines += expired_lines[:1]
        if not sale_lines and not you_lines and not slash_lines:
            lines.append("  (no direct transactions for you this block)")
        if self.rpg.pending_disputes:
            lines.append("")
            lines.append("You bought a LEMON! Go to Town Hall to CALL OUT.")
        if self.rpg.is_last_block():
            lines.append("")
            lines.append("Game over! Press ENTER to see final results.")
            self.dialog.show_text("Block Results", lines)
            self.dialog.callback = lambda: None
            self._pending_game_over = True
        else:
            self.rpg.begin_block()
            self._clear_block_state()
            lines.append(f"Block {self.rpg.gs.block_num} starting...")
            self.dialog.show_text("Block Results", lines)

    _pending_game_over = False

    # ── drawing ──

    def _draw_map(self):
        self.screen.blit(self.map_surf, (0, 0))
        for name, (lx, ly) in BUILDING_LABELS.items():
            label = self.font_label.render(name, True, (255, 255, 255))
            bg = pygame.Surface((label.get_width() + 6, label.get_height() + 2))
            bg.fill((40, 40, 40))
            bg.set_alpha(180)
            px = lx * ST + ST // 2 - label.get_width() // 2
            py = ly * ST + 2
            self.screen.blit(bg, (px - 3, py - 1))
            self.screen.blit(label, (px, py))
        # Town Hall label
        lbl = self.font_label.render("Town Hall", True, (255, 255, 240))
        tx = TOWN_HALL_POS[0] * ST + ST // 2 - lbl.get_width() // 2
        ty = TOWN_HALL_POS[1] * ST - 12
        self.screen.blit(lbl, (tx, ty))

    def _draw_npcs(self):
        for role, (cx, cy) in self.npc_positions.items():
            spr = self.npc_sprites.get(role)
            if spr:
                self.screen.blit(spr, (cx * ST, cy * ST))
                lbl = self.font_label.render(role.title(), True, (255, 255, 255))
                lx = cx * ST + ST // 2 - lbl.get_width() // 2
                self.screen.blit(lbl, (lx, cy * ST - 10))

    def _draw_player(self):
        if self.move_timer > 0:
            frac = 1.0 - (self.move_timer / MOVE_FRAMES)
            px = (self.px - self.move_dx + self.move_dx * frac) * ST
            py = (self.py - self.move_dy + self.move_dy * frac) * ST
        else:
            px = self.px * ST
            py = self.py * ST
        frame = self.walk_frame % 2
        spr = self.player_sprites[self.facing][frame]
        self.screen.blit(spr, (px, py))

    def _draw_status_bar(self):
        bar_y = MAP_H * ST
        bar = pygame.Rect(0, bar_y, WIDTH, DIALOG_H)
        if self.dialog.state == Dialog.IDLE:
            pygame.draw.rect(self.screen, C_DLG_BG, bar)
            pygame.draw.rect(self.screen, C_DLG_BRD, bar, 2)
            y = bar_y + 10
            if self.rpg:
                self.screen.blit(
                    self.font.render(self.rpg.status_text(), True, C_TEXT_HL),
                    (16, y))
                y += 28
                if self.held_car and self.rpg.hp.role == "seller":
                    hc = self.held_car
                    tag = "LEMON" if hc["is_lemon"] else "OK"
                    self.screen.blit(
                        self.font_sm.render(
                            f"Held car: [{hc['tier']}] {hc['price']:.1f} ETH ({tag})",
                            True, C_TEXT), (16, y))
                    y += 20
                if self.rpg.pending_disputes and self.rpg.hp.role == "buyer":
                    self.screen.blit(
                        self.font_sm.render(
                            "You bought a LEMON! Call out at Town Hall.",
                            True, (255, 180, 80)), (16, y))
                    y += 20
                # Hint
                face = self._building_at_face()
                if face:
                    self.screen.blit(
                        self.font_sm.render(f"Press ENTER to enter {face}",
                                            True, C_TEXT), (16, y))
                elif self._at_town_hall():
                    self.screen.blit(
                        self.font_sm.render("Press ENTER to manage the block",
                                            True, C_TEXT), (16, y))
                else:
                    self.screen.blit(
                        self.font_sm.render(
                            "Walk to a building door and press ENTER",
                            True, C_TEXT_DIM), (16, y))
                y += 22
                if self.msg_timer > 0:
                    self.screen.blit(
                        self.font_sm.render(self.msg_text, True,
                                            (180, 255, 180)), (16, y))
        else:
            self.dialog.draw(self.screen)

    def _draw_role_select(self):
        self.screen.fill((24, 32, 24))
        cx = WIDTH // 2
        self.screen.blit(
            self.font.render("LEMON CAR GAME", True, C_TEXT_HL),
            (cx - 100, 60))
        self.screen.blit(
            self.font_sm.render("— Retro RPG Edition —", True, C_TEXT_DIM),
            (cx - 90, 90))
        roles = ["seller", "buyer", "mechanic", "investigator"]
        descs = [
            "List cars, choose risk tiers, pay listing fees",
            "Browse market, buy cars, hire investigators",
            "Set inspection rates, earn from both sides",
            "Set investigation rates, reveal lemons",
        ]
        y = 160
        for i, (r, d) in enumerate(zip(roles, descs)):
            sel = (i == self.selected_role)
            color = C_TEXT_HL if sel else C_TEXT
            prefix = "> " if sel else "  "
            self.screen.blit(
                self.font.render(f"{prefix}{r.upper()}", True, color),
                (cx - 160, y))
            self.screen.blit(
                self.font_sm.render(d, True, C_TEXT_DIM),
                (cx - 130, y + 24))
            y += 56
        self.screen.blit(
            self.font_sm.render("UP/DOWN to select, ENTER to start",
                                True, C_TEXT_DIM), (cx - 140, y + 30))

    def _draw_game_over(self):
        self.screen.fill((24, 32, 24))
        gs = self.rpg.gs
        rankings = sorted(gs.players,
                          key=lambda p: p.effective_balance, reverse=True)
        self.screen.blit(
            self.font.render("GAME OVER — Final Rankings", True, C_TEXT_HL),
            (WIDTH // 2 - 180, 30))
        y = 80
        for i, p in enumerate(rankings):
            you = " (YOU)" if p.is_human else ""
            line = (f"{i+1}. {p!r}{you}  "
                    f"Bal:{p.balance:.0f}  "
                    f"Cars:{p.car_value_received:.0f}  "
                    f"Eff:{p.effective_balance:.0f}")
            col = C_TEXT_HL if p.is_human else C_TEXT
            self.screen.blit(self.font_sm.render(line, True, col), (40, y))
            y += 24
        y += 20
        bals = [p.effective_balance for p in gs.players]
        n = len(bals)
        if n > 0 and sum(bals) > 0:
            sb = sorted(bals)
            gsum = sum(abs(a - b) for a in sb for b in sb)
            gini = gsum / (2 * n * sum(sb))
        else:
            gini = 0
        self.screen.blit(
            self.font_sm.render(f"Gini: {gini:.3f}", True, C_TEXT_DIM),
            (40, y))
        y += 30
        self.screen.blit(
            self.font_sm.render("R = Play again   ESC = Quit", True, C_TEXT),
            (40, y))

    # ── main loop ──

    def run(self):
        running = True
        while running:
            for e in pygame.event.get():
                if e.type == pygame.QUIT:
                    running = False
                elif e.type == pygame.KEYDOWN:
                    if self.state_mode == "role_select":
                        if e.key == pygame.K_UP:
                            self.selected_role = (self.selected_role - 1) % 4
                        elif e.key == pygame.K_DOWN:
                            self.selected_role = (self.selected_role + 1) % 4
                        elif e.key == pygame.K_RETURN:
                            roles = ["seller", "buyer", "mechanic",
                                     "investigator"]
                            self._setup_game(roles[self.selected_role])
                        elif e.key == pygame.K_ESCAPE:
                            running = False
                    elif self.state_mode == "playing":
                        self._handle_playing_key(e.key)
                    elif self.state_mode == "game_over":
                        if e.key == pygame.K_r:
                            self.state_mode = "role_select"
                        elif e.key == pygame.K_ESCAPE:
                            running = False

            if self.state_mode == "playing":
                self._update()

            self._draw()
            self.clock.tick(FPS)

        pygame.quit()

    def _handle_playing_key(self, key):
        if self.dialog.state != Dialog.IDLE:
            result = self.dialog.handle_key(key)
            if result == "closed" and self._pending_game_over:
                self._pending_game_over = False
                self.state_mode = "game_over"
            return

        if key == pygame.K_ESCAPE:
            self.state_mode = "role_select"
            return

        if key == pygame.K_RETURN:
            bld = self._building_at_face()
            if bld == "Car Lot":
                self._interact_car_lot()
            elif bld == "Mechanic":
                self._interact_mechanic()
            elif bld == "PI Office":
                self._interact_pi()
            elif bld == "Market":
                self._interact_market()
            elif self._at_town_hall():
                self._interact_town_hall()
            return

        if self.move_timer > 0:
            return

        direction = None
        if key == pygame.K_UP:
            direction = "up"
        elif key == pygame.K_DOWN:
            direction = "down"
        elif key == pygame.K_LEFT:
            direction = "left"
        elif key == pygame.K_RIGHT:
            direction = "right"

        if direction:
            self.facing = direction
            dx, dy = DIR_DELTA[direction]
            nx, ny = self.px + dx, self.py + dy
            if self._can_walk(nx, ny):
                self.px = nx
                self.py = ny
                self.move_dx = dx
                self.move_dy = dy
                self.move_timer = MOVE_FRAMES
                self.walk_frame += 1

    def _update(self):
        if self.move_timer > 0:
            self.move_timer -= 1
        if self.msg_timer > 0:
            self.msg_timer -= 1

        # Hold-to-walk
        if self.move_timer == 0 and self.dialog.state == Dialog.IDLE:
            keys = pygame.key.get_pressed()
            direction = None
            if keys[pygame.K_UP]:
                direction = "up"
            elif keys[pygame.K_DOWN]:
                direction = "down"
            elif keys[pygame.K_LEFT]:
                direction = "left"
            elif keys[pygame.K_RIGHT]:
                direction = "right"
            if direction:
                self.facing = direction
                dx, dy = DIR_DELTA[direction]
                nx, ny = self.px + dx, self.py + dy
                if self._can_walk(nx, ny):
                    self.px = nx
                    self.py = ny
                    self.move_dx = dx
                    self.move_dy = dy
                    self.move_timer = MOVE_FRAMES
                    self.walk_frame += 1

    def _draw(self):
        if self.state_mode == "role_select":
            self._draw_role_select()
        elif self.state_mode == "playing":
            self._draw_map()
            self._draw_npcs()
            self._draw_player()
            self._draw_status_bar()
        elif self.state_mode == "game_over":
            self._draw_game_over()
        pygame.display.flip()


# ═══════════════════════════════════════════════════════════════════════════
# Entry point
# ═══════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    game = RPGGame()
    game.run()

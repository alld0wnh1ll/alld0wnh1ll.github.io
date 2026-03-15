#!/usr/bin/env python3
"""
Lemon Car Game - Block-Based Pygame
Each round is a "block": players commit actions, attest, then the block resolves
atomically. Mechanics/investigators are always available — fees scale with demand.
Contention (two buyers wanting the same car) is resolved by shuffle at block time.
"""

import random
import math
import pygame
import sys

# --- Constants ---
WIDTH, HEIGHT = 1000, 720
FPS = 60
WHITE = (255, 255, 255)
BLACK = (20, 20, 20)
GRAY = (120, 120, 120)
DARK_GRAY = (50, 50, 50)
GREEN = (34, 197, 94)
RED = (239, 68, 68)
YELLOW = (234, 179, 8)
BLUE = (59, 130, 246)
ORANGE = (249, 115, 22)
BG = (30, 41, 59)
PANEL = (51, 65, 85)
ACCENT = (99, 102, 241)
CYAN = (6, 182, 212)

P_LEMON = 0.2
CAR_VALUE_MIN, CAR_VALUE_MAX = 3, 8
# Risk tiers: seller chooses car source — more risk = more reward potential
# price_mult: safe < standard < risky (risky can list higher when good, but lemon penalty hurts)
CAR_SOURCES = {
    "safe":    {"p_lemon": 0.08, "value_min": 2.5, "value_max": 5.5, "price_mult": 0.50},
    "standard":{"p_lemon": 0.20, "value_min": 3.0, "value_max": 8.0, "price_mult": 0.55},
    "risky":   {"p_lemon": 0.40, "value_min": 5.0, "value_max": 12.0, "price_mult": 0.65},
}
CAR_LEMON_MULT = 0.30
LEMON_SELLER_PENALTY = 0.25
SLASH_SELLER_PCT = 0.40
SLASH_MECHANIC_PCT = 0.50
SLASH_PI_PCT = 0.50
LISTING_FEE = 1.5           # sellers pay to list (gas/overhead)
ACTIONS_PER_BLOCK = 3
MAX_CARRYOVER = 2
FEE_MECHANIC_BASE = 0.45
FEE_INVESTIGATOR_BASE = 0.70
FEE_RATE_MIN = 0.3          # floor for provider rates
FEE_RATE_MAX = 6.0          # ceiling for provider rates
FEE_SURGE_PER_REQUEST = 0.4
STARTING_BALANCE = 100
NUM_BLOCKS = 10

ROLE_COUNTS = {"seller": 4, "mechanic": 2, "buyer": 4, "investigator": 2}


def shuffle_list(lst):
    lst = list(lst)
    random.shuffle(lst)
    return lst


# ---------------------------------------------------------------------------
# Domain objects
# ---------------------------------------------------------------------------

class Player:
    def __init__(self, pid, role, is_human=False):
        self.id = pid
        self.role = role
        self.balance = STARTING_BALANCE
        self.car_value_received = 0.0
        self.is_human = is_human
        self.sales_as_seller = 0
        self.sales_as_buyer = 0
        self.inspections_done = 0
        self.reports_done = 0
        self.lemon_bought = 0
        self.lemon_sold = 0

    @property
    def effective_balance(self):
        return self.balance + self.car_value_received

    def __repr__(self):
        tag = "*" if self.is_human else ""
        return f"{self.role[0].upper()}{self.id}{tag}"


class PendingListing:
    """A seller's queued intent to list a car."""
    def __init__(self, seller, inspect_mechanic_id=None, risk_tier="standard"):
        self.seller = seller
        self.inspect_mechanic_id = inspect_mechanic_id  # None = no inspection
        self.risk_tier = risk_tier  # "safe" | "standard" | "risky"
        # Generated at resolution time
        self.is_lemon = None
        self.car_value = None
        self.price = None
        self.mechanic_report = None


class PendingBuyerAction:
    """A buyer's queued intent for one action."""
    def __init__(self, buyer, action_type, listing_idx=None,
                 provider_id=None):
        self.buyer = buyer
        self.action_type = action_type  # "buy" | "investigate" | "inspect"
        self.listing_idx = listing_idx  # index into resolved listings
        self.provider_id = provider_id  # mechanic or investigator id


class ResolvedListing:
    """A listing after the block resolves the seller phase."""
    def __init__(self, seller, price, is_lemon, car_value, mechanic_report=None,
                 inspected_by=None, mechanic_bribed=False, mechanic_fee=0.0, mechanic_bribe=0.0):
        self.seller = seller
        self.price = price
        self.is_lemon = is_lemon
        self.car_value = car_value
        self.mechanic_report = mechanic_report  # True/False/None
        self.inspected_by = inspected_by
        self.mechanic_bribed = mechanic_bribed
        self.mechanic_fee = mechanic_fee
        self.mechanic_bribe = mechanic_bribe


# ---------------------------------------------------------------------------
# Game state
# ---------------------------------------------------------------------------

class GameState:
    """
    Block lifecycle:
      1. SELLER_COMMIT  - sellers queue listings
      2. SELLER_ATTEST  - human confirms (bots auto-attest)
      3. BUYER_COMMIT   - buyers queue actions on resolved listings
      4. BUYER_ATTEST   - human confirms
      5. RESOLVE        - block mines: demand fees, contention, balances
      6. RESULTS        - display what happened
    """
    PHASES = [
        "set_rates",
        "seller_commit", "seller_attest",
        "buyer_commit", "buyer_attest",
        "resolve", "results",
    ]

    def __init__(self, human_role):
        self.block_num = 0
        self.phase = "seller_commit"
        self.players = []
        self.human_player = None
        self.human_role = human_role
        self._create_players()

        # Per-block state
        self.pending_seller = []       # [PendingListing, ...]
        self.pending_buyer = []        # [PendingBuyerAction, ...]
        self.resolved_listings = []    # [ResolvedListing, ...] after seller resolve
        self.actions_used = {}         # pid -> int
        self.actions_max = {}          # pid -> int
        self.actions_saved = {}        # pid -> int (carryover from prev block)

        # Provider posted rates (each sets their own rate)
        self.mechanic_rates = {}       # pid -> posted_rate
        self.inv_rates = {}            # pid -> posted_rate
        # After resolution: demand-adjusted effective rates
        self.effective_mech_rates = {}
        self.effective_inv_rates = {}
        # Demand history: how many times each was hired last block
        self.last_mech_demand = {}     # pid -> int
        self.last_inv_demand = {}      # pid -> int

        self.log = []
        self.block_summary = []        # summary lines for results phase
        self.lemon_sales_this_block = []  # for RPG dispute system
        self.listing_corruption = {}   # idx -> {pi_bribed, bribed_pi_id} (RPG sets)
        self.on_mechanic_bribe_offer = None  # (mech, seller, bribe) -> bool, for RPG
        self.on_pi_bribe_offer = None  # (inv, seller, bribe) -> bool, for RPG
        self.selected_listing_idx = 0
        self.human_attested = False

    # ---- Setup ----

    def _create_players(self):
        pid = 0
        for role, count in ROLE_COUNTS.items():
            for i in range(count):
                is_human = (role == self.human_role and i == 0)
                p = Player(pid, role, is_human)
                self.players.append(p)
                if is_human:
                    self.human_player = p
                pid += 1

    def players_by_role(self, role):
        return [p for p in self.players if p.role == role]

    # ---- Actions budget ----

    def actions_left(self, player):
        mx = self.actions_max.get(player.id, ACTIONS_PER_BLOCK)
        return mx - self.actions_used.get(player.id, 0)

    def use_action(self, player, cost=1):
        if self.actions_left(player) >= cost:
            self.actions_used[player.id] = self.actions_used.get(player.id, 0) + cost
            return True
        return False

    # ---- Block lifecycle ----

    def start_block(self):
        self.block_num += 1
        self.phase = "set_rates"
        self.pending_seller = []
        self.pending_buyer = []
        self.resolved_listings = []
        self.block_summary = []
        self.lemon_sales_this_block = []
        self.listing_corruption = {}
        self.human_attested = False
        self.selected_listing_idx = 0
        self.effective_mech_rates = {}
        self.effective_inv_rates = {}

        # Carryover
        for p in self.players:
            carried = min(self.actions_saved.get(p.id, 0), MAX_CARRYOVER)
            self.actions_max[p.id] = ACTIONS_PER_BLOCK + carried
            if carried > 0:
                self.log.append(f"  {p} +{carried} carryover")
        self.actions_used = {p.id: 0 for p in self.players}

        # All providers set rates: block 1 = base rate; after that bots adapt
        for m in self.players_by_role("mechanic"):
            if m.is_human:
                if m.id not in self.mechanic_rates:
                    self.mechanic_rates[m.id] = FEE_MECHANIC_BASE
            elif self.block_num == 1:
                self.mechanic_rates[m.id] = FEE_MECHANIC_BASE
            else:
                prev_demand = self.last_mech_demand.get(m.id, 0)
                old_rate = self.mechanic_rates.get(m.id, FEE_MECHANIC_BASE)
                if prev_demand >= 2:
                    new_rate = old_rate * (1.15 + random.random() * 0.15)
                elif prev_demand == 1:
                    new_rate = old_rate * (0.95 + random.random() * 0.1)
                else:
                    new_rate = old_rate * (0.88 + random.random() * 0.07)
                self.mechanic_rates[m.id] = round(
                    max(FEE_RATE_MIN, min(FEE_RATE_MAX, new_rate)), 2)
        for inv in self.players_by_role("investigator"):
            if inv.is_human:
                if inv.id not in self.inv_rates:
                    self.inv_rates[inv.id] = FEE_INVESTIGATOR_BASE
            elif self.block_num == 1:
                self.inv_rates[inv.id] = FEE_INVESTIGATOR_BASE
            else:
                prev_demand = self.last_inv_demand.get(inv.id, 0)
                old_rate = self.inv_rates.get(inv.id, FEE_INVESTIGATOR_BASE)
                if prev_demand >= 2:
                    new_rate = old_rate * (1.15 + random.random() * 0.15)
                elif prev_demand == 1:
                    new_rate = old_rate * (0.95 + random.random() * 0.1)
                else:
                    new_rate = old_rate * (0.88 + random.random() * 0.07)
                self.inv_rates[inv.id] = round(
                    max(FEE_RATE_MIN, min(FEE_RATE_MAX, new_rate)), 2)

        self.log.append(f"=== Block {self.block_num} ===")
        rates = "  Rates -> "
        rates += " ".join(f"{m}:{self.mechanic_rates[m.id]}"
                          for m in self.players_by_role("mechanic"))
        rates += " | "
        rates += " ".join(f"{i}:{self.inv_rates[i.id]}"
                          for i in self.players_by_role("investigator"))
        self.log.append(rates)

    def save_actions_for_carryover(self):
        for p in self.players:
            mx = self.actions_max.get(p.id, ACTIONS_PER_BLOCK)
            used = self.actions_used.get(p.id, 0)
            left = max(0, mx - used)
            self.actions_saved[p.id] = min(left, MAX_CARRYOVER)

    # ---- Seller commit helpers ----

    def queue_seller_listing(self, seller, inspect_mechanic_id=None, risk_tier="standard"):
        cost = 2 if inspect_mechanic_id is not None else 1
        if self.actions_left(seller) < cost:
            return False, "Not enough actions"
        if risk_tier not in CAR_SOURCES:
            risk_tier = "standard"
        self.use_action(seller, cost)
        pl = PendingListing(seller, inspect_mechanic_id, risk_tier)
        self.pending_seller.append(pl)
        src = CAR_SOURCES[risk_tier]
        tag = f" [{risk_tier}]"
        if inspect_mechanic_id is not None:
            mech = self._player_by_id(inspect_mechanic_id)
            return True, f"Queued: list + inspect via {mech}{tag}"
        return True, f"Queued: list (no inspection){tag}"

    # ---- Buyer commit helpers ----

    def queue_buyer_buy(self, buyer, listing_idx):
        if self.actions_left(buyer) < 1:
            return False, "No actions left"
        if listing_idx < 0 or listing_idx >= len(self.resolved_listings):
            return False, "Invalid listing"
        self.use_action(buyer)
        self.pending_buyer.append(
            PendingBuyerAction(buyer, "buy", listing_idx=listing_idx))
        return True, f"Queued: buy listing #{listing_idx + 1}"

    def queue_buyer_investigate(self, buyer, listing_idx, investigator_id):
        if self.actions_left(buyer) < 1:
            return False, "No actions left"
        self.use_action(buyer)
        self.pending_buyer.append(
            PendingBuyerAction(buyer, "investigate",
                               listing_idx=listing_idx,
                               provider_id=investigator_id))
        inv = self._player_by_id(investigator_id)
        return True, f"Queued: investigate #{listing_idx + 1} via {inv}"

    def queue_buyer_inspect(self, buyer, listing_idx, mechanic_id):
        if self.actions_left(buyer) < 1:
            return False, "No actions left"
        self.use_action(buyer)
        self.pending_buyer.append(
            PendingBuyerAction(buyer, "inspect",
                               listing_idx=listing_idx,
                               provider_id=mechanic_id))
        mech = self._player_by_id(mechanic_id)
        return True, f"Queued: inspect #{listing_idx + 1} via {mech}"

    # ---- Resolution ----

    def resolve_seller_phase(self):
        """Resolve seller commits: generate cars, process inspection demand."""
        # Snapshot balances for earnings tracking
        self._bal_before = {p.id: p.balance for p in self.players}
        # Count inspection demand per mechanic
        mech_demand = {}
        for pl in self.pending_seller:
            if pl.inspect_mechanic_id is not None:
                mech_demand[pl.inspect_mechanic_id] = \
                    mech_demand.get(pl.inspect_mechanic_id, 0) + 1

        # Calculate effective mechanic rates (demand surge)
        for mid, count in mech_demand.items():
            base = self.mechanic_rates.get(mid, FEE_MECHANIC_BASE)
            surge = 1.0 + FEE_SURGE_PER_REQUEST * max(0, count - 1)
            self.effective_mech_rates[mid] = round(base * surge, 2)

        if mech_demand:
            self.block_summary.append("-- Seller-side service demand --")
            for mid, count in mech_demand.items():
                m = self._player_by_id(mid)
                base = self.mechanic_rates.get(mid, FEE_MECHANIC_BASE)
                eff = self.effective_mech_rates[mid]
                self.block_summary.append(
                    f"  {m}: {count} request(s), base {base:.2f} -> effective {eff:.2f}")

        # Resolve each listing (seller pays listing fee)
        self.block_summary.append("-- Listings --")
        for pl in self.pending_seller:
            src = CAR_SOURCES.get(pl.risk_tier, CAR_SOURCES["standard"])
            pl.is_lemon = random.random() < src["p_lemon"]
            vmin, vmax = src["value_min"], src["value_max"]
            pl.car_value = vmin + random.random() * (vmax - vmin)
            mult = src.get("price_mult", 1.0)
            pl.price = round(
                pl.car_value * mult * (0.85 + random.random() * 0.3), 2)
            # Listing fee
            pl.seller.balance -= LISTING_FEE

            if pl.inspect_mechanic_id is not None:
                fee = self.effective_mech_rates[pl.inspect_mechanic_id]
                mech = self._player_by_id(pl.inspect_mechanic_id)
                if pl.seller.balance >= fee:
                    pl.seller.balance -= fee
                    mech.balance += fee
                    mech.inspections_done += 1
                    if pl.is_lemon and random.random() < 0.4:
                        bribe = random.choice([1.0, 2.0, 3.0])
                        if pl.seller.balance >= bribe:
                            if mech.is_human and self.on_mechanic_bribe_offer:
                                accepted = self.on_mechanic_bribe_offer(mech, pl.seller, bribe)
                            else:
                                greed = random.uniform(1.0, 3.5)
                                accepted = bribe >= greed
                            if accepted:
                                pl.seller.balance -= bribe
                                mech.balance += bribe
                                pl.mechanic_report = True
                                pl._inspected_by = mech.id
                                pl._mechanic_bribed = True
                                pl._mechanic_fee = fee
                                pl._mechanic_bribe = bribe
                                self.block_summary.append(
                                    f"  {pl.seller} bribed {mech} {bribe:.2f} -> PASS (lie!)")
                            else:
                                pl.mechanic_report = False
                                pl._inspected_by = mech.id
                                pl._mechanic_bribed = False
                                pl._mechanic_fee = fee
                                pl._mechanic_bribe = 0
                                self.block_summary.append(
                                    f"  {pl.seller} bribe refused -> FAIL")
                        else:
                            pl.mechanic_report = False
                            pl._inspected_by = mech.id
                            pl._mechanic_bribed = False
                            pl._mechanic_fee = fee
                            pl._mechanic_bribe = 0
                    else:
                        pl.mechanic_report = not pl.is_lemon
                        pl._inspected_by = mech.id
                        pl._mechanic_bribed = False
                        pl._mechanic_fee = fee
                        pl._mechanic_bribe = 0
                    self.block_summary.append(
                        f"  {pl.seller} paid {mech} {fee:.2f} ETH (surge: "
                        f"{mech_demand.get(pl.inspect_mechanic_id, 1)} in block)")
                else:
                    pl.mechanic_report = None
                    self.block_summary.append(
                        f"  {pl.seller} couldn't afford inspection ({fee:.2f})")

            insp = getattr(pl, '_inspected_by', None)
            bribed = getattr(pl, '_mechanic_bribed', False)
            mfee = getattr(pl, '_mechanic_fee', 0.0)
            mbribe = getattr(pl, '_mechanic_bribe', 0.0)
            rl = ResolvedListing(
                pl.seller, pl.price, pl.is_lemon,
                pl.car_value, pl.mechanic_report,
                inspected_by=insp, mechanic_bribed=bribed,
                mechanic_fee=mfee, mechanic_bribe=mbribe)
            self.resolved_listings.append(rl)
            tag = " [inspected]" if pl.mechanic_report is not None else ""
            tier_tag = f" [{pl.risk_tier}]" if pl.risk_tier != "standard" else ""
            self.block_summary.append(
                f"  {pl.seller} listed at {pl.price:.1f} ETH{tag}{tier_tag}")

    def resolve_buyer_phase(self):
        """Resolve buyer commits: demand fees, contention, transfers."""
        # --- 1. Tally demand per provider ---
        inv_demand = {}
        mech_demand = {}
        for ba in self.pending_buyer:
            if ba.action_type == "investigate" and ba.provider_id is not None:
                inv_demand[ba.provider_id] = \
                    inv_demand.get(ba.provider_id, 0) + 1
            elif ba.action_type == "inspect" and ba.provider_id is not None:
                mech_demand[ba.provider_id] = \
                    mech_demand.get(ba.provider_id, 0) + 1

        # Effective investigator rates
        for iid, count in inv_demand.items():
            base = self.inv_rates.get(iid, FEE_INVESTIGATOR_BASE)
            surge = 1.0 + FEE_SURGE_PER_REQUEST * max(0, count - 1)
            self.effective_inv_rates[iid] = round(base * surge, 2)

        # Effective mechanic rates (buyer-side; stacks on seller-side if any)
        for mid, count in mech_demand.items():
            base = self.mechanic_rates.get(mid, FEE_MECHANIC_BASE)
            prev = self.effective_mech_rates.get(mid)
            if prev is not None:
                # Additional buyer-side demand stacks on seller-side price
                surge = 1.0 + FEE_SURGE_PER_REQUEST * max(0, count)
                self.effective_mech_rates[mid] = round(prev * surge, 2)
            else:
                surge = 1.0 + FEE_SURGE_PER_REQUEST * max(0, count - 1)
                self.effective_mech_rates[mid] = round(base * surge, 2)

        if inv_demand or mech_demand:
            self.block_summary.append("-- Buyer-side service demand --")
            for iid, count in inv_demand.items():
                inv = self._player_by_id(iid)
                base = self.inv_rates.get(iid, FEE_INVESTIGATOR_BASE)
                eff = self.effective_inv_rates[iid]
                self.block_summary.append(
                    f"  {inv}: {count} request(s), base {base:.2f} -> effective {eff:.2f}")
            for mid, count in mech_demand.items():
                m = self._player_by_id(mid)
                eff = self.effective_mech_rates[mid]
                self.block_summary.append(
                    f"  {m}: {count} buyer request(s) -> effective {eff:.2f}")

        # --- 2. Process investigations & inspections (shuffled order) ---
        service_actions = [a for a in self.pending_buyer
                           if a.action_type in ("investigate", "inspect")]
        random.shuffle(service_actions)  # tx ordering within the block

        # Investigation verdicts: (buyer_id, listing_idx) -> is_lemon
        self.investigation_verdicts = {}

        self.block_summary.append("-- Services --")
        for ba in service_actions:
            if ba.listing_idx < 0 or ba.listing_idx >= len(self.resolved_listings):
                continue
            listing = self.resolved_listings[ba.listing_idx]
            if ba.action_type == "investigate":
                fee = self.effective_inv_rates.get(
                    ba.provider_id, FEE_INVESTIGATOR_BASE)
                inv = self._player_by_id(ba.provider_id)
                if ba.buyer.balance >= fee:
                    ba.buyer.balance -= fee
                    inv.balance += fee
                    inv.reports_done += 1
                    corr = self.listing_corruption.get(ba.listing_idx, {})
                    if corr.get("pi_bribed"):
                        verdict = False
                    else:
                        verdict = listing.is_lemon
                    self.investigation_verdicts[
                        (ba.buyer.id, ba.listing_idx)] = verdict
                    self.block_summary.append(
                        f"  {ba.buyer} investigated #{ba.listing_idx+1} "
                        f"via {inv} ({fee:.2f}): "
                        f"{'LEMON!' if verdict else 'GOOD'}")
                else:
                    self.block_summary.append(
                        f"  {ba.buyer} couldn't afford investigation ({fee:.2f})")
            elif ba.action_type == "inspect":
                fee = self.effective_mech_rates.get(
                    ba.provider_id, FEE_MECHANIC_BASE)
                mech = self._player_by_id(ba.provider_id)
                if ba.buyer.balance >= fee:
                    ba.buyer.balance -= fee
                    mech.balance += fee
                    mech.inspections_done += 1
                    report = not listing.is_lemon
                    listing.mechanic_report = report
                    self.block_summary.append(
                        f"  {ba.buyer} inspected #{ba.listing_idx+1} "
                        f"via {mech} ({fee:.2f}): "
                        f"{'PASS' if report else 'FAIL'}")
                else:
                    self.block_summary.append(
                        f"  {ba.buyer} couldn't afford inspection ({fee:.2f})")

        # --- 3. Process purchases (shuffled — contention!) ---
        buy_actions = [a for a in self.pending_buyer
                       if a.action_type == "buy"]
        random.shuffle(buy_actions)  # block ordering determines who wins

        sold_indices = set()
        self.block_summary.append("-- Sales --")
        for ba in buy_actions:
            idx = ba.listing_idx
            if idx in sold_indices:
                self.actions_used[ba.buyer.id] = max(
                    0, self.actions_used.get(ba.buyer.id, 0) - 1)
                self.block_summary.append(
                    f"  {ba.buyer} wanted #{idx+1} — TX REVERTED (already sold)")
                continue
            if idx < 0 or idx >= len(self.resolved_listings):
                continue
            listing = self.resolved_listings[idx]
            # Investigation protection: if buyer investigated this and it's a lemon, auto-cancel
            inv_key = (ba.buyer.id, idx)
            if inv_key in self.investigation_verdicts and self.investigation_verdicts[inv_key]:
                self.actions_used[ba.buyer.id] = max(
                    0, self.actions_used.get(ba.buyer.id, 0) - 1)
                self.block_summary.append(
                    f"  {ba.buyer} AVOIDED #{idx+1} — investigation revealed LEMON!")
                continue
            if ba.buyer.balance < listing.price:
                self.actions_used[ba.buyer.id] = max(
                    0, self.actions_used.get(ba.buyer.id, 0) - 1)
                self.block_summary.append(
                    f"  {ba.buyer} couldn't afford #{idx+1} "
                    f"({listing.price:.1f} ETH) — TX REVERTED")
                continue
            # Sale goes through
            ba.buyer.balance -= listing.price
            alpha = CAR_LEMON_MULT if listing.is_lemon else 1.0
            ba.buyer.car_value_received += listing.car_value * alpha
            seller_receives = listing.price * (1 - LEMON_SELLER_PENALTY) if listing.is_lemon else listing.price
            listing.seller.balance += seller_receives
            listing.seller.sales_as_seller += 1
            ba.buyer.sales_as_buyer += 1
            if listing.is_lemon:
                ba.buyer.lemon_bought += 1
                listing.seller.lemon_sold += 1
                if not ba.buyer.is_human:
                    comp = listing.price * SLASH_SELLER_PCT
                    listing.seller.balance -= comp
                    ba.buyer.balance += comp
                    if getattr(listing, "mechanic_bribed", False) and listing.inspected_by:
                        mech = self._player_by_id(listing.inspected_by)
                        if mech:
                            mech_earned = getattr(listing, "mechanic_fee", 0) + getattr(listing, "mechanic_bribe", 0)
                            mech_slash = mech_earned * SLASH_MECHANIC_PCT
                            mech.balance -= mech_slash
                            ba.buyer.balance += mech_slash
                    corr = self.listing_corruption.get(idx, {})
                    if corr.get("pi_bribed") and corr.get("bribed_pi_id"):
                        pi = self._player_by_id(corr["bribed_pi_id"])
                        if pi:
                            pi_slash = corr.get("pi_bribe", 0) * SLASH_PI_PCT
                            pi.balance -= pi_slash
                            ba.buyer.balance += pi_slash
                    self.block_summary.append(
                        f"  {ba.buyer} called out #{idx+1} — seller/mechanic/PI slashed!")
            sold_indices.add(idx)
            pct = int(LEMON_SELLER_PENALTY * 100)
            lemon_tag = f" (LEMON! seller -{pct}%)" if listing.is_lemon else ""
            self.block_summary.append(
                f"  {ba.buyer} bought #{idx+1} from {listing.seller} "
                f"for {listing.price:.1f}{lemon_tag}")
            if listing.is_lemon:
                self.lemon_sales_this_block.append({
                    "buyer": ba.buyer, "seller": listing.seller,
                    "listing_idx": idx, "price": listing.price,
                })

        # Unsold listings evaporate (no carryover)
        unsold = len(self.resolved_listings) - len(sold_indices)
        if unsold > 0:
            self.block_summary.append(f"  {unsold} listing(s) expired (unsold)")

        # Earnings summary for this block
        self.block_summary.append("-- Earnings --")
        for p in self.players:
            before = self._bal_before.get(p.id, p.balance)
            delta = p.balance - before
            if abs(delta) > 0.01:
                sign = "+" if delta > 0 else ""
                tag = " (YOU)" if p.is_human else ""
                self.block_summary.append(
                    f"  {p}{tag}: {sign}{delta:.2f} ETH "
                    f"(now {p.balance:.1f})")

        # Track demand history for adaptive pricing next block
        self.last_mech_demand = {}
        self.last_inv_demand = {}
        # Seller-side mechanic demand
        for pl in self.pending_seller:
            if pl.inspect_mechanic_id is not None:
                self.last_mech_demand[pl.inspect_mechanic_id] = \
                    self.last_mech_demand.get(pl.inspect_mechanic_id, 0) + 1
        # Buyer-side demand
        for ba in self.pending_buyer:
            if ba.action_type == "investigate" and ba.provider_id is not None:
                self.last_inv_demand[ba.provider_id] = \
                    self.last_inv_demand.get(ba.provider_id, 0) + 1
            elif ba.action_type == "inspect" and ba.provider_id is not None:
                self.last_mech_demand[ba.provider_id] = \
                    self.last_mech_demand.get(ba.provider_id, 0) + 1

    def advance_phase(self):
        """Move to the next phase in the block lifecycle."""
        idx = self.PHASES.index(self.phase)
        if idx < len(self.PHASES) - 1:
            self.phase = self.PHASES[idx + 1]
        self.human_attested = False

    # ---- Utility ----

    def _player_by_id(self, pid):
        for p in self.players:
            if p.id == pid:
                return p
        return None

    def human_pending_count(self):
        hp = self.human_player
        if self.phase in ("seller_commit", "seller_attest"):
            return sum(1 for pl in self.pending_seller if pl.seller.id == hp.id)
        elif self.phase in ("buyer_commit", "buyer_attest"):
            return sum(1 for ba in self.pending_buyer if ba.buyer.id == hp.id)
        return 0


# ---------------------------------------------------------------------------
# Bot AI
# ---------------------------------------------------------------------------

def bot_seller_commit(state):
    """All bot sellers queue their listings for this block."""
    sellers = [p for p in state.players_by_role("seller") if not p.is_human]
    mechanics = state.players_by_role("mechanic")
    sorted_mechs = sorted(mechanics,
                          key=lambda m: state.mechanic_rates.get(m.id, 999))
    for s in shuffle_list(sellers):
        while state.actions_left(s) >= 1:
            r = random.random()
            risk_tier = "risky" if r < 0.25 else ("safe" if r < 0.5 else "standard")
            if random.random() < 0.42 and state.actions_left(s) >= 2 and sorted_mechs:
                mech = sorted_mechs[0] if random.random() < 0.5 else random.choice(sorted_mechs)
                state.queue_seller_listing(s, inspect_mechanic_id=mech.id, risk_tier=risk_tier)
            else:
                state.queue_seller_listing(s, risk_tier=risk_tier)


def bot_buyer_commit(state):
    """All bot buyers queue their actions for this block."""
    buyers = [p for p in state.players_by_role("buyer") if not p.is_human]
    investigators = state.players_by_role("investigator")
    mechanics = state.players_by_role("mechanic")
    listings = state.resolved_listings
    if not listings:
        return

    # Prefer cheaper providers (price-sensitive bots)
    sorted_invs = sorted(investigators,
                         key=lambda i: state.inv_rates.get(i.id, 999))
    sorted_mechs = sorted(mechanics,
                          key=lambda m: state.mechanic_rates.get(m.id, 999))

    untried = list(range(len(listings)))
    random.shuffle(untried)

    for b in shuffle_list(buyers):
        while state.actions_left(b) >= 1:
            if not listings:
                break
            if untried:
                idx = untried.pop()
            else:
                idx = random.randint(0, len(listings) - 1)
            listing = listings[idx]
            r = random.random()
            investigated_idx = None
            if r < 0.35 and sorted_invs and state.actions_left(b) >= 2:
                inv = sorted_invs[0] if random.random() < 0.5 else random.choice(sorted_invs)
                state.queue_buyer_investigate(b, idx, inv.id)
                investigated_idx = idx
            elif r < 0.52 and sorted_mechs and state.actions_left(b) >= 2:
                mech = sorted_mechs[0] if random.random() < 0.5 else random.choice(sorted_mechs)
                state.queue_buyer_inspect(b, idx, mech.id)

            if state.actions_left(b) >= 1:
                buy_idx = investigated_idx if investigated_idx is not None else idx
                buy_listing = listings[buy_idx]
                if b.balance >= buy_listing.price:
                    state.queue_buyer_buy(b, buy_idx)
                else:
                    break


# ---------------------------------------------------------------------------
# Pygame UI
# ---------------------------------------------------------------------------

class Game:
    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT), pygame.RESIZABLE)
        pygame.display.set_caption("Lemon Car Game - Block Model")
        self.clock = pygame.time.Clock()
        try:
            self.font = pygame.font.SysFont("consolas", 18)
            self.font_lg = pygame.font.SysFont("consolas", 26)
            self.font_sm = pygame.font.SysFont("consolas", 15)
        except Exception:
            self.font = pygame.font.Font(None, 24)
            self.font_lg = pygame.font.Font(None, 32)
            self.font_sm = pygame.font.Font(None, 20)
        self.state = None
        self.screen_state = "menu"
        self.selected_role = 0
        self.selected_risk_tier = "standard"  # safe | standard | risky
        self.msg = ""
        self.scroll_offset = 0

    # ---- Drawing helpers ----

    def txt(self, text, x, y, color=WHITE, font=None):
        f = font or self.font
        surf = f.render(str(text), True, color)
        self.screen.blit(surf, (x, y))
        return surf.get_height()

    def draw_bar(self, rect, color):
        pygame.draw.rect(self.screen, color, rect)

    # ---- Screens ----

    def draw_menu(self):
        self.screen.fill(BG)
        self.txt("Lemon Car Game", WIDTH // 2 - 100, 60, YELLOW, self.font_lg)
        self.txt("Block-based market simulation", WIDTH // 2 - 140, 110, GRAY)
        lines = [
            "Each round is a BLOCK. All players commit actions,",
            "then attest. The block resolves everything at once.",
            "",
            "Mechanics & investigators are always available -",
            "but fees SURGE with demand in the same block.",
            "",
            "If two buyers want the same car, only one gets it.",
            "The other's transaction reverts. (Like on-chain contention.)",
            "",
            "Goal: most ETH after {} blocks.".format(NUM_BLOCKS),
        ]
        for i, line in enumerate(lines):
            self.txt(line, WIDTH // 2 - 240, 160 + i * 26,
                     WHITE if line else BG)
        self.txt("Press ENTER to select role", WIDTH // 2 - 130, 440, ACCENT)

    def draw_role_select(self):
        self.screen.fill(BG)
        self.txt("Select your role", WIDTH // 2 - 90, 60, YELLOW, self.font_lg)
        roles = ["Seller", "Buyer", "Mechanic", "Investigator"]
        descs = [
            "List cars (optionally inspect first). Earn from sales.",
            "Buy cars, hire investigators/mechanics. Earn car value.",
            "Earn fees when sellers or buyers request inspections.",
            "Earn fees when buyers request investigations.",
        ]
        for i, r in enumerate(roles):
            color = ACCENT if i == self.selected_role else WHITE
            arrow = "->" if i == self.selected_role else "  "
            self.txt(f"{arrow} {r}", WIDTH // 2 - 120, 150 + i * 60, color)
            if i == self.selected_role:
                self.txt(descs[i], WIDTH // 2 - 120, 176 + i * 60, GRAY,
                         self.font_sm)
        self.txt("UP/DOWN to change, ENTER to start",
                 WIDTH // 2 - 160, 420, GRAY)

    def draw_top_bar(self):
        s = self.state
        hp = s.human_player
        self.draw_bar((0, 0, WIDTH, 65), PANEL)

        self.txt(f"Block {s.block_num}/{NUM_BLOCKS}", 15, 6, YELLOW)
        phase_labels = {
            "set_rates": "SET RATES",
            "seller_commit": "SELLERS COMMIT",
            "seller_attest": "SELLERS ATTEST",
            "buyer_commit": "BUYERS COMMIT",
            "buyer_attest": "BUYERS ATTEST",
            "resolve": "MINING BLOCK...",
            "results": "BLOCK RESULTS",
        }
        phase_color = {
            "set_rates": CYAN,
            "seller_commit": ORANGE, "seller_attest": ORANGE,
            "buyer_commit": BLUE, "buyer_attest": BLUE,
            "resolve": YELLOW, "results": GREEN,
        }
        self.txt(phase_labels.get(s.phase, s.phase),
                 180, 6, phase_color.get(s.phase, WHITE))

        self.txt(f"Bal: {hp.balance:.1f}", 420, 6)
        self.txt(f"Cars: {hp.car_value_received:.1f}", 540, 6)
        self.txt(f"Eff: {hp.effective_balance:.1f}", 670, 6, GREEN)
        mx = s.actions_max.get(hp.id, ACTIONS_PER_BLOCK)
        left = s.actions_left(hp)
        self.txt(f"Actions: {left}/{mx}", 810, 6)

        # Rate bar
        mech_rates = [s.mechanic_rates[m.id]
                      for m in s.players_by_role("mechanic")]
        inv_rates = [s.inv_rates[i.id]
                     for i in s.players_by_role("investigator")]
        rstr = "Base rates -> Mech: " + " / ".join(
            f"{r:.2f}" for r in mech_rates)
        rstr += "  Inv: " + " / ".join(f"{r:.2f}" for r in inv_rates)
        self.txt(rstr, 15, 38, GRAY, self.font_sm)

        surge_note = (f"Surge: +{int(FEE_SURGE_PER_REQUEST*100)}% "
                      f"per extra request in block")
        self.txt(surge_note, 620, 38, GRAY, self.font_sm)

    def draw_playing(self):
        self.screen.fill(BG)
        s = self.state
        hp = s.human_player
        self.draw_top_bar()

        y = 75

        if s.phase == "set_rates":
            self._draw_set_rates(y)
        elif s.phase == "seller_commit":
            self._draw_seller_commit(y)
        elif s.phase == "seller_attest":
            self._draw_attest(y, "seller")
        elif s.phase == "buyer_commit":
            self._draw_buyer_commit(y)
        elif s.phase == "buyer_attest":
            self._draw_attest(y, "buyer")
        elif s.phase == "results":
            self._draw_results(y)

        # Message
        if self.msg:
            msg_y = HEIGHT - 210
            self.draw_bar((0, msg_y, WIDTH, 26), DARK_GRAY)
            self.txt(self.msg, 15, msg_y + 3,
                     RED if "!" in self.msg else CYAN)

        # Log (bottom)
        self._draw_log()

    def _draw_set_rates(self, y):
        s = self.state
        hp = s.human_player
        is_provider = hp.role in ("mechanic", "investigator")

        self.txt("RATE SETTING PHASE", 15, y, YELLOW, self.font_lg)
        y += 32

        if is_provider:
            if hp.role == "mechanic":
                rate = s.mechanic_rates.get(hp.id, FEE_MECHANIC_BASE)
                demand = s.last_mech_demand.get(hp.id, 0)
            else:
                rate = s.inv_rates.get(hp.id, FEE_INVESTIGATOR_BASE)
                demand = s.last_inv_demand.get(hp.id, 0)
            self.txt(f"Your posted rate: {rate:.2f} ETH", 15, y, GREEN)
            y += 24
            self.txt(f"Last block demand: {demand} request(s)", 15, y,
                     YELLOW if demand >= 2 else (WHITE if demand == 1 else GRAY))
            y += 28
            self.txt("W = Raise rate (+0.25)   Q = Lower rate (-0.25)", 15, y, CYAN)
            y += 22
            self.txt(f"Range: {FEE_RATE_MIN:.1f} - {FEE_RATE_MAX:.1f} ETH", 15, y, GRAY)
            y += 28
            # Show other providers
            if hp.role == "mechanic":
                others = [m for m in s.players_by_role("mechanic") if m.id != hp.id]
                for m in others:
                    self.txt(f"  {m}: {s.mechanic_rates.get(m.id, '?'):.2f} ETH",
                             15, y, GRAY)
                    y += 20
            else:
                others = [i for i in s.players_by_role("investigator") if i.id != hp.id]
                for i in others:
                    self.txt(f"  {i}: {s.inv_rates.get(i.id, '?'):.2f} ETH",
                             15, y, GRAY)
                    y += 20
            y += 10
            self.txt("ENTER = Confirm rate and continue", 15, y, GREEN)
        else:
            self.txt("Providers are setting their rates...", 15, y, GRAY)
            y += 24
            for m in s.players_by_role("mechanic"):
                self.txt(f"  {m}: {s.mechanic_rates.get(m.id, '?'):.2f} ETH", 15, y)
                y += 20
            for i in s.players_by_role("investigator"):
                self.txt(f"  {i}: {s.inv_rates.get(i.id, '?'):.2f} ETH", 15, y)
                y += 20
            y += 10
            self.txt("ENTER = Continue", 15, y, ACCENT)

    def _draw_seller_commit(self, y):
        s = self.state
        hp = s.human_player

        if hp.role == "seller":
            self.txt("YOUR TURN - Queue listings", 15, y, YELLOW)
            y += 28
            tier = self.selected_risk_tier
            src = CAR_SOURCES[tier]
            self.txt(f"R = cycle risk: {tier} (P_lemon={src['p_lemon']:.0%}, "
                     f"value {src['value_min']}-{src['value_max']})", 15, y, CYAN)
            y += 22
            mechs = s.players_by_role("mechanic")
            self.txt(f"1 = List (no inspection, 1 action, {LISTING_FEE} fee)", 15, y)
            y += 22
            for i, m in enumerate(mechs):
                rate = s.mechanic_rates[m.id]
                self.txt(f"{i+2} = List + inspect via {m} "
                         f"(base {rate:.2f}, 2 actions)", 15, y)
                y += 22
            y += 8
            self.txt("SPACE = Done committing (save remaining actions)",
                     15, y, GRAY)
            y += 22
            self.txt("ENTER = Commit + Attest in one step",
                     15, y, GREEN)
            y += 28
            queued = sum(1 for pl in s.pending_seller
                         if pl.seller.id == hp.id)
            self.txt(f"Queued: {queued} listing(s)   "
                     f"Actions left: {s.actions_left(hp)}", 15, y, ACCENT)
        else:
            self.txt(f"You are {hp.role} - sellers are committing...",
                     15, y, GRAY)
            y += 28
            self.txt("Press SPACE to auto-advance", 15, y, ACCENT)

    def _draw_buyer_commit(self, y):
        s = self.state
        hp = s.human_player

        if hp.role == "buyer":
            self.txt("YOUR TURN - Queue actions on listings", 15, y, YELLOW)
            y += 28

            if not s.resolved_listings:
                self.txt("No listings this block.", 15, y, GRAY)
                y += 22
                self.txt("ENTER = Attest (nothing to do)", 15, y, GREEN)
                return

            # Show listings
            self.txt("Listings (UP/DOWN to select):", 15, y, WHITE)
            y += 22
            for i, rl in enumerate(s.resolved_listings):
                sel_mark = ">" if i == s.selected_listing_idx else " "
                tags = ""
                if rl.mechanic_report is True:
                    tags += " [mech:PASS]"
                elif rl.mechanic_report is False:
                    tags += " [mech:FAIL]"
                # Show if human has queued an investigation for this listing
                inv_queued = any(ba.buyer.id == hp.id
                                and ba.listing_idx == i
                                and ba.action_type == "investigate"
                                for ba in s.pending_buyer)
                if inv_queued:
                    tags += " [inv:PENDING]"
                color = ACCENT if i == s.selected_listing_idx else WHITE
                self.txt(f"  {sel_mark} #{i+1}  {rl.price:.1f} ETH  "
                         f"from {rl.seller}{tags}", 15, y, color)
                y += 22

            y += 8
            # Action keys
            invs = s.players_by_role("investigator")
            mechs = s.players_by_role("mechanic")
            key_num = 1
            for inv in invs:
                rate = s.inv_rates[inv.id]
                self.txt(f"{key_num} = Investigate via {inv} "
                         f"({rate:.2f} ETH - reveals lemon, auto-cancels buy)",
                         15, y, CYAN)
                y += 20
                key_num += 1
            for m in mechs:
                rate = s.mechanic_rates[m.id]
                self.txt(f"{key_num} = Inspect via {m} "
                         f"({rate:.2f} ETH - mechanical check)", 15, y)
                y += 20
                key_num += 1
            self.txt(f"{key_num} = BUY selected listing", 15, y, GREEN)
            y += 24
            self.txt("SPACE = Done   ENTER = Commit + Attest", 15, y, GRAY)
            y += 24
            queued = sum(1 for ba in s.pending_buyer
                         if ba.buyer.id == hp.id)
            self.txt(f"Queued: {queued} action(s)   "
                     f"Actions left: {s.actions_left(hp)}", 15, y, ACCENT)
        else:
            self.txt(f"You are {hp.role} - buyers are committing...",
                     15, y, GRAY)
            y += 28
            n_listings = len(s.resolved_listings)
            self.txt(f"{n_listings} listing(s) on the market", 15, y)
            y += 22
            self.txt("Press SPACE to auto-advance", 15, y, ACCENT)

    def _draw_attest(self, y, role_phase):
        s = self.state
        hp = s.human_player
        is_active = (role_phase == "seller" and hp.role == "seller") or \
                    (role_phase == "buyer" and hp.role == "buyer")

        self.txt("ATTESTATION PHASE", 15, y, YELLOW, self.font_lg)
        y += 35
        if is_active:
            if role_phase == "seller":
                count = sum(1 for pl in s.pending_seller
                            if pl.seller.id == hp.id)
            else:
                count = sum(1 for ba in s.pending_buyer
                            if ba.buyer.id == hp.id)
            self.txt(f"You have {count} action(s) queued.", 15, y)
            y += 24
            self.txt("Nothing is final until ALL players attest",
                     15, y, ORANGE)
            y += 24
            self.txt("and the block is mined.", 15, y, ORANGE)
            y += 30
            if s.human_attested:
                self.txt("Waiting for other players...", 15, y, GRAY)
            else:
                self.txt("ENTER = Attest (confirm your actions)",
                         15, y, GREEN)
                y += 24
                self.txt("BACKSPACE = Go back and change actions",
                         15, y, RED)
        else:
            self.txt(f"Waiting for {role_phase}s to attest...",
                     15, y, GRAY)
            y += 24
            self.txt("Press SPACE to continue", 15, y, ACCENT)

    def _draw_results(self, y):
        s = self.state
        self.txt("BLOCK MINED - Results:", 15, y, GREEN, self.font_lg)
        y += 32
        # Show summary with scroll
        visible = (HEIGHT - 210 - y) // 20
        lines = s.block_summary
        offset = max(0, min(self.scroll_offset,
                            max(0, len(lines) - visible)))
        for i, line in enumerate(lines[offset:offset + visible]):
            color = WHITE
            if "LEMON" in line:
                color = RED
            elif "REVERTED" in line:
                color = ORANGE
            elif "surge" in line.lower() or "demand" in line.lower():
                color = YELLOW
            elif "bought" in line:
                color = GREEN
            elif "expired" in line:
                color = GRAY
            self.txt(line[:100], 15, y + i * 20, color, self.font_sm)

        bottom_y = y + visible * 20 + 8
        if s.block_num >= NUM_BLOCKS:
            self.txt("ENTER = See final results", 15, bottom_y, YELLOW)
        else:
            self.txt("ENTER = Next block   (scroll: mousewheel)",
                     15, bottom_y, ACCENT)

    def _draw_log(self):
        log_y = HEIGHT - 170
        self.draw_bar((0, log_y, WIDTH, 170), DARK_GRAY)
        self.txt("Log:", 15, log_y + 4, GRAY, self.font_sm)
        for i, line in enumerate(self.state.log[-9:]):
            self.txt(line[:110], 15, log_y + 22 + i * 16, WHITE,
                     self.font_sm)

    def draw_game_over(self):
        self.screen.fill(BG)
        s = self.state
        rankings = sorted(s.players,
                          key=lambda p: p.effective_balance, reverse=True)
        self.txt("GAME OVER - Final Rankings",
                 WIDTH // 2 - 150, 30, YELLOW, self.font_lg)
        self.txt("Player            Bal     Cars    Eff     Detail",
                 40, 80, GRAY, self.font_sm)
        for i, p in enumerate(rankings):
            you = " (YOU)" if p.is_human else ""
            tag = f"{i+1}. {p!r}{you}"
            line = (f"{tag:<20} {p.balance:>6.1f}  "
                    f"{p.car_value_received:>6.1f}  "
                    f"{p.effective_balance:>6.1f}")
            if p.role == "seller":
                line += f"  sales:{p.sales_as_seller} lemons:{p.lemon_sold}"
            elif p.role == "buyer":
                line += f"  buys:{p.sales_as_buyer} lemons:{p.lemon_bought}"
            elif p.role == "mechanic":
                line += f"  inspections:{p.inspections_done}"
            elif p.role == "investigator":
                line += f"  reports:{p.reports_done}"
            color = ACCENT if p.is_human else WHITE
            self.txt(line, 40, 105 + i * 28, color)

        # Gini coefficient
        bals = [p.effective_balance for p in s.players]
        n = len(bals)
        if n > 0 and sum(bals) > 0:
            sorted_b = sorted(bals)
            gini_sum = sum(abs(bi - bj)
                           for bi in sorted_b for bj in sorted_b)
            gini = gini_sum / (2 * n * sum(sorted_b))
        else:
            gini = 0
        self.txt(f"Gini coefficient: {gini:.3f}", 40, 460, GRAY)
        self.txt("R = Play again   ESC = Menu", 40, 500, ACCENT)

    # ---- Event handlers ----

    def handle_menu(self, e):
        if e.type == pygame.KEYDOWN and e.key == pygame.K_RETURN:
            self.screen_state = "role_select"

    def handle_role_select(self, e):
        if e.type == pygame.KEYDOWN:
            if e.key == pygame.K_UP:
                self.selected_role = (self.selected_role - 1) % 4
            elif e.key == pygame.K_DOWN:
                self.selected_role = (self.selected_role + 1) % 4
            elif e.key == pygame.K_RETURN:
                roles = ["seller", "buyer", "mechanic", "investigator"]
                self.state = GameState(roles[self.selected_role])
                self.state.start_block()
                # set_rates phase: if human is a provider, stay there;
                # otherwise skip through non-interactive phases
                if self.state.human_role not in ("mechanic", "investigator"):
                    self.state.advance_phase()  # set_rates -> seller_commit
                    if self.state.human_role != "seller":
                        bot_seller_commit(self.state)
                        self.state.advance_phase()  # -> seller_attest
                        self._do_seller_attest()
                        if self.state.human_role != "buyer":
                            bot_buyer_commit(self.state)
                            self.state.advance_phase()  # -> buyer_attest
                            self._do_buyer_attest()
                self.screen_state = "playing"
                self.msg = ""

    def handle_playing(self, e):
        if e.type not in (pygame.KEYDOWN, pygame.MOUSEWHEEL):
            return
        s = self.state
        hp = s.human_player

        # Scroll in results
        if e.type == pygame.MOUSEWHEEL and s.phase == "results":
            self.scroll_offset -= e.y * 2
            self.scroll_offset = max(0, self.scroll_offset)
            return

        if e.type != pygame.KEYDOWN:
            return

        if e.key == pygame.K_ESCAPE:
            self.screen_state = "menu"
            return

        # ---- SET RATES ----
        if s.phase == "set_rates":
            is_provider = hp.role in ("mechanic", "investigator")
            if is_provider:
                if hp.role == "mechanic":
                    rate = s.mechanic_rates.get(hp.id, FEE_MECHANIC_BASE)
                    if e.key == pygame.K_w:
                        rate = min(FEE_RATE_MAX, round(rate + 0.25, 2))
                        s.mechanic_rates[hp.id] = rate
                        self.msg = f"Rate: {rate:.2f}"
                    elif e.key == pygame.K_q:
                        rate = max(FEE_RATE_MIN, round(rate - 0.25, 2))
                        s.mechanic_rates[hp.id] = rate
                        self.msg = f"Rate: {rate:.2f}"
                    elif e.key == pygame.K_RETURN:
                        s.advance_phase()  # -> seller_commit
                        if hp.role not in ("seller",):
                            bot_seller_commit(s)
                            s.advance_phase()  # -> seller_attest
                            self._do_seller_attest()
                            if hp.role != "buyer":
                                bot_buyer_commit(s)
                                s.advance_phase()  # -> buyer_attest
                                self._do_buyer_attest()
                        self.msg = "Rate confirmed."
                else:
                    rate = s.inv_rates.get(hp.id, FEE_INVESTIGATOR_BASE)
                    if e.key == pygame.K_w:
                        rate = min(FEE_RATE_MAX, round(rate + 0.25, 2))
                        s.inv_rates[hp.id] = rate
                        self.msg = f"Rate: {rate:.2f}"
                    elif e.key == pygame.K_q:
                        rate = max(FEE_RATE_MIN, round(rate - 0.25, 2))
                        s.inv_rates[hp.id] = rate
                        self.msg = f"Rate: {rate:.2f}"
                    elif e.key == pygame.K_RETURN:
                        s.advance_phase()  # -> seller_commit
                        bot_seller_commit(s)
                        s.advance_phase()  # -> seller_attest
                        self._do_seller_attest()
                        if hp.role != "buyer":
                            bot_buyer_commit(s)
                            s.advance_phase()  # -> buyer_attest
                            self._do_buyer_attest()
                        self.msg = "Rate confirmed."
            else:
                if e.key in (pygame.K_RETURN, pygame.K_SPACE):
                    s.advance_phase()  # -> seller_commit
                    if hp.role != "seller":
                        bot_seller_commit(s)
                        s.advance_phase()  # -> seller_attest
                        self._do_seller_attest()
                        if hp.role != "buyer":
                            bot_buyer_commit(s)
                            s.advance_phase()  # -> buyer_attest
                            self._do_buyer_attest()

        # ---- SELLER COMMIT ----
        elif s.phase == "seller_commit":
            if hp.role == "seller":
                mechs = s.players_by_role("mechanic")
                if e.key == pygame.K_r:
                    tiers = list(CAR_SOURCES.keys())
                    idx = tiers.index(self.selected_risk_tier)
                    self.selected_risk_tier = tiers[(idx + 1) % len(tiers)]
                    self.msg = f"Risk tier: {self.selected_risk_tier}"
                elif e.key == pygame.K_1 and s.actions_left(hp) >= 1:
                    ok, msg = s.queue_seller_listing(
                        hp, risk_tier=self.selected_risk_tier)
                    self.msg = msg or "Queued listing"
                elif e.key in (pygame.K_2, pygame.K_3, pygame.K_4):
                    idx = e.key - pygame.K_2
                    if idx < len(mechs):
                        ok, msg = s.queue_seller_listing(
                            hp, inspect_mechanic_id=mechs[idx].id,
                            risk_tier=self.selected_risk_tier)
                        self.msg = msg or "Queued listing + inspection"
                    else:
                        self.msg = "No such mechanic"
                elif e.key == pygame.K_SPACE:
                    # Done committing, go to attest
                    bot_seller_commit(s)
                    s.advance_phase()  # -> seller_attest
                    self.msg = "Commit done. Attest to finalize."
                elif e.key == pygame.K_RETURN:
                    # Commit + attest in one step
                    bot_seller_commit(s)
                    s.advance_phase()  # -> seller_attest
                    self._do_seller_attest()
            else:
                if e.key in (pygame.K_SPACE, pygame.K_RETURN):
                    bot_seller_commit(s)
                    s.advance_phase()  # -> seller_attest
                    self._do_seller_attest()

        # ---- SELLER ATTEST ----
        elif s.phase == "seller_attest":
            if hp.role == "seller":
                if e.key == pygame.K_RETURN:
                    self._do_seller_attest()
                elif e.key == pygame.K_BACKSPACE:
                    # Undo: remove human's pending, refund actions
                    to_remove = [pl for pl in s.pending_seller
                                 if pl.seller.id == hp.id]
                    for pl in to_remove:
                        s.pending_seller.remove(pl)
                        cost = 2 if pl.inspect_mechanic_id is not None else 1
                        s.actions_used[hp.id] = max(
                            0, s.actions_used.get(hp.id, 0) - cost)
                    # Also clear bot commits so they re-decide
                    s.pending_seller = [pl for pl in s.pending_seller
                                        if pl.seller.is_human]
                    for seller in s.players_by_role("seller"):
                        if not seller.is_human:
                            s.actions_used[seller.id] = 0
                    s.phase = "seller_commit"
                    self.msg = "Rolled back - re-commit your actions"
            else:
                if e.key in (pygame.K_SPACE, pygame.K_RETURN):
                    self._do_seller_attest()

        # ---- BUYER COMMIT ----
        elif s.phase == "buyer_commit":
            if hp.role == "buyer":
                invs = s.players_by_role("investigator")
                mechs = s.players_by_role("mechanic")
                n_invs = len(invs)
                n_mechs = len(mechs)
                buy_key_num = n_invs + n_mechs + 1

                if e.key == pygame.K_UP and s.resolved_listings:
                    s.selected_listing_idx = max(
                        0, s.selected_listing_idx - 1)
                elif e.key == pygame.K_DOWN and s.resolved_listings:
                    s.selected_listing_idx = min(
                        len(s.resolved_listings) - 1,
                        s.selected_listing_idx + 1)
                elif e.key in (pygame.K_1, pygame.K_2, pygame.K_3,
                               pygame.K_4, pygame.K_5, pygame.K_6,
                               pygame.K_7, pygame.K_8, pygame.K_9):
                    key_num = e.key - pygame.K_0
                    idx = s.selected_listing_idx
                    if s.resolved_listings and s.actions_left(hp) >= 1:
                        if key_num <= n_invs:
                            inv = invs[key_num - 1]
                            ok, msg = s.queue_buyer_investigate(
                                hp, idx, inv.id)
                            self.msg = msg
                        elif key_num <= n_invs + n_mechs:
                            mech = mechs[key_num - n_invs - 1]
                            ok, msg = s.queue_buyer_inspect(
                                hp, idx, mech.id)
                            self.msg = msg
                        elif key_num == buy_key_num:
                            ok, msg = s.queue_buyer_buy(hp, idx)
                            self.msg = msg
                        else:
                            self.msg = "Invalid key"
                    else:
                        self.msg = "No listings or no actions"
                elif e.key == pygame.K_SPACE:
                    bot_buyer_commit(s)
                    s.advance_phase()  # -> buyer_attest
                    self.msg = "Commit done. Attest to finalize."
                elif e.key == pygame.K_RETURN:
                    bot_buyer_commit(s)
                    s.advance_phase()  # -> buyer_attest
                    self._do_buyer_attest()
            else:
                if e.key in (pygame.K_SPACE, pygame.K_RETURN):
                    bot_buyer_commit(s)
                    s.advance_phase()  # -> buyer_attest
                    self._do_buyer_attest()

        # ---- BUYER ATTEST ----
        elif s.phase == "buyer_attest":
            if hp.role == "buyer":
                if e.key == pygame.K_RETURN:
                    self._do_buyer_attest()
                elif e.key == pygame.K_BACKSPACE:
                    to_remove = [ba for ba in s.pending_buyer
                                 if ba.buyer.id == hp.id]
                    for ba in to_remove:
                        s.pending_buyer.remove(ba)
                        s.actions_used[hp.id] = max(
                            0, s.actions_used.get(hp.id, 0) - 1)
                    # Clear bot commits so they re-decide
                    s.pending_buyer = [ba for ba in s.pending_buyer
                                       if ba.buyer.is_human]
                    for buyer in s.players_by_role("buyer"):
                        if not buyer.is_human:
                            s.actions_used[buyer.id] = 0
                    s.phase = "buyer_commit"
                    self.msg = "Rolled back - re-commit your actions"
            else:
                if e.key in (pygame.K_SPACE, pygame.K_RETURN):
                    self._do_buyer_attest()

        # ---- RESULTS ----
        elif s.phase == "results":
            if e.key == pygame.K_RETURN:
                if s.block_num >= NUM_BLOCKS:
                    self.screen_state = "game_over"
                else:
                    s.save_actions_for_carryover()
                    s.start_block()
                    self.scroll_offset = 0
                    # If human is a provider, stop at set_rates
                    if hp.role in ("mechanic", "investigator"):
                        self.msg = f"Block {s.block_num} — set your rate"
                    else:
                        s.advance_phase()  # set_rates -> seller_commit
                        if hp.role != "seller":
                            bot_seller_commit(s)
                            s.advance_phase()  # -> seller_attest
                            self._do_seller_attest()
                            if hp.role != "buyer":
                                bot_buyer_commit(s)
                                s.advance_phase()  # -> buyer_attest
                                self._do_buyer_attest()
                        self.msg = f"Block {s.block_num}"

    def _do_seller_attest(self):
        """All sellers attested -> resolve seller phase, advance."""
        s = self.state
        s.human_attested = True
        s.resolve_seller_phase()
        s.advance_phase()  # -> buyer_commit
        if s.human_role != "buyer":
            # Buyer phase runs automatically if human isn't a buyer
            pass  # caller handles this
        else:
            self.msg = "Listings resolved. Queue your buyer actions."

    def _do_buyer_attest(self):
        """All buyers attested -> resolve buyer phase, show results."""
        s = self.state
        s.human_attested = True
        s.resolve_buyer_phase()
        s.advance_phase()  # -> resolve
        s.advance_phase()  # -> results
        self.msg = "Block mined!"

    def handle_game_over(self, e):
        if e.type == pygame.KEYDOWN:
            if e.key == pygame.K_r:
                self.screen_state = "role_select"
                self.state = None
            elif e.key == pygame.K_ESCAPE:
                self.screen_state = "menu"

    # ---- Main loop ----

    def run(self):
        while True:
            for e in pygame.event.get():
                if e.type == pygame.QUIT:
                    pygame.quit()
                    sys.exit()
                if self.screen_state == "menu":
                    self.handle_menu(e)
                elif self.screen_state == "role_select":
                    self.handle_role_select(e)
                elif self.screen_state == "playing":
                    self.handle_playing(e)
                elif self.screen_state == "game_over":
                    self.handle_game_over(e)

            if self.screen_state == "menu":
                self.draw_menu()
            elif self.screen_state == "role_select":
                self.draw_role_select()
            elif self.screen_state == "playing":
                self.draw_playing()
            elif self.screen_state == "game_over":
                self.draw_game_over()

            pygame.display.flip()
            self.clock.tick(FPS)


if __name__ == "__main__":
    Game().run()
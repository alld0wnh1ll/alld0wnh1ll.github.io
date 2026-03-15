#!/usr/bin/env python3
"""Comprehensive tests for Lemon Car Game logic."""

import random
import sys
from game import (
    GameState, PendingListing, PendingBuyerAction, ResolvedListing,
    CAR_SOURCES, CAR_LEMON_MULT, LEMON_SELLER_PENALTY, NUM_BLOCKS,
    ACTIONS_PER_BLOCK, MAX_CARRYOVER, FEE_SURGE_PER_REQUEST,
    bot_seller_commit, bot_buyer_commit,
)

errors = []

def check(name, condition, detail=""):
    if not condition:
        errors.append(f"FAIL: {name} - {detail}")
        print(f"  FAIL: {name} - {detail}")
    else:
        print(f"  PASS: {name}")


# ---------------------------------------------------------------
# Test 1: Full headless game for each role (no crashes)
# ---------------------------------------------------------------
print("=== Test 1: Full headless game for each role ===")
for role in ["seller", "buyer", "mechanic", "investigator"]:
    random.seed(42)
    s = GameState(role)
    s.start_block()
    for block_idx in range(NUM_BLOCKS):
        s.phase = "seller_commit"
        bot_seller_commit(s)
        s.resolve_seller_phase()
        s.phase = "buyer_commit"
        bot_buyer_commit(s)
        s.resolve_buyer_phase()
        if block_idx < NUM_BLOCKS - 1:
            s.save_actions_for_carryover()
            s.start_block()
    hp = s.human_player
    neg = [p for p in s.players if p.balance < -1]
    check(f"role={role} no crash, block={s.block_num}", s.block_num == NUM_BLOCKS)
    check(f"role={role} no negative balances", len(neg) == 0,
          ", ".join(f"{p}={p.balance:.2f}" for p in neg))
print()


# ---------------------------------------------------------------
# Test 2: Lemon seller penalty
# ---------------------------------------------------------------
print("=== Test 2: Lemon seller penalty ===")
for attempt in range(50):
    random.seed(attempt)
    s = GameState("buyer")
    s.start_block()
    s.phase = "seller_commit"
    seller = s.players_by_role("seller")[0]
    pl = PendingListing(seller, risk_tier="risky")
    s.pending_seller = [pl]
    s.actions_used[seller.id] = 1
    s.resolve_seller_phase()
    rl = s.resolved_listings[0]
    if not rl.is_lemon:
        continue
    # Found a lemon; test the penalty
    seller_before = rl.seller.balance
    buyer = s.players_by_role("buyer")[0]
    buyer_before = buyer.balance
    s.pending_buyer = [PendingBuyerAction(buyer, "buy", listing_idx=0)]
    s.actions_used[buyer.id] = 1
    s.resolve_buyer_phase()
    seller_gain = rl.seller.balance - seller_before
    expected_gain = rl.price * (1 - LEMON_SELLER_PENALTY)
    check("seller gets penalized amount",
          abs(seller_gain - expected_gain) < 0.01,
          f"gain={seller_gain:.3f}, expected={expected_gain:.3f}")
    buyer_paid = buyer_before - buyer.balance
    check("buyer pays full price",
          abs(buyer_paid - rl.price) < 0.01,
          f"paid={buyer_paid:.3f}, price={rl.price:.3f}")
    check("buyer gets lemon car value",
          abs(buyer.car_value_received - rl.car_value * CAR_LEMON_MULT) < 0.01)
    break
else:
    errors.append("FAIL: Could not find lemon in 50 attempts")
    print("  FAIL: no lemon found in 50 attempts")
print()


# ---------------------------------------------------------------
# Test 3: Good car = no penalty
# ---------------------------------------------------------------
print("=== Test 3: Good car has no penalty ===")
for attempt in range(50):
    random.seed(100 + attempt)
    s = GameState("buyer")
    s.start_block()
    s.phase = "seller_commit"
    seller = s.players_by_role("seller")[0]
    pl = PendingListing(seller, risk_tier="safe")
    s.pending_seller = [pl]
    s.actions_used[seller.id] = 1
    s.resolve_seller_phase()
    rl = s.resolved_listings[0]
    if rl.is_lemon:
        continue
    seller_before = rl.seller.balance
    buyer = s.players_by_role("buyer")[0]
    s.pending_buyer = [PendingBuyerAction(buyer, "buy", listing_idx=0)]
    s.actions_used[buyer.id] = 1
    s.resolve_buyer_phase()
    seller_gain = rl.seller.balance - seller_before
    check("seller gets full price for good car",
          abs(seller_gain - rl.price) < 0.01,
          f"gain={seller_gain:.3f}, price={rl.price:.3f}")
    break
else:
    errors.append("FAIL: Could not find good car in 50 attempts")
print()


# ---------------------------------------------------------------
# Test 4: Risk tier distributions
# ---------------------------------------------------------------
print("=== Test 4: Risk tier distributions (10000 samples) ===")
for tier, src in CAR_SOURCES.items():
    lemons = 0
    values = []
    for _ in range(10000):
        is_l = random.random() < src["p_lemon"]
        if is_l:
            lemons += 1
        v = src["value_min"] + random.random() * (src["value_max"] - src["value_min"])
        values.append(v)
    avg_v = sum(values) / len(values)
    lemon_rate = lemons / 10000
    expected_lemon = src["p_lemon"]
    expected_avg = (src["value_min"] + src["value_max"]) / 2
    check(f"{tier} lemon rate ~{expected_lemon}",
          abs(lemon_rate - expected_lemon) < 0.03,
          f"got {lemon_rate:.3f}")
    check(f"{tier} avg value ~{expected_avg:.1f}",
          abs(avg_v - expected_avg) < 0.3,
          f"got {avg_v:.2f}")
print()


# ---------------------------------------------------------------
# Test 5: Surge pricing
# ---------------------------------------------------------------
print("=== Test 5: Surge pricing ===")
random.seed(42)
s = GameState("buyer")
s.start_block()
s.phase = "seller_commit"
mech = s.players_by_role("mechanic")[0]
base_rate = s.mechanic_rates[mech.id]
sellers = s.players_by_role("seller")
for seller in sellers[:3]:
    s.queue_seller_listing(seller, inspect_mechanic_id=mech.id, risk_tier="standard")
s.resolve_seller_phase()
eff_rate = s.effective_mech_rates[mech.id]
expected = round(base_rate * (1 + FEE_SURGE_PER_REQUEST * 2), 2)
check("surge pricing 3 requests",
      eff_rate == expected,
      f"effective={eff_rate}, expected={expected}")
print()


# ---------------------------------------------------------------
# Test 6: Contention (two buyers, one car)
# ---------------------------------------------------------------
print("=== Test 6: Contention ===")
random.seed(42)
s = GameState("mechanic")
s.start_block()
s.phase = "seller_commit"
seller = s.players_by_role("seller")[0]
s.queue_seller_listing(seller, risk_tier="standard")
s.resolve_seller_phase()
s.phase = "buyer_commit"
b1 = s.players_by_role("buyer")[0]
b2 = s.players_by_role("buyer")[1]
b1_before = b1.balance
b2_before = b2.balance
s.queue_buyer_buy(b1, 0)
s.queue_buyer_buy(b2, 0)
s.resolve_buyer_phase()
b1_bought = b1.balance < b1_before
b2_bought = b2.balance < b2_before
check("exactly one buyer gets the car",
      b1_bought != b2_bought,
      f"b1={b1_bought}, b2={b2_bought}")
reverted = any("REVERTED" in line for line in s.block_summary)
check("REVERTED in block summary", reverted)
print()


# ---------------------------------------------------------------
# Test 7: Action carryover
# ---------------------------------------------------------------
print("=== Test 7: Action carryover ===")
random.seed(42)
s = GameState("seller")
s.start_block()
s.phase = "seller_commit"
hp = s.human_player
s.use_action(hp, 1)
s.save_actions_for_carryover()
saved = s.actions_saved[hp.id]
check(f"saved {saved} (expect {min(2, MAX_CARRYOVER)})",
      saved == min(ACTIONS_PER_BLOCK - 1, MAX_CARRYOVER))
s.start_block()
max_a = s.actions_max[hp.id]
check(f"block 2 max={max_a} (expect {ACTIONS_PER_BLOCK + saved})",
      max_a == ACTIONS_PER_BLOCK + saved)
print()


# ---------------------------------------------------------------
# Test 8: Phase transitions
# ---------------------------------------------------------------
print("=== Test 8: Phase transitions ===")
random.seed(42)
s = GameState("seller")
s.start_block()
check("starts at set_rates", s.phase == "set_rates")
s.advance_phase()
s.advance_phase()
check("-> seller_attest", s.phase == "seller_attest")
s.advance_phase()
check("-> buyer_commit", s.phase == "buyer_commit")
s.advance_phase()
check("-> buyer_attest", s.phase == "buyer_attest")
s.advance_phase()
check("-> resolve", s.phase == "resolve")
s.advance_phase()
check("-> results", s.phase == "results")
# Advance past results should stay at results
s.advance_phase()
check("stays at results", s.phase == "results")
print()


# ---------------------------------------------------------------
# Test 9: Bot seller uses all actions
# ---------------------------------------------------------------
print("=== Test 9: Bot sellers use all actions ===")
random.seed(42)
s = GameState("buyer")
s.start_block()
s.phase = "seller_commit"
bot_seller_commit(s)
for seller in s.players_by_role("seller"):
    if not seller.is_human:
        left = s.actions_left(seller)
        check(f"{seller} actions_left={left} (expect 0)", left == 0)
check(f"pending listings = {len(s.pending_seller)} (expect > 0)",
      len(s.pending_seller) > 0)
print()


# ---------------------------------------------------------------
# Test 10: Bot buyer commit doesn't crash with empty listings
# ---------------------------------------------------------------
print("=== Test 10: Bot buyer with no listings ===")
random.seed(42)
s = GameState("seller")
s.start_block()
s.resolved_listings = []
s.phase = "buyer_commit"
bot_buyer_commit(s)  # should not crash
check("no crash with empty listings", True)
print()


# ---------------------------------------------------------------
# Test 11: ETH conservation (only lemon penalties destroy ETH)
# ---------------------------------------------------------------
print("=== Test 11: ETH conservation ===")
random.seed(77)
s = GameState("seller")
s.start_block()
eth_before = sum(p.balance for p in s.players)
for block_idx in range(NUM_BLOCKS):
    s.phase = "seller_commit"
    bot_seller_commit(s)
    s.resolve_seller_phase()
    s.phase = "buyer_commit"
    bot_buyer_commit(s)
    s.resolve_buyer_phase()
    if block_idx < NUM_BLOCKS - 1:
        s.save_actions_for_carryover()
        s.start_block()
eth_after = sum(p.balance for p in s.players)
lemons_sold = sum(p.lemon_sold for p in s.players)
total_listings = sum(p.sales_as_seller for p in s.players)
eth_destroyed = eth_before - eth_after
# ETH is destroyed by lemon penalties AND listing fees
check(f"ETH not created (before={eth_before:.1f}, after={eth_after:.1f})",
      eth_after <= eth_before + 0.01,
      f"extra ETH created: {eth_after - eth_before:.2f}")
check(f"ETH destroyed ({eth_destroyed:.2f}) from {lemons_sold} lemons + listing fees",
      eth_destroyed > 0,
      "no ETH destroyed despite listing fees")
car_value = sum(p.car_value_received for p in s.players)
print(f"  Car value generated (external asset): {car_value:.2f}")
print()


# ---------------------------------------------------------------
# Test 12: RPG Mafia-style (ResolvedListing with bribe metadata)
# ---------------------------------------------------------------
print("=== Test 12: RPG Mafia-style flow ===")
from game_rpg import RPGState
from game import ResolvedListing, LISTING_FEE, bot_buyer_commit
rpg = RPGState("seller")
gs = rpg.gs
rpg.begin_block()
hp = rpg.hp
hp.balance -= LISTING_FEE
gs.use_action(hp)
rl = ResolvedListing(hp, 5.0, True, 4.0, True,
    inspected_by=1, mechanic_bribed=True, mechanic_fee=0.55, mechanic_bribe=2.0)
gs.resolved_listings.append(rl)
rpg.seller_phase_done = True
gs._bal_before = {p.id: p.balance for p in gs.players}
bot_buyer_commit(gs)
gs.resolve_buyer_phase()
check("RPGState block complete", rpg.gs.block_num >= 1)
check("ResolvedListing has mechanic_bribed", rl.mechanic_bribed)
check("ResolvedListing has inspected_by", rl.inspected_by == 1)
print()


# ---------------------------------------------------------------
# Summary
# ---------------------------------------------------------------
print("=" * 50)
if errors:
    print(f"FAILURES: {len(errors)}")
    for e in errors:
        print(f"  {e}")
    sys.exit(1)
else:
    print("ALL TESTS PASSED")
    sys.exit(0)

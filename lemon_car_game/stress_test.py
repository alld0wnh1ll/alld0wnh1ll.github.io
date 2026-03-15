#!/usr/bin/env python3
"""
Lemon Car Game — Exhaustive Parameter Stress Tester

Sweeps across permutations of key game constants, runs many headless
games for each configuration, and reports which parameter sets yield
the fairest role balance, lowest Gini, and highest minimum balance.

Usage:
    python stress_test.py                  # default sweep
    python stress_test.py --quick          # fast scan (fewer combos, fewer runs)
    python stress_test.py --deep           # thorough scan (more combos, more runs)
    python stress_test.py --json results.json   # dump full results to file
"""

import random
import argparse
import itertools
import json
import sys
import time

from game import (
    GameState, CAR_SOURCES, NUM_BLOCKS, ROLE_COUNTS,
    bot_seller_commit, bot_buyer_commit,
    ACTIONS_PER_BLOCK,
)
import game as game_module


def run_headless(seed=None):
    if seed is not None:
        random.seed(seed)
    state = GameState("seller")
    state.start_block()
    for block_idx in range(NUM_BLOCKS):
        state.phase = "seller_commit"
        bot_seller_commit(state)
        state.resolve_seller_phase()
        state.phase = "buyer_commit"
        bot_buyer_commit(state)
        state.resolve_buyer_phase()
        if block_idx < NUM_BLOCKS - 1:
            state.save_actions_for_carryover()
            state.start_block()
    return state


def gini(values):
    a = sorted([x for x in values if x == x and x >= 0])
    if not a:
        return 0.0
    n = len(a)
    s = sum(a)
    if s <= 0:
        return 0.0
    num = sum((2 * (i + 1) - n - 1) * x for i, x in enumerate(a))
    return num / (n * s)


def eff(p):
    return p.balance + p.car_value_received


def eval_config(runs=50, base_seed=1000):
    role_totals = {}
    all_gini = []
    all_min = []
    neg_count = 0

    for i in range(runs):
        state = run_headless(seed=base_seed + i)
        bals = [eff(p) for p in state.players]
        all_gini.append(gini(bals))
        all_min.append(min(bals))
        neg_count += sum(1 for b in bals if b < 0)
        for p in state.players:
            if p.role not in role_totals:
                role_totals[p.role] = []
            role_totals[p.role].append(eff(p))

    role_avgs = {}
    for role, vals in role_totals.items():
        role_avgs[role] = sum(vals) / len(vals)

    avgs = list(role_avgs.values())
    mean_avg = sum(avgs) / len(avgs)
    spread = max(avgs) - min(avgs)
    std_avg = (sum((a - mean_avg) ** 2 for a in avgs) / len(avgs)) ** 0.5
    avg_gini = sum(all_gini) / len(all_gini)
    avg_min = sum(all_min) / len(all_min)

    score = (
        1.0
        - (spread / max(mean_avg, 1)) * 2.0
        - avg_gini * 0.5
        - (0.2 if avg_min < 80 else 0)
        - (0.3 if neg_count > 0 else 0)
    )
    score = max(0, min(1, score))

    return {
        "score": round(score, 4),
        "role_avgs": {r: round(v, 1) for r, v in role_avgs.items()},
        "spread": round(spread, 1),
        "std": round(std_avg, 2),
        "gini": round(avg_gini, 4),
        "min_bal": round(avg_min, 1),
        "neg_count": neg_count,
    }


PARAM_GRID_DEFAULT = {
    "CAR_LEMON_MULT":       [0.20, 0.25, 0.30, 0.35],
    "LEMON_SELLER_PENALTY": [0.25, 0.35, 0.45],
    "SLASH_SELLER_PCT":     [0.30, 0.40, 0.50],
    "LISTING_FEE":          [0.5, 1.0, 1.5],
    "FEE_MECHANIC_BASE":    [0.45, 0.55, 0.70],
    "FEE_INVESTIGATOR_BASE":[0.70, 0.90, 1.10],
}

PARAM_GRID_QUICK = {
    "CAR_LEMON_MULT":       [0.20, 0.30, 0.40],
    "SLASH_SELLER_PCT":     [0.30, 0.45, 0.60],
    "FEE_MECHANIC_BASE":    [0.45, 0.55, 0.70],
    "FEE_INVESTIGATOR_BASE":[0.70, 0.90, 1.10],
}

PARAM_GRID_DEEP = {
    "CAR_LEMON_MULT":       [0.15, 0.20, 0.25, 0.30, 0.35, 0.40],
    "LEMON_SELLER_PENALTY": [0.20, 0.30, 0.35, 0.40, 0.50],
    "SLASH_SELLER_PCT":     [0.25, 0.35, 0.45, 0.55],
    "SLASH_MECHANIC_PCT":   [0.30, 0.50, 0.70],
    "LISTING_FEE":          [0.5, 1.0, 1.5],
    "FEE_MECHANIC_BASE":    [0.40, 0.55, 0.70, 0.85],
    "FEE_INVESTIGATOR_BASE":[0.60, 0.80, 1.00, 1.20],
    "FEE_SURGE_PER_REQUEST":[0.2, 0.4, 0.6],
}


def apply_params(params):
    for key, val in params.items():
        setattr(game_module, key, val)


def snapshot_defaults():
    keys = set()
    for grid in [PARAM_GRID_DEFAULT, PARAM_GRID_QUICK, PARAM_GRID_DEEP]:
        keys.update(grid.keys())
    return {k: getattr(game_module, k) for k in keys if hasattr(game_module, k)}


def main():
    parser = argparse.ArgumentParser(description="Lemon Car Game stress tester")
    parser.add_argument("--quick", action="store_true", help="Fast scan (fewer combos)")
    parser.add_argument("--deep", action="store_true", help="Thorough scan")
    parser.add_argument("--runs", type=int, default=None, help="Runs per config")
    parser.add_argument("--json", type=str, default=None, help="Save results to JSON file")
    parser.add_argument("--top", type=int, default=10, help="Show top N configs")
    args = parser.parse_args()

    if args.deep:
        grid = PARAM_GRID_DEEP
        runs = args.runs or 30
    elif args.quick:
        grid = PARAM_GRID_QUICK
        runs = args.runs or 20
    else:
        grid = PARAM_GRID_DEFAULT
        runs = args.runs or 40

    defaults = snapshot_defaults()

    keys = sorted(grid.keys())
    value_lists = [grid[k] for k in keys]
    combos = list(itertools.product(*value_lists))
    total = len(combos)

    print("=" * 70)
    print("LEMON CAR GAME — EXHAUSTIVE PARAMETER STRESS TEST")
    print("=" * 70)
    print(f"Parameters swept: {len(keys)}")
    for k in keys:
        print(f"  {k}: {grid[k]}  (current: {defaults.get(k, '?')})")
    print(f"Total configurations: {total}")
    print(f"Runs per config: {runs}")
    print(f"Total simulated games: {total * runs}")
    print("=" * 70)
    print()

    results = []
    t0 = time.time()
    last_print = t0

    for idx, combo in enumerate(combos):
        params = dict(zip(keys, combo))
        apply_params(params)

        metrics = eval_config(runs=runs, base_seed=idx * 1000)
        results.append({"params": params, **metrics})

        now = time.time()
        if now - last_print > 5.0 or idx == total - 1:
            elapsed = now - t0
            pct = (idx + 1) / total * 100
            eta = (elapsed / (idx + 1)) * (total - idx - 1) if idx > 0 else 0
            print(f"  [{idx+1}/{total}] {pct:.0f}%  "
                  f"elapsed={elapsed:.0f}s  ETA={eta:.0f}s  "
                  f"score={metrics['score']:.3f}  spread={metrics['spread']:.1f}")
            last_print = now

    apply_params(defaults)

    results.sort(key=lambda r: r["score"], reverse=True)

    print()
    print("=" * 70)
    print(f"TOP {args.top} FAIREST CONFIGURATIONS")
    print("=" * 70)
    for i, r in enumerate(results[:args.top]):
        print(f"\n#{i+1}  Score={r['score']:.4f}  Spread={r['spread']:.1f}  "
              f"Gini={r['gini']:.4f}  MinBal={r['min_bal']:.0f}")
        for k, v in r["params"].items():
            marker = " <--" if v != defaults.get(k) else ""
            print(f"    {k} = {v}{marker}")
        for role in ["seller", "buyer", "mechanic", "investigator"]:
            print(f"    {role:>14}: {r['role_avgs'].get(role, 0):.1f}")

    print()
    print("=" * 70)
    print(f"BOTTOM 5 WORST CONFIGURATIONS")
    print("=" * 70)
    for i, r in enumerate(results[-5:]):
        print(f"\n#{total - 4 + i}  Score={r['score']:.4f}  Spread={r['spread']:.1f}  "
              f"Gini={r['gini']:.4f}  MinBal={r['min_bal']:.0f}")
        for k, v in r["params"].items():
            marker = " <--" if v != defaults.get(k) else ""
            print(f"    {k} = {v}{marker}")
        for role in ["seller", "buyer", "mechanic", "investigator"]:
            print(f"    {role:>14}: {r['role_avgs'].get(role, 0):.1f}")

    current_params = {k: defaults.get(k) for k in keys}
    current_result = None
    for r in results:
        if r["params"] == current_params:
            current_result = r
            break
    if current_result:
        rank = results.index(current_result) + 1
        print(f"\n{'=' * 70}")
        print(f"CURRENT CONFIG RANK: #{rank} / {total}  "
              f"Score={current_result['score']:.4f}  "
              f"Spread={current_result['spread']:.1f}")
        for role in ["seller", "buyer", "mechanic", "investigator"]:
            print(f"    {role:>14}: {current_result['role_avgs'].get(role, 0):.1f}")
    else:
        print(f"\n(Current config not in sweep grid)")

    best = results[0]
    if best["params"] != current_params:
        print(f"\nRECOMMENDED CHANGES for optimal fairness:")
        for k in keys:
            if best["params"].get(k) != current_params.get(k):
                print(f"  {k}: {current_params.get(k)} -> {best['params'][k]}")

    if args.json:
        with open(args.json, "w") as f:
            json.dump({
                "grid": grid,
                "defaults": {k: defaults.get(k) for k in keys},
                "runs_per_config": runs,
                "total_configs": total,
                "results": results,
            }, f, indent=2)
        print(f"\nFull results saved to {args.json}")

    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())

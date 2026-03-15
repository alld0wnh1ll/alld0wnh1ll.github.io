#!/usr/bin/env python3
"""
Lemon Car Game - Headless Simulator for Balance Testing

Runs many games without the Pygame UI to collect metrics:
- Role balance (effective balance by role)
- Risk/reward payoff (seller outcomes by risk tier)
- Gini coefficient, participation rates
- Fairness score

Usage: python simulate.py [--runs 500] [--seed 42]
"""

import random
import argparse
import json
import sys

# Import game logic without initializing Pygame display
from game import (
    GameState, CAR_SOURCES, NUM_BLOCKS, ROLE_COUNTS,
    bot_seller_commit, bot_buyer_commit,
    ACTIONS_PER_BLOCK, FEE_MECHANIC_BASE, FEE_INVESTIGATOR_BASE,
)


def run_headless_game(human_role="seller", seed=None):
    """Run one full game to completion, return final state."""
    if seed is not None:
        random.seed(seed)
    state = GameState(human_role)
    state.start_block()

    for block_idx in range(NUM_BLOCKS):
        # Skip set_rates (bots already adapted in start_block)
        state.phase = "seller_commit"

        # Seller phase
        bot_seller_commit(state)
        state.resolve_seller_phase()
        state.phase = "buyer_commit"

        # Buyer phase
        bot_buyer_commit(state)
        state.resolve_buyer_phase()

        # Next block (except after last)
        if block_idx < NUM_BLOCKS - 1:
            state.save_actions_for_carryover()
            state.start_block()

    return state


def gini(values):
    """Gini coefficient (0=perfect equality, 1=perfect inequality)."""
    a = sorted([x for x in values if not (x != x or x < 0)])
    if not a:
        return 0.0
    n = len(a)
    s = sum(a)
    if s <= 0:
        return 0.0
    num = sum((2 * (i + 1) - n - 1) * x for i, x in enumerate(a))
    return num / (n * s)


def effective_balance(p):
    return p.balance + p.car_value_received


def compute_metrics(state):
    """Compute balance and fairness metrics from final game state."""
    players = state.players
    balances = [effective_balance(p) for p in players]

    by_role = {}
    for p in players:
        role = p.role
        if role not in by_role:
            by_role[role] = []
        by_role[role].append(effective_balance(p))

    role_stats = {}
    for role, vals in by_role.items():
        avg = sum(vals) / len(vals) if vals else 0
        variance = sum((x - avg) ** 2 for x in vals) / len(vals) if vals else 0
        std = variance ** 0.5
        role_stats[role] = {
            "avg": round(avg, 2),
            "std": round(std, 2),
            "min": round(min(vals), 2) if vals else 0,
            "max": round(max(vals), 2) if vals else 0,
            "gini": round(gini(vals), 3),
        }

    overall_gini = gini(balances)
    role_avgs = list(role_stats.values())
    role_mean = sum(r["avg"] for r in role_avgs) / len(role_avgs) if role_avgs else 0
    role_var = sum((r["avg"] - role_mean) ** 2 for r in role_avgs) / len(role_avgs) if role_avgs else 0
    role_imbalance = (role_var ** 0.5) / max(role_mean, 0.01)

    participation = {}
    for role in ["seller", "buyer", "mechanic", "investigator"]:
        role_players = [p for p in players if p.role == role]
        if role == "seller":
            part = sum(1 for p in role_players if p.sales_as_seller > 0) / max(len(role_players), 1)
        elif role == "buyer":
            part = sum(1 for p in role_players if p.sales_as_buyer > 0) / max(len(role_players), 1)
        elif role == "mechanic":
            part = sum(1 for p in role_players if p.inspections_done > 0) / max(len(role_players), 1)
        else:
            part = sum(1 for p in role_players if p.reports_done > 0) / max(len(role_players), 1)
        participation[role] = round(part, 2)

    min_bal = min(balances)
    avg_part = sum(participation.values()) / 4
    fairness = (
        1.0
        - overall_gini * 0.35
        - role_imbalance * 1.5
        - (0.15 if min_bal < 50 else 0)
        - (0.25 if min_bal < 0 else 0)
        + avg_part * 0.2
    )
    fairness = max(0, min(1, fairness))

    total_sales = sum(p.sales_as_seller for p in players)
    lemon_sales = sum(p.lemon_sold for p in players)

    return {
        "fairness": round(fairness, 3),
        "gini": round(overall_gini, 3),
        "role_imbalance": round(role_imbalance, 3),
        "min_balance": round(min_bal, 2),
        "avg_balance": round(sum(balances) / len(balances), 2),
        "by_role": role_stats,
        "participation": participation,
        "total_sales": total_sales,
        "lemon_sales": lemon_sales,
        "lemon_rate": round(lemon_sales / max(total_sales, 1), 2),
    }


def main():
    parser = argparse.ArgumentParser(description="Lemon Car Game balance simulator")
    parser.add_argument("--runs", type=int, default=200, help="Number of games to simulate")
    parser.add_argument("--seed", type=int, default=None, help="Random seed for reproducibility")
    parser.add_argument("--json", action="store_true", help="Output full JSON results")
    args = parser.parse_args()

    print("Lemon Car Game - Balance Simulator")
    print("=" * 50)
    print(f"Risk tiers: {list(CAR_SOURCES.keys())}")
    for k, v in CAR_SOURCES.items():
        print(f"  {k}: P_lemon={v['p_lemon']:.0%}, value={v['value_min']}-{v['value_max']}")
    print(f"Blocks: {NUM_BLOCKS}, Runs: {args.runs}")
    print()

    results = []
    for i in range(args.runs):
        seed = (args.seed + i) if args.seed is not None else None
        human_role = ["seller", "buyer", "mechanic", "investigator"][i % 4]
        state = run_headless_game(human_role=human_role, seed=seed)
        metrics = compute_metrics(state)
        results.append({"run": i, "metrics": metrics})

    # Aggregate
    fairness_vals = [r["metrics"]["fairness"] for r in results]
    gini_vals = [r["metrics"]["gini"] for r in results]
    min_bal_vals = [r["metrics"]["min_balance"] for r in results]
    sales_vals = [r["metrics"]["total_sales"] for r in results]

    avg_fairness = sum(fairness_vals) / len(fairness_vals)
    avg_gini = sum(gini_vals) / len(gini_vals)
    avg_min = sum(min_bal_vals) / len(min_bal_vals)
    avg_sales = sum(sales_vals) / len(sales_vals)

    print("Aggregate metrics:")
    print(f"  Avg fairness:  {avg_fairness:.3f}")
    print(f"  Avg Gini:      {avg_gini:.3f}")
    print(f"  Avg min bal:   {avg_min:.1f}")
    print(f"  Avg sales:     {avg_sales:.1f}")
    print()

    # Best and worst
    best = max(results, key=lambda r: r["metrics"]["fairness"])
    worst = min(results, key=lambda r: r["metrics"]["fairness"])
    print("Best run (fairness):")
    print(f"  Fairness: {best['metrics']['fairness']:.3f}, Gini: {best['metrics']['gini']:.3f}")
    print("  By role:", best["metrics"]["by_role"])
    print()
    print("Worst run (fairness):")
    print(f"  Fairness: {worst['metrics']['fairness']:.3f}, Gini: {worst['metrics']['gini']:.3f}")
    print("  By role:", worst["metrics"]["by_role"])
    print()

    # Role balance summary (average across runs)
    role_avgs = {}
    for r in results:
        for role, stats in r["metrics"]["by_role"].items():
            if role not in role_avgs:
                role_avgs[role] = []
            role_avgs[role].append(stats["avg"])

    print("Avg balance by role (across runs):")
    for role in ["seller", "buyer", "mechanic", "investigator"]:
        if role in role_avgs:
            avg = sum(role_avgs[role]) / len(role_avgs[role])
            print(f"  {role}: {avg:.1f}")
    print()

    if args.json:
        out = {
            "config": {"runs": args.runs, "blocks": NUM_BLOCKS, "car_sources": CAR_SOURCES},
            "aggregate": {
                "avg_fairness": avg_fairness,
                "avg_gini": avg_gini,
                "avg_min_balance": avg_min,
                "avg_sales": avg_sales,
            },
            "role_avgs": {r: sum(v) / len(v) for r, v in role_avgs.items()},
            "best_run": best,
            "worst_run": worst,
            "all_results": results[:20],  # sample
        }
        print(json.dumps(out, indent=2))

    return 0 if avg_fairness >= 0.5 else 1


if __name__ == "__main__":
    sys.exit(main())

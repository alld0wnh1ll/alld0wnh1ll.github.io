# Lemon Car Game - Block-Based Pygame

Play the lemon car game offline with bots. Block-based market: all players commit actions, then the block resolves atomically. Risk vs reward: sellers choose car source (safe/standard/risky).

## Setup

```bash
cd lemon_car_game
pip install -r requirements.txt
```

## Run

```bash
python game.py
```

## Balance Simulator

Run headless simulations to test game balance:

```bash
python simulate.py --runs 200 --seed 42
python simulate.py --runs 100 --json   # output full JSON
```

Metrics: fairness score, Gini coefficient, role balance, participation.

## Risk vs Reward (Sellers)

Sellers choose car source when listing:

| Tier     | P_lemon | Value range | Reward |
|----------|---------|-------------|--------|
| **Safe** | 8%      | 2.5–5.5     | Lower prices, steady |
| **Standard** | 20% | 3–8         | Baseline |
| **Risky** | 40%    | 5–12        | Higher prices when good, but lemon penalty |

- **R** = cycle risk tier (safe → standard → risky)
- Selling a lemon: seller gets 65% of price (35% penalty)
- More risk = more reward when car is good, more penalty when lemon

## How to Play

1. **Select role** (UP/DOWN, ENTER)
2. **Seller**: `R` cycle risk tier. `1` list (no inspection). `2`/`3` list + inspect via mechanic.
3. **Buyer**: UP/DOWN select listing. Number keys = investigate/inspect/buy. SPACE = done.
4. **Mechanic/Investigator**: Earn fees when hired. SPACE to advance.
5. **Goal**: Highest effective balance (balance + car value) after 10 blocks.

## Mechanics

- Block-based: commit → attest → resolve
- Fees surge with demand in same block
- Contention: two buyers wanting same car → one gets it, other reverts
- 4 sellers, 2 mechanics, 4 buyers, 2 investigators

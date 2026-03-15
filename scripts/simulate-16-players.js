/**
 * Lemon Car Game: Autonomous Simulation with Contention
 *
 * 2:1 ratio creates contention: Sellers:Mechanics = 2:1, Buyers:Investigators = 2:1.
 * Default: 4 sellers, 2 mechanics, 4 buyers, 2 investigators (12 players).
 * Sellers compete for mechanic inspections; buyers compete for investigator reports.
 */

const fs = require('fs');

// --- RNG ---
function rand() { return Math.random(); }
function randInt(max) { return Math.floor(rand() * max); }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- Default Parameters (swept) ---
const DEFAULT_PARAMS = {
  pLemon: 0.2,
  carValueMin: 3,
  carValueMax: 8,
  carLemonMultiplier: 0.2,
  actionsPerEpoch: 3,
  feeMechanic: 0.2,
  feeInvestigator: 0.5,
  epochs: 12,
  startingBalance: 100,
  sellerInspectProb: 0.4,
  buyerInvestigateProb: 0.5,
  buyerMechanicProb: 0.3,
  mechanicCapacityPerEpoch: 1,
  investigatorCapacityPerEpoch: 1,
};

// --- Agent Roles (2:1 contention: sellers/mechanics, buyers/investigators) ---
const DEFAULT_ROLE_COUNTS = {
  seller: 4,
  mechanic: 2,
  buyer: 4,
  investigator: 2,
};

function createPlayers(roleCounts = DEFAULT_ROLE_COUNTS) {
  const players = [];
  let id = 0;
  for (const [role, count] of Object.entries(roleCounts)) {
    for (let i = 0; i < count; i++) {
      players.push({
        id: `p${id}`,
        role,
        balance: DEFAULT_PARAMS.startingBalance,
        carValueReceived: 0,
        actionsUsed: 0,
        salesAsSeller: 0,
        salesAsBuyer: 0,
        inspectionsDone: 0,
        reportsDone: 0,
        lemonBought: 0,
        lemonSold: 0,
      });
      id++;
    }
  }
  return players;
}

function getPlayersByRole(players, role) {
  return players.filter(p => p.role === role);
}

function simulateGame(params = {}) {
  const p = { ...DEFAULT_PARAMS, ...params };
  const roleCounts = {
    seller: p.sellers ?? DEFAULT_ROLE_COUNTS.seller,
    mechanic: p.mechanics ?? DEFAULT_ROLE_COUNTS.mechanic,
    buyer: p.buyers ?? DEFAULT_ROLE_COUNTS.buyer,
    investigator: p.investigators ?? DEFAULT_ROLE_COUNTS.investigator,
  };
  const players = createPlayers(roleCounts);
  const mechanics = getPlayersByRole(players, 'mechanic');
  const investigators = getPlayersByRole(players, 'investigator');

  const listings = [];
  let totalSales = 0;
  let lemonSales = 0;

  for (let epoch = 0; epoch < p.epochs; epoch++) {
    const actionsUsed = {};
    listings.length = 0;
    const mechanicCapacityUsed = new Map(mechanics.map(m => [m.id, 0]));
    const investigatorCapacityUsed = new Map(investigators.map(i => [i.id, 0]));
    const mechanicCapacityPerEpoch = p.mechanicCapacityPerEpoch ?? 1;
    const investigatorCapacityPerEpoch = p.investigatorCapacityPerEpoch ?? 1;

    const use = (id, cost = 1) => {
      actionsUsed[id] = (actionsUsed[id] || 0) + cost;
      return (actionsUsed[id] || 0) <= p.actionsPerEpoch;
    };
    const has = (id) => (actionsUsed[id] || 0) < p.actionsPerEpoch;

    const getAvailableMechanic = () => {
      const available = mechanics.filter(m => (mechanicCapacityUsed.get(m.id) ?? 0) < mechanicCapacityPerEpoch);
      return available.length > 0 ? available[randInt(available.length)] : null;
    };
    const getAvailableInvestigator = () => {
      const available = investigators.filter(i => (investigatorCapacityUsed.get(i.id) ?? 0) < investigatorCapacityPerEpoch);
      return available.length > 0 ? available[randInt(available.length)] : null;
    };

    // --- Sellers: generate + optional inspect + list (contention: mechanics limited) ---
    const sellers = getPlayersByRole(players, 'seller');
    for (const s of shuffle(sellers)) {
      if (!has(s.id)) continue;
      const isLemon = rand() < p.pLemon;
      const carValue = p.carValueMin + rand() * (p.carValueMax - p.carValueMin);
      const listPrice = carValue * (0.85 + rand() * 0.3);

      if (!use(s.id)) continue;

      const wantsInspect = rand() < p.sellerInspectProb;
      const mech = wantsInspect ? getAvailableMechanic() : null;
      if (wantsInspect && has(s.id) && mech && use(s.id)) {
        s.balance -= p.feeMechanic;
        mech.balance += p.feeMechanic;
        mech.inspectionsDone++;
        mechanicCapacityUsed.set(mech.id, (mechanicCapacityUsed.get(mech.id) ?? 0) + 1);
      }

      if (!has(s.id)) continue;
      if (!use(s.id)) continue;

      listings.push({
        seller: s,
        price: listPrice,
        isLemon,
        carValue,
      });
    }

    // --- Buyers: optional investigate + optional mechanic + buy (contention: investigators limited) ---
    const buyers = getPlayersByRole(players, 'buyer');
    for (const b of shuffle(buyers)) {
      if (listings.length === 0) break;
      const idx = randInt(listings.length);
      const listing = listings[idx];
      if (!has(b.id)) continue;

      const wantsInv = rand() < p.buyerInvestigateProb;
      const inv = wantsInv ? getAvailableInvestigator() : null;
      if (wantsInv && has(b.id) && inv && use(b.id)) {
        b.balance -= p.feeInvestigator;
        inv.balance += p.feeInvestigator;
        inv.reportsDone++;
        investigatorCapacityUsed.set(inv.id, (investigatorCapacityUsed.get(inv.id) ?? 0) + 1);
        if (listing.isLemon) continue; // refuse
      }

      const willMech = !wantsInv && rand() < p.buyerMechanicProb && has(b.id);
      const mech = willMech ? getAvailableMechanic() : null;
      if (willMech && mech && use(b.id)) {
        b.balance -= p.feeMechanic;
        mech.balance += p.feeMechanic;
        mech.inspectionsDone++;
        mechanicCapacityUsed.set(mech.id, (mechanicCapacityUsed.get(mech.id) ?? 0) + 1);
      }

      if (!has(b.id)) continue;
      if (!use(b.id)) continue;
      if (b.balance >= listing.price) {
        b.balance -= listing.price;
        const alpha = p.carLemonMultiplier ?? 0.2;
        b.carValueReceived += listing.isLemon ? listing.carValue * alpha : listing.carValue;
        listing.seller.balance += listing.price;
        listing.seller.salesAsSeller++;
        b.salesAsBuyer++;
        if (listing.isLemon) {
          b.lemonBought++;
          listing.seller.lemonSold++;
        }
        totalSales++;
        if (listing.isLemon) lemonSales++;
        listings.splice(idx, 1);
      }
    }
  }

  return { players, totalSales, lemonSales };
}

// --- Fairness Metrics ---
function gini(arr) {
  const a = arr.filter(x => !isNaN(x)).sort((x, y) => x - y);
  if (a.length === 0) return 0;
  const n = a.length;
  const sum = a.reduce((s, x) => s + x, 0);
  if (sum === 0) return 0;
  let num = 0;
  for (let i = 0; i < n; i++) num += (2 * (i + 1) - n - 1) * a[i];
  return num / (n * sum);
}

function effectiveBalance(p) {
  return p.balance + (p.carValueReceived || 0);
}

function balanceByRole(players) {
  const byRole = {};
  for (const p of players) {
    if (!byRole[p.role]) byRole[p.role] = [];
    byRole[p.role].push(effectiveBalance(p));
  }
  const result = {};
  for (const [role, balances] of Object.entries(byRole)) {
    const avg = balances.reduce((a, b) => a + b, 0) / balances.length;
    const std = Math.sqrt(balances.reduce((s, x) => s + (x - avg) ** 2, 0) / balances.length);
    result[role] = { avg, std, gini: gini(balances), min: Math.min(...balances), max: Math.max(...balances) };
  }
  return result;
}

function getRoleCounts(players) {
  const counts = { seller: 0, mechanic: 0, buyer: 0, investigator: 0 };
  for (const p of players) counts[p.role]++;
  return counts;
}

function computeFairnessScore(result) {
  const { players } = result;
  const balances = players.map(p => effectiveBalance(p));
  const byRole = balanceByRole(players);
  const roleCounts = getRoleCounts(players);

  const overallGini = gini(balances);
  const roleAvgs = Object.values(byRole).map(r => r.avg);
  const numRoles = roleAvgs.length;
  const roleAvgMean = roleAvgs.reduce((a, b) => a + b, 0) / numRoles;
  const roleAvgVariance = roleAvgs.reduce((s, x) => s + (x - roleAvgMean) ** 2, 0) / numRoles;
  const roleImbalance = Math.sqrt(roleAvgVariance) / Math.max(1, roleAvgMean);

  const minBalance = Math.min(...balances);
  const participation = {
    seller: roleCounts.seller ? players.filter(p => p.role === 'seller' && p.salesAsSeller > 0).length / roleCounts.seller : 0,
    buyer: roleCounts.buyer ? players.filter(p => p.role === 'buyer' && p.salesAsBuyer > 0).length / roleCounts.buyer : 0,
    mechanic: roleCounts.mechanic ? players.filter(p => p.role === 'mechanic' && p.inspectionsDone > 0).length / roleCounts.mechanic : 0,
    investigator: roleCounts.investigator ? players.filter(p => p.role === 'investigator' && p.reportsDone > 0).length / roleCounts.investigator : 0,
  };
  const avgParticipation = (participation.seller + participation.buyer + participation.mechanic + participation.investigator) / 4;

  const fairness =
    1 - overallGini * 0.3
    - roleImbalance * 2.0
    - (minBalance < 50 ? 0.15 : 0)
    - (minBalance < 0 ? 0.25 : 0)
    + avgParticipation * 0.15;

  return {
    fairness: Math.max(0, Math.min(1, fairness)),
    gini: overallGini,
    roleImbalance,
    minBalance,
    avgBalance: balances.reduce((a, b) => a + b, 0) / balances.length,
    participation,
    byRole,
  };
}

// --- Parameter Sweep ---
function sweep(paramsToSweep) {
  const keys = Object.keys(paramsToSweep);
  const values = keys.map(k => paramsToSweep[k]);
  const runs = [];

  function recurse(idx, current) {
    if (idx === keys.length) {
      const result = simulateGame(current);
      const metrics = computeFairnessScore(result);
      runs.push({ params: { ...current }, result, metrics });
      return;
    }
    const k = keys[idx];
    for (const v of values[idx]) {
      recurse(idx + 1, { ...current, [k]: v });
    }
  }
  recurse(0, {});

  return runs;
}

// --- Grid sweep for key params ---
function gridSweep() {
  const runs = [];
  const actionsOpts = [2, 3, 4, 5];
  const pLemonOpts = [0.15, 0.2, 0.25, 0.3];
  const feeInvOpts = [0.3, 0.5, 0.7];
  const reps = 30;

  for (const a of actionsOpts) {
    for (const pl of pLemonOpts) {
      for (const fi of feeInvOpts) {
        const params = {
          actionsPerEpoch: a,
          pLemon: pl,
          feeInvestigator: fi,
          feeMechanic: 0.2,
          carValueMin: 2,
          carValueMax: 8,
        };
        let totalFairness = 0;
        let totalGini = 0;
        let totalSales = 0;
        for (let i = 0; i < reps; i++) {
          const result = simulateGame(params);
          const metrics = computeFairnessScore(result);
          totalFairness += metrics.fairness;
          totalGini += metrics.gini;
          totalSales += result.totalSales;
        }
        runs.push({
          params: { a, pl, fi },
          avgFairness: totalFairness / reps,
          avgGini: totalGini / reps,
          avgSales: totalSales / reps,
        });
      }
    }
  }
  return runs;
}

// --- Main ---
function main() {
  const NUM_RUNS_PER_CONFIG = 200;

  const totalPlayers = DEFAULT_ROLE_COUNTS.seller + DEFAULT_ROLE_COUNTS.mechanic + DEFAULT_ROLE_COUNTS.buyer + DEFAULT_ROLE_COUNTS.investigator;
  console.log('Lemon Car Game: Autonomous Simulation with Contention');
  console.log('====================================================');
  console.log(`${DEFAULT_ROLE_COUNTS.seller} Sellers, ${DEFAULT_ROLE_COUNTS.mechanic} Mechanics, ${DEFAULT_ROLE_COUNTS.buyer} Buyers, ${DEFAULT_ROLE_COUNTS.investigator} Investigators (${totalPlayers} players)`);
  console.log('2:1 ratio creates contention: sellers compete for mechanics, buyers compete for investigators');
  console.log('');

  const sweepConfig = {
    pLemon: [0.15, 0.2, 0.25, 0.3],
    actionsPerEpoch: [2, 3, 4, 5],
    carValueMin: [2, 3, 4],
    carValueMax: [6, 8, 10],
    feeMechanic: [0.1, 0.2, 0.3],
    feeInvestigator: [0.3, 0.5, 0.7],
  };

  const allRuns = [];
  for (let run = 0; run < NUM_RUNS_PER_CONFIG; run++) {
    const params = {
      pLemon: sweepConfig.pLemon[randInt(sweepConfig.pLemon.length)],
      actionsPerEpoch: sweepConfig.actionsPerEpoch[randInt(sweepConfig.actionsPerEpoch.length)],
      carValueMin: sweepConfig.carValueMin[randInt(sweepConfig.carValueMin.length)],
      carValueMax: sweepConfig.carValueMax[randInt(sweepConfig.carValueMax.length)],
      feeMechanic: sweepConfig.feeMechanic[randInt(sweepConfig.feeMechanic.length)],
      feeInvestigator: sweepConfig.feeInvestigator[randInt(sweepConfig.feeInvestigator.length)],
    };
    const result = simulateGame(params);
    const metrics = computeFairnessScore(result);
    allRuns.push({ params, metrics, result });
  }

  const avgFairness = (runs) => runs.reduce((s, r) => s + r.metrics.fairness, 0) / runs.length;
  const byActions = {};
  const byPLemon = {};
  const byFees = {};

  for (const r of allRuns) {
    const a = r.params.actionsPerEpoch;
    const p = r.params.pLemon;
    const f = `${r.params.feeMechanic.toFixed(1)}_${r.params.feeInvestigator.toFixed(1)}`;
    if (!byActions[a]) byActions[a] = [];
    if (!byPLemon[p]) byPLemon[p] = [];
    if (!byFees[f]) byFees[f] = [];
    byActions[a].push(r);
    byPLemon[p].push(r);
    byFees[f].push(r);
  }

  console.log('Fairness by action limit:');
  for (const [a, runs] of Object.entries(byActions).sort((x, y) => +x[0] - +y[0])) {
    console.log(`  Actions=${a}: fairness=${avgFairness(runs).toFixed(3)} (n=${runs.length})`);
  }

  console.log('');
  console.log('Fairness by P_LEMON:');
  for (const [p, runs] of Object.entries(byPLemon).sort((x, y) => +x[0] - +y[0])) {
    console.log(`  P_LEMON=${p}: fairness=${avgFairness(runs).toFixed(3)} (n=${runs.length})`);
  }

  console.log('');
  console.log('Fairness by fees (mech_inv):');
  const feeEntries = Object.entries(byFees).sort((a, b) => avgFairness(b[1]) - avgFairness(a[1]));
  for (let i = 0; i < Math.min(5, feeEntries.length); i++) {
    const [f, runs] = feeEntries[i];
    console.log(`  ${f}: fairness=${avgFairness(runs).toFixed(3)} (n=${runs.length})`);
  }

  const best = allRuns.reduce((a, b) => (a.metrics.fairness > b.metrics.fairness ? a : b));
  console.log('');
  console.log('Best configuration (highest fairness):');
  console.log(JSON.stringify(best.params, null, 2));
  console.log(`Fairness: ${best.metrics.fairness.toFixed(3)}`);
  console.log(`Gini: ${best.metrics.gini.toFixed(3)}`);
  console.log(`Total sales: ${best.result.totalSales}`);
  console.log(`Lemon sales: ${best.result.lemonSales}`);
  console.log('');
  console.log('Balance by role (effective = balance + carValueReceived):');
  for (const [role, r] of Object.entries(best.metrics.byRole)) {
    console.log(`  ${role}: avg=${r.avg.toFixed(1)} std=${r.std.toFixed(2)} gini=${r.gini.toFixed(3)} min=${r.min.toFixed(1)} max=${r.max.toFixed(1)}`);
  }

  console.log('');
  console.log('Grid sweep (actions x pLemon x feeInvestigator):');
  const grid = gridSweep();
  const topGrid = grid.sort((a, b) => b.avgFairness - a.avgFairness).slice(0, 8);
  for (const g of topGrid) {
    console.log(`  a=${g.params.a} pl=${g.params.pl} fi=${g.params.fi}: fairness=${g.avgFairness.toFixed(3)} gini=${g.avgGini.toFixed(3)} sales=${g.avgSales.toFixed(1)}`);
  }

  const summary = {
    roleCounts: DEFAULT_ROLE_COUNTS,
    contention: '2:1 sellers:mechanics, 2:1 buyers:investigators; capacity 1 per mechanic/investigator per epoch',
    bestParams: best.params,
    fairness: best.metrics.fairness,
    gini: best.metrics.gini,
    totalSales: best.result.totalSales,
    lemonSales: best.result.lemonSales,
    byRole: best.metrics.byRole,
    topGridConfigs: topGrid.map(g => ({ params: g.params, fairness: g.avgFairness, gini: g.avgGini, sales: g.avgSales })),
  };
  fs.writeFileSync('scripts/simulation-results.json', JSON.stringify(summary, null, 2));
  console.log('');
  console.log('Results saved to scripts/simulation-results.json');
}

main();

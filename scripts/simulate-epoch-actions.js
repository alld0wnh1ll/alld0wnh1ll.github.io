/**
 * Simulation: Find optimal MAX_ACTIONS_PER_EPOCH for lemon car game fairness.
 * Models sellers, buyers, mechanics, investigators over multiple epochs.
 * Measures completion rate, payoff variance, and strategic depth.
 */

const P_LEMON = 0.2;
const V_G = 5;
const FEE_INVESTIGATOR = 0.5;
const FEE_MECHANIC = 0.2;
const EPOCHS = 10;
const NUM_SIMULATIONS = 300;

function rand() { return Math.random(); }
function randInt(max) { return Math.floor(rand() * max); }

function simulateGame(actionsPerEpoch) {
  const sellers = 4;
  const buyers = 4;
  const mechanics = 2;
  const investigators = 1;

  const balances = {};
  for (let i = 0; i < sellers; i++) balances[`s${i}`] = 100;
  for (let i = 0; i < buyers; i++) balances[`b${i}`] = 100;
  for (let i = 0; i < mechanics; i++) balances[`m${i}`] = 50;
  balances['inv0'] = 50;

  let totalSales = 0;
  let lemonSales = 0;
  let sellerInspections = 0;
  let buyerInspections = 0;
  let investigatorHires = 0;
  let actionsWasted = 0;
  let incompleteCycles = 0; // seller wanted to inspect but couldn't

  for (let epoch = 0; epoch < EPOCHS; epoch++) {
    const actionsUsed = {};
    const listings = [];

    const use = (actor, cost = 1) => {
      actionsUsed[actor] = (actionsUsed[actor] || 0) + cost;
      return (actionsUsed[actor] || 0) <= actionsPerEpoch;
    };
    const has = (actor) => (actionsUsed[actor] || 0) < actionsPerEpoch;

    // Sellers: generate + (optional inspect) + list
    for (let s = 0; s < sellers; s++) {
      const actor = `s${s}`;
      if (!has(actor)) continue;
      const isLemon = rand() < P_LEMON;
      if (!use(actor)) continue;
      // generateCar
      const wantsInspect = rand() < 0.4; // 40% want mechanic before listing
      if (wantsInspect && has(actor) && use(actor)) {
        sellerInspections++;
        balances[actor] -= FEE_MECHANIC;
        balances[`m${randInt(mechanics)}`] += FEE_MECHANIC;
      }
      if (!has(actor)) { incompleteCycles++; continue; }
      if (!use(actor)) continue;
      // list
      const price = V_G * (0.8 + rand() * 0.4);
      listings.push({ seller: actor, price, isLemon });
    }

    // Buyers: (optional investigate) + (optional mechanic) + buy
    const order = [...Array(buyers)].map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [order[i], order[j]] = [order[j], order[i]];
    }

    for (const i of order) {
      const actor = `b${i}`;
      if (listings.length === 0) break;
      const idx = randInt(listings.length);
      const listing = listings[idx];
      const willInv = rand() < 0.5 && has(actor);
      if (willInv && use(actor)) {
        investigatorHires++;
        balances[actor] -= FEE_INVESTIGATOR;
        balances['inv0'] += FEE_INVESTIGATOR;
        if (listing.isLemon) continue; // refuse
      }
      const willMech = !willInv && rand() < 0.3 && has(actor);
      if (willMech && use(actor)) {
        buyerInspections++;
        balances[actor] -= FEE_MECHANIC;
        balances[`m${randInt(mechanics)}`] += FEE_MECHANIC;
      }
      if (!has(actor)) continue;
      if (!use(actor)) continue;
      if (balances[actor] >= listing.price) {
        balances[actor] -= listing.price;
        balances[listing.seller] += listing.price;
        totalSales++;
        if (listing.isLemon) lemonSales++;
        listings.splice(idx, 1);
      }
    }

    for (const actor of Object.keys(actionsUsed)) {
      const left = actionsPerEpoch - actionsUsed[actor];
      if (left > 0) actionsWasted += left;
    }
  }

  return {
    totalSales,
    lemonSales,
    sellerInspections,
    buyerInspections,
    investigatorHires,
    actionsWasted,
    incompleteCycles,
    balances,
  };
}

function runSimulation(actionsPerEpoch) {
  const results = [];
  for (let i = 0; i < NUM_SIMULATIONS; i++) {
    results.push(simulateGame(actionsPerEpoch));
  }

  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const std = arr => {
    const m = avg(arr);
    return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
  };

  const sales = results.map(r => r.totalSales);
  const lemonR = results.map(r => r.lemonSales / Math.max(1, r.totalSales));
  const wasted = results.map(r => r.actionsWasted);
  const incomplete = results.map(r => r.incompleteCycles);
  const invHires = results.map(r => r.investigatorHires);

  return {
    actionsPerEpoch,
    avgSales: avg(sales),
    stdSales: std(sales),
    avgLemonRate: avg(lemonR),
    avgWasted: avg(wasted),
    avgIncomplete: avg(incomplete),
    avgInvestigatorHires: avg(invHires),
  };
}

console.log('Lemon Car Game: Epoch Action Limit Simulation');
console.log('==============================================');
console.log(`P_LEMON=${P_LEMON}, EPOCHS=${EPOCHS}, SIMS=${NUM_SIMULATIONS}`);
console.log('4 sellers, 4 buyers, 2 mechanics, 1 investigator');
console.log('');

const allResults = [];
for (let a = 2; a <= 6; a++) {
  const r = runSimulation(a);
  allResults.push(r);
  console.log(`Actions=${a}: avgSales=${r.avgSales.toFixed(1)} std=${r.stdSales.toFixed(2)} lemonRate=${(r.avgLemonRate * 100).toFixed(1)}% wasted=${r.avgWasted.toFixed(0)} incomplete=${r.avgIncomplete.toFixed(1)} invHires=${r.avgInvestigatorHires.toFixed(1)}`);
}

// Fairness: high sales, low variance, low incomplete cycles, moderate waste (some flexibility)
const scores = allResults.map(r => {
  const throughput = r.avgSales / (EPOCHS * 4);
  const consistency = 1 / (1 + r.stdSales * 0.2);
  const completeness = 1 / (1 + r.avgIncomplete * 0.1);
  const efficiency = 1 / (1 + r.avgWasted * 0.002);
  const fairness = throughput * 0.35 + consistency * 0.25 + completeness * 0.25 + efficiency * 0.15;
  return { actions: r.actionsPerEpoch, fairness, throughput, consistency, completeness, efficiency };
});

console.log('');
console.log('Fairness Score (higher = better):');
scores.forEach(s => {
  console.log(`  Actions=${s.actions}: fairness=${s.fairness.toFixed(3)} (throughput=${s.throughput.toFixed(2)} consistency=${s.consistency.toFixed(2)} completeness=${s.completeness.toFixed(2)} efficiency=${s.efficiency.toFixed(2)})`);
});

const best = scores.reduce((a, b) => (a.fairness > b.fairness ? a : b));
console.log('');
console.log(`Recommendation: ${best.actions} actions per epoch (fairness score: ${best.fairness.toFixed(3)})`);
console.log('');
console.log('Sensitivity: 2 actions blocks seller inspect+list; 3 allows full cycle.');

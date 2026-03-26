// Simplified sortStandings logic to debug
const sortStandings = (standings) => {
  const players = Object.entries(standings)
    .map(([name, stats]) => ({ name, ...stats }));

  const recordGroups = {};
  players.forEach(p => {
    const key = `${p.wins}-${p.losses}`;
    if (!recordGroups[key]) recordGroups[key] = [];
    recordGroups[key].push(p);
  });

  const sortedKeys = Object.keys(recordGroups).sort((a, b) => {
    const [winsA, lossesA] = a.split('-').map(Number);
    const [winsB, lossesB] = b.split('-').map(Number);
    if (winsB !== winsA) return winsB - winsA;
    return lossesA - lossesB;
  });

  const sorted = [];
  sortedKeys.forEach(key => {
    const group = recordGroups[key];
    if (group.length === 1) {
      sorted.push(group[0]);
    } else if (group.length === 2) {
      group.sort((a, b) => {
        const h2hA = a.headToHead?.[b.name];
        const h2hB = b.headToHead?.[a.name];
        if (h2hA && h2hB) {
          const h2hDiff = (h2hA.wins - h2hA.losses) - (h2hB.wins - h2hB.losses);
          if (h2hDiff !== 0) return -h2hDiff;
        }
        const diffA = (a.pointsFor || 0) - (a.pointsAgainst || 0);
        const diffB = (b.pointsFor || 0) - (b.pointsAgainst || 0);
        if (diffB !== diffA) return diffB - diffA;
        const seedA = a.initialSeed || 9999;
        const seedB = b.initialSeed || 9999;
        return seedA - seedB;
      });
      sorted.push(...group);
    } else {
      // 3-way tie
      group.sort((a, b) => {
        let h2hWinsA = 0, h2hLossesA = 0;
        let h2hWinsB = 0, h2hLossesB = 0;
        group.forEach(opponent => {
          if (opponent.name !== a.name && a.headToHead?.[opponent.name]) {
            h2hWinsA += a.headToHead[opponent.name].wins || 0;
            h2hLossesA += a.headToHead[opponent.name].losses || 0;
          }
          if (opponent.name !== b.name && b.headToHead?.[opponent.name]) {
            h2hWinsB += b.headToHead[opponent.name].wins || 0;
            h2hLossesB += b.headToHead[opponent.name].losses || 0;
          }
        });
        const h2hDiffA = h2hWinsA - h2hLossesA;
        const h2hDiffB = h2hWinsB - h2hLossesB;
        if (h2hDiffB !== h2hDiffA) return h2hDiffB - h2hDiffA;
        const diffA = (a.pointsFor || 0) - (a.pointsAgainst || 0);
        const diffB = (b.pointsFor || 0) - (b.pointsAgainst || 0);
        if (diffB !== diffA) return diffB - diffA;
        const seedA = a.initialSeed || 9999;
        const seedB = b.initialSeed || 9999;
        return seedA - seedB;
      });
      sorted.push(...group);
    }
  });
  return sorted;
};

// Test case: Ritesh has 5 wins, Alan and Michael have 4 wins
const testStandings = {
  'Ritesh Varma': {
    wins: 5,
    losses: 2,
    headToHead: {
      'Alan Smith': { wins: 1, losses: 0 },
      'Garrett': { wins: 2, losses: 0 }
    },
    pointsFor: 150,
    pointsAgainst: 100,
    initialSeed: null
  },
  'Alan Smith': {
    wins: 4,
    losses: 3,
    headToHead: {
      'Ritesh Varma': { wins: 0, losses: 1 },
      'Michael Smith': { wins: 1, losses: 0 }
    },
    pointsFor: 140,
    pointsAgainst: 110,
    initialSeed: null
  },
  'Michael Smith': {
    wins: 4,
    losses: 3,
    headToHead: {
      'Ritesh Varma': { wins: 0, losses: 1 },
      'Alan Smith': { wins: 0, losses: 1 }
    },
    pointsFor: 135,
    pointsAgainst: 115,
    initialSeed: null
  }
};

const sorted = sortStandings(testStandings);
console.log('Sorted standings:');
sorted.forEach((p, i) => {
  console.log(`${i+1}. ${p.name}: ${p.wins}W-${p.losses}L`);
});

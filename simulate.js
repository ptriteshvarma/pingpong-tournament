// Using native fetch in Node.js 18+

const BASE = 'http://localhost:3000/api';

async function simulateTournament() {
  console.log('=== FULL TOURNAMENT SIMULATION ===\n');

  // Get season data
  const seasonRes = await fetch(BASE + '/season');
  const season = await seasonRes.json();

  if (!season || !season.schedule) {
    console.log('No season found');
    return;
  }

  // Get all incomplete matches
  const allMatches = [];
  ['A', 'B'].forEach(group => {
    season.schedule[group].forEach((week, weekIdx) => {
      week.forEach(match => {
        if (!match.completed && match.player1 && match.player2 && match.player1 !== match.player2) {
          allMatches.push({
            id: match.id,
            p1: match.player1,
            p2: match.player2,
            week: weekIdx + 1,
            group
          });
        }
      });
    });
  });

  console.log(`Found ${allMatches.length} remaining matches\n`);

  // Simulate matches - alternate winners based on seeding/random
  const playerWins = {};

  for (const match of allMatches) {
    // Determine winner - favor higher-seeded players slightly
    const rand = Math.random();
    const winner = rand > 0.45 ? match.p1 : match.p2;
    const loser = winner === match.p1 ? match.p2 : match.p1;

    // Random score (2-0 or 2-1)
    const score = Math.random() > 0.4 ? [2, 0] : [2, 1];
    const [s1, s2] = winner === match.p1 ? score : score.reverse();

    try {
      const res = await fetch(BASE + '/season/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: match.id, winner, loser, score1: s1, score2: s2 })
      });

      if (res.ok) {
        playerWins[winner] = (playerWins[winner] || 0) + 1;
        console.log(`Week ${match.week} Group ${match.group}: ${winner} beats ${loser} (${s1}-${s2})`);
      }
    } catch (e) {
      console.log(`Failed: ${match.id}`);
    }
  }

  console.log('\n=== SIMULATION COMPLETE ===');
  console.log('\nTop performers:', Object.entries(playerWins)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, wins]) => `${name}: ${wins} wins`)
    .join(', '));
}

simulateTournament().catch(console.error);

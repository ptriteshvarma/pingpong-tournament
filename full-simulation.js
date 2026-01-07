// Full Tournament Simulation with Mid-Season Swap and Championship Bracket
const BASE = 'http://localhost:3000/api';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function simulateTournament() {
  console.log('=== FULL TOURNAMENT SIMULATION ===\n');

  // Step 1: Delete existing season and create new one
  console.log('STEP 1: Creating season with real player names...');
  await fetch(BASE + '/season', { method: 'DELETE', headers: { 'X-Admin-Password': 'Username' } });

  const createRes = await fetch(BASE + '/season/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Password': 'Username' },
    body: JSON.stringify({
      groupA: [
        { name: 'Cameron McLain', seed: 1 },
        { name: 'Alan Smith', seed: 2 },
        { name: 'SivaKumar', seed: 3 },
        { name: 'Michael Schmidt', seed: 4 },
        { name: 'Niketha', seed: 5 },
        { name: 'Ritesh Varma', seed: 6 },
        { name: 'Jonathan', seed: 7 },
        { name: 'Allie Shaw', seed: 8 },
        { name: 'Sarah', seed: 9 },
        { name: 'Spencer', seed: 10 }
      ],
      groupB: [
        { name: 'Adam Kelly' },
        { name: 'Brian Pleiman' },
        { name: 'Dave Sander' },
        { name: 'Dylan Rasmussen' },
        { name: 'Emma Gerken' },
        { name: 'Eric Miller' },
        { name: 'Karen Isaacs' },
        { name: 'Laura Harrah' },
        { name: 'Michelle Caye' },
        { name: 'Neha Badam' },
        { name: 'Garrett' }
      ],
      numWeeks: 10
    })
  });

  if (!createRes.ok) {
    console.log('Failed to create season');
    return;
  }
  console.log('Season created with 10 Group A + 11 Group B players!\n');

  // Step 2: Play regular season matches WEEK BY WEEK
  console.log('STEP 2: Playing regular season matches week by week...');

  for (let weekNum = 1; weekNum <= 10; weekNum++) {
    console.log(`\n--- WEEK ${weekNum} ---`);

    let season = await (await fetch(BASE + '/season')).json();

    // Play all matches for this week
    let weekMatchCount = 0;
    for (const group of ['A', 'B']) {
      const weekSchedule = season.schedule[group][weekNum - 1];
      if (!weekSchedule) continue;

      for (const match of weekSchedule) {
        if (match.player1 && match.player2 && match.player1 !== match.player2 && !match.completed && !match.cancelled) {
          // Simulate with slight randomness favoring higher seeds
          const rand = Math.random();
          const winner = rand > 0.4 ? match.player1 : match.player2;
          const loser = winner === match.player1 ? match.player2 : match.player1;
          const score = Math.random() > 0.6 ? [2, 0] : [2, 1];
          const [s1, s2] = winner === match.player1 ? score : score.reverse();

          await fetch(BASE + '/season/match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matchId: match.id, winner, loser, score1: s1, score2: s2 })
          });
          weekMatchCount++;
        }
      }
    }
    console.log(`Played ${weekMatchCount} matches in week ${weekNum}`);

    // At week 5, trigger mid-season review
    if (weekNum === 4) {
      season = await (await fetch(BASE + '/season')).json();
      if (season.currentWeek >= 5 && !season.midSeasonReview?.completed) {
        console.log('\n=== TRIGGERING MID-SEASON REVIEW ===');
        const midRes = await fetch(BASE + '/season/mid-review', {
          method: 'POST',
          headers: { 'X-Admin-Password': 'Username' }
        });
        const midData = await midRes.json();
        if (midData.success) {
          console.log('*** MID-SEASON SWAP EXECUTED! ***');
          console.log(`Players moved A → B: ${midData.swaps?.fromAtoB?.join(', ')}`);
          console.log(`Players moved B → A: ${midData.swaps?.fromBtoA?.join(', ')}`);
        }
      }
    }

    await sleep(30);
  }

  // Step 3: Show standings
  let season = await (await fetch(BASE + '/season')).json();
  console.log('\n=== FINAL REGULAR SEASON STANDINGS ===');

  const sortStandings = (standings) => {
    return Object.entries(standings)
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst);
      });
  };

  console.log('\nGROUP A:');
  sortStandings(season.standings.A).slice(0, 6).forEach((p, i) => {
    console.log(`  ${i+1}. ${p.name} - W:${p.wins} L:${p.losses} Diff:${p.pointsFor-p.pointsAgainst}`);
  });

  console.log('\nGROUP B:');
  sortStandings(season.standings.B).slice(0, 6).forEach((p, i) => {
    console.log(`  ${i+1}. ${p.name} - W:${p.wins} L:${p.losses} Diff:${p.pointsFor-p.pointsAgainst}`);
  });

  // Step 4: Start Wildcard
  console.log('\n=== STEP 4: WILDCARD ROUND ===');
  const wcRes = await fetch(BASE + '/season/wildcard', {
    method: 'POST',
    headers: { 'X-Admin-Password': 'Username' }
  });
  const wcData = await wcRes.json();

  if (wcData.wildcard) {
    for (const match of wcData.wildcard.matches) {
      console.log(`${match.player1} (G${match.player1Group} #${match.player1Rank}) vs ${match.player2} (G${match.player2Group} #${match.player2Rank})`);

      const winner = Math.random() > 0.5 ? match.player1 : match.player2;
      const loser = winner === match.player1 ? match.player2 : match.player1;
      const score = Math.random() > 0.5 ? [2, 0] : [2, 1];
      const [s1, s2] = winner === match.player1 ? score : score.reverse();

      await fetch(BASE + '/season/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: match.id, winner, loser, score1: s1, score2: s2 })
      });
      console.log(`  Winner: ${winner} (${s1}-${s2})`);
    }
  }

  // Step 5: Start Championship Bracket
  console.log('\n=== STEP 5: CHAMPIONSHIP BRACKET ===');
  await fetch(BASE + '/season/playoffs', {
    method: 'POST',
    headers: { 'X-Admin-Password': 'Username' }
  });

  season = await (await fetch(BASE + '/season')).json();

  if (season.championship) {
    console.log('\nQuarterfinals:');
    for (const qf of season.championship.quarterfinals) {
      console.log(`  ${qf.matchName}: ${qf.player1} (${qf.seed1}) vs ${qf.player2} (${qf.seed2})`);

      const winner = Math.random() > 0.45 ? qf.player1 : qf.player2;
      const loser = winner === qf.player1 ? qf.player2 : qf.player1;
      const score = Math.random() > 0.5 ? [2, 0] : [2, 1];
      const [s1, s2] = winner === qf.player1 ? score : score.reverse();

      await fetch(BASE + '/season/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: qf.id, winner, loser, score1: s1, score2: s2 })
      });
      console.log(`    Winner: ${winner} (${s1}-${s2})`);
    }

    await sleep(100);
    season = await (await fetch(BASE + '/season')).json();

    console.log('\nSemifinals:');
    for (const sf of season.championship.semifinals) {
      if (sf.player1 && sf.player2) {
        console.log(`  ${sf.matchName}: ${sf.player1} vs ${sf.player2}`);

        const winner = Math.random() > 0.5 ? sf.player1 : sf.player2;
        const loser = winner === sf.player1 ? sf.player2 : sf.player1;
        const score = Math.random() > 0.5 ? [2, 0] : [2, 1];
        const [s1, s2] = winner === sf.player1 ? score : score.reverse();

        await fetch(BASE + '/season/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId: sf.id, winner, loser, score1: s1, score2: s2 })
        });
        console.log(`    Winner: ${winner} (${s1}-${s2})`);
      }
    }

    await sleep(100);
    season = await (await fetch(BASE + '/season')).json();

    if (season.championship.final.player1 && season.championship.final.player2) {
      console.log('\n=== CHAMPIONSHIP FINAL ===');
      console.log(`${season.championship.final.player1} vs ${season.championship.final.player2}`);

      const winner = Math.random() > 0.5 ? season.championship.final.player1 : season.championship.final.player2;
      const loser = winner === season.championship.final.player1 ? season.championship.final.player2 : season.championship.final.player1;
      const score = Math.random() > 0.5 ? [2, 0] : [2, 1];
      const [s1, s2] = winner === season.championship.final.player1 ? score : score.reverse();

      await fetch(BASE + '/season/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: 'CHAMP-FINAL', winner, loser, score1: s1, score2: s2 })
      });

      console.log(`\n🏆🏆🏆 SEASON CHAMPION: ${winner} (${s1}-${s2}) 🏆🏆🏆`);
    }
  }

  // Final status
  await sleep(100);
  season = await (await fetch(BASE + '/season')).json();
  console.log(`\nFinal Status: ${season.status}`);
  console.log(`Season Champion: ${season.champion}`);

  console.log('\n=== SIMULATION COMPLETE ===');
}

simulateTournament().catch(console.error);

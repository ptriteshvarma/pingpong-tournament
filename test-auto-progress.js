// Test auto-progression from regular season → wildcard → championship bracket → champion
const BASE = 'http://localhost:3000/api';

async function testAutoProgress() {
  console.log('=== TESTING AUTO-PROGRESSION ===\n');

  // Delete existing and create short season
  await fetch(BASE + '/season', { method: 'DELETE', headers: { 'X-Admin-Password': 'Username' } });

  const createRes = await fetch(BASE + '/season/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Password': 'Username' },
    body: JSON.stringify({
      groupA: [{ name: 'A1' }, { name: 'A2' }, { name: 'A3' }, { name: 'A4' }, { name: 'A5' }, { name: 'A6' }],
      groupB: [{ name: 'B1' }, { name: 'B2' }, { name: 'B3' }, { name: 'B4' }, { name: 'B5' }, { name: 'B6' }],
      numWeeks: 2
    })
  });

  if (!createRes.ok) {
    console.log('Failed to create season');
    return;
  }
  console.log('Created 2-week season with 6 players per group\n');

  // Helper to play all incomplete matches
  async function playAllMatches() {
    const season = await (await fetch(BASE + '/season')).json();
    let played = 0;

    // Regular season matches
    for (const group of ['A', 'B']) {
      for (const week of season.schedule[group]) {
        for (const match of week) {
          if (match.player1 && match.player2 && !match.completed && !match.cancelled) {
            const winner = match.player1;
            const loser = match.player2;
            const result = await fetch(BASE + '/season/match', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ matchId: match.id, winner, loser, score1: 2, score2: 0 })
            });
            const data = await result.json();
            played++;
            if (data.wildcardStarted) console.log('  >> AUTO: Wildcard started!');
          }
        }
      }
    }

    // Wildcard matches
    if (season.wildcard) {
      for (const match of season.wildcard.matches) {
        if (match.player1 && match.player2 && !match.completed) {
          const winner = match.player1;
          const loser = match.player2;
          await fetch(BASE + '/season/match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matchId: match.id, winner, loser, score1: 2, score2: 0 })
          });
          played++;
          console.log(`  Wildcard: ${winner} beat ${loser}`);
        }
      }
    }

    // Championship bracket matches (new combined format - top 4 from each group)
    if (season.championship) {
      // Quarterfinals
      for (const qf of season.championship.quarterfinals) {
        if (qf.player1 && qf.player2 && !qf.completed) {
          await fetch(BASE + '/season/match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matchId: qf.id, winner: qf.player1, loser: qf.player2, score1: 2, score2: 0 })
          });
          played++;
          console.log(`  QF: ${qf.player1} beat ${qf.player2}`);
        }
      }

      // Semifinals
      for (const sf of season.championship.semifinals) {
        if (sf.player1 && sf.player2 && !sf.completed) {
          await fetch(BASE + '/season/match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matchId: sf.id, winner: sf.player1, loser: sf.player2, score1: 2, score2: 0 })
          });
          played++;
          console.log(`  SF: ${sf.player1} beat ${sf.player2}`);
        }
      }

      // Final
      if (season.championship.final.player1 && season.championship.final.player2 && !season.championship.final.completed) {
        await fetch(BASE + '/season/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId: 'CHAMP-FINAL', winner: season.championship.final.player1, loser: season.championship.final.player2, score1: 2, score2: 0 })
        });
        played++;
        console.log(`  FINAL: ${season.championship.final.player1} beat ${season.championship.final.player2}`);
      }
    }

    // Legacy playoff matches (for backward compatibility)
    if (season.playoffs && !season.championship) {
      for (const g of ['A', 'B']) {
        if (season.playoffs[g]) {
          for (const sf of season.playoffs[g].semifinals) {
            if (sf.player1 && sf.player2 && !sf.completed) {
              await fetch(BASE + '/season/match', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matchId: sf.id, winner: sf.player1, loser: sf.player2, score1: 2, score2: 0 })
              });
              played++;
            }
          }
          if (season.playoffs[g].final.player1 && season.playoffs[g].final.player2 && !season.playoffs[g].final.completed) {
            await fetch(BASE + '/season/match', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ matchId: season.playoffs[g].final.id, winner: season.playoffs[g].final.player1, loser: season.playoffs[g].final.player2, score1: 2, score2: 0 })
            });
            played++;
          }
        }
      }
    }

    // Super Bowl (legacy)
    if (season.superBowl && season.superBowl.player1 && season.superBowl.player2 && !season.superBowl.completed) {
      await fetch(BASE + '/season/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: 'SUPER-BOWL', winner: season.superBowl.player1, loser: season.superBowl.player2, score1: 2, score2: 0 })
      });
      played++;
    }

    return played;
  }

  // Play through multiple rounds until complete
  let round = 1;
  while (round <= 15) {
    let season = await (await fetch(BASE + '/season')).json();
    console.log(`\nRound ${round}: Status = ${season.status}, Week = ${season.currentWeek}`);

    if (season.championship) {
      console.log('  Championship bracket active');
      const qfComplete = season.championship.quarterfinals.filter(qf => qf.completed).length;
      const sfComplete = season.championship.semifinals.filter(sf => sf.completed).length;
      console.log(`  QF: ${qfComplete}/4, SF: ${sfComplete}/2, Final: ${season.championship.final.completed ? 'Yes' : 'No'}`);
    }

    if (season.status === 'complete') {
      console.log(`\n🏆 CHAMPION: ${season.champion}`);
      break;
    }

    const played = await playAllMatches();
    if (played === 0) {
      console.log('  No matches to play, waiting for state refresh...');
    } else {
      console.log(`  Played ${played} matches`);
    }
    round++;
  }

  console.log('\n=== AUTO-PROGRESSION TEST COMPLETE ===');
}

testAutoProgress().catch(console.error);

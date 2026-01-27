const API_BASE = 'https://pingpong-tournament.vercel.app/api';

async function checkSwapLogic() {
  try {
    console.log('🔍 Checking game-based swap logic for leaks...\n');

    // Get season data
    const seasonResponse = await fetch(`${API_BASE}/season`);
    const season = await seasonResponse.json();

    if (!season) {
      console.log('❌ No season found');
      return;
    }

    console.log('📊 SEASON STATUS:');
    console.log(`   Status: ${season.status}`);
    console.log(`   Week: ${season.currentWeek}/${season.totalWeeks}`);
    console.log(`   Mid-season swap completed: ${season.midSeasonReview?.completed || false}\n`);

    // Check all players' game counts
    const groupAPlayers = Object.entries(season.standings.A).map(([name, stats]) => ({
      name,
      group: 'A',
      wins: stats.wins,
      losses: stats.losses,
      games: stats.wins + stats.losses
    }));

    const groupBPlayers = Object.entries(season.standings.B).map(([name, stats]) => ({
      name,
      group: 'B',
      wins: stats.wins,
      losses: stats.losses,
      games: stats.wins + stats.losses
    }));

    const allPlayers = [...groupAPlayers, ...groupBPlayers].sort((a, b) => a.games - b.games);

    console.log('🎮 GAMES PLAYED PER PLAYER:');
    allPlayers.forEach(p => {
      const status = p.games >= 4 ? '✓' : p.games === 3 ? '⚠️ ' : '  ';
      console.log(`  ${status} ${p.name.padEnd(25)} (Group ${p.group}): ${p.games} games (${p.wins}W-${p.losses}L)`);
    });

    const playersAt4 = allPlayers.filter(p => p.games >= 4).length;
    const playersBelow4 = allPlayers.filter(p => p.games < 4).length;

    console.log(`\n📈 GAME COUNT SUMMARY:`);
    console.log(`   Players with 4+ games: ${playersAt4}/${allPlayers.length}`);
    console.log(`   Players below 4 games: ${playersBelow4}`);

    // Check swap zone status
    const swapZoneResponse = await fetch(`${API_BASE}/season/swap-zone`);
    const swapZone = await swapZoneResponse.json();

    console.log(`\n🔄 SWAP ZONE STATUS:`);
    console.log(`   Active: ${swapZone.active}`);
    console.log(`   Swap Ready: ${swapZone.swapReady || false}`);
    console.log(`   Players Ready: ${swapZone.playersReady}/${swapZone.totalPlayers}`);
    console.log(`   Message: ${swapZone.message || swapZone.reason || 'N/A'}`);

    // LOGIC CHECKS
    console.log(`\n🔬 LOGIC VALIDATION:`);

    // Check 1: If all players have 4+ games, swap should be ready
    const allReady = allPlayers.every(p => p.games >= 4);
    const check1 = allReady === (swapZone.swapReady === true);
    console.log(`   ✓ Check 1 - Swap triggers when all at 4+: ${check1 ? 'PASS' : 'FAIL'}`);
    if (!check1) {
      console.log(`     Expected swapReady=${allReady}, got ${swapZone.swapReady}`);
    }

    // Check 2: Players ready count should match actual count
    const check2 = swapZone.playersReady === playersAt4;
    console.log(`   ${check2 ? '✓' : '❌'} Check 2 - Player count accuracy: ${check2 ? 'PASS' : 'FAIL'}`);
    if (!check2) {
      console.log(`     Expected ${playersAt4} players ready, got ${swapZone.playersReady}`);
    }

    // Check 3: No player should have more than 8 games (season limit)
    const playersOver8 = allPlayers.filter(p => p.games > 8);
    const check3 = playersOver8.length === 0;
    console.log(`   ${check3 ? '✓' : '❌'} Check 3 - No players over 8 games: ${check3 ? 'PASS' : 'FAIL'}`);
    if (!check3) {
      playersOver8.forEach(p => console.log(`     ⚠️  ${p.name}: ${p.games} games`));
    }

    // Check 4: Booking block test (simulate)
    console.log(`\n🚫 BOOKING BLOCK TEST:`);
    const playerWith4 = allPlayers.find(p => p.games >= 4);
    const playerWith3 = allPlayers.find(p => p.games < 4);

    if (playerWith4) {
      console.log(`   Player with 4+ games: ${playerWith4.name} (${playerWith4.games} games)`);
      console.log(`   Expected: BLOCKED from booking`);
    } else {
      console.log(`   No players with 4+ games yet`);
    }

    if (playerWith3) {
      console.log(`   Player with <4 games: ${playerWith3.name} (${playerWith3.games} games)`);
      console.log(`   Expected: CAN still book`);
    }

    // Edge Cases
    console.log(`\n⚠️  EDGE CASES TO WATCH:`);

    // Edge 1: Players with 0 games
    const playersWithZero = allPlayers.filter(p => p.games === 0);
    if (playersWithZero.length > 0) {
      console.log(`   • ${playersWithZero.length} players have 0 games:`);
      playersWithZero.forEach(p => console.log(`     - ${p.name} (Group ${p.group})`));
    } else {
      console.log(`   ✓ All players have at least 1 game`);
    }

    // Edge 2: Game distribution fairness
    const minGames = Math.min(...allPlayers.map(p => p.games));
    const maxGames = Math.max(...allPlayers.map(p => p.games));
    const gameSpread = maxGames - minGames;
    console.log(`   • Game distribution: Min=${minGames}, Max=${maxGames}, Spread=${gameSpread}`);
    if (gameSpread > 4) {
      console.log(`     ⚠️  Large spread may indicate scheduling issues`);
    }

    // Final Summary
    console.log(`\n${'='.repeat(60)}`);
    if (check1 && check2 && check3) {
      console.log('✅ ALL LOGIC CHECKS PASSED - No leaks detected!');
    } else {
      console.log('❌ LOGIC LEAKS DETECTED - Review failures above');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkSwapLogic();

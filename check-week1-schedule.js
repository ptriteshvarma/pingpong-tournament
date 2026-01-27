const API_BASE = 'https://pingpong-tournament.vercel.app/api';

async function checkWeek1Schedule() {
  try {
    console.log('🔍 Checking Week 1 schedule...\n');

    const seasonResponse = await fetch(`${API_BASE}/season`);
    const season = await seasonResponse.json();

    if (!season) {
      console.log('❌ No season found');
      return;
    }

    console.log('📊 WEEK 1 SCHEDULE:\n');

    // Group A Week 1
    const groupAWeek1 = season.schedule.A[0] || [];
    console.log(`GROUP A - Week 1: ${groupAWeek1.length} matches`);
    groupAWeek1.forEach(match => {
      console.log(`  • ${match.player1} vs ${match.player2}`);
    });

    // Count games per player in Group A Week 1
    const groupAPlayers = Object.keys(season.standings.A);
    const groupAGamesCount = {};
    groupAPlayers.forEach(p => groupAGamesCount[p] = 0);

    groupAWeek1.forEach(match => {
      groupAGamesCount[match.player1]++;
      groupAGamesCount[match.player2]++;
    });

    console.log('\nGroup A Players - Week 1 game count:');
    Object.entries(groupAGamesCount)
      .sort((a, b) => a[1] - b[1])
      .forEach(([player, count]) => {
        const status = count === 0 ? '❌' : count === 1 ? '✓' : '✓✓';
        console.log(`  ${status} ${player}: ${count} game(s)`);
      });

    const groupAWithZero = Object.entries(groupAGamesCount).filter(([p, c]) => c === 0);
    if (groupAWithZero.length > 0) {
      console.log(`\n⚠️  ${groupAWithZero.length} Group A players have NO games in Week 1`);
    }

    // Group B Week 1
    console.log(`\n${'='.repeat(60)}\n`);
    const groupBWeek1 = season.schedule.B[0] || [];
    console.log(`GROUP B - Week 1: ${groupBWeek1.length} matches`);
    groupBWeek1.forEach(match => {
      console.log(`  • ${match.player1} vs ${match.player2}`);
    });

    // Count games per player in Group B Week 1
    const groupBPlayers = Object.keys(season.standings.B);
    const groupBGamesCount = {};
    groupBPlayers.forEach(p => groupBGamesCount[p] = 0);

    groupBWeek1.forEach(match => {
      groupBGamesCount[match.player1]++;
      groupBGamesCount[match.player2]++;
    });

    console.log('\nGroup B Players - Week 1 game count:');
    Object.entries(groupBGamesCount)
      .sort((a, b) => a[1] - b[1])
      .forEach(([player, count]) => {
        const status = count === 0 ? '❌' : count === 1 ? '✓' : '✓✓';
        console.log(`  ${status} ${player}: ${count} game(s)`);
      });

    const groupBWithZero = Object.entries(groupBGamesCount).filter(([p, c]) => c === 0);
    if (groupBWithZero.length > 0) {
      console.log(`\n⚠️  ${groupBWithZero.length} Group B players have NO games in Week 1`);
    }

    // Summary
    console.log(`\n${'='.repeat(60)}\n`);
    console.log('📝 SUMMARY:');
    console.log(`Total players with no Week 1 games: ${groupAWithZero.length + groupBWithZero.length}`);

    if (groupAWithZero.length + groupBWithZero.length > 0) {
      console.log('\n💡 This is normal in a partial round-robin schedule.');
      console.log('   Over 10 weeks, each player will play exactly 8 games total.');
      console.log('   Some weeks will have 0-1 games, others will have 2 games per player.');
      console.log('\n   If you want everyone to play in Week 1, we can:');
      console.log('   1. Adjust the schedule distribution algorithm');
      console.log('   2. Ensure minimum 1 game per player per week');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkWeek1Schedule();

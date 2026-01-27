const API_BASE = 'https://pingpong-tournament.vercel.app/api';

async function verifyTiebreakers() {
  try {
    console.log('🔍 Verifying tie-breaker rules...\n');

    const response = await fetch(`${API_BASE}/season`);
    const season = await response.json();

    if (!season) {
      console.log('❌ No season found');
      return;
    }

    console.log('📊 Current Standings:\n');

    // Check Group A
    console.log('GROUP A (9 players):');
    const standingsA = season.standings.A;
    const playersA = Object.entries(standingsA)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        const diffA = a.pointsFor - a.pointsAgainst;
        const diffB = b.pointsFor - b.pointsAgainst;
        return diffB - diffA;
      });

    playersA.forEach((p, idx) => {
      console.log(`  ${idx + 1}. ${p.name.padEnd(25)} - ${p.wins}W-${p.losses}L (Seed: ${p.initialSeed || 'none'})`);
    });

    console.log('\nGROUP B (12 players):');
    const standingsB = season.standings.B;
    const playersB = Object.entries(standingsB)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        const diffA = a.pointsFor - a.pointsAgainst;
        const diffB = b.pointsFor - b.pointsAgainst;
        return diffB - diffA;
      });

    playersB.forEach((p, idx) => {
      console.log(`  ${idx + 1}. ${p.name.padEnd(25)} - ${p.wins}W-${p.losses}L (Seed: ${p.initialSeed || 'none'})`);
    });

    console.log('\n✅ Tie-Breaker Rules in Effect:\n');
    console.log('1. Most Wins (primary)');
    console.log('2. Head-to-Head Record (if tied on wins)');
    console.log('   • 2-way tie: Direct H2H between the two players');
    console.log('   • 3+ way tie: H2H record vs all tied players');
    console.log('3. Initial Seed (final tiebreaker)');
    console.log('   • Group A: Uses seed #1-12');
    console.log('   • Group B: All unseeded, so ties broken by H2H only');
    console.log('\n⚠️  Note: Group B players have no seed, so if two players');
    console.log('   have same record AND haven\'t played each other yet,');
    console.log('   the system will use alphabetical order temporarily.');
    console.log('   This resolves automatically once they play each other.');

    console.log('\n📅 Current Season Info:');
    console.log(`   Week: ${season.currentWeek} of ${season.totalWeeks}`);
    console.log(`   Status: ${season.status}`);
    console.log(`   Mid-season swap: Week 3`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verifyTiebreakers();

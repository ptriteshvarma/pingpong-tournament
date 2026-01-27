const API_BASE = 'https://pingpong-tournament.vercel.app/api';
const ADMIN_PASSWORD = 'Password';

async function checkAnnieSchmitt() {
  try {
    console.log('🔍 Checking Annie Schmitt status...\n');

    // Check registrations
    console.log('1. Checking registrations...');
    const regResponse = await fetch(`${API_BASE}/registration/list`, {
      headers: { 'X-Admin-Password': ADMIN_PASSWORD }
    });
    const registrations = await regResponse.json();

    const annie = registrations.find(r => r.player_name.toLowerCase().includes('annie'));

    if (annie) {
      console.log('   ✓ Found in registrations:');
      console.log(`     Name: ${annie.player_name}`);
      console.log(`     Status: ${annie.registration_status}`);
      console.log(`     Seed: ${annie.final_seed || 'none'}`);
      console.log(`     Is Ranked: ${annie.is_ranked}`);
    } else {
      console.log('   ❌ Annie Schmitt NOT found in registrations');
    }

    // Check current season
    console.log('\n2. Checking current season...');
    const seasonResponse = await fetch(`${API_BASE}/season`);
    const season = await seasonResponse.json();

    let inGroupA = false;
    let inGroupB = false;

    if (season) {
      console.log(`   Season Status: ${season.status}`);
      console.log(`   Week: ${season.currentWeek} of ${season.totalWeeks}`);
      console.log(`   Group A players: ${season.groupA}`);
      console.log(`   Group B players: ${season.groupB}`);

      // Check if Annie is in Group A or B
      inGroupA = season.standings?.A && Object.keys(season.standings.A).some(name => name.toLowerCase().includes('annie'));
      inGroupB = season.standings?.B && Object.keys(season.standings.B).some(name => name.toLowerCase().includes('annie'));

      if (inGroupA) {
        console.log('   ✓ Annie Schmitt is in Group A');
        const annieStats = Object.entries(season.standings.A).find(([name]) => name.toLowerCase().includes('annie'));
        if (annieStats) {
          console.log(`     Record: ${annieStats[1].wins}W-${annieStats[1].losses}L`);
        }
      } else if (inGroupB) {
        console.log('   ✓ Annie Schmitt is in Group B');
        const annieStats = Object.entries(season.standings.B).find(([name]) => name.toLowerCase().includes('annie'));
        if (annieStats) {
          console.log(`     Record: ${annieStats[1].wins}W-${annieStats[1].losses}L`);
        }
      } else {
        console.log('   ❌ Annie Schmitt NOT in current season standings');
      }
    } else {
      console.log('   ❌ No active season found');
    }

    // Check all players
    console.log('\n3. Checking all players in system...');
    const playersResponse = await fetch(`${API_BASE}/players`);
    const players = await playersResponse.json();

    const anniePlayer = players.find(p => p.name.toLowerCase().includes('annie'));
    if (anniePlayer) {
      console.log('   ✓ Found in players table:');
      console.log(`     Name: ${anniePlayer.name}`);
      console.log(`     Wins: ${anniePlayer.wins}`);
      console.log(`     Losses: ${anniePlayer.losses}`);
    } else {
      console.log('   ❌ Annie Schmitt NOT in players table');
    }

    console.log('\n📊 Summary:');
    if (annie && !inGroupA && !inGroupB) {
      console.log('   ⚠️  ISSUE FOUND: Annie Schmitt is registered but NOT in season!');
      console.log('   This likely happened during season creation.');
      console.log('\n   To fix this, you can:');
      console.log('   1. Reset the entire schedule and regenerate (recommended)');
      console.log('   2. Manually add Annie to the correct group');
    } else if (!annie) {
      console.log('   ⚠️  Annie Schmitt is not registered at all');
    } else {
      console.log('   ✓ Annie Schmitt is properly included in the season');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkAnnieSchmitt();

const API_BASE = 'https://pingpong-tournament.vercel.app/api';
const ADMIN_PASSWORD = 'Password';

const groupAPlayers = [
  { name: 'Cameron McLain', seed: 1 },
  { name: 'Alan Smith', seed: 2 },
  { name: 'Sivakumar Ramamurthy', seed: 3 },
  { name: 'Michael Schmidt', seed: 4 },
  { name: 'Niketha Kailash', seed: 5 },
  { name: 'Ritesh Varma', seed: 6 },
  { name: 'Jonathan Friend', seed: 7 },
  { name: 'Garrett', seed: 11 },
  { name: 'Brian Pleiman', seed: 12 }
];

async function fixGroupAPlayers() {
  try {
    console.log('🔧 Fixing Group A player seeding...\n');

    // Get all registrations
    const regResponse = await fetch(`${API_BASE}/registration/list`, {
      headers: { 'X-Admin-Password': ADMIN_PASSWORD }
    });
    const registrations = await regResponse.json();

    console.log(`Found ${registrations.length} total registrations\n`);

    // Fix each Group A player
    for (const player of groupAPlayers) {
      const reg = registrations.find(r => r.player_name === player.name);

      if (!reg) {
        console.log(`⚠️  ${player.name} - NOT FOUND in registrations`);
        continue;
      }

      console.log(`Updating ${player.name} to Seed #${player.seed}...`);

      const updateResponse = await fetch(`${API_BASE}/registration/${reg.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': ADMIN_PASSWORD
        },
        body: JSON.stringify({
          registration_status: 'approved',
          final_seed: player.seed
        })
      });

      if (updateResponse.ok) {
        console.log(`  ✓ ${player.name} set to Seed #${player.seed}`);
      } else {
        const error = await updateResponse.json();
        console.log(`  ✗ Failed: ${error.error}`);
      }
    }

    console.log('\n✅ All Group A players updated!\n');
    console.log('🔄 Now converting to season format...\n');

    // Convert to season
    const convertResponse = await fetch(`${API_BASE}/registration/convert-to-season`, {
      method: 'POST',
      headers: { 'X-Admin-Password': ADMIN_PASSWORD }
    });

    const data = await convertResponse.json();

    if (!convertResponse.ok) {
      console.error('❌ Conversion failed:', data.error);
      if (data.groupA !== undefined) {
        console.error(`   Group A: ${data.groupA} players`);
        console.error(`   Group B: ${data.groupB} players`);
      }
      return;
    }

    console.log('✅ Season created successfully!\n');
    console.log('📊 Season Details:');
    console.log(`   Total Weeks: ${data.season.totalWeeks}`);
    console.log(`   Group A: ${data.season.groupA} players (seeded)`);
    console.log(`   Group B: ${data.season.groupB} players (unseeded)`);
    console.log(`   Group A Matches: ${data.season.matchesPerGroup.A}`);
    console.log(`   Group B Matches: ${data.season.matchesPerGroup.B}`);
    console.log('\n🏆 Season Format:');
    console.log('   • 8 games per player');
    console.log('   • 2 games per player per week');
    console.log('   • Mid-season swap at Week 3');
    console.log('   • Playoffs after Week 10');
    console.log('\n✨ Go to https://pingpong-tournament.vercel.app');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixGroupAPlayers();

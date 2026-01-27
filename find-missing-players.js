const API_BASE = 'https://pingpong-tournament.vercel.app/api';
const ADMIN_PASSWORD = 'Password';

async function findMissingPlayers() {
  try {
    console.log('🔍 Finding missing players...\n');

    // Get registrations
    const regResponse = await fetch(`${API_BASE}/registration/list`, {
      headers: { 'X-Admin-Password': ADMIN_PASSWORD }
    });
    const registrations = await regResponse.json();

    const approved = registrations.filter(r => r.registration_status === 'approved');
    const groupBRegistered = approved.filter(r => !r.is_ranked || !r.final_seed);

    console.log(`Group B Registered (${groupBRegistered.length} players):`);
    groupBRegistered.forEach(p => console.log(`  - ${p.player_name}`));

    // Get current season
    const seasonResponse = await fetch(`${API_BASE}/season`);
    const season = await seasonResponse.json();

    const groupBInSeason = Object.keys(season.standings.B || {});
    console.log(`\nGroup B in Season (${groupBInSeason.length} players):`);
    groupBInSeason.forEach(p => console.log(`  - ${p}`));

    // Find missing
    const missing = groupBRegistered.filter(reg =>
      !groupBInSeason.includes(reg.player_name)
    );

    console.log(`\n❌ MISSING PLAYERS (${missing.length}):`);
    missing.forEach(p => {
      console.log(`  - ${p.player_name}`);
      console.log(`      is_ranked: ${p.is_ranked}`);
      console.log(`      final_seed: ${p.final_seed}`);
      console.log(`      admin_approved: ${p.admin_approved}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

findMissingPlayers();

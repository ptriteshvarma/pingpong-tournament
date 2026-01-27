const API_BASE = 'https://pingpong-tournament.vercel.app/api';
const ADMIN_PASSWORD = 'Password';

async function resetAndRegenerateRSeason() {
  try {
    console.log('🔄 Resetting and regenerating season...\n');

    // Step 1: Check current registrations
    console.log('1. Checking all approved registrations...');
    const regResponse = await fetch(`${API_BASE}/registration/list`, {
      headers: { 'X-Admin-Password': ADMIN_PASSWORD }
    });
    const registrations = await regResponse.json();

    const approved = registrations.filter(r => r.registration_status === 'approved');
    console.log(`   ✓ Found ${approved.length} approved players:\n`);

    const seeded = approved.filter(r => r.is_ranked && r.final_seed);
    const unseeded = approved.filter(r => !r.is_ranked || !r.final_seed);

    console.log(`   Group A (Seeded): ${seeded.length} players`);
    seeded.forEach(p => console.log(`     - ${p.player_name} (Seed #${p.final_seed})`));

    console.log(`\n   Group B (Unseeded): ${unseeded.length} players`);
    unseeded.forEach(p => console.log(`     - ${p.player_name}`));

    // Check if Annie is included
    const annie = approved.find(p => p.player_name.toLowerCase().includes('annie'));
    if (annie) {
      console.log(`\n   ✓ Annie Schmitt is in the approved list`);
    } else {
      console.log(`\n   ❌ Annie Schmitt is NOT approved yet!`);
      return;
    }

    // Step 2: Delete current season
    console.log('\n2. Deleting current season...');
    const deleteResponse = await fetch(`${API_BASE}/season`, {
      method: 'DELETE',
      headers: { 'X-Admin-Password': ADMIN_PASSWORD }
    });

    if (deleteResponse.ok) {
      const result = await deleteResponse.json();
      console.log(`   ✓ ${result.message}`);
    } else {
      console.log('   ❌ Failed to delete season:', await deleteResponse.text());
      return;
    }

    // Step 3: Regenerate season from registrations
    console.log('\n3. Regenerating season from registrations...');
    const convertResponse = await fetch(`${API_BASE}/registration/convert-to-season`, {
      method: 'POST',
      headers: { 'X-Admin-Password': ADMIN_PASSWORD }
    });

    if (!convertResponse.ok) {
      const error = await convertResponse.json();
      console.log('   ❌ Failed to generate season:', error.error);
      if (error.groupA !== undefined) {
        console.log(`      Group A: ${error.groupA} players`);
        console.log(`      Group B: ${error.groupB} players`);
      }
      return;
    }

    const newSeason = await convertResponse.json();
    console.log('   ✓ Season regenerated successfully!\n');

    console.log('📊 New Season Details:');
    console.log(`   Total Weeks: ${newSeason.season.totalWeeks}`);
    console.log(`   Group A: ${newSeason.season.groupA} players (seeded)`);
    console.log(`   Group B: ${newSeason.season.groupB} players (unseeded)`);
    console.log(`   Group A Matches: ${newSeason.season.matchesPerGroup.A}`);
    console.log(`   Group B Matches: ${newSeason.season.matchesPerGroup.B}`);

    // Step 4: Verify Annie is now in the season
    console.log('\n4. Verifying Annie Schmitt is included...');
    const verifyResponse = await fetch(`${API_BASE}/season`);
    const season = await verifyResponse.json();

    const inGroupA = season.standings?.A && Object.keys(season.standings.A).some(name => name.toLowerCase().includes('annie'));
    const inGroupB = season.standings?.B && Object.keys(season.standings.B).some(name => name.toLowerCase().includes('annie'));

    if (inGroupA) {
      console.log('   ✓ Annie Schmitt is now in Group A!');
    } else if (inGroupB) {
      console.log('   ✓ Annie Schmitt is now in Group B!');
    } else {
      console.log('   ❌ Annie Schmitt still not in season - something went wrong');
      return;
    }

    console.log('\n✅ SUCCESS! Season has been reset and regenerated.');
    console.log('   All registered players (including Annie Schmitt) are now included.');
    console.log('\n🏓 Go to https://pingpong-tournament.vercel.app to view the new schedule!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

resetAndRegenerateRSeason();

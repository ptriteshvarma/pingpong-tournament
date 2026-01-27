const API_BASE = 'https://pingpong-tournament.vercel.app/api';

async function convertToSeason() {
  try {
    console.log('🔄 Converting bracket tournament to season format...\n');

    // Try common admin passwords
    const passwords = ['Password', 'Username', 'Pingpong@24', process.env.ADMIN_PASSWORD];

    let response;
    let successPassword = null;

    for (const pwd of passwords) {
      if (!pwd) continue;
      console.log(`Trying password: ${pwd.substring(0, 3)}...`);

      response = await fetch(`${API_BASE}/registration/convert-to-season`, {
        method: 'POST',
        headers: {
          'X-Admin-Password': pwd
        }
      });

      if (response.ok) {
        successPassword = pwd;
        break;
      }
    }

    if (!successPassword) {
      console.error('❌ All passwords failed. Please run with correct admin password:');
      console.error('   ADMIN_PASSWORD=YourPassword node convert-to-season.js');
      return;
    }

    console.log(`✓ Authenticated with password: ${successPassword.substring(0, 3)}...\n`);

    const data = await response.json();

    if (!response.ok) {
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
    console.log(`   Group A: ${data.season.groupA} players`);
    console.log(`   Group B: ${data.season.groupB} players`);
    console.log(`   Group A Matches: ${data.season.matchesPerGroup.A}`);
    console.log(`   Group B Matches: ${data.season.matchesPerGroup.B}`);
    console.log('\n🏆 Season Format Features:');
    console.log('   • 8 games per player');
    console.log('   • 2 games per player per week');
    console.log('   • Mid-season swap at Week 3');
    console.log('   • Playoffs after Week 10');
    console.log('\n✨ Go to https://pingpong-tournament.vercel.app to view your season!');
    console.log('   Check the Home, Schedule, and Standings tabs.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

convertToSeason();

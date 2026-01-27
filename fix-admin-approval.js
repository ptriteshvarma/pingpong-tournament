const API_BASE = 'https://pingpong-tournament.vercel.app/api';
const ADMIN_PASSWORD = 'Password';

async function fixAdminApproval() {
  try {
    console.log('🔧 Fixing admin approval for Alex Rider and Annie Schmitt...\n');

    const playersToFix = ['Alex Rider', 'Annie Schmitt'];

    // Get all registrations
    const regResponse = await fetch(`${API_BASE}/registration/list`, {
      headers: { 'X-Admin-Password': ADMIN_PASSWORD }
    });
    const registrations = await regResponse.json();

    for (const playerName of playersToFix) {
      const player = registrations.find(r => r.player_name === playerName);

      if (!player) {
        console.log(`❌ ${playerName} - NOT FOUND in registrations`);
        continue;
      }

      console.log(`Found ${playerName} (ID: ${player.id})`);
      console.log(`  Current status: ${player.registration_status}`);
      console.log(`  Admin approved: ${player.admin_approved}`);

      // Update to set admin_approved = TRUE
      const updateResponse = await fetch(`${API_BASE}/registration/${player.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': ADMIN_PASSWORD
        },
        body: JSON.stringify({
          registration_status: 'approved',
          final_seed: null // unseeded
        })
      });

      if (updateResponse.ok) {
        console.log(`  ✓ Admin approved ${playerName}\n`);
      } else {
        const error = await updateResponse.text();
        console.log(`  ❌ Failed to approve: ${error}\n`);
      }
    }

    console.log('✅ Admin approval fixed!');
    console.log('\n📝 Next step: Run reset-and-regenerate-season.js to include them in the season');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixAdminApproval();

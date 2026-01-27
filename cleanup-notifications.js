const API_BASE = 'https://pingpong-tournament.vercel.app/api';
const ADMIN_PASSWORD = 'Password';

async function cleanupNotifications() {
  try {
    console.log('🧹 Cleaning up old notifications...\n');

    // Option 1: Delete notifications older than 30 days
    console.log('1. Deleting notifications older than 30 days...');
    const cleanup30 = await fetch(`${API_BASE}/notifications/cleanup`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Password': ADMIN_PASSWORD
      },
      body: JSON.stringify({ daysOld: 30 })
    });

    if (cleanup30.ok) {
      const result = await cleanup30.json();
      console.log(`   ✓ ${result.message}`);
    } else {
      console.log('   ❌ Failed:', await cleanup30.text());
    }

    // If you want to delete ALL notifications (including recent ones), uncomment below:
    /*
    console.log('\n2. Deleting ALL notifications...');
    const deleteAll = await fetch(`${API_BASE}/notifications/delete-all`, {
      method: 'DELETE',
      headers: { 'X-Admin-Password': ADMIN_PASSWORD }
    });

    if (deleteAll.ok) {
      const result = await deleteAll.json();
      console.log(`   ✓ ${result.message}`);
    } else {
      console.log('   ❌ Failed:', await deleteAll.text());
    }
    */

    console.log('\n✅ Cleanup complete!');
    console.log('   Old "hi hi" messages and other stale notifications should be gone now.');
    console.log('   From now on, notifications older than 30 days will be auto-deleted.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

cleanupNotifications();

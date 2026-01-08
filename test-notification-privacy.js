// Test Notification Privacy - Verify each player only sees their own notifications
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testPrivacy() {
  console.log('=== TESTING NOTIFICATION PRIVACY ===\n');

  try {
    // Create notifications table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        player_name VARCHAR(255),
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        link VARCHAR(255),
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Clear test notifications
    await pool.query("DELETE FROM notifications WHERE type = 'privacy_test'");

    // Create notification specifically for Cameron McLain
    console.log('1. Creating notification for Cameron McLain...');
    await pool.query(
      "INSERT INTO notifications (player_name, type, title, message) VALUES ($1, $2, $3, $4)",
      ['Cameron McLain', 'privacy_test', 'Private to Cameron', 'This should ONLY be visible to Cameron McLain']
    );

    // Create notification specifically for Alan Smith
    console.log('2. Creating notification for Alan Smith...');
    await pool.query(
      "INSERT INTO notifications (player_name, type, title, message) VALUES ($1, $2, $3, $4)",
      ['Alan Smith', 'privacy_test', 'Private to Alan', 'This should ONLY be visible to Alan Smith']
    );

    // Create broadcast notification (visible to all)
    console.log('3. Creating broadcast notification...\n');
    await pool.query(
      "INSERT INTO notifications (player_name, type, title, message) VALUES ($1, $2, $3, $4)",
      [null, 'privacy_test', 'General Announcement', 'This broadcast should be visible to ALL players']
    );

    // Check what Cameron McLain sees
    console.log('=== What Cameron McLain sees ===');
    const cameronNotifs = await pool.query(
      "SELECT title, player_name FROM notifications WHERE (player_name = $1 OR player_name IS NULL) AND type = 'privacy_test' ORDER BY created_at DESC",
      ['Cameron McLain']
    );
    cameronNotifs.rows.forEach(n => {
      const visibility = n.player_name ? `(Personal - ${n.player_name})` : '(Broadcast)';
      console.log(`  - ${n.title} ${visibility}`);
    });
    console.log(`  Total: ${cameronNotifs.rows.length} notifications\n`);

    // Check what Alan Smith sees
    console.log('=== What Alan Smith sees ===');
    const alanNotifs = await pool.query(
      "SELECT title, player_name FROM notifications WHERE (player_name = $1 OR player_name IS NULL) AND type = 'privacy_test' ORDER BY created_at DESC",
      ['Alan Smith']
    );
    alanNotifs.rows.forEach(n => {
      const visibility = n.player_name ? `(Personal - ${n.player_name})` : '(Broadcast)';
      console.log(`  - ${n.title} ${visibility}`);
    });
    console.log(`  Total: ${alanNotifs.rows.length} notifications\n`);

    // Check what SivaKumar sees (no personal notifications)
    console.log('=== What SivaKumar sees (no personal notifs) ===');
    const sivaNotifs = await pool.query(
      "SELECT title, player_name FROM notifications WHERE (player_name = $1 OR player_name IS NULL) AND type = 'privacy_test' ORDER BY created_at DESC",
      ['SivaKumar']
    );
    sivaNotifs.rows.forEach(n => {
      const visibility = n.player_name ? `(Personal - ${n.player_name})` : '(Broadcast)';
      console.log(`  - ${n.title} ${visibility}`);
    });
    console.log(`  Total: ${sivaNotifs.rows.length} notifications\n`);

    // Verify privacy
    console.log('=== PRIVACY VERIFICATION ===');
    const cameronSeesAlan = cameronNotifs.rows.some(n => n.title === 'Private to Alan');
    const alanSeesCameron = alanNotifs.rows.some(n => n.title === 'Private to Cameron');

    console.log(`Cameron can see Alan's private notification: ${cameronSeesAlan ? 'YES (BUG!)' : 'NO (Correct)'}`);
    console.log(`Alan can see Cameron's private notification: ${alanSeesCameron ? 'YES (BUG!)' : 'NO (Correct)'}`);
    console.log(`All players see broadcast: ${cameronNotifs.rows.some(n => n.title === 'General Announcement') && alanNotifs.rows.some(n => n.title === 'General Announcement') ? 'YES (Correct)' : 'NO (BUG!)'}`);

    // Clean up
    console.log('\nCleaning up test notifications...');
    await pool.query("DELETE FROM notifications WHERE type = 'privacy_test'");

    if (!cameronSeesAlan && !alanSeesCameron) {
      console.log('\n=== NOTIFICATION PRIVACY IS WORKING CORRECTLY ===');
    } else {
      console.log('\n=== WARNING: PRIVACY ISSUE DETECTED ===');
    }

  } catch (e) {
    console.error('Error:', e.message);
  }

  await pool.end();
}

testPrivacy();

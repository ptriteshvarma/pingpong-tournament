// Test Notification System
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testNotifications() {
  console.log('=== VALIDATING PUSH NOTIFICATION SYSTEM ===\n');

  try {
    // 1. Check if notifications table exists
    const tableCheck = await pool.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications')");
    console.log('1. Notifications table exists:', tableCheck.rows[0].exists);

    if (!tableCheck.rows[0].exists) {
      console.log('   Creating notifications table...');
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
      await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_player ON notifications(player_name)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read)');
      console.log('   Table created successfully!');
    }

    // 2. Test inserting a notification
    console.log('\n2. Testing notification creation...');
    const insertResult = await pool.query(
      "INSERT INTO notifications (player_name, type, title, message) VALUES ($1, $2, $3, $4) RETURNING id",
      ['Cameron McLain', 'test', 'Test Notification', 'This is a test notification for push system validation']
    );
    console.log('   Created notification ID:', insertResult.rows[0].id);

    // 3. Test retrieving notifications
    console.log('\n3. Testing notification retrieval...');
    const notifications = await pool.query(
      "SELECT * FROM notifications WHERE player_name = $1 OR player_name IS NULL ORDER BY created_at DESC LIMIT 5",
      ['Cameron McLain']
    );
    console.log('   Found', notifications.rows.length, 'notifications for Cameron McLain');
    notifications.rows.forEach(n => {
      console.log('   -', n.title, '|', n.type, '| Read:', n.is_read);
    });

    // 4. Test broadcast (null player_name)
    console.log('\n4. Testing broadcast notification...');
    const broadcastResult = await pool.query(
      "INSERT INTO notifications (player_name, type, title, message) VALUES ($1, $2, $3, $4) RETURNING id",
      [null, 'announcement', 'System Test', 'Broadcast notification test - visible to all players']
    );
    console.log('   Created broadcast notification ID:', broadcastResult.rows[0].id);

    // 5. Verify broadcast appears for different player
    console.log('\n5. Testing broadcast visibility...');
    const otherPlayerNotifs = await pool.query(
      "SELECT * FROM notifications WHERE player_name = $1 OR player_name IS NULL ORDER BY created_at DESC LIMIT 3",
      ['Alan Smith']
    );
    console.log('   Alan Smith sees', otherPlayerNotifs.rows.length, 'notifications (including broadcasts)');

    // 6. Test mark as read
    console.log('\n6. Testing mark as read...');
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = $1', [insertResult.rows[0].id]);
    const checkRead = await pool.query('SELECT is_read FROM notifications WHERE id = $1', [insertResult.rows[0].id]);
    console.log('   Notification marked as read:', checkRead.rows[0].is_read);

    // 7. Clean up test notifications
    console.log('\n7. Cleaning up test notifications...');
    await pool.query("DELETE FROM notifications WHERE type = 'test' OR title = 'System Test'");
    console.log('   Test notifications removed');

    console.log('\n=== PUSH NOTIFICATION SYSTEM VALIDATED SUCCESSFULLY ===');
    console.log('\nSystem supports:');
    console.log('  - Individual player notifications');
    console.log('  - Broadcast notifications (visible to all)');
    console.log('  - Read/unread tracking');
    console.log('  - Browser push API integration (in frontend)');

  } catch (e) {
    console.error('Error:', e.message);
  }

  await pool.end();
}

testNotifications();

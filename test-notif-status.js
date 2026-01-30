const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testNotifications() {
  try {
    console.log('Testing notification system...\n');

    // Check if notifications table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'notifications'
      );
    `);
    console.log('Notifications table exists:', tableCheck.rows[0].exists);

    if (tableCheck.rows[0].exists) {
      // Count total notifications
      const countResult = await pool.query('SELECT COUNT(*) FROM notifications');
      console.log('Total notifications in database:', countResult.rows[0].count);

      // Show recent notifications
      const recentResult = await pool.query(`
        SELECT player_name, type, title, message, created_at, is_read
        FROM notifications
        ORDER BY created_at DESC
        LIMIT 10
      `);

      console.log('\nRecent 10 notifications:');
      recentResult.rows.forEach(n => {
        const date = new Date(n.created_at).toLocaleString();
        console.log(`- ${n.player_name || 'ALL'}: ${n.title}`);
        console.log(`  ${n.message.substring(0, 60)}`);
        console.log(`  ${date} - ${n.is_read ? 'Read' : 'UNREAD'}`);
        console.log();
      });

      // Count unread by player
      const unreadByPlayer = await pool.query(`
        SELECT player_name, COUNT(*) as unread_count
        FROM notifications
        WHERE is_read = FALSE AND player_name IS NOT NULL
        GROUP BY player_name
        ORDER BY unread_count DESC
        LIMIT 10
      `);

      console.log('\nUnread notifications by player:');
      if (unreadByPlayer.rows.length === 0) {
        console.log('  No unread notifications for any player');
      } else {
        unreadByPlayer.rows.forEach(p => {
          console.log(`  ${p.player_name}: ${p.unread_count} unread`);
        });
      }
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testNotifications();

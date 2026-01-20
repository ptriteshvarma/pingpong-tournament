const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function importDataOrdered() {
  const client = await pool.connect();
  try {
    console.log('Connected to Supabase database');

    const backup = JSON.parse(fs.readFileSync('railway_data_export.json', 'utf8'));
    console.log('Loaded Railway backup data');
    console.log('');

    // Clear in reverse order of dependencies
    console.log('Clearing existing data...');
    await client.query('TRUNCATE league_registration, players, matches, leaderboard, availability, bracket_meta, league_config, push_subscriptions, season, season_archive, table_bookings, activity_log RESTART IDENTITY CASCADE');
    console.log('Tables cleared');
    console.log('');

    // Import in correct order (parents before children)
    const importOrder = ['players', 'league_config', 'league_registration', 'matches', 'leaderboard',
                         'availability', 'bracket_meta', 'push_subscriptions', 'season', 'season_archive',
                         'table_bookings', 'activity_log'];

    for (const tableName of importOrder) {
      const rows = backup.tables[tableName] || [];

      if (rows.length === 0) {
        console.log(`${tableName}: 0 rows (skipped)`);
        continue;
      }

      console.log(`Importing ${tableName}: ${rows.length} rows...`);

      let imported = 0;
      for (const row of rows) {
        try {
          const columns = Object.keys(row);
          const values = Object.values(row);
          const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

          const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
          await client.query(query, values);
          imported++;
        } catch (e) {
          console.log(`  Warning: ${e.message.substring(0, 100)}`);
        }
      }

      console.log(`${tableName}: ${imported}/${rows.length} rows imported`);
    }

    console.log('');
    console.log('==================================================');
    console.log('Data import completed successfully!');
    console.log('==================================================');

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importDataOrdered().catch(console.error);

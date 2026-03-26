const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

(async () => {
  try {
    const result = await pool.query(`
      SELECT season_id, group_name, standings 
      FROM seasons 
      WHERE status = 'active'
      ORDER BY created_at DESC 
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log('No active season found');
      process.exit(0);
    }

    const season = result.rows[0];
    console.log('Season ID:', season.season_id);
    console.log('Group:', season.group_name);
    console.log('\nStandings:');
    console.log(JSON.stringify(season.standings, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    pool.end();
  }
})();

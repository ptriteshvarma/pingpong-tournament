const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

(async () => {
  try {
    const result = await pool.query(`
      SELECT season_id, standings 
      FROM seasons 
      WHERE status IN ('active', 'playin', 'playoffs')
      ORDER BY created_at DESC 
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log('No active season found');
      process.exit(0);
    }

    const season = result.rows[0];
    console.log('Season ID:', season.season_id);
    console.log('\n=== GROUP A STANDINGS ===');
    const groupA = season.standings.A;
    Object.entries(groupA).forEach(([name, stats]) => {
      console.log(`${name}:`);
      console.log(`  Wins: ${stats.wins}, Losses: ${stats.losses}`);
      console.log(`  Points For: ${stats.pointsFor}, Points Against: ${stats.pointsAgainst}`);
      if (stats.headToHead) {
        console.log(`  H2H:`, JSON.stringify(stats.headToHead));
      }
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    pool.end();
  }
})();

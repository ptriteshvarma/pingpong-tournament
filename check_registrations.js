const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Pingpong%4024@localhost:5432/pingpong'
});

async function checkRegistrations() {
  try {
    const res = await pool.query(
      'SELECT player_name, final_seed, is_ranked FROM league_registration ORDER BY final_seed NULLS LAST, player_name'
    );

    console.log('Current Registrations:');
    res.rows.forEach(r => {
      console.log(`  ${r.player_name}: Seed=${r.final_seed}, Ranked=${r.is_ranked}`);
    });

    await pool.end();
  } catch (err) {
    console.error('Error:', err);
    await pool.end();
  }
}

checkRegistrations();

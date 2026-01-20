const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function verifyImport() {
  const client = await pool.connect();
  try {
    console.log('Verifying data import...\n');

    const tables = ['players', 'league_registration', 'matches', 'leaderboard', 'availability', 'bracket_meta', 'league_config'];

    for (const table of tables) {
      const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`${table}: ${result.rows[0].count} rows`);
    }

    console.log('\nSample player data:');
    const players = await client.query('SELECT name, seed FROM players ORDER BY seed NULLS LAST LIMIT 5');
    players.rows.forEach(p => console.log(`  - ${p.name} (seed: ${p.seed || 'unranked'})`));

    console.log('\nSample registration data:');
    const regs = await client.query('SELECT player_name, registration_status, admin_approved FROM league_registration LIMIT 5');
    regs.rows.forEach(r => console.log(`  - ${r.player_name}: ${r.registration_status} (approved: ${r.admin_approved})`));

    console.log('\n✅ Verification complete!');

  } finally {
    client.release();
    await pool.end();
  }
}

verifyImport().catch(console.error);

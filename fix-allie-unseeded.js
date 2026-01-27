const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Pingpong%4024@localhost:5432/pingpong'
});

async function fixAllieAndRegenerateBracket() {
  try {
    console.log('Step 1: Finding Allie Shaw...');
    const findAllie = await pool.query(
      "SELECT id, player_name, final_seed, is_ranked FROM league_registration WHERE player_name = 'Allie Shaw'"
    );

    if (findAllie.rows.length === 0) {
      console.log('ERROR: Allie Shaw not found in registrations');
      await pool.end();
      return;
    }

    console.log('Found:', findAllie.rows[0]);

    console.log('\nStep 2: Setting Allie Shaw to unseeded...');
    const updateResult = await pool.query(`
      UPDATE league_registration
      SET final_seed = NULL,
          is_ranked = FALSE,
          admin_approved = TRUE,
          updated_at = CURRENT_TIMESTAMP
      WHERE player_name = 'Allie Shaw'
      RETURNING id, player_name, final_seed, is_ranked
    `);

    console.log('Updated:', updateResult.rows[0]);

    console.log('\nStep 3: Verifying all registrations...');
    const allRegs = await pool.query(`
      SELECT player_name, final_seed, is_ranked
      FROM league_registration
      WHERE registration_status = 'approved'
      ORDER BY
        CASE WHEN final_seed IS NOT NULL THEN final_seed ELSE 9999 END ASC,
        player_name ASC
    `);

    console.log('\nAll Approved Players:');
    allRegs.rows.forEach(r => {
      console.log(`  ${r.player_name}: Seed=${r.final_seed === null ? 'UNSEEDED' : '#' + r.final_seed}, Ranked=${r.is_ranked}`);
    });

    console.log('\n✅ Done! Now regenerate the bracket from the admin UI.');
    console.log('   Go to Register tab -> Generate League Bracket -> Generate Bracket from Registrations');

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

fixAllieAndRegenerateBracket();

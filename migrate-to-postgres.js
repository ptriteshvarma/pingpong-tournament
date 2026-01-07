// Migration script to transfer data from JSON files to PostgreSQL
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Check if DATABASE_URL is provided
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  console.error('Usage: DATABASE_URL=postgresql://... node migrate-to-postgres.js');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const DATA_DIR = './data';
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');
const AVAILABILITY_FILE = path.join(DATA_DIR, 'availability.json');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');

const readJSON = (filepath, defaultValue = {}) => {
  try {
    if (fs.existsSync(filepath)) {
      const data = fs.readFileSync(filepath, 'utf8');
      if (data.trim()) {
        return JSON.parse(data);
      }
    }
  } catch (e) {
    console.error(`Error reading ${filepath}:`, e);
  }
  return defaultValue;
};

async function migrate() {
  console.log('Starting migration from JSON to PostgreSQL...\n');

  const client = await pool.connect();

  try {
    // Test connection
    const testResult = await client.query('SELECT NOW()');
    console.log('✓ Database connected:', testResult.rows[0].now);

    // Create schema
    console.log('\n1. Creating database schema...');
    const schema = fs.readFileSync('schema.sql', 'utf8');
    await client.query(schema);
    console.log('✓ Schema created successfully');

    // Migrate players
    console.log('\n2. Migrating players...');
    const players = readJSON(PLAYERS_FILE, []);
    if (players.length > 0) {
      for (const player of players) {
        await client.query(
          'INSERT INTO players (name, seed) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET seed = $2',
          [player.name, player.seed]
        );
      }
      console.log(`✓ Migrated ${players.length} players`);
    } else {
      console.log('  No players to migrate');
    }

    // Migrate availability
    console.log('\n3. Migrating availability...');
    const availability = readJSON(AVAILABILITY_FILE, {});
    let availabilityCount = 0;
    for (const [playerName, dates] of Object.entries(availability)) {
      for (const [date, timeSlots] of Object.entries(dates)) {
        for (const timeSlot of timeSlots) {
          await client.query(
            'INSERT INTO availability (player_name, date, time_slot) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [playerName, date, timeSlot]
          );
          availabilityCount++;
        }
      }
    }
    console.log(`✓ Migrated ${availabilityCount} availability slots`);

    // Migrate leaderboard
    console.log('\n4. Migrating leaderboard...');
    const leaderboard = readJSON(LEADERBOARD_FILE, { players: {}, weekStart: null });
    const playerCount = Object.keys(leaderboard.players || {}).length;
    if (playerCount > 0) {
      for (const [playerName, stats] of Object.entries(leaderboard.players)) {
        await client.query(
          `INSERT INTO leaderboard (
            player_name, week_start,
            weekly_wins, weekly_losses, weekly_points, weekly_matches_played,
            alltime_wins, alltime_losses, alltime_points, alltime_matches_played
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (player_name) DO UPDATE SET
            weekly_wins = $3, weekly_losses = $4, weekly_points = $5, weekly_matches_played = $6,
            alltime_wins = $7, alltime_losses = $8, alltime_points = $9, alltime_matches_played = $10,
            week_start = $2`,
          [
            playerName,
            leaderboard.weekStart || new Date(),
            stats.weekly?.wins || 0,
            stats.weekly?.losses || 0,
            stats.weekly?.points || 0,
            stats.weekly?.matchesPlayed || 0,
            stats.allTime?.wins || 0,
            stats.allTime?.losses || 0,
            stats.allTime?.points || 0,
            stats.allTime?.matchesPlayed || 0
          ]
        );
      }
      console.log(`✓ Migrated ${playerCount} player stats`);
    } else {
      console.log('  No leaderboard data to migrate');
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Verify data in Railway dashboard');
    console.log('2. Update package.json start script to use server-postgres.js');
    console.log('3. Deploy to Railway');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});

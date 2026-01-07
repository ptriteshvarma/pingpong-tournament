// Initialize database tables
// Run this once: DATABASE_URL=your_db_url node init-db.js

const { Pool } = require('pg');
const fs = require('fs');

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  console.error('Usage: DATABASE_URL=postgresql://... node init-db.js');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDatabase() {
  console.log('Initializing database...\n');

  const client = await pool.connect();

  try {
    // Read and execute schema
    const schema = fs.readFileSync('schema.sql', 'utf8');

    console.log('Creating tables...');
    await client.query(schema);

    console.log('✓ Tables created successfully!');
    console.log('\nDatabase is ready to use.');

  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

initDatabase().catch(err => {
  console.error(err);
  process.exit(1);
});

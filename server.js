const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

// Disable SSL certificate validation for Supabase/Vercel
// This is necessary because Vercel's serverless environment has issues with Supabase's SSL certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Determine the correct public folder path for Vercel serverless environment
const PUBLIC_DIR = process.env.VERCEL
  ? path.join(process.cwd(), 'public')
  : path.join(__dirname, 'public');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Username';

// Security warning for production
if (ADMIN_PASSWORD === 'Username' && process.env.NODE_ENV === 'production') {
  console.warn('⚠️  WARNING: Using default admin password in production! Set ADMIN_PASSWORD environment variable.');
}

// VAPID keys for Web Push - lazy loaded to avoid build issues
let webpush = null;
let VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
let VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:pingpong@example.com';

// Initialize web-push lazily (after server starts, not during build)
function initWebPush() {
  if (webpush) return webpush;

  try {
    webpush = require('web-push');

    // Generate VAPID keys if not set (for development only)
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.log('WARNING: VAPID keys not set in environment. Generating temporary keys.');
      console.log('For production, set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars.');
      const vapidKeys = webpush.generateVAPIDKeys();
      VAPID_PUBLIC_KEY = vapidKeys.publicKey;
      VAPID_PRIVATE_KEY = vapidKeys.privateKey;
      console.log('VAPID_PUBLIC_KEY=' + VAPID_PUBLIC_KEY);
      console.log('VAPID_PRIVATE_KEY=' + VAPID_PRIVATE_KEY);
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    console.log('Web Push initialized successfully');
  } catch (err) {
    console.error('Failed to initialize web-push:', err.message);
    webpush = null;
  }

  return webpush;
}

// PostgreSQL connection
// Use POSTGRES_PRISMA_URL for Vercel/Supabase (has pgbouncer), fallback to POSTGRES_URL
const connectionString = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;

const pool = new Pool({
  connectionString: connectionString,
  // Don't use SSL config - let pg library handle it from connection string
  connectionTimeoutMillis: 15000, // 15 second timeout for connection (Vercel cold starts need more time)
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  max: 10, // Maximum 10 connections in pool
  statement_timeout: 10000 // 10 second query timeout
});

// Auto-initialize database tables on startup
async function initDatabase() {
  const fs = require('fs');
  try {
    // Check if tables exist
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'players'
      );
    `);

    if (!result.rows[0].exists) {
      console.log('Initializing database tables...');
      const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
      await pool.query(schema);
      console.log('✓ Database tables created successfully!');
    } else {
      console.log('✓ Database tables already exist');

      // Migration: Add avatar column if it doesn't exist
      try {
        const avatarCol = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'players' AND column_name = 'avatar'
          );
        `);
        if (!avatarCol.rows[0].exists) {
          await pool.query('ALTER TABLE players ADD COLUMN avatar VARCHAR(50) DEFAULT NULL');
          console.log('✓ Added avatar column to players table');
        }
      } catch (migrationErr) {
        console.log('Migration check failed (non-critical):', migrationErr.message);
      }

      // Migration: Add reminded column to table_bookings if it doesn't exist
      try {
        const remindedCol = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'table_bookings' AND column_name = 'reminded'
          );
        `);
        if (!remindedCol.rows[0].exists) {
          await pool.query('ALTER TABLE table_bookings ADD COLUMN reminded BOOLEAN DEFAULT FALSE');
          console.log('✓ Added reminded column to table_bookings table');
        }
      } catch (migrationErr) {
        console.log('Migration check failed (non-critical):', migrationErr.message);
      }

      // Migration: Create push_subscriptions table if it doesn't exist
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS push_subscriptions (
            id SERIAL PRIMARY KEY,
            player_name VARCHAR(255),
            endpoint TEXT UNIQUE NOT NULL,
            p256dh VARCHAR(255) NOT NULL,
            auth VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await pool.query('CREATE INDEX IF NOT EXISTS idx_push_subscriptions_player ON push_subscriptions(player_name)');
        console.log('✓ Push subscriptions table ready');
      } catch (migrationErr) {
        console.log('Push subscriptions migration (non-critical):', migrationErr.message);
      }
    }

    // Test connection
    const timeResult = await pool.query('SELECT NOW()');
    console.log('✓ Database connected:', timeResult.rows[0].now);
  } catch (err) {
    console.error('❌ Database initialization error:', err);
    throw err;
  }
}

// Database backup table (Vercel-compatible - no filesystem writes)
const ensureBackupTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS database_backups (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      backup_data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_backups_created ON database_backups(created_at DESC)');
};

// Daily backup system (Vercel-compatible - stores in database)
async function createBackup() {
  try {
    console.log('Creating database backup...');

    // Ensure backup table exists
    await ensureBackupTable();

    // Get all data from all tables (dynamically fetch all tables)
    const tables = ['players', 'matches', 'bracket_meta', 'availability', 'leaderboard',
                    'table_bookings', 'season', 'season_archive', 'activity_log',
                    'league_registration', 'league_config', 'push_subscriptions',
                    'notifications', 'season_snapshots'];

    const backup = {
      timestamp: new Date().toISOString(),
      tables: {}
    };

    for (const table of tables) {
      try {
        // Skip backing up the backup table itself
        if (table === 'database_backups') continue;

        const result = await pool.query(`SELECT * FROM ${table}`);
        backup.tables[table] = result.rows;
      } catch (e) {
        console.log(`  ⚠️  Skipped ${table}: ${e.message}`);
        backup.tables[table] = [];
      }
    }

    // Create backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `backup-${timestamp}.json`;

    // Store backup in database (not filesystem - Vercel compatible!)
    await pool.query(`
      INSERT INTO database_backups (filename, backup_data)
      VALUES ($1, $2)
    `, [filename, JSON.stringify(backup)]);

    // Keep only last 7 backups
    await pool.query(`
      DELETE FROM database_backups
      WHERE id NOT IN (
        SELECT id FROM database_backups
        ORDER BY created_at DESC
        LIMIT 7
      )
    `);

    console.log(`✓ Backup created in database: ${filename}`);
    return filename;
  } catch (err) {
    console.error('❌ Backup error:', err);
    throw err;
  }
}

// Schedule daily backups at midnight (DISABLED for Vercel - uses cron jobs instead)
function scheduleDailyBackups() {
  // NOTE: On Vercel, this is handled by Vercel Cron Jobs (see vercel.json)
  // setInterval/setTimeout don't work reliably in serverless environments
  if (process.env.VERCEL) {
    console.log('✓ Running on Vercel - backups handled by Vercel Cron Jobs');
    return;
  }

  // For local development only
  const now = new Date();
  const night = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1, // next day
    0, 0, 0 // midnight
  );
  const msToMidnight = night.getTime() - now.getTime();

  // Schedule first backup at next midnight
  setTimeout(() => {
    createBackup();
    // Then run every 24 hours
    setInterval(createBackup, 24 * 60 * 60 * 1000);
  }, msToMidnight);

  console.log(`✓ Daily backups scheduled (next backup at midnight)`);
}

initDatabase()
  .then(() => {
    // Create initial backup on startup (except on Vercel - handled by cron)
    if (!process.env.VERCEL) {
      createBackup();
      scheduleDailyBackups();
    } else {
      console.log('✓ Vercel environment detected - skipping initial backup');
    }
  })
  .catch((err) => {
    console.error('❌ Database initialization error:', err.message);
    console.log('⚠️  Server will continue - tables will be created on first request');
    // Don't crash - tables will be created by ensure* functions on first API call
  });

// Middleware
app.use(compression()); // Enable gzip compression for all responses
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Debug logging for Vercel
if (process.env.VERCEL) {
  console.log('PUBLIC_DIR:', PUBLIC_DIR);
  const fs = require('fs');
  const publicExists = fs.existsSync(PUBLIC_DIR);
  console.log('Public folder exists:', publicExists);
  if (publicExists) {
    const files = fs.readdirSync(PUBLIC_DIR);
    console.log('Files in public:', files);
  }
}

// Serve hashed assets with long cache (filename changes on rebuild)
app.use('/assets', express.static(path.join(PUBLIC_DIR, 'assets'), {
  maxAge: '1y',
  immutable: true
}));

// Serve all other static files (index.html, manifest.json, etc.) with no-cache
// so browsers always get the latest version pointing to correct hashed assets
app.use(express.static(PUBLIC_DIR, {
  maxAge: 0,
  etag: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// Cache middleware for API responses
const cacheResponse = (seconds) => (req, res, next) => {
  res.set('Cache-Control', `public, max-age=${seconds}`);
  next();
};

// Check if request is from Vercel Cron
const isVercelCron = (req) => {
  // Vercel cron jobs send these headers
  return req.headers['user-agent']?.includes('vercel-cron') ||
         req.headers['x-vercel-cron'] === '1';
};

// Admin authentication middleware
const requireAdmin = (req, res, next) => {
  const password = req.headers['x-admin-password'];
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized. Invalid admin password.' });
  }
  next();
};

// Admin OR Vercel Cron authentication (for scheduled tasks)
const requireAdminOrCron = (req, res, next) => {
  // Allow Vercel cron jobs OR admin password
  if (isVercelCron(req)) {
    return next();
  }

  const password = req.headers['x-admin-password'];
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized. Invalid admin password or cron job.' });
  }
  next();
};

// Bracket generation logic
const getBracketSize = (playerCount) => {
  if (playerCount <= 2) return 2;
  if (playerCount <= 4) return 4;
  if (playerCount <= 8) return 8;
  if (playerCount <= 16) return 16;
  if (playerCount <= 32) return 32;
  return 64;
};

// Generate standard bracket seeding positions
const generateSeedPositions = (bracketSize) => {
  if (bracketSize === 2) return [[1, 2]];
  if (bracketSize === 4) return [[1, 4], [2, 3]];
  if (bracketSize === 8) return [[1, 8], [4, 5], [2, 7], [3, 6]];
  if (bracketSize === 16) {
    return [[1, 16], [8, 9], [4, 13], [5, 12], [2, 15], [7, 10], [3, 14], [6, 11]];
  }
  if (bracketSize === 32) {
    return [
      [1, 32], [16, 17], [8, 25], [9, 24], [4, 29], [13, 20], [5, 28], [12, 21],
      [2, 31], [15, 18], [7, 26], [10, 23], [3, 30], [14, 19], [6, 27], [11, 22]
    ];
  }
  // 64 bracket
  return [
    [1, 64], [32, 33], [16, 49], [17, 48], [8, 57], [25, 40], [9, 56], [24, 41],
    [4, 61], [29, 36], [13, 52], [20, 45], [5, 60], [28, 37], [12, 53], [21, 44],
    [2, 63], [31, 34], [15, 50], [18, 47], [7, 58], [26, 39], [10, 55], [23, 42],
    [3, 62], [30, 35], [14, 51], [19, 46], [6, 59], [27, 38], [11, 54], [22, 43]
  ];
};

// Generate double elimination bracket
const generateBracket = (players) => {
  const playerCount = players.length;
  if (playerCount < 2) {
    return { error: 'Need at least 2 players' };
  }

  const bracketSize = getBracketSize(playerCount);
  const numByes = bracketSize - playerCount;
  const numRounds = Math.log2(bracketSize);

  // Assign seeds to players
  const seededPlayers = [...players].sort((a, b) => {
    if (a.seed !== null && b.seed !== null) return a.seed - b.seed;
    if (a.seed !== null) return -1;
    if (b.seed !== null) return 1;
    return 0;
  });

  // Assign seeds to unseeded players
  let nextSeed = 1;
  const playerSeeds = seededPlayers.map(p => {
    if (p.seed !== null) {
      nextSeed = Math.max(nextSeed, p.seed + 1);
      return { ...p };
    }
    while (seededPlayers.some(sp => sp.seed === nextSeed)) nextSeed++;
    return { ...p, seed: nextSeed++ };
  });

  // Sort by final seed
  playerSeeds.sort((a, b) => a.seed - b.seed);

  // Create seed to player mapping (seeds beyond player count are BYEs)
  const seedMap = {};
  playerSeeds.forEach(p => {
    seedMap[p.seed] = p.name;
  });

  // Generate upper bracket matches
  const seedPositions = generateSeedPositions(bracketSize);
  const upperBracket = [];
  const lowerBracket = [];

  // Upper Bracket Round 1
  const ubRound1 = [];
  seedPositions.forEach((pair, idx) => {
    const [seed1, seed2] = pair;
    const player1 = seedMap[seed1] || null;
    const player2 = seedMap[seed2] || null;
    const isBye = !player1 || !player2;

    ubRound1.push({
      id: `UB-R1-M${idx + 1}`,
      round: 1,
      matchNumber: idx + 1,
      player1: player1,
      player2: player2,
      seed1: seed1,
      seed2: seed2,
      winner: isBye ? (player1 || player2) : null,
      loser: null,
      score1: null,
      score2: null,
      completed: isBye,
      isBye: isBye,
      lockedDate: null,
      lockedTime: null
    });
  });
  upperBracket.push(ubRound1);

  // Generate remaining upper bracket rounds
  let prevRoundMatches = ubRound1.length;
  for (let round = 2; round <= numRounds; round++) {
    const roundMatches = [];
    const numMatches = Math.floor(prevRoundMatches / 2);
    for (let i = 0; i < numMatches; i++) {
      roundMatches.push({
        id: `UB-R${round}-M${i + 1}`,
        round: round,
        matchNumber: i + 1,
        player1: null,
        player2: null,
        winner: null,
        loser: null,
        score1: null,
        score2: null,
        completed: false,
        isBye: false,
        lockedDate: null,
        lockedTime: null,
        feedsFrom: [`UB-R${round-1}-M${i * 2 + 1}`, `UB-R${round-1}-M${i * 2 + 2}`]
      });
    }
    upperBracket.push(roundMatches);
    prevRoundMatches = numMatches;
  }

  // Generate lower bracket
  const lowerRounds = 2 * (numRounds - 1);
  let lbMatchCount = bracketSize / 4;

  for (let lbRound = 1; lbRound <= lowerRounds; lbRound++) {
    const roundMatches = [];
    const isDropInRound = lbRound % 2 === 0;

    if (lbRound === 1) {
      for (let i = 0; i < lbMatchCount; i++) {
        roundMatches.push({
          id: `LB-R${lbRound}-M${i + 1}`,
          round: lbRound,
          matchNumber: i + 1,
          player1: null,
          player2: null,
          winner: null,
          loser: null,
          score1: null,
          score2: null,
          completed: false,
          isBye: false,
          lockedDate: null,
          lockedTime: null,
          feedsFromLosers: [`UB-R1-M${i * 2 + 1}`, `UB-R1-M${i * 2 + 2}`]
        });
      }
    } else if (isDropInRound) {
      const ubDropRound = Math.floor(lbRound / 2) + 1;
      for (let i = 0; i < lbMatchCount; i++) {
        roundMatches.push({
          id: `LB-R${lbRound}-M${i + 1}`,
          round: lbRound,
          matchNumber: i + 1,
          player1: null,
          player2: null,
          winner: null,
          loser: null,
          score1: null,
          score2: null,
          completed: false,
          isBye: false,
          lockedDate: null,
          lockedTime: null,
          feedsFrom: [`LB-R${lbRound-1}-M${i + 1}`],
          feedsFromLosers: [`UB-R${ubDropRound}-M${i + 1}`]
        });
      }
    } else {
      const newMatchCount = Math.floor(lbMatchCount / 2);
      for (let i = 0; i < newMatchCount; i++) {
        roundMatches.push({
          id: `LB-R${lbRound}-M${i + 1}`,
          round: lbRound,
          matchNumber: i + 1,
          player1: null,
          player2: null,
          winner: null,
          loser: null,
          score1: null,
          score2: null,
          completed: false,
          isBye: false,
          lockedDate: null,
          lockedTime: null,
          feedsFrom: [`LB-R${lbRound-1}-M${i * 2 + 1}`, `LB-R${lbRound-1}-M${i * 2 + 2}`]
        });
      }
      lbMatchCount = newMatchCount;
    }

    if (roundMatches.length > 0) {
      lowerBracket.push(roundMatches);
    }
  }

  // Grand Final
  const grandFinal = {
    id: 'GF-1',
    round: 1,
    player1: null,
    player2: null,
    winner: null,
    loser: null,
    score1: null,
    score2: null,
    completed: false,
    lockedDate: null,
    lockedTime: null
  };

  // Bracket Reset
  const bracketReset = {
    id: 'GF-RESET',
    round: 2,
    player1: null,
    player2: null,
    winner: null,
    loser: null,
    score1: null,
    score2: null,
    completed: false,
    needed: false,
    lockedDate: null,
    lockedTime: null
  };

  const bracket = {
    bracketSize,
    playerCount,
    numRounds,
    upperBracket,
    lowerBracket,
    grandFinal,
    bracketReset,
    champion: null,
    generatedAt: new Date().toISOString()
  };

  // Auto-advance bye matches
  propagateByes(bracket);

  return bracket;
};

// Propagate bye winners through the bracket
const propagateByes = (bracket) => {
  const ubR1 = bracket.upperBracket[0];
  ubR1.forEach(match => {
    if (match.isBye && match.winner) {
      advanceWinner(bracket, match.id, match.winner);
    }
  });
};

// Advance winner to next match
const advanceWinner = (bracket, matchId, winner) => {
  for (const round of bracket.upperBracket) {
    for (const match of round) {
      if (match.feedsFrom && match.feedsFrom.includes(matchId)) {
        const feedIndex = match.feedsFrom.indexOf(matchId);
        if (feedIndex === 0) {
          match.player1 = winner;
        } else {
          match.player2 = winner;
        }
        if (match.player1 && !match.player2) {
          const otherMatchId = match.feedsFrom[1];
          const otherMatch = findMatch(bracket, otherMatchId);
          if (otherMatch && otherMatch.isBye && otherMatch.winner) {
            match.player2 = otherMatch.winner;
          }
        } else if (match.player2 && !match.player1) {
          const otherMatchId = match.feedsFrom[0];
          const otherMatch = findMatch(bracket, otherMatchId);
          if (otherMatch && otherMatch.isBye && otherMatch.winner) {
            match.player1 = otherMatch.winner;
          }
        }
      }
    }
  }
};

// Find a match by ID
const findMatch = (bracket, matchId) => {
  for (const round of bracket.upperBracket) {
    for (const match of round) {
      if (match.id === matchId) return match;
    }
  }
  for (const round of bracket.lowerBracket) {
    for (const match of round) {
      if (match.id === matchId) return match;
    }
  }
  if (bracket.grandFinal.id === matchId) return bracket.grandFinal;
  if (bracket.bracketReset.id === matchId) return bracket.bracketReset;
  return null;
};

// Database helper functions
const saveBracketToDB = async (bracket) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Delete existing matches and metadata
    await client.query('DELETE FROM matches');
    await client.query('DELETE FROM bracket_meta');

    // Save bracket metadata
    await client.query(
      'INSERT INTO bracket_meta (bracket_size, player_count, num_rounds) VALUES ($1, $2, $3)',
      [bracket.bracketSize, bracket.playerCount, bracket.numRounds]
    );

    // Save all matches
    const saveMatch = async (match, roundType) => {
      await client.query(
        `INSERT INTO matches (id, round_type, round_number, match_number, player1, player2,
         winner, loser, score1, score2, is_bye, status, scheduled_time)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          match.id, roundType, match.round, match.matchNumber || 0,
          match.player1, match.player2, match.winner, match.loser,
          match.score1, match.score2, match.isBye || false,
          match.completed ? 'completed' : 'pending',
          match.lockedDate && match.lockedTime ? `${match.lockedDate} ${match.lockedTime}` : null
        ]
      );
    };

    // Save upper bracket
    for (const round of bracket.upperBracket) {
      for (const match of round) {
        await saveMatch(match, 'upper');
      }
    }

    // Save lower bracket
    for (const round of bracket.lowerBracket) {
      for (const match of round) {
        await saveMatch(match, 'lower');
      }
    }

    // Save grand final
    await saveMatch(bracket.grandFinal, 'grand');

    // Save bracket reset
    if (bracket.bracketReset.needed) {
      await saveMatch(bracket.bracketReset, 'reset');
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

const loadBracketFromDB = async () => {
  try {
    // Get metadata
    const metaResult = await pool.query('SELECT * FROM bracket_meta WHERE id = 1');
    if (metaResult.rows.length === 0) return null;

    const meta = metaResult.rows[0];

    // Get all matches
    const matchesResult = await pool.query('SELECT * FROM matches ORDER BY round_type, round_number, match_number');

    const upperBracket = [];
    const lowerBracket = [];
    let grandFinal = null;
    let bracketReset = null;

    // Organize matches into bracket structure
    const upperMatches = matchesResult.rows.filter(m => m.round_type === 'upper');
    const lowerMatches = matchesResult.rows.filter(m => m.round_type === 'lower');

    // Group upper bracket by round
    const maxUpperRound = Math.max(...upperMatches.map(m => m.round_number));
    for (let r = 1; r <= maxUpperRound; r++) {
      const roundMatches = upperMatches
        .filter(m => m.round_number === r)
        .map(m => ({
          id: m.id,
          round: m.round_number,
          matchNumber: m.match_number,
          player1: m.player1,
          player2: m.player2,
          winner: m.winner,
          loser: m.loser,
          score1: m.score1,
          score2: m.score2,
          completed: m.status === 'completed',
          isBye: m.is_bye,
          lockedDate: null,
          lockedTime: null
        }));
      upperBracket.push(roundMatches);
    }

    // Group lower bracket by round
    if (lowerMatches.length > 0) {
      const maxLowerRound = Math.max(...lowerMatches.map(m => m.round_number));
      for (let r = 1; r <= maxLowerRound; r++) {
        const roundMatches = lowerMatches
          .filter(m => m.round_number === r)
          .map(m => ({
            id: m.id,
            round: m.round_number,
            matchNumber: m.match_number,
            player1: m.player1,
            player2: m.player2,
            winner: m.winner,
            loser: m.loser,
            score1: m.score1,
            score2: m.score2,
            completed: m.status === 'completed',
            isBye: m.is_bye,
            lockedDate: null,
            lockedTime: null
          }));
        lowerBracket.push(roundMatches);
      }
    }

    // Get grand final and reset
    const gfMatch = matchesResult.rows.find(m => m.round_type === 'grand');
    if (gfMatch) {
      grandFinal = {
        id: gfMatch.id,
        round: gfMatch.round_number,
        player1: gfMatch.player1,
        player2: gfMatch.player2,
        winner: gfMatch.winner,
        loser: gfMatch.loser,
        score1: gfMatch.score1,
        score2: gfMatch.score2,
        completed: gfMatch.status === 'completed',
        lockedDate: null,
        lockedTime: null
      };
    }

    const resetMatch = matchesResult.rows.find(m => m.round_type === 'reset');
    if (resetMatch) {
      bracketReset = {
        id: resetMatch.id,
        round: resetMatch.round_number,
        player1: resetMatch.player1,
        player2: resetMatch.player2,
        winner: resetMatch.winner,
        loser: resetMatch.loser,
        score1: resetMatch.score1,
        score2: resetMatch.score2,
        completed: resetMatch.status === 'completed',
        needed: true,
        lockedDate: null,
        lockedTime: null
      };
    } else {
      bracketReset = {
        id: 'GF-RESET',
        round: 2,
        player1: null,
        player2: null,
        winner: null,
        loser: null,
        score1: null,
        score2: null,
        completed: false,
        needed: false,
        lockedDate: null,
        lockedTime: null
      };
    }

    return {
      bracketSize: meta.bracket_size,
      playerCount: meta.player_count,
      numRounds: meta.num_rounds,
      upperBracket,
      lowerBracket,
      grandFinal,
      bracketReset,
      champion: null,
      generatedAt: meta.created_at.toISOString()
    };
  } catch (e) {
    console.error('Error loading bracket from DB:', e);
    return null;
  }
};

// ============== LEAGUE SEASON SYSTEM ==============

// Generate partial round robin schedule with limited games per player
const generatePartialRoundRobinSchedule = (players, gamesPerPlayer) => {
  const n = players.length;
  const matches = [];

  // Calculate max possible games in full round-robin (each plays everyone once)
  const maxPossibleGames = n - 1;

  // If requested games >= max possible, just do full round-robin
  if (gamesPerPlayer >= maxPossibleGames) {
    return generateRoundRobinSchedule(players, false);
  }

  // Generate all possible matchups
  const allMatchups = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      allMatchups.push({
        player1: players[i].name,
        player2: players[j].name
      });
    }
  }

  // Shuffle matchups for fairness
  for (let i = allMatchups.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allMatchups[i], allMatchups[j]] = [allMatchups[j], allMatchups[i]];
  }

  // Track games per player
  const playerGames = {};
  players.forEach(p => playerGames[p.name] = 0);

  // Greedy selection: add matches where both players have capacity
  for (const matchup of allMatchups) {
    const p1 = matchup.player1;
    const p2 = matchup.player2;

    if (playerGames[p1] < gamesPerPlayer && playerGames[p2] < gamesPerPlayer) {
      matches.push(matchup);
      playerGames[p1]++;
      playerGames[p2]++;
    }

    // Stop if everyone has their games
    if (Object.values(playerGames).every(g => g >= gamesPerPlayer)) {
      break;
    }
  }

  // Fill remaining slots if some players need more games
  // This ensures everyone gets exactly gamesPerPlayer (or as close as possible)
  for (const matchup of allMatchups) {
    const p1 = matchup.player1;
    const p2 = matchup.player2;

    // Check if this matchup already exists
    const exists = matches.some(m =>
      (m.player1 === p1 && m.player2 === p2) ||
      (m.player1 === p2 && m.player2 === p1)
    );

    if (!exists && playerGames[p1] < gamesPerPlayer && playerGames[p2] < gamesPerPlayer) {
      matches.push(matchup);
      playerGames[p1]++;
      playerGames[p2]++;
    }
  }

  console.log(`📊 Partial round-robin for ${n} players: ${gamesPerPlayer} games each`);
  console.log(`   Generated ${matches.length} matches`);
  Object.entries(playerGames).forEach(([name, games]) => {
    if (games !== gamesPerPlayer) {
      console.warn(`   ⚠️  ${name}: ${games} games (target: ${gamesPerPlayer})`);
    }
  });

  return matches;
};

// Generate round robin schedule for a group
const generateRoundRobinSchedule = (players, doubleRoundRobin = true) => {
  const n = players.length;
  const matches = [];

  const playerList = [...players];
  if (n % 2 === 1) {
    playerList.push({ name: 'BYE', isBye: true });
  }

  const numPlayers = playerList.length;
  const numRounds = numPlayers - 1;
  const halfSize = Math.floor(numPlayers / 2);

  const playerIndices = playerList.map((_, i) => i);
  const fixedPlayer = playerIndices.shift();

  for (let round = 0; round < numRounds; round++) {
    const roundMatches = [];
    const p1Index = fixedPlayer;
    const p2Index = playerIndices[0];

    // Add first match (fixed player vs first rotating player)
    if (!playerList[p1Index].isBye && !playerList[p2Index].isBye &&
        playerList[p1Index].name !== playerList[p2Index].name) {
      roundMatches.push({
        player1: playerList[p1Index].name,
        player2: playerList[p2Index].name
      });
    }

    for (let i = 1; i < halfSize; i++) {
      const p1 = playerIndices[i];
      const p2 = playerIndices[numPlayers - 2 - i];

      // Prevent self-matches and bye matches
      if (!playerList[p1].isBye && !playerList[p2].isBye &&
          playerList[p1].name !== playerList[p2].name) {
        roundMatches.push({
          player1: playerList[p1].name,
          player2: playerList[p2].name
        });
      }
    }

    matches.push(...roundMatches);
    playerIndices.push(playerIndices.shift());
  }

  if (doubleRoundRobin) {
    const reverseMatches = matches.map(m => ({
      player1: m.player2,
      player2: m.player1
    }));
    matches.push(...reverseMatches);
  }

  return matches;
};

// Distribute matches across weeks (2 games per player per week)
const distributeMatchesToWeeks = (matches, players, numWeeks) => {
  const weeks = Array.from({ length: numWeeks }, () => []);
  const playerGamesPerWeek = {};

  players.forEach(p => {
    playerGamesPerWeek[p.name] = Array(numWeeks).fill(0);
  });

  const unassigned = [...matches];

  for (let week = 0; week < numWeeks && unassigned.length > 0; week++) {
    const toRemove = [];

    for (let i = 0; i < unassigned.length; i++) {
      const match = unassigned[i];
      const p1Games = playerGamesPerWeek[match.player1][week];
      const p2Games = playerGamesPerWeek[match.player2][week];

      if (p1Games < 2 && p2Games < 2) {
        weeks[week].push({
          ...match,
          id: `W${week + 1}-M${weeks[week].length + 1}`,
          week: week + 1,
          completed: false,
          winner: null,
          loser: null,
          score1: null,
          score2: null
        });

        playerGamesPerWeek[match.player1][week]++;
        playerGamesPerWeek[match.player2][week]++;
        toRemove.push(i);
      }
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      unassigned.splice(toRemove[i], 1);
    }
  }

  while (unassigned.length > 0) {
    const match = unassigned.shift();
    let bestWeek = numWeeks - 1;
    for (let w = 0; w < numWeeks; w++) {
      if (playerGamesPerWeek[match.player1][w] < 2 && playerGamesPerWeek[match.player2][w] < 2) {
        bestWeek = w;
        break;
      }
    }
    weeks[bestWeek].push({
      ...match,
      id: `W${bestWeek + 1}-M${weeks[bestWeek].length + 1}`,
      week: bestWeek + 1,
      completed: false,
      winner: null,
      loser: null,
      score1: null,
      score2: null
    });
  }

  return weeks;
};

// Validate match distribution fairness
const validateMatchDistribution = (schedule, players, numWeeks, groupName) => {
  const gamesPerPlayer = {};
  players.forEach(p => gamesPerPlayer[p.name] = 0);

  // Count total games per player
  schedule.forEach(week => {
    week.forEach(match => {
      if (!match.cancelled) {
        if (gamesPerPlayer[match.player1] !== undefined) gamesPerPlayer[match.player1]++;
        if (gamesPerPlayer[match.player2] !== undefined) gamesPerPlayer[match.player2]++;
      }
    });
  });

  const gameCounts = Object.values(gamesPerPlayer);
  const minGames = Math.min(...gameCounts);
  const maxGames = Math.max(...gameCounts);
  const avgGames = gameCounts.reduce((a, b) => a + b, 0) / gameCounts.length;

  const isFair = (maxGames - minGames) <= 2;

  if (!isFair) {
    console.warn(`⚠️  Group ${groupName} match distribution unfair: ${minGames}-${maxGames} games per player (avg: ${avgGames.toFixed(1)})`);
  }

  return {
    fair: isFair,
    minGames,
    maxGames,
    avgGames: parseFloat(avgGames.toFixed(1)),
    variance: maxGames - minGames,
    gamesPerPlayer
  };
};

// Helper function to calculate mid-season review week
const getMidSeasonWeek = (totalWeeks) => {
  // Mid-season review happens at week 3 of regular season
  // (before playoffs/qualifiers which happen in the final weeks)
  return 3;
};

// Generate complete season
const generateSeason = (groupA, groupB, numWeeks = 10, options = {}) => {
  const { gamesPerPlayerA, gamesPerPlayerB } = options;

  // Determine scheduling strategy for each group
  let groupAMatches, groupBMatches;

  if (gamesPerPlayerA && gamesPerPlayerA < (groupA.length - 1)) {
    // Partial round-robin for Group A
    groupAMatches = generatePartialRoundRobinSchedule(groupA, gamesPerPlayerA);
  } else {
    // Full round-robin for Group A (everyone plays everyone once)
    groupAMatches = generateRoundRobinSchedule(groupA, false);
  }

  if (gamesPerPlayerB && gamesPerPlayerB < (groupB.length - 1)) {
    // Partial round-robin for Group B
    groupBMatches = generatePartialRoundRobinSchedule(groupB, gamesPerPlayerB);
  } else {
    // Full round-robin for Group B (everyone plays everyone once)
    groupBMatches = generateRoundRobinSchedule(groupB, false);
  }

  const groupAWeeks = distributeMatchesToWeeks(groupAMatches, groupA, numWeeks);
  const groupBWeeks = distributeMatchesToWeeks(groupBMatches, groupB, numWeeks);

  groupAWeeks.forEach((week, wi) => {
    week.forEach((match, mi) => {
      match.id = `A-W${wi + 1}-M${mi + 1}`;
      match.group = 'A';
    });
  });

  groupBWeeks.forEach((week, wi) => {
    week.forEach((match, mi) => {
      match.id = `B-W${wi + 1}-M${mi + 1}`;
      match.group = 'B';
    });
  });

  const standings = { A: {}, B: {} };

  groupA.forEach(p => {
    standings.A[p.name] = {
      wins: 0, losses: 0, points: 0,
      pointsFor: 0, pointsAgainst: 0,
      streak: 0, lastResults: [],
      headToHead: {}, // Track head-to-head record vs each opponent
      initialSeed: p.seed || null // Save initial seed for tiebreaker
    };
  });

  groupB.forEach(p => {
    standings.B[p.name] = {
      wins: 0, losses: 0, points: 0,
      pointsFor: 0, pointsAgainst: 0,
      streak: 0, lastResults: [],
      headToHead: {}, // Track head-to-head record vs each opponent
      initialSeed: p.seed || null // Save initial seed for tiebreaker
    };
  });

  return {
    name: 'Season 1',
    status: 'regular',
    currentWeek: 1,
    totalWeeks: numWeeks,
    groups: {
      A: { name: 'Seeded', players: groupA },
      B: { name: 'Unseeded', players: groupB }
    },
    schedule: { A: groupAWeeks, B: groupBWeeks },
    standings,
    playoffs: null,
    superBowl: null,
    champion: null,
    createdAt: new Date().toISOString()
  };
};

// Sort standings by tiebreaker rules (handles multi-way ties correctly)
// Order: Wins → Fewest Losses → H2H (among tied) → Point Diff → Seed
const sortStandings = (standings) => {
  const players = Object.entries(standings)
    .map(([name, stats]) => ({ name, ...stats }));

  // Group players by (wins, losses) to identify true ties
  const recordGroups = {};
  players.forEach(p => {
    const key = `${p.wins}-${p.losses}`;
    if (!recordGroups[key]) recordGroups[key] = [];
    recordGroups[key].push(p);
  });

  // Sort record groups: most wins first, then fewest losses
  const sortedKeys = Object.keys(recordGroups).sort((a, b) => {
    const [winsA, lossesA] = a.split('-').map(Number);
    const [winsB, lossesB] = b.split('-').map(Number);
    if (winsB !== winsA) return winsB - winsA;
    return lossesA - lossesB;
  });

  // Sort within each record group using h2h → point diff → seed
  const sortedPlayers = [];
  sortedKeys.forEach(key => {
    const group = recordGroups[key];

    if (group.length === 1) {
      sortedPlayers.push(group[0]);
    } else if (group.length === 2) {
      // 2-way tie: use direct head-to-head, then point diff, then seed
      group.sort((a, b) => {
        const h2hA = a.headToHead?.[b.name];
        const h2hB = b.headToHead?.[a.name];
        if (h2hA && h2hB) {
          const h2hDiff = (h2hA.wins - h2hA.losses) - (h2hB.wins - h2hB.losses);
          if (h2hDiff !== 0) return -h2hDiff;
        }
        const diffA = (a.pointsFor || 0) - (a.pointsAgainst || 0);
        const diffB = (b.pointsFor || 0) - (b.pointsAgainst || 0);
        if (diffB !== diffA) return diffB - diffA;
        const seedA = a.initialSeed || 9999;
        const seedB = b.initialSeed || 9999;
        return seedA - seedB;
      });
      sortedPlayers.push(...group);
    } else {
      // 3+ way tie: use h2h record against TIED players only, then point diff, then seed
      group.sort((a, b) => {
        let h2hWinsA = 0, h2hLossesA = 0;
        let h2hWinsB = 0, h2hLossesB = 0;

        group.forEach(opponent => {
          if (opponent.name !== a.name && a.headToHead?.[opponent.name]) {
            h2hWinsA += a.headToHead[opponent.name].wins || 0;
            h2hLossesA += a.headToHead[opponent.name].losses || 0;
          }
          if (opponent.name !== b.name && b.headToHead?.[opponent.name]) {
            h2hWinsB += b.headToHead[opponent.name].wins || 0;
            h2hLossesB += b.headToHead[opponent.name].losses || 0;
          }
        });

        const h2hDiffA = h2hWinsA - h2hLossesA;
        const h2hDiffB = h2hWinsB - h2hLossesB;
        if (h2hDiffB !== h2hDiffA) {
          console.log(`[TIEBREAK] ${a.name} h2h diff: ${h2hDiffA}, ${b.name} h2h diff: ${h2hDiffB}`);
          return h2hDiffB - h2hDiffA;
        }

        const diffA = (a.pointsFor || 0) - (a.pointsAgainst || 0);
        const diffB = (b.pointsFor || 0) - (b.pointsAgainst || 0);
        if (diffB !== diffA) {
          console.log(`[TIEBREAK] ${a.name} point diff: ${diffA}, ${b.name} point diff: ${diffB}`);
          return diffB - diffA;
        }

        const seedA = a.initialSeed || 9999;
        const seedB = b.initialSeed || 9999;
        console.log(`[TIEBREAK] ${a.name} seed: ${seedA}, ${b.name} seed: ${seedB}`);
        return seedA - seedB;
      });
      sortedPlayers.push(...group);
    }
  });

  return sortedPlayers;
};

// Generate competitive schedule: pair players by rank proximity (strong vs strong)
// Returns array of { player1, player2 } matches
// gamesPerPlayer can be a number (same for all) or an object { playerName: count }
const generateCompetitiveSchedule = (playerNames, standings, gamesPerPlayer, existingMatchups) => {
  // Sort players by standings to get rankings
  const standingsObj = {};
  playerNames.forEach(name => {
    standingsObj[name] = standings[name] || { wins: 0, losses: 0, points: 0, headToHead: {}, pointsFor: 0, pointsAgainst: 0 };
  });
  const sorted = sortStandings(standingsObj);
  const rankedNames = sorted.map(p => p.name);
  const n = rankedNames.length;

  // Per-player target: either uniform or variable
  const targetFor = (name) => typeof gamesPerPlayer === 'number' ? gamesPerPlayer : (gamesPerPlayer[name] || 0);

  // Build all possible pairs with scores
  const allPairs = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const key = [rankedNames[i], rankedNames[j]].sort().join('|');
      allPairs.push({
        p1: rankedNames[i], p2: rankedNames[j], key,
        rankDiff: Math.abs(i - j),
        firstHalf: existingMatchups.has(key)
      });
    }
  }

  // Phase 1: Select from NEW pairs only (not played in first half), prefer close ranks
  const newPairs = allPairs.filter(p => !p.firstHalf).sort((a, b) => a.rankDiff - b.rankDiff);
  const rematchPairs = allPairs.filter(p => p.firstHalf).sort((a, b) => a.rankDiff - b.rankDiff);

  const playerGameCount = {};
  rankedNames.forEach(p => { playerGameCount[p] = 0; });
  const selected = [];
  const usedKeys = new Set();

  // Helper: try to add a pair
  const tryAdd = (pair) => {
    if (usedKeys.has(pair.key)) return false;
    if (playerGameCount[pair.p1] >= targetFor(pair.p1) || playerGameCount[pair.p2] >= targetFor(pair.p2)) return false;
    usedKeys.add(pair.key);
    selected.push({ player1: pair.p1, player2: pair.p2 });
    playerGameCount[pair.p1]++;
    playerGameCount[pair.p2]++;
    return true;
  };

  // Phase 1a: Greedily select new pairs, prioritizing players furthest from target
  let changed = true;
  while (changed) {
    changed = false;
    const available = newPairs.filter(p => !usedKeys.has(p.key) &&
      playerGameCount[p.p1] < targetFor(p.p1) && playerGameCount[p.p2] < targetFor(p.p2));
    available.sort((a, b) => {
      // Remaining games needed (higher = more urgent)
      const aRemain = Math.max(targetFor(a.p1) - playerGameCount[a.p1], targetFor(a.p2) - playerGameCount[a.p2]);
      const bRemain = Math.max(targetFor(b.p1) - playerGameCount[b.p1], targetFor(b.p2) - playerGameCount[b.p2]);
      if (aRemain !== bRemain) return bRemain - aRemain; // Prioritize most games needed
      const aMin = Math.min(playerGameCount[a.p1], playerGameCount[a.p2]);
      const bMin = Math.min(playerGameCount[b.p1], playerGameCount[b.p2]);
      if (aMin !== bMin) return aMin - bMin;
      return a.rankDiff - b.rankDiff;
    });
    for (const pair of available) {
      if (tryAdd(pair)) { changed = true; break; }
    }
  }

  // Phase 2: Fill remaining with first-half rematch pairs (competitive order)
  changed = true;
  while (changed) {
    changed = false;
    const available = rematchPairs.filter(p => !usedKeys.has(p.key) &&
      playerGameCount[p.p1] < targetFor(p.p1) && playerGameCount[p.p2] < targetFor(p.p2));
    available.sort((a, b) => {
      const aRemain = Math.max(targetFor(a.p1) - playerGameCount[a.p1], targetFor(a.p2) - playerGameCount[a.p2]);
      const bRemain = Math.max(targetFor(b.p1) - playerGameCount[b.p1], targetFor(b.p2) - playerGameCount[b.p2]);
      if (aRemain !== bRemain) return bRemain - aRemain;
      return a.rankDiff - b.rankDiff;
    });
    for (const pair of available) {
      if (tryAdd(pair)) { changed = true; break; }
    }
  }

  // Phase 3: If still short, allow duplicate POST pairs (absolute last resort)
  const underPlayers = rankedNames.filter(p => playerGameCount[p] < targetFor(p));
  for (const player of underPlayers) {
    while (playerGameCount[player] < targetFor(player)) {
      let bestOpp = null, bestScore = Infinity;
      for (const opp of rankedNames) {
        if (opp === player || playerGameCount[opp] >= targetFor(opp)) continue;
        const rankDiff = Math.abs(rankedNames.indexOf(player) - rankedNames.indexOf(opp));
        const score = rankDiff * 10 + playerGameCount[opp];
        if (score < bestScore) { bestScore = score; bestOpp = opp; }
      }
      if (bestOpp) {
        selected.push({ player1: player, player2: bestOpp });
        playerGameCount[player]++;
        playerGameCount[bestOpp]++;
      } else {
        break;
      }
    }
  }

  return selected;
};

// Distribute matches across weeks, max 2 games per player per week
const distributeMatchesToWeekRange = (matches, startWeek, endWeek, group) => {
  const numWeeks = endWeek - startWeek + 1;
  const playerGamesPerWeek = {};
  const result = [];
  let matchNum = 1;

  for (const match of matches) {
    let placed = false;
    for (let w = startWeek; w <= endWeek; w++) {
      const p1key = match.player1 + '-' + w;
      const p2key = match.player2 + '-' + w;
      const p1g = playerGamesPerWeek[p1key] || 0;
      const p2g = playerGamesPerWeek[p2key] || 0;
      if (p1g < 2 && p2g < 2) {
        result.push({
          id: `${group}-W${w}-POST-M${matchNum}`,
          week: w,
          group,
          player1: match.player1,
          player2: match.player2,
          score1: null,
          score2: null,
          winner: null,
          loser: null,
          completed: false
        });
        playerGamesPerWeek[p1key] = p1g + 1;
        playerGamesPerWeek[p2key] = p2g + 1;
        matchNum++;
        placed = true;
        break;
      }
    }
    if (!placed) {
      // Force into last week as fallback
      result.push({
        id: `${group}-W${endWeek}-POST-M${matchNum}`,
        week: endWeek,
        group,
        player1: match.player1,
        player2: match.player2,
        score1: null,
        score2: null,
        winner: null,
        loser: null,
        completed: false
      });
      matchNum++;
    }
  }

  return result;
};

// Build set of already-played matchups from completed games in standings
const getCompletedMatchups = (standings) => {
  const matchups = new Set();
  Object.entries(standings).forEach(([name, stats]) => {
    if (stats.headToHead) {
      Object.keys(stats.headToHead).forEach(opp => {
        const key = [name, opp].sort().join('|');
        matchups.add(key);
      });
    }
  });
  return matchups;
};

// Generate wildcard round: Group A #5-6 vs Group B #5-6
// Middle-ranked players from each group compete for wildcard playoff spots
const generateWildcardRound = (standingsA, standingsB) => {
  const sortedA = sortStandings(standingsA);
  const sortedB = sortStandings(standingsB);

  // Position 5 and 6 from each group (index 4 and 5)
  const midA = sortedA.slice(4, 6);
  const midB = sortedB.slice(4, 6);

  const matches = [];

  // WC-1: Group A #5 vs Group B #5
  if (midA[0] && midB[0] && midA[0].name !== midB[0].name) {
    matches.push({
      id: 'WC-1',
      round: 'wildcard',
      description: `Group A #5 (${midA[0].name}) vs Group B #5 (${midB[0].name})`,
      player1: midA[0].name,
      player1Group: 'A',
      player1Rank: 5,
      player2: midB[0].name,
      player2Group: 'B',
      player2Rank: 5,
      winner: null, loser: null, score1: null, score2: null, completed: false,
      stakes: 'Winner earns wildcard to their own group playoffs as 5th seed'
    });
  }

  // WC-2: Group A #6 vs Group B #6
  if (midA[1] && midB[1] && midA[1].name !== midB[1].name) {
    matches.push({
      id: 'WC-2',
      round: 'wildcard',
      description: `Group A #6 (${midA[1].name}) vs Group B #6 (${midB[1].name})`,
      player1: midA[1].name,
      player1Group: 'A',
      player1Rank: 6,
      player2: midB[1].name,
      player2Group: 'B',
      player2Rank: 6,
      winner: null, loser: null, score1: null, score2: null, completed: false,
      stakes: 'Winner earns wildcard to their own group playoffs as 5th seed'
    });
  }

  return {
    matches,
    wildcardWinners: [], // Will hold winners who advance to their own group playoffs
    rules: [
      'Group A #5 vs Group B #5, Group A #6 vs Group B #6',
      'Winner earns wildcard spot in their OWN group playoffs',
      'Wildcards enter as 5th seed (face #4 in play-in, winner faces #1)',
      'Cross-group matches test true skill level'
    ]
  };
};

// Generate combined championship bracket - Top 4 from each group (8 players total)
// Format: Standard 8-player bracket with cross-group seeding
// QF1: A#1 vs B#4, QF2: B#2 vs A#3, QF3: A#2 vs B#3, QF4: B#1 vs A#4
// SF1: QF1 winner vs QF2 winner, SF2: QF3 winner vs QF4 winner
// Final: SF1 winner vs SF2 winner
const generateChampionshipBracket = (standingsA, standingsB, wildcardWinnerA = null, wildcardWinnerB = null, wildcardMatches = null) => {
  const sortedA = sortStandings(standingsA);
  const sortedB = sortStandings(standingsB);

  // Validate minimum players for championship bracket
  if (sortedA.length < 4 || sortedB.length < 4) {
    console.warn(`Championship bracket requires 4+ players per group. A: ${sortedA.length}, B: ${sortedB.length}`);
    // Return a reduced bracket or null if not enough players
    if (sortedA.length < 2 || sortedB.length < 2) {
      return null; // Cannot generate any meaningful bracket
    }
  }

  // Top 4 from each group (with fallback to null for missing players)
  const a1 = { name: sortedA[0]?.name || null, group: 'A', seed: 1 };
  const a2 = { name: sortedA[1]?.name || null, group: 'A', seed: 2 };
  const a3 = { name: sortedA[2]?.name || null, group: 'A', seed: 3 };
  const a4 = { name: sortedA[3]?.name || null, group: 'A', seed: 4 };
  const b1 = { name: sortedB[0]?.name || null, group: 'B', seed: 1 };
  const b2 = { name: sortedB[1]?.name || null, group: 'B', seed: 2 };
  const b3 = { name: sortedB[2]?.name || null, group: 'B', seed: 3 };
  const b4 = { name: sortedB[3]?.name || null, group: 'B', seed: 4 };

  // VALIDATION: Ensure no player appears in both groups
  const allSeeds = [a1.name, a2.name, a3.name, a4.name, b1.name, b2.name, b3.name, b4.name].filter(Boolean);
  const duplicates = allSeeds.filter((p, i) => allSeeds.indexOf(p) !== i);
  if (duplicates.length > 0) {
    console.error('ERROR: Duplicate players in bracket seeding!', duplicates);
    console.log('Group A (sorted, top 4):');
    sortedA.slice(0, 4).forEach((p, i) => {
      const diff = (p.pointsFor || 0) - (p.pointsAgainst || 0);
      console.log(`  A${i+1}: ${p.name} (${p.wins}-${p.losses}, diff: ${diff})`);
    });
    console.log('Group B (sorted, top 4):');
    sortedB.slice(0, 4).forEach((p, i) => {
      const diff = (p.pointsFor || 0) - (p.pointsAgainst || 0);
      console.log(`  B${i+1}: ${p.name} (${p.wins}-${p.losses}, diff: ${diff})`);
    });
  }

  // Always build WC matches from #5/#6 seeds (use existing matches if provided, else build from standings)
  const a5 = sortedA[4] || null;
  const a6 = sortedA[5] || null;
  const b5 = sortedB[4] || null;
  const b6 = sortedB[5] || null;

  let builtWildcardMatches = wildcardMatches;
  if (!builtWildcardMatches) {
    builtWildcardMatches = [];
    if (a5 && b5) {
      builtWildcardMatches.push({
        id: 'WC-1', round: 'wildcard',
        matchName: 'Wildcard 1',
        player1: a5.name, player1Group: 'A', seed1: 'A#5',
        player2: b5.name, player2Group: 'B', seed2: 'B#5',
        winner: null, loser: null, score1: null, score2: null, completed: false
      });
    }
    if (a6 && b6) {
      builtWildcardMatches.push({
        id: 'WC-2', round: 'wildcard',
        matchName: 'Wildcard 2',
        player1: a6.name, player1Group: 'A', seed1: 'A#6',
        player2: b6.name, player2Group: 'B', seed2: 'B#6',
        winner: null, loser: null, score1: null, score2: null, completed: false
      });
    }
  }

  // Always build play-in games: #4 seed vs WC winner (TBD if not played yet)
  const playInGames = [];
  let finalA4 = a4, finalB4 = b4;

  if (a4.name) {
    playInGames.push({
      id: 'PLAYIN-A', round: 'playin',
      matchName: 'Play-In: Group A',
      player1: a4.name, seed1: 'A#4', player1Group: 'A',
      player2: wildcardWinnerA || null, seed2: 'WC', player2Group: 'A',
      group: 'A',
      winner: null, loser: null, score1: null, score2: null, completed: false
    });
    if (wildcardWinnerA) finalA4 = a4; // QF4 player2 stays TBD until play-in done
  }

  if (b4.name) {
    playInGames.push({
      id: 'PLAYIN-B', round: 'playin',
      matchName: 'Play-In: Group B',
      player1: b4.name, seed1: 'B#4', player1Group: 'B',
      player2: wildcardWinnerB || null, seed2: 'WC', player2Group: 'B',
      group: 'B',
      winner: null, loser: null, score1: null, score2: null, completed: false
    });
    if (wildcardWinnerB) finalB4 = b4;
  }

  return {
    format: 'combined',
    description: 'Top 4 from each group compete for championship',
    seeds: { a1, a2, a3, a4: finalA4, b1, b2, b3, b4: finalB4 },
    wildcardMatches: builtWildcardMatches.length > 0 ? builtWildcardMatches : null,
    playInGames: playInGames.length > 0 ? playInGames : null,
    // Quarterfinals: Cross-group matchups with traditional seeding
    // #1 seeds face #4 from other group, #2 seeds face #3 from other group
    // If play-in games exist, QF opponents are TBD until play-in completes
    quarterfinals: [
      {
        id: 'CHAMP-QF1',
        round: 'quarterfinal',
        matchNum: 1,
        matchName: 'Quarterfinal 1',
        player1: a1.name,
        player2: playInGames.find(p => p.group === 'B') ? null : finalB4.name, // TBD if play-in exists
        player1Group: 'A',
        player2Group: 'B',
        seed1: 'A#1',
        seed2: playInGames.find(p => p.group === 'B') ? 'PLAYIN-B Winner' : (finalB4.isWildcard ? 'B#WC' : 'B#4'),
        advancesTo: 'SF1',
        feedsFromPlayIn: playInGames.find(p => p.group === 'B') ? 'PLAYIN-B' : null,
        winner: null, loser: null, score1: null, score2: null, completed: false
      },
      {
        id: 'CHAMP-QF2',
        round: 'quarterfinal',
        matchNum: 2,
        matchName: 'Quarterfinal 2',
        player1: b2.name,
        player2: a3.name,
        player1Group: 'B',
        player2Group: 'A',
        seed1: 'B#2',
        seed2: 'A#3',
        advancesTo: 'SF1',
        winner: null, loser: null, score1: null, score2: null, completed: false
      },
      {
        id: 'CHAMP-QF3',
        round: 'quarterfinal',
        matchNum: 3,
        matchName: 'Quarterfinal 3',
        player1: a2.name,
        player2: b3.name,
        player1Group: 'A',
        player2Group: 'B',
        seed1: 'A#2',
        seed2: 'B#3',
        advancesTo: 'SF2',
        winner: null, loser: null, score1: null, score2: null, completed: false
      },
      {
        id: 'CHAMP-QF4',
        round: 'quarterfinal',
        matchNum: 4,
        matchName: 'Quarterfinal 4',
        player1: b1.name,
        player2: playInGames.find(p => p.group === 'A') ? null : finalA4.name, // TBD if play-in exists
        player1Group: 'B',
        player2Group: 'A',
        seed1: 'B#1',
        seed2: playInGames.find(p => p.group === 'A') ? 'PLAYIN-A Winner' : (finalA4.isWildcard ? 'A#WC' : 'A#4'),
        advancesTo: 'SF2',
        feedsFromPlayIn: playInGames.find(p => p.group === 'A') ? 'PLAYIN-A' : null,
        winner: null, loser: null, score1: null, score2: null, completed: false
      }
    ],
    // Semifinals: QF winners face off
    semifinals: [
      {
        id: 'CHAMP-SF1',
        round: 'semifinal',
        matchNum: 1,
        matchName: 'Semifinal 1',
        player1: null, // QF1 winner
        player2: null, // QF2 winner
        player1Group: null,
        player2Group: null,
        seed1: 'QF1 Winner',
        seed2: 'QF2 Winner',
        feedsFrom: ['CHAMP-QF1', 'CHAMP-QF2'],
        winner: null, loser: null, score1: null, score2: null, completed: false
      },
      {
        id: 'CHAMP-SF2',
        round: 'semifinal',
        matchNum: 2,
        matchName: 'Semifinal 2',
        player1: null, // QF3 winner
        player2: null, // QF4 winner
        player1Group: null,
        player2Group: null,
        seed1: 'QF3 Winner',
        seed2: 'QF4 Winner',
        feedsFrom: ['CHAMP-QF3', 'CHAMP-QF4'],
        winner: null, loser: null, score1: null, score2: null, completed: false
      }
    ],
    final: {
      id: 'CHAMP-FINAL',
      round: 'final',
      matchName: 'Championship Final',
      player1: null,
      player2: null,
      feedsFrom: ['CHAMP-SF1', 'CHAMP-SF2'],
      winner: null, loser: null, score1: null, score2: null, completed: false
    },
    champion: null
  };
};

// Alias for backward compatibility - generatePlayoffBracket now uses combined championship format
const generatePlayoffBracket = (standings, group, wildcardWinner = null) => {
  // This function is deprecated - we now use generateChampionshipBracket for combined playoffs
  // But keep for compatibility with old code paths
  const sorted = sortStandings(standings);

  // Return a simplified group playoff bracket
  return {
    group,
    semifinals: [
      {
        id: `${group}-SF1`,
        round: 'semifinal',
        player1: sorted[0]?.name,
        player2: wildcardWinner || sorted[3]?.name,
        seed1: 1,
        seed2: wildcardWinner ? 'WC' : 4,
        winner: null, loser: null, score1: null, score2: null, completed: false
      },
      {
        id: `${group}-SF2`,
        round: 'semifinal',
        player1: sorted[1]?.name,
        player2: sorted[2]?.name,
        seed1: 2,
        seed2: 3,
        winner: null, loser: null, score1: null, score2: null, completed: false
      }
    ],
    final: {
      id: `${group}-FINAL`,
      round: 'final',
      player1: null,
      player2: null,
      winner: null, loser: null, score1: null, score2: null, completed: false
    },
    champion: null
  };
};

const updateLeaderboard = async (winner, loser) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if we need to reset weekly stats
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (now.getDay() === 0 ? -6 : 1 - now.getDay()));
    monday.setHours(0, 0, 0, 0);

    // Initialize players if they don't exist
    for (const player of [winner, loser]) {
      const existing = await client.query('SELECT * FROM leaderboard WHERE player_name = $1', [player]);
      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO leaderboard (player_name, week_start) VALUES ($1, $2)`,
          [player, monday]
        );
      } else {
        // Check if we need to reset weekly stats
        const playerData = existing.rows[0];
        const weekStart = playerData.week_start ? new Date(playerData.week_start) : null;
        if (!weekStart || weekStart < monday) {
          await client.query(
            `UPDATE leaderboard SET
             weekly_wins = 0, weekly_losses = 0, weekly_points = 0, weekly_matches_played = 0,
             week_start = $1
             WHERE player_name = $2`,
            [monday, player]
          );
        }
      }
    }

    // Update winner stats (2 points)
    await client.query(
      `UPDATE leaderboard SET
       weekly_wins = weekly_wins + 1,
       weekly_points = weekly_points + 2,
       weekly_matches_played = weekly_matches_played + 1,
       alltime_wins = alltime_wins + 1,
       alltime_points = alltime_points + 2,
       alltime_matches_played = alltime_matches_played + 1,
       updated_at = CURRENT_TIMESTAMP
       WHERE player_name = $1`,
      [winner]
    );

    // Update loser stats (1 point)
    await client.query(
      `UPDATE leaderboard SET
       weekly_losses = weekly_losses + 1,
       weekly_points = weekly_points + 1,
       weekly_matches_played = weekly_matches_played + 1,
       alltime_losses = alltime_losses + 1,
       alltime_points = alltime_points + 1,
       alltime_matches_played = alltime_matches_played + 1,
       updated_at = CURRENT_TIMESTAMP
       WHERE player_name = $1`,
      [loser]
    );

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

// ============== API Routes ==============

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// Get players
app.get('/api/players', cacheResponse(30), async (req, res) => {
  try {
    const result = await pool.query('SELECT name, seed, avatar FROM players ORDER BY seed NULLS LAST, name');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Self-registration for new players (no admin required)
app.post('/api/players/register', async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters' });
    }

    const cleanName = name.trim();

    // Check if player already exists
    const existing = await pool.query(
      'SELECT id, name, seed FROM players WHERE LOWER(name) = LOWER($1)',
      [cleanName]
    );

    if (existing.rows.length > 0) {
      // Player already exists - return success with friendly message
      const player = existing.rows[0];

      // Log the re-registration attempt
      await pool.query(
        `INSERT INTO activity_log (event_type, player_name, details) VALUES ($1, $2, $3)`,
        ['player_re_registered', cleanName, JSON.stringify({ email: email || null, alreadyExists: true, registeredAt: new Date().toISOString() })]
      );

      return res.json({
        success: true,
        player: player,
        alreadyRegistered: true,
        message: player.seed
          ? `Welcome back ${cleanName}! You're already registered with seed #${player.seed}. You'll be included in upcoming seasons.`
          : `Welcome back ${cleanName}! You're already registered. You'll be included in upcoming seasons.`
      });
    }

    // Add new player (no seed - they'll be in Group B)
    const result = await pool.query(
      'INSERT INTO players (name) VALUES ($1) RETURNING *',
      [cleanName]
    );

    // Log the registration
    await pool.query(
      `INSERT INTO activity_log (event_type, player_name, details) VALUES ($1, $2, $3)`,
      ['player_registered', cleanName, JSON.stringify({ email: email || null, registeredAt: new Date().toISOString() })]
    );

    res.json({
      success: true,
      player: result.rows[0],
      message: `Welcome ${cleanName}! You've been registered. You'll be added to Group B (Unseeded) when the next season starts.`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add/update players (admin only)
app.post('/api/players', requireAdmin, async (req, res) => {
  try {
    const players = req.body;
    if (!Array.isArray(players)) {
      return res.status(400).json({ error: 'Players must be an array' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Clear existing players
      await client.query('DELETE FROM players');

      // Insert new players
      for (const player of players) {
        await client.query(
          'INSERT INTO players (name, seed) VALUES ($1, $2)',
          [player.name, player.seed]
        );
      }

      await client.query('COMMIT');

      // Auto-regenerate bracket
      if (players.length >= 2) {
        const bracket = generateBracket(players);
        await saveBracketToDB(bracket);
      }

      res.json({ success: true, playerCount: players.length });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update player seed (admin only)
app.put('/api/players/:name/seed', requireAdmin, async (req, res) => {
  try {
    const { name } = req.params;
    const { seed } = req.body;

    const result = await pool.query(
      'UPDATE players SET seed = $1 WHERE name = $2 RETURNING *',
      [seed === null || seed === '' ? null : parseInt(seed), name]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    await pool.query(
      `INSERT INTO activity_log (event_type, player_name, details) VALUES ($1, $2, $3)`,
      ['seed_updated', name, JSON.stringify({ newSeed: seed })]
    );

    res.json({ success: true, player: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update player avatar (no admin required - players can set their own)
app.put('/api/players/:name/avatar', async (req, res) => {
  try {
    const { name } = req.params;
    const { avatar } = req.body;

    // Validate avatar (allow emoji or short string max 10 chars)
    if (avatar && avatar.length > 10) {
      return res.status(400).json({ error: 'Avatar must be 10 characters or less' });
    }

    const result = await pool.query(
      'UPDATE players SET avatar = $1 WHERE name = $2 RETURNING *',
      [avatar || null, name]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json({ success: true, player: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete player (admin only)
app.delete('/api/players/:name', requireAdmin, async (req, res) => {
  try {
    const { name } = req.params;

    const result = await pool.query(
      'DELETE FROM players WHERE name = $1 RETURNING *',
      [name]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Also remove from registration if exists
    await pool.query('DELETE FROM league_registration WHERE player_name = $1', [name]);

    await pool.query(
      `INSERT INTO activity_log (event_type, player_name, details) VALUES ($1, $2, $3)`,
      ['player_deleted', name, JSON.stringify({ deletedAt: new Date().toISOString() })]
    );

    res.json({ success: true, deleted: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get bracket
app.get('/api/bracket', async (req, res) => {
  try {
    const bracket = await loadBracketFromDB();
    res.json(bracket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update bracket (for match results)
app.post('/api/bracket', async (req, res) => {
  try {
    const bracket = req.body;
    await saveBracketToDB(bracket);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate bracket (admin only)
app.post('/api/bracket/generate', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT name, seed FROM players ORDER BY seed NULLS LAST, name');
    const players = result.rows;

    if (players.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 players to generate bracket' });
    }

    const bracket = generateBracket(players);
    if (bracket.error) {
      return res.status(400).json({ error: bracket.error });
    }

    await saveBracketToDB(bracket);
    res.json({ success: true, bracket });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Record match result
app.post('/api/bracket/match', async (req, res) => {
  try {
    const { matchId, winner, loser, score1, score2 } = req.body;
    const bracket = await loadBracketFromDB();

    if (!bracket) {
      return res.status(400).json({ error: 'No bracket exists' });
    }

    const match = findMatch(bracket, matchId);
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Validate scores are non-negative integers
    if (!Number.isInteger(score1) || !Number.isInteger(score2) || score1 < 0 || score2 < 0) {
      return res.status(400).json({ error: 'Scores must be non-negative integers' });
    }

    // Validate score ceiling (max 11 points per game)
    if (score1 > 11 || score2 > 11) {
      return res.status(400).json({ error: 'Scores cannot exceed 11 points' });
    }

    // Winner's score must be higher than loser's score
    const winnerScore = winner === match.player1 ? score1 : score2;
    const loserScore = winner === match.player1 ? score2 : score1;
    if (winnerScore <= loserScore) {
      return res.status(400).json({ error: 'Winner must have a higher score than loser' });
    }

    match.winner = winner;
    match.loser = loser;
    match.score1 = score1;
    match.score2 = score2;
    match.completed = true;

    // Update leaderboard
    await updateLeaderboard(winner, loser);

    // Save updated bracket
    await saveBracketToDB(bracket);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM leaderboard');

    const players = {};
    result.rows.forEach(row => {
      players[row.player_name] = {
        weekly: {
          wins: row.weekly_wins,
          losses: row.weekly_losses,
          points: row.weekly_points,
          matchesPlayed: row.weekly_matches_played
        },
        allTime: {
          wins: row.alltime_wins,
          losses: row.alltime_losses,
          points: row.alltime_points,
          matchesPlayed: row.alltime_matches_played
        }
      };
    });

    const weekStart = result.rows.length > 0 && result.rows[0].week_start
      ? result.rows[0].week_start.toISOString().split('T')[0]
      : null;

    res.json({ players, weekStart });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset weekly leaderboard (admin only)
app.post('/api/leaderboard/reset-weekly', requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (now.getDay() === 0 ? -6 : 1 - now.getDay()));
    monday.setHours(0, 0, 0, 0);

    await pool.query(
      `UPDATE leaderboard SET
       weekly_wins = 0, weekly_losses = 0, weekly_points = 0, weekly_matches_played = 0,
       week_start = $1`,
      [monday]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ BACKUP ENDPOINTS ============

// Create manual backup (admin OR Vercel cron)
app.post('/api/backup/create', requireAdminOrCron, async (req, res) => {
  try {
    const filename = await createBackup();
    res.json({ success: true, filename, message: 'Backup created in database' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List all backups (admin only)
app.get('/api/backup/list', requireAdmin, async (req, res) => {
  try {
    await ensureBackupTable();
    const result = await pool.query(`
      SELECT id, filename, created_at,
             pg_size_pretty(pg_column_size(backup_data)) as size
      FROM database_backups
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download a specific backup (admin only)
app.get('/api/backup/download/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT filename, backup_data, created_at FROM database_backups WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    const backup = result.rows[0];
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${backup.filename}"`);
    res.send(JSON.stringify(JSON.parse(backup.backup_data), null, 2));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Restore from backup (admin only)
app.post('/api/backup/restore/:id', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    // Get the backup
    const backupResult = await client.query(
      'SELECT backup_data, filename FROM database_backups WHERE id = $1',
      [id]
    );

    if (backupResult.rows.length === 0) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    const backup = JSON.parse(backupResult.rows[0].backup_data);

    await client.query('BEGIN');

    // WARNING: This will delete ALL data and restore from backup
    console.warn('⚠️  Restoring from backup - ALL DATA WILL BE REPLACED');

    // Clear all tables in reverse dependency order
    const tablesToClear = [
      'notifications', 'push_subscriptions', 'activity_log', 'season_archive',
      'season', 'table_bookings', 'leaderboard', 'availability', 'bracket_meta',
      'matches', 'league_registration', 'league_config', 'players'
    ];

    for (const table of tablesToClear) {
      try {
        await client.query(`TRUNCATE ${table} RESTART IDENTITY CASCADE`);
      } catch (e) {
        console.log(`  ⚠️  Skipped clearing ${table}: ${e.message}`);
      }
    }

    // Restore data from backup
    let restoredTables = 0;
    for (const [tableName, rows] of Object.entries(backup.tables)) {
      if (!rows || rows.length === 0) continue;

      try {
        // Get column names from first row
        const columns = Object.keys(rows[0]);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

        for (const row of rows) {
          const values = columns.map(col => row[col]);
          await client.query(
            `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
            values
          );
        }

        console.log(`✓ Restored ${rows.length} rows to ${tableName}`);
        restoredTables++;
      } catch (e) {
        console.error(`✗ Failed to restore ${tableName}: ${e.message}`);
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      restored: backup.timestamp,
      tablesRestored: restoredTables,
      message: 'Database restored from backup successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Get config (using environment variables or defaults)
app.get('/api/config', (req, res) => {
  const config = {
    tournamentName: process.env.TOURNAMENT_NAME || 'Ping Pong Tournament',
    timeSlotDuration: parseInt(process.env.TIME_SLOT_DURATION || '20'),
    startTime: process.env.START_TIME || '08:00',
    endTime: process.env.END_TIME || '17:00'
  };
  res.json(config);
});

// Get availability
app.get('/api/availability', async (req, res) => {
  try {
    // Disable caching to always fetch fresh data
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    await ensureAvailabilityTable();
    const result = await pool.query('SELECT * FROM availability');

    const availability = {};
    result.rows.forEach(row => {
      if (!availability[row.player_name]) {
        availability[row.player_name] = {};
      }
      if (!availability[row.player_name][row.date]) {
        availability[row.player_name][row.date] = [];
      }
      availability[row.player_name][row.date].push(row.time_slot);
    });

    res.json(availability);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save availability
app.post('/api/availability', async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureAvailabilityTable();
    await client.query('BEGIN');

    const availability = req.body;

    // Get all players from the request
    const players = Object.keys(availability);

    // Delete existing availability for these players
    if (players.length > 0) {
      await client.query('DELETE FROM availability WHERE player_name = ANY($1)', [players]);
    }

    // Insert new availability
    for (const [playerName, dates] of Object.entries(availability)) {
      for (const [date, timeSlots] of Object.entries(dates)) {
        for (const timeSlot of timeSlots) {
          await client.query(
            'INSERT INTO availability (player_name, date, time_slot) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [playerName, date, timeSlot]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ============== TABLE BOOKING SYSTEM ==============

// Ensure availability table exists
const ensureAvailabilityTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS availability (
      id SERIAL PRIMARY KEY,
      player_name VARCHAR(255) NOT NULL,
      date DATE NOT NULL,
      time_slot VARCHAR(10) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(player_name, date, time_slot)
    )
  `);
};

// Ensure table_bookings table exists
const ensureBookingsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS table_bookings (
      id SERIAL PRIMARY KEY,
      match_id VARCHAR(100),
      player1 VARCHAR(255) NOT NULL,
      player2 VARCHAR(255) NOT NULL,
      booking_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      group_name VARCHAR(10),
      status VARCHAR(20) DEFAULT 'booked',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by VARCHAR(255)
    )
  `);
  // Drop old UNIQUE constraint if it exists (from previous schema version)
  await pool.query(`
    ALTER TABLE table_bookings DROP CONSTRAINT IF EXISTS table_bookings_booking_date_start_time_key
  `);
  // Create partial unique index: only one ACTIVE booking per time slot (allows cancelled slots to be rebooked)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_active_bookings
    ON table_bookings(booking_date, start_time)
    WHERE status != 'cancelled'
  `);
};

// Get bookings for a date range
app.get('/api/bookings', async (req, res) => {
  try {
    await ensureBookingsTable();
    const { start_date, end_date } = req.query;

    let query = 'SELECT * FROM table_bookings WHERE status != $1';
    let params = ['cancelled'];

    if (start_date && end_date) {
      query += ' AND booking_date BETWEEN $2 AND $3';
      params.push(start_date, end_date);
    } else if (start_date) {
      query += ' AND booking_date >= $2';
      params.push(start_date);
    }

    query += ' ORDER BY booking_date, start_time';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get available time slots for a date
app.get('/api/bookings/available', async (req, res) => {
  try {
    await ensureBookingsTable();
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'Date required' });
    }

    // Get existing bookings for the date
    const bookings = await pool.query(
      'SELECT start_time, end_time FROM table_bookings WHERE booking_date = $1 AND status != $2',
      [date, 'cancelled']
    );

    // Generate all possible slots (9 AM to 5 PM, 30 min slots)
    const allSlots = [];
    for (let hour = 9; hour < 17; hour++) {
      allSlots.push(`${hour.toString().padStart(2, '0')}:00`);
      allSlots.push(`${hour.toString().padStart(2, '0')}:30`);
    }

    // Filter out booked slots
    const bookedTimes = bookings.rows.map(b => b.start_time.substring(0, 5));
    const available = allSlots.filter(slot => !bookedTimes.includes(slot));

    res.json({ date, available, booked: bookedTimes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper: Check if player is in swap zone
const getPlayerSwapZoneStatus = async (playerName) => {
  try {
    const result = await pool.query('SELECT data FROM season WHERE id = 1');
    if (result.rows.length === 0) return null;

    const season = result.rows[0].data;
    const midPoint = getMidSeasonWeek(season.totalWeeks);

    // Only check during first half of regular season
    if (season.status !== 'regular' || season.currentWeek >= midPoint || season.midSeasonReview?.completed) {
      return null;
    }

    const sortedA = sortStandings(season.standings.A);
    const sortedB = sortStandings(season.standings.B);

    // Check if player is in relegation zone (bottom 3 of A)
    const relegationNames = sortedA.slice(-3).map(p => p.name);
    if (relegationNames.includes(playerName)) {
      const rank = sortedA.findIndex(p => p.name === playerName) + 1;
      return {
        zone: 'RELEGATION',
        group: 'A',
        rank,
        message: `In relegation zone (#${rank} in Group A) - may swap to Group B at mid-season!`,
        weeksRemaining: midPoint - season.currentWeek
      };
    }

    // Check if player is in promotion zone (top 3 of B)
    const promotionNames = sortedB.slice(0, 3).map(p => p.name);
    if (promotionNames.includes(playerName)) {
      const rank = sortedB.findIndex(p => p.name === playerName) + 1;
      return {
        zone: 'PROMOTION',
        group: 'B',
        rank,
        message: `In promotion zone (#${rank} in Group B) - may move to Group A at mid-season!`,
        weeksRemaining: midPoint - season.currentWeek
      };
    }

    return null;
  } catch (e) {
    return null;
  }
};

// Create a booking
app.post('/api/bookings', async (req, res) => {
  try {
    await ensureBookingsTable();
    const { match_id, player1, player2, booking_date, start_time, group_name, created_by } = req.body;

    if (!player1 || !player2 || !booking_date || !start_time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if either player is in swap zone
    const p1SwapStatus = await getPlayerSwapZoneStatus(player1);
    const p2SwapStatus = await getPlayerSwapZoneStatus(player2);
    const swapZoneWarning = p1SwapStatus || p2SwapStatus;

    // Get season info for game-based mid-season check
    const seasonResult = await pool.query('SELECT data FROM season WHERE id = 1');
    const season = seasonResult.rows[0]?.data;
    const midSeasonCompleted = season?.midSeasonReview?.completed || false;

    // NEW: Game-based booking limit (4 games before mid-season swap)
    // Count BOTH completed AND booked games to enforce the 4-game limit
    if (season && !midSeasonCompleted) {
      const player1Stats = season.standings?.A?.[player1] || season.standings?.B?.[player1];
      const player2Stats = season.standings?.A?.[player2] || season.standings?.B?.[player2];

      const player1Completed = player1Stats ? (player1Stats.wins + player1Stats.losses) : 0;
      const player2Completed = player2Stats ? (player2Stats.wins + player2Stats.losses) : 0;

      // Count active booked games (not yet completed) for each player
      // Only count future/today bookings to avoid double-counting games already recorded in standings
      const player1BookedResult = await pool.query(
        `SELECT COUNT(*) FROM table_bookings
         WHERE (player1 = $1 OR player2 = $1)
         AND status IN ('booked', 'tentative')
         AND booking_date >= CURRENT_DATE`,
        [player1]
      );
      const player2BookedResult = await pool.query(
        `SELECT COUNT(*) FROM table_bookings
         WHERE (player1 = $1 OR player2 = $1)
         AND status IN ('booked', 'tentative')
         AND booking_date >= CURRENT_DATE`,
        [player2]
      );

      const player1Booked = parseInt(player1BookedResult.rows[0].count) || 0;
      const player2Booked = parseInt(player2BookedResult.rows[0].count) || 0;

      const player1TotalGames = player1Completed + player1Booked;
      const player2TotalGames = player2Completed + player2Booked;

      // Block if either player has >= 4 games (completed + booked)
      if (player1TotalGames >= 4 || player2TotalGames >= 4) {
        const blockedPlayer = player1TotalGames >= 4 ? player1 : player2;
        const blockedPlayerTotal = player1TotalGames >= 4 ? player1TotalGames : player2TotalGames;
        const blockedPlayerCompleted = player1TotalGames >= 4 ? player1Completed : player2Completed;
        const blockedPlayerBooked = player1TotalGames >= 4 ? player1Booked : player2Booked;

        return res.status(403).json({
          error: 'Bookings blocked - 4 game limit reached',
          reason: `${blockedPlayer} has ${blockedPlayerTotal} games (${blockedPlayerCompleted} completed, ${blockedPlayerBooked} booked). Players cannot book more than 4 games before the mid-season swap.`,
          blockedPlayer,
          totalGames: blockedPlayerTotal,
          completedGames: blockedPlayerCompleted,
          bookedGames: blockedPlayerBooked,
          requiresSwap: true,
          message: 'This ensures fair evaluation for the mid-season swap - players are limited to 4 games until all players complete their first 4 games and groups are reshuffled.'
        });
      }
    }

    // Calculate end time (30 min match)
    const [hours, mins] = start_time.split(':').map(Number);
    const endHours = mins >= 30 ? hours + 1 : hours;
    const endMins = mins >= 30 ? '00' : '30';
    const end_time = `${endHours.toString().padStart(2, '0')}:${endMins}`;

    // Check if slot is available
    const existing = await pool.query(
      'SELECT id FROM table_bookings WHERE booking_date = $1 AND start_time = $2 AND status != $3',
      [booking_date, start_time, 'cancelled']
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Time slot already booked' });
    }

    // Check if these two players already have an active booking together
    const duplicateBooking = await pool.query(
      `SELECT id, booking_date, start_time FROM table_bookings
       WHERE ((player1 = $1 AND player2 = $2) OR (player1 = $2 AND player2 = $1))
       AND status IN ('booked', 'tentative')`,
      [player1, player2]
    );

    if (duplicateBooking.rows.length > 0) {
      const existingBooking = duplicateBooking.rows[0];
      const existingDate = new Date(existingBooking.booking_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      return res.status(409).json({
        error: 'Duplicate booking not allowed',
        message: `${player1} vs ${player2} already have a booking on ${existingDate} at ${existingBooking.start_time}. Please complete or cancel that booking first.`
      });
    }

    // Bookings after mid-season swap no longer need tentative marking since we block them above
    const bookingWeek = getWeekNumber(booking_date);
    const isTentative = false; // Removed tentative logic - we now block entirely

    const result = await pool.query(
      `INSERT INTO table_bookings (match_id, player1, player2, booking_date, start_time, end_time, group_name, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [match_id || null, player1, player2, booking_date, start_time, end_time, group_name || null, created_by || null,
       isTentative ? 'tentative' : 'booked']
    );

    const response = { success: true, booking: result.rows[0] };
    if (swapZoneWarning) {
      response.swapZoneWarning = {
        active: true,
        players: [p1SwapStatus, p2SwapStatus].filter(Boolean),
        message: isTentative ?
          'Booking marked TENTATIVE - one or both players may change groups at mid-season swap!' :
          'Note: One or both players are in the swap zone and may change groups.'
      };
    }

    // Send notification to opponent about the booking
    const formattedDate = new Date(booking_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const opponent = created_by === player1 ? player2 : player1;
    const booker = created_by || player1;

    await createNotification(
      opponent,
      'match_scheduled',
      '📅 Match Scheduled',
      `${booker} booked a match vs you on ${formattedDate} at ${start_time}`,
      '#schedule'
    );

    res.json(response);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Time slot already booked' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Helper to get week number from date
function getWeekNumber(dateString) {
  // Simple week calculation - you might want to adjust based on season start date
  const date = new Date(dateString);
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

// Cancel a booking
app.delete('/api/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      'UPDATE table_bookings SET status = $1 WHERE id = $2',
      ['cancelled', id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Move/reschedule a booking to a new time slot
app.put('/api/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { booking_date, start_time } = req.body;

    if (!booking_date || !start_time) {
      return res.status(400).json({ error: 'New date and time are required' });
    }

    // Check if new slot is available
    const existing = await pool.query(
      'SELECT id FROM table_bookings WHERE booking_date = $1 AND start_time = $2 AND status != $3 AND id != $4',
      [booking_date, start_time, 'cancelled', id]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'New time slot is already booked' });
    }

    // Calculate end time (30 min after start)
    const [hours, mins] = start_time.split(':').map(Number);
    const endHours = mins >= 30 ? hours + 1 : hours;
    const endMins = mins >= 30 ? '00' : '30';
    const end_time = `${String(endHours).padStart(2, '0')}:${endMins}`;

    // Update the booking
    const result = await pool.query(
      'UPDATE table_bookings SET booking_date = $1, start_time = $2, end_time = $3 WHERE id = $4 AND status = $5 RETURNING *',
      [booking_date, start_time, end_time, id, 'booked']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found or already completed/cancelled' });
    }

    res.json({ success: true, booking: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark booking as completed (after recording match result)
app.post('/api/bookings/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      'UPDATE table_bookings SET status = $1 WHERE id = $2',
      ['completed', id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============== SEASON API ROUTES ==============

// Debug endpoint to see raw standings
app.get('/api/standings/debug', async (req, res) => {
  try {
    const result = await pool.query('SELECT data FROM season WHERE id = 1');
    if (result.rows.length === 0) {
      return res.json(null);
    }
    const season = result.rows[0].data;
    const groupA = Object.keys(season.standings?.A || {});
    const groupB = Object.keys(season.standings?.B || {});
    const duplicates = groupA.filter(p => groupB.includes(p));
    res.json({ groupA, groupB, duplicates, totalA: groupA.length, totalB: groupB.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current season
app.get('/api/season', cacheResponse(30), async (req, res) => {
  try {
    const result = await pool.query('SELECT data FROM season WHERE id = 1');
    if (result.rows.length === 0) {
      return res.json(null);
    }

    const season = result.rows[0].data;

    // Add rankings to standings for each group
    if (season.standings) {
      // Group A rankings
      if (season.standings.A) {
        const sortedA = sortStandings(season.standings.A);
        sortedA.forEach((player, index) => {
          season.standings.A[player.name].rank = index + 1;
        });
      }

      // Group B rankings
      if (season.standings.B) {
        const sortedB = sortStandings(season.standings.B);
        sortedB.forEach((player, index) => {
          season.standings.B[player.name].rank = index + 1;
        });
      }
    }

    // DYNAMIC BRACKET GENERATION/REGENERATION
    if (season.standings && season.standings.A && season.standings.B) {
      const bracketNeedsRegen = !season.championship ||
        (season.championship && !season.championship.quarterfinals?.some(qf => qf.completed) &&
         !season.championship.semifinals?.some(sf => sf.completed) &&
         !season.championship.final?.completed &&
         !season.championship.playInGames?.some(p => p.completed));

      if (bracketNeedsRegen) {
        // Safe to fully regenerate — no results to lose (or bracket doesn't exist yet)
        let wildcardWinnerA = null;
        let wildcardWinnerB = null;

        let wildcardMatches = [];
        if (season.wildcard) {
          if (season.wildcard.wc1?.winner) {
            const wc1Player = season.standings.A[season.wildcard.wc1.winner] ? 'A' : 'B';
            if (wc1Player === 'A') wildcardWinnerA = season.wildcard.wc1.winner;
            else wildcardWinnerB = season.wildcard.wc1.winner;
            wildcardMatches.push(season.wildcard.wc1);
          }
          if (season.wildcard.wc2?.winner) {
            const wc2Player = season.standings.A[season.wildcard.wc2.winner] ? 'A' : 'B';
            if (wc2Player === 'A') wildcardWinnerA = season.wildcard.wc2.winner;
            else wildcardWinnerB = season.wildcard.wc2.winner;
            wildcardMatches.push(season.wildcard.wc2);
          }
        }

        season.championship = generateChampionshipBracket(
          season.standings.A,
          season.standings.B,
          wildcardWinnerA,
          wildcardWinnerB,
          wildcardMatches.length > 0 ? wildcardMatches : null
        );
      }
      // If matches have been played, leave the bracket as-is (results + advancement are preserved in DB)
    }

    res.json(season);
  } catch (error) {
    // Table might not exist yet
    if (error.code === '42P01') {
      return res.json(null);
    }
    res.status(500).json({ error: error.message });
  }
});

// Create new season (admin only)
app.post('/api/season/create', requireAdmin, async (req, res) => {
  try {
    const { groupA, groupB, numWeeks = 10, seasonName = 'Season 1', gamesPerPlayerA, gamesPerPlayerB } = req.body;

    if (!groupA || !groupB) {
      return res.status(400).json({ error: 'Both groups are required' });
    }

    // MINIMUM REQUIREMENTS for full tournament features
    if (groupA.length < 6 || groupB.length < 6) {
      return res.status(400).json({
        error: 'Minimum 6 players per group required for full tournament features',
        details: {
          groupA: groupA.length,
          groupB: groupB.length,
          minimum: 6
        },
        reason: 'Need 6+ players for mid-season swap (top/bottom 3), wildcard round (#5-6), and championship bracket (top 4)'
      });
    }

    // Additional warnings for suboptimal configurations
    const warnings = [];
    if (groupA.length < 8 || groupB.length < 8) {
      warnings.push('Recommended: 8+ players per group for better schedule balance');
    }

    const season = generateSeason(groupA, groupB, numWeeks, { gamesPerPlayerA, gamesPerPlayerB });
    season.name = seasonName;

    // Validate match distribution fairness
    const fairnessA = validateMatchDistribution(season.schedule.A, groupA, numWeeks, 'A');
    const fairnessB = validateMatchDistribution(season.schedule.B, groupB, numWeeks, 'B');

    if (!fairnessA.fair) {
      warnings.push(`Group A match distribution: ${fairnessA.minGames}-${fairnessA.maxGames} games per player (variance: ${fairnessA.variance})`);
    }
    if (!fairnessB.fair) {
      warnings.push(`Group B match distribution: ${fairnessB.minGames}-${fairnessB.maxGames} games per player (variance: ${fairnessB.variance})`);
    }

    // Ensure season table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS season (
        id INTEGER PRIMARY KEY DEFAULT 1,
        name VARCHAR(255) NOT NULL DEFAULT 'Season 1',
        status VARCHAR(20) DEFAULT 'regular',
        current_week INTEGER DEFAULT 1,
        total_weeks INTEGER DEFAULT 10,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT single_season CHECK (id = 1)
      )
    `);

    // Upsert season data
    await pool.query(`
      INSERT INTO season (id, name, status, current_week, total_weeks, data)
      VALUES (1, $1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        status = EXCLUDED.status,
        current_week = EXCLUDED.current_week,
        total_weeks = EXCLUDED.total_weeks,
        data = EXCLUDED.data,
        updated_at = CURRENT_TIMESTAMP
    `, [season.name, season.status, season.currentWeek, season.totalWeeks, JSON.stringify(season)]);

    // Notify all players about season start and their Week 1 opponent
    for (const g of ['A', 'B']) {
      const week1Schedule = season.schedule[g][0];
      if (week1Schedule) {
        for (const m of week1Schedule) {
          if (m.player1 && m.player2 && !m.cancelled) {
            await createNotification(
              m.player1,
              'season_start',
              '🏓 Season Started!',
              `Week 1: You play ${m.player2} in Group ${g}. Book your match!`,
              '#schedule'
            );
            await createNotification(
              m.player2,
              'season_start',
              '🏓 Season Started!',
              `Week 1: You play ${m.player1} in Group ${g}. Book your match!`,
              '#schedule'
            );
          }
        }
      }
    }

    res.json({ success: true, season, warnings: warnings.length > 0 ? warnings : undefined });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Record a league match result
app.post('/api/season/match', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { matchId, winner, loser, score1, score2 } = req.body;

    // Use SELECT FOR UPDATE to lock the row and prevent race conditions
    const result = await client.query('SELECT data, updated_at FROM season WHERE id = 1 FOR UPDATE');
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No active season' });
    }

    const season = result.rows[0].data;

    // Find the match
    let match = null;
    let group = null;

    // Check regular season matches
    for (const g of ['A', 'B']) {
      for (const week of season.schedule[g]) {
        for (const m of week) {
          if (m.id === matchId) {
            match = m;
            group = g;
            break;
          }
        }
        if (match) break;
      }
      if (match) break;
    }

    // Check wildcard matches
    if (!match && season.wildcard) {
      for (const wc of season.wildcard.matches) {
        if (wc.id === matchId) {
          match = wc;
          group = 'wildcard';
          break;
        }
      }
    }

    // Check playoff matches
    if (!match && season.playoffs) {
      for (const g of ['A', 'B']) {
        if (season.playoffs[g]) {
          for (const sf of season.playoffs[g].semifinals) {
            if (sf.id === matchId) {
              match = sf;
              group = g;
              break;
            }
          }
          if (season.playoffs[g].final.id === matchId) {
            match = season.playoffs[g].final;
            group = g;
          }
        }
      }
    }

    // Check super bowl
    if (!match && season.superBowl && season.superBowl.id === matchId) {
      match = season.superBowl;
      group = 'superBowl';
    }

    // Check combined championship bracket matches
    if (!match && season.championship) {
      // Quarterfinals
      for (const qf of season.championship.quarterfinals) {
        if (qf.id === matchId) {
          match = qf;
          group = 'championship';
          break;
        }
      }
      // Semifinals
      if (!match) {
        for (const sf of season.championship.semifinals) {
          if (sf.id === matchId) {
            match = sf;
            group = 'championship';
            break;
          }
        }
      }
      // Final
      if (!match && season.championship.final.id === matchId) {
        match = season.championship.final;
        group = 'championship';
      }
      // Play-in games
      if (!match && season.championship.playInGames) {
        for (const playIn of season.championship.playInGames) {
          if (playIn.id === matchId) {
            match = playIn;
            group = 'championship';
            break;
          }
        }
      }
    }

    if (!match) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Match not found' });
    }

    // SECURITY: Prevent re-submitting already completed matches
    if (match.completed) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Match already completed',
        existingResult: {
          winner: match.winner,
          loser: match.loser,
          score: `${match.score1}-${match.score2}`
        }
      });
    }

    // SECURITY: Validate winner/loser are actual participants in this match
    const participants = [match.player1, match.player2].filter(Boolean);
    if (!participants.includes(winner) || !participants.includes(loser)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Winner and loser must be match participants',
        participants: participants
      });
    }

    // SECURITY: Winner and loser must be different
    if (winner === loser) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Winner and loser cannot be the same player' });
    }

    // SECURITY: Validate scores are non-negative integers
    if (!Number.isInteger(score1) || !Number.isInteger(score2) || score1 < 0 || score2 < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Scores must be non-negative integers' });
    }

    // SECURITY: Validate score ceiling (max 11 points per game)
    if (score1 > 11 || score2 > 11) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Scores cannot exceed 11 points' });
    }

    // SECURITY: Winner's score must be higher than loser's score
    const winnerScore = winner === match.player1 ? score1 : score2;
    const loserScore = winner === match.player1 ? score2 : score1;
    if (winnerScore <= loserScore) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Winner must have a higher score than loser' });
    }

    // Update match
    match.winner = winner;
    match.loser = loser;
    match.score1 = score1;
    match.score2 = score2;
    match.completed = true;

    // Update standings for regular season matches
    if (group === 'A' || group === 'B') {
      const standings = season.standings[group];
      if (standings[winner] && standings[loser]) {
        // Use correctly attributed scores (winnerScore/loserScore already calculated above)
        standings[winner].wins++;
        standings[winner].points += 3;
        standings[winner].pointsFor += winnerScore;
        standings[winner].pointsAgainst += loserScore;
        standings[winner].streak = standings[winner].streak >= 0 ? standings[winner].streak + 1 : 1;
        standings[winner].lastResults.push('W');
        if (standings[winner].lastResults.length > 5) standings[winner].lastResults.shift();

        standings[loser].losses++;
        standings[loser].pointsFor += loserScore;
        standings[loser].pointsAgainst += winnerScore;
        standings[loser].streak = standings[loser].streak <= 0 ? standings[loser].streak - 1 : -1;
        standings[loser].lastResults.push('L');
        if (standings[loser].lastResults.length > 5) standings[loser].lastResults.shift();

        // Track head-to-head record
        if (!standings[winner].headToHead) standings[winner].headToHead = {};
        if (!standings[loser].headToHead) standings[loser].headToHead = {};
        if (!standings[winner].headToHead[loser]) standings[winner].headToHead[loser] = { wins: 0, losses: 0 };
        if (!standings[loser].headToHead[winner]) standings[loser].headToHead[winner] = { wins: 0, losses: 0 };
        standings[winner].headToHead[loser].wins++;
        standings[loser].headToHead[winner].losses++;
      }
    }

    // Handle wildcard completion - auto-start combined championship bracket
    if (group === 'wildcard' && season.wildcard) {
      const allWildcardComplete = season.wildcard.matches.every(m => m.completed);
      if (allWildcardComplete && !season.championship) {
        // Determine wildcard winners for each group
        let wildcardWinnerForA = null;
        let wildcardWinnerForB = null;

        season.wildcard.matches.forEach(wcMatch => {
          if (wcMatch.completed && wcMatch.winner) {
            if (wcMatch.winner === wcMatch.player1) {
              if (wcMatch.player1Group === 'A') wildcardWinnerForA = wcMatch.winner;
              else wildcardWinnerForB = wcMatch.winner;
            } else {
              if (wcMatch.player2Group === 'A') wildcardWinnerForA = wcMatch.winner;
              else wildcardWinnerForB = wcMatch.winner;
            }
          }
        });

        // VALIDATION: Ensure wildcard winners are actually from their assigned groups
        if (wildcardWinnerForA && !season.standings.A[wildcardWinnerForA]) {
          console.error(`⚠️  Wildcard validation failed: ${wildcardWinnerForA} not in Group A standings`);
          wildcardWinnerForA = null; // Invalidate
        }
        if (wildcardWinnerForB && !season.standings.B[wildcardWinnerForB]) {
          console.error(`⚠️  Wildcard validation failed: ${wildcardWinnerForB} not in Group B standings`);
          wildcardWinnerForB = null; // Invalidate
        }

        // Generate combined championship bracket (top 4 from each group)
        // Only include wildcard matches if they have winners
        let wildcardMatchesToPass = null;
        if (season.wildcard?.wc1?.winner || season.wildcard?.wc2?.winner) {
          wildcardMatchesToPass = [];
          if (season.wildcard.wc1?.winner) wildcardMatchesToPass.push(season.wildcard.wc1);
          if (season.wildcard.wc2?.winner) wildcardMatchesToPass.push(season.wildcard.wc2);
        }

        season.championship = generateChampionshipBracket(
          season.standings.A,
          season.standings.B,
          wildcardWinnerForA,
          wildcardWinnerForB,
          wildcardMatchesToPass
        );
        // If play-in games exist, set status to 'playin', otherwise 'playoffs'
        season.status = season.championship.playInGames ? 'playin' : 'playoffs';
        console.log(season.championship.playInGames
          ? 'Auto-started play-in games after wildcard complete'
          : 'Auto-started combined championship bracket after wildcard complete');

        // Notify play-in game participants if they exist
        if (season.championship?.playInGames) {
          for (const playIn of season.championship.playInGames) {
            await createNotification(
              playIn.player1,
              'playoffs',
              '⚔️ Play-In Game!',
              `You must defend your #4 seed against ${playIn.player2} (wildcard winner) to advance to the Championship Bracket`,
              '#standings'
            );
            await createNotification(
              playIn.player2,
              'playoffs',
              '⚔️ Play-In Game!',
              `You won the wildcard! Now beat ${playIn.player1} (#4 seed) to advance to the Championship Bracket`,
              '#standings'
            );
          }
        } else {
          // No play-in games, notify championship bracket participants directly
          if (season.championship?.quarterfinals) {
            for (const qf of season.championship.quarterfinals) {
              if (qf.player1 && qf.player2) {
                await createNotification(
                  qf.player1,
                  'playoffs',
                  '🏆 Championship Bracket!',
                  `You're in the playoffs! ${qf.matchName}: vs ${qf.player2}`,
                  '#standings'
                );
                await createNotification(
                  qf.player2,
                  'playoffs',
                  '🏆 Championship Bracket!',
                  `You're in the playoffs! ${qf.matchName}: vs ${qf.player1}`,
                  '#standings'
                );
              }
            }
          }
        }
      }
    }

    // Handle play-in game completion - advance winner to championship quarterfinals
    if (season.championship?.playInGames && match.round === 'playin') {
      const playInMatch = season.championship.playInGames.find(p => p.id === matchId);
      if (playInMatch && playInMatch.completed) {
        // Find the quarterfinal that this play-in feeds into
        const feedsIntoQF = season.championship.quarterfinals.find(qf => qf.feedsFromPlayIn === matchId);
        if (feedsIntoQF) {
          // Insert winner as player2 (the #4 seed position)
          feedsIntoQF.player2 = winner;
          feedsIntoQF.seed2 = playInMatch.group === 'A' ? 'A#4' : 'B#4';
          console.log(`Play-in winner ${winner} advanced to ${feedsIntoQF.id}`);

          // Notify play-in winner
          await createNotification(
            winner,
            'playoffs',
            '🎉 Play-In Victory!',
            `You won the play-in game and advanced to the Championship Quarterfinals! Next up: ${feedsIntoQF.matchName} vs ${feedsIntoQF.player1}`,
            '#standings'
          );

          // Notify play-in loser
          await createNotification(
            loser,
            'playoffs',
            '💔 Play-In Loss',
            `Your season has ended. ${winner} advances to the Championship Bracket.`,
            '#standings'
          );

          // Check if all play-in games are complete
          const allPlayInsComplete = season.championship.playInGames.every(p => p.completed);
          if (allPlayInsComplete) {
            season.status = 'playoffs';
            console.log('All play-in games complete - Championship bracket ready');

            // Notify all QF participants now that brackets are set
            for (const qf of season.championship.quarterfinals) {
              if (qf.player1 && qf.player2) {
                await createNotification(
                  qf.player1,
                  'playoffs',
                  '🏆 Championship Bracket Set!',
                  `${qf.matchName}: vs ${qf.player2}`,
                  '#standings'
                );
                await createNotification(
                  qf.player2,
                  'playoffs',
                  '🏆 Championship Bracket Set!',
                  `${qf.matchName}: vs ${qf.player1}`,
                  '#standings'
                );
              }
            }
          }
        }
      }
    }

    // Handle championship bracket advancement
    if (season.championship && group === 'championship') {
      // Handle quarterfinal completion - advance winners to semifinals
      if (match.round === 'quarterfinal') {
        const qfMatch = season.championship.quarterfinals.find(qf => qf.id === matchId);
        if (qfMatch) {
          // Determine which semifinal this feeds into
          if (qfMatch.matchNum === 1 || qfMatch.matchNum === 2) {
            // QF1 and QF2 feed into SF1
            const sf1 = season.championship.semifinals[0];
            if (qfMatch.matchNum === 1) sf1.player1 = winner;
            else sf1.player2 = winner;
          } else {
            // QF3 and QF4 feed into SF2
            const sf2 = season.championship.semifinals[1];
            if (qfMatch.matchNum === 3) sf2.player1 = winner;
            else sf2.player2 = winner;
          }
        }
      }

      // Handle semifinal completion - advance winners to final
      if (match.round === 'semifinal') {
        const sfMatch = season.championship.semifinals.find(sf => sf.id === matchId);
        if (sfMatch) {
          if (sfMatch.matchNum === 1) season.championship.final.player1 = winner;
          else season.championship.final.player2 = winner;
        }
      }

      // Handle final completion
      if (match.round === 'final' && matchId === 'CHAMP-FINAL') {
        season.championship.champion = winner;
        season.champion = winner;
        season.status = 'complete';
      }
    }

    // Legacy support for old playoff structure (separate group brackets)
    if (season.playoffs && !season.championship) {
      // Handle playoff advancement
      if (match.round === 'semifinal' && season.playoffs[group]) {
        const playoff = season.playoffs[group];
        const bothSemisComplete = playoff.semifinals.every(sf => sf.completed);

        if (bothSemisComplete) {
          playoff.final.player1 = playoff.semifinals[0].winner;
          playoff.final.player2 = playoff.semifinals[1].winner;
        }
      }

      // Handle group final winner
      if (match.round === 'final' && season.playoffs[group]) {
        season.playoffs[group].champion = winner;

        const bothFinalsComplete =
          season.playoffs.A?.final?.completed &&
          season.playoffs.B?.final?.completed;

        if (bothFinalsComplete && !season.superBowl) {
          season.superBowl = {
            id: 'SUPER-BOWL',
            round: 'superBowl',
            player1: season.playoffs.A.champion,
            player2: season.playoffs.B.champion,
            winner: null, loser: null, score1: null, score2: null, completed: false
          };
        }
      }

      // Handle Super Bowl winner
      if (group === 'superBowl') {
        season.champion = winner;
        season.status = 'complete';
      }
    }

    // NOTE: Leaderboard is tracked separately in the leaderboard table for all-time stats
    // Season standings are tracked in season JSONB for current season only
    // Both are updated, but serve different purposes:
    // - leaderboard table: persistent all-time stats, weekly reset
    // - season standings: current season performance, used for playoffs seeding
    await updateLeaderboard(winner, loser);

    // Send notifications for match result
    const scoreStr = `${score1}-${score2}`;

    // Notify winner
    await createNotification(
      winner,
      'match_result',
      '🏆 Match Won!',
      `You defeated ${loser} (${scoreStr})`,
      '#mygames'
    );

    // Notify loser
    await createNotification(
      loser,
      'match_result',
      '📊 Match Completed',
      `${winner} won (${scoreStr}). Good game!`,
      '#mygames'
    );

    // Special notifications for championship matches
    if (group === 'championship' && match.round === 'final' && matchId === 'CHAMP-FINAL') {
      // Broadcast champion notification to everyone
      await createNotification(
        null, // null = broadcast to all
        'champion',
        '🏆 Season Champion!',
        `${winner} is the new Mammotome Ping Pong League Champion!`,
        '#standings'
      );
    }

    // Auto-advance week if all matches in current week are completed (for regular season only)
    let weekAdvanced = false;
    let midSeasonTriggered = false;
    if (season.status === 'regular' && (group === 'A' || group === 'B')) {
      const currentWeekMatches = [];
      ['A', 'B'].forEach(g => {
        const weekSchedule = season.schedule[g][season.currentWeek - 1];
        if (weekSchedule) {
          weekSchedule.forEach(m => {
            // Only count non-cancelled matches
            if (!m.cancelled) {
              currentWeekMatches.push(m);
            }
          });
        }
      });

      const allCompleted = currentWeekMatches.length > 0 && currentWeekMatches.every(m => m.completed);

      if (allCompleted && season.currentWeek < season.totalWeeks) {
        season.currentWeek++;
        weekAdvanced = true;

        // Notify players about their matches for the new week
        const newWeekNum = season.currentWeek;
        for (const g of ['A', 'B']) {
          const weekSchedule = season.schedule[g][newWeekNum - 1];
          if (weekSchedule) {
            for (const m of weekSchedule) {
              if (m.player1 && m.player2 && !m.cancelled) {
                // Notify both players about their upcoming match
                await createNotification(
                  m.player1,
                  'upcoming_match',
                  `📅 Week ${newWeekNum} Match`,
                  `You play ${m.player2} this week. Schedule your match!`,
                  '#schedule'
                );
                await createNotification(
                  m.player2,
                  'upcoming_match',
                  `📅 Week ${newWeekNum} Match`,
                  `You play ${m.player1} this week. Schedule your match!`,
                  '#schedule'
                );
              }
            }
          }
        }

        // Check if we just hit mid-season (week 3) - AUTO-EXECUTE SWAP
        const midPoint = getMidSeasonWeek(season.totalWeeks);
        if (season.currentWeek === midPoint && !season.midSeasonReview?.completed) {
          // AUTO-EXECUTE MID-SEASON SWAP
          console.log(`🔄 Auto-executing mid-season swap at week ${season.currentWeek}`);

          const sortedA = sortStandings(season.standings.A);
          const sortedB = sortStandings(season.standings.B);

          // Only proceed if both groups have at least 3 players
          if (sortedA.length >= 3 && sortedB.length >= 3) {
            const bottomA = sortedA.slice(-3);
            const topB = sortedB.slice(0, 3);

            const swaps = {
              fromAtoB: bottomA.map(p => p.name),
              fromBtoA: topB.map(p => p.name)
            };

            // Update groups
            const newGroupAPlayers = season.groups.A.players.filter(p => !swaps.fromAtoB.includes(p.name));
            const newGroupBPlayers = season.groups.B.players.filter(p => !swaps.fromBtoA.includes(p.name));

            swaps.fromBtoA.forEach(name => {
              const player = season.groups.B.players.find(p => p.name === name);
              if (player) newGroupAPlayers.push({ ...player, promotedMidSeason: true });
            });
            swaps.fromAtoB.forEach(name => {
              const player = season.groups.A.players.find(p => p.name === name);
              if (player) newGroupBPlayers.push({ ...player, relegatedMidSeason: true });
            });

            season.groups.A.players = newGroupAPlayers;
            season.groups.B.players = newGroupBPlayers;

            // Move standings data (with stats reset - always true for fairness)
            const resetStats = true;

            swaps.fromAtoB.forEach(name => {
              const oldStats = season.standings.A[name];
              const baseStats = resetStats ? {
                wins: 0, losses: 0, points: 0,
                pointsFor: 0, pointsAgainst: 0,
                streak: 0, lastResults: [],
                headToHead: {}
              } : { ...oldStats };

              season.standings.B[name] = {
                ...baseStats,
                initialSeed: oldStats.initialSeed,
                relegatedFrom: 'A',
                preSwapStats: { ...oldStats }
              };
              delete season.standings.A[name];
            });

            swaps.fromBtoA.forEach(name => {
              const oldStats = season.standings.B[name];
              const baseStats = resetStats ? {
                wins: 0, losses: 0, points: 0,
                pointsFor: 0, pointsAgainst: 0,
                streak: 0, lastResults: [],
                headToHead: {}
              } : { ...oldStats };

              season.standings.A[name] = {
                ...baseStats,
                initialSeed: oldStats.initialSeed,
                promotedFrom: 'B',
                preSwapStats: { ...oldStats }
              };
              delete season.standings.B[name];
            });

            // Cancel old matches
            const cancelledMatches = [];
            ['A', 'B'].forEach(group => {
              const swappedPlayers = group === 'A' ? swaps.fromAtoB : swaps.fromBtoA;
              season.schedule[group].forEach((week, weekIdx) => {
                if (weekIdx + 1 > season.currentWeek) {
                  week.forEach(match => {
                    if (!match.completed && (swappedPlayers.includes(match.player1) || swappedPlayers.includes(match.player2))) {
                      match.cancelled = true;
                      match.cancelReason = 'Auto mid-season group swap';
                      cancelledMatches.push(match.id);
                    }
                  });
                }
              });
            });

            // Generate new priority-matched games
            const remainingWeeks = season.totalWeeks - season.currentWeek;
            const newMatches = { A: [], B: [] };

            const getPriorityOpponents = (playerName, newGroup, swappedPlayers, oldRank) => {
              const allOpponents = season.groups[newGroup].players
                .filter(p => p.name !== playerName && !swappedPlayers.includes(p.name))
                .map(p => ({ name: p.name, stats: season.standings[newGroup][p.name] }));

              const sortedOpponents = sortStandings(
                Object.fromEntries(allOpponents.map(o => [o.name, o.stats]))
              );

              let priorityOpponents = [];
              let secondaryOpponents = [];

              if (oldRank >= 6) {
                priorityOpponents = sortedOpponents.slice(3);
                secondaryOpponents = sortedOpponents.slice(0, 3);
              } else if (oldRank <= 3) {
                priorityOpponents = sortedOpponents.slice(0, 4);
                secondaryOpponents = sortedOpponents.slice(4);
              } else {
                priorityOpponents = sortedOpponents;
                secondaryOpponents = [];
              }

              return [...priorityOpponents, ...secondaryOpponents];
            };

            swaps.fromBtoA.forEach((playerName, swapIdx) => {
              const oldRank = swapIdx + 1;
              const opponents = getPriorityOpponents(playerName, 'A', swaps.fromBtoA, oldRank);

              opponents.forEach((opp, idx) => {
                if (idx < remainingWeeks) {
                  const weekNum = season.currentWeek + 1 + idx;
                  const matchId = `A-W${weekNum}-SWAP-${playerName.replace(/\s/g, '')}-${opp.name.replace(/\s/g, '')}`;
                  newMatches.A.push({
                    id: matchId, week: weekNum, player1: playerName, player2: opp.name,
                    group: 'A', completed: false, winner: null, loser: null,
                    score1: null, score2: null, isSwapMatch: true,
                    priorityMatch: idx < Math.ceil(remainingWeeks * 0.6)
                  });
                }
              });
            });

            swaps.fromAtoB.forEach((playerName, swapIdx) => {
              const oldRank = sortedA.length - 2 + swapIdx;
              const opponents = getPriorityOpponents(playerName, 'B', swaps.fromAtoB, oldRank);

              opponents.forEach((opp, idx) => {
                if (idx < remainingWeeks) {
                  const weekNum = season.currentWeek + 1 + idx;
                  const matchId = `B-W${weekNum}-SWAP-${playerName.replace(/\s/g, '')}-${opp.name.replace(/\s/g, '')}`;
                  newMatches.B.push({
                    id: matchId, week: weekNum, player1: playerName, player2: opp.name,
                    group: 'B', completed: false, winner: null, loser: null,
                    score1: null, score2: null, isSwapMatch: true,
                    priorityMatch: idx < Math.ceil(remainingWeeks * 0.6)
                  });
                }
              });
            });

            // Add new matches to schedule
            newMatches.A.forEach(match => {
              const weekIdx = match.week - 1;
              if (season.schedule.A[weekIdx]) season.schedule.A[weekIdx].push(match);
            });
            newMatches.B.forEach(match => {
              const weekIdx = match.week - 1;
              if (season.schedule.B[weekIdx]) season.schedule.B[weekIdx].push(match);
            });

            // Record the auto mid-season review
            season.midSeasonReview = {
              completed: true,
              completedAt: new Date().toISOString(),
              week: season.currentWeek,
              swaps: swaps,
              cancelledMatches: cancelledMatches,
              newMatchesCreated: newMatches.A.length + newMatches.B.length,
              statsReset: resetStats,
              priorityMatching: true,
              automatic: true
            };

            // Notify swapped players
            for (const playerName of swaps.fromBtoA) {
              await createNotification(
                playerName, 'mid_season_swap', '🎉 Promoted to Group A!',
                `Congratulations! You've been promoted to Group A (Seeded). Your stats have been reset and you'll face top-tier opponents.`,
                '#standings'
              );
            }
            for (const playerName of swaps.fromAtoB) {
              await createNotification(
                playerName, 'mid_season_swap', '📉 Moved to Group B',
                `You've been moved to Group B (Unseeded) at mid-season review. Your stats have been reset - fresh start against similar-level opponents!`,
                '#standings'
              );
            }

            midSeasonTriggered = true;
            console.log(`✅ Auto mid-season swap complete: ${swaps.fromAtoB.length} relegated, ${swaps.fromBtoA.length} promoted`);
          } else {
            console.log(`⚠️  Skipping auto mid-season swap - insufficient players (A: ${sortedA.length}, B: ${sortedB.length})`);
          }
        }
      }

      // Check if regular season is complete (all weeks done) - auto-start wildcard
      if (allCompleted && season.currentWeek === season.totalWeeks && season.status === 'regular') {
        // Check if ALL matches across ALL weeks are completed
        let allRegularSeasonComplete = true;
        ['A', 'B'].forEach(g => {
          season.schedule[g].forEach(week => {
            week.forEach(m => {
              if (!m.completed && !m.cancelled) allRegularSeasonComplete = false;
            });
          });
        });

        if (allRegularSeasonComplete) {
          // Auto-start wildcard round
          season.wildcard = generateWildcardRound(season.standings.A, season.standings.B);
          season.status = 'wildcard';
          console.log('Auto-started wildcard round after regular season complete');

          // Notify wildcard participants
          if (season.wildcard?.matches) {
            for (const wcMatch of season.wildcard.matches) {
              if (wcMatch.player1 && wcMatch.player2) {
                await createNotification(
                  wcMatch.player1,
                  'wildcard',
                  '🎯 Wildcard Round!',
                  `You're in the wildcard! Beat ${wcMatch.player2} to qualify for playoffs.`,
                  '#standings'
                );
                await createNotification(
                  wcMatch.player2,
                  'wildcard',
                  '🎯 Wildcard Round!',
                  `You're in the wildcard! Beat ${wcMatch.player1} to qualify for playoffs.`,
                  '#standings'
                );
              }
            }
          }
        }
      }
    }

    // Auto-complete any active booking between these two players
    await client.query(
      `UPDATE table_bookings SET status = 'completed'
       WHERE ((player1 = $1 AND player2 = $2) OR (player1 = $2 AND player2 = $1))
       AND status IN ('booked', 'tentative')`,
      [winner, loser]
    );

    // Save updated season
    await client.query(`
      UPDATE season SET data = $1, current_week = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = 1
    `, [JSON.stringify(season), season.currentWeek, season.status]);

    await client.query('COMMIT');

    res.json({ success: true, weekAdvanced, newWeek: season.currentWeek, midSeasonTriggered, wildcardStarted: season.status === 'wildcard' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Correct/reverse a match result (admin only)
app.post('/api/season/match/correct', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { matchId, newWinner, newLoser, newScore1, newScore2 } = req.body;

    const result = await client.query('SELECT data FROM season WHERE id = 1 FOR UPDATE');
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No active season' });
    }

    const season = result.rows[0].data;

    // BLOCK: Prevent corrections after playoffs have started
    if (season.status !== 'regular') {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: `Match corrections are not allowed after playoffs have started. Current season status: ${season.status}`,
        reason: 'Correcting regular season matches during playoffs could invalidate playoff seeding and brackets'
      });
    }

    // Find the match in regular season
    let match = null;
    let group = null;

    for (const g of ['A', 'B']) {
      for (const week of season.schedule[g]) {
        for (const m of week) {
          if (m.id === matchId) {
            match = m;
            group = g;
            break;
          }
        }
        if (match) break;
      }
      if (match) break;
    }

    if (!match) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Match not found. Note: Only regular season matches can be corrected.' });
    }

    if (!match.completed) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Match has not been completed yet' });
    }

    // Validate new values
    const participants = [match.player1, match.player2].filter(Boolean);
    if (!participants.includes(newWinner) || !participants.includes(newLoser)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Winner and loser must be match participants', participants });
    }

    if (!Number.isInteger(newScore1) || !Number.isInteger(newScore2) || newScore1 < 0 || newScore2 < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Scores must be non-negative integers' });
    }

    // Validate score ceiling (max 11 points per game)
    if (newScore1 > 11 || newScore2 > 11) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Scores cannot exceed 11 points' });
    }

    const newWinnerScore = newWinner === match.player1 ? newScore1 : newScore2;
    const newLoserScore = newWinner === match.player1 ? newScore2 : newScore1;
    if (newWinnerScore <= newLoserScore) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Winner must have a higher score' });
    }

    // Reverse old stats
    const standings = season.standings[group];
    const oldWinner = match.winner;
    const oldLoser = match.loser;
    const oldWinnerScore = oldWinner === match.player1 ? match.score1 : match.score2;
    const oldLoserScore = oldWinner === match.player1 ? match.score2 : match.score1;

    if (standings[oldWinner] && standings[oldLoser]) {
      // Reverse old winner stats
      standings[oldWinner].wins--;
      standings[oldWinner].points -= 3;
      standings[oldWinner].pointsFor -= oldWinnerScore;
      standings[oldWinner].pointsAgainst -= oldLoserScore;
      if (standings[oldWinner].lastResults.length > 0) standings[oldWinner].lastResults.pop();

      // Reverse old loser stats
      standings[oldLoser].losses--;
      standings[oldLoser].pointsFor -= oldLoserScore;
      standings[oldLoser].pointsAgainst -= oldWinnerScore;
      if (standings[oldLoser].lastResults.length > 0) standings[oldLoser].lastResults.pop();

      // Reverse head-to-head
      if (standings[oldWinner].headToHead?.[oldLoser]) {
        standings[oldWinner].headToHead[oldLoser].wins--;
      }
      if (standings[oldLoser].headToHead?.[oldWinner]) {
        standings[oldLoser].headToHead[oldWinner].losses--;
      }
    }

    // Apply new stats
    if (standings[newWinner] && standings[newLoser]) {
      standings[newWinner].wins++;
      standings[newWinner].points += 3;
      standings[newWinner].pointsFor += newWinnerScore;
      standings[newWinner].pointsAgainst += newLoserScore;
      standings[newWinner].lastResults.push('W');
      if (standings[newWinner].lastResults.length > 5) standings[newWinner].lastResults.shift();

      standings[newLoser].losses++;
      standings[newLoser].pointsFor += newLoserScore;
      standings[newLoser].pointsAgainst += newWinnerScore;
      standings[newLoser].lastResults.push('L');
      if (standings[newLoser].lastResults.length > 5) standings[newLoser].lastResults.shift();

      // Update head-to-head
      if (!standings[newWinner].headToHead) standings[newWinner].headToHead = {};
      if (!standings[newLoser].headToHead) standings[newLoser].headToHead = {};
      if (!standings[newWinner].headToHead[newLoser]) standings[newWinner].headToHead[newLoser] = { wins: 0, losses: 0 };
      if (!standings[newLoser].headToHead[newWinner]) standings[newLoser].headToHead[newWinner] = { wins: 0, losses: 0 };
      standings[newWinner].headToHead[newLoser].wins++;
      standings[newLoser].headToHead[newWinner].losses++;
    }

    // Update the match record
    const correction = {
      correctedAt: new Date().toISOString(),
      oldResult: { winner: oldWinner, loser: oldLoser, score1: match.score1, score2: match.score2 }
    };
    match.winner = newWinner;
    match.loser = newLoser;
    match.score1 = newScore1;
    match.score2 = newScore2;
    match.correction = correction;

    await client.query(`
      UPDATE season SET data = $1, updated_at = CURRENT_TIMESTAMP WHERE id = 1
    `, [JSON.stringify(season)]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Match ${matchId} corrected`,
      oldResult: correction.oldResult,
      newResult: { winner: newWinner, loser: newLoser, score1: newScore1, score2: newScore2 }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Swap matches between weeks (admin only) - move matches from one week to another
app.post('/api/season/match/swap-weeks', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { swaps } = req.body;
    // swaps: array of { matchId, targetWeek } - move match to targetWeek (1-indexed)

    if (!Array.isArray(swaps) || swaps.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'swaps must be a non-empty array of { matchId, targetWeek }' });
    }

    const result = await client.query('SELECT data FROM season WHERE id = 1 FOR UPDATE');
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No active season' });
    }

    const season = result.rows[0].data;

    if (season.status !== 'regular') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Week swaps only allowed during regular season' });
    }

    const changes = [];

    for (const swap of swaps) {
      const { matchId, targetWeek } = swap;
      const targetWeekIdx = targetWeek - 1;

      // Find the match
      let found = false;
      for (const g of ['A', 'B']) {
        for (let weekIdx = 0; weekIdx < season.schedule[g].length; weekIdx++) {
          const week = season.schedule[g][weekIdx];
          for (let mIdx = 0; mIdx < week.length; mIdx++) {
            if (week[mIdx].id === matchId) {
              const match = week[mIdx];
              const sourceWeek = weekIdx + 1;

              if (sourceWeek === targetWeek) {
                changes.push({ matchId, status: 'skipped', reason: 'Already in target week' });
                found = true;
                break;
              }

              // Ensure target week array exists
              while (season.schedule[g].length <= targetWeekIdx) {
                season.schedule[g].push([]);
              }

              // Remove from source week
              season.schedule[g][weekIdx].splice(mIdx, 1);

              // Update match week number
              match.week = targetWeek;

              // Add to target week
              season.schedule[g][targetWeekIdx].push(match);

              changes.push({
                matchId,
                match: `${match.player1} vs ${match.player2}`,
                from: `Week ${sourceWeek}`,
                to: `Week ${targetWeek}`,
                group: g,
                completed: match.completed
              });

              found = true;
              break;
            }
          }
          if (found) break;
        }
        if (found) break;
      }

      if (!found) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Match ${matchId} not found` });
      }
    }

    await client.query(`
      UPDATE season SET data = $1, updated_at = CURRENT_TIMESTAMP WHERE id = 1
    `, [JSON.stringify(season)]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `${changes.length} match(es) swapped between weeks`,
      changes
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Add a match to the schedule (admin only)
app.post('/api/season/match/add', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { group, week, player1, player2, matchId } = req.body;
    if (!group || !week || !player1 || !player2) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'group, week, player1, player2 are required' });
    }
    const result = await client.query('SELECT data FROM season WHERE id = 1 FOR UPDATE');
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No active season' });
    }
    const season = result.rows[0].data;
    const weekIdx = week - 1;
    while (season.schedule[group].length <= weekIdx) {
      season.schedule[group].push([]);
    }
    const id = matchId || `${group}-W${week}-M${season.schedule[group][weekIdx].length + 1}-ADD`;
    const match = {
      id, week, group, player1, player2,
      score1: null, score2: null, winner: null, loser: null, completed: false
    };
    season.schedule[group][weekIdx].push(match);
    await client.query('UPDATE season SET data = $1, updated_at = CURRENT_TIMESTAMP WHERE id = 1', [JSON.stringify(season)]);
    await client.query('COMMIT');
    res.json({ success: true, match });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Custom mid-season promotion: promote top players from B to A, remove injured players, reschedule
app.post('/api/season/custom-promotion', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { promotePlayers, removePlayers, demotePlayers, newGamesPerPlayer, totalGamesTarget } = req.body;
    if (!Array.isArray(promotePlayers) || promotePlayers.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'promotePlayers must be a non-empty array' });
    }
    if (!newGamesPerPlayer && !totalGamesTarget) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'newGamesPerPlayer or totalGamesTarget required' });
    }

    const result = await client.query('SELECT data FROM season WHERE id = 1 FOR UPDATE');
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No active season' });
    }
    const season = result.rows[0].data;

    // Snapshot for recovery
    await createSeasonSnapshot(season, 'Before custom mid-season promotion', 'admin');

    // Check if promotion already happened (idempotent re-run for rescheduling)
    const alreadyPromoted = season.midSeasonReview?.completed && season.midSeasonReview?.type === 'custom-promotion';
    if (!alreadyPromoted) {
      // Validate all player names exist in Group B
      const allMoving = [...promotePlayers, ...(removePlayers || [])];
      for (const name of allMoving) {
        if (!season.standings.B[name]) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Player "${name}" not found in Group B standings` });
        }
      }
    }

    const cancelledMatches = [];

    if (!alreadyPromoted) {
      const allMoving = [...promotePlayers, ...(removePlayers || [])];
      const gone = new Set(allMoving);

      // Step 1: Cancel ALL pending matches involving removed/promoted players
      for (const group of ['A', 'B']) {
        for (let weekIdx = 0; weekIdx < season.schedule[group].length; weekIdx++) {
          for (const match of season.schedule[group][weekIdx]) {
            if (!match.completed && !match.cancelled &&
                (gone.has(match.player1) || gone.has(match.player2))) {
              match.cancelled = true;
              match.cancelReason = gone.has(match.player1) && gone.has(match.player2)
                ? 'Both players moved/removed'
                : gone.has(match.player1) ? `${match.player1} moved/removed` : `${match.player2} moved/removed`;
              cancelledMatches.push({ id: match.id, match: `${match.player1} vs ${match.player2}`, reason: match.cancelReason });
            }
          }
        }
      }

      // Step 2: Remove players (Jacob)
      const removeList = removePlayers || [];
      for (const name of removeList) {
        delete season.standings.B[name];
        season.groups.B.players = season.groups.B.players.filter(p => p.name !== name);
      }

      // Step 3: Move promoted players B → A (keep stats)
      for (const name of promotePlayers) {
        const bStats = season.standings.B[name];
        const bPlayer = season.groups.B.players.find(p => p.name === name);

        season.standings.A[name] = {
          ...bStats,
          promotedFrom: 'B',
          preSwapStats: { ...bStats }
        };
        if (bPlayer) {
          season.groups.A.players.push({ ...bPlayer, promotedMidSeason: true });
        } else {
          season.groups.A.players.push({ name, seed: null, promotedMidSeason: true });
        }

        delete season.standings.B[name];
        season.groups.B.players = season.groups.B.players.filter(p => p.name !== name);
      }

      // Step 4: Cancel ALL remaining pending matches in BOTH groups (clean slate)
      for (const group of ['A', 'B']) {
        for (let weekIdx = 0; weekIdx < season.schedule[group].length; weekIdx++) {
          for (const match of season.schedule[group][weekIdx]) {
            if (!match.completed && !match.cancelled) {
              match.cancelled = true;
              match.cancelReason = 'Mid-season schedule reset';
              cancelledMatches.push({ id: match.id, match: `${match.player1} vs ${match.player2}`, reason: match.cancelReason });
            }
          }
        }
      }
    }

    // Demote players from A to B (if requested)
    const demoteList = demotePlayers || [];
    for (const name of demoteList) {
      if (season.standings.A[name]) {
        const aStats = { ...season.standings.A[name] };
        delete aStats.promotedFrom;
        delete aStats.preSwapStats;
        season.standings.B[name] = aStats;
        delete season.standings.A[name];
        season.groups.A.players = season.groups.A.players.filter(p => p.name !== name);
        season.groups.B.players.push({ name, seed: null });
      }
    }

    // Clean up stale promotion flags on Group B players (e.g. after swap-back)
    for (const name of Object.keys(season.standings.B)) {
      delete season.standings.B[name].promotedFrom;
      delete season.standings.B[name].preSwapStats;
    }
    for (const p of season.groups.B.players) {
      delete p.promotedMidSeason;
    }

    // Step 5: Clear any existing POST matches (for re-runs) then generate new schedules
    const startWeek = 5;
    const endWeek = 10;
    for (const group of ['A', 'B']) {
      while (season.schedule[group].length < endWeek) {
        season.schedule[group].push([]);
      }
      // Remove any previously generated POST matches
      for (let w = 0; w < season.schedule[group].length; w++) {
        season.schedule[group][w] = season.schedule[group][w].filter(m => !m.id.includes('-POST-'));
      }
    }

    // Calculate per-player game targets
    const calcTargets = (groupNames, groupStandings) => {
      if (totalGamesTarget) {
        // Variable: each player gets (totalGamesTarget - completed) new games
        const targets = {};
        groupNames.forEach(name => {
          const s = groupStandings[name] || { wins: 0, losses: 0 };
          const completed = s.wins + s.losses;
          targets[name] = Math.max(0, totalGamesTarget - completed);
        });
        return targets;
      }
      return newGamesPerPlayer; // Uniform: same for all
    };

    // Generate new Group A schedule
    const groupANames = season.groups.A.players.map(p => p.name);
    const existingA = getCompletedMatchups(season.standings.A);
    const targetsA = calcTargets(groupANames, season.standings.A);
    const newAMatches = generateCompetitiveSchedule(groupANames, season.standings.A, targetsA, existingA);
    const distributedA = distributeMatchesToWeekRange(newAMatches, startWeek, endWeek, 'A');
    for (const match of distributedA) {
      season.schedule.A[match.week - 1].push(match);
    }

    // Generate new Group B schedule
    const groupBNames = season.groups.B.players.map(p => p.name);
    const existingB = getCompletedMatchups(season.standings.B);
    const targetsB = calcTargets(groupBNames, season.standings.B);
    const newBMatches = generateCompetitiveSchedule(groupBNames, season.standings.B, targetsB, existingB);
    const distributedB = distributeMatchesToWeekRange(newBMatches, startWeek, endWeek, 'B');
    for (const match of distributedB) {
      season.schedule.B[match.week - 1].push(match);
    }

    // Step 7: Record mid-season review
    season.midSeasonReview = {
      completed: true,
      completedAt: new Date().toISOString(),
      week: season.currentWeek,
      type: 'custom-promotion',
      swaps: {
        fromAtoB: demoteList,
        fromBtoA: promotePlayers
      },
      removedPlayers: removePlayers || [],
      cancelledMatches: cancelledMatches.length,
      newMatchesCreated: { A: distributedA.length, B: distributedB.length },
      statsReset: false,
      priorityMatching: true
    };

    // Save
    await client.query('UPDATE season SET data = $1, updated_at = CURRENT_TIMESTAMP WHERE id = 1', [JSON.stringify(season)]);
    await client.query('COMMIT');

    // Verify game counts (new POST games + completed = total)
    const verifyA = {};
    groupANames.forEach(n => {
      const s = season.standings.A[n] || { wins: 0, losses: 0 };
      const completed = s.wins + s.losses;
      verifyA[n] = { newGames: 0, completed, total: completed };
    });
    distributedA.forEach(m => {
      verifyA[m.player1].newGames++; verifyA[m.player1].total++;
      verifyA[m.player2].newGames++; verifyA[m.player2].total++;
    });

    const verifyB = {};
    groupBNames.forEach(n => {
      const s = season.standings.B[n] || { wins: 0, losses: 0 };
      const completed = s.wins + s.losses;
      verifyB[n] = { newGames: 0, completed, total: completed };
    });
    distributedB.forEach(m => {
      verifyB[m.player1].newGames++; verifyB[m.player1].total++;
      verifyB[m.player2].newGames++; verifyB[m.player2].total++;
    });

    res.json({
      success: true,
      message: `Promoted ${promotePlayers.length} players to Group A, removed ${(removePlayers || []).length} players`,
      promoted: promotePlayers,
      removed: removePlayers || [],
      cancelledMatches: cancelledMatches.length,
      newMatches: {
        groupA: { total: distributedA.length, perPlayer: verifyA },
        groupB: { total: distributedB.length, perPlayer: verifyB }
      },
      groupSizes: { A: groupANames.length, B: groupBNames.length }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Swap a player between groups and regenerate schedules
app.post('/api/season/swap-groups', requireAdmin, async (req, res) => {
  const { moveToA, moveToB, newGamesPerPlayer } = req.body;
  if (!moveToA || !moveToB) {
    return res.status(400).json({ error: 'moveToA and moveToB player names required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT data FROM season WHERE id = 1 FOR UPDATE');
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No active season' });
    }
    const season = result.rows[0].data;

    await createSeasonSnapshot(season, `Before swap: ${moveToA} to A, ${moveToB} to B`, 'admin');

    // Validate players exist in correct groups
    if (!season.standings.B[moveToA]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `${moveToA} not found in Group B` });
    }
    if (!season.standings.A[moveToB]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `${moveToB} not found in Group A` });
    }

    // Move moveToB: A → B (clean promotion flags)
    const aStats = { ...season.standings.A[moveToB] };
    delete aStats.promotedFrom;
    delete aStats.preSwapStats;
    season.standings.B[moveToB] = aStats;
    delete season.standings.A[moveToB];
    const aPlayer = season.groups.A.players.find(p => p.name === moveToB);
    season.groups.B.players.push(aPlayer || { name: moveToB, seed: null });
    season.groups.A.players = season.groups.A.players.filter(p => p.name !== moveToB);

    // Move moveToA: B → A
    const bStats = season.standings.B[moveToA];
    season.standings.A[moveToA] = { ...bStats, promotedFrom: 'B', preSwapStats: { ...bStats } };
    delete season.standings.B[moveToA];
    const bPlayer = season.groups.B.players.find(p => p.name === moveToA);
    season.groups.A.players.push(bPlayer ? { ...bPlayer, promotedMidSeason: true } : { name: moveToA, seed: null, promotedMidSeason: true });
    season.groups.B.players = season.groups.B.players.filter(p => p.name !== moveToA);

    // Clear all POST matches and regenerate
    const gamesPerPlayer = newGamesPerPlayer || 5;
    const startWeek = 5;
    const endWeek = 10;
    for (const group of ['A', 'B']) {
      while (season.schedule[group].length < endWeek) {
        season.schedule[group].push([]);
      }
      for (let w = 0; w < season.schedule[group].length; w++) {
        season.schedule[group][w] = season.schedule[group][w].filter(m => !m.id.includes('-POST-'));
      }
    }

    // Regenerate Group A schedule
    const groupANames = season.groups.A.players.map(p => p.name);
    const existingA = getCompletedMatchups(season.standings.A);
    const newAMatches = generateCompetitiveSchedule(groupANames, season.standings.A, gamesPerPlayer, existingA);
    const distributedA = distributeMatchesToWeekRange(newAMatches, startWeek, endWeek, 'A');
    for (const match of distributedA) {
      season.schedule.A[match.week - 1].push(match);
    }

    // Regenerate Group B schedule
    const groupBNames = season.groups.B.players.map(p => p.name);
    const existingB = getCompletedMatchups(season.standings.B);
    const newBMatches = generateCompetitiveSchedule(groupBNames, season.standings.B, gamesPerPlayer, existingB);
    const distributedB = distributeMatchesToWeekRange(newBMatches, startWeek, endWeek, 'B');
    for (const match of distributedB) {
      season.schedule.B[match.week - 1].push(match);
    }

    // Update mid-season review
    season.midSeasonReview.swaps.fromBtoA = season.midSeasonReview.swaps.fromBtoA.filter(n => n !== moveToB);
    if (!season.midSeasonReview.swaps.fromBtoA.includes(moveToA)) {
      season.midSeasonReview.swaps.fromBtoA.push(moveToA);
    }
    if (!season.midSeasonReview.swaps.fromAtoB) season.midSeasonReview.swaps.fromAtoB = [];
    season.midSeasonReview.swaps.fromAtoB.push(moveToB);
    season.midSeasonReview.completedAt = new Date().toISOString();
    season.midSeasonReview.newMatchesCreated = { A: distributedA.length, B: distributedB.length };

    await client.query('UPDATE season SET data = $1, updated_at = CURRENT_TIMESTAMP WHERE id = 1', [JSON.stringify(season)]);
    await client.query('COMMIT');

    // Verify game counts
    const verifyA = {};
    groupANames.forEach(n => { verifyA[n] = 0; });
    distributedA.forEach(m => { verifyA[m.player1]++; verifyA[m.player2]++; });
    const verifyB = {};
    groupBNames.forEach(n => { verifyB[n] = 0; });
    distributedB.forEach(m => { verifyB[m.player1]++; verifyB[m.player2]++; });

    res.json({
      success: true,
      message: `Swapped ${moveToA} to Group A, ${moveToB} to Group B`,
      groupA: { players: groupANames.length, matches: distributedA.length, perPlayer: verifyA },
      groupB: { players: groupBNames.length, matches: distributedB.length, perPlayer: verifyB }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Remove pending matches from schedule (admin only) - for trimming excess games
app.post('/api/season/match/remove', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { matchIds } = req.body;

    if (!Array.isArray(matchIds) || matchIds.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'matchIds must be a non-empty array of match IDs' });
    }

    const result = await client.query('SELECT data FROM season WHERE id = 1 FOR UPDATE');
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No active season' });
    }

    const season = result.rows[0].data;
    const removed = [];
    const errors = [];

    for (const matchId of matchIds) {
      let found = false;
      for (const g of ['A', 'B']) {
        for (let weekIdx = 0; weekIdx < season.schedule[g].length; weekIdx++) {
          const week = season.schedule[g][weekIdx];
          for (let mIdx = 0; mIdx < week.length; mIdx++) {
            if (week[mIdx].id === matchId) {
              const match = week[mIdx];
              if (match.completed) {
                errors.push({ matchId, error: 'Cannot remove completed match' });
              } else {
                week.splice(mIdx, 1);
                removed.push({
                  matchId,
                  match: `${match.player1} vs ${match.player2}`,
                  week: weekIdx + 1,
                  group: g
                });
              }
              found = true;
              break;
            }
          }
          if (found) break;
        }
        if (found) break;
      }
      if (!found) {
        errors.push({ matchId, error: 'Match not found' });
      }
    }

    if (removed.length > 0) {
      await client.query(`
        UPDATE season SET data = $1, updated_at = CURRENT_TIMESTAMP WHERE id = 1
      `, [JSON.stringify(season)]);
      await client.query('COMMIT');
    } else {
      await client.query('ROLLBACK');
    }

    res.json({
      success: removed.length > 0,
      message: `${removed.length} match(es) removed`,
      removed,
      ...(errors.length > 0 && { errors })
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Verify season integrity (admin only) - checks for common issues after mid-season operations
app.get('/api/season/verify', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT data FROM season WHERE id = 1');
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No active season' });
    }
    const season = result.rows[0].data;
    const issues = [];
    const info = {};

    // 1. Check match counts per player (completed + pending should equal target)
    const playerMatches = {};
    for (const g of ['A', 'B']) {
      for (let w = 0; w < season.schedule[g].length; w++) {
        for (const m of (season.schedule[g][w] || [])) {
          if (m.cancelled) continue;
          for (const p of [m.player1, m.player2]) {
            if (!playerMatches[p]) playerMatches[p] = { completed: 0, pending: 0, group: g, weeks: [] };
            if (m.completed) playerMatches[p].completed++;
            else playerMatches[p].pending++;
            if (!playerMatches[p].weeks.includes(w + 1)) playerMatches[p].weeks.push(w + 1);
          }
        }
      }
    }
    info.playerMatches = {};
    const totals = new Set();
    for (const [name, data] of Object.entries(playerMatches)) {
      const total = data.completed + data.pending;
      totals.add(total);
      info.playerMatches[name] = { completed: data.completed, pending: data.pending, total };
    }
    if (totals.size > 1) {
      const counts = {};
      for (const [name, data] of Object.entries(playerMatches)) {
        const t = data.completed + data.pending;
        if (!counts[t]) counts[t] = [];
        counts[t].push(name);
      }
      issues.push({ type: 'UNEQUAL_TOTALS', message: 'Not all players have the same total games', details: counts });
    }

    // 2. Check for cancelled matches leaking (non-cancelled refs to removed players)
    const groupAPlayers = new Set(Object.keys(season.standings?.A || {}));
    const groupBPlayers = new Set(Object.keys(season.standings?.B || {}));
    for (const g of ['A', 'B']) {
      const groupPlayers = g === 'A' ? groupAPlayers : groupBPlayers;
      for (let w = 0; w < season.schedule[g].length; w++) {
        for (const m of (season.schedule[g][w] || [])) {
          if (m.cancelled) continue;
          if (!m.completed) {
            if (!groupPlayers.has(m.player1) && !groupPlayers.has(m.player2)) {
              issues.push({ type: 'ORPHAN_MATCH', message: `Pending match in Group ${g} Week ${w+1} between players not in group: ${m.player1} vs ${m.player2}`, matchId: m.id });
            }
          }
        }
      }
    }

    // 3. Check currentWeek alignment
    let firstPendingWeek = null;
    for (const g of ['A', 'B']) {
      for (let w = 0; w < season.schedule[g].length; w++) {
        const hasPending = (season.schedule[g][w] || []).some(m => !m.cancelled && !m.completed);
        if (hasPending && (firstPendingWeek === null || w + 1 < firstPendingWeek)) {
          firstPendingWeek = w + 1;
        }
      }
    }
    info.currentWeek = season.currentWeek;
    info.firstPendingWeek = firstPendingWeek;
    if (firstPendingWeek && season.currentWeek < firstPendingWeek) {
      issues.push({ type: 'STALE_CURRENT_WEEK', message: `currentWeek is ${season.currentWeek} but first pending matches are in week ${firstPendingWeek}` });
    }

    // 4. Check promotion flags consistency
    for (const g of ['A', 'B']) {
      const standings = season.standings?.[g] || {};
      for (const [name, data] of Object.entries(standings)) {
        if (data.promotedFrom === g) {
          issues.push({ type: 'STALE_PROMOTION_FLAG', message: `${name} in Group ${g} has promotedFrom: '${g}' (same group)`, player: name });
        }
      }
    }

    // 5. Check group balance
    const groupACount = Object.keys(season.standings?.A || {}).length;
    const groupBCount = Object.keys(season.standings?.B || {}).length;
    info.groupSizes = { A: groupACount, B: groupBCount };
    if (Math.abs(groupACount - groupBCount) > 1) {
      issues.push({ type: 'GROUP_IMBALANCE', message: `Groups are unbalanced: A has ${groupACount}, B has ${groupBCount}` });
    }

    // 6. Check for duplicate pending matches (same pair twice in POST weeks)
    const postPairs = {};
    for (const g of ['A', 'B']) {
      for (let w = 0; w < season.schedule[g].length; w++) {
        for (const m of (season.schedule[g][w] || [])) {
          if (m.cancelled || m.completed) continue;
          if (!m.id?.includes('-POST-')) continue;
          const key = [m.player1, m.player2].sort().join(' vs ');
          if (!postPairs[key]) postPairs[key] = [];
          postPairs[key].push({ week: w + 1, group: g, id: m.id });
        }
      }
    }
    const duplicates = Object.entries(postPairs).filter(([, v]) => v.length > 1);
    if (duplicates.length > 0) {
      issues.push({ type: 'DUPLICATE_POST_MATCHES', message: `${duplicates.length} pairs have multiple POST matches`, details: Object.fromEntries(duplicates) });
    }
    info.postRematches = duplicates.length;

    // 7. Check max games per player per week (should be <= 2)
    for (const g of ['A', 'B']) {
      for (let w = 0; w < season.schedule[g].length; w++) {
        const weekPlayerCount = {};
        for (const m of (season.schedule[g][w] || [])) {
          if (m.cancelled) continue;
          weekPlayerCount[m.player1] = (weekPlayerCount[m.player1] || 0) + 1;
          weekPlayerCount[m.player2] = (weekPlayerCount[m.player2] || 0) + 1;
        }
        for (const [name, count] of Object.entries(weekPlayerCount)) {
          if (count > 2) {
            issues.push({ type: 'TOO_MANY_GAMES_IN_WEEK', message: `${name} has ${count} games in Group ${g} Week ${w+1}`, player: name, week: w+1, group: g });
          }
        }
      }
    }

    res.json({
      healthy: issues.length === 0,
      issueCount: issues.length,
      issues,
      info
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Regenerate championship bracket from current standings (admin only)
app.post('/api/championship/regenerate', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT data FROM season WHERE id = 1');
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No active season' });
    }

    const season = result.rows[0].data;

    if (!season.standings?.A || !season.standings?.B) {
      return res.status(400).json({ error: 'No standings data available' });
    }

    // Check if any championship matches have been played
    const anyChampionshipPlayed =
      season.championship?.quarterfinals?.some(qf => qf.completed) ||
      season.championship?.semifinals?.some(sf => sf.completed) ||
      season.championship?.final?.completed ||
      season.championship?.playInGames?.some(p => p.completed);

    if (anyChampionshipPlayed) {
      return res.status(400).json({
        error: 'Cannot regenerate bracket - championship matches have already been played',
        message: 'To preserve match results, manually edit the bracket or delete completed matches first'
      });
    }

    // Extract wildcard winners if they exist
    let wildcardWinnerA = null;
    let wildcardWinnerB = null;
    let wildcardMatches = [];

    if (season.wildcard) {
      if (season.wildcard.wc1?.winner) {
        const wc1Player = season.standings.A[season.wildcard.wc1.winner] ? 'A' : 'B';
        if (wc1Player === 'A') wildcardWinnerA = season.wildcard.wc1.winner;
        else wildcardWinnerB = season.wildcard.wc1.winner;
        wildcardMatches.push(season.wildcard.wc1);
      }
      if (season.wildcard.wc2?.winner) {
        const wc2Player = season.standings.A[season.wildcard.wc2.winner] ? 'A' : 'B';
        if (wc2Player === 'A') wildcardWinnerA = season.wildcard.wc2.winner;
        else wildcardWinnerB = season.wildcard.wc2.winner;
        wildcardMatches.push(season.wildcard.wc2);
      }
    }

    // Regenerate the bracket
    season.championship = generateChampionshipBracket(
      season.standings.A,
      season.standings.B,
      wildcardWinnerA,
      wildcardWinnerB,
      wildcardMatches.length > 0 ? wildcardMatches : null
    );

    // Save to database
    await pool.query(
      'UPDATE season SET data = $1, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
      [JSON.stringify(season)]
    );

    res.json({
      success: true,
      message: 'Championship bracket regenerated from current standings',
      championship: {
        quarterfinals: season.championship.quarterfinals.map(q => ({
          id: q.id,
          matchName: q.matchName,
          player1: q.player1,
          player2: q.player2,
          seed1: q.seed1,
          seed2: q.seed2
        })),
        semifinals: season.championship.semifinals.map(s => ({
          id: s.id,
          matchName: s.matchName,
          player1: s.player1,
          player2: s.player2
        })),
        final: {
          id: season.championship.final.id,
          player1: season.championship.final.player1,
          player2: season.championship.final.player2
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start playoffs (admin only)
// Start wildcard round (admin only) - before playoffs
app.post('/api/season/wildcard', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT data FROM season WHERE id = 1');
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No active season' });
    }

    const season = result.rows[0].data;

    // Create snapshot before starting wildcard
    await createSeasonSnapshot(season, 'Before starting wildcard round', 'admin');

    // Generate wildcard round
    season.wildcard = generateWildcardRound(season.standings.A, season.standings.B);
    season.status = 'wildcard';

    await pool.query(`
      UPDATE season SET data = $1, status = 'wildcard', updated_at = CURRENT_TIMESTAMP WHERE id = 1
    `, [JSON.stringify(season)]);

    res.json({ success: true, wildcard: season.wildcard });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/season/playoffs', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT data FROM season WHERE id = 1');
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No active season' });
    }

    const season = result.rows[0].data;

    // Create snapshot before starting playoffs
    await createSeasonSnapshot(season, 'Before starting championship playoffs', 'admin');

    // Check if wildcard round exists and determine winners
    // New logic: Winners go to their OWN group playoffs
    let wildcardWinnerForA = null;
    let wildcardWinnerForB = null;

    if (season.wildcard) {
      // Process WC matches in order (WC1 = #5 seeds first, WC2 = #6 seeds second)
      // Each group can only have ONE wildcard challenger (higher seed takes priority)
      season.wildcard.matches.forEach(match => {
        if (match.completed && match.winner) {
          const winnerGroup = match.winner === match.player1 ? match.player1Group : match.player2Group;
          if (winnerGroup === 'A' && !wildcardWinnerForA) {
            wildcardWinnerForA = match.winner;
          } else if (winnerGroup === 'B' && !wildcardWinnerForB) {
            wildcardWinnerForB = match.winner;
          }
          // If slot already taken (two winners from same group), second winner is eliminated
        }
      });
    }

    // VALIDATION: Ensure wildcard winners are actually from their assigned groups
    if (wildcardWinnerForA && !season.standings.A[wildcardWinnerForA]) {
      console.error(`⚠️  Wildcard validation failed: ${wildcardWinnerForA} not in Group A standings`);
      wildcardWinnerForA = null; // Invalidate
    }
    if (wildcardWinnerForB && !season.standings.B[wildcardWinnerForB]) {
      console.error(`⚠️  Wildcard validation failed: ${wildcardWinnerForB} not in Group B standings`);
      wildcardWinnerForB = null; // Invalidate
    }

    // Generate combined championship bracket (top 4 from each group)
    // Only include wildcard matches if they have winners
    let wildcardMatchesToPass = null;
    if (season.wildcard?.wc1?.winner || season.wildcard?.wc2?.winner) {
      wildcardMatchesToPass = [];
      if (season.wildcard.wc1?.winner) wildcardMatchesToPass.push(season.wildcard.wc1);
      if (season.wildcard.wc2?.winner) wildcardMatchesToPass.push(season.wildcard.wc2);
    }

    season.championship = generateChampionshipBracket(
      season.standings.A,
      season.standings.B,
      wildcardWinnerForA,
      wildcardWinnerForB,
      wildcardMatchesToPass
    );
    season.status = 'playoffs';

    await pool.query(`
      UPDATE season SET data = $1, status = 'playoffs', updated_at = CURRENT_TIMESTAMP WHERE id = 1
    `, [JSON.stringify(season)]);

    res.json({ success: true, championship: season.championship });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mid-season review - swap bottom 3 from Group A with top 3 from Group B
app.post('/api/season/mid-review', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get options from request body
    const { resetStats = false } = req.body; // Option to reset stats for swapped players

    const result = await client.query('SELECT data FROM season WHERE id = 1 FOR UPDATE');
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No active season' });
    }

    const season = result.rows[0].data;

    // Create snapshot before mid-season swap
    await createSeasonSnapshot(season, `Before mid-season swap (week ${season.currentWeek})`, 'admin');

    // Check if mid-season review already happened
    if (season.midSeasonReview?.completed) {
      return res.status(400).json({
        error: 'Mid-season review already completed',
        automatic: season.midSeasonReview.automatic || false,
        completedAt: season.midSeasonReview.completedAt,
        message: season.midSeasonReview.automatic
          ? 'Mid-season swap was automatically executed when week 3 completed'
          : 'Mid-season swap was manually triggered by admin'
      });
    }

    // Check if we're at mid-season (week 3 or later)
    const midPoint = getMidSeasonWeek(season.totalWeeks);
    if (season.currentWeek < midPoint) {
      return res.status(400).json({ error: `Mid-season review available from week ${midPoint}` });
    }

    // Sort standings to find bottom 3 from A and top 3 from B
    const sortedA = sortStandings(season.standings.A);
    const sortedB = sortStandings(season.standings.B);

    // Validate minimum group sizes for swap
    if (sortedA.length < 3 || sortedB.length < 3) {
      return res.status(400).json({
        error: 'Mid-season swap requires at least 3 players in each group',
        groupASize: sortedA.length,
        groupBSize: sortedB.length
      });
    }

    // Bottom 3 from Group A (worst performers)
    const bottomA = sortedA.slice(-3);
    // Top 3 from Group B (best performers)
    const topB = sortedB.slice(0, 3);

    // Detect ties at relegation/promotion boundaries
    const tieWarnings = [];

    // Helper function to check if two players have the same record
    const haveSameRecord = (p1, p2) => {
      return p1.wins === p2.wins && p1.losses === p2.losses;
    };

    // Helper function to explain tiebreaker
    const getTiebreakerReason = (winner, loser) => {
      // Check head-to-head
      const h2hWinner = winner.headToHead?.[loser.name];
      const h2hLoser = loser.headToHead?.[winner.name];
      if (h2hWinner && h2hLoser) {
        const h2hDiffWinner = (h2hWinner.wins || 0) - (h2hWinner.losses || 0);
        const h2hDiffLoser = (h2hLoser.wins || 0) - (h2hLoser.losses || 0);
        if (h2hDiffWinner !== h2hDiffLoser) {
          return `Head-to-head record (${h2hDiffWinner > h2hDiffLoser ? winner.name : loser.name} won their matchup)`;
        }
      }
      // Check point differential
      const diffWinner = (winner.pointsFor || 0) - (winner.pointsAgainst || 0);
      const diffLoser = (loser.pointsFor || 0) - (loser.pointsAgainst || 0);
      if (diffWinner !== diffLoser) {
        return `Point differential (${winner.name}: ${diffWinner > 0 ? '+' : ''}${diffWinner}, ${loser.name}: ${diffLoser > 0 ? '+' : ''}${diffLoser})`;
      }
      // Initial seed
      return `Initial seed (${winner.name}: #${winner.initialSeed || '?'}, ${loser.name}: #${loser.initialSeed || '?'})`;
    };

    // Check Group A: Position 3 (safe) vs Position 4 (relegated)
    if (sortedA.length >= 4) {
      const safePlayer = sortedA[sortedA.length - 4]; // 3rd from bottom (safe)
      const relegatedPlayer = sortedA[sortedA.length - 3]; // 3rd from top of bottom-3 (relegated)

      if (haveSameRecord(safePlayer, relegatedPlayer)) {
        const reason = getTiebreakerReason(safePlayer, relegatedPlayer);
        tieWarnings.push({
          group: 'A',
          boundary: 'relegation',
          message: `Tie at Group A relegation boundary (positions ${sortedA.length - 3}-${sortedA.length - 2})`,
          safePlayer: {
            name: safePlayer.name,
            position: sortedA.length - 3,
            record: `${safePlayer.wins}-${safePlayer.losses}`,
            pointDiff: (safePlayer.pointsFor || 0) - (safePlayer.pointsAgainst || 0)
          },
          relegatedPlayer: {
            name: relegatedPlayer.name,
            position: sortedA.length - 2,
            record: `${relegatedPlayer.wins}-${relegatedPlayer.losses}`,
            pointDiff: (relegatedPlayer.pointsFor || 0) - (relegatedPlayer.pointsAgainst || 0)
          },
          tiebreakerUsed: reason
        });
      }
    }

    // Check Group B: Position 3 (promoted) vs Position 4 (safe)
    if (sortedB.length >= 4) {
      const promotedPlayer = sortedB[2]; // 3rd place (promoted)
      const safePlayer = sortedB[3]; // 4th place (safe)

      if (haveSameRecord(promotedPlayer, safePlayer)) {
        const reason = getTiebreakerReason(promotedPlayer, safePlayer);
        tieWarnings.push({
          group: 'B',
          boundary: 'promotion',
          message: `Tie at Group B promotion boundary (positions 3-4)`,
          promotedPlayer: {
            name: promotedPlayer.name,
            position: 3,
            record: `${promotedPlayer.wins}-${promotedPlayer.losses}`,
            pointDiff: (promotedPlayer.pointsFor || 0) - (promotedPlayer.pointsAgainst || 0)
          },
          safePlayer: {
            name: safePlayer.name,
            position: 4,
            record: `${safePlayer.wins}-${safePlayer.losses}`,
            pointDiff: (safePlayer.pointsFor || 0) - (safePlayer.pointsAgainst || 0)
          },
          tiebreakerUsed: reason
        });
      }
    }

    // Record the swaps
    const swaps = {
      fromAtoB: bottomA.map(p => p.name),
      fromBtoA: topB.map(p => p.name),
      tieWarnings: tieWarnings.length > 0 ? tieWarnings : undefined
    };

    // Update groups
    const newGroupAPlayers = season.groups.A.players.filter(p => !swaps.fromAtoB.includes(p.name));
    const newGroupBPlayers = season.groups.B.players.filter(p => !swaps.fromBtoA.includes(p.name));

    // Add swapped players
    swaps.fromBtoA.forEach(name => {
      const player = season.groups.B.players.find(p => p.name === name);
      if (player) newGroupAPlayers.push({ ...player, promotedMidSeason: true });
    });
    swaps.fromAtoB.forEach(name => {
      const player = season.groups.A.players.find(p => p.name === name);
      if (player) newGroupBPlayers.push({ ...player, relegatedMidSeason: true });
    });

    season.groups.A.players = newGroupAPlayers;
    season.groups.B.players = newGroupBPlayers;

    // Move standings data (with optional stats reset)
    swaps.fromAtoB.forEach(name => {
      const oldStats = season.standings.A[name];
      const baseStats = resetStats ? {
        wins: 0, losses: 0, points: 0,
        pointsFor: 0, pointsAgainst: 0,
        streak: 0, lastResults: [],
        headToHead: {}
      } : { ...oldStats };

      season.standings.B[name] = {
        ...baseStats,
        initialSeed: oldStats.initialSeed, // Keep original seed for tiebreaker
        relegatedFrom: 'A',
        preSwapStats: { ...oldStats } // Always keep record of old stats
      };
      delete season.standings.A[name];
    });
    swaps.fromBtoA.forEach(name => {
      const oldStats = season.standings.B[name];
      const baseStats = resetStats ? {
        wins: 0, losses: 0, points: 0,
        pointsFor: 0, pointsAgainst: 0,
        streak: 0, lastResults: [],
        headToHead: {}
      } : { ...oldStats };

      season.standings.A[name] = {
        ...baseStats,
        initialSeed: oldStats.initialSeed, // Keep original seed for tiebreaker
        promotedFrom: 'B',
        preSwapStats: { ...oldStats } // Always keep record of old stats
      };
      delete season.standings.B[name];
    });

    // Cancel remaining matches for swapped players in their old groups
    const cancelledMatches = [];
    ['A', 'B'].forEach(group => {
      const swappedPlayers = group === 'A' ? swaps.fromAtoB : swaps.fromBtoA;
      season.schedule[group].forEach((week, weekIdx) => {
        if (weekIdx + 1 > season.currentWeek) {
          week.forEach(match => {
            if (!match.completed && (swappedPlayers.includes(match.player1) || swappedPlayers.includes(match.player2))) {
              match.cancelled = true;
              match.cancelReason = 'Mid-season group swap';
              cancelledMatches.push(match.id);
            }
          });
        }
      });
    });

    // Generate new matches for swapped players in their new groups
    // PRIORITY MATCHING: Match swapped players against similarly-ranked opponents
    const remainingWeeks = season.totalWeeks - season.currentWeek;
    const newMatches = { A: [], B: [] };

    // Helper: Get rank-prioritized opponents for a swapped player
    const getPriorityOpponents = (playerName, newGroup, swappedPlayers, oldRank) => {
      // Get all potential opponents (excluding other swapped players)
      const allOpponents = season.groups[newGroup].players
        .filter(p => p.name !== playerName && !swappedPlayers.includes(p.name))
        .map(p => ({
          name: p.name,
          stats: season.standings[newGroup][p.name]
        }));

      // Sort opponents by current standings to get their ranks
      const sortedOpponents = sortStandings(
        Object.fromEntries(allOpponents.map(o => [o.name, o.stats]))
      );

      // Priority tiers based on old rank
      // If player was bottom 3 (ranks 6-8), prioritize mid-bottom tier opponents (ranks 4-8)
      // If player was top 3 (ranks 1-3), prioritize top-mid tier opponents (ranks 1-4)
      let priorityOpponents = [];
      let secondaryOpponents = [];

      if (oldRank >= 6) {
        // Relegated player - prioritize lower-ranked opponents in new group
        priorityOpponents = sortedOpponents.slice(3); // Ranks 4+ in new group
        secondaryOpponents = sortedOpponents.slice(0, 3); // Top 3 in new group
      } else if (oldRank <= 3) {
        // Promoted player - prioritize higher-ranked opponents in new group
        priorityOpponents = sortedOpponents.slice(0, 4); // Top 4 in new group
        secondaryOpponents = sortedOpponents.slice(4); // Ranks 5+ in new group
      } else {
        // Mid-tier swap - mix evenly
        priorityOpponents = sortedOpponents;
        secondaryOpponents = [];
      }

      // Combine: priority first, then secondary
      return [...priorityOpponents, ...secondaryOpponents];
    };

    // Create matches for promoted players (from B to A)
    swaps.fromBtoA.forEach((playerName, swapIdx) => {
      const oldRank = swapIdx + 1; // They were B#1, B#2, or B#3
      const opponents = getPriorityOpponents(playerName, 'A', swaps.fromBtoA, oldRank);

      opponents.forEach((opp, idx) => {
        if (idx < remainingWeeks) {
          const weekNum = season.currentWeek + 1 + idx;
          const matchId = `A-W${weekNum}-SWAP-${playerName.replace(/\s/g, '')}-${opp.name.replace(/\s/g, '')}`;
          newMatches.A.push({
            id: matchId,
            week: weekNum,
            player1: playerName,
            player2: opp.name,
            group: 'A',
            completed: false,
            winner: null,
            loser: null,
            score1: null,
            score2: null,
            isSwapMatch: true,
            priorityMatch: idx < Math.ceil(remainingWeeks * 0.6) // First 60% are priority
          });
        }
      });
    });

    // Create matches for relegated players (from A to B)
    swaps.fromAtoB.forEach((playerName, swapIdx) => {
      const oldRank = sortedA.length - 2 + swapIdx; // They were A#(n-2), A#(n-1), or A#n
      const opponents = getPriorityOpponents(playerName, 'B', swaps.fromAtoB, oldRank);

      opponents.forEach((opp, idx) => {
        if (idx < remainingWeeks) {
          const weekNum = season.currentWeek + 1 + idx;
          const matchId = `B-W${weekNum}-SWAP-${playerName.replace(/\s/g, '')}-${opp.name.replace(/\s/g, '')}`;
          newMatches.B.push({
            id: matchId,
            week: weekNum,
            player1: playerName,
            player2: opp.name,
            group: 'B',
            completed: false,
            winner: null,
            loser: null,
            score1: null,
            score2: null,
            isSwapMatch: true,
            priorityMatch: idx < Math.ceil(remainingWeeks * 0.6) // First 60% are priority
          });
        }
      });
    });

    // Add new matches to schedule
    newMatches.A.forEach(match => {
      const weekIdx = match.week - 1;
      if (season.schedule.A[weekIdx]) {
        season.schedule.A[weekIdx].push(match);
      }
    });
    newMatches.B.forEach(match => {
      const weekIdx = match.week - 1;
      if (season.schedule.B[weekIdx]) {
        season.schedule.B[weekIdx].push(match);
      }
    });

    // Cancel bookings for cancelled matches AND tentative bookings for swapped players
    await ensureBookingsTable();
    let cancelledBookings = 0;

    // Cancel bookings for cancelled matches
    for (const matchId of cancelledMatches) {
      const result = await client.query(
        'UPDATE table_bookings SET status = $1, cancel_reason = $2 WHERE match_id = $3 AND status IN ($4, $5)',
        ['cancelled', 'Mid-season group swap - match cancelled', matchId, 'booked', 'tentative']
      );
      cancelledBookings += result.rowCount;
    }

    // Cancel ALL tentative bookings for swapped players (even if match not cancelled)
    const allSwappedPlayers = [...swaps.fromAtoB, ...swaps.fromBtoA];
    for (const playerName of allSwappedPlayers) {
      const result = await client.query(`
        UPDATE table_bookings
        SET status = 'cancelled', cancel_reason = 'Mid-season group swap - player changed groups'
        WHERE (player1 = $1 OR player2 = $1)
          AND status = 'tentative'
          AND booking_date > CURRENT_DATE
      `, [playerName]);
      cancelledBookings += result.rowCount;
    }

    // Record the mid-season review
    season.midSeasonReview = {
      completed: true,
      completedAt: new Date().toISOString(),
      week: season.currentWeek,
      swaps: swaps,
      cancelledMatches: cancelledMatches,
      newMatchesCreated: newMatches.A.length + newMatches.B.length,
      cancelledBookings: cancelledBookings,
      statsReset: resetStats, // Whether stats were reset for swapped players
      priorityMatching: true // Priority matching system enabled
    };

    await client.query(`
      UPDATE season SET data = $1, updated_at = CURRENT_TIMESTAMP WHERE id = 1
    `, [JSON.stringify(season)]);

    await client.query('COMMIT');

    // Notify swapped players
    for (const playerName of swaps.fromBtoA) {
      await createNotification(
        playerName,
        'mid_season_swap',
        '🎉 Promoted to Group A!',
        resetStats
          ? `Congratulations! You've been promoted to Group A (Seeded). Your stats have been reset and you'll face top-tier opponents.`
          : `Congratulations! You've been promoted to Group A (Seeded). You'll be matched against top-tier opponents based on your rank.`,
        '#standings'
      );
    }
    for (const playerName of swaps.fromAtoB) {
      await createNotification(
        playerName,
        'mid_season_swap',
        '📉 Moved to Group B',
        resetStats
          ? `You've been moved to Group B (Unseeded) at mid-season review. Your stats have been reset - fresh start against similar-level opponents!`
          : `You've been moved to Group B (Unseeded) at mid-season review. You'll face similar-level opponents. Keep fighting!`,
        '#standings'
      );
    }

    res.json({
      success: true,
      swaps,
      message: `Swapped ${swaps.fromAtoB.length} players from A→B and ${swaps.fromBtoA.length} players from B→A`,
      cancelledMatches: cancelledMatches.length,
      newMatchesCreated: newMatches.A.length + newMatches.B.length,
      cancelledBookings,
      statsReset: resetStats,
      priorityMatching: {
        enabled: true,
        description: resetStats
          ? 'Swapped players start fresh (0-0) and are matched against similarly-ranked opponents'
          : 'Swapped players keep their stats and are matched against similarly-ranked opponents'
      },
      ...(tieWarnings.length > 0 && {
        tieWarnings: tieWarnings,
        tieWarningMessage: `⚠️ ${tieWarnings.length} tie(s) detected at relegation/promotion boundary - tiebreakers were used to determine final placements`
      })
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Get swap zone status (F1-style elimination zone indicators)
app.get('/api/season/swap-zone', async (req, res) => {
  try {
    const result = await pool.query('SELECT data FROM season WHERE id = 1');
    if (result.rows.length === 0) {
      return res.json({ active: false });
    }

    const season = result.rows[0].data;

    // NEW: Game-based swap trigger instead of week-based
    // Count players who have completed >= 4 games
    const allPlayers = [...Object.entries(season.standings.A), ...Object.entries(season.standings.B)];
    const totalPlayers = allPlayers.length;
    const playersAt4Games = allPlayers.filter(([name, stats]) => (stats.wins + stats.losses) >= 4).length;
    const allPlayersReady = playersAt4Games === totalPlayers;

    // Swap zone only active during regular season before swap is completed
    if (season.status !== 'regular' || season.midSeasonReview?.completed) {
      return res.json({
        active: false,
        reason: season.midSeasonReview?.completed ? 'Mid-season swap already completed' :
                'Not in regular season'
      });
    }

    const sortedA = sortStandings(season.standings.A);
    const sortedB = sortStandings(season.standings.B);

    // If not all players have 4 games yet, show progress without triggering swap
    if (!allPlayersReady) {
      return res.json({
        active: true,
        swapReady: false,
        playersReady: playersAt4Games,
        totalPlayers,
        gamesRequired: 4,
        message: `${playersAt4Games}/${totalPlayers} players have completed 4 games`,
        progressMessage: `Waiting for all players to reach 4 games before mid-season swap`,
        relegationZone: sortedA.slice(-3).map((p, i) => ({
          name: p.name,
          rank: sortedA.length - 2 + i,
          group: 'A',
          wins: p.wins,
          losses: p.losses,
          gamesPlayed: p.wins + p.losses
        })),
        promotionZone: sortedB.slice(0, 3).map((p, i) => ({
          name: p.name,
          rank: i + 1,
          group: 'B',
          wins: p.wins,
          losses: p.losses,
          gamesPlayed: p.wins + p.losses
        }))
      });
    }

    // Bottom 3 of Group A = RELEGATION ZONE (danger)
    // Top 3 of Group B = PROMOTION ZONE (opportunity)
    const relegationZone = sortedA.slice(-3).map((p, i) => ({
      name: p.name,
      rank: sortedA.length - 2 + i,
      group: 'A',
      wins: p.wins,
      losses: p.losses,
      diff: p.pointsFor - p.pointsAgainst,
      status: 'RELEGATION',
      message: `Currently #${sortedA.length - 2 + i} in Group A - Bottom 3 swap to Group B at mid-season!`
    }));

    const promotionZone = sortedB.slice(0, 3).map((p, i) => ({
      name: p.name,
      rank: i + 1,
      group: 'B',
      wins: p.wins,
      losses: p.losses,
      diff: p.pointsFor - p.pointsAgainst,
      status: 'PROMOTION',
      message: `Currently #${i + 1} in Group B - Top 3 promote to Group A at mid-season!`
    }));

    // Players just outside the zones (on the bubble)
    const bubbleA = sortedA.length > 3 ? [{
      name: sortedA[sortedA.length - 4].name,
      rank: sortedA.length - 3,
      group: 'A',
      wins: sortedA[sortedA.length - 4].wins,
      losses: sortedA[sortedA.length - 4].losses,
      diff: sortedA[sortedA.length - 4].pointsFor - sortedA[sortedA.length - 4].pointsAgainst,
      status: 'BUBBLE',
      message: `#${sortedA.length - 3} in Group A - One loss away from relegation zone!`
    }] : [];

    const bubbleB = sortedB.length > 3 ? [{
      name: sortedB[3].name,
      rank: 4,
      group: 'B',
      wins: sortedB[3].wins,
      losses: sortedB[3].losses,
      diff: sortedB[3].pointsFor - sortedB[3].pointsAgainst,
      status: 'BUBBLE',
      message: `#4 in Group B - One win away from promotion zone!`
    }] : [];

    // All players have 4+ games - SWAP IS READY!
    res.json({
      active: true,
      swapReady: true,
      playersReady: totalPlayers,
      totalPlayers,
      gamesRequired: 4,
      message: 'All players have completed 4 games - Ready for mid-season swap!',
      urgencyMessage: '⚠️ SWAP READY: All players have reached 4 games. Admin can now trigger the mid-season swap!',
      relegationZone,
      promotionZone,
      bubble: [...bubbleA, ...bubbleB],
      swapRules: [
        'When all players complete 4 games:',
        '• Bottom 3 from Group A (Seeded) move DOWN to Group B',
        '• Top 3 from Group B (Unseeded) move UP to Group A',
        'Players with 4+ games cannot book more until swap completes!'
      ]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get mid-season review preview (shows who would be swapped without executing)
app.get('/api/season/mid-review/preview', async (req, res) => {
  try {
    const result = await pool.query('SELECT data FROM season WHERE id = 1');
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No active season' });
    }

    const season = result.rows[0].data;

    if (season.midSeasonReview?.completed) {
      return res.json({
        alreadyCompleted: true,
        review: season.midSeasonReview
      });
    }

    const midPoint = getMidSeasonWeek(season.totalWeeks);
    const sortedA = sortStandings(season.standings.A);
    const sortedB = sortStandings(season.standings.B);

    const bottomA = sortedA.slice(-3);
    const topB = sortedB.slice(0, 3);

    res.json({
      available: season.currentWeek >= midPoint,
      currentWeek: season.currentWeek,
      midPoint,
      preview: {
        relegateFromA: bottomA.map(p => ({
          name: p.name,
          rank: sortedA.findIndex(s => s.name === p.name) + 1,
          wins: p.wins,
          losses: p.losses,
          diff: p.pointsFor - p.pointsAgainst
        })),
        promoteFromB: topB.map(p => ({
          name: p.name,
          rank: sortedB.findIndex(s => s.name === p.name) + 1,
          wins: p.wins,
          losses: p.losses,
          diff: p.pointsFor - p.pointsAgainst
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Advance to next week (admin only)
app.post('/api/season/next-week', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT data FROM season WHERE id = 1');
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No active season' });
    }

    const season = result.rows[0].data;

    if (season.currentWeek < season.totalWeeks) {
      season.currentWeek++;
      await pool.query(`
        UPDATE season SET data = $1, current_week = $2, updated_at = CURRENT_TIMESTAMP WHERE id = 1
      `, [JSON.stringify(season), season.currentWeek]);
    }

    res.json({ success: true, currentWeek: season.currentWeek });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Force advance to next week (marks incomplete matches as cancelled/forfeit)
app.post('/api/season/force-next-week', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query('SELECT data FROM season WHERE id = 1 FOR UPDATE');
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No active season' });
    }

    const season = result.rows[0].data;
    const { markIncompleteAs = 'cancelled' } = req.body; // 'cancelled' or 'forfeit'

    if (!['cancelled', 'forfeit'].includes(markIncompleteAs)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'markIncompleteAs must be "cancelled" or "forfeit"' });
    }

    // Create snapshot before forcing week advance
    await createSeasonSnapshot(season, `Before force-advance from week ${season.currentWeek}`, 'admin');

    // Mark all incomplete current week matches
    let markedCount = 0;
    ['A', 'B'].forEach(g => {
      const weekSchedule = season.schedule[g][season.currentWeek - 1];
      if (weekSchedule) {
        weekSchedule.forEach(match => {
          if (!match.completed && !match.cancelled) {
            if (markIncompleteAs === 'cancelled') {
              match.cancelled = true;
              match.cancelReason = 'Admin force-advanced week';
            } else {
              match.completed = true;
              match.winner = null;
              match.loser = null;
              match.forfeit = true;
            }
            markedCount++;
          }
        });
      }
    });

    // Advance week
    if (season.currentWeek < season.totalWeeks) {
      season.currentWeek++;
    }

    await client.query(`
      UPDATE season SET data = $1, current_week = $2, updated_at = CURRENT_TIMESTAMP WHERE id = 1
    `, [JSON.stringify(season), season.currentWeek]);

    await client.query('COMMIT');

    res.json({
      success: true,
      currentWeek: season.currentWeek,
      markedAs: markIncompleteAs,
      matchesMarked: markedCount,
      message: `Advanced to week ${season.currentWeek}. ${markedCount} incomplete matches marked as ${markIncompleteAs}.`
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Delete season (admin only) - use with caution
app.delete('/api/season', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM season WHERE id = 1');
    res.json({ success: true, message: 'Season deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ HISTORICAL SEASONS ============

// Ensure season_archive table exists
const ensureArchiveTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS season_archive (
      id SERIAL PRIMARY KEY,
      season_number INTEGER NOT NULL,
      name VARCHAR(255) NOT NULL,
      champion VARCHAR(255),
      runner_up VARCHAR(255),
      group_a_champion VARCHAR(255),
      group_b_champion VARCHAR(255),
      total_matches INTEGER,
      start_date DATE,
      end_date DATE,
      data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

// Ensure season_snapshots table exists for rollback capability
const ensureSnapshotsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS season_snapshots (
      id SERIAL PRIMARY KEY,
      season_id INTEGER NOT NULL DEFAULT 1,
      snapshot_data JSONB NOT NULL,
      reason VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by VARCHAR(255)
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_snapshots_season ON season_snapshots(season_id, created_at DESC)');
};

// Create snapshot before major season mutations
const createSeasonSnapshot = async (season, reason, createdBy = 'system') => {
  try {
    await ensureSnapshotsTable();
    await pool.query(`
      INSERT INTO season_snapshots (season_id, snapshot_data, reason, created_by)
      VALUES (1, $1, $2, $3)
    `, [JSON.stringify(season), reason, createdBy]);

    // Keep only last 20 snapshots
    await pool.query(`
      DELETE FROM season_snapshots
      WHERE id NOT IN (
        SELECT id FROM season_snapshots
        WHERE season_id = 1
        ORDER BY created_at DESC
        LIMIT 20
      ) AND season_id = 1
    `);
  } catch (e) {
    console.error('Failed to create snapshot:', e.message);
  }
};

// Archive current season (admin only) - call this before starting new season
app.post('/api/season/archive', requireAdmin, async (req, res) => {
  try {
    await ensureArchiveTable();

    const result = await pool.query('SELECT data FROM season WHERE id = 1');
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No active season to archive' });
    }

    const season = result.rows[0].data;

    if (season.status !== 'complete') {
      return res.status(400).json({ error: 'Can only archive completed seasons' });
    }

    // Get next season number
    const countResult = await pool.query('SELECT COUNT(*) as count FROM season_archive');
    const seasonNumber = parseInt(countResult.rows[0].count) + 1;

    // Count total matches
    const totalMatches = ['A', 'B'].reduce((sum, g) => {
      return sum + (season.schedule[g] || []).flat().filter(m => m.completed).length;
    }, 0);

    // Archive the season
    await pool.query(`
      INSERT INTO season_archive (season_number, name, champion, runner_up, group_a_champion, group_b_champion, total_matches, data)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      seasonNumber,
      season.name || `Season ${seasonNumber}`,
      season.champion,
      season.superBowl?.player1 === season.champion ? season.superBowl?.player2 : season.superBowl?.player1,
      season.playoffs?.A?.champion,
      season.playoffs?.B?.champion,
      totalMatches,
      JSON.stringify(season)
    ]);

    // Log the archive
    await pool.query(
      `INSERT INTO activity_log (event_type, player_name, details) VALUES ($1, $2, $3)`,
      ['season_archived', season.champion, JSON.stringify({
        seasonNumber,
        champion: season.champion,
        archivedAt: new Date().toISOString()
      })]
    );

    res.json({
      success: true,
      seasonNumber,
      champion: season.champion,
      message: `Season ${seasonNumber} archived successfully!`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all archived seasons
app.get('/api/seasons/history', async (req, res) => {
  try {
    await ensureArchiveTable();

    const result = await pool.query(`
      SELECT id, season_number, name, champion, runner_up, group_a_champion, group_b_champion, total_matches, created_at
      FROM season_archive
      ORDER BY season_number DESC
    `);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific archived season details
app.get('/api/seasons/history/:seasonNumber', async (req, res) => {
  try {
    await ensureArchiveTable();

    const { seasonNumber } = req.params;
    const result = await pool.query(
      'SELECT * FROM season_archive WHERE season_number = $1',
      [seasonNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Season not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ SEASON SNAPSHOTS & ROLLBACK ============

// Get all snapshots for current season (admin only)
app.get('/api/season/snapshots', requireAdmin, async (req, res) => {
  try {
    await ensureSnapshotsTable();

    const result = await pool.query(`
      SELECT id, reason, created_at, created_by
      FROM season_snapshots
      WHERE season_id = 1
      ORDER BY created_at DESC
      LIMIT 20
    `);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rollback to a specific snapshot (admin only)
app.post('/api/season/rollback/:snapshotId', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureSnapshotsTable();

    const { snapshotId } = req.params;

    // Get the snapshot
    const snapshotResult = await client.query(
      'SELECT snapshot_data, reason, created_at FROM season_snapshots WHERE id = $1 AND season_id = 1',
      [snapshotId]
    );

    if (snapshotResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Snapshot not found' });
    }

    const snapshot = snapshotResult.rows[0];

    // Create a snapshot of current state before rollback (for undo)
    const currentResult = await client.query('SELECT data FROM season WHERE id = 1');
    if (currentResult.rows.length > 0) {
      await client.query(`
        INSERT INTO season_snapshots (season_id, snapshot_data, reason, created_by)
        VALUES (1, $1, $2, $3)
      `, [
        JSON.stringify(currentResult.rows[0].data),
        `Before rollback to snapshot #${snapshotId}`,
        'rollback_system'
      ]);
    }

    // Restore the snapshot
    const restoredSeason = snapshot.snapshot_data;

    await client.query(`
      UPDATE season SET
        data = $1,
        status = $2,
        current_week = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `, [
      JSON.stringify(restoredSeason),
      restoredSeason.status,
      restoredSeason.currentWeek
    ]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Season rolled back to: ${snapshot.reason}`,
      snapshotDate: snapshot.created_at,
      restoredWeek: restoredSeason.currentWeek,
      restoredStatus: restoredSeason.status
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ============ NOTIFICATIONS ============

// Ensure notifications table exists
const ensureNotificationsTable = async () => {
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
};

// Get notifications for a player
app.get('/api/notifications/:playerName', async (req, res) => {
  try {
    await ensureNotificationsTable();

    // Auto-cleanup: Delete notifications older than 30 days
    await pool.query(`
      DELETE FROM notifications
      WHERE created_at < NOW() - INTERVAL '30 days'
    `);

    const { playerName } = req.params;
    // Only show notifications from last 30 days
    const result = await pool.query(`
      SELECT * FROM notifications
      WHERE (player_name = $1 OR player_name IS NULL)
        AND created_at > NOW() - INTERVAL '30 days'
      ORDER BY created_at DESC
      LIMIT 50
    `, [playerName]);

    const unreadCount = result.rows.filter(n => !n.is_read).length;

    res.json({
      notifications: result.rows,
      unreadCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark notification as read
app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    await ensureNotificationsTable();

    const { id } = req.params;
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = $1', [id]);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark all notifications as read for a player
app.put('/api/notifications/:playerName/read-all', async (req, res) => {
  try {
    await ensureNotificationsTable();

    const { playerName } = req.params;
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE player_name = $1 OR player_name IS NULL',
      [playerName]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create notification (internal helper)
const createNotification = async (playerName, type, title, message, link = null) => {
  try {
    await ensureNotificationsTable();
    const result = await pool.query(
      `INSERT INTO notifications (player_name, type, title, message, link) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [playerName, type, title, message, link]
    );
    console.log(`✅ Notification created [ID: ${result.rows[0].id}] for ${playerName || 'ALL'}: ${title}`);
  } catch (e) {
    console.error('❌ Failed to create notification:', e.message);
  }
};

// Send reminders for upcoming bookings (called by Vercel cron every 15 min)
app.post('/api/notifications/send-reminders', requireAdminOrCron, async (req, res) => {
  try {
    await ensureNotificationsTable();
    await ensureBookingsTable();

    // Find bookings happening in the next hour that haven't been reminded
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5);
    const oneHourTime = oneHourFromNow.toTimeString().slice(0, 5);

    // Get bookings for today that start within the next hour
    const bookings = await pool.query(`
      SELECT * FROM table_bookings
      WHERE booking_date = $1
        AND start_time > $2
        AND start_time <= $3
        AND status = 'booked'
        AND (reminded IS NULL OR reminded = FALSE)
    `, [today, currentTime, oneHourTime]);

    let remindersSent = 0;

    for (const booking of bookings.rows) {
      // Send reminder to both players
      await createNotification(
        booking.player1,
        'match_reminder',
        '⏰ Match in 1 Hour!',
        `Your match vs ${booking.player2} is at ${booking.start_time} today`,
        '#schedule'
      );
      await createNotification(
        booking.player2,
        'match_reminder',
        '⏰ Match in 1 Hour!',
        `Your match vs ${booking.player1} is at ${booking.start_time} today`,
        '#schedule'
      );

      // Mark as reminded
      await pool.query('UPDATE table_bookings SET reminded = TRUE WHERE id = $1', [booking.id]);
      remindersSent++;
    }

    res.json({ success: true, remindersSent });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send weekly summary (called by Vercel cron every Monday 9 AM)
app.post('/api/notifications/weekly-summary', requireAdminOrCron, async (req, res) => {
  try {
    await ensureNotificationsTable();

    // Get current season
    const seasonResult = await pool.query('SELECT data FROM season WHERE id = 1');
    if (seasonResult.rows.length === 0) {
      return res.json({ success: false, message: 'No active season' });
    }

    const season = seasonResult.rows[0].data;

    // Check if we're in regular season
    if (season.status !== 'regular') {
      return res.json({ success: false, message: 'Not in regular season' });
    }

    // Get leaderboard
    const leaderboardResult = await pool.query(`
      SELECT player_name, weekly_wins, weekly_losses, weekly_points
      FROM leaderboard
      ORDER BY weekly_points DESC, weekly_wins DESC
      LIMIT 5
    `);

    const topPlayers = leaderboardResult.rows;

    // Send summary to all players
    const title = `📊 Week ${season.currentWeek} Summary`;
    const topPlayersText = topPlayers.map((p, i) =>
      `${i + 1}. ${p.player_name}: ${p.weekly_wins}W-${p.weekly_losses}L (${p.weekly_points} pts)`
    ).join('\n');

    const message = `Week ${season.currentWeek} leaderboard:\n\n${topPlayersText}\n\nGreat games everyone!`;

    // Broadcast to everyone
    await createNotification(null, 'weekly_summary', title, message, '#standings');

    // Reset weekly stats (optional - depends on your logic)
    // Uncomment if you want weekly stats to reset every Monday
    // await pool.query(`
    //   UPDATE leaderboard
    //   SET weekly_wins = 0, weekly_losses = 0, weekly_points = 0,
    //       weekly_matches_played = 0, week_start = CURRENT_DATE
    // `);

    res.json({ success: true, message: 'Weekly summary sent', recipients: 'all players' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Broadcast notification to all players (admin)
app.post('/api/notifications/broadcast', requireAdmin, async (req, res) => {
  try {
    await ensureNotificationsTable();

    const { title, message, type = 'announcement' } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message required' });
    }

    // null player_name means it's for everyone
    await pool.query(
      `INSERT INTO notifications (player_name, type, title, message) VALUES ($1, $2, $3, $4)`,
      [null, type, title, message]
    );

    res.json({ success: true, message: 'Broadcast sent to all players' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send manual notification (admin-triggered)
app.post('/api/notifications/send-manual', requireAdmin, async (req, res) => {
  try {
    await ensureNotificationsTable();

    const { recipient, title, message } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message required' });
    }

    if (!recipient) {
      return res.status(400).json({ error: 'Recipient required' });
    }

    let recipientCount = 0;

    if (recipient === 'all') {
      // Send to everyone
      await createNotification(null, 'manual', title, message, null);

      // Count all players with push subscriptions
      const countResult = await pool.query('SELECT COUNT(DISTINCT player_name) as count FROM push_subscriptions');
      recipientCount = countResult.rows[0]?.count || 0;

    } else if (recipient === 'groupA' || recipient === 'groupB') {
      // Send to specific group
      const seasonResult = await pool.query('SELECT data FROM season WHERE id = 1');

      if (seasonResult.rows.length === 0) {
        return res.status(400).json({ error: 'No active season found' });
      }

      const season = seasonResult.rows[0].data;
      const group = recipient === 'groupA' ? 'A' : 'B';
      const players = Object.keys(season.standings?.[group] || {});

      if (players.length === 0) {
        return res.status(400).json({ error: `Group ${group} has no players` });
      }

      // Send notification to each player in the group
      for (const playerName of players) {
        await createNotification(playerName, 'manual', title, message, null);
      }

      recipientCount = players.length;

    } else {
      // Send to specific player
      await createNotification(recipient, 'manual', title, message, null);
      recipientCount = 1;
    }

    res.json({
      success: true,
      message: 'Manual notification sent',
      recipientCount,
      recipient: recipient === 'all' ? 'all players' :
                 recipient === 'groupA' ? 'Group A' :
                 recipient === 'groupB' ? 'Group B' : recipient
    });

  } catch (error) {
    console.error('Manual notification error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete old notifications (admin)
app.delete('/api/notifications/cleanup', requireAdmin, async (req, res) => {
  try {
    await ensureNotificationsTable();

    const { daysOld = 30 } = req.body;

    const result = await pool.query(
      `DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '${parseInt(daysOld)} days' RETURNING *`
    );

    res.json({
      success: true,
      deleted: result.rowCount,
      message: `Deleted ${result.rowCount} notifications older than ${daysOld} days`
    });
  } catch (error) {
    console.error('Notification cleanup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete ALL notifications (admin - use with caution!)
app.delete('/api/notifications/delete-all', requireAdmin, async (req, res) => {
  try {
    await ensureNotificationsTable();

    const result = await pool.query('DELETE FROM notifications RETURNING *');

    res.json({
      success: true,
      deleted: result.rowCount,
      message: `Deleted all ${result.rowCount} notifications`
    });
  } catch (error) {
    console.error('Notification delete all error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ LEAGUE REGISTRATION SYSTEM ============

// Ensure registration tables exist
const ensureRegistrationTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS league_registration (
      id SERIAL PRIMARY KEY,
      player_name VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      is_ranked BOOLEAN DEFAULT FALSE,
      matched_player_id INTEGER,
      suggested_seed INTEGER,
      admin_approved BOOLEAN DEFAULT FALSE,
      final_seed INTEGER,
      registration_status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(player_name)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS league_config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      season_name VARCHAR(255) DEFAULT 'Winter League 2026',
      registration_open BOOLEAN DEFAULT TRUE,
      registration_close_date TIMESTAMP,
      league_start_date DATE,
      max_players INTEGER DEFAULT 32,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS league_matches (
      id SERIAL PRIMARY KEY,
      round INTEGER NOT NULL,
      match_number INTEGER NOT NULL,
      player1 VARCHAR(255),
      player2 VARCHAR(255),
      seed1 INTEGER,
      seed2 INTEGER,
      winner VARCHAR(255),
      score VARCHAR(50),
      is_bye BOOLEAN DEFAULT FALSE,
      completed BOOLEAN DEFAULT FALSE,
      scheduled_date DATE,
      scheduled_week INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Insert default config if not exists
  await pool.query(`
    INSERT INTO league_config (id, season_name, registration_open)
    VALUES (1, 'Winter League 2026', TRUE)
    ON CONFLICT (id) DO NOTHING
  `);
};

// Get registration config and status
app.get('/api/registration/config', cacheResponse(60), async (req, res) => {
  try {
    await ensureRegistrationTables();

    const configResult = await pool.query('SELECT * FROM league_config WHERE id = 1');
    const countResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE registration_status = 'approved') as approved,
        COUNT(*) FILTER (WHERE registration_status = 'pending') as pending,
        COUNT(*) FILTER (WHERE is_ranked = TRUE) as ranked
      FROM league_registration
    `);

    const config = configResult.rows[0] || {
      season_name: 'Winter League 2026',
      registration_open: true,
      max_players: 32
    };

    res.json({
      ...config,
      stats: countResult.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update registration config (admin)
app.put('/api/registration/config', requireAdmin, async (req, res) => {
  try {
    await ensureRegistrationTables();

    const { season_name, registration_open, registration_close_date, league_start_date, max_players } = req.body;

    await pool.query(`
      UPDATE league_config SET
        season_name = COALESCE($1, season_name),
        registration_open = COALESCE($2, registration_open),
        registration_close_date = $3,
        league_start_date = $4,
        max_players = COALESCE($5, max_players),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `, [season_name, registration_open, registration_close_date, league_start_date, max_players]);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Register a player (public)
app.post('/api/registration/register', async (req, res) => {
  const startTime = Date.now();
  console.log('📝 Registration attempt started:', req.body.playerName);

  // Set a response timeout (declared outside try so catch can clear it)
  const timeoutId = setTimeout(() => {
    if (!res.headersSent) {
      console.error('⏰ Registration timeout after 25 seconds');
      res.status(504).json({ error: 'Registration timeout. Please try again.' });
    }
  }, 25000); // 25 second timeout (Vercel has 30s limit)

  try {

    await ensureRegistrationTables();
    console.log('✓ Tables ensured, took:', Date.now() - startTime, 'ms');

    // Check if registration is open
    const configResult = await pool.query('SELECT * FROM league_config WHERE id = 1');
    const config = configResult.rows[0];

    if (!config?.registration_open) {
      clearTimeout(timeoutId);
      return res.status(400).json({ error: 'Registration is currently closed' });
    }

    if (config.registration_close_date && new Date(config.registration_close_date) < new Date()) {
      clearTimeout(timeoutId);
      return res.status(400).json({ error: 'Registration deadline has passed' });
    }

    // Check max players
    const countResult = await pool.query('SELECT COUNT(*) as count FROM league_registration');
    if (parseInt(countResult.rows[0].count) >= config.max_players) {
      clearTimeout(timeoutId);
      return res.status(400).json({ error: 'Maximum number of players reached' });
    }

    const { playerName, email } = req.body;

    if (!playerName || playerName.trim().length < 2) {
      clearTimeout(timeoutId);
      return res.status(400).json({ error: 'Player name is required (minimum 2 characters)' });
    }

    const trimmedName = playerName.trim();

    // Check if already registered
    const existingReg = await pool.query(
      'SELECT * FROM league_registration WHERE LOWER(player_name) = LOWER($1)',
      [trimmedName]
    );
    if (existingReg.rows.length > 0) {
      clearTimeout(timeoutId);
      const reg = existingReg.rows[0];
      return res.json({
        success: true,
        registration: reg,
        alreadyRegistered: true,
        isRanked: reg.is_ranked,
        matchedPlayer: reg.suggested_seed ? { seed: reg.suggested_seed } : null,
        message: reg.is_ranked
          ? `Welcome back! You're already registered with previous seed #${reg.suggested_seed}. Your status: ${reg.registration_status}.`
          : `Welcome back! You're already registered for the league. Your status: ${reg.registration_status}.`
      });
    }

    // Check if matches a ranked player (case-insensitive fuzzy match)
    const rankedMatch = await pool.query(`
      SELECT id, name, seed FROM players
      WHERE LOWER(name) = LOWER($1) OR LOWER(name) LIKE LOWER($2)
      ORDER BY seed NULLS LAST
      LIMIT 1
    `, [trimmedName, `%${trimmedName}%`]);

    const isRanked = rankedMatch.rows.length > 0;
    const matchedPlayer = rankedMatch.rows[0];

    // Insert registration
    const insertResult = await pool.query(`
      INSERT INTO league_registration (player_name, email, is_ranked, matched_player_id, suggested_seed, registration_status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      trimmedName,
      email || null,
      isRanked,
      matchedPlayer?.id || null,
      matchedPlayer?.seed || null,
      isRanked ? 'pending' : 'approved' // Auto-approve new players, ranked need review
    ]);

    // Add to players table - registration = adding yourself to the system
    // This ensures they show up in all dropdowns (My Games, etc.)
    await pool.query(`
      INSERT INTO players (name, seed)
      VALUES ($1, $2)
      ON CONFLICT (name) DO UPDATE SET seed = COALESCE(players.seed, EXCLUDED.seed)
    `, [trimmedName, matchedPlayer?.seed || null]);

    clearTimeout(timeoutId); // Clear timeout on success

    console.log('✅ Registration successful:', trimmedName, 'took:', Date.now() - startTime, 'ms');

    res.json({
      success: true,
      registration: insertResult.rows[0],
      isRanked,
      matchedPlayer: matchedPlayer ? { name: matchedPlayer.name, seed: matchedPlayer.seed } : null,
      message: isRanked
        ? `Welcome back! Your previous seed was #${matchedPlayer.seed}. Admin will confirm your placement.`
        : 'Registration successful! You will be placed in the unseeded group.'
    });
  } catch (error) {
    clearTimeout(timeoutId); // Clear timeout on error

    console.error('❌ Registration error:', {
      code: error.code,
      message: error.message,
      detail: error.detail,
      playerName: req.body.playerName
    });

    if (error.code === '23505') { // unique violation - player already in league_registration
      // Race condition or whitespace mismatch - fetch their actual registration
      try {
        const existingReg = await pool.query(
          'SELECT * FROM league_registration WHERE LOWER(player_name) = LOWER($1)',
          [trimmedName]
        );
        if (existingReg.rows.length > 0) {
          const reg = existingReg.rows[0];
          return res.json({
            success: true,
            registration: reg,
            alreadyRegistered: true,
            isRanked: reg.is_ranked,
            matchedPlayer: reg.suggested_seed ? { seed: reg.suggested_seed } : null,
            message: reg.is_ranked
              ? `Welcome back! You're already registered with previous seed #${reg.suggested_seed}. Your status: ${reg.registration_status}.`
              : `Welcome back! You're already registered for the league. Your status: ${reg.registration_status}.`
          });
        }
      } catch (fetchError) {
        console.error('Error fetching existing registration:', fetchError);
      }
      // Fallback if we can't fetch
      return res.json({
        success: true,
        alreadyRegistered: true,
        message: 'Welcome back! You\'re already registered for the league.'
      });
    }

    // Return detailed error for debugging
    res.status(500).json({
      error: error.message,
      code: error.code,
      detail: error.detail || 'Check server logs for details'
    });
  }
});

// Get all registrations (admin)
app.get('/api/registration/all', requireAdmin, async (req, res) => {
  try {
    await ensureRegistrationTables();

    const result = await pool.query(`
      SELECT r.*, p.name as original_player_name, p.seed as original_seed
      FROM league_registration r
      LEFT JOIN players p ON r.matched_player_id = p.id
      ORDER BY r.is_ranked DESC, r.suggested_seed ASC NULLS LAST, r.created_at ASC
    `);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Manually add player to registration
app.post('/api/registration/admin-add', requireAdmin, async (req, res) => {
  try {
    await ensureRegistrationTables();

    const { playerName, email } = req.body;

    if (!playerName || playerName.trim().length < 2) {
      return res.status(400).json({ error: 'Player name is required' });
    }

    const trimmedName = playerName.trim();

    // Check if already registered
    const existingReg = await pool.query(
      'SELECT * FROM league_registration WHERE LOWER(player_name) = LOWER($1)',
      [trimmedName]
    );

    if (existingReg.rows.length > 0) {
      return res.json({
        success: true,
        alreadyRegistered: true,
        registration: existingReg.rows[0],
        message: `${trimmedName} is already registered`
      });
    }

    // Check if player exists in players table
    const playerResult = await pool.query(
      'SELECT id, name, seed FROM players WHERE LOWER(name) = LOWER($1)',
      [trimmedName]
    );

    const isRanked = playerResult.rows.length > 0;
    const matchedPlayer = playerResult.rows[0];

    // Insert into league_registration
    const insertResult = await pool.query(`
      INSERT INTO league_registration (player_name, email, is_ranked, matched_player_id, suggested_seed, registration_status)
      VALUES ($1, $2, $3, $4, $5, 'approved')
      RETURNING *
    `, [
      trimmedName,
      email || null,
      isRanked,
      matchedPlayer?.id || null,
      matchedPlayer?.seed || null
    ]);

    res.json({
      success: true,
      registration: insertResult.rows[0],
      message: `${trimmedName} added to registration successfully`
    });

  } catch (error) {
    console.error('Admin add registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get public registration list (includes id for admin actions)
app.get('/api/registration/list', cacheResponse(30), async (req, res) => {
  try {
    await ensureRegistrationTables();

    // Allow showing all including rejected with ?includeRejected=true
    const includeRejected = req.query.includeRejected === 'true';

    const whereClause = includeRejected ? '' : "WHERE registration_status != 'rejected'";

    const result = await pool.query(`
      SELECT id, player_name, is_ranked, registration_status, final_seed, suggested_seed, created_at
      FROM league_registration
      ${whereClause}
      ORDER BY
        CASE WHEN final_seed IS NOT NULL THEN final_seed ELSE 9999 END ASC,
        is_ranked DESC,
        created_at ASC
    `);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve/update registration (admin)
app.put('/api/registration/:id', requireAdmin, async (req, res) => {
  try {
    await ensureRegistrationTables();

    const { id } = req.params;
    const { registration_status, final_seed } = req.body;

    // If final_seed is null, also set is_ranked to false (unseeded player)
    const isRanked = final_seed !== null && final_seed !== undefined;

    console.log('[Registration Update]', {
      id,
      registration_status,
      final_seed,
      isRanked,
      final_seed_type: typeof final_seed
    });

    const result = await pool.query(`
      UPDATE league_registration SET
        registration_status = COALESCE($1, registration_status),
        final_seed = $2,
        is_ranked = $3,
        admin_approved = TRUE,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING id, player_name, final_seed, is_ranked
    `, [registration_status, final_seed, isRanked, id]);

    console.log('[Registration Updated]', result.rows[0]);

    res.json({
      success: true,
      updated: result.rows[0]
    });
  } catch (error) {
    console.error('[Registration Update Error]', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete registration (admin)
app.delete('/api/registration/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM league_registration WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate league bracket from registrations (admin)
app.post('/api/registration/generate-bracket', requireAdmin, async (req, res) => {
  try {
    await ensureRegistrationTables();

    // Get approved registrations
    const regResult = await pool.query(`
      SELECT * FROM league_registration
      WHERE registration_status = 'approved'
      ORDER BY final_seed ASC NULLS LAST, suggested_seed ASC NULLS LAST, created_at ASC
    `);

    const players = regResult.rows;

    if (players.length < 4) {
      return res.status(400).json({ error: 'Need at least 4 approved players to generate bracket' });
    }

    // Calculate bracket size (next power of 2)
    const n = players.length;
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(n)));
    const numByes = bracketSize - n;

    // Assign seeds: ranked players keep their seed, unseeded go after
    const seededPlayers = players.filter(p => p.final_seed || p.suggested_seed || p.is_ranked);
    const unseededPlayers = players.filter(p => !p.final_seed && !p.suggested_seed && !p.is_ranked);

    // Sort seeded by final_seed or suggested_seed
    seededPlayers.sort((a, b) => {
      const seedA = a.final_seed || a.suggested_seed || 999;
      const seedB = b.final_seed || b.suggested_seed || 999;
      return seedA - seedB;
    });

    // Create final player list with seeds
    const finalPlayers = [];
    let seedNum = 1;

    seededPlayers.forEach(p => {
      finalPlayers.push({
        name: p.player_name,
        seed: seedNum++,
        isRanked: true
      });
    });

    // Unseeded players don't get seed numbers
    unseededPlayers.forEach(p => {
      finalPlayers.push({
        name: p.player_name,
        seed: null, // No seed for unseeded players
        isRanked: false
      });
    });

    // Standard bracket seeding (1 vs 16, 8 vs 9, etc)
    const bracketOrder = [];
    function fillBracket(low, high, arr) {
      if (low === high) {
        arr.push(low);
      } else {
        const mid = Math.floor((low + high) / 2);
        fillBracket(low, mid, arr);
        fillBracket(mid + 1, high, arr);
      }
    }
    fillBracket(1, bracketSize, bracketOrder);

    // Create matches with byes for top seeds
    const round1Matches = [];
    for (let i = 0; i < Math.floor(bracketSize / 2); i++) {
      const seed1 = bracketOrder[i * 2];
      const seed2 = bracketOrder[i * 2 + 1];

      const player1 = finalPlayers[seed1 - 1] || null;
      const player2 = finalPlayers[seed2 - 1] || null;

      const isBye = !player1 || !player2;
      const winner = isBye ? (player1?.name || player2?.name) : null;

      round1Matches.push({
        matchNumber: i + 1,
        player1: player1?.name || 'BYE',
        player2: player2?.name || 'BYE',
        seed1: player1?.seed || null,
        seed2: player2?.seed || null,
        isBye,
        winner
      });
    }

    // Clear any existing league matches
    await pool.query('DELETE FROM league_matches');

    // Save round 1 matches to database with week scheduling
    // Distribute Round 1 matches across 4 weeks
    const matchesPerWeek = Math.ceil(round1Matches.length / 4);

    for (let i = 0; i < round1Matches.length; i++) {
      const match = round1Matches[i];
      const scheduledWeek = Math.floor(i / matchesPerWeek) + 1; // Week 1, 2, 3, or 4

      await pool.query(`
        INSERT INTO league_matches (round, match_number, player1, player2, seed1, seed2, winner, is_bye, completed, scheduled_week)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        1,
        match.matchNumber,
        match.player1,
        match.player2,
        match.seed1,
        match.seed2,
        match.winner,
        match.isBye,
        match.isBye,
        scheduledWeek
      ]);
    }

    // Generate all subsequent rounds with TBD placeholders
    const numRounds = Math.log2(bracketSize);
    let currentRoundMatches = Math.floor(bracketSize / 2);

    for (let round = 2; round <= numRounds; round++) {
      currentRoundMatches = Math.floor(currentRoundMatches / 2);

      for (let matchNum = 1; matchNum <= currentRoundMatches; matchNum++) {
        await pool.query(`
          INSERT INTO league_matches (round, match_number, player1, player2, is_bye, completed)
          VALUES ($1, $2, $3, $4, FALSE, FALSE)
        `, [
          round,
          matchNum,
          null, // TBD
          null  // TBD
        ]);
      }
    }

    // Close registration
    await pool.query(`
      UPDATE league_config SET registration_open = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = 1
    `);

    res.json({
      success: true,
      bracketSize,
      numPlayers: n,
      numByes,
      seededCount: seededPlayers.length,
      unseededCount: unseededPlayers.length,
      players: finalPlayers,
      round1: round1Matches
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update player seeded status (admin)
app.post('/api/registration/:id/unseeded', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(`
      UPDATE league_registration
      SET is_ranked = FALSE,
          final_seed = NULL,
          suggested_seed = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id]);

    res.json({ success: true, message: 'Player updated to unseeded' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fix specific player to unseeded and regenerate bracket (admin)
app.post('/api/registration/fix-unseeded/:playerName', requireAdmin, async (req, res) => {
  try {
    const { playerName } = req.params;

    console.log(`[Fix Unseeded] Setting ${playerName} to unseeded...`);

    // Update player to unseeded
    const updateResult = await pool.query(`
      UPDATE league_registration
      SET final_seed = NULL,
          is_ranked = FALSE,
          admin_approved = TRUE,
          updated_at = CURRENT_TIMESTAMP
      WHERE player_name = $1
      RETURNING id, player_name, final_seed, is_ranked
    `, [playerName]);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: `Player ${playerName} not found` });
    }

    console.log(`[Fix Unseeded] Updated:`, updateResult.rows[0]);

    // Now regenerate bracket automatically
    console.log(`[Fix Unseeded] Regenerating bracket...`);

    await ensureRegistrationTables();

    const players = await pool.query(`
      SELECT player_name, final_seed, is_ranked
      FROM league_registration
      WHERE registration_status = 'approved' AND admin_approved = TRUE
      ORDER BY
        CASE WHEN final_seed IS NOT NULL THEN final_seed ELSE 9999 END ASC,
        player_name ASC
    `);

    const n = players.rows.length;
    if (n < 4) {
      return res.status(400).json({ error: 'Need at least 4 approved players to generate bracket' });
    }

    // Separate seeded and unseeded players
    const seededPlayers = players.rows.filter(p => p.is_ranked && p.final_seed !== null);
    const unseededPlayers = players.rows.filter(p => !p.is_ranked || p.final_seed === null);

    const bracketSize = Math.pow(2, Math.ceil(Math.log2(n)));
    const numByes = bracketSize - n;

    const finalPlayers = [];
    seededPlayers.forEach(p => {
      finalPlayers.push({
        name: p.player_name,
        seed: p.final_seed,
        isRanked: true
      });
    });

    unseededPlayers.forEach(p => {
      finalPlayers.push({
        name: p.player_name,
        seed: null,
        isRanked: false
      });
    });

    function fillBracket(low, high, arr) {
      if (low === high) {
        arr.push(low);
      } else {
        const mid = Math.floor((low + high) / 2);
        fillBracket(low, mid, arr);
        fillBracket(mid + 1, high, arr);
      }
    }

    const bracketOrder = [];
    fillBracket(1, bracketSize, bracketOrder);

    const round1Matches = [];
    for (let i = 0; i < Math.floor(bracketSize / 2); i++) {
      const seed1 = bracketOrder[i * 2];
      const seed2 = bracketOrder[i * 2 + 1];
      const player1 = finalPlayers[seed1 - 1] || null;
      const player2 = finalPlayers[seed2 - 1] || null;
      const isBye = !player1 || !player2;
      const winner = isBye ? (player1?.name || player2?.name) : null;

      round1Matches.push({
        matchNumber: i + 1,
        player1: player1?.name || 'BYE',
        player2: player2?.name || 'BYE',
        seed1: player1?.seed || null,
        seed2: player2?.seed || null,
        isBye,
        winner
      });
    }

    await pool.query('DELETE FROM league_matches');

    // Distribute Round 1 matches across 4 weeks
    const matchesPerWeek = Math.ceil(round1Matches.length / 4);

    for (let i = 0; i < round1Matches.length; i++) {
      const match = round1Matches[i];
      const scheduledWeek = Math.floor(i / matchesPerWeek) + 1; // Week 1, 2, 3, or 4

      await pool.query(`
        INSERT INTO league_matches (round, match_number, player1, player2, seed1, seed2, winner, is_bye, completed, scheduled_week)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [1, match.matchNumber, match.player1, match.player2, match.seed1, match.seed2, match.winner, match.isBye, match.isBye, scheduledWeek]);
    }

    const numRounds = Math.log2(bracketSize);
    let currentRoundMatches = Math.floor(bracketSize / 2);

    for (let round = 2; round <= numRounds; round++) {
      currentRoundMatches = Math.floor(currentRoundMatches / 2);
      for (let matchNum = 1; matchNum <= currentRoundMatches; matchNum++) {
        await pool.query(`
          INSERT INTO league_matches (round, match_number, player1, player2, is_bye, completed)
          VALUES ($1, $2, $3, $4, FALSE, FALSE)
        `, [round, matchNum, null, null]);
      }
    }

    await pool.query(`
      UPDATE league_config SET registration_open = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = 1
    `);

    console.log(`[Fix Unseeded] Success! Bracket regenerated.`);

    res.json({
      success: true,
      message: `${playerName} set to unseeded and bracket regenerated`,
      bracketSize,
      numPlayers: n,
      numByes,
      seededCount: seededPlayers.length,
      unseededCount: unseededPlayers.length
    });
  } catch (error) {
    console.error('[Fix Unseeded Error]', error);
    res.status(500).json({ error: error.message });
  }
});

// Convert bracket tournament to season (admin)
app.post('/api/registration/convert-to-season', requireAdmin, async (req, res) => {
  try {
    await ensureRegistrationTables();

    console.log('[Convert to Season] Starting conversion...');

    // Get all approved registrations
    const registrations = await pool.query(`
      SELECT player_name, final_seed, is_ranked
      FROM league_registration
      WHERE registration_status = 'approved' AND admin_approved = TRUE
      ORDER BY
        CASE WHEN final_seed IS NOT NULL THEN final_seed ELSE 9999 END ASC,
        player_name ASC
    `);

    if (registrations.rows.length < 4) {
      return res.status(400).json({ error: 'Need at least 4 approved players to start a season' });
    }

    console.log(`[Convert to Season] Found ${registrations.rows.length} players`);

    // Separate into Group A (seeded/ranked) and Group B (unseeded)
    const groupA = registrations.rows
      .filter(p => p.is_ranked && p.final_seed !== null)
      .map(p => ({ name: p.player_name, seed: p.final_seed }));

    const groupB = registrations.rows
      .filter(p => !p.is_ranked || p.final_seed === null)
      .map(p => ({ name: p.player_name, seed: null }));

    console.log(`[Convert to Season] Group A: ${groupA.length} players, Group B: ${groupB.length} players`);
    console.log(`[Convert to Season] Group A players:`, groupA.map(p => p.name));
    console.log(`[Convert to Season] Group B players:`, groupB.map(p => p.name));

    if (groupA.length === 0 || groupB.length === 0) {
      return res.status(400).json({
        error: 'Need players in both groups. Make sure some players are seeded and some are unseeded.',
        groupA: groupA.length,
        groupB: groupB.length
      });
    }

    // Generate season with 8 games per player over 10 weeks
    const season = generateSeason(groupA, groupB, 10, {
      gamesPerPlayerA: 8,
      gamesPerPlayerB: 8
    });

    console.log('[Convert to Season] Season generated');
    console.log(`[Convert to Season] Season has ${season.groups.A.players.length} Group A, ${season.groups.B.players.length} Group B`);
    console.log(`[Convert to Season] Group B in season:`, season.groups.B.players.map(p => p.name));

    // Delete bracket tournament data
    await pool.query('DELETE FROM league_matches');
    console.log('[Convert to Season] Deleted old bracket data');

    // Close registration
    await pool.query(`
      UPDATE league_config SET registration_open = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = 1
    `);

    // Save season to database
    await pool.query('DELETE FROM season WHERE id = 1');
    await pool.query('INSERT INTO season (id, data) VALUES (1, $1)', [season]);

    console.log('[Convert to Season] Season saved to database');

    res.json({
      success: true,
      message: 'Successfully converted to Season format',
      season: {
        totalWeeks: season.totalWeeks,
        groupA: groupA.length,
        groupB: groupB.length,
        matchesPerGroup: {
          A: season.schedule.A.reduce((sum, week) => sum + week.length, 0),
          B: season.schedule.B.reduce((sum, week) => sum + week.length, 0)
        }
      }
    });
  } catch (error) {
    console.error('[Convert to Season Error]', error);
    res.status(500).json({ error: error.message });
  }
});

// Clear all registrations (admin)
app.delete('/api/registration/all', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM league_registration');
    await pool.query(`
      UPDATE league_config SET registration_open = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = 1
    `);
    res.json({ success: true, message: 'All registrations cleared' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get league bracket matches
app.get('/api/league/matches', async (req, res) => {
  try {
    await ensureRegistrationTables();
    const result = await pool.query(`
      SELECT * FROM league_matches
      ORDER BY round ASC, match_number ASC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update league match result
app.post('/api/league/match/result', async (req, res) => {
  try {
    await ensureRegistrationTables();
    const { matchId, winner, score } = req.body;

    if (!matchId || !winner) {
      return res.status(400).json({ error: 'Match ID and winner are required' });
    }

    // Update the match
    await pool.query(`
      UPDATE league_matches
      SET winner = $1, score = $2, completed = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [winner, score || null, matchId]);

    // Get the updated match
    const matchResult = await pool.query(`
      SELECT * FROM league_matches WHERE id = $1
    `, [matchId]);

    if (matchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const match = matchResult.rows[0];

    // Check if we need to advance the winner to the next round
    const currentRound = match.round;
    const currentMatchNumber = match.match_number;
    const nextRound = currentRound + 1;
    const nextMatchNumber = Math.ceil(currentMatchNumber / 2);

    // Check if next round match exists
    const nextMatchResult = await pool.query(`
      SELECT * FROM league_matches WHERE round = $1 AND match_number = $2
    `, [nextRound, nextMatchNumber]);

    if (nextMatchResult.rows.length === 0) {
      // Create next round match if it doesn't exist
      const isFirstMatch = currentMatchNumber % 2 === 1;
      await pool.query(`
        INSERT INTO league_matches (round, match_number, player1, player2, is_bye, completed)
        VALUES ($1, $2, $3, $4, FALSE, FALSE)
      `, [
        nextRound,
        nextMatchNumber,
        isFirstMatch ? winner : null,
        isFirstMatch ? null : winner
      ]);
    } else {
      // Update existing next round match with the winner
      const nextMatch = nextMatchResult.rows[0];
      const isFirstMatch = currentMatchNumber % 2 === 1;

      if (isFirstMatch) {
        await pool.query(`
          UPDATE league_matches SET player1 = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
        `, [winner, nextMatch.id]);
      } else {
        await pool.query(`
          UPDATE league_matches SET player2 = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
        `, [winner, nextMatch.id]);
      }
    }

    res.json({ success: true, match: matchResult.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PLAYER STATS & PROFILE ============

// Get player stats and match history
app.get('/api/player/:name/stats', async (req, res) => {
  try {
    const playerName = decodeURIComponent(req.params.name);

    // Get current season data
    const seasonResult = await pool.query('SELECT data FROM season WHERE id = 1');
    const season = seasonResult.rows.length ? seasonResult.rows[0].data : null;

    // Get archived seasons
    let archivedStats = [];
    try {
      const archiveResult = await pool.query(
        'SELECT season_name, champion, data FROM season_archive ORDER BY end_date DESC'
      );
      archivedStats = archiveResult.rows;
    } catch (e) { /* table might not exist */ }

    // Calculate current season stats
    let currentStats = {
      wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0,
      group: null, rank: null, matchHistory: [], headToHead: {}
    };

    if (season) {
      // Find player's group and stats
      for (const g of ['A', 'B']) {
        if (season.standings?.[g]?.[playerName]) {
          const stats = season.standings[g][playerName];
          currentStats = {
            ...currentStats,
            ...stats,
            group: g
          };

          // Calculate rank
          const groupStandings = Object.entries(season.standings[g])
            .map(([name, s]) => ({ name, ...s }))
            .sort((a, b) => {
              if (b.wins !== a.wins) return b.wins - a.wins;
              return (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst);
            });
          currentStats.rank = groupStandings.findIndex(p => p.name === playerName) + 1;
          break;
        }
      }

      // Get match history from schedule
      for (const g of ['A', 'B']) {
        if (season.schedule?.[g]) {
          season.schedule[g].forEach((week, weekIdx) => {
            week.forEach(match => {
              if ((match.player1 === playerName || match.player2 === playerName) && match.completed) {
                const isPlayer1 = match.player1 === playerName;
                const opponent = isPlayer1 ? match.player2 : match.player1;
                const won = match.winner === playerName;
                const myScore = isPlayer1 ? match.score1 : match.score2;
                const oppScore = isPlayer1 ? match.score2 : match.score1;

                currentStats.matchHistory.push({
                  week: weekIdx + 1,
                  opponent,
                  won,
                  score: `${myScore}-${oppScore}`,
                  group: g
                });

                // Head to head
                if (!currentStats.headToHead[opponent]) {
                  currentStats.headToHead[opponent] = { wins: 0, losses: 0 };
                }
                if (won) {
                  currentStats.headToHead[opponent].wins++;
                } else {
                  currentStats.headToHead[opponent].losses++;
                }
              }
            });
          });
        }
      }

      // Include playoff/championship matches
      if (season.championship) {
        const allMatches = [
          ...(season.championship.quarterfinals || []),
          ...(season.championship.semifinals || []),
          season.championship.final
        ].filter(m => m && m.completed);

        allMatches.forEach(match => {
          if (match.player1 === playerName || match.player2 === playerName) {
            const isPlayer1 = match.player1 === playerName;
            const opponent = isPlayer1 ? match.player2 : match.player1;
            const won = match.winner === playerName;
            const myScore = isPlayer1 ? match.score1 : match.score2;
            const oppScore = isPlayer1 ? match.score2 : match.score1;

            currentStats.matchHistory.push({
              week: 'Playoffs',
              opponent,
              won,
              score: `${myScore}-${oppScore}`,
              matchName: match.matchName || 'Championship'
            });

            if (!currentStats.headToHead[opponent]) {
              currentStats.headToHead[opponent] = { wins: 0, losses: 0 };
            }
            if (won) {
              currentStats.headToHead[opponent].wins++;
            } else {
              currentStats.headToHead[opponent].losses++;
            }
          }
        });
      }
    }

    // Calculate all-time stats from archives
    let allTimeStats = { wins: 0, losses: 0, championships: 0, runnerUps: 0, seasonsPlayed: 0 };

    archivedStats.forEach(archive => {
      const archiveData = archive.data;
      if (archiveData?.standings) {
        for (const g of ['A', 'B']) {
          if (archiveData.standings[g]?.[playerName]) {
            const s = archiveData.standings[g][playerName];
            allTimeStats.wins += s.wins || 0;
            allTimeStats.losses += s.losses || 0;
            allTimeStats.seasonsPlayed++;
          }
        }
      }
      if (archive.champion === playerName) allTimeStats.championships++;
      if (archive.runner_up === playerName) allTimeStats.runnerUps++;
    });

    // Add current season to all-time
    allTimeStats.wins += currentStats.wins;
    allTimeStats.losses += currentStats.losses;
    if (season) allTimeStats.seasonsPlayed++;

    res.json({
      playerName,
      currentSeason: season ? {
        name: season.name,
        group: currentStats.group,
        rank: currentStats.rank,
        wins: currentStats.wins,
        losses: currentStats.losses,
        pointsFor: currentStats.pointsFor,
        pointsAgainst: currentStats.pointsAgainst,
        winRate: currentStats.wins + currentStats.losses > 0
          ? Math.round((currentStats.wins / (currentStats.wins + currentStats.losses)) * 100)
          : 0
      } : null,
      matchHistory: currentStats.matchHistory,
      headToHead: currentStats.headToHead,
      allTime: allTimeStats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ TABLE AVAILABILITY CALENDAR ============

// Get table bookings for a date range (calendar view)
app.get('/api/table/calendar', async (req, res) => {
  try {
    const { start, end } = req.query;

    // Default to current week if no dates provided
    const startDate = start || new Date().toISOString().split('T')[0];
    const endDate = end || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    await ensureBookingsTable();

    const result = await pool.query(`
      SELECT id, player1, player2, booking_date, start_time, end_time, group_name, status, match_id
      FROM table_bookings
      WHERE booking_date >= $1 AND booking_date <= $2
      ORDER BY booking_date, start_time
    `, [startDate, endDate]);

    // Group by date for calendar view
    const calendar = {};
    result.rows.forEach(booking => {
      const dateStr = booking.booking_date.toISOString().split('T')[0];
      if (!calendar[dateStr]) {
        calendar[dateStr] = [];
      }
      calendar[dateStr].push({
        id: booking.id,
        player1: booking.player1,
        player2: booking.player2,
        startTime: booking.start_time,
        endTime: booking.end_time,
        group: booking.group_name,
        status: booking.status,
        matchId: booking.match_id
      });
    });

    // Generate time slots for each day (8 AM to 6 PM)
    const timeSlots = [];
    for (let h = 8; h < 18; h++) {
      timeSlots.push(`${h.toString().padStart(2, '0')}:00`);
      timeSlots.push(`${h.toString().padStart(2, '0')}:30`);
    }

    res.json({
      startDate,
      endDate,
      bookings: calendar,
      timeSlots
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get availability for a specific date (shows which slots are free/booked)
app.get('/api/table/availability/:date', async (req, res) => {
  try {
    const date = req.params.date;

    await ensureBookingsTable();

    const result = await pool.query(`
      SELECT start_time, end_time, player1, player2, status
      FROM table_bookings
      WHERE booking_date = $1 AND status != 'cancelled'
      ORDER BY start_time
    `, [date]);

    // Generate all time slots and mark availability
    const slots = [];
    for (let h = 8; h < 18; h++) {
      for (const m of ['00', '30']) {
        const time = `${h.toString().padStart(2, '0')}:${m}`;
        // Handle both HH:MM and HH:MM:SS formats from database
        const booking = result.rows.find(b => {
          const dbTime = b.start_time.substring(0, 5); // Get HH:MM part
          return dbTime === time;
        });

        slots.push({
          time,
          available: !booking,
          booking: booking ? {
            player1: booking.player1,
            player2: booking.player2,
            status: booking.status
          } : null
        });
      }
    }

    res.json({
      date,
      slots,
      totalBooked: result.rows.length,
      totalAvailable: slots.filter(s => s.available).length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ============ WEB PUSH NOTIFICATIONS ============

// Get VAPID public key for client subscription
app.get('/api/push/vapid-public-key', (req, res) => {
  initWebPush(); // Ensure VAPID keys are initialized
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Subscribe to push notifications
app.post('/api/push/subscribe', async (req, res) => {
  try {
    const { subscription, playerName } = req.body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }

    const { endpoint, keys } = subscription;
    const { p256dh, auth } = keys;

    // Upsert subscription (update if endpoint exists, insert if not)
    await pool.query(`
      INSERT INTO push_subscriptions (player_name, endpoint, p256dh, auth, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (endpoint) DO UPDATE SET
        player_name = $1,
        p256dh = $3,
        auth = $4,
        updated_at = CURRENT_TIMESTAMP
    `, [playerName || null, endpoint, p256dh, auth]);

    res.json({ success: true, message: 'Push subscription saved' });
  } catch (error) {
    console.error('Push subscribe error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Unsubscribe from push notifications
app.post('/api/push/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint required' });
    }

    await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
    res.json({ success: true, message: 'Unsubscribed from push notifications' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send push notification to a specific player
async function sendPushToPlayer(playerName, payload) {
  const wp = initWebPush();
  if (!wp) return []; // Web push not available

  try {
    const subscriptions = await pool.query(
      'SELECT * FROM push_subscriptions WHERE player_name = $1',
      [playerName]
    );

    const results = [];
    for (const sub of subscriptions.rows) {
      try {
        await wp.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        }, JSON.stringify(payload));
        results.push({ endpoint: sub.endpoint, success: true });
      } catch (err) {
        // Remove invalid subscriptions (e.g., user unsubscribed in browser)
        if (err.statusCode === 404 || err.statusCode === 410) {
          await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]);
        }
        results.push({ endpoint: sub.endpoint, success: false, error: err.message });
      }
    }
    return results;
  } catch (error) {
    console.error('sendPushToPlayer error:', error);
    return [];
  }
}

// Send push notification to all subscribers (broadcast)
async function sendPushBroadcast(payload) {
  const wp = initWebPush();
  if (!wp) return []; // Web push not available

  try {
    const subscriptions = await pool.query('SELECT * FROM push_subscriptions');

    const results = [];
    for (const sub of subscriptions.rows) {
      try {
        await wp.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        }, JSON.stringify(payload));
        results.push({ endpoint: sub.endpoint, success: true });
      } catch (err) {
        // Remove invalid subscriptions
        if (err.statusCode === 404 || err.statusCode === 410) {
          await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]);
        }
        results.push({ endpoint: sub.endpoint, success: false, error: err.message });
      }
    }
    return results;
  } catch (error) {
    console.error('sendPushBroadcast error:', error);
    return [];
  }
}

// Admin endpoint to send push broadcast
app.post('/api/push/broadcast', requireAdmin, async (req, res) => {
  try {
    const { title, body, url } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body required' });
    }

    const payload = {
      title,
      body,
      icon: '/favicon.ico',
      tag: 'pingpong-broadcast',
      data: { url: url || '/' }
    };

    const results = await sendPushBroadcast(payload);
    const successCount = results.filter(r => r.success).length;

    res.json({
      success: true,
      sent: successCount,
      failed: results.length - successCount,
      total: results.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Weekly summary push notification (can be triggered via cron or admin)
app.post('/api/push/weekly-summary', requireAdmin, async (req, res) => {
  try {
    // Get current season data
    const seasonResult = await pool.query('SELECT * FROM season WHERE id = 1');
    if (!seasonResult.rows.length) {
      return res.json({ success: false, message: 'No active season' });
    }

    const season = seasonResult.rows[0].data;
    const standings = season.standings || {};

    // Calculate top performers
    const allPlayers = [];
    for (const group of ['A', 'B']) {
      if (standings[group]) {
        Object.entries(standings[group]).forEach(([name, stats]) => {
          allPlayers.push({ name, group, ...stats });
        });
      }
    }

    // Sort by wins
    allPlayers.sort((a, b) => (b.wins || 0) - (a.wins || 0));
    const topPlayers = allPlayers.slice(0, 3);

    let body = `Week ${season.currentWeek || 1} update! `;
    if (topPlayers.length > 0) {
      body += `Top performers: ${topPlayers.map(p => `${p.name} (${p.wins}W)`).join(', ')}`;
    }

    const payload = {
      title: '🏓 Weekly League Update',
      body,
      icon: '/favicon.ico',
      tag: 'pingpong-weekly',
      data: { url: '/#league' }
    };

    const results = await sendPushBroadcast(payload);
    const successCount = results.filter(r => r.success).length;

    res.json({
      success: true,
      message: `Weekly summary sent to ${successCount} subscribers`,
      topPlayers
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get push subscription stats (admin)
app.get('/api/push/stats', requireAdmin, async (req, res) => {
  try {
    const total = await pool.query('SELECT COUNT(*) FROM push_subscriptions');
    const withPlayer = await pool.query('SELECT COUNT(*) FROM push_subscriptions WHERE player_name IS NOT NULL');
    const byPlayer = await pool.query(`
      SELECT player_name, COUNT(*) as devices
      FROM push_subscriptions
      WHERE player_name IS NOT NULL
      GROUP BY player_name
      ORDER BY player_name
    `);

    res.json({
      totalSubscriptions: parseInt(total.rows[0].count),
      subscribersWithName: parseInt(withPlayer.rows[0].count),
      anonymous: parseInt(total.rows[0].count) - parseInt(withPlayer.rows[0].count),
      byPlayer: byPlayer.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to send match reminders (with Web Push)
async function sendMatchReminders() {
  try {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5);
    const oneHourTime = oneHourFromNow.toTimeString().slice(0, 5);

    const bookings = await pool.query(`
      SELECT * FROM table_bookings
      WHERE booking_date = $1
        AND start_time > $2
        AND start_time <= $3
        AND status = 'booked'
        AND (reminded IS NULL OR reminded = FALSE)
    `, [today, currentTime, oneHourTime]);

    for (const booking of bookings.rows) {
      // In-app notification
      await createNotification(
        booking.player1,
        'match_reminder',
        'Match in 1 Hour!',
        `Your match vs ${booking.player2} is at ${booking.start_time} today`,
        '#schedule'
      );
      await createNotification(
        booking.player2,
        'match_reminder',
        'Match in 1 Hour!',
        `Your match vs ${booking.player1} is at ${booking.start_time} today`,
        '#schedule'
      );

      // Web Push notification (works even when browser is closed)
      await sendPushToPlayer(booking.player1, {
        title: 'Match in 1 Hour!',
        body: `vs ${booking.player2} at ${booking.start_time}`,
        icon: '/favicon.ico',
        tag: 'match-reminder-' + booking.id,
        data: { url: '/#schedule' }
      });
      await sendPushToPlayer(booking.player2, {
        title: 'Match in 1 Hour!',
        body: `vs ${booking.player1} at ${booking.start_time}`,
        icon: '/favicon.ico',
        tag: 'match-reminder-' + booking.id,
        data: { url: '/#schedule' }
      });

      await pool.query('UPDATE table_bookings SET reminded = TRUE WHERE id = $1', [booking.id]);
    }

    if (bookings.rows.length > 0) {
      console.log(`Sent ${bookings.rows.length} match reminders (in-app + push)`);
    }
  } catch (e) {
    console.log('Reminder check failed:', e.message);
  }
}

// Weekly summary scheduled task (runs every Monday at 9 AM)
async function checkWeeklySummary() {
  try {
    const now = new Date();
    // Only run on Monday at 9 AM
    if (now.getDay() === 1 && now.getHours() === 9 && now.getMinutes() < 15) {
      const seasonResult = await pool.query('SELECT * FROM season WHERE id = 1');
      if (seasonResult.rows.length) {
        const season = seasonResult.rows[0].data;
        const standings = season.standings || {};

        const allPlayers = [];
        for (const group of ['A', 'B']) {
          if (standings[group]) {
            Object.entries(standings[group]).forEach(([name, stats]) => {
              allPlayers.push({ name, group, ...stats });
            });
          }
        }

        allPlayers.sort((a, b) => (b.wins || 0) - (a.wins || 0));
        const topPlayers = allPlayers.slice(0, 3);

        let body = `Week ${season.currentWeek || 1} standings! `;
        if (topPlayers.length > 0) {
          body += `Leaders: ${topPlayers.map(p => `${p.name} (${p.wins}W)`).join(', ')}`;
        }

        await sendPushBroadcast({
          title: 'Weekly League Update',
          body,
          icon: '/favicon.ico',
          tag: 'pingpong-weekly-' + season.currentWeek,
          data: { url: '/#league' }
        });

        console.log('Sent weekly summary push notification');
      }
    }
  } catch (e) {
    console.log('Weekly summary check failed:', e.message);
  }
}

// Vercel Cron Job endpoint for weekly summary (no auth required for cron)
app.get('/api/notifications/weekly-summary', async (req, res) => {
  try {
    await checkWeeklySummary();
    res.json({ success: true, message: 'Weekly summary cron executed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SPA fallback - serve index.html for all non-API routes (but not static files)
app.get('*', (req, res, next) => {
  // Don't serve index.html for static file requests
  if (req.url.startsWith('/assets/') ||
      req.url.startsWith('/manifest.json') ||
      req.url.startsWith('/favicon.svg') ||
      req.url.startsWith('/service-worker.js')) {
    return next(); // Let static middleware handle it or 404
  }
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Fix database sequences on startup
const fixDatabaseSequences = async () => {
  try {
    // Fix leaderboard sequence (sync with max id)
    await pool.query(`
      SELECT setval(pg_get_serial_sequence('leaderboard', 'id'),
        COALESCE((SELECT MAX(id) FROM leaderboard), 0) + 1,
        false)
    `);
    console.log('✓ Database sequences synchronized');
  } catch (error) {
    console.error('Warning: Could not fix database sequences:', error.message);
  }
};

// Initialize database fixes (runs in both dev and production)
(async () => {
  await fixDatabaseSequences();
})();

// Start server (for local development)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Database: ${process.env.POSTGRES_URL ? 'PostgreSQL' : 'Local development'}`);

    // Check for match reminders every 15 minutes
    setInterval(sendMatchReminders, 15 * 60 * 1000);
    console.log('Match reminder scheduler started (checks every 15 minutes)');

    // Check for weekly summary every 15 minutes (will only send on Monday 9 AM)
    setInterval(checkWeeklySummary, 15 * 60 * 1000);
    console.log('Weekly summary scheduler started (sends Monday 9 AM)');
  });
}

// Export for Vercel serverless deployment
module.exports = app;

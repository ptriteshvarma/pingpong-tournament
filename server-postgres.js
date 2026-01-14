const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = 'Username';

// PostgreSQL connection
// Railway automatically provides DATABASE_URL environment variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
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
    }

    // Test connection
    const timeResult = await pool.query('SELECT NOW()');
    console.log('✓ Database connected:', timeResult.rows[0].now);
  } catch (err) {
    console.error('❌ Database initialization error:', err);
    throw err;
  }
}

// Daily backup system
async function createBackup() {
  const fs = require('fs');
  try {
    console.log('Creating database backup...');

    // Get all data from all tables
    const players = await pool.query('SELECT * FROM players ORDER BY id');
    const matches = await pool.query('SELECT * FROM matches ORDER BY id');
    const bracketMeta = await pool.query('SELECT * FROM bracket_meta');
    const availability = await pool.query('SELECT * FROM availability ORDER BY id');
    const leaderboard = await pool.query('SELECT * FROM leaderboard ORDER BY id');

    const backup = {
      timestamp: new Date().toISOString(),
      tables: {
        players: players.rows,
        matches: matches.rows,
        bracket_meta: bracketMeta.rows,
        availability: availability.rows,
        leaderboard: leaderboard.rows
      }
    };

    // Create backups directory if it doesn't exist
    const backupDir = path.join(__dirname, 'data', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Save backup with timestamp
    const filename = `backup-${new Date().toISOString().replace(/:/g, '-')}.json`;
    const filepath = path.join(backupDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));

    console.log(`✓ Backup created: ${filepath}`);

    // Keep only last 30 days of backups
    const files = fs.readdirSync(backupDir).filter(f => f.startsWith('backup-') && f.endsWith('.json'));
    if (files.length > 30) {
      files.sort();
      const toDelete = files.slice(0, files.length - 30);
      toDelete.forEach(f => {
        fs.unlinkSync(path.join(backupDir, f));
        console.log(`Removed old backup: ${f}`);
      });
    }

    return filepath;
  } catch (err) {
    console.error('❌ Backup error:', err);
  }
}

// Schedule daily backups at midnight
function scheduleDailyBackups() {
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

initDatabase().then(() => {
  // Create initial backup on startup
  createBackup();
  // Schedule daily backups
  scheduleDailyBackups();
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Admin authentication middleware
const requireAdmin = (req, res, next) => {
  const password = req.headers['x-admin-password'];
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized. Invalid admin password.' });
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
    const numMatches = prevRoundMatches / 2;
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
      const newMatchCount = lbMatchCount / 2;
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
  const halfSize = numPlayers / 2;

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

// Generate complete season
const generateSeason = (groupA, groupB, numWeeks = 10) => {
  const groupAMatches = generateRoundRobinSchedule(groupA, true);
  const groupBMatches = generateRoundRobinSchedule(groupB, true);

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
      streak: 0, lastResults: []
    };
  });

  groupB.forEach(p => {
    standings.B[p.name] = {
      wins: 0, losses: 0, points: 0,
      pointsFor: 0, pointsAgainst: 0,
      streak: 0, lastResults: []
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

// Sort standings by tiebreaker rules
const sortStandings = (standings) => {
  return Object.entries(standings)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => {
      // 1. Most match wins
      if (b.wins !== a.wins) return b.wins - a.wins;
      // 2. Point differential (games won minus games lost)
      const diffA = a.pointsFor - a.pointsAgainst;
      const diffB = b.pointsFor - b.pointsAgainst;
      if (diffB !== diffA) return diffB - diffA;
      // 3. Most total games won
      if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
      // 4. Fewest games lost
      return a.pointsAgainst - b.pointsAgainst;
    });
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
const generateChampionshipBracket = (standingsA, standingsB, wildcardWinnerA = null, wildcardWinnerB = null) => {
  const sortedA = sortStandings(standingsA);
  const sortedB = sortStandings(standingsB);

  // Top 4 from each group
  const a1 = { name: sortedA[0]?.name, group: 'A', seed: 1 };
  const a2 = { name: sortedA[1]?.name, group: 'A', seed: 2 };
  const a3 = { name: sortedA[2]?.name, group: 'A', seed: 3 };
  const a4 = { name: sortedA[3]?.name, group: 'A', seed: 4 };
  const b1 = { name: sortedB[0]?.name, group: 'B', seed: 1 };
  const b2 = { name: sortedB[1]?.name, group: 'B', seed: 2 };
  const b3 = { name: sortedB[2]?.name, group: 'B', seed: 3 };
  const b4 = { name: sortedB[3]?.name, group: 'B', seed: 4 };

  // Wildcard winners can replace #4 seed
  let finalA4 = a4, finalB4 = b4;
  if (wildcardWinnerA) {
    finalA4 = { name: wildcardWinnerA, group: 'A', seed: 'WC', isWildcard: true };
  }
  if (wildcardWinnerB) {
    finalB4 = { name: wildcardWinnerB, group: 'B', seed: 'WC', isWildcard: true };
  }

  return {
    format: 'combined',
    description: 'Top 4 from each group compete for championship',
    seeds: { a1, a2, a3, a4: finalA4, b1, b2, b3, b4: finalB4 },
    // Quarterfinals: Cross-group matchups with traditional seeding
    // #1 seeds face #4 from other group, #2 seeds face #3 from other group
    quarterfinals: [
      {
        id: 'CHAMP-QF1',
        round: 'quarterfinal',
        matchNum: 1,
        matchName: 'Quarterfinal 1',
        player1: a1.name,
        player2: finalB4.name,
        player1Group: 'A',
        player2Group: 'B',
        seed1: 'A#1',
        seed2: finalB4.isWildcard ? 'B#WC' : 'B#4',
        advancesTo: 'SF1',
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
        player2: finalA4.name,
        player1Group: 'B',
        player2Group: 'A',
        seed1: 'B#1',
        seed2: finalA4.isWildcard ? 'A#WC' : 'A#4',
        advancesTo: 'SF2',
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
app.get('/api/players', async (req, res) => {
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
      'SELECT id FROM players WHERE LOWER(name) = LOWER($1)',
      [cleanName]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'A player with this name already exists' });
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

// Create manual backup (admin only)
app.post('/api/backup/create', requireAdmin, async (req, res) => {
  try {
    const filepath = await createBackup();
    res.json({ success: true, filepath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List available backups (admin only)
app.get('/api/backup/list', requireAdmin, async (req, res) => {
  const fs = require('fs');
  try {
    const backupDir = path.join(__dirname, 'data', 'backups');
    if (!fs.existsSync(backupDir)) {
      return res.json({ backups: [] });
    }

    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .map(f => {
        const stats = fs.statSync(path.join(backupDir, f));
        return {
          filename: f,
          created: stats.mtime,
          size: stats.size
        };
      })
      .sort((a, b) => b.created - a.created);

    res.json({ backups: files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Restore from backup (admin only)
app.post('/api/backup/restore', requireAdmin, async (req, res) => {
  const fs = require('fs');
  const client = await pool.connect();
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ error: 'Filename required' });
    }

    const backupPath = path.join(__dirname, 'data', 'backups', filename);
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    await client.query('BEGIN');

    // Clear all tables
    await client.query('DELETE FROM matches');
    await client.query('DELETE FROM bracket_meta');
    await client.query('DELETE FROM availability');
    await client.query('DELETE FROM leaderboard');
    await client.query('DELETE FROM players');

    // Restore players
    for (const player of backup.tables.players) {
      await client.query(
        'INSERT INTO players (id, name, seed, created_at) VALUES ($1, $2, $3, $4)',
        [player.id, player.name, player.seed, player.created_at]
      );
    }

    // Restore matches
    for (const match of backup.tables.matches) {
      await client.query(
        `INSERT INTO matches (id, round_type, round_number, match_number, player1, player2,
         winner, loser, score1, score2, is_bye, status, scheduled_time, created_at, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          match.id, match.round_type, match.round_number, match.match_number,
          match.player1, match.player2, match.winner, match.loser,
          match.score1, match.score2, match.is_bye, match.status,
          match.scheduled_time, match.created_at, match.completed_at
        ]
      );
    }

    // Restore bracket metadata
    for (const meta of backup.tables.bracket_meta) {
      await client.query(
        `INSERT INTO bracket_meta (id, bracket_size, player_count, num_rounds, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [meta.id, meta.bracket_size, meta.player_count, meta.num_rounds,
         meta.status, meta.created_at, meta.updated_at]
      );
    }

    // Restore availability
    for (const avail of backup.tables.availability) {
      await client.query(
        'INSERT INTO availability (id, player_name, date, time_slot, created_at) VALUES ($1, $2, $3, $4, $5)',
        [avail.id, avail.player_name, avail.date, avail.time_slot, avail.created_at]
      );
    }

    // Restore leaderboard
    for (const leader of backup.tables.leaderboard) {
      await client.query(
        `INSERT INTO leaderboard (id, player_name, weekly_wins, weekly_losses, weekly_points,
         weekly_matches_played, alltime_wins, alltime_losses, alltime_points, alltime_matches_played,
         week_start, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          leader.id, leader.player_name, leader.weekly_wins, leader.weekly_losses,
          leader.weekly_points, leader.weekly_matches_played, leader.alltime_wins,
          leader.alltime_losses, leader.alltime_points, leader.alltime_matches_played,
          leader.week_start, leader.updated_at
        ]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, restored: backup.timestamp });
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
      created_by VARCHAR(255),
      UNIQUE(booking_date, start_time)
    )
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
    const midPoint = Math.floor(season.totalWeeks / 2);

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

    // If players are in swap zone and booking is after mid-season, mark as tentative
    const seasonResult = await pool.query('SELECT data FROM season WHERE id = 1');
    const season = seasonResult.rows[0]?.data;
    const midPoint = season ? Math.floor(season.totalWeeks / 2) : 5;
    const bookingWeek = getWeekNumber(booking_date);
    const isTentative = swapZoneWarning && bookingWeek >= midPoint;

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

// Get current season
app.get('/api/season', async (req, res) => {
  try {
    const result = await pool.query('SELECT data FROM season WHERE id = 1');
    if (result.rows.length === 0) {
      return res.json(null);
    }
    res.json(result.rows[0].data);
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
    const { groupA, groupB, numWeeks = 10, seasonName = 'Season 1' } = req.body;

    if (!groupA || !groupB || groupA.length < 2 || groupB.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 players in each group' });
    }

    const season = generateSeason(groupA, groupB, numWeeks);
    season.name = seasonName;

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

    res.json({ success: true, season });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Record a league match result
app.post('/api/season/match', async (req, res) => {
  try {
    const { matchId, winner, loser, score1, score2 } = req.body;

    const result = await pool.query('SELECT data FROM season WHERE id = 1');
    if (result.rows.length === 0) {
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
    }

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
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
        standings[winner].wins++;
        standings[winner].points += 3;
        standings[winner].pointsFor += score1 > score2 ? score1 : score2;
        standings[winner].pointsAgainst += score1 > score2 ? score2 : score1;
        standings[winner].streak = standings[winner].streak >= 0 ? standings[winner].streak + 1 : 1;
        standings[winner].lastResults.push('W');
        if (standings[winner].lastResults.length > 5) standings[winner].lastResults.shift();

        standings[loser].losses++;
        standings[loser].pointsFor += score1 < score2 ? score1 : score2;
        standings[loser].pointsAgainst += score1 < score2 ? score2 : score1;
        standings[loser].streak = standings[loser].streak <= 0 ? standings[loser].streak - 1 : -1;
        standings[loser].lastResults.push('L');
        if (standings[loser].lastResults.length > 5) standings[loser].lastResults.shift();
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

        // Generate combined championship bracket (top 4 from each group)
        season.championship = generateChampionshipBracket(
          season.standings.A,
          season.standings.B,
          wildcardWinnerForA,
          wildcardWinnerForB
        );
        season.status = 'playoffs';
        console.log('Auto-started combined championship bracket after wildcard complete');

        // Notify all championship bracket participants
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

    // Update leaderboard too
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

        // Check if we just hit mid-season (week 5 for 10-week season)
        const midPoint = Math.floor(season.totalWeeks / 2);
        if (season.currentWeek === midPoint && !season.midSeasonReview?.completed) {
          // Flag that mid-season review is now available
          season.midSeasonPending = true;
          midSeasonTriggered = true;
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

    // Save updated season
    await pool.query(`
      UPDATE season SET data = $1, current_week = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = 1
    `, [JSON.stringify(season), season.currentWeek, season.status]);

    res.json({ success: true, weekAdvanced, newWeek: season.currentWeek, midSeasonTriggered, wildcardStarted: season.status === 'wildcard' });
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

    // Check if wildcard round exists and determine winners
    // New logic: Winners go to their OWN group playoffs
    let wildcardWinnerForA = null;
    let wildcardWinnerForB = null;

    if (season.wildcard) {
      season.wildcard.matches.forEach(match => {
        if (match.completed && match.winner) {
          // Winner goes to their OWN group playoffs
          if (match.winner === match.player1) {
            // Player 1 won - they go to their own group (player1Group)
            if (match.player1Group === 'A') {
              wildcardWinnerForA = match.winner;
            } else {
              wildcardWinnerForB = match.winner;
            }
          } else {
            // Player 2 won - they go to their own group (player2Group)
            if (match.player2Group === 'A') {
              wildcardWinnerForA = match.winner;
            } else {
              wildcardWinnerForB = match.winner;
            }
          }
        }
      });
    }

    // Generate combined championship bracket (top 4 from each group)
    season.championship = generateChampionshipBracket(
      season.standings.A,
      season.standings.B,
      wildcardWinnerForA,
      wildcardWinnerForB
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
  try {
    const result = await pool.query('SELECT data FROM season WHERE id = 1');
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No active season' });
    }

    const season = result.rows[0].data;

    // Check if mid-season review already happened
    if (season.midSeasonReview?.completed) {
      return res.status(400).json({ error: 'Mid-season review already completed' });
    }

    // Check if we're at mid-season (week 5 or later for 10-week season)
    const midPoint = Math.floor(season.totalWeeks / 2);
    if (season.currentWeek < midPoint) {
      return res.status(400).json({ error: `Mid-season review available from week ${midPoint}` });
    }

    // Sort standings to find bottom 3 from A and top 3 from B
    const sortedA = sortStandings(season.standings.A);
    const sortedB = sortStandings(season.standings.B);

    // Bottom 3 from Group A (worst performers)
    const bottomA = sortedA.slice(-3);
    // Top 3 from Group B (best performers)
    const topB = sortedB.slice(0, 3);

    // Record the swaps
    const swaps = {
      fromAtoB: bottomA.map(p => p.name),
      fromBtoA: topB.map(p => p.name)
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

    // Move standings data
    swaps.fromAtoB.forEach(name => {
      season.standings.B[name] = {
        ...season.standings.A[name],
        promotedFrom: 'A',
        preSwapStats: { ...season.standings.A[name] }
      };
      delete season.standings.A[name];
    });
    swaps.fromBtoA.forEach(name => {
      season.standings.A[name] = {
        ...season.standings.B[name],
        promotedFrom: 'B',
        preSwapStats: { ...season.standings.B[name] }
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
    const remainingWeeks = season.totalWeeks - season.currentWeek;
    const newMatches = { A: [], B: [] };

    // For each swapped player, create matches against their new group members
    swaps.fromBtoA.forEach(playerName => {
      const opponents = season.groups.A.players.filter(p => p.name !== playerName && !swaps.fromBtoA.includes(p.name));
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
            isSwapMatch: true
          });
        }
      });
    });

    swaps.fromAtoB.forEach(playerName => {
      const opponents = season.groups.B.players.filter(p => p.name !== playerName && !swaps.fromAtoB.includes(p.name));
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
            isSwapMatch: true
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

    // Record the mid-season review
    season.midSeasonReview = {
      completed: true,
      completedAt: new Date().toISOString(),
      week: season.currentWeek,
      swaps: swaps,
      cancelledMatches: cancelledMatches,
      newMatchesCreated: newMatches.A.length + newMatches.B.length
    };

    await pool.query(`
      UPDATE season SET data = $1, updated_at = CURRENT_TIMESTAMP WHERE id = 1
    `, [JSON.stringify(season)]);

    res.json({
      success: true,
      swaps,
      message: `Swapped ${swaps.fromAtoB.length} players from A→B and ${swaps.fromBtoA.length} players from B→A`,
      cancelledMatches: cancelledMatches.length,
      newMatchesCreated: newMatches.A.length + newMatches.B.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    const midPoint = Math.floor(season.totalWeeks / 2);

    // Swap zone only active during first half of regular season
    if (season.status !== 'regular' || season.currentWeek >= midPoint || season.midSeasonReview?.completed) {
      return res.json({
        active: false,
        reason: season.midSeasonReview?.completed ? 'Mid-season swap already completed' :
                season.status !== 'regular' ? 'Not in regular season' : 'Past mid-season point'
      });
    }

    const sortedA = sortStandings(season.standings.A);
    const sortedB = sortStandings(season.standings.B);

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

    const weeksRemaining = midPoint - season.currentWeek;

    res.json({
      active: true,
      currentWeek: season.currentWeek,
      midSeasonWeek: midPoint,
      weeksRemaining,
      urgencyMessage: weeksRemaining <= 2 ?
        `⚠️ SWAP ZONE CRITICAL: Only ${weeksRemaining} week(s) until mid-season review!` :
        `${weeksRemaining} weeks until mid-season swap`,
      relegationZone,
      promotionZone,
      bubble: [...bubbleA, ...bubbleB],
      swapRules: [
        'At Week 5 mid-season review:',
        '• Bottom 3 from Group A (Seeded) move DOWN to Group B',
        '• Top 3 from Group B (Unseeded) move UP to Group A',
        'Win now to secure your position!'
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

    const midPoint = Math.floor(season.totalWeeks / 2);
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

    const { playerName } = req.params;
    const result = await pool.query(`
      SELECT * FROM notifications
      WHERE player_name = $1 OR player_name IS NULL
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
    await pool.query(
      `INSERT INTO notifications (player_name, type, title, message, link) VALUES ($1, $2, $3, $4, $5)`,
      [playerName, type, title, message, link]
    );
  } catch (e) {
    console.error('Failed to create notification:', e.message);
  }
};

// Send reminders for upcoming bookings (call this via cron/scheduler every 15 min)
app.post('/api/notifications/send-reminders', async (req, res) => {
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
  // Insert default config if not exists
  await pool.query(`
    INSERT INTO league_config (id, season_name, registration_open)
    VALUES (1, 'Winter League 2026', TRUE)
    ON CONFLICT (id) DO NOTHING
  `);
};

// Get registration config and status
app.get('/api/registration/config', async (req, res) => {
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
  try {
    await ensureRegistrationTables();

    // Check if registration is open
    const configResult = await pool.query('SELECT * FROM league_config WHERE id = 1');
    const config = configResult.rows[0];

    if (!config?.registration_open) {
      return res.status(400).json({ error: 'Registration is currently closed' });
    }

    if (config.registration_close_date && new Date(config.registration_close_date) < new Date()) {
      return res.status(400).json({ error: 'Registration deadline has passed' });
    }

    // Check max players
    const countResult = await pool.query('SELECT COUNT(*) as count FROM league_registration');
    if (parseInt(countResult.rows[0].count) >= config.max_players) {
      return res.status(400).json({ error: 'Maximum number of players reached' });
    }

    const { playerName, email } = req.body;

    if (!playerName || playerName.trim().length < 2) {
      return res.status(400).json({ error: 'Player name is required (minimum 2 characters)' });
    }

    const trimmedName = playerName.trim();

    // Check if already registered
    const existingReg = await pool.query(
      'SELECT * FROM league_registration WHERE LOWER(player_name) = LOWER($1)',
      [trimmedName]
    );
    if (existingReg.rows.length > 0) {
      return res.status(400).json({ error: 'This name is already registered' });
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
    if (error.code === '23505') { // unique violation
      return res.status(400).json({ error: 'This name is already registered' });
    }
    res.status(500).json({ error: error.message });
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

// Get public registration list (includes id for admin actions)
app.get('/api/registration/list', async (req, res) => {
  try {
    await ensureRegistrationTables();

    const result = await pool.query(`
      SELECT id, player_name, is_ranked, registration_status, final_seed, suggested_seed, created_at
      FROM league_registration
      WHERE registration_status != 'rejected'
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

    await pool.query(`
      UPDATE league_registration SET
        registration_status = COALESCE($1, registration_status),
        final_seed = $2,
        admin_approved = TRUE,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [registration_status, final_seed, id]);

    res.json({ success: true });
  } catch (error) {
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

    unseededPlayers.forEach(p => {
      finalPlayers.push({
        name: p.player_name,
        seed: seedNum++,
        isRanked: false
      });
    });

    // Standard bracket seeding (1 vs 16, 8 vs 9, etc)
    const bracketOrder = [];
    function fillBracket(low, high, arr) {
      if (low === high) {
        arr.push(low);
      } else {
        fillBracket(low, (low + high) / 2, arr);
        fillBracket((low + high) / 2 + 1, high, arr);
      }
    }
    fillBracket(1, bracketSize, bracketOrder);

    // Create matches with byes for top seeds
    const round1Matches = [];
    for (let i = 0; i < bracketSize / 2; i++) {
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

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Helper function to send match reminders
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
      await pool.query('UPDATE table_bookings SET reminded = TRUE WHERE id = $1', [booking.id]);
    }

    if (bookings.rows.length > 0) {
      console.log(`Sent ${bookings.rows.length} match reminders`);
    }
  } catch (e) {
    console.log('Reminder check failed:', e.message);
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Database: ${process.env.DATABASE_URL ? 'PostgreSQL' : 'Local development'}`);

  // Check for match reminders every 15 minutes
  setInterval(sendMatchReminders, 15 * 60 * 1000);
  console.log('Match reminder scheduler started (checks every 15 minutes)');
});

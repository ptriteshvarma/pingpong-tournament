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

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully:', res.rows[0]);
  }
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
    const result = await pool.query('SELECT name, seed FROM players ORDER BY seed NULLS LAST, name');
    res.json(result.rows);
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

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Database: ${process.env.DATABASE_URL ? 'PostgreSQL' : 'Local development'}`);
});

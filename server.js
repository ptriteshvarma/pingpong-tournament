const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = 'Username';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Data file paths
const DATA_DIR = process.env.DATA_DIR || './data';
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const AVAILABILITY_FILE = path.join(DATA_DIR, 'availability.json');
const MATCHES_FILE = path.join(DATA_DIR, 'matches.json');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');
const BRACKET_FILE = path.join(DATA_DIR, 'bracket.json');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Helper functions
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

const writeJSON = (filepath, data) => {
  try {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error(`Error writing ${filepath}:`, e);
    return false;
  }
};

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
  // Lower bracket has 2 * (numRounds - 1) rounds
  const lowerRounds = 2 * (numRounds - 1);
  let lbMatchCount = bracketSize / 4; // First lower round has half of UB R1 losers

  for (let lbRound = 1; lbRound <= lowerRounds; lbRound++) {
    const roundMatches = [];
    const isDropInRound = lbRound % 2 === 0; // Even rounds receive drops from UB

    if (lbRound === 1) {
      // First LB round: losers from UB R1
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
      // Drop-in rounds: LB winners vs UB losers
      const ubDropRound = Math.floor(lbRound / 2) + 1;
      for (let i = 0; i < lbMatchCount; i++) {
        roundMatches.push({
          id: `LB-R${lbRound}-M${i + 1}`,
          round: lbRound,
          matchNumber: i + 1,
          player1: null, // From previous LB round
          player2: null, // From UB drop
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
      // Regular LB rounds: LB winners vs LB winners
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
    player1: null, // UB winner
    player2: null, // LB winner
    winner: null,
    loser: null,
    score1: null,
    score2: null,
    completed: false,
    lockedDate: null,
    lockedTime: null
  };

  // Bracket Reset (if LB winner wins GF)
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

  // Propagate bye winners
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
  // Process UB Round 1 byes
  const ubR1 = bracket.upperBracket[0];
  ubR1.forEach(match => {
    if (match.isBye && match.winner) {
      // Find next match and set winner as player
      advanceWinner(bracket, match.id, match.winner);
    }
  });
};

// Advance winner to next match
const advanceWinner = (bracket, matchId, winner) => {
  // Find the match that this feeds into
  for (const round of bracket.upperBracket) {
    for (const match of round) {
      if (match.feedsFrom && match.feedsFrom.includes(matchId)) {
        const feedIndex = match.feedsFrom.indexOf(matchId);
        if (feedIndex === 0) {
          match.player1 = winner;
        } else {
          match.player2 = winner;
        }
        // Check if both players are set and one is bye-advanced
        if (match.player1 && !match.player2) {
          // Check if other feeder is a bye
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

// Update leaderboard when match completes
const updateLeaderboard = (winner, loser) => {
  const leaderboard = readJSON(LEADERBOARD_FILE, { players: {}, weekStart: null });

  // Check if we need to reset weekly stats
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - now.getDay() + 1);
  monday.setHours(0, 0, 0, 0);
  const weekStart = monday.toISOString().split('T')[0];

  if (leaderboard.weekStart !== weekStart) {
    // Reset weekly stats
    Object.keys(leaderboard.players).forEach(player => {
      leaderboard.players[player].weekly = { wins: 0, losses: 0, points: 0, matchesPlayed: 0 };
    });
    leaderboard.weekStart = weekStart;
  }

  // Initialize players if needed
  [winner, loser].forEach(player => {
    if (!leaderboard.players[player]) {
      leaderboard.players[player] = {
        weekly: { wins: 0, losses: 0, points: 0, matchesPlayed: 0 },
        allTime: { wins: 0, losses: 0, points: 0, matchesPlayed: 0 }
      };
    }
  });

  // Update winner stats (2 points for win)
  leaderboard.players[winner].weekly.wins++;
  leaderboard.players[winner].weekly.points += 2;
  leaderboard.players[winner].weekly.matchesPlayed++;
  leaderboard.players[winner].allTime.wins++;
  leaderboard.players[winner].allTime.points += 2;
  leaderboard.players[winner].allTime.matchesPlayed++;

  // Update loser stats (1 point for loss)
  leaderboard.players[loser].weekly.losses++;
  leaderboard.players[loser].weekly.points += 1;
  leaderboard.players[loser].weekly.matchesPlayed++;
  leaderboard.players[loser].allTime.losses++;
  leaderboard.players[loser].allTime.points += 1;
  leaderboard.players[loser].allTime.matchesPlayed++;

  writeJSON(LEADERBOARD_FILE, leaderboard);
  return leaderboard;
};

// Backup functions
const createBackup = () => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.json`);

    const backup = {
      timestamp: new Date().toISOString(),
      availability: readJSON(AVAILABILITY_FILE),
      matches: readJSON(MATCHES_FILE),
      players: readJSON(PLAYERS_FILE, []),
      bracket: readJSON(BRACKET_FILE, null),
      leaderboard: readJSON(LEADERBOARD_FILE, { players: {}, weekStart: null }),
      config: readJSON(CONFIG_FILE, {})
    };

    const hasData = Object.keys(backup.availability).length > 0 ||
                    Object.keys(backup.matches).length > 0 ||
                    backup.players.length > 0;

    if (hasData) {
      writeJSON(backupFile, backup);
      console.log(`Backup created: ${backupFile}`);
      cleanOldBackups();
    }
  } catch (e) {
    console.error('Error creating backup:', e);
  }
};

const cleanOldBackups = () => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .sort()
      .reverse();

    files.slice(10).forEach(file => {
      fs.unlinkSync(path.join(BACKUP_DIR, file));
      console.log(`Removed old backup: ${file}`);
    });
  } catch (e) {
    console.error('Error cleaning old backups:', e);
  }
};

const getLatestBackup = () => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length > 0) {
      return readJSON(path.join(BACKUP_DIR, files[0]));
    }
  } catch (e) {
    console.error('Error getting latest backup:', e);
  }
  return null;
};

const restoreFromBackup = () => {
  const currentPlayers = readJSON(PLAYERS_FILE, []);
  const currentBracket = readJSON(BRACKET_FILE, null);

  if (currentPlayers.length === 0 && !currentBracket) {
    const backup = getLatestBackup();
    if (backup) {
      console.log(`Restoring from backup: ${backup.timestamp}`);

      if (backup.availability) writeJSON(AVAILABILITY_FILE, backup.availability);
      if (backup.matches) writeJSON(MATCHES_FILE, backup.matches);
      if (backup.players) writeJSON(PLAYERS_FILE, backup.players);
      if (backup.bracket) writeJSON(BRACKET_FILE, backup.bracket);
      if (backup.leaderboard) writeJSON(LEADERBOARD_FILE, backup.leaderboard);
      if (backup.config) writeJSON(CONFIG_FILE, backup.config);

      return true;
    }
  }
  return false;
};

// Restore from backup on startup
restoreFromBackup();

// Create backup every 5 minutes
setInterval(createBackup, 5 * 60 * 1000);

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
app.get('/api/players', (req, res) => {
  try {
    const players = readJSON(PLAYERS_FILE, []);
    res.json(players);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add/update players (admin only)
app.post('/api/players', requireAdmin, (req, res) => {
  try {
    const players = req.body;
    if (!Array.isArray(players)) {
      return res.status(400).json({ error: 'Players must be an array' });
    }

    const success = writeJSON(PLAYERS_FILE, players);
    if (!success) {
      return res.status(500).json({ error: 'Failed to save players' });
    }

    // Auto-regenerate bracket
    if (players.length >= 2) {
      const bracket = generateBracket(players);
      writeJSON(BRACKET_FILE, bracket);
    }

    res.json({ success: true, playerCount: players.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get bracket
app.get('/api/bracket', (req, res) => {
  try {
    const bracket = readJSON(BRACKET_FILE, null);
    res.json(bracket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update bracket (for match results)
app.post('/api/bracket', (req, res) => {
  try {
    const bracket = req.body;
    const success = writeJSON(BRACKET_FILE, bracket);
    if (!success) {
      return res.status(500).json({ error: 'Failed to save bracket' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate bracket (admin only)
app.post('/api/bracket/generate', requireAdmin, (req, res) => {
  try {
    const players = readJSON(PLAYERS_FILE, []);
    if (players.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 players to generate bracket' });
    }

    const bracket = generateBracket(players);
    if (bracket.error) {
      return res.status(400).json({ error: bracket.error });
    }

    const success = writeJSON(BRACKET_FILE, bracket);
    if (!success) {
      return res.status(500).json({ error: 'Failed to save bracket' });
    }

    res.json({ success: true, bracket });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Record match result
app.post('/api/bracket/match', (req, res) => {
  try {
    const { matchId, winner, loser, score1, score2 } = req.body;
    const bracket = readJSON(BRACKET_FILE, null);

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
    updateLeaderboard(winner, loser);

    // Advance winner/loser to next matches
    // TODO: Implement full bracket progression logic

    writeJSON(BRACKET_FILE, bracket);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
  try {
    const leaderboard = readJSON(LEADERBOARD_FILE, { players: {}, weekStart: null });

    // Check if we need to reset weekly stats
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - now.getDay() + 1);
    monday.setHours(0, 0, 0, 0);
    const weekStart = monday.toISOString().split('T')[0];

    if (leaderboard.weekStart !== weekStart) {
      Object.keys(leaderboard.players).forEach(player => {
        leaderboard.players[player].weekly = { wins: 0, losses: 0, points: 0, matchesPlayed: 0 };
      });
      leaderboard.weekStart = weekStart;
      writeJSON(LEADERBOARD_FILE, leaderboard);
    }

    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset weekly leaderboard (admin only)
app.post('/api/leaderboard/reset-weekly', requireAdmin, (req, res) => {
  try {
    const leaderboard = readJSON(LEADERBOARD_FILE, { players: {}, weekStart: null });

    Object.keys(leaderboard.players).forEach(player => {
      leaderboard.players[player].weekly = { wins: 0, losses: 0, points: 0, matchesPlayed: 0 };
    });

    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - now.getDay() + 1);
    leaderboard.weekStart = monday.toISOString().split('T')[0];

    writeJSON(LEADERBOARD_FILE, leaderboard);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get config
app.get('/api/config', (req, res) => {
  try {
    const config = readJSON(CONFIG_FILE, {
      tournamentName: 'Ping Pong Tournament',
      timeSlotDuration: 20,
      startTime: '08:00',
      endTime: '17:00'
    });
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update config (admin only)
app.post('/api/config', requireAdmin, (req, res) => {
  try {
    const config = req.body;
    const success = writeJSON(CONFIG_FILE, config);
    if (!success) {
      return res.status(500).json({ error: 'Failed to save config' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get availability
app.get('/api/availability', (req, res) => {
  try {
    const data = readJSON(AVAILABILITY_FILE);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save availability
app.post('/api/availability', (req, res) => {
  try {
    const success = writeJSON(AVAILABILITY_FILE, req.body);
    if (!success) {
      return res.status(500).json({ error: 'Failed to write data' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get matches (legacy support)
app.get('/api/matches', (req, res) => {
  try {
    const data = readJSON(MATCHES_FILE);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save matches (legacy support)
app.post('/api/matches', (req, res) => {
  try {
    const success = writeJSON(MATCHES_FILE, req.body);
    if (!success) {
      return res.status(500).json({ error: 'Failed to write data' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manual backup endpoint
app.post('/api/backup', (req, res) => {
  try {
    createBackup();
    res.json({ success: true, message: 'Backup created' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List backups endpoint
app.get('/api/backups', (req, res) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .sort()
      .reverse()
      .map(f => {
        const backup = readJSON(path.join(BACKUP_DIR, f));
        return {
          filename: f,
          timestamp: backup.timestamp,
          hasPlayers: (backup.players || []).length > 0,
          hasBracket: !!backup.bracket
        };
      });
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Restore from specific backup
app.post('/api/restore/:filename', requireAdmin, (req, res) => {
  try {
    const backupFile = path.join(BACKUP_DIR, req.params.filename);
    if (!fs.existsSync(backupFile)) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    const backup = readJSON(backupFile);
    if (backup.availability) writeJSON(AVAILABILITY_FILE, backup.availability);
    if (backup.matches) writeJSON(MATCHES_FILE, backup.matches);
    if (backup.players) writeJSON(PLAYERS_FILE, backup.players);
    if (backup.bracket) writeJSON(BRACKET_FILE, backup.bracket);
    if (backup.leaderboard) writeJSON(LEADERBOARD_FILE, backup.leaderboard);
    if (backup.config) writeJSON(CONFIG_FILE, backup.config);

    res.json({ success: true, message: `Restored from ${req.params.filename}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(`Backup directory: ${BACKUP_DIR}`);
});

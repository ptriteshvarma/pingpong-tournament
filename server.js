const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize SQLite database
const dbPath = process.env.DATABASE_PATH || './pingpong.db';
const db = new Database(dbPath);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    bracket TEXT NOT NULL,
    total_rounds INTEGER NOT NULL,
    current_round INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0,
    winner_id INTEGER,
    winner_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// API Routes

// Get all players
app.get('/api/players', (req, res) => {
  try {
    const players = db.prepare('SELECT * FROM players ORDER BY wins DESC, losses ASC').all();
    res.json(players);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a player
app.post('/api/players', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Player name is required' });
    }
    const stmt = db.prepare('INSERT INTO players (name) VALUES (?)');
    const result = stmt.run(name.trim());
    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(result.lastInsertRowid);
    res.json(player);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a player
app.put('/api/players/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, wins, losses } = req.body;

    if (name !== undefined) {
      db.prepare('UPDATE players SET name = ? WHERE id = ?').run(name, id);
    }
    if (wins !== undefined) {
      db.prepare('UPDATE players SET wins = ? WHERE id = ?').run(wins, id);
    }
    if (losses !== undefined) {
      db.prepare('UPDATE players SET losses = ? WHERE id = ?').run(losses, id);
    }

    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
    res.json(player);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a player
app.delete('/api/players/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM players WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all tournaments
app.get('/api/tournaments', (req, res) => {
  try {
    const tournaments = db.prepare('SELECT * FROM tournaments ORDER BY created_at DESC').all();
    const parsed = tournaments.map(t => ({
      ...t,
      bracket: JSON.parse(t.bracket),
      completed: Boolean(t.completed),
      winner: t.winner_id ? { id: t.winner_id, name: t.winner_name } : null
    }));
    res.json(parsed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a tournament
app.post('/api/tournaments', (req, res) => {
  try {
    const { date, bracket, totalRounds, currentRound } = req.body;
    const stmt = db.prepare(`
      INSERT INTO tournaments (date, bracket, total_rounds, current_round)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(date, JSON.stringify(bracket), totalRounds, currentRound);
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(result.lastInsertRowid);
    res.json({
      ...tournament,
      bracket: JSON.parse(tournament.bracket),
      completed: Boolean(tournament.completed),
      winner: null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a tournament
app.put('/api/tournaments/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { bracket, currentRound, completed, winner } = req.body;

    const updates = [];
    const values = [];

    if (bracket !== undefined) {
      updates.push('bracket = ?');
      values.push(JSON.stringify(bracket));
    }
    if (currentRound !== undefined) {
      updates.push('current_round = ?');
      values.push(currentRound);
    }
    if (completed !== undefined) {
      updates.push('completed = ?');
      values.push(completed ? 1 : 0);
    }
    if (winner !== undefined) {
      updates.push('winner_id = ?, winner_name = ?');
      values.push(winner?.id || null, winner?.name || null);
    }

    if (updates.length > 0) {
      values.push(id);
      db.prepare(`UPDATE tournaments SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(id);
    res.json({
      ...tournament,
      bracket: JSON.parse(tournament.bracket),
      completed: Boolean(tournament.completed),
      winner: tournament.winner_id ? { id: tournament.winner_id, name: tournament.winner_name } : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a tournament
app.delete('/api/tournaments/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM tournaments WHERE id = ?').run(id);
    res.json({ success: true });
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
});

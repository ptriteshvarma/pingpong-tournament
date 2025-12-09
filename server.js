const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize SQLite database
const dbPath = process.env.DATABASE_PATH || './pingpong.db';
const db = new Database(dbPath);

// Create tables for the new schema
db.exec(`
  CREATE TABLE IF NOT EXISTS availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Initialize with empty data if tables are empty
const initAvail = db.prepare('SELECT COUNT(*) as count FROM availability').get();
if (initAvail.count === 0) {
  db.prepare('INSERT INTO availability (data) VALUES (?)').run('{}');
}

const initMatches = db.prepare('SELECT COUNT(*) as count FROM matches').get();
if (initMatches.count === 0) {
  db.prepare('INSERT INTO matches (data) VALUES (?)').run('{}');
}

// API Routes

// Get availability
app.get('/api/availability', (req, res) => {
  try {
    const row = db.prepare('SELECT data FROM availability ORDER BY id DESC LIMIT 1').get();
    res.json(row ? JSON.parse(row.data) : {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save availability
app.post('/api/availability', (req, res) => {
  try {
    const data = JSON.stringify(req.body);
    db.prepare('UPDATE availability SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(data);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get matches
app.get('/api/matches', (req, res) => {
  try {
    const row = db.prepare('SELECT data FROM matches ORDER BY id DESC LIMIT 1').get();
    res.json(row ? JSON.parse(row.data) : {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save matches
app.post('/api/matches', (req, res) => {
  try {
    const data = JSON.stringify(req.body);
    db.prepare('UPDATE matches SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(data);
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

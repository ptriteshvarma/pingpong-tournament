const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Data file paths
const DATA_DIR = process.env.DATA_DIR || './data';
const AVAILABILITY_FILE = path.join(DATA_DIR, 'availability.json');
const MATCHES_FILE = path.join(DATA_DIR, 'matches.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper functions
const readJSON = (filepath) => {
  try {
    if (fs.existsSync(filepath)) {
      return JSON.parse(fs.readFileSync(filepath, 'utf8'));
    }
  } catch (e) {
    console.error(`Error reading ${filepath}:`, e);
  }
  return {};
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

// API Routes

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
    writeJSON(AVAILABILITY_FILE, req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get matches
app.get('/api/matches', (req, res) => {
  try {
    const data = readJSON(MATCHES_FILE);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save matches
app.post('/api/matches', (req, res) => {
  try {
    writeJSON(MATCHES_FILE, req.body);
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

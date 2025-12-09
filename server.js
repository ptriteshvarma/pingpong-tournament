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
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const AVAILABILITY_FILE = path.join(DATA_DIR, 'availability.json');
const MATCHES_FILE = path.join(DATA_DIR, 'matches.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Helper functions
const readJSON = (filepath) => {
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

// Backup functions
const createBackup = () => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.json`);

    const backup = {
      timestamp: new Date().toISOString(),
      availability: readJSON(AVAILABILITY_FILE),
      matches: readJSON(MATCHES_FILE)
    };

    // Only create backup if there's actual data
    if (Object.keys(backup.availability).length > 0 || Object.keys(backup.matches).length > 0) {
      writeJSON(backupFile, backup);
      console.log(`Backup created: ${backupFile}`);

      // Keep only last 10 backups
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

    // Remove backups beyond the 10 most recent
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
  const currentAvail = readJSON(AVAILABILITY_FILE);
  const currentMatches = readJSON(MATCHES_FILE);

  // If current data is empty, try to restore from backup
  if (Object.keys(currentAvail).length === 0 && Object.keys(currentMatches).length === 0) {
    const backup = getLatestBackup();
    if (backup) {
      console.log(`Restoring from backup: ${backup.timestamp}`);

      if (backup.availability && Object.keys(backup.availability).length > 0) {
        writeJSON(AVAILABILITY_FILE, backup.availability);
        console.log('Restored availability data');
      }

      if (backup.matches && Object.keys(backup.matches).length > 0) {
        writeJSON(MATCHES_FILE, backup.matches);
        console.log('Restored matches data');
      }

      return true;
    }
  }
  return false;
};

// Restore from backup on startup
restoreFromBackup();

// Create backup every 5 minutes
setInterval(createBackup, 5 * 60 * 1000);

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
    const success = writeJSON(AVAILABILITY_FILE, req.body);
    if (!success) {
      return res.status(500).json({ error: 'Failed to write data' });
    }
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
          hasAvailability: Object.keys(backup.availability || {}).length > 0,
          hasMatches: Object.keys(backup.matches || {}).length > 0
        };
      });
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Restore from specific backup
app.post('/api/restore/:filename', (req, res) => {
  try {
    const backupFile = path.join(BACKUP_DIR, req.params.filename);
    if (!fs.existsSync(backupFile)) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    const backup = readJSON(backupFile);
    if (backup.availability) writeJSON(AVAILABILITY_FILE, backup.availability);
    if (backup.matches) writeJSON(MATCHES_FILE, backup.matches);

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

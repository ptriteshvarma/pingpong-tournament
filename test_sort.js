const { sortStandings } = require('./server.js');

// Mock standings to test
const testStandings = {
  'Ritesh Varma': {
    wins: 5,
    losses: 2,
    points: 100,
    pointsFor: 150,
    pointsAgainst: 100,
    headToHead: {
      'Alan Smith': { wins: 1, losses: 0 },
      'Michael Smith': { wins: 1, losses: 0 }
    },
    initialSeed: 1
  },
  'Alan Smith': {
    wins: 4,
    losses: 3,
    points: 90,
    pointsFor: 140,
    pointsAgainst: 110,
    headToHead: {
      'Ritesh Varma': { wins: 0, losses: 1 },
      'Michael Smith': { wins: 1, losses: 0 }
    },
    initialSeed: 2
  },
  'Michael Smith': {
    wins: 4,
    losses: 3,
    points: 85,
    pointsFor: 135,
    pointsAgainst: 115,
    headToHead: {
      'Ritesh Varma': { wins: 0, losses: 1 },
      'Alan Smith': { wins: 0, losses: 1 }
    },
    initialSeed: 3
  }
};

console.log('Input standings:');
Object.entries(testStandings).forEach(([name, stats]) => {
  console.log(`${name}: ${stats.wins}W-${stats.losses}L`);
});

// This won't work because sortStandings isn't exported
// Let's check the server.js file more carefully

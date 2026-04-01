const https = require('https');

// First, get current data to check Paul's standings
https.get('https://pingpong-tournament.vercel.app/api/season', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const s = JSON.parse(d);

    // Find Paul in Group B
    const paulName = Object.keys(s.standings.B).find(n => n.startsWith('Paul'));
    if (paulName) {
      const paulStats = s.standings.B[paulName];
      console.log('Paul in Group B:', JSON.stringify({ promotedFrom: paulStats.promotedFrom, preSwapStats: paulStats.preSwapStats ? 'exists' : 'none' }));
    }

    // Check capacity for more games
    for (const group of ['A', 'B']) {
      const players = Object.keys(s.standings[group]);
      const n = players.length;
      const totalPairs = n * (n - 1) / 2;

      // Count existing matchups (completed H2H)
      let existingPairs = 0;
      players.forEach(p => {
        const h2h = s.standings[group][p]?.headToHead || {};
        Object.keys(h2h).forEach(opp => {
          if (players.includes(opp) && p < opp) existingPairs++;
        });
      });

      // Count POST matchups
      let postPairs = new Set();
      for (const week of s.schedule[group]) {
        for (const m of week) {
          if (m.id && m.id.includes('-POST-') && !m.cancelled) {
            postPairs.add([m.player1, m.player2].sort().join('|'));
          }
        }
      }

      const unusedPairs = totalPairs - postPairs.size;
      console.log('\nGroup ' + group + ': ' + n + ' players, ' + totalPairs + ' total pairs');
      console.log('  First-half matchups: ' + existingPairs);
      console.log('  Current POST matchups: ' + postPairs.size);
      console.log('  Unused POST pairs: ' + unusedPairs);
      console.log('  For 3 more games/person: need ' + (n * 3 / 2) + ' more matches');
      console.log('  For 8 total/person: need ' + (n * 8 / 2) + ' total POST matches (currently ' + postPairs.size + ')');
    }
  });
});

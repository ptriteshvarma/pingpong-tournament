const https = require('https');
https.get('https://pingpong-tournament.vercel.app/api/season', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const s = JSON.parse(d);

    for (const group of ['A', 'B']) {
      console.log('\n=== GROUP ' + group + ' STANDINGS (rank order) ===');
      const st = s.standings[group];
      const sorted = Object.entries(st).sort((a, b) => {
        if (b[1].wins !== a[1].wins) return b[1].wins - a[1].wins;
        if (a[1].losses !== b[1].losses) return a[1].losses - b[1].losses;
        return 0;
      });
      sorted.forEach(([name, stats], i) => {
        console.log((i+1) + '. ' + name.padEnd(25) + stats.wins + 'W-' + stats.losses + 'L');
      });

      console.log('\nPOST matches with rank differences:');
      const rankMap = {};
      sorted.forEach(([name], i) => { rankMap[name] = i + 1; });

      let totalRankDiff = 0;
      let matchCount = 0;
      for (const week of s.schedule[group]) {
        for (const m of week) {
          if (m.id && m.id.includes('-POST-') && !m.cancelled) {
            const r1 = rankMap[m.player1] || '?';
            const r2 = rankMap[m.player2] || '?';
            const diff = Math.abs(r1 - r2);
            totalRankDiff += diff;
            matchCount++;
          }
        }
      }
      console.log('Avg rank difference: ' + (totalRankDiff / matchCount).toFixed(1) + ' (lower = more competitive)');
      console.log('Total POST matches: ' + matchCount);
    }
  });
});

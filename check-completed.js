const https = require('https');
https.get('https://pingpong-tournament.vercel.app/api/season', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const s = JSON.parse(d);

    for (const group of ['A', 'B']) {
      console.log('\n=== GROUP ' + group + ' COMPLETED GAMES ===');
      const players = Object.entries(s.standings[group]);
      players.sort((a, b) => (b[1].wins + b[1].losses) - (a[1].wins + a[1].losses));
      players.forEach(([name, stats]) => {
        const completed = stats.wins + stats.losses;
        const needed = 10 - completed;
        console.log(name.padEnd(28) + completed + ' completed, need ' + needed + ' more for 10 total (' + stats.wins + 'W-' + stats.losses + 'L)');
      });
    }
  });
});

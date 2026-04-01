const https = require('https');
https.get('https://pingpong-tournament.vercel.app/api/season', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const season = JSON.parse(data);
      console.log('=== GROUP A TOP 6 ===');
      const a = Object.entries(season.standings.A).map(([name, stats]) => ({
        name,
        ...stats,
        diff: stats.pointsFor - stats.pointsAgainst
      })).sort((x, y) => (y.wins - y.losses) - (x.wins - x.losses) || y.wins - x.wins || (y.diff - x.diff));
      a.slice(0, 6).forEach((p, i) => {
        const sign = p.diff >= 0 ? '+' : '';
        console.log(i+1 + '. ' + p.name + ': ' + p.wins + 'W-' + p.losses + 'L | PF:' + p.pointsFor + ' PA:' + p.pointsAgainst + ' Diff:' + sign + p.diff);
      });
      console.log('\n=== GROUP B TOP 6 ===');
      const b = Object.entries(season.standings.B).map(([name, stats]) => ({
        name,
        ...stats,
        diff: stats.pointsFor - stats.pointsAgainst
      })).sort((x, y) => (y.wins - y.losses) - (x.wins - x.losses) || y.wins - x.wins || (y.diff - x.diff));
      b.slice(0, 6).forEach((p, i) => {
        const sign = p.diff >= 0 ? '+' : '';
        console.log(i+1 + '. ' + p.name + ': ' + p.wins + 'W-' + p.losses + 'L | PF:' + p.pointsFor + ' PA:' + p.pointsAgainst + ' Diff:' + sign + p.diff);
      });
    } catch(e) { console.log('Error:', e.message); }
  });
}).on('error', console.error);

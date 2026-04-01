const https = require('https');
https.get('https://pingpong-tournament.vercel.app/api/season', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const s = JSON.parse(d);

    // Check for any undefined/null values that might crash rendering
    for (const group of ['A', 'B']) {
      Object.entries(s.standings[group]).forEach(([name, stats]) => {
        if (stats.wins === undefined || stats.losses === undefined) {
          console.log('MISSING wins/losses:', name, JSON.stringify(stats));
        }
        if (stats.pointsFor === undefined) {
          console.log('MISSING pointsFor:', name);
        }
        if (stats.streak === undefined) {
          console.log('MISSING streak:', name);
        }
      });
    }

    // Check Karen
    const karenA = s.standings.A['Karen Isaacs'];
    const karenB = s.standings.B['Karen Isaacs'];
    console.log('Karen in A:', karenA ? 'YES' : 'NO');
    console.log('Karen in B:', karenB ? 'YES' : 'NO');
    if (karenB) {
      console.log('Karen B stats keys:', Object.keys(karenB).join(', '));
    }

    // Check groups.A/B
    console.log('\nGroups.A players:', s.groups.A.players.map(p => p.name).join(', '));
    console.log('Groups.B players:', s.groups.B.players.map(p => p.name).join(', '));
    console.log('\nschedule.A length:', s.schedule.A.length);
    console.log('totalWeeks:', s.totalWeeks);
    console.log('currentWeek:', s.currentWeek);
  });
});

const https = require('https');
https.get('https://pingpong-tournament.vercel.app/api/season', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const s = JSON.parse(d);
    const paulName = Object.keys(s.standings.B).find(n => n.startsWith('Paul'));
    if (paulName) {
      const st = s.standings.B[paulName];
      console.log('Paul standings fields:', JSON.stringify({
        promotedFrom: st.promotedFrom,
        preSwapStats: st.preSwapStats ? 'EXISTS' : undefined,
        promotedMidSeason: st.promotedMidSeason
      }));
    }
    // Also check groups.B.players for Paul
    const paulPlayer = s.groups.B.players.find(p => p.name && p.name.startsWith('Paul'));
    if (paulPlayer) {
      console.log('Paul groups.B entry:', JSON.stringify(paulPlayer));
    }
  });
});

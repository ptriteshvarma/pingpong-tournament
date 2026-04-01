const https = require('https');
https.get('https://pingpong-tournament.vercel.app/api/season', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const s = JSON.parse(d);

    // Check Ritesh's standings
    const r = s.standings.A['Ritesh Varma'];
    console.log('=== RITESH VARMA STANDINGS ===');
    console.log('Wins:', r.wins, 'Losses:', r.losses, 'Total completed:', r.wins + r.losses);
    console.log('H2H:', JSON.stringify(r.headToHead));

    // Check all Ritesh's matches in schedule
    console.log('\n=== ALL RITESH MATCHES IN SCHEDULE ===');
    for (const group of ['A', 'B']) {
      for (let w = 0; w < s.schedule[group].length; w++) {
        for (const m of s.schedule[group][w]) {
          if (m.player1 === 'Ritesh Varma' || m.player2 === 'Ritesh Varma') {
            const opp = m.player1 === 'Ritesh Varma' ? m.player2 : m.player1;
            const status = m.cancelled ? 'CANCELLED' : (m.completed ? 'DONE' : 'PENDING');
            const score = m.completed ? ` (${m.score1}-${m.score2})` : '';
            console.log('Group ' + group + ' W' + (w+1) + ': ' + m.id + ' vs ' + opp + ' [' + status + ']' + score);
          }
        }
      }
    }
  });
});

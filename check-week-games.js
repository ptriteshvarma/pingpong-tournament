const https = require('https');
https.get('https://pingpong-tournament.vercel.app/api/season', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const s = JSON.parse(d);

    // Check ALL players
    console.log('=== ALL PLAYERS GAME COUNTS ===');
    for (const grp of ['A', 'B']) {
      console.log('\nGroup ' + grp + ' (' + Object.keys(s.standings[grp]).length + ' players):');
      const players = Object.keys(s.standings[grp]).sort();
      for (const p of players) {
        let done = 0, pend = 0;
        for (const week of s.schedule[grp]) {
          for (const m of week) {
            if (m.cancelled) continue;
            if (m.player1 === p || m.player2 === p) {
              if (m.completed) done++;
              else pend++;
            }
          }
        }
        console.log('  ' + p.padEnd(28) + done + ' done + ' + pend + ' pending = ' + (done + pend));
      }
    }

    // Check Ritesh specifically
    const player = 'Ritesh Varma';
    const group = 'A';
    console.log('\n=== ' + player + ' MATCH DETAILS ===');
    for (let w = 0; w < s.schedule[group].length; w++) {
      for (const m of s.schedule[group][w]) {
        if (m.cancelled) continue;
        if (m.player1 === player || m.player2 === player) {
          const opp = m.player1 === player ? m.player2 : m.player1;
          const status = m.completed ? 'DONE' : 'PENDING';
          console.log('  W' + (w+1) + ': vs ' + opp.padEnd(25) + ' [' + status + '] ' + m.id);
        }
      }
    }
  });
});

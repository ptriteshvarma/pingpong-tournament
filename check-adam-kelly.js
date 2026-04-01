const https = require('https');
https.get('https://pingpong-tournament.vercel.app/api/season', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const s = JSON.parse(d);

    console.log('=== ADAM KELLY ALL MATCHES ===');
    const opponents = [];
    for (const group of ['A', 'B']) {
      for (let w = 0; w < s.schedule[group].length; w++) {
        for (const m of s.schedule[group][w]) {
          if (m.cancelled) continue;
          if (m.player1 === 'Adam Kelly' || m.player2 === 'Adam Kelly') {
            const opp = m.player1 === 'Adam Kelly' ? m.player2 : m.player1;
            const status = m.completed ? 'DONE' : 'PENDING';
            console.log('W' + (w+1) + ': ' + m.id + ' vs ' + opp + ' [' + status + ']');
            opponents.push(opp);
          }
        }
      }
    }

    // Check for duplicates
    const dupes = opponents.filter((o, i) => opponents.indexOf(o) !== i);
    if (dupes.length > 0) {
      console.log('\nDUPLICATE OPPONENTS: ' + [...new Set(dupes)].join(', '));
    } else {
      console.log('\nNo duplicate opponents');
    }

    // Also check all rematches across all players in Group B
    console.log('\n=== ALL GROUP B REMATCHES ===');
    const bPlayers = Object.keys(s.standings.B);
    for (const p of bPlayers) {
      const h2h = s.standings.B[p]?.headToHead || {};
      for (const week of s.schedule.B) {
        for (const m of week) {
          if (m.id && m.id.includes('-POST-') && !m.cancelled) {
            const opp = m.player1 === p ? m.player2 : (m.player2 === p ? m.player1 : null);
            if (opp && h2h[opp] && (h2h[opp].wins > 0 || h2h[opp].losses > 0)) {
              if (p < opp) { // Only print once per pair
                console.log(m.id + ': ' + p + ' vs ' + opp + ' (already played: ' + h2h[opp].wins + 'W-' + h2h[opp].losses + 'L)');
              }
            }
          }
        }
      }
    }

    // Check POST-schedule duplicates (same pair twice in new schedule)
    console.log('\n=== POST-SCHEDULE DUPLICATE PAIRS ===');
    const postPairs = {};
    for (const group of ['A', 'B']) {
      for (const week of s.schedule[group]) {
        for (const m of week) {
          if (m.id && m.id.includes('-POST-') && !m.cancelled) {
            const key = [m.player1, m.player2].sort().join('|');
            if (!postPairs[key]) postPairs[key] = [];
            postPairs[key].push(m.id);
          }
        }
      }
    }
    Object.entries(postPairs).forEach(([pair, ids]) => {
      if (ids.length > 1) console.log('DUPLICATE: ' + pair + ' in ' + ids.join(', '));
    });
  });
});

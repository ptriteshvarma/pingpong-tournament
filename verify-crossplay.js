const https = require('https');
https.get('https://pingpong-tournament.vercel.app/api/season', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const s = JSON.parse(d);

    // Players who moved groups
    const movedToA = ['Laura Harrah', 'Karen Isaacs', 'Adam Nagle'];
    const movedToB = Object.keys(s.standings.B).find(n => n.startsWith('Paul'));

    console.log('=== PROMOTED PLAYERS H2H FROM GROUP B ===');
    movedToA.forEach(name => {
      const h2h = s.standings.A[name]?.headToHead || {};
      const playedOpps = Object.keys(h2h).filter(o => h2h[o].wins > 0 || h2h[o].losses > 0);
      console.log('\n' + name + ' already played: ' + playedOpps.join(', '));

      // Check if any POST matches are against these opponents
      for (const week of s.schedule.A) {
        for (const m of week) {
          if (m.id && m.id.includes('-POST-') && !m.cancelled) {
            const opp = m.player1 === name ? m.player2 : (m.player2 === name ? m.player1 : null);
            if (opp && playedOpps.includes(opp)) {
              console.log('  REMATCH in POST: ' + m.id + ' vs ' + opp + ' (already played in Group B)');
            }
          }
        }
      }
    });

    // Check promoted players playing against each other in Group A
    console.log('\n=== PROMOTED PLAYERS VS EACH OTHER IN GROUP A ===');
    for (const week of s.schedule.A) {
      for (const m of week) {
        if (m.id && m.id.includes('-POST-') && !m.cancelled) {
          if (movedToA.includes(m.player1) && movedToA.includes(m.player2)) {
            // Check if they played each other in Group B
            const h2h = s.standings.A[m.player1]?.headToHead?.[m.player2];
            const alreadyPlayed = h2h && (h2h.wins > 0 || h2h.losses > 0);
            console.log(m.id + ': ' + m.player1 + ' vs ' + m.player2 +
              (alreadyPlayed ? ' ** ALREADY PLAYED IN B' : ' (new matchup)'));
          }
        }
      }
    }

    // Check Paul in Group B
    if (movedToB) {
      console.log('\n=== ' + movedToB + ' (moved back to B) ===');
      const h2h = s.standings.B[movedToB]?.headToHead || {};
      const playedOpps = Object.keys(h2h).filter(o => h2h[o].wins > 0 || h2h[o].losses > 0);
      console.log('Already played: ' + playedOpps.join(', '));

      for (const week of s.schedule.B) {
        for (const m of week) {
          if (m.id && m.id.includes('-POST-') && !m.cancelled) {
            const opp = m.player1 === movedToB ? m.player2 : (m.player2 === movedToB ? m.player1 : null);
            if (opp && playedOpps.includes(opp)) {
              console.log('  REMATCH in POST: ' + m.id + ' vs ' + opp + ' (already played)');
            }
          }
        }
      }
    }

    // Summary: all POST rematches across both groups
    console.log('\n=== ALL POST REMATCHES (any player) ===');
    for (const group of ['A', 'B']) {
      for (const week of s.schedule[group]) {
        for (const m of week) {
          if (m.id && m.id.includes('-POST-') && !m.cancelled) {
            const h2h1 = s.standings[group][m.player1]?.headToHead?.[m.player2];
            const alreadyPlayed = h2h1 && (h2h1.wins > 0 || h2h1.losses > 0);
            if (alreadyPlayed) {
              console.log('Group ' + group + ' ' + m.id + ': ' + m.player1 + ' vs ' + m.player2 + ' (H2H: ' + h2h1.wins + 'W-' + h2h1.losses + 'L)');
            }
          }
        }
      }
    }
  });
});

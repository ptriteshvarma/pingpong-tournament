const https = require('https');
https.get('https://pingpong-tournament.vercel.app/api/season', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const s = JSON.parse(d);

    for (const group of ['A', 'B']) {
      console.log('\n=== GROUP ' + group + ' SCHEDULE DETAILS ===');
      const playerWeekGames = {};
      const playerOpps = {};

      for (let w = 0; w < s.schedule[group].length; w++) {
        for (const m of s.schedule[group][w]) {
          if (m.id && m.id.includes('-POST-') && !m.cancelled) {
            [m.player1, m.player2].forEach(p => {
              if (!playerWeekGames[p]) playerWeekGames[p] = {};
              playerWeekGames[p][w + 1] = (playerWeekGames[p][w + 1] || 0) + 1;
              if (!playerOpps[p]) playerOpps[p] = [];
              playerOpps[p].push(p === m.player1 ? m.player2 : m.player1);
            });
          }
        }
      }

      const players = Object.keys(playerWeekGames).sort();
      let maxPerWeek = 0;
      players.forEach(p => {
        const max = Math.max(...Object.values(playerWeekGames[p]));
        if (max > maxPerWeek) maxPerWeek = max;
      });
      console.log('Max games in any week: ' + maxPerWeek + (maxPerWeek <= 2 ? ' OK' : ' OVER!'));

      // Check rematches
      let rematches = 0;
      players.forEach(p => {
        const opps = playerOpps[p];
        const dupes = opps.filter((o, i) => opps.indexOf(o) !== i);
        if (dupes.length > 0) {
          rematches += dupes.length;
          console.log('  Rematch: ' + p + ' vs ' + [...new Set(dupes)].join(', '));
        }
      });
      if (rematches === 0) console.log('No rematches in new schedule!');
    }

    // Verify group composition
    console.log('\n=== GROUP COMPOSITION ===');
    console.log('Group A (' + Object.keys(s.standings.A).length + '): ' + Object.keys(s.standings.A).sort().join(', '));
    console.log('Group B (' + Object.keys(s.standings.B).length + '): ' + Object.keys(s.standings.B).sort().join(', '));
    console.log('\nmidSeasonReview promoted: ' + JSON.stringify(s.midSeasonReview.swaps));
  });
});

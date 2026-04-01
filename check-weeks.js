const https = require('https');
https.get('https://pingpong-tournament.vercel.app/api/season', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const s = JSON.parse(d);
    console.log('currentWeek:', s.currentWeek);
    console.log('totalWeeks:', s.totalWeeks);
    console.log('schedule.A weeks:', s.schedule.A.length);
    console.log('schedule.B weeks:', s.schedule.B.length);
    console.log('midSeasonReview.completed:', s.midSeasonReview?.completed);

    // Check which weeks have POST matches
    for (const group of ['A', 'B']) {
      for (let w = 0; w < s.schedule[group].length; w++) {
        const postMatches = s.schedule[group][w].filter(m => m.id && m.id.includes('-POST-') && !m.cancelled);
        if (postMatches.length > 0) {
          console.log('Group ' + group + ' Week ' + (w+1) + ': ' + postMatches.length + ' POST matches');
        }
      }
    }
  });
});

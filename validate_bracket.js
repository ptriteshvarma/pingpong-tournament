const https = require('https');
https.get('https://pingpong-tournament.vercel.app/api/season', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const season = JSON.parse(data);
    if (!season.championship) {
      console.log('No championship bracket yet');
      return;
    }
    console.log('=== CHAMPIONSHIP BRACKET SEEDING ===\n');
    console.log('QUARTERFINALS:');
    season.championship.quarterfinals.forEach(qf => {
      console.log(qf.seed1 + ': ' + (qf.player1 || 'TBD') + ' vs ' + qf.seed2 + ': ' + (qf.player2 || 'TBD'));
    });
    if (season.championship.playInGames && season.championship.playInGames.length > 0) {
      console.log('\nPLAY-IN GAMES:');
      season.championship.playInGames.forEach(pi => {
        console.log(pi.seed1 + ': ' + (pi.player1 || 'TBD') + ' vs ' + pi.seed2 + ': ' + (pi.player2 || 'TBD'));
      });
    }
    if (season.championship.wildcardMatches && season.championship.wildcardMatches.length > 0) {
      console.log('\nWILDCARD GAMES:');
      season.championship.wildcardMatches.forEach(wc => {
        console.log(wc.seed1 + ': ' + (wc.player1 || 'TBD') + ' vs ' + wc.seed2 + ': ' + (wc.player2 || 'TBD'));
      });
    }
  });
}).on('error', console.error);

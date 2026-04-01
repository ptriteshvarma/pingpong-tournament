const https = require('https');
const data = JSON.stringify({
  promotePlayers: ['Laura Harrah', 'Karen Isaacs', 'Adam Nagle'],
  removePlayers: ['Jacob Boedicker'],
  totalGamesTarget: 10
});
const options = {
  hostname: 'pingpong-tournament.vercel.app',
  path: '/api/season/custom-promotion',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-admin-password': 'Password',
    'Content-Length': Buffer.byteLength(data)
  }
};
const req = https.request(options, res => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      const j = JSON.parse(body);
      console.log(JSON.stringify(j, null, 2));
    } catch(e) {
      console.log(body);
    }
  });
});
req.on('error', e => console.error('Error:', e.message));
req.write(data);
req.end();

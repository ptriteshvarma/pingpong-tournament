// Vercel serverless function entry point
const path = require('path');
const fs = require('fs');

module.exports = (req, res) => {
  // Try to serve static files first
  if (req.url.startsWith('/assets/')) {
    const filePath = path.join(__dirname, '..', 'public', req.url);

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath);
      const contentTypes = {
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.html': 'text/html',
        '.json': 'application/json',
        '.svg': 'image/svg+xml'
      };

      res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return fs.createReadStream(filePath).pipe(res);
    }
  }

  // Otherwise, pass to Express app
  const app = require('../server.js');
  return app(req, res);
};

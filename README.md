# Ping Pong Tournament Manager

A web-based application for managing ping pong tournaments with automatic bracket generation, live scoring, and player statistics tracking.

## Features

- **Player Management**: Add, edit, and delete players
- **Tournament Brackets**: Automatic single-elimination bracket generation
- **Live Scoring**: Real-time match score tracking with validation
- **Statistics**: Track wins and losses for each player
- **Persistent Storage**: SQLite database for reliable data storage
- **Responsive Design**: Works on desktop and mobile devices

## Quick Start

### Local Development

1. Clone this repository:
```bash
git clone https://github.com/ptriteshvarma/pingpong-tournament.git
cd pingpong-tournament
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open http://localhost:3000 in your browser

### Deploy to Railway

1. Push this repo to GitHub
2. Go to [Railway](https://railway.app)
3. Click "New Project" > "Deploy from GitHub repo"
4. Select this repository
5. Railway will auto-detect and deploy

The app uses SQLite which persists data on Railway's volume storage.

## How to Use

### Managing Players

1. Click "Manage Players" from the home screen
2. Enter player names and click "Add"
3. Edit or delete players as needed

### Running a Tournament

1. Add at least 2 players
2. Click "New Tournament" from the home screen
3. Enter scores for each match (must reach 11 points with 2-point lead)
4. Click "Next Round" to advance
5. Continue until a champion is crowned!

## Tournament Rules

- Matches are played to 11 points
- Must win by 2 points
- Single-elimination bracket
- Automatic bye rounds for odd numbers of players

## Technical Details

- Node.js + Express backend
- SQLite database (better-sqlite3)
- React 18 frontend (loaded via CDN)
- Tailwind CSS for styling

## API Endpoints

- `GET /api/players` - Get all players
- `POST /api/players` - Add a player
- `PUT /api/players/:id` - Update a player
- `DELETE /api/players/:id` - Delete a player
- `GET /api/tournaments` - Get all tournaments
- `POST /api/tournaments` - Create a tournament
- `PUT /api/tournaments/:id` - Update a tournament

## License

MIT License - feel free to use and modify as needed!

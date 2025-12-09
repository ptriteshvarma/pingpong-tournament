# 🏓 Ping Pong Tournament Manager

A web-based application for managing ping pong tournaments with automatic bracket generation, live scoring, and player statistics tracking.

## Features

- **Player Management**: Add, edit, and delete players
- **Tournament Brackets**: Automatic single-elimination bracket generation
- **Live Scoring**: Real-time match score tracking with validation
- **Statistics**: Track wins and losses for each player
- **Persistent Storage**: All data saved in browser localStorage
- **Responsive Design**: Works on desktop and mobile devices

## Quick Start

1. Clone this repository:
```bash
git clone https://github.com/yourusername/pingpong-tournament.git
cd pingpong-tournament
```

2. Open `index.html` in your web browser

That's it! No build process or dependencies required.

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

- Pure HTML/CSS/JavaScript
- React 18 (loaded via CDN)
- Tailwind CSS for styling
- LocalStorage for data persistence
- No backend or server required

## Browser Compatibility

Works on all modern browsers that support:
- ES6 JavaScript
- LocalStorage API
- React 18

## Data Storage

All tournament and player data is stored in your browser's localStorage. Data persists between sessions but is local to your device.

## License

MIT License - feel free to use and modify as needed!

## Contributing

Pull requests are welcome! For major changes, please open an issue first.

---

Built with ❤️ for ping pong enthusiasts
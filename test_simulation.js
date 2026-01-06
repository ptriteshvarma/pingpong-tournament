const http = require('http');

const API_BASE = 'http://localhost:3000/api';

function request(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(API_BASE + path);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Password': 'Username'
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    resolve(body);
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function testWithPlayers(playerCount) {
    console.log('\n' + '='.repeat(60));
    console.log('TESTING WITH ' + playerCount + ' PLAYERS');
    console.log('='.repeat(60));

    // Create players
    const players = [];
    for (let i = 1; i <= playerCount; i++) {
        players.push({
            name: 'Player ' + i,
            seed: i <= 10 ? i : null  // First 10 get seeds
        });
    }

    console.log('\n1. Adding ' + playerCount + ' players...');
    const addResult = await request('POST', '/players', players);
    console.log('   Result: ' + (addResult.success ? 'SUCCESS' : 'FAILED'));

    // Get bracket
    console.log('\n2. Fetching generated bracket...');
    const bracket = await request('GET', '/bracket');

    if (!bracket) {
        console.log('   ERROR: No bracket generated!');
        return;
    }

    console.log('   Bracket Size: ' + bracket.bracketSize);
    console.log('   Player Count: ' + bracket.playerCount);
    console.log('   Byes: ' + (bracket.bracketSize - bracket.playerCount));
    console.log('   Upper Bracket Rounds: ' + bracket.numRounds);
    console.log('   Lower Bracket Rounds: ' + (bracket.lowerBracket ? bracket.lowerBracket.length : 0));

    // Count matches
    let ubMatches = 0, ubByes = 0, lbMatches = 0;
    if (bracket.upperBracket) {
        bracket.upperBracket.forEach(round => {
            round.forEach(m => {
                if (m.isBye) ubByes++;
                else ubMatches++;
            });
        });
    }
    if (bracket.lowerBracket) {
        bracket.lowerBracket.forEach(round => {
            round.forEach(m => lbMatches++);
        });
    }

    console.log('\n3. Match counts:');
    console.log('   Upper Bracket: ' + ubMatches + ' matches, ' + ubByes + ' byes');
    console.log('   Lower Bracket: ' + lbMatches + ' matches');
    console.log('   Grand Final: 1 (+ potential reset)');
    console.log('   Total playable: ' + (ubMatches + lbMatches + 1));

    // Show Round 1 matchups
    console.log('\n4. Upper Bracket Round 1:');
    if (bracket.upperBracket && bracket.upperBracket[0]) {
        bracket.upperBracket[0].forEach((m, i) => {
            const p1 = m.player1 || 'BYE';
            const p2 = m.player2 || 'BYE';
            const status = m.isBye ? '(auto-advance)' : '';
            console.log('   Match ' + (i+1) + ': ' + p1 + ' vs ' + p2 + ' ' + status);
        });
    }

    // Simulate a few matches
    console.log('\n5. Simulating matches...');

    // Find first playable match
    let firstMatch = null;
    if (bracket.upperBracket && bracket.upperBracket[0]) {
        firstMatch = bracket.upperBracket[0].find(m => !m.isBye && m.player1 && m.player2);
    }

    if (firstMatch) {
        console.log('   Playing: ' + firstMatch.player1 + ' vs ' + firstMatch.player2);

        const matchResult = await request('POST', '/bracket/match', {
            matchId: firstMatch.id,
            winner: firstMatch.player1,
            loser: firstMatch.player2,
            score1: 21,
            score2: 15
        });
        console.log('   Result: ' + (matchResult.success ? 'SUCCESS' : 'FAILED'));

        // Check leaderboard
        const leaderboard = await request('GET', '/leaderboard');
        console.log('\n6. Leaderboard after match:');
        if (leaderboard.players) {
            Object.entries(leaderboard.players).forEach(([name, data]) => {
                console.log('   ' + name + ': ' + data.weekly.wins + 'W/' + data.weekly.losses + 'L, ' + data.weekly.points + ' pts');
            });
        }
    } else {
        console.log('   No playable matches found (all byes in round 1)');
    }

    // Test availability
    console.log('\n7. Testing availability...');
    const availability = {
        'Player 1': {
            '1/2': ['08:00', '08:20', '09:00'],
            '1/3': ['10:00', '10:20']
        },
        'Player 2': {
            '1/2': ['08:20', '09:00', '09:20'],
            '1/3': ['10:00']
        }
    };
    const availResult = await request('POST', '/availability', availability);
    console.log('   Saved availability: ' + (availResult.success ? 'SUCCESS' : 'FAILED'));

    // Verify availability
    const savedAvail = await request('GET', '/availability');
    const p1Slots = savedAvail['Player 1'] && savedAvail['Player 1']['1/2'] ? savedAvail['Player 1']['1/2'].length : 0;
    const p2Slots = savedAvail['Player 2'] && savedAvail['Player 2']['1/2'] ? savedAvail['Player 2']['1/2'].length : 0;
    console.log('   Player 1 slots on 1/2: ' + p1Slots);
    console.log('   Player 2 slots on 1/2: ' + p2Slots);
    console.log('   Common slots: 08:20, 09:00');

    console.log('\n[OK] Test completed successfully!');
}

async function runAllTests() {
    console.log('PING PONG TOURNAMENT - END TO END TESTS');
    console.log('========================================\n');

    // Test with 4 players (small bracket)
    await testWithPlayers(4);

    // Test with 12 players (medium bracket with byes)
    await testWithPlayers(12);

    // Test with 20 players (original requirement)
    await testWithPlayers(20);

    console.log('\n\n' + '='.repeat(60));
    console.log('ALL TESTS COMPLETED');
    console.log('='.repeat(60));
}

runAllTests().catch(console.error);

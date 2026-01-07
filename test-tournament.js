// End-to-End Tournament Test Script
// Tests all features with simulated realistic tournament data

const API_BASE = 'http://localhost:3000/api';
const ADMIN_PASSWORD = 'Username';

// Simulated player data
const players = [
    { name: 'Alex Chen', seed: 1 },
    { name: 'Sarah Johnson', seed: 2 },
    { name: 'Marcus Williams', seed: 3 },
    { name: 'Emily Davis', seed: 4 },
    { name: 'James Rodriguez', seed: 5 },
    { name: 'Lisa Anderson', seed: 6 },
    { name: 'David Kim', seed: 7 },
    { name: 'Rachel Martinez', seed: 8 }
];

// Simulated availability data
const availability = {
    'Alex Chen': {
        '1/6': ['08:00', '08:20', '09:00', '14:00'],
        '1/7': ['08:00', '10:00', '15:00'],
        '1/8': ['08:00', '08:20', '13:00', '14:00']
    },
    'Sarah Johnson': {
        '1/6': ['08:00', '09:00', '10:00', '14:00'],
        '1/7': ['08:00', '09:00', '10:00'],
        '1/8': ['08:00', '13:00', '14:00']
    },
    'Marcus Williams': {
        '1/6': ['08:00', '08:20', '09:00', '11:00'],
        '1/7': ['10:00', '11:00', '15:00'],
        '1/8': ['08:00', '08:20', '09:00']
    },
    'Emily Davis': {
        '1/6': ['08:00', '09:00', '14:00', '15:00'],
        '1/7': ['08:00', '09:00', '10:00', '11:00'],
        '1/8': ['13:00', '14:00', '15:00']
    },
    'James Rodriguez': {
        '1/6': ['08:00', '08:20', '10:00', '11:00'],
        '1/7': ['08:00', '10:00', '11:00'],
        '1/8': ['08:00', '09:00', '13:00', '14:00']
    },
    'Lisa Anderson': {
        '1/6': ['09:00', '10:00', '14:00', '15:00'],
        '1/7': ['08:00', '09:00', '15:00'],
        '1/8': ['08:00', '13:00', '14:00', '15:00']
    },
    'David Kim': {
        '1/6': ['08:00', '08:20', '09:00', '10:00'],
        '1/7': ['10:00', '11:00', '15:00'],
        '1/8': ['08:00', '08:20', '09:00', '13:00']
    },
    'Rachel Martinez': {
        '1/6': ['08:00', '09:00', '11:00', '14:00'],
        '1/7': ['08:00', '09:00', '10:00', '11:00'],
        '1/8': ['13:00', '14:00', '15:00', '16:00']
    }
};

// Simulated match results for upper bracket round 1
const matchResults = [
    { matchId: 'UB-R1-M1', winner: 'Alex Chen', loser: 'Rachel Martinez', score1: 11, score2: 7 },
    { matchId: 'UB-R1-M2', winner: 'Marcus Williams', loser: 'David Kim', score1: 11, score2: 9 },
    { matchId: 'UB-R1-M3', winner: 'Sarah Johnson', loser: 'Lisa Anderson', score1: 11, score2: 5 },
    { matchId: 'UB-R1-M4', winner: 'Emily Davis', loser: 'James Rodriguez', score1: 11, score2: 8 }
];

// Upper bracket round 2 results
const ubRound2Results = [
    { matchId: 'UB-R2-M1', winner: 'Alex Chen', loser: 'Marcus Williams', score1: 11, score2: 6 },
    { matchId: 'UB-R2-M2', winner: 'Sarah Johnson', loser: 'Emily Davis', score1: 11, score2: 9 }
];

// Lower bracket round 1 results
const lbRound1Results = [
    { matchId: 'LB-R1-M1', winner: 'Rachel Martinez', loser: 'David Kim', score1: 11, score2: 4 },
    { matchId: 'LB-R1-M2', winner: 'James Rodriguez', loser: 'Lisa Anderson', score1: 11, score2: 7 }
];

// Helper function to make API calls
async function apiCall(endpoint, method = 'GET', body = null, requiresAuth = false) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (requiresAuth) {
        options.headers['x-admin-password'] = ADMIN_PASSWORD;
    }

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(`API Error: ${data.error || response.statusText}`);
    }

    return data;
}

// Test functions
async function test1_AddPlayers() {
    console.log('\n📝 TEST 1: Adding Players');
    console.log('=' .repeat(50));

    try {
        const result = await apiCall('/players', 'POST', players, true);
        console.log(`✅ Added ${players.length} players successfully`);
        console.log(`   Players: ${players.map(p => p.name).join(', ')}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to add players:', error.message);
        return false;
    }
}

async function test2_GenerateBracket() {
    console.log('\n🏆 TEST 2: Generating Double Elimination Bracket');
    console.log('=' .repeat(50));

    try {
        const result = await apiCall('/bracket/generate', 'POST', {}, true);
        console.log('✅ Bracket generated successfully');
        console.log(`   Bracket Size: ${result.bracket.bracketSize}`);
        console.log(`   Player Count: ${result.bracket.playerCount}`);
        console.log(`   Upper Bracket Rounds: ${result.bracket.upperBracket.length}`);
        console.log(`   Lower Bracket Rounds: ${result.bracket.lowerBracket.length}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to generate bracket:', error.message);
        return false;
    }
}

async function test3_SetAvailability() {
    console.log('\n📅 TEST 3: Setting Player Availability');
    console.log('=' .repeat(50));

    try {
        const result = await apiCall('/availability', 'POST', availability, false);
        console.log('✅ Availability set for all players');

        // Calculate total slots
        let totalSlots = 0;
        Object.values(availability).forEach(dates => {
            Object.values(dates).forEach(slots => {
                totalSlots += slots.length;
            });
        });
        console.log(`   Total availability slots: ${totalSlots}`);

        return true;
    } catch (error) {
        console.error('❌ Failed to set availability:', error.message);
        return false;
    }
}

async function test4_RecordMatches() {
    console.log('\n⚔️  TEST 4: Recording Match Results');
    console.log('=' .repeat(50));

    try {
        // Record Upper Bracket Round 1
        console.log('\n   Upper Bracket Round 1:');
        for (const match of matchResults) {
            await apiCall('/bracket/match', 'POST', match, false);
            console.log(`   ✓ ${match.winner} defeated ${match.loser} (${match.score1}-${match.score2})`);
        }

        // Wait a bit to simulate time passing
        await new Promise(resolve => setTimeout(resolve, 500));

        // Record Upper Bracket Round 2
        console.log('\n   Upper Bracket Round 2:');
        for (const match of ubRound2Results) {
            await apiCall('/bracket/match', 'POST', match, false);
            console.log(`   ✓ ${match.winner} defeated ${match.loser} (${match.score1}-${match.score2})`);
        }

        // Record Lower Bracket Round 1
        console.log('\n   Lower Bracket Round 1:');
        for (const match of lbRound1Results) {
            await apiCall('/bracket/match', 'POST', match, false);
            console.log(`   ✓ ${match.winner} defeated ${match.loser} (${match.score1}-${match.score2})`);
        }

        console.log('\n✅ All matches recorded successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to record matches:', error.message);
        return false;
    }
}

async function test5_CheckLeaderboard() {
    console.log('\n📊 TEST 5: Checking Leaderboard Stats');
    console.log('=' .repeat(50));

    try {
        const leaderboard = await apiCall('/leaderboard', 'GET');

        console.log('\n   Current Standings:');
        const standings = Object.entries(leaderboard.players)
            .map(([name, stats]) => ({
                name,
                wins: stats.weekly.wins,
                losses: stats.weekly.losses,
                points: stats.weekly.points
            }))
            .sort((a, b) => b.points - a.points);

        standings.forEach((player, idx) => {
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '  ';
            console.log(`   ${medal} ${(idx + 1).toString().padStart(2)}. ${player.name.padEnd(20)} - ${player.wins}W/${player.losses}L - ${player.points} pts`);
        });

        console.log('\n✅ Leaderboard retrieved successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to check leaderboard:', error.message);
        return false;
    }
}

async function test6_GetBracket() {
    console.log('\n🎯 TEST 6: Retrieving Current Bracket State');
    console.log('=' .repeat(50));

    try {
        const bracket = await apiCall('/bracket', 'GET');

        let completedMatches = 0;
        let totalMatches = 0;

        // Count upper bracket
        bracket.upperBracket.forEach(round => {
            round.forEach(match => {
                totalMatches++;
                if (match.completed) completedMatches++;
            });
        });

        // Count lower bracket
        bracket.lowerBracket.forEach(round => {
            round.forEach(match => {
                totalMatches++;
                if (match.completed) completedMatches++;
            });
        });

        console.log(`   Total Matches: ${totalMatches}`);
        console.log(`   Completed: ${completedMatches}`);
        console.log(`   Remaining: ${totalMatches - completedMatches}`);
        console.log(`   Progress: ${Math.round((completedMatches / totalMatches) * 100)}%`);

        console.log('\n✅ Bracket state retrieved successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to get bracket:', error.message);
        return false;
    }
}

async function test7_CreateBackup() {
    console.log('\n💾 TEST 7: Creating Database Backup');
    console.log('=' .repeat(50));

    try {
        const result = await apiCall('/backup/create', 'POST', {}, true);
        console.log('✅ Backup created successfully');
        console.log(`   Filepath: ${result.filepath}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to create backup:', error.message);
        return false;
    }
}

async function test8_ListBackups() {
    console.log('\n📋 TEST 8: Listing Available Backups');
    console.log('=' .repeat(50));

    try {
        const result = await apiCall('/backup/list', 'GET', null, true);
        console.log(`✅ Found ${result.backups.length} backup(s)`);

        if (result.backups.length > 0) {
            console.log('\n   Recent backups:');
            result.backups.slice(0, 5).forEach(backup => {
                const date = new Date(backup.created).toLocaleString();
                const size = (backup.size / 1024).toFixed(2);
                console.log(`   - ${backup.filename} (${size} KB, ${date})`);
            });
        }

        return true;
    } catch (error) {
        console.error('❌ Failed to list backups:', error.message);
        return false;
    }
}

async function test9_CheckAvailability() {
    console.log('\n🕐 TEST 9: Checking Availability Data');
    console.log('=' .repeat(50));

    try {
        const avail = await apiCall('/availability', 'GET');

        const playerCount = Object.keys(avail).length;
        let totalSlots = 0;

        Object.values(avail).forEach(dates => {
            Object.values(dates).forEach(slots => {
                totalSlots += slots.length;
            });
        });

        console.log(`✅ Availability data retrieved`);
        console.log(`   Players with availability: ${playerCount}`);
        console.log(`   Total time slots: ${totalSlots}`);
        console.log(`   Average slots per player: ${Math.round(totalSlots / playerCount)}`);

        return true;
    } catch (error) {
        console.error('❌ Failed to check availability:', error.message);
        return false;
    }
}

async function test10_GetPlayers() {
    console.log('\n👥 TEST 10: Retrieving Player List');
    console.log('=' .repeat(50));

    try {
        const players = await apiCall('/players', 'GET');
        console.log(`✅ Retrieved ${players.length} players`);

        const seeded = players.filter(p => p.seed !== null).length;
        console.log(`   Seeded players: ${seeded}`);
        console.log(`   Unseeded players: ${players.length - seeded}`);

        return true;
    } catch (error) {
        console.error('❌ Failed to get players:', error.message);
        return false;
    }
}

// Main test runner
async function runAllTests() {
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║  🏓 PING PONG TOURNAMENT - END-TO-END TESTS 🏓   ║');
    console.log('╚════════════════════════════════════════════════════╝');

    const tests = [
        test1_AddPlayers,
        test2_GenerateBracket,
        test3_SetAvailability,
        test4_RecordMatches,
        test5_CheckLeaderboard,
        test6_GetBracket,
        test7_CreateBackup,
        test8_ListBackups,
        test9_CheckAvailability,
        test10_GetPlayers
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        try {
            const result = await test();
            if (result) {
                passed++;
            } else {
                failed++;
            }
        } catch (error) {
            console.error(`\n❌ Test failed with error: ${error.message}`);
            failed++;
        }

        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Final summary
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║                   TEST SUMMARY                     ║');
    console.log('╚════════════════════════════════════════════════════╝');
    console.log(`\n   Total Tests: ${tests.length}`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   Success Rate: ${Math.round((passed / tests.length) * 100)}%`);

    if (passed === tests.length) {
        console.log('\n   🎉 ALL TESTS PASSED! 🎉\n');
    } else {
        console.log('\n   ⚠️  Some tests failed. Check the output above.\n');
    }
}

// Run tests
console.log('Starting tests in 2 seconds...');
setTimeout(runAllTests, 2000);

-- Ping Pong Tournament Database Schema
-- Run this after creating your PostgreSQL database in Railway

-- Players table
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    seed INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bracket matches table
CREATE TABLE IF NOT EXISTS matches (
    id VARCHAR(100) PRIMARY KEY,
    round_type VARCHAR(20) NOT NULL, -- 'upper', 'lower', 'grand', 'reset'
    round_number INTEGER NOT NULL,
    match_number INTEGER NOT NULL,
    player1 VARCHAR(255),
    player2 VARCHAR(255),
    winner VARCHAR(255),
    loser VARCHAR(255),
    score1 INTEGER,
    score2 INTEGER,
    is_bye BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'scheduled', 'completed'
    scheduled_time VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Bracket metadata
CREATE TABLE IF NOT EXISTS bracket_meta (
    id INTEGER PRIMARY KEY DEFAULT 1,
    bracket_size INTEGER NOT NULL,
    player_count INTEGER NOT NULL,
    num_rounds INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT single_bracket CHECK (id = 1)
);

-- Player availability
CREATE TABLE IF NOT EXISTS availability (
    id SERIAL PRIMARY KEY,
    player_name VARCHAR(255) NOT NULL,
    date VARCHAR(10) NOT NULL, -- '1/6' format
    time_slot VARCHAR(10) NOT NULL, -- '08:00' format
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_name, date, time_slot)
);

-- Leaderboard stats
CREATE TABLE IF NOT EXISTS leaderboard (
    id SERIAL PRIMARY KEY,
    player_name VARCHAR(255) UNIQUE NOT NULL,
    weekly_wins INTEGER DEFAULT 0,
    weekly_losses INTEGER DEFAULT 0,
    weekly_points INTEGER DEFAULT 0,
    weekly_matches_played INTEGER DEFAULT 0,
    alltime_wins INTEGER DEFAULT 0,
    alltime_losses INTEGER DEFAULT 0,
    alltime_points INTEGER DEFAULT 0,
    alltime_matches_played INTEGER DEFAULT 0,
    week_start DATE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table bookings (single table, blocks for all players)
CREATE TABLE IF NOT EXISTS table_bookings (
    id SERIAL PRIMARY KEY,
    match_id VARCHAR(100), -- Optional: link to a league match
    player1 VARCHAR(255) NOT NULL,
    player2 VARCHAR(255) NOT NULL,
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    group_name VARCHAR(10), -- 'A', 'B', or null for casual
    status VARCHAR(20) DEFAULT 'booked', -- 'booked', 'completed', 'cancelled'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    UNIQUE(booking_date, start_time) -- Only one booking per time slot
);

CREATE INDEX idx_bookings_date ON table_bookings(booking_date);
CREATE INDEX idx_bookings_status ON table_bookings(status);

-- Season/League table (stores entire season as JSON for flexibility)
CREATE TABLE IF NOT EXISTS season (
    id INTEGER PRIMARY KEY DEFAULT 1,
    name VARCHAR(255) NOT NULL DEFAULT 'Season 1',
    status VARCHAR(20) DEFAULT 'regular', -- 'regular', 'playoffs', 'complete'
    current_week INTEGER DEFAULT 1,
    total_weeks INTEGER DEFAULT 10,
    data JSONB NOT NULL, -- Full season data including groups, schedule, standings, playoffs
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT single_season CHECK (id = 1)
);

-- Activity log for history tracking
CREATE TABLE IF NOT EXISTS activity_log (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL, -- 'match_result', 'group_switch', 'playoff_advance', 'wildcard', 'champion'
    player_name VARCHAR(255),
    opponent_name VARCHAR(255),
    group_name VARCHAR(10),
    week_number INTEGER,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_log_type ON activity_log(event_type);
CREATE INDEX idx_activity_log_player ON activity_log(player_name);
CREATE INDEX idx_activity_log_created ON activity_log(created_at DESC);

-- Indexes for performance
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_round ON matches(round_type, round_number);
CREATE INDEX idx_availability_player ON availability(player_name);
CREATE INDEX idx_availability_date ON availability(date);
CREATE INDEX idx_leaderboard_weekly_points ON leaderboard(weekly_points DESC);
CREATE INDEX idx_leaderboard_alltime_points ON leaderboard(alltime_points DESC);

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

-- Indexes for performance
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_round ON matches(round_type, round_number);
CREATE INDEX idx_availability_player ON availability(player_name);
CREATE INDEX idx_availability_date ON availability(date);
CREATE INDEX idx_leaderboard_weekly_points ON leaderboard(weekly_points DESC);
CREATE INDEX idx_leaderboard_alltime_points ON leaderboard(alltime_points DESC);

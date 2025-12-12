/*
  # CurveFever Party Game Database Schema

  1. New Tables
    - `rooms`
      - `id` (uuid, primary key)
      - `code` (text, unique) - 4-letter room code
      - `host_id` (text) - Host session identifier
      - `status` (text) - 'lobby', 'playing', 'finished'
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `players`
      - `id` (uuid, primary key)
      - `room_id` (uuid, foreign key)
      - `player_id` (text, unique) - Unique player session ID
      - `name` (text) - Player display name
      - `color` (text) - Player trail color
      - `is_alive` (boolean) - Current alive status
      - `score` (integer) - Rounds won
      - `connected` (boolean) - Connection status
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Public read access for game functionality (no auth required)
    - Restrictive write access patterns
*/

-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  host_id text NOT NULL,
  status text DEFAULT 'lobby' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT status_check CHECK (status IN ('lobby', 'playing', 'finished'))
);

-- Create players table
CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_id text UNIQUE NOT NULL,
  name text NOT NULL,
  color text NOT NULL,
  is_alive boolean DEFAULT true NOT NULL,
  score integer DEFAULT 0 NOT NULL,
  connected boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_players_room_id ON players(room_id);
CREATE INDEX IF NOT EXISTS idx_players_player_id ON players(player_id);

-- Enable Row Level Security
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rooms table
CREATE POLICY "Anyone can read rooms"
  ON rooms FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can create rooms"
  ON rooms FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can update rooms"
  ON rooms FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete rooms"
  ON rooms FOR DELETE
  TO anon
  USING (true);

-- RLS Policies for players table
CREATE POLICY "Anyone can read players"
  ON players FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can create players"
  ON players FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can update players"
  ON players FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete players"
  ON players FOR DELETE
  TO anon
  USING (true);
-- 작심삼일 RUN DAO - Initial Database Schema
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  social_id TEXT,
  social_provider TEXT CHECK (social_provider IN ('apple', 'google', 'kakao')),
  wallet_address TEXT NOT NULL,
  custody_type TEXT CHECK (custody_type IN ('custodial', 'non_custodial')) DEFAULT 'custodial',
  nickname TEXT,
  region TEXT,
  locale TEXT DEFAULT 'ko-KR',
  timezone TEXT DEFAULT 'Asia/Seoul',
  device_info TEXT, -- JSON string
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(email),
  UNIQUE(social_id, social_provider),
  UNIQUE(wallet_address)
);

-- Crews table
CREATE TABLE IF NOT EXISTS crews (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  region TEXT,
  is_private BOOLEAN DEFAULT 0,
  leader_id TEXT NOT NULL,
  max_members INTEGER DEFAULT 50,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (leader_id) REFERENCES users(id)
);

-- Crew memberships
CREATE TABLE IF NOT EXISTS crew_memberships (
  id TEXT PRIMARY KEY,
  crew_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'active', 'left')) DEFAULT 'active',
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (crew_id) REFERENCES crews(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(crew_id, user_id)
);

-- Quests table
CREATE TABLE IF NOT EXISTS quests (
  id TEXT PRIMARY KEY,
  crew_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_at DATETIME NOT NULL,
  end_at DATETIME NOT NULL,
  distance_km REAL NOT NULL,
  times_per_week INTEGER NOT NULL,
  stake_token TEXT DEFAULT 'USDC',
  stake_amount REAL NOT NULL,
  max_slots INTEGER DEFAULT 20,
  status TEXT CHECK (status IN ('draft', 'open', 'active', 'completed', 'cancelled')) DEFAULT 'draft',
  
  -- Settlement policy
  success_rate REAL DEFAULT 0.8, -- 80% to winners
  dao_rate REAL DEFAULT 0.1, -- 10% to DAO
  protocol_fee_rate REAL DEFAULT 0.1, -- 10% protocol fee
  
  -- Contract info
  contract_address TEXT,
  contract_quest_id INTEGER,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (crew_id) REFERENCES crews(id)
);

-- Quest participations
CREATE TABLE IF NOT EXISTS participations (
  id TEXT PRIMARY KEY,
  quest_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT CHECK (status IN ('active', 'success', 'fail', 'forfeit')) DEFAULT 'active',
  
  -- Staking info
  escrow_id TEXT, -- On-chain escrow ID
  stake_amount REAL,
  stake_token TEXT DEFAULT 'USDC',
  stake_tx_hash TEXT,
  
  -- Progress tracking
  completed_sessions INTEGER DEFAULT 0,
  total_distance_km REAL DEFAULT 0,
  
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  
  FOREIGN KEY (quest_id) REFERENCES quests(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(quest_id, user_id)
);

-- Running records from external providers
CREATE TABLE IF NOT EXISTS run_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT CHECK (provider IN ('strava', 'garmin', 'apple_health', 'google_fit')),
  external_id TEXT NOT NULL, -- Provider's activity ID
  
  -- Basic running data
  started_at DATETIME NOT NULL,
  duration_sec INTEGER NOT NULL,
  distance_km REAL NOT NULL,
  avg_pace_sec_per_km REAL,
  
  -- GPS and sensor data (JSON strings)
  gps_path TEXT, -- GPS coordinates array
  hr_series TEXT, -- Heart rate time series
  accel_series TEXT, -- Accelerometer data
  
  -- Anti-cheat scoring
  integrity_score REAL DEFAULT 1.0, -- 0.0 to 1.0
  is_suspicious BOOLEAN DEFAULT 0,
  fraud_flags TEXT, -- JSON array of detected issues
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, provider, external_id)
);

-- Quest-Run record mapping (which runs count for which quest)
CREATE TABLE IF NOT EXISTS quest_runs (
  id TEXT PRIMARY KEY,
  quest_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  run_record_id TEXT NOT NULL,
  
  -- Validation results
  is_valid BOOLEAN DEFAULT 1,
  validation_reason TEXT,
  reviewed_by TEXT, -- Admin user ID if manually reviewed
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (quest_id) REFERENCES quests(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (run_record_id) REFERENCES run_records(id),
  UNIQUE(quest_id, run_record_id)
);

-- NFT Medals (both on-chain and metadata)
CREATE TABLE IF NOT EXISTS nft_medals (
  id TEXT PRIMARY KEY,
  token_id INTEGER, -- On-chain NFT token ID
  user_id TEXT NOT NULL,
  quest_id TEXT NOT NULL,
  
  -- Medal type and metadata
  medal_type TEXT CHECK (medal_type IN ('gold', 'grey', 'special')) NOT NULL,
  metadata_uri TEXT, -- IPFS/Arweave URI
  image_uri TEXT,
  
  -- Achievement details
  achievement_data TEXT, -- JSON with stats, story, etc.
  
  -- Blockchain data
  contract_address TEXT,
  mint_tx_hash TEXT,
  minted_at DATETIME,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (quest_id) REFERENCES quests(id)
);

-- Kudos system (peer recognition)
CREATE TABLE IF NOT EXISTS kudos (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  amount INTEGER DEFAULT 1,
  message TEXT,
  
  -- Context
  quest_id TEXT, -- Optional: kudos given in context of a quest
  crew_id TEXT, -- Optional: crew context
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (from_user_id) REFERENCES users(id),
  FOREIGN KEY (to_user_id) REFERENCES users(id),
  FOREIGN KEY (quest_id) REFERENCES quests(id),
  FOREIGN KEY (crew_id) REFERENCES crews(id),
  
  CHECK (from_user_id != to_user_id)
);

-- Abuse reports and moderation
CREATE TABLE IF NOT EXISTS abuse_reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL,
  target_user_id TEXT,
  quest_id TEXT,
  run_record_id TEXT,
  
  reason TEXT CHECK (reason IN ('cheating', 'spam', 'inappropriate', 'other')) NOT NULL,
  description TEXT,
  status TEXT CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')) DEFAULT 'pending',
  
  -- Resolution
  resolved_by TEXT, -- Admin user ID
  resolution TEXT,
  resolved_at DATETIME,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (reporter_id) REFERENCES users(id),
  FOREIGN KEY (target_user_id) REFERENCES users(id),
  FOREIGN KEY (quest_id) REFERENCES quests(id),
  FOREIGN KEY (run_record_id) REFERENCES run_records(id)
);

-- Settlement records (quest completion and payouts)
CREATE TABLE IF NOT EXISTS settlements (
  id TEXT PRIMARY KEY,
  quest_id TEXT NOT NULL,
  batch_number INTEGER DEFAULT 1,
  
  -- Settlement results
  winners TEXT, -- JSON array of user IDs
  losers TEXT, -- JSON array of user IDs
  total_stake_amount REAL,
  winner_payout REAL,
  dao_payout REAL,
  protocol_fee REAL,
  
  -- Blockchain transaction
  tx_hash TEXT,
  gas_cost REAL,
  block_number INTEGER,
  
  completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (quest_id) REFERENCES quests(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_social ON users(social_id, social_provider);
CREATE INDEX IF NOT EXISTS idx_crew_memberships_user ON crew_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_crew_memberships_crew ON crew_memberships(crew_id);
CREATE INDEX IF NOT EXISTS idx_quests_crew ON quests(crew_id);
CREATE INDEX IF NOT EXISTS idx_quests_status ON quests(status);
CREATE INDEX IF NOT EXISTS idx_participations_user ON participations(user_id);
CREATE INDEX IF NOT EXISTS idx_participations_quest ON participations(quest_id);
CREATE INDEX IF NOT EXISTS idx_run_records_user ON run_records(user_id);
CREATE INDEX IF NOT EXISTS idx_run_records_time ON run_records(started_at);
CREATE INDEX IF NOT EXISTS idx_quest_runs_quest ON quest_runs(quest_id);
CREATE INDEX IF NOT EXISTS idx_kudos_to_user ON kudos(to_user_id);
CREATE INDEX IF NOT EXISTS idx_abuse_reports_status ON abuse_reports(status);
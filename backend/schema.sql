-- ProspectX Database Schema
-- PostgreSQL 14+
-- Multi-tenant hockey intelligence platform

-- Organizations (teams, agencies, families)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('team', 'agency', 'family')),
  league VARCHAR(100),
  tier VARCHAR(50),
  country VARCHAR(3),
  settings JSONB DEFAULT '{}',
  subscription_tier VARCHAR(50) DEFAULT 'free',
  subscription_status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_orgs_type ON organizations(type);
CREATE INDEX idx_orgs_league ON organizations(league);

-- Users (coaches, scouts, admins, viewers)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'coach', 'scout', 'viewer', 'agent')),
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_org ON users(org_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Players
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  dob DATE,
  position VARCHAR(10) NOT NULL,
  shoots VARCHAR(1) CHECK (shoots IN ('L', 'R')),
  height_cm INTEGER,
  weight_kg INTEGER,
  passports JSONB DEFAULT '[]',
  current_team VARCHAR(255),
  current_league VARCHAR(100),
  draft_info JSONB,
  agency VARCHAR(255),
  notes TEXT,
  tags JSONB DEFAULT '[]',
  archetype VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_players_org ON players(org_id);
CREATE INDEX idx_players_position ON players(position);
CREATE INDEX idx_players_league ON players(current_league);
CREATE INDEX idx_players_name ON players(last_name, first_name);

-- Teams (opponents, current teams)
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  league VARCHAR(100),
  city VARCHAR(100),
  abbreviation VARCHAR(10),
  identity JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_teams_org ON teams(org_id);
CREATE INDEX idx_teams_league ON teams(league);

-- Games
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id),
  date DATE NOT NULL,
  opponent VARCHAR(255),
  opponent_team_id UUID REFERENCES teams(id),
  home_away VARCHAR(4) CHECK (home_away IN ('HOME', 'AWAY')),
  result VARCHAR(10),
  score VARCHAR(10),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_games_org ON games(org_id);
CREATE INDEX idx_games_date ON games(date);
CREATE INDEX idx_games_team ON games(team_id);

-- Player Stats (season aggregates and game-level)
CREATE TABLE player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  season VARCHAR(20),
  stat_type VARCHAR(20) CHECK (stat_type IN ('season', 'game', 'period')),
  
  -- Box score stats
  gp INTEGER DEFAULT 0,
  g INTEGER DEFAULT 0,
  a INTEGER DEFAULT 0,
  p INTEGER DEFAULT 0,
  plus_minus INTEGER DEFAULT 0,
  pim INTEGER DEFAULT 0,
  
  -- Ice time
  toi_seconds INTEGER DEFAULT 0,
  pp_toi_seconds INTEGER DEFAULT 0,
  pk_toi_seconds INTEGER DEFAULT 0,
  
  -- Shooting
  shots INTEGER DEFAULT 0,
  sog INTEGER DEFAULT 0,
  shooting_pct DECIMAL(5,2),
  
  -- Advanced metrics (stored as JSONB for flexibility)
  microstats JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_stats_player ON player_stats(player_id);
CREATE INDEX idx_stats_game ON player_stats(game_id);
CREATE INDEX idx_stats_season ON player_stats(season);
CREATE INDEX idx_stats_type ON player_stats(stat_type);

-- Goalie Stats
CREATE TABLE goalie_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  season VARCHAR(20),
  stat_type VARCHAR(20) CHECK (stat_type IN ('season', 'game')),
  
  gp INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  otl INTEGER DEFAULT 0,
  sa INTEGER DEFAULT 0,
  sv INTEGER DEFAULT 0,
  ga INTEGER DEFAULT 0,
  sv_pct DECIMAL(5,3),
  gaa DECIMAL(4,2),
  gsax DECIMAL(5,2),
  
  microstats JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_goalie_stats_player ON goalie_stats(player_id);
CREATE INDEX idx_goalie_stats_season ON goalie_stats(season);

-- Report Templates
CREATE TABLE report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  template_name VARCHAR(255) NOT NULL,
  report_type VARCHAR(100) NOT NULL,
  prompt_text TEXT NOT NULL,
  data_schema JSONB NOT NULL,
  ui_schema JSONB,
  is_global BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_templates_org ON report_templates(org_id);
CREATE INDEX idx_templates_type ON report_templates(report_type);
CREATE INDEX idx_templates_global ON report_templates(is_global);

-- Reports (generated outputs)
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  template_id UUID REFERENCES report_templates(id),
  report_type VARCHAR(100) NOT NULL,
  title VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  
  -- Snapshot of input data used
  input_data JSONB NOT NULL,
  
  -- Structured output from LLM
  output_json JSONB,
  
  -- Formatted text output
  output_text TEXT,
  
  -- Error info if failed
  error_message TEXT,
  
  -- Generation metadata
  generated_at TIMESTAMP,
  llm_model VARCHAR(100),
  llm_tokens INTEGER,
  generation_time_ms INTEGER,
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reports_org ON reports(org_id);
CREATE INDEX idx_reports_player ON reports(player_id);
CREATE INDEX idx_reports_type ON reports(report_type);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_created ON reports(created_at);

-- Ingest Jobs (for async data processing)
CREATE TABLE ingest_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  job_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  file_path VARCHAR(500),
  input_data JSONB,
  result_data JSONB,
  error_message TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ingest_org ON ingest_jobs(org_id);
CREATE INDEX idx_ingest_status ON ingest_jobs(status);
CREATE INDEX idx_ingest_created ON ingest_jobs(created_at);

-- Audit Log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  metadata JSONB,
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_org ON audit_log(org_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);
CREATE INDEX idx_audit_action ON audit_log(action);

-- Functions for updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables
CREATE TRIGGER update_orgs_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_stats_updated_at BEFORE UPDATE ON player_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goalie_stats_updated_at BEFORE UPDATE ON goalie_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON report_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ingest_updated_at BEFORE UPDATE ON ingest_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed global report templates
INSERT INTO report_templates (template_name, report_type, prompt_text, data_schema, is_global) VALUES
('Pro/Amateur Skater Report', 'pro_skater', 
'[FULL PROMPT FROM PROSPECTX DOCS]', 
'{"required": ["player_identity", "season_stats", "microstats"]}', 
TRUE),

('Unified Prospect Report', 'unified_prospect',
'[FULL PROMPT FROM PROSPECTX DOCS]',
'{"required": ["player_identity", "season_stats", "microstats", "projection_data"]}',
TRUE);

-- Note: Full prompts would be inserted from the ProspectX master document

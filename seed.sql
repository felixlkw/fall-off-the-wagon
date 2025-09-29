-- 작심삼일 RUN DAO - Seed Data for Development

-- Insert test users
INSERT OR IGNORE INTO users (id, email, social_id, social_provider, wallet_address, nickname, region, custody_type) VALUES 
  ('user_1', 'alice@example.com', 'apple_123', 'apple', '0x1111111111111111111111111111111111111111', 'Alice Runner', 'Seoul', 'custodial'),
  ('user_2', 'bob@example.com', 'google_456', 'google', '0x2222222222222222222222222222222222222222', 'Bob Sprint', 'Busan', 'custodial'),
  ('user_3', 'charlie@example.com', 'kakao_789', 'kakao', '0x3333333333333333333333333333333333333333', 'Charlie Marathon', 'Seoul', 'custodial'),
  ('user_4', 'diana@example.com', 'google_101', 'google', '0x4444444444444444444444444444444444444444', 'Diana Fast', 'Incheon', 'non_custodial');

-- Insert test crews
INSERT OR IGNORE INTO crews (id, name, description, region, leader_id, is_private) VALUES 
  ('crew_seoul_1', 'Seoul Morning Runners', '서울 새벽 러닝 크루입니다', 'Seoul', 'user_1', 0),
  ('crew_busan_1', 'Busan Beach Runners', '부산 해변 러닝 크루', 'Busan', 'user_2', 0),
  ('crew_private_1', 'Elite Marathon Club', '엘리트 마라톤 클럽', 'Seoul', 'user_3', 1);

-- Insert crew memberships
INSERT OR IGNORE INTO crew_memberships (id, crew_id, user_id, status) VALUES 
  ('membership_1', 'crew_seoul_1', 'user_1', 'active'),  -- Leader
  ('membership_2', 'crew_seoul_1', 'user_3', 'active'),  -- Member
  ('membership_3', 'crew_seoul_1', 'user_4', 'active'),  -- Member
  ('membership_4', 'crew_busan_1', 'user_2', 'active'),  -- Leader
  ('membership_5', 'crew_private_1', 'user_3', 'active'); -- Leader only for now

-- Insert test quests
INSERT OR IGNORE INTO quests (
  id, crew_id, title, description, 
  start_at, end_at, distance_km, times_per_week, 
  stake_amount, max_slots, status
) VALUES 
  (
    'quest_1', 'crew_seoul_1', 
    '새해 다짐 5km 챌린지', 
    '일주일에 3번, 각각 5km 이상 달리기. 새해 건강한 시작!',
    datetime('now', '+1 day'),
    datetime('now', '+8 day'),
    5.0, 3,
    10.0, 10, 'open'
  ),
  (
    'quest_2', 'crew_seoul_1',
    '겨울 극복 3km 챌린지',
    '추운 겨울, 작은 목표로 시작하는 꾸준함 챌린지',
    datetime('now', '+2 day'),
    datetime('now', '+9 day'), 
    3.0, 2,
    5.0, 15, 'open'
  ),
  (
    'quest_3', 'crew_busan_1',
    '해변 러닝 10km 도전',
    '부산 해변을 달리며 힐링하는 고강도 챌린지',
    datetime('now', '-2 day'),
    datetime('now', '+5 day'),
    10.0, 2, 
    20.0, 5, 'active'
  );

-- Insert test participations
INSERT OR IGNORE INTO participations (
  id, quest_id, user_id, status, 
  stake_amount, completed_sessions, total_distance_km
) VALUES 
  ('participation_1', 'quest_1', 'user_1', 'active', 10.0, 1, 5.2),
  ('participation_2', 'quest_1', 'user_3', 'active', 10.0, 2, 11.8),
  ('participation_3', 'quest_2', 'user_4', 'active', 5.0, 0, 0.0),
  ('participation_4', 'quest_3', 'user_2', 'active', 20.0, 1, 10.5);

-- Insert test run records
INSERT OR IGNORE INTO run_records (
  id, user_id, provider, external_id,
  started_at, duration_sec, distance_km, avg_pace_sec_per_km,
  integrity_score
) VALUES 
  ('run_1', 'user_1', 'strava', 'strava_activity_123',
   datetime('now', '-1 day'), 1800, 5.2, 346,
   0.95),
  ('run_2', 'user_3', 'google_fit', 'gfit_456', 
   datetime('now', '-2 day'), 2100, 5.8, 362,
   0.92),
  ('run_3', 'user_3', 'strava', 'strava_activity_789',
   datetime('now', '-1 day'), 2400, 6.0, 400,
   0.88),
  ('run_4', 'user_2', 'garmin', 'garmin_101',
   datetime('now', '-1 day'), 3600, 10.5, 343,
   0.97);

-- Link runs to quests
INSERT OR IGNORE INTO quest_runs (id, quest_id, user_id, run_record_id, is_valid) VALUES 
  ('quest_run_1', 'quest_1', 'user_1', 'run_1', 1),
  ('quest_run_2', 'quest_1', 'user_3', 'run_2', 1),
  ('quest_run_3', 'quest_1', 'user_3', 'run_3', 1),
  ('quest_run_4', 'quest_3', 'user_2', 'run_4', 1);

-- Insert test kudos
INSERT OR IGNORE INTO kudos (id, from_user_id, to_user_id, amount, message, crew_id) VALUES 
  ('kudos_1', 'user_1', 'user_3', 1, '새벽 러닝 정말 대단해요! 💪', 'crew_seoul_1'),
  ('kudos_2', 'user_3', 'user_1', 1, '리더십 감사합니다!', 'crew_seoul_1'),
  ('kudos_3', 'user_4', 'user_1', 1, '오늘도 함께 달려요!', 'crew_seoul_1');

-- Insert test NFT medals (not yet minted on-chain)
INSERT OR IGNORE INTO nft_medals (
  id, user_id, quest_id, medal_type, 
  achievement_data
) VALUES 
  (
    'medal_1', 'user_3', 'quest_1', 'gold',
    '{"total_distance": 11.8, "sessions_completed": 2, "avg_pace": 381, "story": "추운 겨울 새벽에도 꾸준히 달린 멋진 도전자!"}'
  );

-- Insert sample abuse report
INSERT OR IGNORE INTO abuse_reports (
  id, reporter_id, target_user_id, run_record_id,
  reason, description, status
) VALUES 
  (
    'report_1', 'user_1', 'user_2', 'run_4',
    'cheating', '10km를 30분에 완주했다고 나와있는데 비현실적으로 빠릅니다.',
    'pending'
  );
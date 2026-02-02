-- init.sql - Test data for Minecraft server Discord bot database

-- Clean up existing data (in correct order due to foreign keys)
TRUNCATE TABLE admin_log_action CASCADE;
TRUNCATE TABLE player_session CASCADE;
TRUNCATE TABLE player_playtime_hourly CASCADE;
TRUNCATE TABLE player_playtime_daily CASCADE;
TRUNCATE TABLE player_playtime_summary CASCADE;
TRUNCATE TABLE player_balance CASCADE;
TRUNCATE TABLE admin CASCADE;
TRUNCATE TABLE waitlist_entry CASCADE;
TRUNCATE TABLE discord_guild_member_join CASCADE;
TRUNCATE TABLE player CASCADE;
TRUNCATE TABLE server CASCADE;

-- Reset sequences
ALTER SEQUENCE server_id_seq RESTART WITH 1;
ALTER SEQUENCE player_id_seq RESTART WITH 1;
ALTER SEQUENCE player_session_id_seq RESTART WITH 1;
ALTER SEQUENCE waitlist_entry_id_seq RESTART WITH 1;
ALTER SEQUENCE discord_guild_member_join_join_number_seq RESTART WITH 1;
ALTER SEQUENCE admin_log_action_id_seq RESTART WITH 1;

-- ============================================================================
-- SERVERS
-- ============================================================================

INSERT INTO server (name, identifier, created_at) VALUES
('Cogs SMP', 'cogs', NOW() - INTERVAL '6 months'),
('Test Server', 'test', NOW() - INTERVAL '3 months');

-- ============================================================================
-- PLAYERS
-- ============================================================================

INSERT INTO player (minecraft_uuid, minecraft_username, discord_id, online, last_seen, created_at, current_server_id) VALUES
-- Real admins (online now)
('091b900c-4174-478c-900c-a0fe5a31a329', 'saunhardy', '818819241666281503', true, NOW(), NOW() - INTERVAL '180 days', 1),
('3e0db446-147a-4692-87fd-c3facc4341db', 'Agent772', '547450242090532874', true, NOW(), NOW() - INTERVAL '175 days', 1),
('4cada83a-c012-4a31-8d80-942f3f79e8a1', 'The_Bigshot', '99318080374607872', true, NOW(), NOW() - INTERVAL '170 days', 1),

-- Active players (online now)
('550e8400-e29b-41d4-a716-446655440001', 'Steve', '123456789012345678', true, NOW(), NOW() - INTERVAL '90 days', 1),
('550e8400-e29b-41d4-a716-446655440002', 'Alex', '123456789012345679', true, NOW(), NOW() - INTERVAL '85 days', 1),
('550e8400-e29b-41d4-a716-446655440003', 'Notch', '123456789012345680', false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '80 days', NULL),

-- Recently active players (offline)
('550e8400-e29b-41d4-a716-446655440004', 'Herobrine', '123456789012345681', false, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '75 days', NULL),
('550e8400-e29b-41d4-a716-446655440005', 'Jeb', '123456789012345682', false, NOW() - INTERVAL '5 hours', NOW() - INTERVAL '70 days', NULL),
('550e8400-e29b-41d4-a716-446655440006', 'Dream', '123456789012345683', false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '65 days', NULL),

-- Regular players
('550e8400-e29b-41d4-a716-446655440007', 'Technoblade', '123456789012345684', false, NOW() - INTERVAL '3 days', NOW() - INTERVAL '60 days', NULL),
('550e8400-e29b-41d4-a716-446655440008', 'Philza', '123456789012345685', false, NOW() - INTERVAL '5 days', NOW() - INTERVAL '55 days', NULL),
('550e8400-e29b-41d4-a716-446655440009', 'Mumbo', '123456789012345686', false, NOW() - INTERVAL '7 days', NOW() - INTERVAL '50 days', NULL),
('550e8400-e29b-41d4-a716-446655440010', 'Grian', '123456789012345687', false, NOW() - INTERVAL '10 days', NOW() - INTERVAL '45 days', NULL),

-- Inactive players
('550e8400-e29b-41d4-a716-446655440011', 'Scar', '123456789012345688', false, NOW() - INTERVAL '30 days', NOW() - INTERVAL '40 days', NULL),
('550e8400-e29b-41d4-a716-446655440012', 'Iskall', '123456789012345689', false, NOW() - INTERVAL '45 days', NOW() - INTERVAL '35 days', NULL),

-- New players (joined recently)
('550e8400-e29b-41d4-a716-446655440013', 'Newbie1', '123456789012345690', false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 days', NULL),
('550e8400-e29b-41d4-a716-446655440014', 'Newbie2', '123456789012345691', false, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '1 day', NULL);

-- ============================================================================
-- PLAYER BALANCES
-- ============================================================================

INSERT INTO player_balance (minecraft_uuid, balance, updated_at) VALUES
-- Real admins with high balances
('091b900c-4174-478c-900c-a0fe5a31a329', 15000000, NOW()),
('3e0db446-147a-4692-87fd-c3facc4341db', 12500000, NOW()),
('4cada83a-c012-4a31-8d80-942f3f79e8a1', 18750000, NOW()),

-- Other players
('550e8400-e29b-41d4-a716-446655440001', 1250500, NOW()),
('550e8400-e29b-41d4-a716-446655440002', 3420750, NOW()),
('550e8400-e29b-41d4-a716-446655440003', 8999990, NOW()),
('550e8400-e29b-41d4-a716-446655440004', 567250, NOW()),
('550e8400-e29b-41d4-a716-446655440005', 2100000, NOW()),
('550e8400-e29b-41d4-a716-446655440006', 4567800, NOW()),
('550e8400-e29b-41d4-a716-446655440007', 6789500, NOW()),
('550e8400-e29b-41d4-a716-446655440008', 3210250, NOW()),
('550e8400-e29b-41d4-a716-446655440009', 1890000, NOW()),
('550e8400-e29b-41d4-a716-446655440010', 2345600, NOW()),
('550e8400-e29b-41d4-a716-446655440011', 890000, NOW()),
('550e8400-e29b-41d4-a716-446655440012', 450500, NOW()),
('550e8400-e29b-41d4-a716-446655440013', 100000, NOW()),
('550e8400-e29b-41d4-a716-446655440014', 50000, NOW());

-- ============================================================================
-- ADMINS
-- ============================================================================

INSERT INTO admin (discord_id, created_at, vanished) VALUES
('818819241666281503', NOW() - INTERVAL '180 days', false),  -- saunhardy
('547450242090532874', NOW() - INTERVAL '175 days', false),  -- Agent772
('99318080374607872', NOW() - INTERVAL '170 days', false),   -- The_Bigshot
('123456789012345678', NOW() - INTERVAL '90 days', false),   -- Steve
('123456789012345680', NOW() - INTERVAL '80 days', false),   -- Notch
('123456789012345684', NOW() - INTERVAL '60 days', true);    -- Technoblade (vanished)

-- ============================================================================
-- PLAYER SESSIONS (Historical + Current)
-- ============================================================================

-- Helper function to generate sessions over the past 30 days
DO $$
DECLARE
    player_uuid UUID;
    player_name TEXT;
    day_offset INT;
    session_count INT;
    session_start TIMESTAMP WITH TIME ZONE;
    session_duration INT;
BEGIN
    -- Generate sessions for all active players including real admins
    FOR player_uuid, player_name IN 
        SELECT minecraft_uuid, minecraft_username 
        FROM player 
        WHERE minecraft_username IN ('saunhardy', 'Agent772', 'The_Bigshot', 'Steve', 'Alex', 'Notch', 'Herobrine', 'Jeb', 'Dream')
    LOOP
        -- Generate sessions over the past 60 days for admins, 30 for others
        FOR day_offset IN 0..CASE 
            WHEN player_name IN ('saunhardy', 'Agent772', 'The_Bigshot') THEN 59 
            ELSE 29 
        END LOOP
            -- More sessions for admins (2-5 per day), fewer for regular players (0-3)
            session_count := CASE 
                WHEN player_name IN ('saunhardy', 'Agent772', 'The_Bigshot') THEN (2 + floor(random() * 4))::INT
                ELSE floor(random() * 4)::INT
            END;
            
            FOR i IN 1..session_count LOOP
                -- Random session start time during the day
                session_start := (NOW() - INTERVAL '1 day' * day_offset) + 
                                (random() * INTERVAL '20 hours') + 
                                INTERVAL '6 hours';
                
                -- Longer sessions for admins (1-8 hours), shorter for others (15 min to 6 hours)
                session_duration := CASE 
                    WHEN player_name IN ('saunhardy', 'Agent772', 'The_Bigshot') THEN (3600 + floor(random() * 25200))::INT
                    ELSE (900 + floor(random() * 20700))::INT
                END;
                
                INSERT INTO player_session (
                    player_minecraft_uuid, 
                    server_id, 
                    session_start, 
                    session_end
                ) VALUES (
                    player_uuid,
                    1, -- Cogs server
                    session_start,
                    session_start + (session_duration || ' seconds')::INTERVAL
                );
            END LOOP;
        END LOOP;
    END LOOP;
END $$;

-- Add some active sessions (currently online players)
INSERT INTO player_session (player_minecraft_uuid, server_id, session_start, session_end) VALUES
-- Real admins currently online
('091b900c-4174-478c-900c-a0fe5a31a329', 1, NOW() - INTERVAL '4 hours', NULL),  -- saunhardy online for 4 hours
('3e0db446-147a-4692-87fd-c3facc4341db', 1, NOW() - INTERVAL '2.5 hours', NULL),  -- Agent772 online for 2.5 hours
('4cada83a-c012-4a31-8d80-942f3f79e8a1', 1, NOW() - INTERVAL '6 hours', NULL),  -- The_Bigshot online for 6 hours

-- Other players
('550e8400-e29b-41d4-a716-446655440001', 1, NOW() - INTERVAL '2 hours', NULL),  -- Steve online for 2 hours
('550e8400-e29b-41d4-a716-446655440002', 1, NOW() - INTERVAL '45 minutes', NULL);  -- Alex online for 45 min

-- Add a few sessions for other players
INSERT INTO player_session (player_minecraft_uuid, server_id, session_start, session_end)
SELECT 
    minecraft_uuid,
    1,
    NOW() - (random() * INTERVAL '7 days'),
    NOW() - (random() * INTERVAL '7 days') + (random() * INTERVAL '4 hours')
FROM player
WHERE minecraft_username IN ('Technoblade', 'Philza', 'Mumbo', 'Grian', 'Scar', 'Iskall')
ORDER BY random()
LIMIT 20;

-- ============================================================================
-- DISCORD GUILD MEMBER JOINS
-- ============================================================================

INSERT INTO discord_guild_member_join (user_id, username, joined_at) VALUES
('818819241666281503', 'saunhardy', NOW() - INTERVAL '180 days'),
('547450242090532874', 'Agent772', NOW() - INTERVAL '175 days'),
('99318080374607872', 'The_Bigshot', NOW() - INTERVAL '170 days'),
('123456789012345678', 'steve_official', NOW() - INTERVAL '90 days'),
('123456789012345679', 'alex_plays', NOW() - INTERVAL '85 days'),
('123456789012345680', 'notch', NOW() - INTERVAL '80 days'),
('123456789012345681', 'herobrine_legend', NOW() - INTERVAL '75 days'),
('123456789012345682', 'jeb_', NOW() - INTERVAL '70 days'),
('123456789012345683', 'dream', NOW() - INTERVAL '65 days'),
('123456789012345684', 'technoblade', NOW() - INTERVAL '60 days'),
('123456789012345685', 'philza', NOW() - INTERVAL '55 days'),
('123456789012345686', 'mumbojumbo', NOW() - INTERVAL '50 days'),
('123456789012345687', 'grian', NOW() - INTERVAL '45 days'),
('123456789012345688', 'goodtimeswithscar', NOW() - INTERVAL '40 days'),
('123456789012345689', 'iskall85', NOW() - INTERVAL '35 days'),
('123456789012345690', 'newplayer1', NOW() - INTERVAL '2 days'),
('123456789012345691', 'newplayer2', NOW() - INTERVAL '1 day');

-- ============================================================================
-- WAITLIST ENTRIES
-- ============================================================================

INSERT INTO waitlist_entry (
    email, 
    discord_name, 
    discord_id, 
    token, 
    submitted_at, 
    discord_message_id, 
    status, 
    joined_discord, 
    verified, 
    registered, 
    joined_minecraft,
    accepted_at,
    accepted_by
) VALUES
-- Real admins - completed entries
('saunhardy@example.com', 'saunhardy', '818819241666281503', 'token_saun_001', NOW() - INTERVAL '181 days', '111111111111111101', 'completed', true, true, true, true, NOW() - INTERVAL '180 days', '99318080374607872'),
('agent772@example.com', 'Agent772', '547450242090532874', 'token_agent_002', NOW() - INTERVAL '176 days', '111111111111111102', 'completed', true, true, true, true, NOW() - INTERVAL '175 days', '99318080374607872'),
('bigshot@example.com', 'The_Bigshot', '99318080374607872', 'token_bigshot_003', NOW() - INTERVAL '171 days', '111111111111111103', 'completed', true, true, true, true, NOW() - INTERVAL '170 days', '818819241666281503'),

-- Other completed entries
('steve@example.com', 'steve_official', '123456789012345678', 'token_steve_004', NOW() - INTERVAL '91 days', '111111111111111111', 'completed', true, true, true, true, NOW() - INTERVAL '90 days', '818819241666281503'),
('alex@example.com', 'alex_plays', '123456789012345679', 'token_alex_005', NOW() - INTERVAL '86 days', '111111111111111112', 'completed', true, true, true, true, NOW() - INTERVAL '85 days', '547450242090532874'),

-- Accepted, in progress
('newbie1@example.com', 'newplayer1', '123456789012345690', 'token_new1_013', NOW() - INTERVAL '3 days', '111111111111111113', 'accepted', true, true, true, false, NOW() - INTERVAL '2 days', '818819241666281503'),
('newbie2@example.com', 'newplayer2', '123456789012345691', 'token_new2_014', NOW() - INTERVAL '2 days', '111111111111111114', 'accepted', true, false, false, false, NOW() - INTERVAL '1 day', '547450242090532874'),

-- Pending entries
('pending1@example.com', 'pending_user1', NULL, 'token_pend_015', NOW() - INTERVAL '5 hours', '111111111111111115', 'pending', false, false, false, false, NULL, NULL),
('pending2@example.com', 'pending_user2', NULL, 'token_pend_016', NOW() - INTERVAL '2 hours', '111111111111111116', 'pending', false, false, false, false, NULL, NULL),
('pending3@example.com', 'pending_user3', NULL, 'token_pend_017', NOW() - INTERVAL '30 minutes', '111111111111111117', 'pending', false, false, false, false, NULL, NULL),

-- Declined entry
('declined@example.com', 'declined_user', NULL, 'token_decl_018', NOW() - INTERVAL '10 days', '111111111111111118', 'declined', false, false, false, false, NULL, NULL);

-- ============================================================================
-- ADMIN LOG ACTIONS
-- ============================================================================

INSERT INTO admin_log_action (
    admin_discord_id,
    admin_discord_username,
    action_type,
    target_player_uuid,
    target_player_name,
    table_name,
    field_name,
    old_value,
    new_value,
    reason,
    server_id,
    performed_at,
    metadata
) VALUES
-- Real admin actions
('818819241666281503', 'saunhardy', 'waitlist_accept', '3e0db446-147a-4692-87fd-c3facc4341db', 'Agent772', 'waitlist_entry', 'status', 'pending', 'accepted', 'Excellent application - server owner', NULL, NOW() - INTERVAL '175 days', '{"application_score": 100, "role": "owner"}'),
('818819241666281503', 'saunhardy', 'admin_grant', '3e0db446-147a-4692-87fd-c3facc4341db', 'Agent772', 'admin', 'discord_id', NULL, '547450242090532874', 'Promoted to admin - trusted member', NULL, NOW() - INTERVAL '170 days', '{"role": "admin"}'),
('99318080374607872', 'The_Bigshot', 'waitlist_accept', '091b900c-4174-478c-900c-a0fe5a31a329', 'saunhardy', 'waitlist_entry', 'status', 'pending', 'accepted', 'Server founder', NULL, NOW() - INTERVAL '180 days', '{"application_score": 100, "role": "founder"}'),
('547450242090532874', 'Agent772', 'balance_adjustment', '091b900c-4174-478c-900c-a0fe5a31a329', 'saunhardy', 'player_balance', 'balance', '10000000', '15000000', 'Monthly admin stipend', 1, NOW() - INTERVAL '15 days', '{"stipend_period": "January_2026"}'),
('818819241666281503', 'saunhardy', 'balance_adjustment', '4cada83a-c012-4a31-8d80-942f3f79e8a1', 'The_Bigshot', 'player_balance', 'balance', '15000000', '18750000', 'Server event hosting bonus', 1, NOW() - INTERVAL '7 days', '{"event": "winter_festival_2026"}'),

-- Player edits
('818819241666281503', 'saunhardy', 'player_edit', '550e8400-e29b-41d4-a716-446655440004', 'Herobrine', 'player', 'minecraft_username', 'Hero_Brine', 'Herobrine', 'Username format correction', 1, NOW() - INTERVAL '5 days', '{"approved_by": "admin_team"}'),
('99318080374607872', 'The_Bigshot', 'player_edit', '550e8400-e29b-41d4-a716-446655440005', 'Jeb', 'player', 'discord_id', '999999999999999999', '123456789012345682', 'Discord ID correction', 1, NOW() - INTERVAL '10 days', NULL),

-- Balance adjustments
('547450242090532874', 'Agent772', 'balance_adjustment', '550e8400-e29b-41d4-a716-446655440002', 'Alex', 'player_balance', 'balance', '3000750', '3420750', 'Competition prize', 1, NOW() - INTERVAL '3 days', '{"event": "build_competition", "prize_tier": "1st_place"}'),
('818819241666281503', 'saunhardy', 'balance_adjustment', '550e8400-e29b-41d4-a716-446655440007', 'Technoblade', 'player_balance', 'balance', '6500000', '6789500', 'Quest completion bonus', 1, NOW() - INTERVAL '7 days', '{"quest_id": "dragon_slayer"}'),

-- Waitlist actions
('547450242090532874', 'Agent772', 'waitlist_accept', '550e8400-e29b-41d4-a716-446655440013', 'Newbie1', 'waitlist_entry', 'status', 'pending', 'accepted', 'Application approved', NULL, NOW() - INTERVAL '2 days', '{"application_score": 95}'),
('818819241666281503', 'saunhardy', 'waitlist_accept', '550e8400-e29b-41d4-a716-446655440014', 'Newbie2', 'waitlist_entry', 'status', 'pending', 'accepted', 'Good application', NULL, NOW() - INTERVAL '1 day', '{"application_score": 88}'),

-- Administrative actions
('99318080374607872', 'The_Bigshot', 'admin_grant', '550e8400-e29b-41d4-a716-446655440001', 'Steve', 'admin', 'discord_id', NULL, '123456789012345678', 'Promoted to admin', NULL, NOW() - INTERVAL '90 days', '{"role": "moderator"}'),
('547450242090532874', 'Agent772', 'player_edit', '550e8400-e29b-41d4-a716-446655440008', 'Philza', 'player', 'minecraft_username', 'Ph1lza', 'Philza', 'Name change approved', 1, NOW() - INTERVAL '15 days', NULL);

-- ============================================================================
-- PLAYER STRIKES
-- ============================================================================

INSERT INTO player_strike (
    player_minecraft_uuid,
    classification,
    description,
    severity,
    issued_by_discord_id,
    issued_by_username,
    issued_at,
    removed,
    removed_by_discord_id,
    removed_by_username,
    removed_at,
    removal_reason,
    server_id,
    metadata
) VALUES
-- Active strikes
('550e8400-e29b-41d4-a716-446655440004', 'pvp', 'Killed player in spawn protection zone', 2, '818819241666281503', 'saunhardy', NOW() - INTERVAL '2 days', false, NULL, NULL, NULL, NULL, 1, '{"coordinates": "100, 64, -200", "victim": "Steve"}'),
('550e8400-e29b-41d4-a716-446655440006', 'theft', 'Stole diamonds from community chest', 3, '547450242090532874', 'Agent772', NOW() - INTERVAL '5 days', false, NULL, NULL, NULL, NULL, 1, '{"item": "minecraft:diamond", "quantity": 32, "chest_location": "150, 70, 300"}'),
('550e8400-e29b-41d4-a716-446655440008', 'laggy_machines', 'Built excessive redstone contraption causing server lag', 2, '99318080374607872', 'The_Bigshot', NOW() - INTERVAL '3 days', false, NULL, NULL, NULL, NULL, 1, '{"coordinates": "-450, 65, 800", "tps_impact": "15.2", "contraption_type": "item_sorter"}'),
('550e8400-e29b-41d4-a716-446655440010', 'inappropriate_chat', 'Used offensive language in global chat', 1, '818819241666281503', 'saunhardy', NOW() - INTERVAL '1 day', false, NULL, NULL, NULL, NULL, 1, '{"chat_log_id": "msg_20260201_1523"}'),
('550e8400-e29b-41d4-a716-446655440009', 'griefing', 'Destroyed another players farm without permission', 4, '547450242090532874', 'Agent772', NOW() - INTERVAL '7 days', false, NULL, NULL, NULL, NULL, 1, '{"coordinates": "350, 68, -150", "victim": "Alex", "blocks_destroyed": 47, "crops": "wheat"}'),
('550e8400-e29b-41d4-a716-446655440011', 'harassment', 'Repeatedly targeted and killed the same player', 3, '99318080374607872', 'The_Bigshot', NOW() - INTERVAL '4 days', false, NULL, NULL, NULL, NULL, 1, '{"victim": "Newbie1", "kill_count": 8, "time_span_hours": 2}'),
('550e8400-e29b-41d4-a716-446655440012', 'exploiting', 'Used duplication glitch for diamonds', 5, '818819241666281503', 'saunhardy', NOW() - INTERVAL '10 days', false, NULL, NULL, NULL, NULL, 1, '{"exploit_type": "item_duplication", "item": "minecraft:diamond_block", "quantity_gained": 15, "evidence": "screenshot_001.png"}'),
('550e8400-e29b-41d4-a716-446655440007', 'rule_violation', 'Built outside world border', 1, '547450242090532874', 'Agent772', NOW() - INTERVAL '6 days', false, NULL, NULL, NULL, NULL, 1, '{"coordinates": "10500, 70, -8900", "world_border": 10000}'),
('550e8400-e29b-41d4-a716-446655440005', 'other', 'AFK farming with auto-clicker', 2, '99318080374607872', 'The_Bigshot', NOW() - INTERVAL '8 days', false, NULL, NULL, NULL, NULL, 1, '{"farm_type": "mob_farm", "afk_duration_hours": 12}'),

-- Removed/Pardoned strikes
('550e8400-e29b-41d4-a716-446655440003', 'pvp', 'Accidental PvP kill during event', 1, '818819241666281503', 'saunhardy', NOW() - INTERVAL '15 days', true, '547450242090532874', 'Agent772', NOW() - INTERVAL '10 days', 'Player apologized, was accidental during event. First offense.', 1, '{"event": "winter_games_2026", "victim": "Philza"}'),
('550e8400-e29b-41d4-a716-446655440001', 'inappropriate_chat', 'Minor chat infraction', 1, '99318080374607872', 'The_Bigshot', NOW() - INTERVAL '30 days', true, '818819241666281503', 'saunhardy', NOW() - INTERVAL '25 days', 'Good behavior since strike, removed early', 1, NULL),
('550e8400-e29b-41d4-a716-446655440002', 'theft', 'Took items from unlocked chest thinking it was abandoned', 2, '547450242090532874', 'Agent772', NOW() - INTERVAL '20 days', true, '99318080374607872', 'The_Bigshot', NOW() - INTERVAL '15 days', 'Returned all items and helped owner rebuild. Showed genuine remorse.', 1, '{"items_returned": true, "compensation": "helped rebuild barn"}'),

-- Multiple strikes for same player (repeat offender)
('550e8400-e29b-41d4-a716-446655440013', 'rule_violation', 'Ignored moderator instructions', 1, '818819241666281503', 'saunhardy', NOW() - INTERVAL '12 days', false, NULL, NULL, NULL, NULL, 1, NULL),
('550e8400-e29b-41d4-a716-446655440013', 'inappropriate_chat', 'Spam in chat after warning', 2, '547450242090532874', 'Agent772', NOW() - INTERVAL '9 days', false, NULL, NULL, NULL, NULL, 1, '{"warning_count": 2}'),
('550e8400-e29b-41d4-a716-446655440013', 'harassment', 'Continued harassment after first strike', 3, '99318080374607872', 'The_Bigshot', NOW() - INTERVAL '5 days', false, NULL, NULL, NULL, NULL, 1, '{"previous_strikes": 2, "victim": "Newbie2"}'),

-- Strikes with varying severity levels
('550e8400-e29b-41d4-a716-446655440014', 'pvp', 'Minor PvP infraction', 1, '818819241666281503', 'saunhardy', NOW() - INTERVAL '3 days', false, NULL, NULL, NULL, NULL, 1, NULL),
('550e8400-e29b-41d4-a716-446655440006', 'griefing', 'Major griefing of spawn area', 5, '547450242090532874', 'Agent772', NOW() - INTERVAL '14 days', false, NULL, NULL, NULL, NULL, 1, '{"coordinates": "0, 70, 0", "blocks_destroyed": 523, "area": "spawn_plaza", "severity": "major"}'),

-- Edge cases
('091b900c-4174-478c-900c-a0fe5a31a329', 'other', 'Testing admin tools (removed immediately)', 1, '99318080374607872', 'The_Bigshot', NOW() - INTERVAL '60 days', true, '99318080374607872', 'The_Bigshot', NOW() - INTERVAL '60 days', 'Test strike for system validation', 1, '{"test": true}');
-- ============================================================================
-- VERIFY DATA INTEGRITY
-- ============================================================================

-- Check that triggers worked correctly for playtime aggregates
DO $$
DECLARE
    summary_count INT;
    daily_count INT;
    hourly_count INT;
BEGIN
    SELECT COUNT(*) INTO summary_count FROM player_playtime_summary;
    SELECT COUNT(*) INTO daily_count FROM player_playtime_daily;
    SELECT COUNT(*) INTO hourly_count FROM player_playtime_hourly;
    
    RAISE NOTICE 'Data generation complete!';
    RAISE NOTICE 'Summary records: %', summary_count;
    RAISE NOTICE 'Daily records: %', daily_count;
    RAISE NOTICE 'Hourly records: %', hourly_count;
    RAISE NOTICE 'Active sessions: %', (SELECT COUNT(*) FROM player_session WHERE session_end IS NULL);
    RAISE NOTICE 'Completed sessions: %', (SELECT COUNT(*) FROM player_session WHERE session_end IS NOT NULL);
END $$;

-- Show some sample stats
SELECT 
    p.minecraft_username,
    pps.total_sessions,
    ROUND(pps.total_seconds / 3600.0, 2) AS total_hours,
    ROUND(pps.avg_session_seconds / 60.0, 2) AS avg_session_minutes
FROM player_playtime_summary pps
JOIN player p ON p.minecraft_uuid = pps.player_minecraft_uuid
WHERE pps.server_id = 1
ORDER BY pps.total_seconds DESC
LIMIT 10;
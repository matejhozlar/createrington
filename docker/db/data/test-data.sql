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
TRUNCATE TABLE ticket_action CASCADE;
TRUNCATE TABLE ticket CASCADE;
TRUNCATE TABLE player_ban RESTART IDENTITY;
TRUNCATE TABLE player_strike CASCADE;
TRUNCATE TABLE discord_embed_preset CASCADE;
TRUNCATE TABLE discord_guild_member_leave CASCADE;
TRUNCATE TABLE faq_entry CASCADE;
TRUNCATE TABLE faq_welcome_message CASCADE;
TRUNCATE TABLE leaderboard_message CASCADE;
TRUNCATE TABLE player_achievement CASCADE;
TRUNCATE TABLE player_balance_transaction CASCADE;
TRUNCATE TABLE player_minecraft_stats CASCADE;
TRUNCATE TABLE reward_claim CASCADE;
TRUNCATE TABLE server_forceload_chunk CASCADE;
TRUNCATE TABLE server_forceload_member CASCADE;
TRUNCATE TABLE server_forceload_player CASCADE;
TRUNCATE TABLE server_forceload_party CASCADE;
TRUNCATE TABLE server_ally_fake_party_member CASCADE;
TRUNCATE TABLE server_ally_fake_party CASCADE;
TRUNCATE TABLE server_ally_party CASCADE;
TRUNCATE TABLE server_ally_qualified_player CASCADE;

-- Reset sequences
ALTER SEQUENCE server_id_seq RESTART WITH 1;
ALTER SEQUENCE player_id_seq RESTART WITH 1;
ALTER SEQUENCE player_session_id_seq RESTART WITH 1;
ALTER SEQUENCE waitlist_entry_id_seq RESTART WITH 1;
ALTER SEQUENCE discord_guild_member_join_join_number_seq RESTART WITH 1;
ALTER SEQUENCE admin_log_action_id_seq RESTART WITH 1;
ALTER SEQUENCE ticket_id_seq RESTART WITH 1;
ALTER SEQUENCE ticket_action_id_seq RESTART WITH 1;
ALTER SEQUENCE player_strike_id_seq RESTART WITH 1;
ALTER SEQUENCE discord_embed_preset_id_seq RESTART WITH 1;
ALTER SEQUENCE discord_guild_member_leave_id_seq RESTART WITH 1;
ALTER SEQUENCE faq_entry_id_seq RESTART WITH 1;
ALTER SEQUENCE faq_welcome_message_id_seq RESTART WITH 1;
ALTER SEQUENCE leaderboard_message_id_seq RESTART WITH 1;
ALTER SEQUENCE player_balance_transaction_id_seq RESTART WITH 1;
ALTER SEQUENCE reward_claim_id_seq RESTART WITH 1;
ALTER SEQUENCE server_forceload_player_id_seq RESTART WITH 1;
ALTER SEQUENCE server_forceload_party_id_seq RESTART WITH 1;
ALTER SEQUENCE server_forceload_member_id_seq RESTART WITH 1;
ALTER SEQUENCE server_forceload_chunk_id_seq RESTART WITH 1;
ALTER SEQUENCE server_ally_fake_party_id_seq RESTART WITH 1;
ALTER SEQUENCE server_ally_fake_party_member_id_seq RESTART WITH 1;
ALTER SEQUENCE server_ally_party_id_seq RESTART WITH 1;
ALTER SEQUENCE server_ally_qualified_player_id_seq RESTART WITH 1;

-- ============================================================================
-- SERVERS
-- ============================================================================

INSERT INTO server (name, identifier, created_at) VALUES
('Rails ''n Sails', 'rails', NOW() - INTERVAL '6 months');

-- ============================================================================
-- PLAYERS
-- ============================================================================

INSERT INTO player (minecraft_uuid, minecraft_username, discord_id, online, last_seen, created_at, current_server_id) VALUES
-- Real admins (online now)
('091b900c-4174-478c-900c-a0fe5a31a329', 'saunhardy', '818819241666281503', true, NOW(), NOW() - INTERVAL '180 days', 1),
('3e0db446-147a-4692-87fd-c3facc4341db', 'Agent772', '547450242090532874', true, NOW(), NOW() - INTERVAL '175 days', 1),
('4cada83a-c012-4a31-8d80-942f3f79e8a1', 'The_Bigshot', '99318080374607872', true, NOW(), NOW() - INTERVAL '170 days', 1),
('8cca5cab-b782-452b-a8b9-8bb4ae0f6d0f', 'diablothe2nd', '462293344807026699', true, NOW(), NOW() - INTERVAL '10 days', 1),
('32ff995f-cf92-417b-b745-891738346120', 'Tetsuoken', '1041727959767191655', false, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '10 days', NULL),

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

INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('091b900c-4174-478c-900c-a0fe5a31a329'::uuid, 'saunhardy', '818819241666281503', false, '2024-04-01 13:07:30.081'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('80e97d7b-d98d-4261-b297-311758b62a1a'::uuid, 'CamKing2007', '860820264128086026', false, '2025-04-13 10:17:02.653'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('13fe4708-65fc-4ea0-9fb3-55b598b41e5e'::uuid, 'Neelus1', '236124332160581632', false, '2025-04-13 18:31:53.721'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('d8d729c4-8154-4891-ae21-7fe5fb209e6f'::uuid, 'MonTue23', '803257566670225448', false, '2025-04-13 23:51:51.202'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('3e0db446-147a-4692-87fd-c3facc4341db'::uuid, 'Agent772', '547450242090532874', true, '2025-04-26 08:51:02.91'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('5f03a336-72f9-4270-a9bc-de1f0f479562'::uuid, 'Not_Patton', '441362579781058565', false, '2025-05-01 21:03:57.764'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('c631d5a7-7a7d-4284-93be-6a01b218f0f2'::uuid, 'ChillyBearAB', '308601833935601665', false, '2025-05-06 19:44:27.028'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('c5edca50-fdbf-4187-a450-0a6e6565c070'::uuid, 'Feef08', '676334326173925417', false, '2025-05-17 16:27:52.456'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('374f830c-2bf1-4a20-8e85-3d91045f1fd1'::uuid, 'Steelofgame44', '1130493970162651296', false, '2025-06-12 14:31:17.102254'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('4faac6a9-a455-4c4a-9eef-b661e8f6e4cc'::uuid, 'Anomy3423', '756511671329095702', false, '2025-06-12 18:12:43.426272'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('8a202d0e-c102-496d-afab-753fd5ca3571'::uuid, 'nico210709', '863816605497950208', false, '2025-07-28 15:02:09.801911'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('4977e84d-fe04-4936-823a-3cb9dcf282cb'::uuid, 'theflashgirl20', '505657985264123904', true, '2025-07-30 11:24:27.163102'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('f57f934f-ce1d-4e28-8573-f77b716029c6'::uuid, 'Rasilo_21', '742174573734264884', false, '2025-08-02 06:24:39.277028'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('df6b417c-2962-4ee9-949e-a6ce0c35bbfa'::uuid, 'Neva13', '138713879097114624', false, '2025-08-03 21:01:45.747007'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('aee71815-6420-444c-a245-9047c41f4a39'::uuid, 'Cailin05', '447583434479763471', false, '2025-08-13 11:21:23.787755'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('d4dd2e33-7270-476b-aa1e-f3b28470456a'::uuid, 'BLKEZJ', '1208877748026609708', false, '2025-08-28 15:50:13.832487'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('548c2abb-714a-43fd-abcd-f22577fd1e26'::uuid, 'Fox_Novakid', '249920308033617930', false, '2025-09-12 10:52:34.306884'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('dcf74a02-454f-40e0-8c1d-322ff8c0c397'::uuid, 'bannarama23', '258283890865733643', false, '2025-09-12 12:46:18.990194'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('4fc2d86b-c9f7-4dbe-8cb0-155d5294fe36'::uuid, 'slimpieytalt', '1218253736141524993', false, '2025-09-12 18:51:56.903138'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('80f364fe-8cfd-484f-8b91-1b4c2fe513ef'::uuid, 'NoLoveXottic', '1367741468629925909', false, '2025-09-15 12:29:57.510653'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('0b62621f-4a30-479e-be5e-d74ebac52a91'::uuid, 'BiddaRS', '383439642042695681', false, '2025-09-21 16:14:28.984685'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('a76e759a-7d00-4734-9f11-51a6b6cdf1d7'::uuid, '507nolan', '1135606001261875240', false, '2025-09-24 17:52:03.966053'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('8f79b53c-133c-4537-a5a9-68e3d435e64b'::uuid, 'wtfoliv3r', '638561254637699082', false, '2025-09-29 08:00:21.219334'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('12f58d82-c39a-4e44-a925-dd9ab31220c3'::uuid, 'lukey50400', '1050849981097070592', false, '2025-09-29 10:57:51.06334'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('fc0a44d5-d38c-408b-aae0-481fb33d6493'::uuid, 'MinionekATT', '847550305284391013', false, '2025-09-29 12:56:04.462679'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('4c6af6b1-5060-4424-aa3d-c6a90e4162a0'::uuid, 'Sta1nedP40', '1269075625482784888', false, '2025-09-30 17:49:27.406657'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('6a3c5ec0-c1e9-40bd-a544-626eac720453'::uuid, 'SebCortez', '259802182054969344', false, '2025-09-30 17:50:19.088905'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('05d04d92-59cb-449d-a13e-95ea81c72a77'::uuid, 'Grexh', '286013788883517440', false, '2025-10-01 12:11:33.294768'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('1d3814eb-b14c-4cc4-8119-92b19edb7857'::uuid, 'Rohlik13', '792709658531069973', false, '2025-10-01 12:37:36.051236'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('4578e5bf-6c84-46b2-ae0e-4a049768e9b0'::uuid, 'gwennieloaf', '1023052027456135210', false, '2025-10-01 22:14:45.366787'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('45f6e0c2-8d39-4a71-860e-30839b8b3d89'::uuid, 'DavePlayzMineC', '991696662265335828', false, '2025-10-02 15:06:08.701782'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('dd2371a0-b959-4e7e-8a46-4a4c333b06ad'::uuid, 'Blockomaster', '937246532586057738', false, '2025-10-04 17:42:00.492858'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('f80480fd-d6d7-4235-9f94-ec5667ebedfe'::uuid, 'Abalabal', '721378233156894862', false, '2025-10-04 18:00:24.170964'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('cb61d3af-4ba0-4a9d-8580-41bd2901660b'::uuid, 'thegoonerme', '1227883927482531891', false, '2025-10-05 21:38:01.923553'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('c084cc81-fe1a-46e8-b02c-e37533c7095c'::uuid, 'JawboneDiamond', '833693744560734298', false, '2025-10-06 15:33:25.940604'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('4cada83a-c012-4a31-8d80-942f3f79e8a1'::uuid, 'The_BigShot', '99318080374607872', false, '2025-10-07 13:06:25.094112'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('a531e1f6-f118-4f1b-92da-90930165b0b3'::uuid, '_Barex_', '305704204398493698', false, '2025-10-07 14:07:00.11265'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('17c1ff07-2430-449f-b9a9-cfe83724a957'::uuid, 'KushWizard4200', '899000628980883578', false, '2025-10-09 21:04:36.808832'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('b7c1f179-3092-40ce-a5db-1fbfe31731bc'::uuid, 'Blobly', '125493988017963008', false, '2025-10-10 06:11:50.466859'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('14202a22-a91d-4794-b591-f74209c2b4a3'::uuid, 'FatCatSoda', '1108107130604621845', false, '2025-10-10 07:55:42.99808'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('dd7bb5ca-2895-4938-b132-a2c8e26db8fe'::uuid, 'QuackBoom76', '1395656847662514198', false, '2025-10-10 20:22:58.172476'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('3d93db70-7d02-45e4-a9d9-f470b7abf118'::uuid, 'THED00RKN0B', '939452226513018891', false, '2025-10-12 07:28:53.782211'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('e3f03f61-fbe7-4296-b8a9-4299e20c1384'::uuid, 'earthseekerx', '714366053035147324', false, '2025-10-12 14:27:16.29577'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('4b16b869-7014-4388-92eb-d6a02b39dc27'::uuid, 'Sour_Jack_AO', '1332536965475864606', false, '2025-10-12 18:48:59.605993'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('bf371600-03ab-4894-8e5e-4321f3e83529'::uuid, 'Nifty420', '289183670043017216', false, '2025-10-16 21:56:10.31123'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('569538d2-f12e-4d6e-a4b7-7e6da7c48689'::uuid, 'Xe0nex', '569942041811877898', false, '2025-10-17 17:51:34.785181'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('9b29f9d5-c679-4d82-8b96-385a511cfbd8'::uuid, 'BhaalistVR', '133342411467259904', false, '2025-10-18 20:32:01.086117'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('c5320593-fac2-4fa4-b274-554402d00c6a'::uuid, 'Frosenpopsicle', '1200557842197921905', false, '2025-10-20 04:28:07.716738'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('8fcbb134-b3fe-4cbd-9ff4-8d22adde1bcd'::uuid, 'BroRooze14_', '1315758452420907131', true, '2025-10-22 20:28:11.472259'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('150ad1d9-e9af-4218-88d9-4af2a6e107e1'::uuid, 'Domino254CZE', '892668157150498817', false, '2025-10-23 12:05:17.495972'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('757be40b-3e79-4b5c-a439-993cd0bbaf95'::uuid, 'gaganoob7655', '1139155210141437952', false, '2025-10-23 12:26:39.196046'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('079eb2f0-487b-491c-940e-e656596e6e32'::uuid, 'NebulaBuddy', '759445579737858068', false, '2025-10-23 13:06:41.061342'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('db19222a-193e-4eb3-b04a-4e1a09f8a97f'::uuid, 'RedTarka', '264848379035648001', false, '2025-10-23 13:46:33.090984'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('8c021900-f49f-4f15-8785-3e05b062b238'::uuid, 'Billionkyle798', '1170122113512910969', false, '2025-10-23 19:28:16.028037'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('0bca0f96-d415-477a-8489-7ad36d2989ec'::uuid, 'conaitus', '772867638920609823', false, '2025-10-24 12:25:33.501292'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('53c19b64-08c8-4f6f-8a0a-63e69e774b29'::uuid, 'mistersten11', '972412544394346496', false, '2025-10-24 15:02:11.808987'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('00756c17-07aa-482a-8d83-cdba4983af55'::uuid, '0Pyroman0', '1136717033178931300', false, '2025-10-24 16:04:00.010844'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('0eb355cb-34da-488b-820a-af5b8eb67750'::uuid, 'Public_Nickname', '177410068843593729', false, '2025-10-26 07:41:10.81937'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('58cee719-d181-45bd-9bcc-d78b68774229'::uuid, 'SneakyDanger788', '834048763067891732', false, '2025-10-29 15:06:02.106294'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('d1d2936f-220e-4674-9edd-eea387c1427e'::uuid, 'Nightmare739379', '1351707606078722101', false, '2025-10-29 21:17:36.003379'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('b2744d8c-4faf-43c8-8a63-c35d67d88376'::uuid, 'Lisa230617', '631576405704048646', false, '2025-11-01 17:05:08.899747'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('780ba043-15e8-419b-9a48-21afb6a17f33'::uuid, 'Welshneyy', '1226555925343637665', false, '2025-11-02 18:57:21.082133'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('aa3c2098-e60d-472d-a3f8-c782d1371b35'::uuid, 'samsamwoodie', '1206647779779416256', false, '2025-11-08 19:55:26.111127'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('26ed2764-83be-4a26-85b6-83ca1788ddee'::uuid, 'wamadou05', '892096339700228127', false, '2025-11-09 14:55:48.951772'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('bd7c0803-c6bd-4e3e-83b9-08f2b84e044f'::uuid, 'Cerendor', '410528635783610372', false, '2025-11-11 17:08:39.452911'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('7c18634b-d260-422b-8b1a-3c9807e17577'::uuid, 'DontForgetBoy', '948304741300064338', false, '2025-11-13 13:12:33.100515'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('a8e12af2-d847-4314-b820-e3f52c214886'::uuid, 'Wolfywolves21', '485920045139099659', false, '2025-11-17 11:24:05.786035'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('cad09f5c-1cd2-4d66-943e-edc083d0656a'::uuid, 'BennyPig', '415696644856741892', false, '2025-11-19 15:49:55.29339'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('9ac4fbde-a0f1-42e6-9689-abc6c39730e7'::uuid, 'Factavi', '1255567845467623596', false, '2025-12-09 16:22:53.130797'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('104ddf4d-f945-4799-92d1-9bb24fe7b41b'::uuid, 'MeleeG0D246', '1207348283366969445', false, '2025-12-12 04:34:13.025823'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('f04b1f7e-f989-4638-bc39-38e2816b0dc5'::uuid, 'TheWizMike', '219156655546302464', false, '2025-12-12 04:34:13.025823'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('7914c724-0669-45fb-b6b1-0027ab47c058'::uuid, '12hotroom', '1350936878358204558', false, '2025-12-12 04:34:13.025823'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('380df991-f603-344c-a090-369bad2a924a'::uuid, 'Dev', '900000000000000001', false, NOW(), NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";

-- ============================================================================
-- PLAYER BALANCES
-- ============================================================================

INSERT INTO player_balance (minecraft_uuid, balance, updated_at) VALUES
-- Real admins with high balances
('091b900c-4174-478c-900c-a0fe5a31a329', 15000000, NOW()),
('3e0db446-147a-4692-87fd-c3facc4341db', 12500000, NOW()),
('4cada83a-c012-4a31-8d80-942f3f79e8a1', 18750000, NOW()),
('8cca5cab-b782-452b-a8b9-8bb4ae0f6d0f', 500000, NOW()),
('32ff995f-cf92-417b-b745-891738346120', 500000, NOW()),

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

INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('091b900c-4174-478c-900c-a0fe5a31a329'::uuid, 541242, '2025-12-13 13:42:13.500122'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('80e97d7b-d98d-4261-b297-311758b62a1a'::uuid, 225000, '2025-11-08 19:47:53.04995'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('13fe4708-65fc-4ea0-9fb3-55b598b41e5e'::uuid, 4301000, '2025-11-09 14:05:53.340538'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('d8d729c4-8154-4891-ae21-7fe5fb209e6f'::uuid, 993354, '2025-11-12 21:17:54.489345'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('3e0db446-147a-4692-87fd-c3facc4341db'::uuid, 1393698, '2026-01-21 21:44:11.416026'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('5f03a336-72f9-4270-a9bc-de1f0f479562'::uuid, 50000, '2025-10-16 16:10:45.340775'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('c631d5a7-7a7d-4284-93be-6a01b218f0f2'::uuid, 2750001, '2025-12-15 06:35:14.147875'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('c5edca50-fdbf-4187-a450-0a6e6565c070'::uuid, 5000, '2025-09-24 17:54:59.334751'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('374f830c-2bf1-4a20-8e85-3d91045f1fd1'::uuid, 100003, '2025-11-06 20:33:52.354669'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('4faac6a9-a455-4c4a-9eef-b661e8f6e4cc'::uuid, 150086, '2025-10-26 08:38:12.372023'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('8a202d0e-c102-496d-afab-753fd5ca3571'::uuid, 769000, '2025-10-24 20:34:10.895972'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('4977e84d-fe04-4936-823a-3cb9dcf282cb'::uuid, 8380452, '2025-07-30 11:24:27.163102'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('f57f934f-ce1d-4e28-8573-f77b716029c6'::uuid, 3502415, '2025-08-02 06:24:39.277028'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('df6b417c-2962-4ee9-949e-a6ce0c35bbfa'::uuid, 103060, '2025-08-03 21:01:45.747007'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('aee71815-6420-444c-a245-9047c41f4a39'::uuid, 2596000, '2025-08-13 11:21:23.787755'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('d4dd2e33-7270-476b-aa1e-f3b28470456a'::uuid, 0, '2025-08-28 15:50:13.832487'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('548c2abb-714a-43fd-abcd-f22577fd1e26'::uuid, 700000, '2025-09-12 10:52:34.306884'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('dcf74a02-454f-40e0-8c1d-322ff8c0c397'::uuid, 0, '2025-09-12 12:46:18.990194'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('4fc2d86b-c9f7-4dbe-8cb0-155d5294fe36'::uuid, 557212, '2025-09-12 18:51:56.903138'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('80f364fe-8cfd-484f-8b91-1b4c2fe513ef'::uuid, 7, '2025-09-15 12:29:57.510653'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('0b62621f-4a30-479e-be5e-d74ebac52a91'::uuid, 0, '2025-09-21 16:14:28.984685'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('a76e759a-7d00-4734-9f11-51a6b6cdf1d7'::uuid, 100000, '2025-09-24 17:52:03.966053'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('8f79b53c-133c-4537-a5a9-68e3d435e64b'::uuid, 0, '2025-09-29 08:00:21.219334'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('12f58d82-c39a-4e44-a925-dd9ab31220c3'::uuid, 0, '2025-09-29 10:57:51.06334'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('fc0a44d5-d38c-408b-aae0-481fb33d6493'::uuid, 87, '2025-09-29 12:56:04.462679'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('4c6af6b1-5060-4424-aa3d-c6a90e4162a0'::uuid, 50000, '2025-09-30 17:49:27.406657'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('6a3c5ec0-c1e9-40bd-a544-626eac720453'::uuid, 0, '2025-09-30 17:50:19.088905'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('05d04d92-59cb-449d-a13e-95ea81c72a77'::uuid, 50000, '2025-10-01 12:11:33.294768'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('1d3814eb-b14c-4cc4-8119-92b19edb7857'::uuid, 0, '2025-10-01 12:37:36.051236'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('4578e5bf-6c84-46b2-ae0e-4a049768e9b0'::uuid, 324275, '2025-10-01 22:14:45.366787'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('45f6e0c2-8d39-4a71-860e-30839b8b3d89'::uuid, 18000, '2025-10-02 15:06:08.701782'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('dd2371a0-b959-4e7e-8a46-4a4c333b06ad'::uuid, 50000, '2025-10-04 17:42:00.492858'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('f80480fd-d6d7-4235-9f94-ec5667ebedfe'::uuid, 10000, '2025-10-04 18:00:24.170964'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('cb61d3af-4ba0-4a9d-8580-41bd2901660b'::uuid, 272409, '2025-10-05 21:38:01.923553'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('c084cc81-fe1a-46e8-b02c-e37533c7095c'::uuid, 1540000, '2025-10-06 15:33:25.940604'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('4cada83a-c012-4a31-8d80-942f3f79e8a1'::uuid, 2173118, '2025-10-07 13:06:25.094112'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('a531e1f6-f118-4f1b-92da-90930165b0b3'::uuid, 0, '2025-10-07 14:07:00.11265'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('17c1ff07-2430-449f-b9a9-cfe83724a957'::uuid, 0, '2025-10-09 21:04:36.808832'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('b7c1f179-3092-40ce-a5db-1fbfe31731bc'::uuid, 181000, '2025-10-10 06:11:50.466859'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('14202a22-a91d-4794-b591-f74209c2b4a3'::uuid, 1359000, '2025-10-10 07:55:42.99808'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('dd7bb5ca-2895-4938-b132-a2c8e26db8fe'::uuid, 254000, '2025-10-10 20:22:58.172476'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('3d93db70-7d02-45e4-a9d9-f470b7abf118'::uuid, 0, '2025-10-12 07:28:53.782211'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('e3f03f61-fbe7-4296-b8a9-4299e20c1384'::uuid, 569000, '2025-10-12 14:27:16.29577'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('4b16b869-7014-4388-92eb-d6a02b39dc27'::uuid, 897000, '2025-10-12 18:48:59.605993'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('bf371600-03ab-4894-8e5e-4321f3e83529'::uuid, 0, '2025-10-16 21:56:10.31123'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('569538d2-f12e-4d6e-a4b7-7e6da7c48689'::uuid, 216000, '2025-10-17 17:51:34.785181'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('9b29f9d5-c679-4d82-8b96-385a511cfbd8'::uuid, 350000, '2025-10-18 20:32:01.086117'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('c5320593-fac2-4fa4-b274-554402d00c6a'::uuid, 68000, '2025-10-20 04:28:07.716738'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('8fcbb134-b3fe-4cbd-9ff4-8d22adde1bcd'::uuid, 1012000, '2025-10-22 20:28:11.472259'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('150ad1d9-e9af-4218-88d9-4af2a6e107e1'::uuid, 921365, '2025-10-23 12:05:17.495972'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('757be40b-3e79-4b5c-a439-993cd0bbaf95'::uuid, 0, '2025-10-23 12:26:39.196046'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('079eb2f0-487b-491c-940e-e656596e6e32'::uuid, 240000, '2025-10-23 13:06:41.061342'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('db19222a-193e-4eb3-b04a-4e1a09f8a97f'::uuid, 0, '2025-10-23 13:46:33.090984'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('8c021900-f49f-4f15-8785-3e05b062b238'::uuid, 113942, '2025-10-23 19:28:16.028037'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('0bca0f96-d415-477a-8489-7ad36d2989ec'::uuid, 188000, '2025-10-24 12:25:33.501292'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('53c19b64-08c8-4f6f-8a0a-63e69e774b29'::uuid, 14000, '2025-10-24 15:02:11.808987'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('00756c17-07aa-482a-8d83-cdba4983af55'::uuid, 480000, '2025-10-24 16:04:00.010844'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('0eb355cb-34da-488b-820a-af5b8eb67750'::uuid, 0, '2025-10-26 07:41:10.81937'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('58cee719-d181-45bd-9bcc-d78b68774229'::uuid, 0, '2025-10-29 15:06:02.106294'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('d1d2936f-220e-4674-9edd-eea387c1427e'::uuid, 260000, '2025-10-29 21:17:36.003379'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('b2744d8c-4faf-43c8-8a63-c35d67d88376'::uuid, 30000, '2025-11-01 17:05:08.899747'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('780ba043-15e8-419b-9a48-21afb6a17f33'::uuid, 0, '2025-11-02 18:57:21.082133'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('aa3c2098-e60d-472d-a3f8-c782d1371b35'::uuid, 0, '2025-11-08 19:55:26.111127'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('26ed2764-83be-4a26-85b6-83ca1788ddee'::uuid, 0, '2025-11-09 14:55:48.951772'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('bd7c0803-c6bd-4e3e-83b9-08f2b84e044f'::uuid, 0, '2025-11-11 17:08:39.452911'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('7c18634b-d260-422b-8b1a-3c9807e17577'::uuid, 859000, '2025-11-13 13:12:33.100515'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('a8e12af2-d847-4314-b820-e3f52c214886'::uuid, 0, '2025-11-17 11:24:05.786035'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('cad09f5c-1cd2-4d66-943e-edc083d0656a'::uuid, 0, '2025-11-19 15:49:55.29339'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('9ac4fbde-a0f1-42e6-9689-abc6c39730e7'::uuid, 50000, '2025-12-09 16:22:53.130797'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('104ddf4d-f945-4799-92d1-9bb24fe7b41b'::uuid, 1000000, '2025-12-12 04:34:13.025823'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('380df991-f603-344c-a090-369bad2a924a'::uuid, 50000, NOW()) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";


-- ============================================================================
-- ADMINS
-- ============================================================================

INSERT INTO admin (discord_id, created_at, vanished) VALUES
('818819241666281503', NOW() - INTERVAL '180 days', false),  -- saunhardy
('547450242090532874', NOW() - INTERVAL '175 days', false),  -- Agent772
('99318080374607872', NOW() - INTERVAL '170 days', false),   -- The_Bigshot
('462293344807026699', NOW() - INTERVAL '10 days', false),   -- diablothe2nd
('1041727959767191655', NOW() - INTERVAL '10 days', false),  -- Tetsuoken
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
                    1, -- Rails 'n Sails server
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

-- WAITLIST ENTRIES (varied states)
INSERT INTO waitlist_entry (
  discord_id,
  discord_username,
  status,
  created_at,
  queued_at,
  promoted_at,
  promoted_by,
  registered_at,
  expired_at,
  joined_minecraft,
  verify_channel_id,
  waiting_message_id,
  admin_message_id
) VALUES
-- ======================================================================
-- REGISTERED (fully onboarded)
-- ======================================================================
('123456789012345686', 'mumbojumbo', 'registered', NOW() - INTERVAL '52 days', NOW() - INTERVAL '52 days', NOW() - INTERVAL '51 days', '818819241666281503', NOW() - INTERVAL '50 days', NULL, true, NULL, NULL, '111111111111111201'),
('123456789012345687', 'grian', 'registered', NOW() - INTERVAL '47 days', NOW() - INTERVAL '47 days', NOW() - INTERVAL '46 days', NULL, NOW() - INTERVAL '45 days', NULL, true, NULL, NULL, '111111111111111202'),

-- Registered but never joined Minecraft (stuck before first session)
('223456789012345692', 'registered_not_joined_mc', 'registered', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days', NOW() - INTERVAL '3 days', NULL, NOW() - INTERVAL '2 days', NULL, false, NULL, NULL, '111111111111111203'),

-- ======================================================================
-- PROMOTED (slot reserved, awaiting registration)
-- ======================================================================
-- Promoted manually by an admin
('123456789012345688', 'goodtimeswithscar', 'promoted', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '2 days', '818819241666281503', NULL, NULL, false, '333333333333333201', '444444444444444201', '111111111111111204'),

-- Promoted automatically, close to the 7-day registration window
('123456789012345689', 'iskall85', 'promoted', NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days', NOW() - INTERVAL '6 days', NULL, NULL, NULL, false, '333333333333333202', '444444444444444202', '111111111111111205'),

-- ======================================================================
-- QUEUED (waiting for a spot, ordered by queued_at)
-- ======================================================================
-- Signed up 40 days ago, no-showed a promotion and got re-queued 12 hours
-- ago: back of the line, but not a new signup in any window.
('223456789012345690', 'waiter_user1', 'queued', NOW() - INTERVAL '40 days', NOW() - INTERVAL '12 hours', NULL, NULL, NULL, NULL, false, '333333333333333203', '444444444444444203', '111111111111111206'),
-- Signed up 20 days ago, expired, rejoined 9 hours ago: counts this month
-- only.
('223456789012345691', 'waiter_user2', 'queued', NOW() - INTERVAL '20 days', NOW() - INTERVAL '9 hours', NULL, NULL, NULL, NULL, false, '333333333333333204', '444444444444444204', '111111111111111207'),
-- Genuine first-time signup today: 3 hours ago, but never earlier than
-- midnight, so a reseed in the small hours still lands in the "today" window.
('223456789012345693', 'waiter_user3', 'queued', NOW() - LEAST(INTERVAL '3 hours', NOW() - date_trunc('day', NOW())), NOW() - LEAST(INTERVAL '3 hours', NOW() - date_trunc('day', NOW())), NULL, NULL, NULL, NULL, false, '333333333333333205', '444444444444444205', '111111111111111208'),

-- ======================================================================
-- EXPIRED (left the queue or the guild)
-- ======================================================================
('223456789012345694', 'left_the_queue', 'expired', NOW() - INTERVAL '11 days', NOW() - INTERVAL '11 days', NULL, NULL, NULL, NOW() - INTERVAL '10 days', false, NULL, NULL, '111111111111111209'),
('223456789012345695', 'left_the_guild', 'expired', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days', NOW() - INTERVAL '13 days', NULL, NULL, NOW() - INTERVAL '12 days', false, NULL, NULL, '111111111111111210');

-- ============================================================================
-- ADMIN LOG ACTIONS
-- ============================================================================

INSERT INTO admin_log_action (
    admin_discord_id,
    admin_username,
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

-- ---------------------------------------------------------------------------
-- Tickets
-- ---------------------------------------------------------------------------

INSERT INTO public.ticket (
  ticket_number,
  type,
  creator_discord_id,
  channel_id,
  status,
  created_at,
  closed_at,
  closed_by_discord_id,
  deleted_at,
  metadata
) VALUES
-- OPEN (general)
(1001, 'general'::public.ticket_type, '123456789012345690', 'ticket-chan-1001', 'open'::public.ticket_status,
 NOW() - INTERVAL '2 days', NULL, NULL, NULL,
 '{"subject":"Can’t link Minecraft account","priority":"normal","tags":["account","linking"]}'::jsonb),

-- OPEN (report)
(1002, 'report'::public.ticket_type, '123456789012345681', 'ticket-chan-1002', 'open'::public.ticket_status,
 NOW() - INTERVAL '6 hours', NULL, NULL, NULL,
 '{"subject":"Griefing near spawn","priority":"high","tags":["griefing","spawn"],"coords":"0 70 0","accused":"Mumbo"}'::jsonb),

-- CLOSED (general)
(1003, 'general'::public.ticket_type, '123456789012345691', 'ticket-chan-1003', 'closed'::public.ticket_status,
 NOW() - INTERVAL '10 days', NOW() - INTERVAL '9 days 20 hours', '547450242090532874', NULL,
 '{"subject":"Whitelist / connection help","priority":"normal","tags":["whitelist","connection"],"resolution":"User not yet whitelisted"}'::jsonb),

-- CLOSED (report)
(1004, 'report'::public.ticket_type, '123456789012345688', 'ticket-chan-1004', 'closed'::public.ticket_status,
 NOW() - INTERVAL '20 days', NOW() - INTERVAL '19 days 22 hours', '818819241666281503', NULL,
 '{"subject":"Harassment report","priority":"high","tags":["harassment"],"accused":"Herobrine","resolution":"Warning issued"}'::jsonb),

-- DELETED (general) - soft-deleted ticket
(1005, 'general'::public.ticket_type, '123456789012345687', 'ticket-chan-1005', 'deleted'::public.ticket_status,
 NOW() - INTERVAL '30 days', NOW() - INTERVAL '29 days 23 hours', '99318080374607872', NOW() - INTERVAL '7 days',
 '{"subject":"Accidental ticket","priority":"low","tags":["cleanup"],"reason_deleted":"User opened by mistake"}'::jsonb);

-- ---------------------------------------------------------------------------
-- Ticket actions (audit log)
-- ---------------------------------------------------------------------------

INSERT INTO public.ticket_action (
  ticket_id,
  action_type,
  performed_by_discord_id,
  performed_at,
  metadata
) VALUES
-- Ticket 1001
(1, 'created', '123456789012345690', NOW() - INTERVAL '2 days',
 '{"note":"Ticket opened via /ticket","type":"general"}'::jsonb),
(1, 'message', '123456789012345690', NOW() - INTERVAL '1 day 23 hours',
 '{"content":"I linked Discord but bot says UUID missing."}'::jsonb),
(1, 'staff_reply', '818819241666281503', NOW() - INTERVAL '1 day 22 hours',
 '{"content":"Run /verify in #verify and paste the code here."}'::jsonb),

-- Ticket 1002
(2, 'created', '123456789012345681', NOW() - INTERVAL '6 hours',
 '{"note":"Report opened from ticket panel","type":"report"}'::jsonb),
(2, 'message', '123456789012345681', NOW() - INTERVAL '5 hours 40 minutes',
 '{"content":"Spawn area broken, chests emptied. Accused: Mumbo."}'::jsonb),
(2, 'staff_reply', '547450242090532874', NOW() - INTERVAL '5 hours 15 minutes',
 '{"content":"Thanks — we’re checking logs. Any screenshots?"}'::jsonb),

-- Ticket 1003
(3, 'created', '123456789012345691', NOW() - INTERVAL '10 days',
 '{"note":"Opened for connection help","type":"general"}'::jsonb),
(3, 'staff_reply', '547450242090532874', NOW() - INTERVAL '9 days 23 hours',
 '{"content":"Looks like you weren’t whitelisted yet; applying now."}'::jsonb),
(3, 'closed', '547450242090532874', NOW() - INTERVAL '9 days 20 hours',
 '{"resolution":"Resolved"}'::jsonb),

-- Ticket 1004
(4, 'created', '123456789012345688', NOW() - INTERVAL '20 days',
 '{"note":"Harassment report submitted","type":"report","accused":"Herobrine"}'::jsonb),
(4, 'staff_reply', '818819241666281503', NOW() - INTERVAL '19 days 23 hours',
 '{"content":"We reviewed logs; action will be taken."}'::jsonb),
(4, 'closed', '818819241666281503', NOW() - INTERVAL '19 days 22 hours',
 '{"resolution":"Warning issued","accused":"Herobrine"}'::jsonb),

-- Ticket 1005 (deleted)
(5, 'created', '123456789012345687', NOW() - INTERVAL '30 days',
 '{"note":"Opened by mistake","type":"general"}'::jsonb),
(5, 'closed', '99318080374607872', NOW() - INTERVAL '29 days 23 hours',
 '{"resolution":"No action needed"}'::jsonb),
(5, 'deleted', '99318080374607872', NOW() - INTERVAL '7 days',
 '{"reason":"Cleanup old accidental ticket"}'::jsonb);

-- ============================================================================
-- DISCORD EMBED PRESETS
-- ============================================================================

INSERT INTO discord_embed_preset (name, data, created_by) VALUES
('welcome', '{"title":"Welcome to Createrington!","description":"Thanks for joining our community. Please read the rules in #rules and verify your account.","color":5814783,"thumbnail":{"url":"https://example.com/logo.png"},"fields":[{"name":"Getting Started","value":"Use /verify to link your Minecraft account","inline":false}]}', 'saunhardy'),
('ban-notification', '{"title":"Player Banned","description":"A player has been banned from the server.","color":16711680,"fields":[{"name":"Reason","value":"{reason}","inline":true},{"name":"Duration","value":"{duration}","inline":true}]}', 'Agent772'),
('event-announcement', '{"title":"{event_name}","description":"{event_description}","color":16776960,"fields":[{"name":"Date","value":"{date}","inline":true},{"name":"Prize","value":"{prize}","inline":true}],"footer":{"text":"React to sign up!"}}', 'The_Bigshot'),
('server-status', '{"title":"Server Status","description":"Current server information","color":65280,"fields":[{"name":"Players Online","value":"{online_count}","inline":true},{"name":"TPS","value":"{tps}","inline":true},{"name":"Uptime","value":"{uptime}","inline":true}]}', 'saunhardy');

INSERT INTO discord_embed_preset (name, kind, data, created_by) VALUES
('welcome-components-v2', 'components', '{"components":[{"type":"container","accentColor":5814783,"spoiler":false,"components":[{"type":"text","content":"# Welcome to Createrington!\nThanks for joining our community."},{"type":"separator","divider":true,"spacing":1},{"type":"section","components":[{"type":"text","content":"Read the rules to get started."}],"accessory":{"type":"button","label":"Rules","url":"https://createrington.com/rules"}}]},{"type":"text","content":"-# Posted via the Components V2 builder"}]}', 'saunhardy');

-- ============================================================================
-- DISCORD GUILD MEMBER LEAVES
-- ============================================================================

INSERT INTO discord_guild_member_leave (discord_id, minecraft_uuid, minecraft_username, departed_at, notification_message_id, deleted_at) VALUES
('123456789012345688', '550e8400-e29b-41d4-a716-446655440011', 'Scar', NOW() - INTERVAL '15 days', '1100000000000000001', NULL),
('123456789012345689', '550e8400-e29b-41d4-a716-446655440012', 'Iskall', NOW() - INTERVAL '20 days', '1100000000000000002', NOW() - INTERVAL '5 days');

-- ============================================================================
-- FAQ ENTRIES
-- ============================================================================

INSERT INTO faq_entry (match_mode, pattern, title, response, enabled, priority) VALUES
('keywords', 'whitelist,join,how to join,apply', 'How to Join', 'To join Createrington, fill out the application in #apply and wait for approval. Once accepted, you''ll be whitelisted automatically.', true, 10),
('keywords', 'ip,address,server ip,connect', 'Server IP', 'The server IP is `play.createrington.com`. Make sure you''re using Minecraft Java Edition 1.20+.', true, 9),
('keywords', 'rules,guidelines,policy', 'Server Rules', 'Please read our full rules in #rules. Key points: no griefing, no hacking, be respectful, and no spam.', true, 8),
('keywords', 'balance,money,coins,economy', 'Economy System', 'Use `/balance` to check your coins. Earn coins by playing, completing achievements, and trading with other players.', true, 7),
('keywords', 'ban,banned,appeal,unban', 'Ban Appeals', 'If you''ve been banned, you can submit an appeal by opening a ticket with `/ticket`. Include your username and reason for appeal.', true, 6),
('keywords', 'discord,role,rank', 'Discord Roles', 'Roles are assigned based on your playtime and contributions. Check #roles for more info on available ranks.', false, 3);

-- ============================================================================
-- FAQ WELCOME MESSAGES
-- ============================================================================

INSERT INTO faq_welcome_message (channel_id, message_id) VALUES
('900000000000000001', '950000000000000001'),
('900000000000000002', '950000000000000002');

-- ============================================================================
-- LEADERBOARD MESSAGES
-- ============================================================================
-- Omitted: fake channel/message IDs cause DiscordAPIError[10003] (Unknown Channel)
-- when the leaderboard service tries to refresh them at startup.

-- ============================================================================
-- PLAYER ACHIEVEMENTS
-- ============================================================================

INSERT INTO player_achievement (minecraft_uuid, server_id, achievement_group_id, tier, completed_at, claimed_at, reward_amount) VALUES
-- saunhardy: veteran player with claimed achievements
('091b900c-4174-478c-900c-a0fe5a31a329', 1, 'playtime', 1, NOW() - INTERVAL '150 days', NOW() - INTERVAL '149 days', 5000),
('091b900c-4174-478c-900c-a0fe5a31a329', 1, 'playtime', 2, NOW() - INTERVAL '120 days', NOW() - INTERVAL '119 days', 15000),
('091b900c-4174-478c-900c-a0fe5a31a329', 1, 'playtime', 3, NOW() - INTERVAL '60 days', NOW() - INTERVAL '59 days', 50000),
('091b900c-4174-478c-900c-a0fe5a31a329', 1, 'mining', 1, NOW() - INTERVAL '140 days', NOW() - INTERVAL '140 days', 3000),
('091b900c-4174-478c-900c-a0fe5a31a329', 1, 'mining', 2, NOW() - INTERVAL '90 days', NULL, 10000),

-- Steve: active player with some achievements
('550e8400-e29b-41d4-a716-446655440001', 1, 'playtime', 1, NOW() - INTERVAL '60 days', NOW() - INTERVAL '59 days', 5000),
('550e8400-e29b-41d4-a716-446655440001', 1, 'playtime', 2, NOW() - INTERVAL '30 days', NULL, 15000),
('550e8400-e29b-41d4-a716-446655440001', 1, 'building', 1, NOW() - INTERVAL '45 days', NOW() - INTERVAL '44 days', 3000),

-- Alex: a few achievements
('550e8400-e29b-41d4-a716-446655440002', 1, 'playtime', 1, NOW() - INTERVAL '50 days', NOW() - INTERVAL '49 days', 5000),
('550e8400-e29b-41d4-a716-446655440002', 1, 'combat', 1, NOW() - INTERVAL '40 days', NOW() - INTERVAL '39 days', 4000),

-- Technoblade: combat-focused
('550e8400-e29b-41d4-a716-446655440007', 1, 'combat', 1, NOW() - INTERVAL '45 days', NOW() - INTERVAL '44 days', 4000),
('550e8400-e29b-41d4-a716-446655440007', 1, 'combat', 2, NOW() - INTERVAL '30 days', NOW() - INTERVAL '29 days', 12000),
('550e8400-e29b-41d4-a716-446655440007', 1, 'combat', 3, NOW() - INTERVAL '10 days', NULL, 40000);

-- ============================================================================
-- PLAYER BALANCE TRANSACTIONS
-- ============================================================================

INSERT INTO player_balance_transaction (player_minecraft_uuid, amount, balance_before, balance_after, transaction_type, description, related_player_uuid, metadata) VALUES
-- Steve: earning and spending
('550e8400-e29b-41d4-a716-446655440001', 50000, 0, 50000, 'welcome_bonus', 'Welcome bonus for new player', NULL, '{}'),
('550e8400-e29b-41d4-a716-446655440001', 5000, 50000, 55000, 'achievement', 'Playtime tier 1 achievement reward', NULL, '{"achievement_group_id":"playtime","tier":1}'),
('550e8400-e29b-41d4-a716-446655440001', 200500, 55000, 255500, 'playtime_reward', 'Weekly playtime reward', NULL, '{"week":"2026-W04"}'),
('550e8400-e29b-41d4-a716-446655440001', -5000, 255500, 250500, 'transfer', 'Sent to Alex', '550e8400-e29b-41d4-a716-446655440002', '{}'),
('550e8400-e29b-41d4-a716-446655440001', 1000000, 250500, 1250500, 'admin_adjust', 'Admin balance correction', NULL, '{"admin_discord_id":"818819241666281503","reason":"compensation for lost items"}'),

-- Alex: receiving and trading
('550e8400-e29b-41d4-a716-446655440002', 50000, 0, 50000, 'welcome_bonus', 'Welcome bonus for new player', NULL, '{}'),
('550e8400-e29b-41d4-a716-446655440002', 5000, 50000, 55000, 'transfer', 'Received from Steve', '550e8400-e29b-41d4-a716-446655440001', '{}'),
('550e8400-e29b-41d4-a716-446655440002', 3365750, 55000, 3420750, 'playtime_reward', 'Accumulated playtime rewards', NULL, '{}'),

-- Notch: high earner
('550e8400-e29b-41d4-a716-446655440003', 50000, 0, 50000, 'welcome_bonus', 'Welcome bonus for new player', NULL, '{}'),
('550e8400-e29b-41d4-a716-446655440003', 8949990, 50000, 8999990, 'shop_sale', 'Sold rare items at shop', NULL, '{"items":["minecraft:netherite_ingot","minecraft:elytra"]}'),

-- Newbie1: only welcome bonus
('550e8400-e29b-41d4-a716-446655440013', 100000, 0, 100000, 'welcome_bonus', 'Welcome bonus for new player', NULL, '{}');

-- ============================================================================
-- PLAYER MINECRAFT STATS
-- ============================================================================

INSERT INTO player_minecraft_stats (minecraft_uuid, server_id, stats, data_version) VALUES
('091b900c-4174-478c-900c-a0fe5a31a329', 1,
 '{"minecraft:mined":{"minecraft:diamond_ore":342,"minecraft:stone":28451,"minecraft:deepslate":12893},"minecraft:killed":{"minecraft:zombie":1523,"minecraft:skeleton":982,"minecraft:creeper":456},"minecraft:custom":{"minecraft:play_time":15552000,"minecraft:walk_one_cm":8945123,"minecraft:jump":234567}}',
 3837),
('550e8400-e29b-41d4-a716-446655440001', 1,
 '{"minecraft:mined":{"minecraft:diamond_ore":87,"minecraft:stone":9821,"minecraft:deepslate":4532},"minecraft:killed":{"minecraft:zombie":432,"minecraft:skeleton":287,"minecraft:creeper":123},"minecraft:custom":{"minecraft:play_time":5184000,"minecraft:walk_one_cm":3456789,"minecraft:jump":98765}}',
 3837),
('550e8400-e29b-41d4-a716-446655440002', 1,
 '{"minecraft:mined":{"minecraft:diamond_ore":124,"minecraft:stone":15234,"minecraft:deepslate":7891},"minecraft:killed":{"minecraft:zombie":678,"minecraft:skeleton":432,"minecraft:creeper":234},"minecraft:custom":{"minecraft:play_time":6480000,"minecraft:walk_one_cm":5678901,"minecraft:jump":145678}}',
 3837),
('550e8400-e29b-41d4-a716-446655440007', 1,
 '{"minecraft:mined":{"minecraft:diamond_ore":56,"minecraft:stone":5432},"minecraft:killed":{"minecraft:zombie":2341,"minecraft:skeleton":1876,"minecraft:creeper":923,"minecraft:player":47},"minecraft:custom":{"minecraft:play_time":4320000,"minecraft:walk_one_cm":2345678,"minecraft:jump":67890}}',
 3837);

-- ============================================================================
-- REWARD CLAIMS
-- ============================================================================

INSERT INTO reward_claim (player_minecraft_uuid, reward_type, claimed_at, claim_period_key, amount, metadata) VALUES
-- Daily login rewards
('091b900c-4174-478c-900c-a0fe5a31a329', 'daily_login', NOW() - INTERVAL '1 day', to_char((NOW() - INTERVAL '1 day')::date, 'YYYY-MM-DD'), 1000, '{"streak":45}'),
('091b900c-4174-478c-900c-a0fe5a31a329', 'daily_login', NOW() - INTERVAL '2 days', to_char((NOW() - INTERVAL '2 days')::date, 'YYYY-MM-DD'), 1000, '{"streak":44}'),
('550e8400-e29b-41d4-a716-446655440001', 'daily_login', NOW() - INTERVAL '1 day', to_char((NOW() - INTERVAL '1 day')::date, 'YYYY-MM-DD'), 1000, '{"streak":12}'),
('550e8400-e29b-41d4-a716-446655440002', 'daily_login', NOW() - INTERVAL '1 day', to_char((NOW() - INTERVAL '1 day')::date, 'YYYY-MM-DD'), 1000, '{"streak":8}'),
('550e8400-e29b-41d4-a716-446655440003', 'daily_login', NOW() - INTERVAL '2 days', to_char((NOW() - INTERVAL '2 days')::date, 'YYYY-MM-DD'), 1000, '{"streak":30}'),

-- Weekly playtime rewards
('091b900c-4174-478c-900c-a0fe5a31a329', 'weekly_playtime', NOW() - INTERVAL '3 days', '2026-W05', 25000, '{"hours_played":42,"week":"2026-W05"}'),
('550e8400-e29b-41d4-a716-446655440001', 'weekly_playtime', NOW() - INTERVAL '3 days', '2026-W05', 15000, '{"hours_played":28,"week":"2026-W05"}'),
('550e8400-e29b-41d4-a716-446655440007', 'weekly_playtime', NOW() - INTERVAL '3 days', '2026-W05', 10000, '{"hours_played":18,"week":"2026-W05"}'),

-- Vote rewards
('550e8400-e29b-41d4-a716-446655440001', 'vote', NOW() - INTERVAL '1 day', to_char((NOW() - INTERVAL '1 day')::date, 'YYYY-MM-DD'), 500, '{"site":"minecraft-server-list"}'),
('550e8400-e29b-41d4-a716-446655440002', 'vote', NOW() - INTERVAL '1 day', to_char((NOW() - INTERVAL '1 day')::date, 'YYYY-MM-DD'), 500, '{"site":"minecraft-server-list"}'),
('550e8400-e29b-41d4-a716-446655440005', 'vote', NOW() - INTERVAL '2 days', to_char((NOW() - INTERVAL '2 days')::date, 'YYYY-MM-DD'), 500, '{"site":"minecraft-server-list"}'),

-- Event participation
('550e8400-e29b-41d4-a716-446655440007', 'event', NOW() - INTERVAL '10 days', 'winter_games_2026', 50000, '{"event":"winter_games_2026","placement":1}'),
('550e8400-e29b-41d4-a716-446655440001', 'event', NOW() - INTERVAL '10 days', 'winter_games_2026', 25000, '{"event":"winter_games_2026","placement":2}'),
('550e8400-e29b-41d4-a716-446655440002', 'event', NOW() - INTERVAL '10 days', 'winter_games_2026', 10000, '{"event":"winter_games_2026","placement":3}');


-- ============================================================================
-- AGGREGATE PLAYTIME FROM SESSIONS
-- ============================================================================

-- Populate daily aggregates from completed sessions (pre-aggregated to avoid ON CONFLICT dupes)
INSERT INTO player_playtime_daily (player_minecraft_uuid, server_id, play_date, seconds_played)
SELECT
    player_minecraft_uuid,
    server_id,
    play_date,
    SUM(seconds_played)
FROM (
    SELECT
        player_minecraft_uuid,
        server_id,
        d::date AS play_date,
        EXTRACT(EPOCH FROM (
            LEAST(session_end, (d + INTERVAL '1 day')::timestamptz) -
            GREATEST(session_start, d::timestamptz)
        ))::bigint AS seconds_played
    FROM player_session,
         generate_series(session_start::date, session_end::date, '1 day'::interval) AS d
    WHERE session_end IS NOT NULL
) sub
GROUP BY player_minecraft_uuid, server_id, play_date;

-- Populate hourly aggregates from completed sessions (pre-aggregated)
INSERT INTO player_playtime_hourly (player_minecraft_uuid, server_id, play_hour, seconds_played)
SELECT
    player_minecraft_uuid,
    server_id,
    play_hour,
    SUM(seconds_played)
FROM (
    SELECT
        player_minecraft_uuid,
        server_id,
        h AS play_hour,
        EXTRACT(EPOCH FROM (
            LEAST(session_end, h + INTERVAL '1 hour') -
            GREATEST(session_start, h)
        ))::bigint AS seconds_played
    FROM player_session,
         generate_series(
             date_trunc('hour', session_start),
             session_end - INTERVAL '1 second',
             '1 hour'::interval
         ) AS h
    WHERE session_end IS NOT NULL
) sub
GROUP BY player_minecraft_uuid, server_id, play_hour;

-- Populate summary aggregates from completed sessions
INSERT INTO player_playtime_summary (player_minecraft_uuid, server_id, total_seconds, total_sessions, first_seen, last_seen)
SELECT
    player_minecraft_uuid,
    server_id,
    SUM(EXTRACT(EPOCH FROM (session_end - session_start))::bigint),
    COUNT(*),
    MIN(session_start),
    MAX(session_end)
FROM player_session
WHERE session_end IS NOT NULL
GROUP BY player_minecraft_uuid, server_id
ON CONFLICT (player_minecraft_uuid, server_id)
DO UPDATE SET
    total_seconds = EXCLUDED.total_seconds,
    total_sessions = EXCLUDED.total_sessions,
    first_seen = EXCLUDED.first_seen,
    last_seen = EXCLUDED.last_seen;

-- ============================================================================
-- VERIFY DATA INTEGRITY
-- ============================================================================

-- Check playtime aggregates
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

-- ============================================================================
-- CRYPTO MARKET
-- ============================================================================

-- Clean up crypto tables (in dependency order)
TRUNCATE TABLE crypto_cost_basis CASCADE;
TRUNCATE TABLE crypto_transaction CASCADE;
TRUNCATE TABLE crypto_order CASCADE;
TRUNCATE TABLE crypto_holding CASCADE;
TRUNCATE TABLE crypto_price_snapshot CASCADE;
TRUNCATE TABLE crypto_market_event CASCADE;
TRUNCATE TABLE crypto_price_alert CASCADE;
TRUNCATE TABLE crypto_watchlist CASCADE;
TRUNCATE TABLE crypto_portfolio_snapshot CASCADE;
TRUNCATE TABLE crypto_token CASCADE;
TRUNCATE TABLE crypto_treasury CASCADE;

ALTER SEQUENCE crypto_token_id_seq RESTART WITH 1;
ALTER SEQUENCE crypto_holding_id_seq RESTART WITH 1;
ALTER SEQUENCE crypto_order_id_seq RESTART WITH 1;
ALTER SEQUENCE crypto_transaction_id_seq RESTART WITH 1;
ALTER SEQUENCE crypto_price_snapshot_id_seq RESTART WITH 1;
ALTER SEQUENCE crypto_cost_basis_id_seq RESTART WITH 1;
ALTER SEQUENCE crypto_treasury_id_seq RESTART WITH 1;
ALTER SEQUENCE crypto_market_event_id_seq RESTART WITH 1;
ALTER SEQUENCE crypto_price_alert_id_seq RESTART WITH 1;
ALTER SEQUENCE crypto_watchlist_id_seq RESTART WITH 1;
ALTER SEQUENCE crypto_portfolio_snapshot_id_seq RESTART WITH 1;

-- Treasury (single row)
INSERT INTO crypto_treasury (total_collected, total_burned) VALUES (0, 0);

-- Stablecoins
INSERT INTO crypto_token (name, symbol, description, category, total_supply, available_supply, price, floor_price)
VALUES
  ('Ringcoin', 'RGC', 'The official currency of Createrington. Pegged to server activity.', 'stable', 999999999, 999999999, 1.00000000, 1.00000000);

-- Initial Memecoins (supply range: 500–50,000 per CRYPTO_CONFIG)
INSERT INTO crypto_token (name, symbol, description, category, total_supply, available_supply, price)
VALUES
  ('FluffCoin', 'FLF', 'Backed by the raw power of sheep wool. May crash during shearing season.', 'memecoin', 40000, 40000, 0.50000000),
  ('CreeperCash', 'CRP', 'Explosive growth potential. Literally.', 'memecoin', 20000, 20000, 2.50000000),
  ('DiamondDoge', 'DDG', 'To the bedrock and beyond!', 'memecoin', 5000, 5000, 15.00000000),
  ('EnderToken', 'END', 'Teleports between price points with no warning.', 'memecoin', 50000, 50000, 0.01000000),
  ('RedstoneRuble', 'RSR', 'Powers the Minecraft economy, one tick at a time.', 'memecoin', 30000, 30000, 5.00000000);

-- Token IDs (by insert order): 1=RGC, 2=FLF, 3=CRP, 4=DDG, 5=END, 6=RSR

-- Update available supply to reflect held tokens
UPDATE crypto_token SET available_supply = 34500  WHERE symbol = 'FLF'; -- 5500 held
UPDATE crypto_token SET available_supply = 19200  WHERE symbol = 'CRP'; -- 800 held
UPDATE crypto_token SET available_supply = 4840   WHERE symbol = 'DDG'; -- 160 held
UPDATE crypto_token SET available_supply = 40000  WHERE symbol = 'END'; -- 10000 held
UPDATE crypto_token SET available_supply = 27200  WHERE symbol = 'RSR'; -- 2800 held

-- ============================================================================
-- CRYPTO HOLDINGS
-- ============================================================================

INSERT INTO crypto_holding (player_minecraft_uuid, token_id, amount, total_cost_basis, created_at, updated_at) VALUES
-- saunhardy: 3000 FLF, 100 CRP, 50 DDG, 10000 END
('091b900c-4174-478c-900c-a0fe5a31a329', 2, 3000, 900.00000000, NOW() - INTERVAL '28 days', NOW() - INTERVAL '5 days'),
('091b900c-4174-478c-900c-a0fe5a31a329', 3, 100,  200.00000000, NOW() - INTERVAL '25 days', NOW() - INTERVAL '5 days'),
('091b900c-4174-478c-900c-a0fe5a31a329', 4, 50,   600.00000000, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
('091b900c-4174-478c-900c-a0fe5a31a329', 5, 10000, 80.00000000, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
-- Steve: 500 FLF, 500 RSR
('550e8400-e29b-41d4-a716-446655440001', 2, 500,  175.00000000, NOW() - INTERVAL '20 days', NOW() - INTERVAL '7 days'),
('550e8400-e29b-41d4-a716-446655440001', 6, 500,  2250.00000000, NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days'),
-- Alex: 10 DDG, 200 CRP
('550e8400-e29b-41d4-a716-446655440002', 4, 10,   140.00000000, NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days'),
('550e8400-e29b-41d4-a716-446655440002', 3, 200,  440.00000000, NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'),
-- Notch: 2000 RSR, 100 DDG
('550e8400-e29b-41d4-a716-446655440003', 6, 2000, 8000.00000000, NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'),
('550e8400-e29b-41d4-a716-446655440003', 4, 100,  1000.00000000, NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'),
-- Herobrine: 2000 FLF
('550e8400-e29b-41d4-a716-446655440004', 2, 2000, 800.00000000, NOW() - INTERVAL '18 days', NOW() - INTERVAL '5 days'),
-- Technoblade: 300 RSR, 500 CRP
('550e8400-e29b-41d4-a716-446655440007', 6, 300,  1560.00000000, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
('550e8400-e29b-41d4-a716-446655440007', 3, 500,  1150.00000000, NOW() - INTERVAL '7 days', NOW() - INTERVAL '3 days');

-- ============================================================================
-- CRYPTO TRANSACTIONS
-- ============================================================================

INSERT INTO crypto_transaction (player_minecraft_uuid, token_id, type, trigger, amount, price_at_execution, fee_amount, total_cost, realized_pnl, created_at) VALUES
-- saunhardy buys
('091b900c-4174-478c-900c-a0fe5a31a329', 2, 'buy', 'market', 5000, 0.30000000, 15.00000000, 1515.00000000, NULL, NOW() - INTERVAL '28 days'),
('091b900c-4174-478c-900c-a0fe5a31a329', 3, 'buy', 'market', 200,  2.00000000, 4.00000000,  404.00000000, NULL, NOW() - INTERVAL '25 days'),
('091b900c-4174-478c-900c-a0fe5a31a329', 4, 'buy', 'market', 50,   12.00000000, 6.00000000, 606.00000000, NULL, NOW() - INTERVAL '20 days'),
('091b900c-4174-478c-900c-a0fe5a31a329', 5, 'buy', 'market', 10000, 0.00800000, 4.00000000, 84.00000000, NULL, NOW() - INTERVAL '10 days'),
-- saunhardy sells
('091b900c-4174-478c-900c-a0fe5a31a329', 2, 'sell', 'market', 2000, 0.45000000, 9.00000000, 891.00000000, 300.00000000, NOW() - INTERVAL '15 days'),
('091b900c-4174-478c-900c-a0fe5a31a329', 3, 'sell', 'market', 100,  2.80000000, 2.80000000, 277.20000000, 80.00000000, NOW() - INTERVAL '5 days'),
-- Steve buys
('550e8400-e29b-41d4-a716-446655440001', 2, 'buy', 'market', 1000, 0.35000000, 3.50000000, 353.50000000, NULL, NOW() - INTERVAL '20 days'),
('550e8400-e29b-41d4-a716-446655440001', 6, 'buy', 'market', 500,  4.50000000, 22.50000000, 2272.50000000, NULL, NOW() - INTERVAL '15 days'),
-- Steve sell
('550e8400-e29b-41d4-a716-446655440001', 2, 'sell', 'market', 500,  0.50000000, 2.50000000, 247.50000000, 75.00000000, NOW() - INTERVAL '7 days'),
-- Alex buys
('550e8400-e29b-41d4-a716-446655440002', 4, 'buy', 'market', 10,   14.00000000, 1.40000000, 141.40000000, NULL, NOW() - INTERVAL '12 days'),
('550e8400-e29b-41d4-a716-446655440002', 3, 'buy', 'market', 200,  2.20000000, 4.40000000, 444.40000000, NULL, NOW() - INTERVAL '8 days'),
-- Notch buys
('550e8400-e29b-41d4-a716-446655440003', 6, 'buy', 'market', 2000, 4.00000000, 80.00000000, 8080.00000000, NULL, NOW() - INTERVAL '25 days'),
('550e8400-e29b-41d4-a716-446655440003', 4, 'buy', 'market', 100,  10.00000000, 10.00000000, 1010.00000000, NULL, NOW() - INTERVAL '25 days'),
-- Herobrine buys
('550e8400-e29b-41d4-a716-446655440004', 5, 'buy', 'market', 5000, 0.00500000, 1.25000000, 26.25000000, NULL, NOW() - INTERVAL '22 days'),
('550e8400-e29b-41d4-a716-446655440004', 2, 'buy', 'market', 3000, 0.40000000, 12.00000000, 1212.00000000, NULL, NOW() - INTERVAL '18 days'),
-- Herobrine sells
('550e8400-e29b-41d4-a716-446655440004', 5, 'sell', 'market', 5000, 0.01200000, 3.00000000, 57.00000000, 35.00000000, NOW() - INTERVAL '10 days'),
('550e8400-e29b-41d4-a716-446655440004', 2, 'sell', 'market', 1000, 0.48000000, 4.80000000, 475.20000000, 80.00000000, NOW() - INTERVAL '5 days'),
-- Technoblade buys
('550e8400-e29b-41d4-a716-446655440007', 6, 'buy', 'market', 300,  5.20000000, 15.60000000, 1575.60000000, NULL, NOW() - INTERVAL '10 days'),
('550e8400-e29b-41d4-a716-446655440007', 3, 'buy', 'market', 1000, 2.30000000, 23.00000000, 2323.00000000, NULL, NOW() - INTERVAL '7 days'),
-- Technoblade sell
('550e8400-e29b-41d4-a716-446655440007', 3, 'sell', 'market', 500,  2.60000000, 13.00000000, 1287.00000000, 150.00000000, NOW() - INTERVAL '3 days');

-- ============================================================================
-- CRYPTO COST BASIS (remaining lots after sells, FIFO)
-- ============================================================================

INSERT INTO crypto_cost_basis (player_minecraft_uuid, token_id, amount_remaining, price_per_unit, acquired_at) VALUES
-- saunhardy: remaining FLF (bought 5000 @ $0.30, sold 2000 → 3000 left)
('091b900c-4174-478c-900c-a0fe5a31a329', 2, 3000, 0.30000000, NOW() - INTERVAL '28 days'),
-- saunhardy: remaining CRP (bought 200 @ $2.00, sold 100 → 100 left)
('091b900c-4174-478c-900c-a0fe5a31a329', 3, 100, 2.00000000, NOW() - INTERVAL '25 days'),
-- saunhardy: DDG (full lot)
('091b900c-4174-478c-900c-a0fe5a31a329', 4, 50, 12.00000000, NOW() - INTERVAL '20 days'),
-- saunhardy: END (full lot)
('091b900c-4174-478c-900c-a0fe5a31a329', 5, 10000, 0.00800000, NOW() - INTERVAL '10 days'),
-- Steve: remaining FLF (bought 1000 @ $0.35, sold 500 → 500 left)
('550e8400-e29b-41d4-a716-446655440001', 2, 500, 0.35000000, NOW() - INTERVAL '20 days'),
-- Steve: RSR (full lot)
('550e8400-e29b-41d4-a716-446655440001', 6, 500, 4.50000000, NOW() - INTERVAL '15 days'),
-- Alex: DDG
('550e8400-e29b-41d4-a716-446655440002', 4, 10, 14.00000000, NOW() - INTERVAL '12 days'),
-- Alex: CRP
('550e8400-e29b-41d4-a716-446655440002', 3, 200, 2.20000000, NOW() - INTERVAL '8 days'),
-- Notch: RSR
('550e8400-e29b-41d4-a716-446655440003', 6, 2000, 4.00000000, NOW() - INTERVAL '25 days'),
-- Notch: DDG
('550e8400-e29b-41d4-a716-446655440003', 4, 100, 10.00000000, NOW() - INTERVAL '25 days'),
-- Herobrine: remaining FLF (bought 3000 @ $0.40, sold 1000 → 2000 left)
('550e8400-e29b-41d4-a716-446655440004', 2, 2000, 0.40000000, NOW() - INTERVAL '18 days'),
-- Technoblade: RSR
('550e8400-e29b-41d4-a716-446655440007', 6, 300, 5.20000000, NOW() - INTERVAL '10 days'),
-- Technoblade: remaining CRP (bought 1000 @ $2.30, sold 500 → 500 left)
('550e8400-e29b-41d4-a716-446655440007', 3, 500, 2.30000000, NOW() - INTERVAL '7 days');

-- ============================================================================
-- CRYPTO PRICE SNAPSHOTS (minute interval around 24h ago for change24h)
-- ============================================================================

INSERT INTO crypto_price_snapshot (token_id, interval, open_price, high_price, low_price, close_price, volume, recorded_at) VALUES
-- ~24h ago minute snapshots (used by get24hChange)
(1, 'minute', 1.00000000, 1.00000000, 1.00000000, 1.00000000, 0, NOW() - INTERVAL '24 hours'),
(2, 'minute', 0.47000000, 0.47500000, 0.46500000, 0.47000000, 120, NOW() - INTERVAL '24 hours'),
(3, 'minute', 2.40000000, 2.42000000, 2.38000000, 2.40000000, 80, NOW() - INTERVAL '24 hours'),
(4, 'minute', 14.50000000, 14.60000000, 14.40000000, 14.50000000, 15, NOW() - INTERVAL '24 hours'),
(5, 'minute', 0.00950000, 0.00960000, 0.00940000, 0.00950000, 5000, NOW() - INTERVAL '24 hours'),
(6, 'minute', 4.80000000, 4.85000000, 4.75000000, 4.80000000, 50, NOW() - INTERVAL '24 hours');

-- ============================================================================
-- CRYPTO PRICE SNAPSHOTS (daily interval for price chart)
-- ============================================================================

INSERT INTO crypto_price_snapshot (token_id, interval, open_price, high_price, low_price, close_price, volume, recorded_at)
SELECT token_id, 'daily', open_p, high_p, low_p, close_p, vol, ts
FROM (VALUES
  -- FLF (token 2): $0.30 → $0.50 over 30 days
  (2, 0.30, 0.32, 0.29, 0.31, 800,  NOW() - INTERVAL '30 days'),
  (2, 0.31, 0.33, 0.30, 0.32, 650,  NOW() - INTERVAL '27 days'),
  (2, 0.32, 0.36, 0.31, 0.35, 1200, NOW() - INTERVAL '24 days'),
  (2, 0.35, 0.38, 0.34, 0.37, 900,  NOW() - INTERVAL '21 days'),
  (2, 0.37, 0.40, 0.35, 0.38, 1100, NOW() - INTERVAL '18 days'),
  (2, 0.38, 0.42, 0.37, 0.41, 750,  NOW() - INTERVAL '15 days'),
  (2, 0.41, 0.44, 0.40, 0.43, 600,  NOW() - INTERVAL '12 days'),
  (2, 0.43, 0.46, 0.42, 0.45, 500,  NOW() - INTERVAL '9 days'),
  (2, 0.45, 0.48, 0.44, 0.47, 400,  NOW() - INTERVAL '6 days'),
  (2, 0.47, 0.51, 0.46, 0.50, 350,  NOW() - INTERVAL '3 days'),
  (2, 0.50, 0.52, 0.49, 0.50, 300,  NOW() - INTERVAL '1 day'),
  -- CRP (token 3): $2.00 → $2.50
  (3, 2.00, 2.10, 1.95, 2.05, 200, NOW() - INTERVAL '30 days'),
  (3, 2.05, 2.15, 2.00, 2.10, 180, NOW() - INTERVAL '25 days'),
  (3, 2.10, 2.25, 2.08, 2.20, 300, NOW() - INTERVAL '20 days'),
  (3, 2.20, 2.30, 2.15, 2.25, 250, NOW() - INTERVAL '15 days'),
  (3, 2.25, 2.40, 2.22, 2.35, 280, NOW() - INTERVAL '10 days'),
  (3, 2.35, 2.45, 2.30, 2.40, 200, NOW() - INTERVAL '5 days'),
  (3, 2.40, 2.52, 2.38, 2.50, 150, NOW() - INTERVAL '1 day'),
  -- DDG (token 4): $10.00 → $15.00
  (4, 10.00, 10.50, 9.80,  10.30, 30, NOW() - INTERVAL '30 days'),
  (4, 10.30, 11.00, 10.10, 10.80, 25, NOW() - INTERVAL '25 days'),
  (4, 10.80, 12.00, 10.50, 11.50, 40, NOW() - INTERVAL '20 days'),
  (4, 11.50, 12.50, 11.20, 12.20, 35, NOW() - INTERVAL '15 days'),
  (4, 12.20, 13.50, 12.00, 13.00, 30, NOW() - INTERVAL '10 days'),
  (4, 13.00, 14.20, 12.80, 14.00, 20, NOW() - INTERVAL '5 days'),
  (4, 14.00, 15.20, 13.80, 15.00, 18, NOW() - INTERVAL '1 day'),
  -- END (token 5): $0.005 → $0.01
  (5, 0.005,  0.0055, 0.0048, 0.0052, 20000, NOW() - INTERVAL '30 days'),
  (5, 0.0052, 0.006,  0.005,  0.0058, 18000, NOW() - INTERVAL '25 days'),
  (5, 0.0058, 0.007,  0.0055, 0.0065, 25000, NOW() - INTERVAL '20 days'),
  (5, 0.0065, 0.008,  0.006,  0.0075, 22000, NOW() - INTERVAL '15 days'),
  (5, 0.0075, 0.009,  0.007,  0.0085, 15000, NOW() - INTERVAL '10 days'),
  (5, 0.0085, 0.010,  0.008,  0.0095, 12000, NOW() - INTERVAL '5 days'),
  (5, 0.0095, 0.011,  0.009,  0.0100, 10000, NOW() - INTERVAL '1 day'),
  -- RSR (token 6): $4.00 → $5.00
  (6, 4.00, 4.20, 3.90, 4.10, 100, NOW() - INTERVAL '30 days'),
  (6, 4.10, 4.30, 4.00, 4.20, 90,  NOW() - INTERVAL '25 days'),
  (6, 4.20, 4.50, 4.10, 4.40, 120, NOW() - INTERVAL '20 days'),
  (6, 4.40, 4.60, 4.30, 4.50, 110, NOW() - INTERVAL '15 days'),
  (6, 4.50, 4.70, 4.40, 4.60, 80,  NOW() - INTERVAL '10 days'),
  (6, 4.60, 4.90, 4.55, 4.80, 70,  NOW() - INTERVAL '5 days'),
  (6, 4.80, 5.10, 4.75, 5.00, 60,  NOW() - INTERVAL '1 day')
) AS v(token_id, open_p, high_p, low_p, close_p, vol, ts);

-- ============================================================================
-- CRYPTO PORTFOLIO SNAPSHOTS (daily, for portfolio history chart)
-- ============================================================================

INSERT INTO crypto_portfolio_snapshot (player_minecraft_uuid, total_value, total_invested, realized_pnl, token_count, recorded_at)
SELECT uuid, tv, ti, rpnl, tc, ts
FROM (VALUES
  -- saunhardy: portfolio growing from ~$2000 to ~$3800
  ('091b900c-4174-478c-900c-a0fe5a31a329'::uuid, 2000.00, 2500.00, 0.00,    2, NOW() - INTERVAL '28 days'),
  ('091b900c-4174-478c-900c-a0fe5a31a329'::uuid, 2200.00, 2500.00, 0.00,    2, NOW() - INTERVAL '25 days'),
  ('091b900c-4174-478c-900c-a0fe5a31a329'::uuid, 2500.00, 3100.00, 0.00,    3, NOW() - INTERVAL '20 days'),
  ('091b900c-4174-478c-900c-a0fe5a31a329'::uuid, 2800.00, 3100.00, 300.00,  3, NOW() - INTERVAL '15 days'),
  ('091b900c-4174-478c-900c-a0fe5a31a329'::uuid, 3200.00, 2500.00, 300.00,  4, NOW() - INTERVAL '10 days'),
  ('091b900c-4174-478c-900c-a0fe5a31a329'::uuid, 3500.00, 2500.00, 380.00,  4, NOW() - INTERVAL '5 days'),
  ('091b900c-4174-478c-900c-a0fe5a31a329'::uuid, 3800.00, 2500.00, 380.00,  4, NOW() - INTERVAL '1 day'),
  -- Steve: portfolio ~$500 to ~$2750
  ('550e8400-e29b-41d4-a716-446655440001'::uuid, 500.00,  350.00,  0.00,  1, NOW() - INTERVAL '20 days'),
  ('550e8400-e29b-41d4-a716-446655440001'::uuid, 1200.00, 2600.00, 0.00,  2, NOW() - INTERVAL '15 days'),
  ('550e8400-e29b-41d4-a716-446655440001'::uuid, 2000.00, 2600.00, 0.00,  2, NOW() - INTERVAL '10 days'),
  ('550e8400-e29b-41d4-a716-446655440001'::uuid, 2400.00, 2425.00, 75.00, 2, NOW() - INTERVAL '7 days'),
  ('550e8400-e29b-41d4-a716-446655440001'::uuid, 2600.00, 2425.00, 75.00, 2, NOW() - INTERVAL '3 days'),
  ('550e8400-e29b-41d4-a716-446655440001'::uuid, 2750.00, 2425.00, 75.00, 2, NOW() - INTERVAL '1 day'),
  -- Notch: buy-and-hold, ~$9000 to ~$11500
  ('550e8400-e29b-41d4-a716-446655440003'::uuid, 9000.00,  9000.00, 0.00, 2, NOW() - INTERVAL '25 days'),
  ('550e8400-e29b-41d4-a716-446655440003'::uuid, 9500.00,  9000.00, 0.00, 2, NOW() - INTERVAL '20 days'),
  ('550e8400-e29b-41d4-a716-446655440003'::uuid, 10000.00, 9000.00, 0.00, 2, NOW() - INTERVAL '15 days'),
  ('550e8400-e29b-41d4-a716-446655440003'::uuid, 10500.00, 9000.00, 0.00, 2, NOW() - INTERVAL '10 days'),
  ('550e8400-e29b-41d4-a716-446655440003'::uuid, 11000.00, 9000.00, 0.00, 2, NOW() - INTERVAL '5 days'),
  ('550e8400-e29b-41d4-a716-446655440003'::uuid, 11500.00, 9000.00, 0.00, 2, NOW() - INTERVAL '1 day'),
  -- Herobrine: active trader, ~$250 to ~$1000
  ('550e8400-e29b-41d4-a716-446655440004'::uuid, 350.00,  1450.00, 0.00,   2, NOW() - INTERVAL '18 days'),
  ('550e8400-e29b-41d4-a716-446655440004'::uuid, 800.00,  1450.00, 350.00, 1, NOW() - INTERVAL '10 days'),
  ('550e8400-e29b-41d4-a716-446655440004'::uuid, 900.00,  800.00,  430.00, 1, NOW() - INTERVAL '5 days'),
  ('550e8400-e29b-41d4-a716-446655440004'::uuid, 1000.00, 800.00,  430.00, 1, NOW() - INTERVAL '1 day')
) AS v(uuid, tv, ti, rpnl, tc, ts);

-- Treasury: total fees collected across all trades
UPDATE crypto_treasury SET total_collected = 237.25, total_burned = 20.43;

-- ============================================================================
-- SERVER FORCELOADS
-- ============================================================================

-- Solo players with forceloaded chunks on Rails 'n Sails (server_id = 1)
INSERT INTO server_forceload_player (server_id, player_uuid, synced_at) VALUES
  -- id 1: Notch, synced recently
  (1, '550e8400-e29b-41d4-a716-446655440003'::uuid, NOW() - INTERVAL '10 minutes'),
  -- id 2: Herobrine, synced a while ago
  (1, '550e8400-e29b-41d4-a716-446655440004'::uuid, NOW() - INTERVAL '2 hours'),
  -- id 3: Dream, synced recently
  (1, '550e8400-e29b-41d4-a716-446655440006'::uuid, NOW() - INTERVAL '30 minutes');

-- Parties that have (or had) opted in to shared forceloading
INSERT INTO server_forceload_party (server_id, party_id, party_name, member_count, opted_in, synced_at) VALUES
  -- id 1: active opted-in party
  (1, 'aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'Hermitcraft Friends', 3, true,  NOW() - INTERVAL '15 minutes'),
  -- id 2: party that has since opted out (kept for history/cleanup tests)
  (1, 'bbbbbbbb-0000-4000-8000-000000000002'::uuid, 'Dream SMP Alliance',  4, false, NOW() - INTERVAL '3 days');

-- Members of the opted-in party (party_id = 1)
INSERT INTO server_forceload_member (party_id, player_uuid) VALUES
  -- Mumbo
  (1, '550e8400-e29b-41d4-a716-446655440009'::uuid),
  -- Grian
  (1, '550e8400-e29b-41d4-a716-446655440010'::uuid),
  -- Scar
  (1, '550e8400-e29b-41d4-a716-446655440011'::uuid);

-- Forceloaded chunks. Exactly one of (player_id, party_id) is set per row.
INSERT INTO server_forceload_chunk (player_id, party_id, dimension, x, z, active) VALUES
  -- Notch (player_id = 1): base + farm in overworld, parked nether chunk
  (1, NULL, 'minecraft:overworld',   12,  -34, true),
  (1, NULL, 'minecraft:overworld',   13,  -34, true),
  (1, NULL, 'minecraft:the_nether',   1,    2, false),
  -- Herobrine (player_id = 2): single end chunk
  (2, NULL, 'minecraft:the_end',     -5,    7, true),
  -- Dream (player_id = 3): two overworld chunks
  (3, NULL, 'minecraft:overworld',  100,  200, true),
  (3, NULL, 'minecraft:overworld',  101,  200, true),
  -- Hermitcraft Friends party (party_id = 1): shared base across dimensions
  (NULL, 1, 'minecraft:overworld',    0,    0, true),
  (NULL, 1, 'minecraft:overworld',    1,    0, true),
  (NULL, 1, 'minecraft:the_nether',   0,    0, true),
  (NULL, 1, 'minecraft:the_end',     42,  -17, false);

-- ============================================================================
-- SERVER ALLIES (opac-fakeplayer)
-- ============================================================================

-- Fake-player party on Rails 'n Sails (server_id = 1). The fake party UUIDs are
-- synthetic and intentionally not in the player table — fake players aren't
-- real accounts.
INSERT INTO server_ally_fake_party (server_id, party_id, owner_uuid, owner_name, synced_at) VALUES
  (1,
   'cccccccc-0000-4000-8000-000000000001'::uuid,
   'cccccccc-0000-4000-8000-0000000000aa'::uuid,
   'Createrington', NOW() - INTERVAL '5 minutes');

-- Fake-player party members (bots, not real players)
INSERT INTO server_ally_fake_party_member (fake_party_id, player_uuid) VALUES
  (1, 'cccccccc-0000-4000-8000-0000000000aa'::uuid),
  (1, 'cccccccc-0000-4000-8000-0000000000bb'::uuid),
  (1, 'cccccccc-0000-4000-8000-0000000000cc'::uuid);

-- Allied real-player parties. The party_id matches the Hermitcraft Friends
-- party from server_forceload_party so the admin UI can JOIN to its member
-- roster.
INSERT INTO server_ally_party (server_id, party_id, allied_at, synced_at) VALUES
  (1, 'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
      NOW() - INTERVAL '2 days', NOW() - INTERVAL '5 minutes');

-- Qualified players. is_pending=false → currently in an allied party.
-- is_pending=true → met the trigger but not in any allied party yet.
INSERT INTO server_ally_qualified_player (server_id, player_uuid, qualified_at, is_pending, synced_at) VALUES
  -- Mumbo (member of allied Hermitcraft Friends party)
  (1, '550e8400-e29b-41d4-a716-446655440009'::uuid, NOW() - INTERVAL '2 days',  false, NOW() - INTERVAL '5 minutes'),
  -- Grian (member of allied Hermitcraft Friends party)
  (1, '550e8400-e29b-41d4-a716-446655440010'::uuid, NOW() - INTERVAL '2 days',  false, NOW() - INTERVAL '5 minutes'),
  -- Notch (qualified solo, no party)
  (1, '550e8400-e29b-41d4-a716-446655440003'::uuid, NOW() - INTERVAL '1 day',   true,  NOW() - INTERVAL '5 minutes'),
  -- Herobrine (qualified solo, no party)
  (1, '550e8400-e29b-41d4-a716-446655440004'::uuid, NOW() - INTERVAL '6 hours', true,  NOW() - INTERVAL '5 minutes');

-- ============================================================================
-- VOTING SYSTEM
-- ============================================================================

INSERT INTO feature_flag (name, enabled, description) VALUES
  ('workshop', true, 'Workshop tab');

-- Modpacks:
--   1 = Season 3 (in assembly, not published on CurseForge yet, nothing live)
--   2 = Season 4 ideas (draft workshop scratchpad)
--   3 = Season 2 legacy (finished pack, members seeded as live)
INSERT INTO modpack (name, description, curseforge_project_id, server_id, created_by, created_at) VALUES
  ('Createrington Season 3', 'The season 3 modpack, assembled from workshop suggestions.', NULL, 1, '818819241666281503', NOW() - INTERVAL '21 days'),
  ('Createrington Season 4 Ideas', 'Early scratchpad for season 4.', NULL, NULL, '818819241666281503', NOW() - INTERVAL '2 days'),
  ('Createrington Season 2', 'The retired season 2 modpack.', NULL, NULL, '818819241666281503', NOW() - INTERVAL '400 days');

-- Workshops covering every lifecycle status:
--   1 = open (season 3 main round, feeds modpack 1)
--   2 = closed (season 3 QoL round, also feeds modpack 1)
--   3 = draft (season 4 brainstorm, admin-only, feeds modpack 2)
--   4 = archived (season 2, feeds modpack 3)
INSERT INTO workshop (name, slug, description, status, game_version, mod_loader_type, class_id, base_modpack_project_id, modpack_id, max_mods_per_user, discord_forum_channel_id, created_by, created_at) VALUES
  ('Createrington Season 3 Modpack', 'season-3-modpack',
   'Suggest and upvote mods for the season 3 modpack.',
   'open', '1.21.1', 6, 6, NULL, 1, 5, '1483504809859481712', '818819241666281503', NOW() - INTERVAL '21 days'),
  ('Season 3 QoL Round', 'season-3-qol-round',
   'A short round for quality of life mods, already reviewed.',
   'closed', '1.21.1', 6, 6, NULL, 1, 3, NULL, '818819241666281503', NOW() - INTERVAL '75 days'),
  ('Season 4 Brainstorm', 'season-4-brainstorm',
   'Very early ideas for next season. Not visible to players yet.',
   'draft', '1.21.1', 6, 6, NULL, 2, 5, NULL, '818819241666281503', NOW() - INTERVAL '2 days'),
  ('Createrington Season 2 Modpack', 'season-2-modpack',
   'The season 2 voting round, kept for the archive.',
   'archived', '1.20.1', 1, 6, NULL, 3, 5, NULL, '818819241666281503', NOW() - INTERVAL '400 days');

-- CurseForge metadata snapshots (real project IDs, approximate stats)
INSERT INTO curseforge_project (id, class_id, slug, name, summary, thumbnail_url, website_url, primary_author, download_count, date_modified, date_released, allow_mod_distribution) VALUES
  (328085, 6, 'create', 'Create', 'Aesthetic Technology that empowers the Player',
   'https://media.forgecdn.net/avatars/thumbnails/1065/184/256/256/638598725500886388.png',
   'https://www.curseforge.com/minecraft/mc-mods/create', 'simibubi', 200779345, NOW() - INTERVAL '90 days', NOW() - INTERVAL '90 days', true),
  (238222, 6, 'jei', 'Just Enough Items (JEI)', 'JEI is an item and recipe viewing mod', NULL,
   'https://www.curseforge.com/minecraft/mc-mods/jei', 'mezz', 320000000, NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days', true),
  (324717, 6, 'jade', 'Jade', 'Shows information about what you are looking at', NULL,
   'https://www.curseforge.com/minecraft/mc-mods/jade', 'Snownee', 90000000, NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days', true),
  (245755, 6, 'waystones', 'Waystones', 'Teleport back to activated waystones, for players and pearls alike', NULL,
   'https://www.curseforge.com/minecraft/mc-mods/waystones', 'BlayTheNinth', 250000000, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days', true),
  (531761, 6, 'balm', 'Balm', 'Abstraction layer for multiplatform mods', NULL,
   'https://www.curseforge.com/minecraft/mc-mods/balm', 'BlayTheNinth', 180000000, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days', true),
  (398521, 6, 'farmers-delight', 'Farmer''s Delight', 'A cozy expansion to farming and cooking', NULL,
   'https://www.curseforge.com/minecraft/mc-mods/farmers-delight', 'vectorwing', 120000000, NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days', true),
  (422301, 6, 'sophisticated-backpacks', 'Sophisticated Backpacks', 'Backpacks with lots of upgrades and customization', NULL,
   'https://www.curseforge.com/minecraft/mc-mods/sophisticated-backpacks', 'P3pp3rF1y', 95000000, NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days', true),
  (420905, 6, 'sophisticated-core', 'Sophisticated Core', 'Shared library for the Sophisticated mods', NULL,
   'https://www.curseforge.com/minecraft/mc-mods/sophisticated-core', 'P3pp3rF1y', 100000000, NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days', true),
  (228756, 6, 'iron-chests', 'Iron Chests', 'Chests with larger sizes in a progression', NULL,
   'https://www.curseforge.com/minecraft/mc-mods/iron-chests', 'ProgWML6', 150000000, NOW() - INTERVAL '120 days', NOW() - INTERVAL '120 days', true),
  (32274, 6, 'journeymap', 'JourneyMap', 'Real-time mapping in-game or in a web browser', NULL,
   'https://www.curseforge.com/minecraft/mc-mods/journeymap', 'techbrew', 310000000, NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days', true),
  (248787, 6, 'appleskin', 'AppleSkin', 'Food and hunger related HUD improvements', NULL,
   'https://www.curseforge.com/minecraft/mc-mods/appleskin', 'squeek502', 280000000, NOW() - INTERVAL '60 days', NOW() - INTERVAL '60 days', true),
  (60089, 6, 'mouse-tweaks', 'Mouse Tweaks', 'Enhances inventory management with mouse gestures', NULL,
   'https://www.curseforge.com/minecraft/mc-mods/mouse-tweaks', 'YaLTeR', 220000000, NOW() - INTERVAL '200 days', NOW() - INTERVAL '200 days', true),
  (256717, 6, 'clumps', 'Clumps', 'Groups XP orbs together to reduce lag', NULL,
   'https://www.curseforge.com/minecraft/mc-mods/clumps', 'Jaredlll08', 260000000, NOW() - INTERVAL '35 days', NOW() - INTERVAL '35 days', true),
  (412082, 6, 'supplementaries', 'Supplementaries', 'Vanilla-friendly decoration and functional blocks', NULL,
   'https://www.curseforge.com/minecraft/mc-mods/supplementaries', 'MehVahdJukaar', 85000000, NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days', true),
  (688231, 6, 'create-steam-n-rails', 'Create: Steam ''n'' Rails', 'Expands Create with more trains and rails', NULL,
   'https://www.curseforge.com/minecraft/mc-mods/create-steam-n-rails', 'mattentosh', 40000000, NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days', true),
  (250398, 6, 'controlling', 'Controlling', 'Adds a search bar to the key bindings menu', NULL,
   'https://www.curseforge.com/minecraft/mc-mods/controlling', 'Jaredlll08', 190000000, NOW() - INTERVAL '80 days', NOW() - INTERVAL '80 days', true),
  (223852, 6, 'storage-drawers', 'Storage Drawers', 'Compact drawers for bulk item storage', NULL,
   'https://www.curseforge.com/minecraft/mc-mods/storage-drawers', 'Texelsaur', 130000000, NOW() - INTERVAL '100 days', NOW() - INTERVAL '100 days', true);

-- Workshop 1 (open): pending race in progress. workshop_mod ids 1-8
INSERT INTO workshop_mod (workshop_id, curseforge_project_id, submitted_by, status, note, created_at) VALUES
  (1, 238222, '123456789012345686', 'pending', 'Recipe viewer, basically mandatory', NOW() - INTERVAL '9 days'),
  (1, 324717, '123456789012345686', 'pending', 'Shows what block you are looking at', NOW() - INTERVAL '9 days'),
  (1, 245755, '123456789012345687', 'pending', 'Fast travel that still feels earned', NOW() - INTERVAL '8 days'),
  (1, 412082, '123456789012345688', 'pending', 'Decor and QoL in one mod, fits the vanilla look', NOW() - INTERVAL '6 days'),
  (1, 60089,  '123456789012345678', 'pending', NULL, NOW() - INTERVAL '5 days'),
  (1, 256717, '123456789012345679', 'pending', 'XP orbs merge into one, way less lag on farms', NOW() - INTERVAL '4 days'),
  (1, 228756, '123456789012345684', 'pending', 'More storage tiers for early game', NOW() - INTERVAL '2 days'),
  (1, 688231, '123456789012345687', 'pending', 'Trains deserve even more love', NOW() - INTERVAL '1 day');

-- Workshop 1 reviewed suggestions. ids 9-12
INSERT INTO workshop_mod (workshop_id, curseforge_project_id, submitted_by, status, note, reviewed_by, reviewed_at, reject_reason, reject_note, file_id, file_name, file_release_type, created_at) VALUES
  (1, 398521, '123456789012345685', 'next_update', 'Cooking and farming, huge for the community builds', '818819241666281503', NOW() - INTERVAL '12 days', NULL, NULL, 5915749, 'FarmersDelight-1.21.1-1.2.8.jar', 1, NOW() - INTERVAL '18 days'),
  (1, 422301, '123456789012345686', 'next_update', 'Best backpack mod by far', '547450242090532874', NOW() - INTERVAL '10 days', NULL, NULL, 5625757, 'sophisticatedbackpacks-1.21.1-3.20.5.jar', 1, NOW() - INTERVAL '16 days'),
  (1, 32274,  '123456789012345689', 'rejected', 'Best map mod there is', '818819241666281503', NOW() - INTERVAL '11 days', 'covered_by_other_mod', 'Jade plus the vanilla maps cover this already', NULL, NULL, NULL, NOW() - INTERVAL '15 days'),
  (1, 248787, '123456789012345683', 'rejected', 'Everyone always installs this', '818819241666281503', NOW() - INTERVAL '7 days', 'on_hold', 'Waiting for the 1.21.1 build to stabilize', NULL, NULL, NULL, NOW() - INTERVAL '13 days');

-- Workshop 2 (closed QoL round): everything reviewed. ids 13-14
INSERT INTO workshop_mod (workshop_id, curseforge_project_id, submitted_by, status, note, reviewed_by, reviewed_at, reject_reason, reject_note, file_id, file_name, file_release_type, created_at) VALUES
  (2, 250398, '123456789012345678', 'next_update', 'Searchable keybinds, zero downside', '818819241666281503', NOW() - INTERVAL '62 days', NULL, NULL, 5623160, 'Controlling-neoforge-1.21.1-19.0.5.jar', 1, NOW() - INTERVAL '70 days'),
  (2, 223852, '123456789012345679', 'rejected', 'Bulk storage for the shopping district', '547450242090532874', NOW() - INTERVAL '60 days', 'not_a_good_fit', 'Sophisticated Backpacks covers the storage needs this round', NULL, NULL, NULL, NOW() - INTERVAL '68 days');

-- Workshop 4 (archived season 2): shipped in the season 2 pack. ids 15-16
INSERT INTO workshop_mod (workshop_id, curseforge_project_id, submitted_by, status, note, reviewed_by, reviewed_at, file_id, file_name, file_release_type, created_at) VALUES
  (4, 245755, '123456789012345687', 'in_pack', 'Waystones carried season 1, bring it back', '818819241666281503', NOW() - INTERVAL '390 days', 4959986, 'waystones-forge-1.20.1-14.1.3.jar', 1, NOW() - INTERVAL '395 days'),
  (4, 228756, '123456789012345682', 'in_pack', NULL, '818819241666281503', NOW() - INTERVAL '388 days', 4926885, 'ironchest-1.20.1-14.4.4.jar', 1, NOW() - INTERVAL '394 days');

-- Workshop 1 again: a suggestion the team is currently testing. id 17
INSERT INTO workshop_mod (workshop_id, curseforge_project_id, submitted_by, status, note, reviewed_by, reviewed_at, file_id, file_name, file_release_type, created_at) VALUES
  (1, 223852, '123456789012345682', 'testing', 'Drawers for the storage hall build', '818819241666281503', NOW() - INTERVAL '1 day', 5788676, 'storagedrawers-neoforge-1.21.1-13.9.1.jar', 1, NOW() - INTERVAL '5 days');

-- Admin adds: ordinary suggestions credited to the admin who added them, which
-- start approved and walk the rest of the pipeline. ids 18-19
INSERT INTO workshop_mod (workshop_id, curseforge_project_id, submitted_by, status, note, reviewed_by, reviewed_at, file_id, file_name, file_release_type, created_at) VALUES
  (1, 328085, '818819241666281503', 'next_update', 'The season theme, non negotiable', '818819241666281503', NOW() - INTERVAL '20 days', 7963363, 'create-1.21.1-6.0.10.jar', 1, NOW() - INTERVAL '20 days'),
  (4, 238222, '818819241666281503', 'in_pack', NULL, '818819241666281503', NOW() - INTERVAL '392 days', 4712868, 'jei-1.20.1-forge-15.20.0.106.jar', 1, NOW() - INTERVAL '392 days');

-- Upvotes. Every player suggestion carries its submitter's own vote (added
-- automatically on suggest); self-votes do not count against the budget.
INSERT INTO workshop_mod_upvote (workshop_mod_id, discord_id) VALUES
  -- 1 JEI (Mumbo): self + Grian
  (1, '123456789012345686'), (1, '123456789012345687'),
  -- 2 Jade (Mumbo): self only
  (2, '123456789012345686'),
  -- 3 Waystones (Grian): the current front runner
  (3, '123456789012345687'), (3, '123456789012345678'), (3, '123456789012345679'),
  (3, '123456789012345686'), (3, '123456789012345685'), (3, '123456789012345683'),
  (3, '123456789012345688'),
  -- 4 Supplementaries (Scar)
  (4, '123456789012345688'), (4, '123456789012345687'), (4, '123456789012345678'),
  -- 5 Mouse Tweaks (Steve): self only
  (5, '123456789012345678'),
  -- 6 Clumps (Alex)
  (6, '123456789012345679'), (6, '123456789012345681'),
  -- 7 Iron Chests (Technoblade)
  (7, '123456789012345684'), (7, '123456789012345682'),
  -- 8 Steam 'n' Rails (Grian): late entry closing in
  (8, '123456789012345687'), (8, '123456789012345686'), (8, '123456789012345688'),
  (8, '123456789012345689'), (8, '123456789012345678'),
  -- 9 Farmer's Delight (coming next update, free likes)
  (9, '123456789012345685'), (9, '123456789012345678'), (9, '123456789012345679'),
  (9, '123456789012345687'), (9, '123456789012345682'),
  -- 10 Sophisticated Backpacks (coming next update)
  (10, '123456789012345686'), (10, '123456789012345687'), (10, '123456789012345685'),
  -- 11 JourneyMap (rejected)
  (11, '123456789012345689'),
  -- 12 AppleSkin (rejected)
  (12, '123456789012345683'), (12, '123456789012345681'),
  -- 13 Controlling (workshop 2, coming next update)
  (13, '123456789012345678'), (13, '123456789012345686'), (13, '123456789012345687'),
  -- 14 Storage Drawers (workshop 2, rejected)
  (14, '123456789012345679'), (14, '123456789012345681'),
  -- 15 Waystones (workshop 4, shipped)
  (15, '123456789012345687'), (15, '123456789012345686'), (15, '123456789012345688'),
  -- 16 Iron Chests (workshop 4, shipped)
  (16, '123456789012345682'), (16, '123456789012345678'),
  -- 17 Storage Drawers (in testing)
  (17, '123456789012345682'), (17, '123456789012345685'),
  -- 18 Create, 19 JEI (admin adds): self only
  (18, '818819241666281503'), (19, '818819241666281503');

-- Resolved dependency edges (relation_type: 3 = required, 2 = optional).
-- AppleSkin as an optional dep is rejected in workshop 1, which lights up the
-- rejected badge in the dependency report.
INSERT INTO workshop_project_dependency (workshop_id, curseforge_project_id, depends_on_project_id, relation_type) VALUES
  (1, 422301, 420905, 3),
  (1, 245755, 531761, 3),
  (1, 688231, 328085, 3),
  (1, 398521, 248787, 2);

-- The season 3 pack has never been published, so it has no membership at all.
-- What is coming lives on the suggestions themselves, at next_update.

-- Season 2 pack membership: published, so every row carries live state. Rows
-- only ever come from a manifest, which is why they are all live here.
INSERT INTO modpack_mod (modpack_id, curseforge_project_id, origin, workshop_mod_id, added_by, file_id, file_name, file_release_type, live_at, live_in_version) VALUES
  (3, 238222, 'suggestion', 19, NULL, 4712868, 'jei-1.20.1-forge-15.20.0.106.jar', 1, NOW() - INTERVAL '380 days', '2.4.1'),
  (3, 245755, 'suggestion', 15, NULL, 4959986, 'waystones-forge-1.20.1-14.1.3.jar', 1, NOW() - INTERVAL '380 days', '2.4.1'),
  (3, 228756, 'suggestion', 16, NULL, 4926885, 'ironchest-1.20.1-14.4.4.jar', 1, NOW() - INTERVAL '380 days', '2.4.1');

-- Season 2 release history: two published builds, so 2.4.1 has something to
-- diff against. Rows are frozen copies, which is why 2.4.0 still names the JEI
-- file it shipped even though 2.4.1 moved on.
INSERT INTO modpack_release (id, modpack_id, curseforge_file_id, version, display_name, minecraft_version, mod_loader, mod_count, published_at, created_at) VALUES
  (1, 3, 5100001, '2.4.0', 'Createrington Season 2-2.4.0', '1.20.1', 'forge-47.2.0', 3, NOW() - INTERVAL '400 days', NOW() - INTERVAL '400 days'),
  (2, 3, 5100002, '2.4.1', 'Createrington Season 2-2.4.1', '1.20.1', 'forge-47.2.0', 3, NOW() - INTERVAL '380 days', NOW() - INTERVAL '380 days');
SELECT setval('modpack_release_id_seq', 2, true);

INSERT INTO modpack_release_mod (release_id, curseforge_project_id, file_id, file_name, display_name, file_release_type, file_date) VALUES
  (1, 238222, 4700001, 'jei-1.20.1-forge-15.19.0.100.jar', 'JEI 15.19.0.100', 1, NOW() - INTERVAL '405 days'),
  (1, 245755, 4959986, 'waystones-forge-1.20.1-14.1.3.jar', 'Waystones 14.1.3', 1, NOW() - INTERVAL '405 days'),
  (1, 248787, 4800001, 'appleskin-forge-mc1.20.1-2.5.1.jar', 'AppleSkin 2.5.1', 1, NOW() - INTERVAL '405 days'),
  (2, 238222, 4712868, 'jei-1.20.1-forge-15.20.0.106.jar', 'JEI 15.20.0.106', 1, NOW() - INTERVAL '385 days'),
  (2, 245755, 4959986, 'waystones-forge-1.20.1-14.1.3.jar', 'Waystones 14.1.3', 1, NOW() - INTERVAL '405 days'),
  (2, 228756, 4926885, 'ironchest-1.20.1-14.4.4.jar', 'Iron Chests 14.4.4', 1, NOW() - INTERVAL '385 days');

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


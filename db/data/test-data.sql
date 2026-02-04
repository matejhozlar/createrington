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

-- Reset sequences
ALTER SEQUENCE server_id_seq RESTART WITH 1;
ALTER SEQUENCE player_id_seq RESTART WITH 1;
ALTER SEQUENCE player_session_id_seq RESTART WITH 1;
ALTER SEQUENCE waitlist_entry_id_seq RESTART WITH 1;
ALTER SEQUENCE discord_guild_member_join_join_number_seq RESTART WITH 1;
ALTER SEQUENCE admin_log_action_id_seq RESTART WITH 1;
ALTER SEQUENCE ticket_id_seq RESTART WITH 1;
ALTER SEQUENCE ticket_action_id_seq RESTART WITH 1;

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

INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('091b900c-4174-478c-900c-a0fe5a31a329'::uuid, 'saunhardy', '818819241666281503', false, '2024-04-01 13:07:30.081'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('80e97d7b-d98d-4261-b297-311758b62a1a'::uuid, 'CamKing2007', '860820264128086026', false, '2025-04-13 10:17:02.653'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('69bc13fe-1972-480e-8075-c88340d7b7da'::uuid, 'imahomen', '1259021182485925949', false, '2025-04-13 15:16:34.253'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('13fe4708-65fc-4ea0-9fb3-55b598b41e5e'::uuid, 'Neelus1', '236124332160581632', false, '2025-04-13 18:31:53.721'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('d8d729c4-8154-4891-ae21-7fe5fb209e6f'::uuid, 'MonTue23', '803257566670225448', false, '2025-04-13 23:51:51.202'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
INSERT INTO public.player ("minecraft_uuid", "minecraft_username", "discord_id", "online", "created_at", "current_server_id") VALUES ('25f73ab5-39e3-4bf7-bd52-9ad7407fdb3e'::uuid, 'Stratos65', '389456401715560452', false, '2025-04-15 08:47:19.629'::timestamptz, NULL) ON CONFLICT (minecraft_uuid) DO UPDATE SET "minecraft_username" = EXCLUDED."minecraft_username", "discord_id" = EXCLUDED."discord_id", "online" = EXCLUDED."online", "created_at" = EXCLUDED."created_at", "current_server_id" = EXCLUDED."current_server_id";
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

INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('091b900c-4174-478c-900c-a0fe5a31a329'::uuid, 541242, '2025-12-13 13:42:13.500122'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('80e97d7b-d98d-4261-b297-311758b62a1a'::uuid, 225000, '2025-11-08 19:47:53.04995'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('69bc13fe-1972-480e-8075-c88340d7b7da'::uuid, 2494411, '2025-11-26 23:34:59.569792'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('13fe4708-65fc-4ea0-9fb3-55b598b41e5e'::uuid, 4301000, '2025-11-09 14:05:53.340538'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('d8d729c4-8154-4891-ae21-7fe5fb209e6f'::uuid, 993354, '2025-11-12 21:17:54.489345'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
INSERT INTO public.player_balance ("minecraft_uuid", "balance", "updated_at") VALUES ('25f73ab5-39e3-4bf7-bd52-9ad7407fdb3e'::uuid, 891899, '2025-12-10 22:37:12.586277'::timestamptz) ON CONFLICT (minecraft_uuid) DO UPDATE SET "balance" = EXCLUDED."balance", "updated_at" = EXCLUDED."updated_at";
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

-- More WAITLIST ENTRIES (varied states)
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
-- ======================================================================
-- COMPLETED (fully onboarded)
-- ======================================================================
('mumbo@example.com', 'mumbojumbo', '123456789012345686', 'token_mumbo_019', NOW() - INTERVAL '52 days', '111111111111111201', 'completed', true, true, true, true, NOW() - INTERVAL '51 days', '818819241666281503'),
('grian@example.com', 'grian', '123456789012345687', 'token_grian_020', NOW() - INTERVAL '47 days', '111111111111111202', 'completed', true, true, true, true, NOW() - INTERVAL '46 days', '547450242090532874'),
('philza@example.com', 'philza', '123456789012345685', 'token_philza_021', NOW() - INTERVAL '57 days', '111111111111111203', 'completed', true, true, true, true, NOW() - INTERVAL '56 days', '99318080374607872'),

-- ======================================================================
-- ACCEPTED (in progress)
-- ======================================================================
('scar@example.com', 'goodtimeswithscar', '123456789012345688', 'token_scar_022', NOW() - INTERVAL '41 days', '111111111111111204', 'accepted', true, true, true, false, NOW() - INTERVAL '40 days', '818819241666281503'),
('iskall@example.com', 'iskall85', '123456789012345689', 'token_iskall_023', NOW() - INTERVAL '36 days', '111111111111111205', 'accepted', true, true, false, false, NOW() - INTERVAL '35 days', '547450242090532874'),
('dream@example.com', 'dream', '123456789012345683', 'token_dream_024', NOW() - INTERVAL '8 days', '111111111111111206', 'accepted', true, false, false, false, NOW() - INTERVAL '7 days', '99318080374607872'),

-- Accepted but *hasn't joined Discord yet* (edge case)
('invite_sent@example.com', 'invite_sent_user', NULL, 'token_invite_025', NOW() - INTERVAL '20 hours', '111111111111111207', 'accepted', false, false, false, false, NOW() - INTERVAL '19 hours', '818819241666281503'),

-- ======================================================================
-- PENDING (varied progress)
-- ======================================================================
-- Pending, not joined discord, no discord_id yet (typical early state)
('waiter1@example.com', 'waiter_user1', NULL, 'token_wait_026', NOW() - INTERVAL '12 hours', '111111111111111208', 'pending', false, false, false, false, NULL, NULL),
('waiter2@example.com', 'waiter_user2', NULL, 'token_wait_027', NOW() - INTERVAL '9 hours', '111111111111111209', 'pending', false, false, false, false, NULL, NULL),

-- Pending but joined Discord (discord_id known), not verified yet
('joined_discord_only@example.com', 'joined_discord_only', '223456789012345690', 'token_wait_028', NOW() - INTERVAL '6 hours', '111111111111111210', 'pending', true, false, false, false, NULL, NULL),

-- Pending, joined Discord + verified, but not registered (stuck on registration)
('verified_not_registered@example.com', 'verified_not_registered', '223456789012345691', 'token_wait_029', NOW() - INTERVAL '5 hours', '111111111111111211', 'pending', true, true, false, false, NULL, NULL),

-- Pending, registered but not joined MC yet (stuck before first join)
('registered_not_joined_mc@example.com', 'registered_not_joined_mc', '223456789012345692', 'token_wait_030', NOW() - INTERVAL '4 hours', '111111111111111212', 'pending', true, true, true, false, NULL, NULL),

-- Pending with discord_id set but still not joined_discord (edge/inconsistent but useful for testing)
('discord_id_but_not_joined@example.com', 'discord_id_but_not_joined', '223456789012345693', 'token_wait_031', NOW() - INTERVAL '3 hours', '111111111111111213', 'pending', false, false, false, false, NULL, NULL),

-- ======================================================================
-- DECLINED (with/without discord_id)
-- ======================================================================
('declined2@example.com', 'declined_user2', NULL, 'token_decl_032', NOW() - INTERVAL '18 days', '111111111111111214', 'declined', false, false, false, false, NULL, NULL),

-- Declined after joining Discord (discord_id known)
('declined_after_join@example.com', 'declined_after_join', '223456789012345694', 'token_decl_033', NOW() - INTERVAL '11 days', '111111111111111215', 'declined', true, false, false, false, NULL, NULL),

-- Declined after verification (rare but good for edge testing)
('declined_after_verify@example.com', 'declined_after_verify', '223456789012345695', 'token_decl_034', NOW() - INTERVAL '14 days', '111111111111111216', 'declined', true, true, false, false, NULL, NULL);

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
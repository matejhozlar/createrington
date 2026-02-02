--
-- PostgreSQL database dump
--

-- Dumped from database version 15.4
-- Dumped by pg_dump version 15.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: strike_classification; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.strike_classification AS ENUM (
    'pvp',
    'theft',
    'griefing',
    'laggy_machines',
    'inappropriate_chat',
    'harassment',
    'exploiting',
    'rule_violation',
    'other'
);


--
-- Name: ticket_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ticket_status AS ENUM (
    'open',
    'closed',
    'deleted'
);


--
-- Name: ticket_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ticket_type AS ENUM (
    'general',
    'report'
);


--
-- Name: cleanup_old_waitlist_entries(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_waitlist_entries() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM waitlist_entry
    WHERE submitted_at < NOW() - INTERVAL '30 days';
END;
$$;


--
-- Name: sync_player_online_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_player_online_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.session_end IS NULL THEN
        -- Player started a session
        UPDATE player
        SET online = true,
            last_seen = NOW(),
            current_server_id = NEW.server_id
        WHERE minecraft_uuid = NEW.player_minecraft_uuid;
        
    ELSIF TG_OP = 'UPDATE' AND OLD.session_end IS NULL AND NEW.session_end IS NOT NULL THEN
        -- Player ended a session - check if they're still online elsewhere
        IF NOT EXISTS (
            SELECT 1 FROM player_session
            WHERE player_minecraft_uuid = NEW.player_minecraft_uuid
            AND session_end IS NULL
            AND id != NEW.id
        ) THEN
            UPDATE player
            SET online = false,
                last_seen = NEW.session_end,
                current_server_id = NULL
            WHERE minecraft_uuid = NEW.player_minecraft_uuid;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: update_playtime_aggregates(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_playtime_aggregates() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_play_date DATE;
    v_hour_start TIMESTAMP WITH TIME ZONE;
    v_hour_end TIMESTAMP WITH TIME ZONE;
    v_current_hour TIMESTAMP WITH TIME ZONE;
    v_seconds_in_hour BIGINT;
BEGIN
    -- Only process when session ends
    IF NEW.session_end IS NULL THEN
        RETURN NEW;
    END IF;

    -- Update daily aggregate
    v_play_date := NEW.session_start::DATE;
    
    -- Handle sessions that span multiple days
    WHILE v_play_date <= NEW.session_end::DATE LOOP
        INSERT INTO player_playtime_daily (player_minecraft_uuid, server_id, play_date, seconds_played)
        VALUES (
            NEW.player_minecraft_uuid,
            NEW.server_id,
            v_play_date,
            EXTRACT(EPOCH FROM (
                LEAST(NEW.session_end, (v_play_date + INTERVAL '1 day')::TIMESTAMP WITH TIME ZONE) -
                GREATEST(NEW.session_start, v_play_date::TIMESTAMP WITH TIME ZONE)
            ))::BIGINT
        )
        ON CONFLICT (player_minecraft_uuid, server_id, play_date)
        DO UPDATE SET seconds_played = player_playtime_daily.seconds_played + EXCLUDED.seconds_played;
        
        v_play_date := v_play_date + 1;
    END LOOP;

    -- Update hourly aggregates
    v_current_hour := DATE_TRUNC('hour', NEW.session_start);
    
    WHILE v_current_hour < NEW.session_end LOOP
        v_hour_start := GREATEST(NEW.session_start, v_current_hour);
        v_hour_end := LEAST(NEW.session_end, v_current_hour + INTERVAL '1 hour');
        v_seconds_in_hour := EXTRACT(EPOCH FROM (v_hour_end - v_hour_start))::BIGINT;
        
        INSERT INTO player_playtime_hourly (player_minecraft_uuid, server_id, play_hour, seconds_played)
        VALUES (NEW.player_minecraft_uuid, NEW.server_id, v_current_hour, v_seconds_in_hour)
        ON CONFLICT (player_minecraft_uuid, server_id, play_hour)
        DO UPDATE SET seconds_played = player_playtime_hourly.seconds_played + EXCLUDED.seconds_played;
        
        v_current_hour := v_current_hour + INTERVAL '1 hour';
    END LOOP;

    -- Update summary
    INSERT INTO player_playtime_summary (
        player_minecraft_uuid, 
        server_id, 
        total_seconds, 
        total_sessions,
        first_seen,
        last_seen
    )
    VALUES (
        NEW.player_minecraft_uuid,
        NEW.server_id,
        NEW.seconds_played,
        1,
        NEW.session_start,
        NEW.session_end
    )
    ON CONFLICT (player_minecraft_uuid, server_id)
    DO UPDATE SET
        total_seconds = player_playtime_summary.total_seconds + NEW.seconds_played,
        total_sessions = player_playtime_summary.total_sessions + 1,
        first_seen = LEAST(player_playtime_summary.first_seen, NEW.session_start),
        last_seen = GREATEST(player_playtime_summary.last_seen, NEW.session_end),
        updated_at = NOW();

    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin (
    discord_id text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    vanished boolean DEFAULT false
);


--
-- Name: admin_log_action; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_log_action (
    id integer NOT NULL,
    admin_discord_id text NOT NULL,
    admin_discord_username text NOT NULL,
    action_type text NOT NULL,
    target_player_uuid uuid NOT NULL,
    target_player_name text NOT NULL,
    table_name text NOT NULL,
    field_name text NOT NULL,
    old_value text,
    new_value text,
    reason text,
    server_id integer,
    performed_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb
);


--
-- Name: admin_log_action_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_log_action_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admin_log_action_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admin_log_action_id_seq OWNED BY public.admin_log_action.id;


--
-- Name: server; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.server (
    id integer NOT NULL,
    name text NOT NULL,
    identifier text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_log_action_readable; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.admin_log_action_readable AS
 SELECT al.id,
    al.admin_discord_username,
    al.action_type,
    al.target_player_name,
    al.table_name,
    al.field_name,
    al.old_value,
    al.new_value,
    al.reason,
    s.name AS server_name,
    al.performed_at,
    al.metadata
   FROM (public.admin_log_action al
     LEFT JOIN public.server s ON ((al.server_id = s.id)))
  ORDER BY al.performed_at DESC;


--
-- Name: discord_guild_member_join; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discord_guild_member_join (
    join_number integer NOT NULL,
    user_id character varying(32) NOT NULL,
    username character varying(32) NOT NULL,
    joined_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TABLE discord_guild_member_join; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.discord_guild_member_join IS 'Tracks guild member join order with persistent sequential numbers';


--
-- Name: COLUMN discord_guild_member_join.join_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.discord_guild_member_join.join_number IS 'Unique sequential number assigned to each member (shown in welcome image)';


--
-- Name: COLUMN discord_guild_member_join.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.discord_guild_member_join.user_id IS 'Discord user snowflake ID';


--
-- Name: COLUMN discord_guild_member_join.username; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.discord_guild_member_join.username IS 'Username at the time of joining (for historical reference)';


--
-- Name: COLUMN discord_guild_member_join.joined_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.discord_guild_member_join.joined_at IS 'Timestamp when the member joined the guild';


--
-- Name: discord_guild_member_join_join_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.discord_guild_member_join_join_number_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: discord_guild_member_join_join_number_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.discord_guild_member_join_join_number_seq OWNED BY public.discord_guild_member_join.join_number;


--
-- Name: discord_guild_member_leave; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discord_guild_member_leave (
    id integer NOT NULL,
    discord_id text NOT NULL,
    minecraft_uuid uuid NOT NULL,
    minecraft_username text NOT NULL,
    departed_at timestamp with time zone DEFAULT now() NOT NULL,
    notification_message_id text,
    deleted_at timestamp with time zone
);


--
-- Name: discord_guild_member_leave_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.discord_guild_member_leave_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: discord_guild_member_leave_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.discord_guild_member_leave_id_seq OWNED BY public.discord_guild_member_leave.id;


--
-- Name: leaderboard_message; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leaderboard_message (
    id integer NOT NULL,
    leaderboard_type character varying(50) NOT NULL,
    channel_id text NOT NULL,
    message_id text NOT NULL,
    last_refreshed timestamp with time zone DEFAULT now(),
    last_manual_refresh timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: leaderboard_message_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leaderboard_message_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leaderboard_message_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leaderboard_message_id_seq OWNED BY public.leaderboard_message.id;


--
-- Name: player; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player (
    id integer NOT NULL,
    minecraft_uuid uuid NOT NULL,
    minecraft_username text NOT NULL,
    discord_id text NOT NULL,
    online boolean DEFAULT false NOT NULL,
    last_seen timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    current_server_id integer
);


--
-- Name: player_balance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_balance (
    minecraft_uuid uuid NOT NULL,
    balance bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_balance_non_negative CHECK ((balance >= 0))
);


--
-- Name: TABLE player_balance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.player_balance IS 'Player balance with 3 decimal precision';


--
-- Name: COLUMN player_balance.balance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.player_balance.balance IS 'Balance in smallest unit (3 decimal places). Divide by 1,000 for display. Example: 1000 = 1.000, 200 = 0.200';


--
-- Name: player_balance_transaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_balance_transaction (
    id integer NOT NULL,
    player_minecraft_uuid uuid NOT NULL,
    amount bigint NOT NULL,
    balance_before bigint NOT NULL,
    balance_after bigint NOT NULL,
    transaction_type text NOT NULL,
    description text,
    related_player_uuid uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE player_balance_transaction; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.player_balance_transaction IS 'Complete audit trail of all balance changes with 3 decimal precision';


--
-- Name: COLUMN player_balance_transaction.amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.player_balance_transaction.amount IS 'Amount changed (positive for credit, negative for debit) in smallest unit';


--
-- Name: COLUMN player_balance_transaction.balance_before; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.player_balance_transaction.balance_before IS 'Balance before transaction';


--
-- Name: COLUMN player_balance_transaction.balance_after; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.player_balance_transaction.balance_after IS 'Balance after transaction';


--
-- Name: COLUMN player_balance_transaction.transaction_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.player_balance_transaction.transaction_type IS 'Type of transaction for categorization';


--
-- Name: COLUMN player_balance_transaction.related_player_uuid; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.player_balance_transaction.related_player_uuid IS 'Related player (e.g., sender/receiver in transfers)';


--
-- Name: COLUMN player_balance_transaction.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.player_balance_transaction.metadata IS 'Additional context (item_id, admin_id, etc.)';


--
-- Name: player_balance_transaction_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.player_balance_transaction_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: player_balance_transaction_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.player_balance_transaction_id_seq OWNED BY public.player_balance_transaction.id;


--
-- Name: player_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.player_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: player_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.player_id_seq OWNED BY public.player.id;


--
-- Name: player_playtime_daily; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_playtime_daily (
    player_minecraft_uuid uuid NOT NULL,
    server_id integer NOT NULL,
    play_date date NOT NULL,
    seconds_played bigint DEFAULT 0 NOT NULL
);


--
-- Name: player_playtime_hourly; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_playtime_hourly (
    player_minecraft_uuid uuid NOT NULL,
    server_id integer NOT NULL,
    play_hour timestamp with time zone NOT NULL,
    seconds_played bigint DEFAULT 0 NOT NULL
);


--
-- Name: player_playtime_summary; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_playtime_summary (
    player_minecraft_uuid uuid NOT NULL,
    server_id integer NOT NULL,
    total_seconds bigint DEFAULT 0 NOT NULL,
    total_sessions integer DEFAULT 0 NOT NULL,
    first_seen timestamp with time zone,
    last_seen timestamp with time zone,
    avg_session_seconds bigint GENERATED ALWAYS AS (
CASE
    WHEN (total_sessions > 0) THEN (total_seconds / total_sessions)
    ELSE (0)::bigint
END) STORED,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: player_session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_session (
    id integer NOT NULL,
    player_minecraft_uuid uuid NOT NULL,
    server_id integer NOT NULL,
    session_start timestamp with time zone NOT NULL,
    session_end timestamp with time zone,
    seconds_played bigint GENERATED ALWAYS AS (
CASE
    WHEN (session_end IS NOT NULL) THEN (EXTRACT(epoch FROM (session_end - session_start)))::bigint
    ELSE NULL::bigint
END) STORED,
    CONSTRAINT chk_session_end_after_start CHECK (((session_end IS NULL) OR (session_end >= session_start)))
);


--
-- Name: player_session_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.player_session_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: player_session_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.player_session_id_seq OWNED BY public.player_session.id;


--
-- Name: player_strike; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_strike (
    id integer NOT NULL,
    player_minecraft_uuid uuid NOT NULL,
    classification public.strike_classification NOT NULL,
    description text NOT NULL,
    severity integer DEFAULT 1 NOT NULL,
    issued_by_discord_id text NOT NULL,
    issued_by_username text NOT NULL,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    removed boolean DEFAULT false NOT NULL,
    removed_by_discord_id text,
    removed_by_username text,
    removed_at timestamp with time zone,
    removal_reason text,
    server_id integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT chk_removed_fields CHECK ((((removed = false) AND (removed_by_discord_id IS NULL) AND (removed_by_username IS NULL) AND (removed_at IS NULL) AND (removal_reason IS NULL)) OR ((removed = true) AND (removed_by_discord_id IS NOT NULL) AND (removed_by_username IS NOT NULL) AND (removed_at IS NOT NULL)))),
    CONSTRAINT player_strike_severity_check CHECK (((severity >= 1) AND (severity <= 5)))
);


--
-- Name: TABLE player_strike; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.player_strike IS 'Tracks administrative strikes/warnings issued to players';


--
-- Name: COLUMN player_strike.severity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.player_strike.severity IS 'Strike severity level from 1 (minor) to 5 (severe)';


--
-- Name: COLUMN player_strike.removed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.player_strike.removed IS 'Whether the strike has been removed/pardoned';


--
-- Name: COLUMN player_strike.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.player_strike.metadata IS 'Additional context (coordinates, item IDs, evidence links, etc.)';


--
-- Name: player_strike_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.player_strike_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: player_strike_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.player_strike_id_seq OWNED BY public.player_strike.id;


--
-- Name: reward_claim; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reward_claim (
    id integer NOT NULL,
    player_minecraft_uuid uuid NOT NULL,
    reward_type character varying(50) NOT NULL,
    claimed_at timestamp with time zone DEFAULT now() NOT NULL,
    amount bigint NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: reward_claim_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reward_claim_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reward_claim_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reward_claim_id_seq OWNED BY public.reward_claim.id;


--
-- Name: server_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.server_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: server_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.server_id_seq OWNED BY public.server.id;


--
-- Name: ticket; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket (
    id integer NOT NULL,
    ticket_number integer NOT NULL,
    type public.ticket_type NOT NULL,
    creator_discord_id text NOT NULL,
    channel_id text NOT NULL,
    status public.ticket_status DEFAULT 'open'::public.ticket_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    closed_by_discord_id text,
    deleted_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: TABLE ticket; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ticket IS 'Stores all Discord support ticket with persistence across bot restarts';


--
-- Name: ticket_action; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_action (
    id integer NOT NULL,
    ticket_id integer NOT NULL,
    action_type text NOT NULL,
    performed_by_discord_id text NOT NULL,
    performed_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: TABLE ticket_action; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ticket_action IS 'Audit log of all actions performed on ticket';


--
-- Name: ticket_action_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_action_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_action_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_action_id_seq OWNED BY public.ticket_action.id;


--
-- Name: ticket_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_id_seq OWNED BY public.ticket.id;


--
-- Name: ticket_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: waitlist_entry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waitlist_entry (
    id integer NOT NULL,
    email text NOT NULL,
    discord_name text NOT NULL,
    discord_id text,
    token text,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    discord_message_id text,
    status text DEFAULT 'pending'::text NOT NULL,
    joined_discord boolean DEFAULT false NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    registered boolean DEFAULT false NOT NULL,
    joined_minecraft boolean DEFAULT false NOT NULL,
    accepted_at timestamp with time zone,
    accepted_by text,
    CONSTRAINT waitlist_entry_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'completed'::text])))
);


--
-- Name: TABLE waitlist_entry; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.waitlist_entry IS 'Stores waitlist entries with progress tracking for new player onboarding';


--
-- Name: COLUMN waitlist_entry.discord_message_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.waitlist_entry.discord_message_id IS 'Discord message ID for the admin notification, used to update progress embed';


--
-- Name: COLUMN waitlist_entry.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.waitlist_entry.status IS 'Current status: pending (waiting for admin), accepted (invite sent), declined (rejected), completed (fully onboarded)';


--
-- Name: COLUMN waitlist_entry.joined_discord; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.waitlist_entry.joined_discord IS 'True when user joins the Discord server';


--
-- Name: COLUMN waitlist_entry.verified; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.waitlist_entry.verified IS 'True when user runs /verify command';


--
-- Name: COLUMN waitlist_entry.registered; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.waitlist_entry.registered IS 'True when user account is created in the system';


--
-- Name: COLUMN waitlist_entry.joined_minecraft; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.waitlist_entry.joined_minecraft IS 'True when user joins the Minecraft server for the first time';


--
-- Name: COLUMN waitlist_entry.accepted_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.waitlist_entry.accepted_by IS 'Discord ID of the admin who accepted the entry';


--
-- Name: waitlist_entry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.waitlist_entry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: waitlist_entry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.waitlist_entry_id_seq OWNED BY public.waitlist_entry.id;


--
-- Name: admin_log_action id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_log_action ALTER COLUMN id SET DEFAULT nextval('public.admin_log_action_id_seq'::regclass);


--
-- Name: discord_guild_member_join join_number; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discord_guild_member_join ALTER COLUMN join_number SET DEFAULT nextval('public.discord_guild_member_join_join_number_seq'::regclass);


--
-- Name: discord_guild_member_leave id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discord_guild_member_leave ALTER COLUMN id SET DEFAULT nextval('public.discord_guild_member_leave_id_seq'::regclass);


--
-- Name: leaderboard_message id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leaderboard_message ALTER COLUMN id SET DEFAULT nextval('public.leaderboard_message_id_seq'::regclass);


--
-- Name: player id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player ALTER COLUMN id SET DEFAULT nextval('public.player_id_seq'::regclass);


--
-- Name: player_balance_transaction id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_balance_transaction ALTER COLUMN id SET DEFAULT nextval('public.player_balance_transaction_id_seq'::regclass);


--
-- Name: player_session id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_session ALTER COLUMN id SET DEFAULT nextval('public.player_session_id_seq'::regclass);


--
-- Name: player_strike id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_strike ALTER COLUMN id SET DEFAULT nextval('public.player_strike_id_seq'::regclass);


--
-- Name: reward_claim id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_claim ALTER COLUMN id SET DEFAULT nextval('public.reward_claim_id_seq'::regclass);


--
-- Name: server id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server ALTER COLUMN id SET DEFAULT nextval('public.server_id_seq'::regclass);


--
-- Name: ticket id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket ALTER COLUMN id SET DEFAULT nextval('public.ticket_id_seq'::regclass);


--
-- Name: ticket_action id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_action ALTER COLUMN id SET DEFAULT nextval('public.ticket_action_id_seq'::regclass);


--
-- Name: waitlist_entry id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist_entry ALTER COLUMN id SET DEFAULT nextval('public.waitlist_entry_id_seq'::regclass);


--
-- Name: admin_log_action admin_log_action_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_log_action
    ADD CONSTRAINT admin_log_action_pkey PRIMARY KEY (id);


--
-- Name: admin admin_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin
    ADD CONSTRAINT admin_pkey PRIMARY KEY (discord_id);


--
-- Name: discord_guild_member_join discord_guild_member_join_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discord_guild_member_join
    ADD CONSTRAINT discord_guild_member_join_pkey PRIMARY KEY (join_number);


--
-- Name: discord_guild_member_leave discord_guild_member_leave_discord_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discord_guild_member_leave
    ADD CONSTRAINT discord_guild_member_leave_discord_id_key UNIQUE (discord_id);


--
-- Name: discord_guild_member_leave discord_guild_member_leave_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discord_guild_member_leave
    ADD CONSTRAINT discord_guild_member_leave_pkey PRIMARY KEY (id);


--
-- Name: discord_guild_member_join idx_user_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discord_guild_member_join
    ADD CONSTRAINT idx_user_id UNIQUE (user_id);


--
-- Name: leaderboard_message leaderboard_message_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leaderboard_message
    ADD CONSTRAINT leaderboard_message_pkey PRIMARY KEY (id);


--
-- Name: player_balance player_balance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_balance
    ADD CONSTRAINT player_balance_pkey PRIMARY KEY (minecraft_uuid);


--
-- Name: player_balance_transaction player_balance_transaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_balance_transaction
    ADD CONSTRAINT player_balance_transaction_pkey PRIMARY KEY (id);


--
-- Name: player player_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player
    ADD CONSTRAINT player_pkey PRIMARY KEY (id);


--
-- Name: player_playtime_daily player_playtime_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_playtime_daily
    ADD CONSTRAINT player_playtime_daily_pkey PRIMARY KEY (player_minecraft_uuid, server_id, play_date);


--
-- Name: player_playtime_hourly player_playtime_hourly_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_playtime_hourly
    ADD CONSTRAINT player_playtime_hourly_pkey PRIMARY KEY (player_minecraft_uuid, server_id, play_hour);


--
-- Name: player_playtime_summary player_playtime_summary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_playtime_summary
    ADD CONSTRAINT player_playtime_summary_pkey PRIMARY KEY (player_minecraft_uuid, server_id);


--
-- Name: player_session player_session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_session
    ADD CONSTRAINT player_session_pkey PRIMARY KEY (id);


--
-- Name: player_strike player_strike_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_strike
    ADD CONSTRAINT player_strike_pkey PRIMARY KEY (id);


--
-- Name: reward_claim reward_claim_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_claim
    ADD CONSTRAINT reward_claim_pkey PRIMARY KEY (id);


--
-- Name: reward_claim reward_claim_player_type_claimed; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_claim
    ADD CONSTRAINT reward_claim_player_type_claimed UNIQUE (player_minecraft_uuid, reward_type, claimed_at);


--
-- Name: server server_identifier_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server
    ADD CONSTRAINT server_identifier_key UNIQUE (identifier);


--
-- Name: server server_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server
    ADD CONSTRAINT server_name_key UNIQUE (name);


--
-- Name: server server_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server
    ADD CONSTRAINT server_pkey PRIMARY KEY (id);


--
-- Name: ticket_action ticket_action_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_action
    ADD CONSTRAINT ticket_action_pkey PRIMARY KEY (id);


--
-- Name: ticket ticket_channel_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket
    ADD CONSTRAINT ticket_channel_id_unique UNIQUE (channel_id);


--
-- Name: ticket ticket_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket
    ADD CONSTRAINT ticket_pkey PRIMARY KEY (id);


--
-- Name: waitlist_entry uq_discord_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist_entry
    ADD CONSTRAINT uq_discord_id UNIQUE (discord_id);


--
-- Name: leaderboard_message uq_leaderboard_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leaderboard_message
    ADD CONSTRAINT uq_leaderboard_type UNIQUE (leaderboard_type);


--
-- Name: player uq_player_discord_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player
    ADD CONSTRAINT uq_player_discord_id UNIQUE (discord_id);


--
-- Name: player uq_player_minecraft_username; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player
    ADD CONSTRAINT uq_player_minecraft_username UNIQUE (minecraft_username);


--
-- Name: player uq_player_minecraft_uuid; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player
    ADD CONSTRAINT uq_player_minecraft_uuid UNIQUE (minecraft_uuid);


--
-- Name: waitlist_entry uq_token; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist_entry
    ADD CONSTRAINT uq_token UNIQUE (token);


--
-- Name: waitlist_entry uq_waitlist_discord_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist_entry
    ADD CONSTRAINT uq_waitlist_discord_name UNIQUE (discord_name);


--
-- Name: waitlist_entry uq_waitlist_email; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist_entry
    ADD CONSTRAINT uq_waitlist_email UNIQUE (email);


--
-- Name: waitlist_entry waitlist_entry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist_entry
    ADD CONSTRAINT waitlist_entry_pkey PRIMARY KEY (id);


--
-- Name: idx_balance_transaction_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_balance_transaction_created ON public.player_balance_transaction USING btree (created_at DESC);


--
-- Name: idx_balance_transaction_player; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_balance_transaction_player ON public.player_balance_transaction USING btree (player_minecraft_uuid);


--
-- Name: idx_balance_transaction_related; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_balance_transaction_related ON public.player_balance_transaction USING btree (related_player_uuid) WHERE (related_player_uuid IS NOT NULL);


--
-- Name: idx_balance_transaction_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_balance_transaction_type ON public.player_balance_transaction USING btree (transaction_type);


--
-- Name: idx_discord_guild_member_join_joined_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discord_guild_member_join_joined_at ON public.discord_guild_member_join USING btree (joined_at DESC);


--
-- Name: idx_discord_guild_member_leave_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discord_guild_member_leave_deleted_at ON public.discord_guild_member_leave USING btree (departed_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_discord_guild_member_leave_departed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discord_guild_member_leave_departed_at ON public.discord_guild_member_leave USING btree (departed_at);


--
-- Name: idx_discord_guild_member_leave_discord_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discord_guild_member_leave_discord_id ON public.discord_guild_member_leave USING btree (discord_id);


--
-- Name: idx_discord_guild_member_leave_minecraft_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discord_guild_member_leave_minecraft_uuid ON public.discord_guild_member_leave USING btree (minecraft_uuid);


--
-- Name: idx_leaderboard_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leaderboard_type ON public.leaderboard_message USING btree (leaderboard_type);


--
-- Name: idx_log_actions_action_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_log_actions_action_type ON public.admin_log_action USING btree (action_type);


--
-- Name: idx_log_actions_admin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_log_actions_admin ON public.admin_log_action USING btree (admin_discord_id);


--
-- Name: idx_log_actions_performed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_log_actions_performed_at ON public.admin_log_action USING btree (performed_at DESC);


--
-- Name: idx_log_actions_table_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_log_actions_table_name ON public.admin_log_action USING btree (table_name);


--
-- Name: idx_log_actions_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_log_actions_target ON public.admin_log_action USING btree (target_player_uuid);


--
-- Name: idx_player_balance_amount; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_balance_amount ON public.player_balance USING btree (balance DESC);


--
-- Name: idx_player_balance_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_balance_uuid ON public.player_balance USING btree (minecraft_uuid);


--
-- Name: idx_player_current_server; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_current_server ON public.player USING btree (current_server_id) WHERE (current_server_id IS NOT NULL);


--
-- Name: idx_player_discord_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_discord_id ON public.player USING btree (discord_id);


--
-- Name: idx_player_last_seen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_last_seen ON public.player USING btree (last_seen);


--
-- Name: idx_player_minecraft_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_minecraft_username ON public.player USING btree (minecraft_username);


--
-- Name: idx_player_minecraft_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_minecraft_uuid ON public.player USING btree (minecraft_uuid);


--
-- Name: idx_player_online; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_online ON public.player USING btree (online) WHERE (online = true);


--
-- Name: idx_player_playtime_daily_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_playtime_daily_date ON public.player_playtime_daily USING btree (play_date);


--
-- Name: idx_player_playtime_hourly_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_playtime_hourly_date ON public.player_playtime_hourly USING btree (play_hour);


--
-- Name: idx_player_playtime_hourly_player_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_playtime_hourly_player_date ON public.player_playtime_hourly USING btree (player_minecraft_uuid, play_hour);


--
-- Name: idx_player_playtime_summary_total; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_playtime_summary_total ON public.player_playtime_summary USING btree (total_seconds DESC);


--
-- Name: idx_player_session_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_session_active ON public.player_session USING btree (player_minecraft_uuid, server_id) WHERE (session_end IS NULL);


--
-- Name: idx_player_session_date_range; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_session_date_range ON public.player_session USING btree (player_minecraft_uuid, session_start, session_end);


--
-- Name: idx_player_session_player; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_session_player ON public.player_session USING btree (player_minecraft_uuid);


--
-- Name: idx_player_session_server; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_session_server ON public.player_session USING btree (server_id);


--
-- Name: idx_player_session_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_session_start ON public.player_session USING btree (session_start);


--
-- Name: idx_player_strike_classification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_strike_classification ON public.player_strike USING btree (classification);


--
-- Name: idx_player_strike_issued_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_strike_issued_at ON public.player_strike USING btree (issued_at DESC);


--
-- Name: idx_player_strike_player; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_strike_player ON public.player_strike USING btree (player_minecraft_uuid);


--
-- Name: idx_player_strike_removed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_strike_removed ON public.player_strike USING btree (removed) WHERE (removed = false);


--
-- Name: idx_player_strike_server; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_strike_server ON public.player_strike USING btree (server_id) WHERE (server_id IS NOT NULL);


--
-- Name: idx_player_strike_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_strike_severity ON public.player_strike USING btree (severity DESC);


--
-- Name: idx_reward_claim_claimed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reward_claim_claimed_at ON public.reward_claim USING btree (claimed_at);


--
-- Name: idx_reward_claim_player; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reward_claim_player ON public.reward_claim USING btree (player_minecraft_uuid);


--
-- Name: idx_reward_claim_player_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reward_claim_player_type ON public.reward_claim USING btree (player_minecraft_uuid, reward_type);


--
-- Name: idx_reward_claim_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reward_claim_type ON public.reward_claim USING btree (reward_type);


--
-- Name: idx_ticket_action_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_action_ticket ON public.ticket_action USING btree (ticket_id);


--
-- Name: idx_ticket_action_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_action_type ON public.ticket_action USING btree (action_type);


--
-- Name: idx_ticket_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_channel ON public.ticket USING btree (channel_id);


--
-- Name: idx_ticket_creator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_creator ON public.ticket USING btree (creator_discord_id);


--
-- Name: idx_ticket_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_status ON public.ticket USING btree (status);


--
-- Name: idx_ticket_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_type ON public.ticket USING btree (type);


--
-- Name: idx_waitlist_discord_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waitlist_discord_message_id ON public.waitlist_entry USING btree (discord_message_id);


--
-- Name: idx_waitlist_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waitlist_status ON public.waitlist_entry USING btree (status);


--
-- Name: idx_waitlist_submitted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waitlist_submitted_at ON public.waitlist_entry USING btree (submitted_at);


--
-- Name: idx_waitlist_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waitlist_token ON public.waitlist_entry USING btree (token);


--
-- Name: player_session trigger_sync_player_online; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_player_online AFTER INSERT OR UPDATE ON public.player_session FOR EACH ROW EXECUTE FUNCTION public.sync_player_online_status();


--
-- Name: player_session trigger_update_playtime_aggregates; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_playtime_aggregates AFTER INSERT OR UPDATE OF session_end ON public.player_session FOR EACH ROW EXECUTE FUNCTION public.update_playtime_aggregates();


--
-- Name: player_balance update_player_balance_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_player_balance_updated_at BEFORE UPDATE ON public.player_balance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: player update_player_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_player_updated_at BEFORE UPDATE ON public.player FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: admin admin_discord_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin
    ADD CONSTRAINT admin_discord_id_fkey FOREIGN KEY (discord_id) REFERENCES public.player(discord_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: admin_log_action admin_log_action_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_log_action
    ADD CONSTRAINT admin_log_action_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.server(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_balance fk_player; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_balance
    ADD CONSTRAINT fk_player FOREIGN KEY (minecraft_uuid) REFERENCES public.player(minecraft_uuid) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_balance_transaction fk_player; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_balance_transaction
    ADD CONSTRAINT fk_player FOREIGN KEY (player_minecraft_uuid) REFERENCES public.player(minecraft_uuid) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_strike fk_player; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_strike
    ADD CONSTRAINT fk_player FOREIGN KEY (player_minecraft_uuid) REFERENCES public.player(minecraft_uuid) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_balance_transaction fk_related_player; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_balance_transaction
    ADD CONSTRAINT fk_related_player FOREIGN KEY (related_player_uuid) REFERENCES public.player(minecraft_uuid) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: player_strike fk_server; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_strike
    ADD CONSTRAINT fk_server FOREIGN KEY (server_id) REFERENCES public.server(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: player player_current_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player
    ADD CONSTRAINT player_current_server_id_fkey FOREIGN KEY (current_server_id) REFERENCES public.server(id) ON DELETE SET NULL;


--
-- Name: player_playtime_daily player_playtime_daily_player_minecraft_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_playtime_daily
    ADD CONSTRAINT player_playtime_daily_player_minecraft_uuid_fkey FOREIGN KEY (player_minecraft_uuid) REFERENCES public.player(minecraft_uuid) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_playtime_daily player_playtime_daily_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_playtime_daily
    ADD CONSTRAINT player_playtime_daily_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.server(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_playtime_hourly player_playtime_hourly_player_minecraft_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_playtime_hourly
    ADD CONSTRAINT player_playtime_hourly_player_minecraft_uuid_fkey FOREIGN KEY (player_minecraft_uuid) REFERENCES public.player(minecraft_uuid) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_playtime_hourly player_playtime_hourly_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_playtime_hourly
    ADD CONSTRAINT player_playtime_hourly_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.server(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_playtime_summary player_playtime_summary_player_minecraft_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_playtime_summary
    ADD CONSTRAINT player_playtime_summary_player_minecraft_uuid_fkey FOREIGN KEY (player_minecraft_uuid) REFERENCES public.player(minecraft_uuid) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_playtime_summary player_playtime_summary_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_playtime_summary
    ADD CONSTRAINT player_playtime_summary_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.server(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_session player_session_player_minecraft_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_session
    ADD CONSTRAINT player_session_player_minecraft_uuid_fkey FOREIGN KEY (player_minecraft_uuid) REFERENCES public.player(minecraft_uuid) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_session player_session_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_session
    ADD CONSTRAINT player_session_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.server(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: reward_claim reward_claim_player_minecraft_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_claim
    ADD CONSTRAINT reward_claim_player_minecraft_uuid_fkey FOREIGN KEY (player_minecraft_uuid) REFERENCES public.player(minecraft_uuid) ON DELETE CASCADE;


--
-- Name: ticket_action ticket_action_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_action
    ADD CONSTRAINT ticket_action_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.ticket(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


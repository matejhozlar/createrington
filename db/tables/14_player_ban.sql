--
-- PostgreSQL database dump
--

-- Dumped from database version 15.16 (Debian 15.16-1.pgdg13+1)
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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: player_ban; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.player_ban (
    id integer NOT NULL,
    player_minecraft_uuid uuid NOT NULL,
    ban_type public.ban_type NOT NULL,
    reason text NOT NULL,
    banned_by_discord_id text NOT NULL,
    banned_by_username text NOT NULL,
    banned_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    unbanned boolean DEFAULT false NOT NULL,
    unbanned_by_discord_id text,
    unbanned_by_username text,
    unbanned_at timestamp with time zone,
    unban_reason text,
    server_id integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT chk_ban_expiry CHECK ((((ban_type = 'permanent'::public.ban_type) AND (expires_at IS NULL)) OR ((ban_type = 'temporary'::public.ban_type) AND (expires_at IS NOT NULL) AND (expires_at > banned_at)))),
    CONSTRAINT chk_unban_fields CHECK ((((unbanned = false) AND (unbanned_by_discord_id IS NULL) AND (unbanned_by_username IS NULL) AND (unbanned_at IS NULL) AND (unban_reason IS NULL)) OR ((unbanned = true) AND (unbanned_by_discord_id IS NOT NULL) AND (unbanned_by_username IS NOT NULL) AND (unbanned_at IS NOT NULL))))
);


ALTER TABLE public.player_ban OWNER TO postgres;

--
-- Name: TABLE player_ban; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.player_ban IS 'Tracks both temporary and permanent player bans. Permanent bans result in complete player data deletion, temporary bans are server-side only';


--
-- Name: COLUMN player_ban.ban_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.player_ban.ban_type IS 'Type of ban: temporary (time-limited) or permanent (player deletion)';


--
-- Name: COLUMN player_ban.expires_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.player_ban.expires_at IS 'When the ban expires (required for temporary, null for permanent)';


--
-- Name: COLUMN player_ban.unbanned; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.player_ban.unbanned IS 'Whether the ban has been lifted/pardoned';


--
-- Name: COLUMN player_ban.server_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.player_ban.server_id IS 'Optional server context where ban was issued';


--
-- Name: COLUMN player_ban.metadata; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.player_ban.metadata IS 'Additional context (evidence links, coordinates, related incidents, etc.)';


--
-- Name: player_ban_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.player_ban ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.player_ban_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: player_ban player_ban_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_ban
    ADD CONSTRAINT player_ban_pkey PRIMARY KEY (id);


--
-- Name: idx_player_ban_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_ban_active ON public.player_ban USING btree (unbanned) WHERE (unbanned = false);


--
-- Name: idx_player_ban_banned_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_ban_banned_at ON public.player_ban USING btree (banned_at DESC);


--
-- Name: idx_player_ban_banned_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_ban_banned_by ON public.player_ban USING btree (banned_by_discord_id);


--
-- Name: idx_player_ban_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_ban_expires ON public.player_ban USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (unbanned = false));


--
-- Name: idx_player_ban_player; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_ban_player ON public.player_ban USING btree (player_minecraft_uuid);


--
-- Name: idx_player_ban_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_ban_type ON public.player_ban USING btree (ban_type);


--
-- Name: player_ban fk_server; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_ban
    ADD CONSTRAINT fk_server FOREIGN KEY (server_id) REFERENCES public.server(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--


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
-- Name: player_strike; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.player_strike OWNER TO postgres;

--
-- Name: TABLE player_strike; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.player_strike IS 'Tracks administrative strikes/warnings issued to players';


--
-- Name: COLUMN player_strike.severity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.player_strike.severity IS 'Strike severity level from 1 (minor) to 5 (severe)';


--
-- Name: COLUMN player_strike.removed; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.player_strike.removed IS 'Whether the strike has been removed/pardoned';


--
-- Name: COLUMN player_strike.metadata; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.player_strike.metadata IS 'Additional context (coordinates, item IDs, evidence links, etc.)';


--
-- Name: player_strike_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.player_strike_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.player_strike_id_seq OWNER TO postgres;

--
-- Name: player_strike_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.player_strike_id_seq OWNED BY public.player_strike.id;


--
-- Name: player_strike id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_strike ALTER COLUMN id SET DEFAULT nextval('public.player_strike_id_seq'::regclass);


--
-- Name: player_strike player_strike_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_strike
    ADD CONSTRAINT player_strike_pkey PRIMARY KEY (id);


--
-- Name: idx_player_strike_classification; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_strike_classification ON public.player_strike USING btree (classification);


--
-- Name: idx_player_strike_issued_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_strike_issued_at ON public.player_strike USING btree (issued_at DESC);


--
-- Name: idx_player_strike_player; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_strike_player ON public.player_strike USING btree (player_minecraft_uuid);


--
-- Name: idx_player_strike_removed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_strike_removed ON public.player_strike USING btree (removed) WHERE (removed = false);


--
-- Name: idx_player_strike_server; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_strike_server ON public.player_strike USING btree (server_id) WHERE (server_id IS NOT NULL);


--
-- Name: idx_player_strike_severity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_strike_severity ON public.player_strike USING btree (severity DESC);


--
-- Name: player_strike fk_player; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_strike
    ADD CONSTRAINT fk_player FOREIGN KEY (player_minecraft_uuid) REFERENCES public.player(minecraft_uuid) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_strike fk_server; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_strike
    ADD CONSTRAINT fk_server FOREIGN KEY (server_id) REFERENCES public.server(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--


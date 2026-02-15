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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: player_session; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.player_session OWNER TO postgres;

--
-- Name: player_session_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.player_session_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.player_session_id_seq OWNER TO postgres;

--
-- Name: player_session_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.player_session_id_seq OWNED BY public.player_session.id;


--
-- Name: player_session id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_session ALTER COLUMN id SET DEFAULT nextval('public.player_session_id_seq'::regclass);


--
-- Name: player_session player_session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_session
    ADD CONSTRAINT player_session_pkey PRIMARY KEY (id);


--
-- Name: idx_player_session_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_session_active ON public.player_session USING btree (player_minecraft_uuid, server_id) WHERE (session_end IS NULL);


--
-- Name: idx_player_session_date_range; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_session_date_range ON public.player_session USING btree (player_minecraft_uuid, session_start, session_end);


--
-- Name: idx_player_session_player; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_session_player ON public.player_session USING btree (player_minecraft_uuid);


--
-- Name: idx_player_session_server; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_session_server ON public.player_session USING btree (server_id);


--
-- Name: idx_player_session_start; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_session_start ON public.player_session USING btree (session_start);


--
-- Name: player_session trigger_sync_player_online; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_sync_player_online AFTER INSERT OR UPDATE ON public.player_session FOR EACH ROW EXECUTE FUNCTION public.sync_player_online_status();


--
-- Name: player_session trigger_update_playtime_aggregates; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_playtime_aggregates AFTER INSERT OR UPDATE OF session_end ON public.player_session FOR EACH ROW EXECUTE FUNCTION public.update_playtime_aggregates();


--
-- Name: player_session player_session_player_minecraft_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_session
    ADD CONSTRAINT player_session_player_minecraft_uuid_fkey FOREIGN KEY (player_minecraft_uuid) REFERENCES public.player(minecraft_uuid) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_session player_session_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_session
    ADD CONSTRAINT player_session_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.server(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


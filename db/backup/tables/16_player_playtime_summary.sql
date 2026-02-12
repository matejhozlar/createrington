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
-- Name: player_playtime_summary; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.player_playtime_summary OWNER TO postgres;

--
-- Name: player_playtime_summary player_playtime_summary_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_playtime_summary
    ADD CONSTRAINT player_playtime_summary_pkey PRIMARY KEY (player_minecraft_uuid, server_id);


--
-- Name: idx_player_playtime_summary_total; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_playtime_summary_total ON public.player_playtime_summary USING btree (total_seconds DESC);


--
-- Name: player_playtime_summary player_playtime_summary_player_minecraft_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_playtime_summary
    ADD CONSTRAINT player_playtime_summary_player_minecraft_uuid_fkey FOREIGN KEY (player_minecraft_uuid) REFERENCES public.player(minecraft_uuid) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_playtime_summary player_playtime_summary_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_playtime_summary
    ADD CONSTRAINT player_playtime_summary_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.server(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


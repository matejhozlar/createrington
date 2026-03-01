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
-- Name: player_achievement; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.player_achievement (
    minecraft_uuid uuid NOT NULL,
    server_id integer NOT NULL,
    achievement_group_id text NOT NULL,
    tier integer NOT NULL,
    completed_at timestamp with time zone DEFAULT now() NOT NULL,
    claimed_at timestamp with time zone,
    reward_amount integer NOT NULL,
    CONSTRAINT chk_reward_non_negative CHECK ((reward_amount >= 0)),
    CONSTRAINT chk_tier_positive CHECK ((tier > 0))
);


ALTER TABLE public.player_achievement OWNER TO postgres;

--
-- Name: player_achievement player_achievement_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_achievement
    ADD CONSTRAINT player_achievement_pkey PRIMARY KEY (minecraft_uuid, server_id, achievement_group_id, tier);


--
-- Name: idx_player_achievement_player_server; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_achievement_player_server ON public.player_achievement USING btree (minecraft_uuid, server_id);


--
-- Name: idx_player_achievement_unclaimed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_achievement_unclaimed ON public.player_achievement USING btree (minecraft_uuid, server_id) WHERE (claimed_at IS NULL);


--
-- Name: player_achievement player_achievement_minecraft_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_achievement
    ADD CONSTRAINT player_achievement_minecraft_uuid_fkey FOREIGN KEY (minecraft_uuid) REFERENCES public.player(minecraft_uuid) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_achievement player_achievement_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_achievement
    ADD CONSTRAINT player_achievement_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.server(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


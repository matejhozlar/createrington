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
-- Name: player_playtime_hourly; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.player_playtime_hourly (
    player_minecraft_uuid uuid NOT NULL,
    server_id integer NOT NULL,
    play_hour timestamp with time zone NOT NULL,
    seconds_played bigint DEFAULT 0 NOT NULL
);


ALTER TABLE public.player_playtime_hourly OWNER TO postgres;

--
-- Name: player_playtime_hourly player_playtime_hourly_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_playtime_hourly
    ADD CONSTRAINT player_playtime_hourly_pkey PRIMARY KEY (player_minecraft_uuid, server_id, play_hour);


--
-- Name: idx_player_playtime_hourly_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_playtime_hourly_date ON public.player_playtime_hourly USING btree (play_hour);


--
-- Name: idx_player_playtime_hourly_player_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_playtime_hourly_player_date ON public.player_playtime_hourly USING btree (player_minecraft_uuid, play_hour);


--
-- Name: player_playtime_hourly player_playtime_hourly_player_minecraft_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_playtime_hourly
    ADD CONSTRAINT player_playtime_hourly_player_minecraft_uuid_fkey FOREIGN KEY (player_minecraft_uuid) REFERENCES public.player(minecraft_uuid) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_playtime_hourly player_playtime_hourly_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_playtime_hourly
    ADD CONSTRAINT player_playtime_hourly_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.server(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


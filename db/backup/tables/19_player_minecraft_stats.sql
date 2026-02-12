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
-- Name: player_minecraft_stats; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.player_minecraft_stats (
    minecraft_uuid uuid NOT NULL,
    server_id integer NOT NULL,
    stats jsonb NOT NULL,
    data_version integer,
    imported_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.player_minecraft_stats OWNER TO postgres;

--
-- Name: player_minecraft_stats player_minecraft_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_minecraft_stats
    ADD CONSTRAINT player_minecraft_stats_pkey PRIMARY KEY (minecraft_uuid, server_id);


--
-- Name: idx_player_minecraft_stats_server; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_minecraft_stats_server ON public.player_minecraft_stats USING btree (server_id);


--
-- Name: player_minecraft_stats update_player_minecraft_stats_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_player_minecraft_stats_updated_at BEFORE UPDATE ON public.player_minecraft_stats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: player_minecraft_stats player_minecraft_stats_minecraft_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_minecraft_stats
    ADD CONSTRAINT player_minecraft_stats_minecraft_uuid_fkey FOREIGN KEY (minecraft_uuid) REFERENCES public.player(minecraft_uuid) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_minecraft_stats player_minecraft_stats_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_minecraft_stats
    ADD CONSTRAINT player_minecraft_stats_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.server(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

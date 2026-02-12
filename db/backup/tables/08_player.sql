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
-- Name: player; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.player OWNER TO postgres;

--
-- Name: player_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.player_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.player_id_seq OWNER TO postgres;

--
-- Name: player_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.player_id_seq OWNED BY public.player.id;


--
-- Name: player id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player ALTER COLUMN id SET DEFAULT nextval('public.player_id_seq'::regclass);


--
-- Name: player player_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player
    ADD CONSTRAINT player_pkey PRIMARY KEY (id);


--
-- Name: player uq_player_discord_id; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player
    ADD CONSTRAINT uq_player_discord_id UNIQUE (discord_id);


--
-- Name: player uq_player_minecraft_username; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player
    ADD CONSTRAINT uq_player_minecraft_username UNIQUE (minecraft_username);


--
-- Name: player uq_player_minecraft_uuid; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player
    ADD CONSTRAINT uq_player_minecraft_uuid UNIQUE (minecraft_uuid);


--
-- Name: idx_player_current_server; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_current_server ON public.player USING btree (current_server_id) WHERE (current_server_id IS NOT NULL);


--
-- Name: idx_player_discord_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_discord_id ON public.player USING btree (discord_id);


--
-- Name: idx_player_last_seen; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_last_seen ON public.player USING btree (last_seen);


--
-- Name: idx_player_minecraft_username; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_minecraft_username ON public.player USING btree (minecraft_username);


--
-- Name: idx_player_minecraft_uuid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_minecraft_uuid ON public.player USING btree (minecraft_uuid);


--
-- Name: idx_player_online; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_online ON public.player USING btree (online) WHERE (online = true);


--
-- Name: player update_player_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_player_updated_at BEFORE UPDATE ON public.player FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: player player_current_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player
    ADD CONSTRAINT player_current_server_id_fkey FOREIGN KEY (current_server_id) REFERENCES public.server(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--


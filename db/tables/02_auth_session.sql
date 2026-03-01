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
-- Name: auth_session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auth_session (
    id integer NOT NULL,
    discord_id text NOT NULL,
    discord_username text,
    discord_avatar text,
    token_hash text NOT NULL,
    family_id uuid DEFAULT gen_random_uuid() NOT NULL,
    ip_address inet,
    user_agent text,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    last_used_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.auth_session OWNER TO postgres;

--
-- Name: auth_session_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.auth_session_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.auth_session_id_seq OWNER TO postgres;

--
-- Name: auth_session_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.auth_session_id_seq OWNED BY public.auth_session.id;


--
-- Name: auth_session id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_session ALTER COLUMN id SET DEFAULT nextval('public.auth_session_id_seq'::regclass);


--
-- Name: auth_session auth_session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_session
    ADD CONSTRAINT auth_session_pkey PRIMARY KEY (id);


--
-- Name: auth_session auth_session_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_session
    ADD CONSTRAINT auth_session_token_hash_key UNIQUE (token_hash);


--
-- Name: idx_auth_session_discord_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_auth_session_discord_id ON public.auth_session USING btree (discord_id);


--
-- Name: idx_auth_session_expires_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_auth_session_expires_at ON public.auth_session USING btree (expires_at) WHERE (revoked_at IS NULL);


--
-- Name: idx_auth_session_family_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_auth_session_family_id ON public.auth_session USING btree (family_id);


--
-- Name: idx_auth_session_token_hash; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_auth_session_token_hash ON public.auth_session USING btree (token_hash) WHERE (revoked_at IS NULL);


--
-- Name: auth_session fk_auth_session_player; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_session
    ADD CONSTRAINT fk_auth_session_player FOREIGN KEY (discord_id) REFERENCES public.player(discord_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


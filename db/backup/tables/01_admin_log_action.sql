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
-- Name: admin_log_action; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.admin_log_action OWNER TO postgres;

--
-- Name: admin_log_action_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.admin_log_action_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.admin_log_action_id_seq OWNER TO postgres;

--
-- Name: admin_log_action_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admin_log_action_id_seq OWNED BY public.admin_log_action.id;


--
-- Name: admin_log_action id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_log_action ALTER COLUMN id SET DEFAULT nextval('public.admin_log_action_id_seq'::regclass);


--
-- Name: admin_log_action admin_log_action_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_log_action
    ADD CONSTRAINT admin_log_action_pkey PRIMARY KEY (id);


--
-- Name: idx_log_actions_action_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_log_actions_action_type ON public.admin_log_action USING btree (action_type);


--
-- Name: idx_log_actions_admin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_log_actions_admin ON public.admin_log_action USING btree (admin_discord_id);


--
-- Name: idx_log_actions_performed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_log_actions_performed_at ON public.admin_log_action USING btree (performed_at DESC);


--
-- Name: idx_log_actions_table_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_log_actions_table_name ON public.admin_log_action USING btree (table_name);


--
-- Name: idx_log_actions_target; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_log_actions_target ON public.admin_log_action USING btree (target_player_uuid);


--
-- Name: admin_log_action admin_log_action_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_log_action
    ADD CONSTRAINT admin_log_action_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.server(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


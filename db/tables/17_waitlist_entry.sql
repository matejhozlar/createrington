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
-- Name: waitlist_entry; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.waitlist_entry (
    id integer NOT NULL,
    email text NOT NULL,
    discord_name text NOT NULL,
    discord_id text,
    token text,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    discord_message_id text,
    status text DEFAULT 'pending'::text NOT NULL,
    joined_discord boolean DEFAULT false NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    registered boolean DEFAULT false NOT NULL,
    joined_minecraft boolean DEFAULT false NOT NULL,
    accepted_at timestamp with time zone,
    accepted_by text,
    CONSTRAINT waitlist_entry_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'completed'::text])))
);


ALTER TABLE public.waitlist_entry OWNER TO postgres;

--
-- Name: TABLE waitlist_entry; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.waitlist_entry IS 'Stores waitlist entries with progress tracking for new player onboarding';


--
-- Name: COLUMN waitlist_entry.discord_message_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.waitlist_entry.discord_message_id IS 'Discord message ID for the admin notification, used to update progress embed';


--
-- Name: COLUMN waitlist_entry.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.waitlist_entry.status IS 'Current status: pending (waiting for admin), accepted (invite sent), declined (rejected), completed (fully onboarded)';


--
-- Name: COLUMN waitlist_entry.joined_discord; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.waitlist_entry.joined_discord IS 'True when user joins the Discord server';


--
-- Name: COLUMN waitlist_entry.verified; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.waitlist_entry.verified IS 'True when user runs /verify command';


--
-- Name: COLUMN waitlist_entry.registered; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.waitlist_entry.registered IS 'True when user account is created in the system';


--
-- Name: COLUMN waitlist_entry.joined_minecraft; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.waitlist_entry.joined_minecraft IS 'True when user joins the Minecraft server for the first time';


--
-- Name: COLUMN waitlist_entry.accepted_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.waitlist_entry.accepted_by IS 'Discord ID of the admin who accepted the entry';


--
-- Name: waitlist_entry_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.waitlist_entry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.waitlist_entry_id_seq OWNER TO postgres;

--
-- Name: waitlist_entry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.waitlist_entry_id_seq OWNED BY public.waitlist_entry.id;


--
-- Name: waitlist_entry id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.waitlist_entry ALTER COLUMN id SET DEFAULT nextval('public.waitlist_entry_id_seq'::regclass);


--
-- Name: waitlist_entry uq_discord_id; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.waitlist_entry
    ADD CONSTRAINT uq_discord_id UNIQUE (discord_id);


--
-- Name: waitlist_entry uq_token; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.waitlist_entry
    ADD CONSTRAINT uq_token UNIQUE (token);


--
-- Name: waitlist_entry uq_waitlist_discord_name; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.waitlist_entry
    ADD CONSTRAINT uq_waitlist_discord_name UNIQUE (discord_name);


--
-- Name: waitlist_entry uq_waitlist_email; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.waitlist_entry
    ADD CONSTRAINT uq_waitlist_email UNIQUE (email);


--
-- Name: waitlist_entry waitlist_entry_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.waitlist_entry
    ADD CONSTRAINT waitlist_entry_pkey PRIMARY KEY (id);


--
-- Name: idx_waitlist_discord_message_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_waitlist_discord_message_id ON public.waitlist_entry USING btree (discord_message_id);


--
-- Name: idx_waitlist_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_waitlist_status ON public.waitlist_entry USING btree (status);


--
-- Name: idx_waitlist_submitted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_waitlist_submitted_at ON public.waitlist_entry USING btree (submitted_at);


--
-- Name: idx_waitlist_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_waitlist_token ON public.waitlist_entry USING btree (token);


--
-- PostgreSQL database dump complete
--


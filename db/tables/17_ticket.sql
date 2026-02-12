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
-- Name: ticket; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ticket (
    id integer NOT NULL,
    ticket_number integer NOT NULL,
    type public.ticket_type NOT NULL,
    creator_discord_id text NOT NULL,
    channel_id text NOT NULL,
    status public.ticket_status DEFAULT 'open'::public.ticket_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    closed_by_discord_id text,
    deleted_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.ticket OWNER TO postgres;

--
-- Name: TABLE ticket; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.ticket IS 'Stores all Discord support ticket with persistence across bot restarts';


--
-- Name: ticket_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ticket_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.ticket_id_seq OWNER TO postgres;

--
-- Name: ticket_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ticket_id_seq OWNED BY public.ticket.id;


--
-- Name: ticket id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket ALTER COLUMN id SET DEFAULT nextval('public.ticket_id_seq'::regclass);


--
-- Name: ticket ticket_channel_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket
    ADD CONSTRAINT ticket_channel_id_unique UNIQUE (channel_id);


--
-- Name: ticket ticket_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket
    ADD CONSTRAINT ticket_pkey PRIMARY KEY (id);


--
-- Name: idx_ticket_channel; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ticket_channel ON public.ticket USING btree (channel_id);


--
-- Name: idx_ticket_creator; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ticket_creator ON public.ticket USING btree (creator_discord_id);


--
-- Name: idx_ticket_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ticket_status ON public.ticket USING btree (status);


--
-- Name: idx_ticket_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ticket_type ON public.ticket USING btree (type);


--
-- PostgreSQL database dump complete
--


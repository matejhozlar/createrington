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
-- Name: ticket_action; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ticket_action (
    id integer NOT NULL,
    ticket_id integer NOT NULL,
    action_type text NOT NULL,
    performed_by_discord_id text NOT NULL,
    performed_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.ticket_action OWNER TO postgres;

--
-- Name: TABLE ticket_action; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.ticket_action IS 'Audit log of all actions performed on ticket';


--
-- Name: ticket_action_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ticket_action_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.ticket_action_id_seq OWNER TO postgres;

--
-- Name: ticket_action_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ticket_action_id_seq OWNED BY public.ticket_action.id;


--
-- Name: ticket_action id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_action ALTER COLUMN id SET DEFAULT nextval('public.ticket_action_id_seq'::regclass);


--
-- Name: ticket_action ticket_action_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_action
    ADD CONSTRAINT ticket_action_pkey PRIMARY KEY (id);


--
-- Name: idx_ticket_action_ticket; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ticket_action_ticket ON public.ticket_action USING btree (ticket_id);


--
-- Name: idx_ticket_action_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ticket_action_type ON public.ticket_action USING btree (action_type);


--
-- Name: ticket_action ticket_action_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_action
    ADD CONSTRAINT ticket_action_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.ticket(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


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
-- Name: leaderboard_message; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leaderboard_message (
    id integer NOT NULL,
    leaderboard_type character varying(50) NOT NULL,
    channel_id text NOT NULL,
    message_id text NOT NULL,
    last_refreshed timestamp with time zone DEFAULT now(),
    last_manual_refresh timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.leaderboard_message OWNER TO postgres;

--
-- Name: leaderboard_message_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.leaderboard_message_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.leaderboard_message_id_seq OWNER TO postgres;

--
-- Name: leaderboard_message_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.leaderboard_message_id_seq OWNED BY public.leaderboard_message.id;


--
-- Name: leaderboard_message id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leaderboard_message ALTER COLUMN id SET DEFAULT nextval('public.leaderboard_message_id_seq'::regclass);


--
-- Name: leaderboard_message leaderboard_message_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leaderboard_message
    ADD CONSTRAINT leaderboard_message_pkey PRIMARY KEY (id);


--
-- Name: leaderboard_message uq_leaderboard_type; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leaderboard_message
    ADD CONSTRAINT uq_leaderboard_type UNIQUE (leaderboard_type);


--
-- Name: idx_leaderboard_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leaderboard_type ON public.leaderboard_message USING btree (leaderboard_type);


--
-- PostgreSQL database dump complete
--


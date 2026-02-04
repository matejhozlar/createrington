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
-- Name: discord_guild_member_join; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.discord_guild_member_join (
    join_number integer NOT NULL,
    user_id character varying(32) NOT NULL,
    username character varying(32) NOT NULL,
    joined_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.discord_guild_member_join OWNER TO postgres;

--
-- Name: TABLE discord_guild_member_join; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.discord_guild_member_join IS 'Tracks guild member join order with persistent sequential numbers';


--
-- Name: COLUMN discord_guild_member_join.join_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.discord_guild_member_join.join_number IS 'Unique sequential number assigned to each member (shown in welcome image)';


--
-- Name: COLUMN discord_guild_member_join.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.discord_guild_member_join.user_id IS 'Discord user snowflake ID';


--
-- Name: COLUMN discord_guild_member_join.username; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.discord_guild_member_join.username IS 'Username at the time of joining (for historical reference)';


--
-- Name: COLUMN discord_guild_member_join.joined_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.discord_guild_member_join.joined_at IS 'Timestamp when the member joined the guild';


--
-- Name: discord_guild_member_join_join_number_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.discord_guild_member_join_join_number_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.discord_guild_member_join_join_number_seq OWNER TO postgres;

--
-- Name: discord_guild_member_join_join_number_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.discord_guild_member_join_join_number_seq OWNED BY public.discord_guild_member_join.join_number;


--
-- Name: discord_guild_member_join join_number; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.discord_guild_member_join ALTER COLUMN join_number SET DEFAULT nextval('public.discord_guild_member_join_join_number_seq'::regclass);


--
-- Name: discord_guild_member_join discord_guild_member_join_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.discord_guild_member_join
    ADD CONSTRAINT discord_guild_member_join_pkey PRIMARY KEY (join_number);


--
-- Name: discord_guild_member_join idx_user_id; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.discord_guild_member_join
    ADD CONSTRAINT idx_user_id UNIQUE (user_id);


--
-- Name: idx_discord_guild_member_join_joined_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_discord_guild_member_join_joined_at ON public.discord_guild_member_join USING btree (joined_at DESC);


--
-- PostgreSQL database dump complete
--


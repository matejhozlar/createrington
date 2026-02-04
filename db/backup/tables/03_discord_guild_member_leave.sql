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
-- Name: discord_guild_member_leave; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.discord_guild_member_leave (
    id integer NOT NULL,
    discord_id text NOT NULL,
    minecraft_uuid uuid NOT NULL,
    minecraft_username text NOT NULL,
    departed_at timestamp with time zone DEFAULT now() NOT NULL,
    notification_message_id text,
    deleted_at timestamp with time zone
);


ALTER TABLE public.discord_guild_member_leave OWNER TO postgres;

--
-- Name: discord_guild_member_leave_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.discord_guild_member_leave_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.discord_guild_member_leave_id_seq OWNER TO postgres;

--
-- Name: discord_guild_member_leave_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.discord_guild_member_leave_id_seq OWNED BY public.discord_guild_member_leave.id;


--
-- Name: discord_guild_member_leave id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.discord_guild_member_leave ALTER COLUMN id SET DEFAULT nextval('public.discord_guild_member_leave_id_seq'::regclass);


--
-- Name: discord_guild_member_leave discord_guild_member_leave_discord_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.discord_guild_member_leave
    ADD CONSTRAINT discord_guild_member_leave_discord_id_key UNIQUE (discord_id);


--
-- Name: discord_guild_member_leave discord_guild_member_leave_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.discord_guild_member_leave
    ADD CONSTRAINT discord_guild_member_leave_pkey PRIMARY KEY (id);


--
-- Name: idx_discord_guild_member_leave_deleted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_discord_guild_member_leave_deleted_at ON public.discord_guild_member_leave USING btree (departed_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_discord_guild_member_leave_departed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_discord_guild_member_leave_departed_at ON public.discord_guild_member_leave USING btree (departed_at);


--
-- Name: idx_discord_guild_member_leave_discord_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_discord_guild_member_leave_discord_id ON public.discord_guild_member_leave USING btree (discord_id);


--
-- Name: idx_discord_guild_member_leave_minecraft_uuid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_discord_guild_member_leave_minecraft_uuid ON public.discord_guild_member_leave USING btree (minecraft_uuid);


--
-- PostgreSQL database dump complete
--


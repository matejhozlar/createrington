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
-- Name: discord_embed_preset; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.discord_embed_preset (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    data jsonb NOT NULL,
    created_by character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.discord_embed_preset OWNER TO postgres;

--
-- Name: discord_embed_preset_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.discord_embed_preset_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.discord_embed_preset_id_seq OWNER TO postgres;

--
-- Name: discord_embed_preset_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.discord_embed_preset_id_seq OWNED BY public.discord_embed_preset.id;


--
-- Name: discord_embed_preset id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.discord_embed_preset ALTER COLUMN id SET DEFAULT nextval('public.discord_embed_preset_id_seq'::regclass);


--
-- Name: discord_embed_preset discord_embed_preset_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.discord_embed_preset
    ADD CONSTRAINT discord_embed_preset_name_key UNIQUE (name);


--
-- Name: discord_embed_preset discord_embed_preset_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.discord_embed_preset
    ADD CONSTRAINT discord_embed_preset_pkey PRIMARY KEY (id);


--
-- Name: discord_embed_preset update_discord_embed_preset_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_discord_embed_preset_updated_at BEFORE UPDATE ON public.discord_embed_preset FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- PostgreSQL database dump complete
--


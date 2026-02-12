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
-- Name: faq_entry; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.faq_entry (
    id integer NOT NULL,
    pattern text NOT NULL,
    title character varying(100) NOT NULL,
    response text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.faq_entry OWNER TO postgres;

--
-- Name: faq_entry_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.faq_entry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.faq_entry_id_seq OWNER TO postgres;

--
-- Name: faq_entry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.faq_entry_id_seq OWNED BY public.faq_entry.id;


--
-- Name: faq_entry id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.faq_entry ALTER COLUMN id SET DEFAULT nextval('public.faq_entry_id_seq'::regclass);


--
-- Name: faq_entry faq_entry_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.faq_entry
    ADD CONSTRAINT faq_entry_pkey PRIMARY KEY (id);


--
-- Name: idx_faq_entry_enabled; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_faq_entry_enabled ON public.faq_entry USING btree (enabled);


--
-- Name: idx_faq_entry_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_faq_entry_priority ON public.faq_entry USING btree (priority DESC);


--
-- Name: faq_entry update_faq_entry_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_faq_entry_updated_at BEFORE UPDATE ON public.faq_entry FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- PostgreSQL database dump complete
--

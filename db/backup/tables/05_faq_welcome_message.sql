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
-- Name: faq_welcome_message; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.faq_welcome_message (
    id integer NOT NULL,
    channel_id text NOT NULL,
    message_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.faq_welcome_message OWNER TO postgres;

--
-- Name: faq_welcome_message_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.faq_welcome_message_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.faq_welcome_message_id_seq OWNER TO postgres;

--
-- Name: faq_welcome_message_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.faq_welcome_message_id_seq OWNED BY public.faq_welcome_message.id;


--
-- Name: faq_welcome_message id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.faq_welcome_message ALTER COLUMN id SET DEFAULT nextval('public.faq_welcome_message_id_seq'::regclass);


--
-- Name: faq_welcome_message faq_welcome_message_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.faq_welcome_message
    ADD CONSTRAINT faq_welcome_message_pkey PRIMARY KEY (id);


--
-- Name: faq_welcome_message uq_faq_welcome_channel_id; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.faq_welcome_message
    ADD CONSTRAINT uq_faq_welcome_channel_id UNIQUE (channel_id);


--
-- Name: faq_welcome_message update_faq_welcome_message_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_faq_welcome_message_updated_at BEFORE UPDATE ON public.faq_welcome_message FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- PostgreSQL database dump complete
--


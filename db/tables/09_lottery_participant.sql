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
-- Name: lottery_participant; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lottery_participant (
    id integer NOT NULL,
    minecraft_uuid uuid NOT NULL,
    minecraft_username text NOT NULL,
    amount bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.lottery_participant OWNER TO postgres;

--
-- Name: lottery_participant_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.lottery_participant ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.lottery_participant_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: lottery_participant lottery_participant_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lottery_participant
    ADD CONSTRAINT lottery_participant_pkey PRIMARY KEY (id);


--
-- Name: lottery_participant fk_lottery_participant_player; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lottery_participant
    ADD CONSTRAINT fk_lottery_participant_player FOREIGN KEY (minecraft_uuid) REFERENCES public.player(minecraft_uuid) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


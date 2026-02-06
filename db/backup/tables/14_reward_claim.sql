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
-- Name: reward_claim; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reward_claim (
    id integer NOT NULL,
    player_minecraft_uuid uuid NOT NULL,
    reward_type character varying(50) NOT NULL,
    claimed_at timestamp with time zone DEFAULT now() NOT NULL,
    amount bigint NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.reward_claim OWNER TO postgres;

--
-- Name: reward_claim_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reward_claim_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.reward_claim_id_seq OWNER TO postgres;

--
-- Name: reward_claim_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reward_claim_id_seq OWNED BY public.reward_claim.id;


--
-- Name: reward_claim id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reward_claim ALTER COLUMN id SET DEFAULT nextval('public.reward_claim_id_seq'::regclass);


--
-- Name: reward_claim reward_claim_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reward_claim
    ADD CONSTRAINT reward_claim_pkey PRIMARY KEY (id);


--
-- Name: reward_claim reward_claim_player_type_claimed; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reward_claim
    ADD CONSTRAINT reward_claim_player_type_claimed UNIQUE (player_minecraft_uuid, reward_type, claimed_at);


--
-- Name: idx_reward_claim_claimed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reward_claim_claimed_at ON public.reward_claim USING btree (claimed_at);


--
-- Name: idx_reward_claim_player; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reward_claim_player ON public.reward_claim USING btree (player_minecraft_uuid);


--
-- Name: idx_reward_claim_player_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reward_claim_player_type ON public.reward_claim USING btree (player_minecraft_uuid, reward_type);


--
-- Name: idx_reward_claim_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reward_claim_type ON public.reward_claim USING btree (reward_type);


--
-- Name: reward_claim reward_claim_player_minecraft_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reward_claim
    ADD CONSTRAINT reward_claim_player_minecraft_uuid_fkey FOREIGN KEY (player_minecraft_uuid) REFERENCES public.player(minecraft_uuid) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


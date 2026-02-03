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
-- Name: player_balance_transaction; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.player_balance_transaction (
    id integer NOT NULL,
    player_minecraft_uuid uuid NOT NULL,
    amount bigint NOT NULL,
    balance_before bigint NOT NULL,
    balance_after bigint NOT NULL,
    transaction_type text NOT NULL,
    description text,
    related_player_uuid uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.player_balance_transaction OWNER TO postgres;

--
-- Name: TABLE player_balance_transaction; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.player_balance_transaction IS 'Complete audit trail of all balance changes with 3 decimal precision';


--
-- Name: COLUMN player_balance_transaction.amount; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.player_balance_transaction.amount IS 'Amount changed (positive for credit, negative for debit) in smallest unit';


--
-- Name: COLUMN player_balance_transaction.balance_before; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.player_balance_transaction.balance_before IS 'Balance before transaction';


--
-- Name: COLUMN player_balance_transaction.balance_after; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.player_balance_transaction.balance_after IS 'Balance after transaction';


--
-- Name: COLUMN player_balance_transaction.transaction_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.player_balance_transaction.transaction_type IS 'Type of transaction for categorization';


--
-- Name: COLUMN player_balance_transaction.related_player_uuid; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.player_balance_transaction.related_player_uuid IS 'Related player (e.g., sender/receiver in transfers)';


--
-- Name: COLUMN player_balance_transaction.metadata; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.player_balance_transaction.metadata IS 'Additional context (item_id, admin_id, etc.)';


--
-- Name: player_balance_transaction_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.player_balance_transaction_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.player_balance_transaction_id_seq OWNER TO postgres;

--
-- Name: player_balance_transaction_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.player_balance_transaction_id_seq OWNED BY public.player_balance_transaction.id;


--
-- Name: player_balance_transaction id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_balance_transaction ALTER COLUMN id SET DEFAULT nextval('public.player_balance_transaction_id_seq'::regclass);


--
-- Name: player_balance_transaction player_balance_transaction_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_balance_transaction
    ADD CONSTRAINT player_balance_transaction_pkey PRIMARY KEY (id);


--
-- Name: idx_balance_transaction_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_balance_transaction_created ON public.player_balance_transaction USING btree (created_at DESC);


--
-- Name: idx_balance_transaction_player; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_balance_transaction_player ON public.player_balance_transaction USING btree (player_minecraft_uuid);


--
-- Name: idx_balance_transaction_related; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_balance_transaction_related ON public.player_balance_transaction USING btree (related_player_uuid) WHERE (related_player_uuid IS NOT NULL);


--
-- Name: idx_balance_transaction_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_balance_transaction_type ON public.player_balance_transaction USING btree (transaction_type);


--
-- Name: player_balance_transaction fk_player; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_balance_transaction
    ADD CONSTRAINT fk_player FOREIGN KEY (player_minecraft_uuid) REFERENCES public.player(minecraft_uuid) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_balance_transaction fk_related_player; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_balance_transaction
    ADD CONSTRAINT fk_related_player FOREIGN KEY (related_player_uuid) REFERENCES public.player(minecraft_uuid) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--


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
-- Name: player_balance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.player_balance (
    minecraft_uuid uuid NOT NULL,
    balance bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_balance_non_negative CHECK ((balance >= 0))
);


ALTER TABLE public.player_balance OWNER TO postgres;

--
-- Name: TABLE player_balance; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.player_balance IS 'Player balance with 3 decimal precision';


--
-- Name: COLUMN player_balance.balance; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.player_balance.balance IS 'Balance in smallest unit (3 decimal places). Divide by 1,000 for display. Example: 1000 = 1.000, 200 = 0.200';


--
-- Name: player_balance player_balance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_balance
    ADD CONSTRAINT player_balance_pkey PRIMARY KEY (minecraft_uuid);


--
-- Name: idx_player_balance_amount; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_balance_amount ON public.player_balance USING btree (balance DESC);


--
-- Name: idx_player_balance_uuid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_player_balance_uuid ON public.player_balance USING btree (minecraft_uuid);


--
-- Name: player_balance update_player_balance_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_player_balance_updated_at BEFORE UPDATE ON public.player_balance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: player_balance fk_player; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_balance
    ADD CONSTRAINT fk_player FOREIGN KEY (minecraft_uuid) REFERENCES public.player(minecraft_uuid) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


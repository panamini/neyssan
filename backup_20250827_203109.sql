--
-- PostgreSQL database dump
--

\restrict Qqsb2nYl121GjQqhxYkeBvWJ1u4lhfcVZzUCPPxcwWGVcei7jUmcFoAMhoKZG3T

-- Dumped from database version 15.14 (Debian 15.14-1.pgdg13+1)
-- Dumped by pg_dump version 15.14 (Debian 15.14-1.pgdg13+1)

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
-- Name: llm_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.llm_history (
    id integer NOT NULL,
    convex_attempts integer DEFAULT 0,
    convex_idempotency_key text,
    convex_last_attempt_at bigint,
    convex_write_status text,
    convex_error text,
    convex_written_at bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.llm_history OWNER TO postgres;

--
-- Name: llm_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.llm_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.llm_history_id_seq OWNER TO postgres;

--
-- Name: llm_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.llm_history_id_seq OWNED BY public.llm_history.id;


--
-- Name: llm_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.llm_history ALTER COLUMN id SET DEFAULT nextval('public.llm_history_id_seq'::regclass);


--
-- Data for Name: llm_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.llm_history (id, convex_attempts, convex_idempotency_key, convex_last_attempt_at, convex_write_status, convex_error, convex_written_at, created_at, updated_at) FROM stdin;
\.


--
-- Name: llm_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.llm_history_id_seq', 1, false);


--
-- Name: llm_history llm_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.llm_history
    ADD CONSTRAINT llm_history_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

\unrestrict Qqsb2nYl121GjQqhxYkeBvWJ1u4lhfcVZzUCPPxcwWGVcei7jUmcFoAMhoKZG3T


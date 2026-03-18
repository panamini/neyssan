--
-- PostgreSQL database dump
--

\restrict lfY5WD30nLBsJHa5RLa18Y9TGvj5tE0IivDI1V1gyoFsYrJNyiRqmjBaICC4AzA

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

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alembic_version (
    version_num character varying(64)
);


ALTER TABLE public.alembic_version OWNER TO postgres;

--
-- Name: llm_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.llm_history (
    id uuid NOT NULL,
    profile_id uuid NOT NULL,
    run_time timestamp with time zone DEFAULT now() NOT NULL,
    provider text,
    model text,
    job_id text,
    request_payload jsonb,
    response_snippet text,
    full_response jsonb,
    confidence double precision,
    merged boolean DEFAULT false,
    merge_notes text,
    convex_write_status text,
    convex_error text,
    convex_written_at bigint,
    convex_idempotency_key text,
    convex_attempts integer,
    convex_last_attempt_at bigint
);


ALTER TABLE public.llm_history OWNER TO postgres;

--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.alembic_version (version_num) FROM stdin;
0003_add_profile_columns
\.


--
-- Data for Name: llm_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.llm_history (id, profile_id, run_time, provider, model, job_id, request_payload, response_snippet, full_response, confidence, merged, merge_notes, convex_write_status, convex_error, convex_written_at, convex_idempotency_key, convex_attempts, convex_last_attempt_at) FROM stdin;
\.


--
-- Name: llm_history llm_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.llm_history
    ADD CONSTRAINT llm_history_pkey PRIMARY KEY (id);


--
-- Name: ix_llm_history_job_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_llm_history_job_id ON public.llm_history USING btree (job_id);


--
-- Name: ix_llm_history_profile_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_llm_history_profile_id ON public.llm_history USING btree (profile_id);


--
-- PostgreSQL database dump complete
--

\unrestrict lfY5WD30nLBsJHa5RLa18Y9TGvj5tE0IivDI1V1gyoFsYrJNyiRqmjBaICC4AzA


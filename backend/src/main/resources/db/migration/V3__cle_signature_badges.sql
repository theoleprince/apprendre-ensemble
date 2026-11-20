-- V3 : cle de signature des certificats numeriques (Open Badges 3.0). Migration additive.
CREATE TABLE public.signing_key (
    kid character varying(64) NOT NULL,
    jwk character varying(8000) NOT NULL,
    created_at timestamp(6) with time zone,
    CONSTRAINT signing_key_pkey PRIMARY KEY (kid)
);

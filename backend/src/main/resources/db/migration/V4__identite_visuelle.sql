-- V4 : identite visuelle parametrable (charte graphique du client). Migration additive.
CREATE TABLE public.branding (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    organization character varying(255),
    tagline character varying(300),
    logo_url character varying(255),
    primary_color character varying(7) NOT NULL,
    accent_color character varying(7) NOT NULL,
    support_email character varying(255),
    footer_note character varying(255),
    signatory1 character varying(255),
    signatory1_role character varying(255),
    signatory2 character varying(255),
    signatory2_role character varying(255),
    updated_at timestamp(6) with time zone,
    updated_by character varying(255),
    CONSTRAINT branding_pkey PRIMARY KEY (id)
);

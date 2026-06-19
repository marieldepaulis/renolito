-- ============================================================
-- PLATAFORMA AUDIOVISUAL SAAS — SUPABASE MIGRATION v1.0.0
-- ============================================================
-- 8 Domains · 25 Tables · 14 Enums · RLS Policies · Triggers
-- · Views · Seed Data
--
-- Execution order matters: tables created before their FK targets
-- will fail. This file is ordered to respect all dependencies.
--
-- Multi-tenant strategy: every sensitive table carries
-- organization_id (denormalized where needed for RLS performance).
-- The is_org_member() / is_org_owner() helpers keep all policies
-- readable and consistent.
--
-- Guest access (registration form + status tracking) is handled
-- server-side (Next.js API routes with service role key) so that
-- anon users never touch the DB directly. Comments throughout the
-- file indicate where that boundary applies.
-- ============================================================


-- ============================================================
-- SECTION 0 — EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";


-- ============================================================
-- SECTION 1 — ENUMS
-- ============================================================

CREATE TYPE public.org_member_role AS ENUM (
  'owner',
  'coordinator',
  'staff'
);

CREATE TYPE public.subscription_status AS ENUM (
  'active',
  'trialing',
  'past_due',
  'cancelled'
);

CREATE TYPE public.project_status AS ENUM (
  'draft',
  'active',
  'completed',
  'archived'
);

CREATE TYPE public.session_status AS ENUM (
  'scheduled',
  'in_progress',
  'completed',
  'cancelled'
);

CREATE TYPE public.application_status AS ENUM (
  'pending',
  'pre_approved',
  'contract_sent',
  'confirmed',
  'rejected',
  'waitlisted',
  'cancelled'
);

CREATE TYPE public.cancellation_actor AS ENUM (
  'applicant',
  'producer',
  'system'
);

CREATE TYPE public.job_offer_status AS ENUM (
  'open',
  'filled',
  'closed',
  'cancelled'
);

CREATE TYPE public.rate_unit AS ENUM (
  'hour',
  'day',
  'project',
  'flat'
);

CREATE TYPE public.contract_status AS ENUM (
  'draft',
  'sent',
  'viewed',
  'signed_by_party',
  'fully_signed',
  'rejected',
  'cancelled'
);

CREATE TYPE public.form_field_type AS ENUM (
  'text',
  'email',
  'tel',
  'url',
  'textarea',
  'select',
  'multiselect',
  'file',
  'checkbox',
  'number',
  'date'
);

CREATE TYPE public.income_type AS ENUM (
  'artist_payment',
  'sponsor_cash',
  'other'
);

CREATE TYPE public.expense_type AS ENUM (
  'staff_fee',
  'catering',
  'transport',
  'equipment_rental',
  'venue',
  'other'
);

CREATE TYPE public.notification_status AS ENUM (
  'pending',
  'sent',
  'failed',
  'bounced'
);


-- ============================================================
-- SECTION 2 — HELPER FUNCTIONS
-- (declared before triggers and RLS policies that use them)
-- ============================================================

-- Generic updated_at updater — attached to every table that has the column.
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Auto-creates a profile row the moment Supabase Auth creates a user.
-- Runs as SECURITY DEFINER so it can write to public.profiles even
-- when triggered from the auth schema.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

-- Converts any free-text into a URL-safe slug, handling Spanish diacritics.
CREATE OR REPLACE FUNCTION public.generate_slug(input_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result text;
BEGIN
  result := lower(trim(unaccent(input_text)));
  result := regexp_replace(result, '[^a-z0-9]+', '-', 'g');
  result := trim(both '-' from result);
  RETURN result;
END;
$$;

-- Returns a slug that does not yet exist in organizations.slug,
-- appending -1, -2, … if the base slug is already taken.
CREATE OR REPLACE FUNCTION public.unique_org_slug(base_slug text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  candidate text;
  counter   int := 0;
BEGIN
  candidate := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = candidate) LOOP
    counter   := counter + 1;
    candidate := base_slug || '-' || counter;
  END LOOP;
  RETURN candidate;
END;
$$;

-- NOTE: is_org_member() and is_org_owner() are declared AFTER the
-- tables section because they reference public.organization_members
-- and public.organizations, which must exist first.


-- ============================================================
-- SECTION 3 — TABLES
-- (created in FK-dependency order)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- DOMAIN 1 · IDENTITY & ROLES
-- ────────────────────────────────────────────────────────────

-- Extends auth.users with public-facing profile data.
-- A trigger (Section 5) populates this automatically on signup.
CREATE TABLE public.profiles (
  id         uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  text        NOT NULL DEFAULT '',
  email      text        NOT NULL,
  phone      text,
  city       text,
  country    text        NOT NULL DEFAULT 'ES',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_email_unique UNIQUE (email)
);
COMMENT ON TABLE public.profiles IS
  'Public user profile extending auth.users. Created automatically via trigger on signup.';

-- Platform-managed master list of professional specialties.
-- Users choose from this list; they cannot invent new ones.
-- Administrators add new specialties via migrations or the Supabase dashboard.
CREATE TABLE public.specialties (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL UNIQUE,
  slug          text        NOT NULL UNIQUE,
  category      text        NOT NULL,  -- 'video' | 'audio' | 'photo' | 'production' | 'art' | 'other'
  display_order int         NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.specialties IS
  'Master list of technician specialties. Platform-managed; not user-editable.';

-- Extended profile for users who offer technical services.
-- Specialties are stored in technician_specialties (many-to-many).
CREATE TABLE public.technician_profiles (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid        NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  bio                   text,
  portfolio_url         text,
  instagram_url         text,
  website_url           text,
  equipment_description text,
  daily_rate            numeric(10,2),
  rate_currency         text        NOT NULL DEFAULT 'EUR',
  is_available_for_hire boolean     NOT NULL DEFAULT false,
  years_experience      int,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.technician_profiles IS
  'One-to-one extension of profiles for technical professionals. '
  'Specialties live in technician_specialties (many-to-many). '
  'is_available_for_hire controls visibility in the Pro directory.';

-- Junction table: a technician can have multiple specialties simultaneously.
-- is_primary = true marks the specialty shown in compact listings.
CREATE TABLE public.technician_specialties (
  technician_id uuid        NOT NULL REFERENCES public.technician_profiles(id) ON DELETE CASCADE,
  specialty_id  uuid        NOT NULL REFERENCES public.specialties(id)          ON DELETE CASCADE,
  is_primary    boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (technician_id, specialty_id)
);
COMMENT ON TABLE public.technician_specialties IS
  'Many-to-many: one technician → many specialties. '
  'Enables directory search by any of a technician''s specialties (e.g., Fotografía AND Iluminación).';

-- The multi-tenant unit. Every production company/studio is one organization.
-- All business data is isolated at the organization level via RLS.
CREATE TABLE public.organizations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid        NOT NULL REFERENCES public.profiles(id),
  name          text        NOT NULL,
  slug          text        NOT NULL UNIQUE, -- auto-generated from name; editable by owner
  logo_url      text,
  bio           text,
  website_url   text,
  instagram_url text,
  city          text,
  country       text        NOT NULL DEFAULT 'ES',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.organizations IS
  'Multi-tenant root. Each production company is one org. '
  'slug auto-generated from name on INSERT; owner can later edit it.';

-- Controls who has access to each organization's workspace.
-- The owner is inserted automatically via trigger on org creation.
CREATE TABLE public.organization_members (
  id              uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid                  NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid                  NOT NULL REFERENCES public.profiles(id)      ON DELETE CASCADE,
  role            public.org_member_role NOT NULL DEFAULT 'staff',
  invited_at      timestamptz           NOT NULL DEFAULT now(),
  accepted_at     timestamptz,           -- NULL means invitation is pending
  CONSTRAINT organization_members_unique UNIQUE (organization_id, user_id)
);
COMMENT ON TABLE public.organization_members IS
  'Workspace access control. owner auto-inserted on org creation. '
  'accepted_at NULL = pending invitation.';

-- ────────────────────────────────────────────────────────────
-- DOMAIN 2 · SUBSCRIPTIONS
-- ────────────────────────────────────────────────────────────

-- Feature flags per plan. Populated by seed data; updated via migrations.
-- Never updated directly by user actions.
CREATE TABLE public.subscription_plans (
  id                              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  name                            text          NOT NULL UNIQUE,
  display_name                    text          NOT NULL,
  max_active_projects             int,          -- NULL = unlimited
  max_team_members                int,          -- NULL = unlimited
  can_post_jobs                   boolean       NOT NULL DEFAULT false,
  can_custom_form_fields          boolean       NOT NULL DEFAULT false,
  can_custom_project_types        boolean       NOT NULL DEFAULT false,
  can_custom_contracts            boolean       NOT NULL DEFAULT false,
  can_search_technician_directory boolean       NOT NULL DEFAULT false,
  price_monthly_eur               numeric(10,2) NOT NULL DEFAULT 0,
  price_annual_eur                numeric(10,2) NOT NULL DEFAULT 0,
  created_at                      timestamptz   NOT NULL DEFAULT now()
);

-- Active subscription for each organization.
-- INSERT/UPDATE triggered by Stripe webhooks (server-side service role).
CREATE TABLE public.organization_subscriptions (
  id                       uuid                       PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          uuid                       NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id                  uuid                       NOT NULL REFERENCES public.subscription_plans(id),
  status                   public.subscription_status NOT NULL DEFAULT 'trialing',
  payment_provider         text,                      -- 'stripe' | 'manual'
  external_subscription_id text,                      -- Stripe subscription ID
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  cancelled_at             timestamptz,
  created_at               timestamptz                NOT NULL DEFAULT now(),
  updated_at               timestamptz                NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- DOMAIN 3 · PROJECTS & SESSIONS
-- ────────────────────────────────────────────────────────────

-- 6 system types (organization_id = NULL) plus custom Pro types.
CREATE TABLE public.project_types (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        REFERENCES public.organizations(id) ON DELETE CASCADE, -- NULL = system type
  name            text        NOT NULL,
  slug            text        NOT NULL,
  icon            text,
  is_system       boolean     NOT NULL DEFAULT false,
  display_order   int         NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_types_slug_org_unique UNIQUE (organization_id, slug)
);
COMMENT ON COLUMN public.project_types.organization_id IS
  'NULL = platform-defined type visible to all. '
  'Non-NULL = custom type created by a Pro organization.';

CREATE TABLE public.projects (
  id                          uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             uuid                  NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_type_id             uuid                  NOT NULL REFERENCES public.project_types(id),
  created_by                  uuid                  NOT NULL REFERENCES public.profiles(id),
  title                       text                  NOT NULL,
  description                 text,
  cover_image_url             text,
  status                      public.project_status NOT NULL DEFAULT 'draft',
  registration_open           boolean               NOT NULL DEFAULT true,
  registration_status         text                  NOT NULL DEFAULT 'closed',
  registration_link_token     text                  NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  hide_status_from_applicants boolean               NOT NULL DEFAULT false,
  is_public                   boolean               NOT NULL DEFAULT true,
  requires_session_selection  boolean               NOT NULL DEFAULT false,
  start_date                  date,
  end_date                    date,
  max_participants            integer               CHECK (max_participants > 0),
  location                    text,
  created_at                  timestamptz           NOT NULL DEFAULT now(),
  updated_at                  timestamptz           NOT NULL DEFAULT now()
);
COMMENT ON COLUMN public.projects.registration_link_token IS
  'Forms the public registration URL: /inscripcion/{token}. '
  'Fetched server-side (service role) so anon users never query the DB directly.';
COMMENT ON COLUMN public.projects.hide_status_from_applicants IS
  'When TRUE, status tracking page shows "En revisión" regardless of real status.';

-- Sessions are children of a project. One project may have many sessions
-- (e.g. "Banda A – Sábado" and "Banda B – Domingo").
-- organization_id is denormalized from projects for efficient RLS.
CREATE TABLE public.sessions (
  id                uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid                  NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id   uuid                  NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title             text                  NOT NULL,
  scheduled_date    date                  NOT NULL,
  start_time        time,
  end_time          time,
  location          text,
  location_address  text,
  location_maps_url text,
  internal_notes    text,
  status            public.session_status NOT NULL DEFAULT 'scheduled',
  created_at        timestamptz           NOT NULL DEFAULT now(),
  updated_at        timestamptz           NOT NULL DEFAULT now()
);
COMMENT ON COLUMN public.sessions.organization_id IS
  'Denormalized from projects.organization_id. '
  'Set automatically by trigger; never set manually.';

-- Optional quota caps per role per session.
-- Current confirmed count is computed via query, never stored, to prevent drift.
CREATE TABLE public.session_slots (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  role_name  text        NOT NULL,
  max_slots  int         NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- DOMAIN 4 · DYNAMIC FORMS
-- ────────────────────────────────────────────────────────────

-- Defines every possible form field.
-- project_type_id = NULL → common field shown on all project types.
-- organization_id = NULL → system-defined field.
-- organization_id IS NOT NULL → custom field added by a Pro org.
CREATE TABLE public.form_field_definitions (
  id              uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  project_type_id uuid                   REFERENCES public.project_types(id) ON DELETE CASCADE,
  organization_id uuid                   REFERENCES public.organizations(id)  ON DELETE CASCADE,
  field_key       text                   NOT NULL,
  label           text                   NOT NULL,
  field_type      public.form_field_type NOT NULL,
  placeholder     text,
  helper_text     text,
  is_required     boolean                NOT NULL DEFAULT false,
  options         jsonb,                 -- [{value: string, label: string}] for select/multiselect
  display_order   int                    NOT NULL DEFAULT 0,
  is_system       boolean                NOT NULL DEFAULT false,
  created_at      timestamptz            NOT NULL DEFAULT now(),
  CONSTRAINT ffd_unique UNIQUE (project_type_id, organization_id, field_key)
);
COMMENT ON COLUMN public.form_field_definitions.project_type_id IS 'NULL = common field on all project types.';
COMMENT ON COLUMN public.form_field_definitions.organization_id IS 'NULL = system field. Set for Pro custom fields.';
COMMENT ON COLUMN public.form_field_definitions.options IS
  'JSON array of {value, label} pairs for select/multiselect fields. '
  'Example: [{"value":"guitar","label":"Guitarra"},{"value":"bass","label":"Bajo"}]';

-- Pro-only: lets each org toggle, relabel, or reorder system form fields.
CREATE TABLE public.organization_field_settings (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid        NOT NULL REFERENCES public.organizations(id)          ON DELETE CASCADE,
  field_definition_id uuid        NOT NULL REFERENCES public.form_field_definitions(id) ON DELETE CASCADE,
  is_active           boolean     NOT NULL DEFAULT true,
  is_required         boolean,    -- NULL = inherit from field definition
  custom_label        text,       -- NULL = inherit from field definition
  display_order       int,        -- NULL = inherit from field definition
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_field_settings_unique UNIQUE (organization_id, field_definition_id)
);
COMMENT ON TABLE public.organization_field_settings IS
  'Pro-only overrides for system form fields per organization. '
  'NULL columns inherit their value from the underlying form_field_definitions row.';

-- ────────────────────────────────────────────────────────────
-- DOMAIN 5 · APPLICATIONS — MODULE 1 CORE
-- ────────────────────────────────────────────────────────────

-- Artist/musician/model inscription for a project.
-- Supports both guest (no login) and registered users.
-- organization_id denormalized from projects for RLS.
CREATE TABLE public.artist_applications (
  id                   uuid                      PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           uuid                      NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id      uuid                      NOT NULL REFERENCES public.organizations(id),
  preferred_session_id uuid                      REFERENCES public.sessions(id),
  assigned_session_id  uuid                      REFERENCES public.sessions(id),
  assigned_slot_id     uuid                      REFERENCES public.session_slots(id),
  -- Identity (guest path: user_id stays NULL; registered path: user_id is set)
  user_id              uuid                      REFERENCES public.profiles(id),
  guest_email          text                      NOT NULL,
  guest_name           text                      NOT NULL,
  -- Token for the private status-tracking URL: /estado/{access_token}
  -- Handled server-side only; never returned to unauthenticated browser requests.
  access_token         text                      NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  -- Status flow
  status               public.application_status NOT NULL DEFAULT 'pending',
  status_updated_at    timestamptz,
  status_updated_by    uuid                      REFERENCES public.profiles(id),
  -- Internal data
  producer_notes       text,
  cancellation_reason  text,
  cancelled_by         public.cancellation_actor,
  cancelled_at         timestamptz,
  -- Timestamps
  submitted_at         timestamptz               NOT NULL DEFAULT now(),
  created_at           timestamptz               NOT NULL DEFAULT now(),
  updated_at           timestamptz               NOT NULL DEFAULT now()
);
COMMENT ON COLUMN public.artist_applications.access_token IS
  'One-time token for the private status page. '
  'Read only via Next.js API route with service role — never exposed in client RLS queries.';
COMMENT ON COLUMN public.artist_applications.organization_id IS
  'Denormalized from projects.organization_id. Set automatically by trigger.';

-- One row per dynamic form field answered.
-- field_label is snapshotted at submission time so labels remain accurate
-- even if the field definition is later renamed.
CREATE TABLE public.artist_application_answers (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid        NOT NULL REFERENCES public.artist_applications(id) ON DELETE CASCADE,
  field_key      text        NOT NULL,
  field_label    text        NOT NULL,
  -- Flexible JSONB value:
  --   text/email/tel/url/number/date → plain string or number
  --   textarea                       → plain string
  --   select                         → plain string (the chosen value)
  --   multiselect                    → string array ["val1","val2"]
  --   file                           → {url: string, filename: string, size: number}
  --   checkbox                       → boolean
  answer         jsonb       NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Job postings created by Pro producers (Bolsa de Trabajo).
-- target_technician_id = NULL → public board offer.
-- target_technician_id IS NOT NULL → direct invitation from the Pro directory.
CREATE TABLE public.job_offers (
  id                   uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid                    NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id           uuid                    NOT NULL REFERENCES public.projects(id)       ON DELETE CASCADE,
  session_id           uuid                    REFERENCES public.sessions(id),
  created_by           uuid                    NOT NULL REFERENCES public.profiles(id),
  title                text                    NOT NULL,
  description          text                    NOT NULL,
  speciality           text                    NOT NULL,
  is_paid              boolean                 NOT NULL DEFAULT true,
  is_barter            boolean                 NOT NULL DEFAULT false,
  estimated_rate       numeric(10,2),
  rate_unit            public.rate_unit,
  rate_currency        text                    NOT NULL DEFAULT 'EUR',
  barter_description   text,
  target_technician_id uuid                    REFERENCES public.technician_profiles(id),
  status               public.job_offer_status NOT NULL DEFAULT 'open',
  max_applicants       int,
  required_date        date,
  location             text,
  created_at           timestamptz             NOT NULL DEFAULT now(),
  updated_at           timestamptz             NOT NULL DEFAULT now(),
  CONSTRAINT job_offer_barter_needs_description CHECK (
    is_barter = false OR (is_barter = true AND barter_description IS NOT NULL)
  )
);

-- Technician application to a job offer.
-- proposed_rate: what the technician quotes; agreed_rate: what the producer locks in.
-- organization_id denormalized from job_offers for RLS.
CREATE TABLE public.technician_applications (
  id                  uuid                      PRIMARY KEY DEFAULT gen_random_uuid(),
  job_offer_id        uuid                      NOT NULL REFERENCES public.job_offers(id)          ON DELETE CASCADE,
  technician_id       uuid                      NOT NULL REFERENCES public.technician_profiles(id),
  organization_id     uuid                      NOT NULL REFERENCES public.organizations(id),
  status              public.application_status NOT NULL DEFAULT 'pending',
  cover_note          text,
  proposed_rate       numeric(10,2),
  agreed_rate         numeric(10,2),
  status_updated_at   timestamptz,
  status_updated_by   uuid                      REFERENCES public.profiles(id),
  cancellation_reason text,
  cancelled_by        public.cancellation_actor,
  cancelled_at        timestamptz,
  submitted_at        timestamptz               NOT NULL DEFAULT now(),
  created_at          timestamptz               NOT NULL DEFAULT now(),
  updated_at          timestamptz               NOT NULL DEFAULT now(),
  CONSTRAINT technician_applications_unique UNIQUE (job_offer_id, technician_id)
);
COMMENT ON COLUMN public.technician_applications.organization_id IS
  'Denormalized from job_offers.organization_id. Set automatically by trigger.';
COMMENT ON COLUMN public.technician_applications.agreed_rate IS
  'Set by the producer after negotiation. Feeds into expense_items as staff_fee.';

-- ────────────────────────────────────────────────────────────
-- DOMAIN 6 · CONTRACTS
-- ────────────────────────────────────────────────────────────

-- Reusable contract templates per organization (Pro feature).
-- content_template uses {{placeholder}} syntax.
-- Available vars: {{artist_name}}, {{artist_email}}, {{technician_name}},
-- {{technician_email}}, {{project_title}}, {{session_date}}, {{session_location}},
-- {{organization_name}}, {{agreed_rate}}, {{today_date}}, {{contract_id}}
CREATE TABLE public.contract_templates (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  applies_to       text        NOT NULL,
  project_type_id  uuid        REFERENCES public.project_types(id),
  content_template text        NOT NULL,
  is_default       boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contract_templates_applies_to_check CHECK (applies_to IN ('artist', 'technician'))
);

-- Instantiated contracts. content is the fully rendered text — immutable after signing.
-- Exactly one of artist_application_id / technician_application_id must be set.
-- signing_token powers the link sent to the party: /contrato/{signing_token}
CREATE TABLE public.contracts (
  id                        uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           uuid                   NOT NULL REFERENCES public.organizations(id),
  template_id               uuid                   REFERENCES public.contract_templates(id),
  artist_application_id     uuid                   REFERENCES public.artist_applications(id),
  technician_application_id uuid                   REFERENCES public.technician_applications(id),
  content                   text                   NOT NULL,
  status                    public.contract_status NOT NULL DEFAULT 'draft',
  signing_token             text                   NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  signed_by_party_at        timestamptz,
  signed_by_party_ip        text,
  signed_by_producer_at     timestamptz,
  signed_by_producer_id     uuid                   REFERENCES public.profiles(id),
  sent_at                   timestamptz,
  viewed_at                 timestamptz,
  expires_at                timestamptz,
  created_at                timestamptz            NOT NULL DEFAULT now(),
  updated_at                timestamptz            NOT NULL DEFAULT now(),
  CONSTRAINT contracts_exactly_one_party CHECK (
    (artist_application_id     IS NOT NULL AND technician_application_id IS NULL) OR
    (artist_application_id     IS NULL     AND technician_application_id IS NOT NULL)
  )
);
COMMENT ON COLUMN public.contracts.content IS
  'Fully rendered contract text — all placeholders replaced with real data. '
  'Never modified after signing (legal immutability).';
COMMENT ON COLUMN public.contracts.signing_token IS
  'Powers signing URL: /contrato/{token}. Validated server-side with service role.';

-- ────────────────────────────────────────────────────────────
-- DOMAIN 7 · FINANCIALS
-- ────────────────────────────────────────────────────────────

-- One financial record per session. Balance is computed by session_balance_view,
-- never stored as a column — prevents desync bugs.
CREATE TABLE public.session_financials (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid        NOT NULL UNIQUE REFERENCES public.sessions(id) ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES public.organizations(id),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.session_financials IS
  'One record per session. Balance = SUM(income) - SUM(non-barter expenses), '
  'computed in real time by session_balance_view.';

CREATE TABLE public.income_items (
  id                    uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  session_financial_id  uuid               NOT NULL REFERENCES public.session_financials(id) ON DELETE CASCADE,
  description           text               NOT NULL,
  type                  public.income_type NOT NULL,
  amount                numeric(10,2)      NOT NULL CHECK (amount >= 0),
  currency              text               NOT NULL DEFAULT 'EUR',
  artist_application_id uuid               REFERENCES public.artist_applications(id),
  received_at           date,
  notes                 text,
  created_at            timestamptz        NOT NULL DEFAULT now()
);

-- is_barter = TRUE means a sponsor covers this cost in kind.
-- The amount is still recorded (real market value for reporting),
-- but the balance view excludes barter expenses from the cash total.
-- sponsor_name is required when is_barter = TRUE (enforced by CHECK).
CREATE TABLE public.expense_items (
  id                         uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
  session_financial_id       uuid                NOT NULL REFERENCES public.session_financials(id) ON DELETE CASCADE,
  description                text                NOT NULL,
  type                       public.expense_type NOT NULL,
  amount                     numeric(10,2)       NOT NULL CHECK (amount >= 0),
  currency                   text                NOT NULL DEFAULT 'EUR',
  is_barter                  boolean             NOT NULL DEFAULT false,
  sponsor_name               text,
  technician_application_id  uuid                REFERENCES public.technician_applications(id),
  paid_at                    date,
  notes                      text,
  created_at                 timestamptz         NOT NULL DEFAULT now(),
  CONSTRAINT expense_barter_needs_sponsor CHECK (
    is_barter = false OR (is_barter = true AND sponsor_name IS NOT NULL)
  )
);
COMMENT ON COLUMN public.expense_items.is_barter IS
  'TRUE = sponsor covers this expense in kind. Financial cash cost = 0 in the balance. '
  'The amount column still holds the real market value for reporting.';

-- ────────────────────────────────────────────────────────────
-- DOMAIN 8 · SYSTEM
-- ────────────────────────────────────────────────────────────

-- Immutable audit trail. Never UPDATE or DELETE rows.
-- actor_id = NULL means the action was triggered by an automated system process.
CREATE TABLE public.activity_logs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id        uuid        REFERENCES public.profiles(id),
  entity_type     text        NOT NULL,
  entity_id       uuid        NOT NULL,
  action          text        NOT NULL,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.activity_logs IS
  'Immutable audit log. Rows must never be updated or deleted. '
  'entity_type examples: artist_application, contract, session, job_offer, expense_item. '
  'action examples: status_changed, contract_sent, session_created, field_updated.';

-- Outbound email queue. Processed by a Next.js background job or Supabase Edge Function.
CREATE TABLE public.email_notifications (
  id              uuid                       PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid                       REFERENCES public.organizations(id),
  recipient_email text                       NOT NULL,
  recipient_name  text,
  template_name   text                       NOT NULL,
  subject         text                       NOT NULL,
  body_html       text                       NOT NULL,
  body_text       text,
  metadata        jsonb,
  status          public.notification_status NOT NULL DEFAULT 'pending',
  attempts        int                        NOT NULL DEFAULT 0,
  sent_at         timestamptz,
  error_message   text,
  created_at      timestamptz                NOT NULL DEFAULT now()
);
COMMENT ON COLUMN public.email_notifications.template_name IS
  'Template identifier for the email renderer. '
  'Examples: pre_approval_artist, contract_sent, application_rejected, '
  'technician_pre_approved, status_tracking_reminder.';


-- ============================================================
-- SECTION 3b — RLS HELPER FUNCTIONS
-- (declared here, after all tables, because they query tables
--  that must already exist before the function body is parsed)
-- ============================================================

-- TRUE when the calling user is an accepted member of an org.
CREATE OR REPLACE FUNCTION public.is_org_member(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.organization_members
    WHERE  organization_id = p_organization_id
      AND  user_id         = auth.uid()
      AND  accepted_at     IS NOT NULL
  );
$$;

-- TRUE when the calling user is the owner of an org.
CREATE OR REPLACE FUNCTION public.is_org_owner(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.organizations
    WHERE  id       = p_organization_id
      AND  owner_id = auth.uid()
  );
$$;


-- ============================================================
-- SECTION 4 — INDEXES
-- ============================================================

CREATE INDEX idx_profiles_email
  ON public.profiles (email);

CREATE INDEX idx_technician_profiles_user_id
  ON public.technician_profiles (user_id);
CREATE INDEX idx_technician_profiles_available
  ON public.technician_profiles (is_available_for_hire)
  WHERE is_available_for_hire = true;

CREATE INDEX idx_technician_specialties_specialty
  ON public.technician_specialties (specialty_id);

CREATE INDEX idx_specialties_category
  ON public.specialties (category, display_order);

CREATE INDEX idx_organizations_owner
  ON public.organizations (owner_id);
CREATE INDEX idx_organizations_slug
  ON public.organizations (slug);

CREATE INDEX idx_org_members_user
  ON public.organization_members (user_id);
CREATE INDEX idx_org_members_org_accepted
  ON public.organization_members (organization_id, accepted_at)
  WHERE accepted_at IS NOT NULL;

CREATE INDEX idx_projects_org
  ON public.projects (organization_id);
CREATE INDEX idx_projects_token
  ON public.projects (registration_link_token);
CREATE INDEX idx_projects_org_status
  ON public.projects (organization_id, status);

CREATE INDEX idx_sessions_project
  ON public.sessions (project_id);
CREATE INDEX idx_sessions_org
  ON public.sessions (organization_id);
CREATE INDEX idx_sessions_date
  ON public.sessions (scheduled_date);

CREATE INDEX idx_ffd_project_type
  ON public.form_field_definitions (project_type_id);
CREATE INDEX idx_ffd_org
  ON public.form_field_definitions (organization_id)
  WHERE organization_id IS NOT NULL;

CREATE INDEX idx_artist_apps_project
  ON public.artist_applications (project_id);
CREATE INDEX idx_artist_apps_org
  ON public.artist_applications (organization_id);
CREATE INDEX idx_artist_apps_org_status
  ON public.artist_applications (organization_id, status);
CREATE INDEX idx_artist_apps_token
  ON public.artist_applications (access_token);
CREATE INDEX idx_artist_apps_user
  ON public.artist_applications (user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX idx_artist_apps_assigned_session
  ON public.artist_applications (assigned_session_id)
  WHERE assigned_session_id IS NOT NULL;

CREATE INDEX idx_answers_application
  ON public.artist_application_answers (application_id);
CREATE INDEX idx_answers_field_key
  ON public.artist_application_answers (field_key);

CREATE INDEX idx_job_offers_org
  ON public.job_offers (organization_id);
CREATE INDEX idx_job_offers_project
  ON public.job_offers (project_id);
CREATE INDEX idx_job_offers_open
  ON public.job_offers (speciality, status)
  WHERE status = 'open';

CREATE INDEX idx_tech_apps_offer
  ON public.technician_applications (job_offer_id);
CREATE INDEX idx_tech_apps_technician
  ON public.technician_applications (technician_id);
CREATE INDEX idx_tech_apps_org_status
  ON public.technician_applications (organization_id, status);

CREATE INDEX idx_contracts_org
  ON public.contracts (organization_id);
CREATE INDEX idx_contracts_signing_token
  ON public.contracts (signing_token);
CREATE INDEX idx_contracts_artist_app
  ON public.contracts (artist_application_id)
  WHERE artist_application_id IS NOT NULL;
CREATE INDEX idx_contracts_tech_app
  ON public.contracts (technician_application_id)
  WHERE technician_application_id IS NOT NULL;

CREATE INDEX idx_session_financials_org
  ON public.session_financials (organization_id);

CREATE INDEX idx_income_session_fin
  ON public.income_items (session_financial_id);
CREATE INDEX idx_expense_session_fin
  ON public.expense_items (session_financial_id);
CREATE INDEX idx_expense_barter
  ON public.expense_items (session_financial_id)
  WHERE is_barter = true;

CREATE INDEX idx_activity_logs_org
  ON public.activity_logs (organization_id);
CREATE INDEX idx_activity_logs_entity
  ON public.activity_logs (entity_type, entity_id);
CREATE INDEX idx_activity_logs_actor
  ON public.activity_logs (actor_id)
  WHERE actor_id IS NOT NULL;
CREATE INDEX idx_activity_logs_created
  ON public.activity_logs (created_at DESC);

CREATE INDEX idx_email_pending
  ON public.email_notifications (created_at)
  WHERE status = 'pending';


-- ============================================================
-- SECTION 5 — TRIGGERS
-- ============================================================

-- Auto-create profile on Auth signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-slug on organization INSERT (if slug not supplied)
CREATE OR REPLACE FUNCTION public.handle_organization_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS NULL OR trim(NEW.slug) = '' THEN
    NEW.slug := public.unique_org_slug(public.generate_slug(NEW.name));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_organization_before_insert
  BEFORE INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_organization_before_insert();

-- Auto-insert owner as 'owner' member when an organization is created
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.organization_members (organization_id, user_id, role, accepted_at)
  VALUES (NEW.id, NEW.owner_id, 'owner', now());
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_organization_created
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();

-- Auto-fill organization_id on sessions from their parent project
CREATE OR REPLACE FUNCTION public.sync_session_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.organization_id := (
    SELECT organization_id FROM public.projects WHERE id = NEW.project_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_session_before_insert
  BEFORE INSERT ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.sync_session_organization();

-- Auto-fill organization_id on artist_applications from their parent project
CREATE OR REPLACE FUNCTION public.sync_artist_application_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.organization_id := (
    SELECT organization_id FROM public.projects WHERE id = NEW.project_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_artist_application_before_insert
  BEFORE INSERT ON public.artist_applications
  FOR EACH ROW EXECUTE FUNCTION public.sync_artist_application_organization();

-- Auto-fill organization_id on technician_applications from their parent job_offer
CREATE OR REPLACE FUNCTION public.sync_tech_application_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.organization_id := (
    SELECT organization_id FROM public.job_offers WHERE id = NEW.job_offer_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_tech_application_before_insert
  BEFORE INSERT ON public.technician_applications
  FOR EACH ROW EXECUTE FUNCTION public.sync_tech_application_organization();

-- Auto-fill organization_id on session_financials from their parent session
CREATE OR REPLACE FUNCTION public.sync_session_financial_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.organization_id := (
    SELECT organization_id FROM public.sessions WHERE id = NEW.session_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_session_financial_before_insert
  BEFORE INSERT ON public.session_financials
  FOR EACH ROW EXECUTE FUNCTION public.sync_session_financial_organization();

-- updated_at triggers
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_technician_profiles
  BEFORE UPDATE ON public.technician_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_organizations
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_organization_subscriptions
  BEFORE UPDATE ON public.organization_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_projects
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_sessions
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_artist_applications
  BEFORE UPDATE ON public.artist_applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_job_offers
  BEFORE UPDATE ON public.job_offers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_technician_applications
  BEFORE UPDATE ON public.technician_applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_contract_templates
  BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_contracts
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_session_financials
  BEFORE UPDATE ON public.session_financials
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ============================================================
-- SECTION 6 — VIEWS
-- ============================================================

-- Real-time financial balance per session.
-- Uses subqueries for income and expenses to avoid cross-join row multiplication
-- when both income_items and expense_items have multiple rows per session.
--
-- Columns:
--   total_income        → SUM of all income items (cash always counts)
--   total_expenses      → SUM of non-barter expenses (cash outflows)
--   total_barter_value  → SUM of barter expense amounts (market value of in-kind coverage)
--   balance             → total_income - total_expenses
--
-- Views in PostgreSQL are SECURITY INVOKER by default, meaning they respect
-- the RLS policies of the calling user on all underlying tables.
CREATE OR REPLACE VIEW public.session_balance_view AS
SELECT
  sf.id              AS session_financial_id,
  sf.session_id,
  sf.organization_id,
  s.project_id,
  s.title            AS session_title,
  s.scheduled_date,
  COALESCE(inc.total_income,        0) AS total_income,
  COALESCE(exp.total_expenses,      0) AS total_expenses,
  COALESCE(exp.total_barter_value,  0) AS total_barter_value,
  COALESCE(inc.total_income,        0)
    - COALESCE(exp.total_expenses,  0) AS balance,
  COALESCE(inc.income_count,  0)       AS income_count,
  COALESCE(exp.expense_count, 0)       AS expense_count
FROM public.session_financials sf
JOIN public.sessions s ON s.id = sf.session_id
LEFT JOIN (
  SELECT
    session_financial_id,
    SUM(amount) AS total_income,
    COUNT(*)    AS income_count
  FROM public.income_items
  GROUP BY session_financial_id
) inc ON inc.session_financial_id = sf.id
LEFT JOIN (
  SELECT
    session_financial_id,
    SUM(amount) FILTER (WHERE NOT is_barter) AS total_expenses,
    SUM(amount) FILTER (WHERE     is_barter) AS total_barter_value,
    COUNT(*)                                  AS expense_count
  FROM public.expense_items
  GROUP BY session_financial_id
) exp ON exp.session_financial_id = sf.id;

COMMENT ON VIEW public.session_balance_view IS
  'Real-time financial summary per session. '
  'balance = total_income - total_expenses (barter expenses excluded from cash total). '
  'Inherits RLS from underlying tables — org members see only their own sessions.';


-- ============================================================
-- SECTION 7 — ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.profiles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialties                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_specialties      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_types               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_slots               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_field_definitions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_field_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artist_applications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artist_application_answers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_offers                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_applications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_templates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_financials          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_items                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_items               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_notifications         ENABLE ROW LEVEL SECURITY;

-- ── profiles ──────────────────────────────────────────────

CREATE POLICY "profiles: any authenticated user can read"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles: users update own profile only"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING     (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── specialties ───────────────────────────────────────────

CREATE POLICY "specialties: read-only for all authenticated"
  ON public.specialties FOR SELECT
  TO authenticated
  USING (true);

-- ── technician_profiles ───────────────────────────────────

CREATE POLICY "technician_profiles: visible if available or own"
  ON public.technician_profiles FOR SELECT
  TO authenticated
  USING (is_available_for_hire = true OR user_id = auth.uid());

CREATE POLICY "technician_profiles: manage own profile"
  ON public.technician_profiles FOR ALL
  TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── technician_specialties ────────────────────────────────

CREATE POLICY "technician_specialties: visible with visible technician"
  ON public.technician_specialties FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.technician_profiles tp
      WHERE tp.id = technician_id
        AND (tp.is_available_for_hire = true OR tp.user_id = auth.uid())
    )
  );

CREATE POLICY "technician_specialties: manage own specialties"
  ON public.technician_specialties FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.technician_profiles tp
      WHERE tp.id = technician_id AND tp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.technician_profiles tp
      WHERE tp.id = technician_id AND tp.user_id = auth.uid()
    )
  );

-- ── organizations ─────────────────────────────────────────

CREATE POLICY "organizations: members can view"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (public.is_org_member(id));

CREATE POLICY "organizations: any authenticated user can create"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "organizations: only owner can update"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING     (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ── organization_members ──────────────────────────────────

CREATE POLICY "org_members: org members can view"
  ON public.organization_members FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY "org_members: owner can invite"
  ON public.organization_members FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_owner(organization_id));

CREATE POLICY "org_members: owner manages; invitee accepts own invite"
  ON public.organization_members FOR UPDATE
  TO authenticated
  USING (public.is_org_owner(organization_id) OR user_id = auth.uid());

CREATE POLICY "org_members: owner removes; member can leave"
  ON public.organization_members FOR DELETE
  TO authenticated
  USING (public.is_org_owner(organization_id) OR user_id = auth.uid());

-- ── subscription_plans ───────────────────────────────────

CREATE POLICY "subscription_plans: read-only for all authenticated"
  ON public.subscription_plans FOR SELECT
  TO authenticated
  USING (true);

-- ── organization_subscriptions ────────────────────────────

CREATE POLICY "org_subscriptions: members can view"
  ON public.organization_subscriptions FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id));

-- INSERT/UPDATE is exclusively via service role from Stripe webhook handler

-- ── project_types ────────────────────────────────────────

CREATE POLICY "project_types: system types visible to all; custom to members"
  ON public.project_types FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL
    OR public.is_org_member(organization_id)
  );

CREATE POLICY "project_types: Pro members can create custom types"
  ON public.project_types FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND public.is_org_member(organization_id)
  );

CREATE POLICY "project_types: Pro members can update own custom types"
  ON public.project_types FOR UPDATE
  TO authenticated
  USING     (organization_id IS NOT NULL AND public.is_org_member(organization_id))
  WITH CHECK (organization_id IS NOT NULL AND public.is_org_member(organization_id));

-- ── projects ─────────────────────────────────────────────

CREATE POLICY "projects: org members can view"
  ON public.projects FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY "projects: org members can create"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "projects: org members can update"
  ON public.projects FOR UPDATE
  TO authenticated
  USING     (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "projects: only owner can delete"
  ON public.projects FOR DELETE
  TO authenticated
  USING (public.is_org_owner(organization_id));

-- ── sessions ─────────────────────────────────────────────

CREATE POLICY "sessions: org members can view"
  ON public.sessions FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY "sessions: org members can create"
  ON public.sessions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_member(
    (SELECT organization_id FROM public.projects WHERE id = project_id)
  ));

CREATE POLICY "sessions: org members can update"
  ON public.sessions FOR UPDATE
  TO authenticated
  USING     (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "sessions: only owner can delete"
  ON public.sessions FOR DELETE
  TO authenticated
  USING (public.is_org_owner(organization_id));

-- ── session_slots ────────────────────────────────────────

CREATE POLICY "session_slots: org members can manage"
  ON public.session_slots FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_id AND public.is_org_member(s.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_id AND public.is_org_member(s.organization_id)
    )
  );

-- ── form_field_definitions ───────────────────────────────

CREATE POLICY "ffd: system fields visible to all; custom to org members"
  ON public.form_field_definitions FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL
    OR public.is_org_member(organization_id)
  );

CREATE POLICY "ffd: Pro members can manage custom fields"
  ON public.form_field_definitions FOR ALL
  TO authenticated
  USING     (organization_id IS NOT NULL AND public.is_org_member(organization_id))
  WITH CHECK (organization_id IS NOT NULL AND public.is_org_member(organization_id));

-- ── organization_field_settings ──────────────────────────

CREATE POLICY "org_field_settings: org members can manage"
  ON public.organization_field_settings FOR ALL
  TO authenticated
  USING     (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

-- ── artist_applications ───────────────────────────────────
-- Org members: full CRUD.
-- Registered artists: can read and self-cancel their own applications.
-- Guest access (access_token lookup) → Next.js API route with service role only.

CREATE POLICY "artist_apps: org members full access"
  ON public.artist_applications FOR ALL
  TO authenticated
  USING     (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "artist_apps: registered artists can view own"
  ON public.artist_applications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "artist_apps: registered artists can cancel own"
  ON public.artist_applications FOR UPDATE
  TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── artist_application_answers ────────────────────────────

CREATE POLICY "answers: org members can view"
  ON public.artist_application_answers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.artist_applications aa
      WHERE aa.id = application_id
        AND public.is_org_member(aa.organization_id)
    )
  );

CREATE POLICY "answers: org members can delete"
  ON public.artist_application_answers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.artist_applications aa
      WHERE aa.id = application_id
        AND public.is_org_member(aa.organization_id)
    )
  );

-- ── job_offers ────────────────────────────────────────────

CREATE POLICY "job_offers: org members full access"
  ON public.job_offers FOR ALL
  TO authenticated
  USING     (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "job_offers: technicians can view open public offers or own invitations"
  ON public.job_offers FOR SELECT
  TO authenticated
  USING (
    status = 'open'
    AND (
      target_technician_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.technician_profiles tp
        WHERE tp.id = target_technician_id AND tp.user_id = auth.uid()
      )
    )
  );

-- ── technician_applications ───────────────────────────────

CREATE POLICY "tech_apps: org members full access"
  ON public.technician_applications FOR ALL
  TO authenticated
  USING     (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "tech_apps: technicians manage own applications"
  ON public.technician_applications FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.technician_profiles tp
      WHERE tp.id = technician_id AND tp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.technician_profiles tp
      WHERE tp.id = technician_id AND tp.user_id = auth.uid()
    )
  );

-- ── contract_templates ────────────────────────────────────

CREATE POLICY "contract_templates: org members can manage"
  ON public.contract_templates FOR ALL
  TO authenticated
  USING     (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

-- ── contracts ────────────────────────────────────────────

CREATE POLICY "contracts: org members full access"
  ON public.contracts FOR ALL
  TO authenticated
  USING     (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

-- Party signature via signing_token → Next.js API route with service role only.

-- ── session_financials ────────────────────────────────────

CREATE POLICY "session_financials: org members can manage"
  ON public.session_financials FOR ALL
  TO authenticated
  USING     (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

-- ── income_items ─────────────────────────────────────────

CREATE POLICY "income_items: org members can manage"
  ON public.income_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.session_financials sf
      WHERE sf.id = session_financial_id
        AND public.is_org_member(sf.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.session_financials sf
      WHERE sf.id = session_financial_id
        AND public.is_org_member(sf.organization_id)
    )
  );

-- ── expense_items ────────────────────────────────────────

CREATE POLICY "expense_items: org members can manage"
  ON public.expense_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.session_financials sf
      WHERE sf.id = session_financial_id
        AND public.is_org_member(sf.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.session_financials sf
      WHERE sf.id = session_financial_id
        AND public.is_org_member(sf.organization_id)
    )
  );

-- ── activity_logs ────────────────────────────────────────

CREATE POLICY "activity_logs: org members can view"
  ON public.activity_logs FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id));

-- ── email_notifications ──────────────────────────────────

CREATE POLICY "email_notifications: org members can view"
  ON public.email_notifications FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL
    OR public.is_org_member(organization_id)
  );


-- ============================================================
-- SECTION 8 — SEED DATA
-- ============================================================

-- ── Subscription Plans ────────────────────────────────────

INSERT INTO public.subscription_plans (
  name,   display_name,
  max_active_projects, max_team_members,
  can_post_jobs, can_custom_form_fields, can_custom_project_types,
  can_custom_contracts, can_search_technician_directory,
  price_monthly_eur, price_annual_eur
) VALUES
(
  'free', 'Plan Gratuito',
  3,    3,
  false, false, false, false, false,
  0.00, 0.00
),
(
  'pro', 'Plan Pro',
  NULL, NULL,   -- unlimited
  true,  true,  true,  true,  true,
  29.00, 290.00
);

-- ── System Project Types ──────────────────────────────────

INSERT INTO public.project_types (name, slug, icon, is_system, display_order)
VALUES
  ('Musical',              'musical',       'music-note',    true, 1),
  ('Audiovisual',          'audiovisual',   'video-camera',  true, 2),
  ('Fotográfico',          'fotografico',   'camera',        true, 3),
  ('Cine / Cortometrajes', 'cine',          'film',          true, 4),
  ('Publicitario',         'publicitario',  'megaphone',     true, 5),
  ('Podcast / Radio',      'podcast',       'microphone',    true, 6);

-- ── Professional Specialties ─────────────────────────────

INSERT INTO public.specialties (name, slug, category, display_order)
VALUES
  -- VIDEO
  ('Filmmaking / Video',             'filmmaking-video',     'video',      1),
  ('Dirección de Fotografía (DOP)',  'dop',                  'video',      2),
  ('Operación de Cámara',            'camera-operation',     'video',      3),
  ('Edición de Video',               'video-editing',        'video',      4),
  ('Colorización / Color Grading',   'color-grading',        'video',      5),
  ('Motion Graphics / VFX',          'motion-graphics',      'video',      6),
  ('Operación de Dron',              'drone',                'video',      7),
  -- AUDIO
  ('Técnico de Sonido',              'sound-engineering',    'audio',      10),
  ('Diseño de Sonido',               'sound-design',         'audio',      11),
  ('Mezcla / Mastering',             'mixing-mastering',     'audio',      12),
  ('Sonido Directo / Boom',          'sound-on-set',         'audio',      13),
  -- PHOTO
  ('Fotografía',                     'photography',          'photo',      20),
  ('Fotografía de Backstage',        'backstage-photography','photo',      21),
  ('Retoque Fotográfico',            'photo-retouching',     'photo',      22),
  -- PRODUCTION
  ('Dirección',                      'direction',            'production', 30),
  ('Producción Ejecutiva',           'executive-production', 'production', 31),
  ('Gestión de Producción',          'production-management','production', 32),
  ('Guion / Escritura',              'screenwriting',        'production', 33),
  -- ART
  ('Dirección de Arte',              'art-direction',        'art',        40),
  ('Escenografía / Ambientación',    'set-design',           'art',        41),
  ('Maquillaje / Caracterización',   'makeup',               'art',        42),
  ('Estilismo / Vestuario',          'styling',              'art',        43),
  -- OTHER
  ('Iluminación',                    'lighting',             'other',      50),
  ('Diseño Gráfico',                 'graphic-design',       'other',      51),
  ('Transporte / Logística',         'transport',            'other',      52),
  ('Gestión de Talentos',            'talent-management',    'other',      53);

-- ── System Form Field Definitions ────────────────────────
-- Uses a DO block to reference project type IDs by slug at runtime.
-- All fields are is_system = true and organization_id = NULL.

DO $$
DECLARE
  v_musical      uuid;
  v_audiovisual  uuid;
  v_fotografico  uuid;
  v_cine         uuid;
  v_publicitario uuid;
  v_podcast      uuid;
BEGIN
  SELECT id INTO v_musical      FROM public.project_types WHERE slug = 'musical'      AND is_system;
  SELECT id INTO v_audiovisual  FROM public.project_types WHERE slug = 'audiovisual'  AND is_system;
  SELECT id INTO v_fotografico  FROM public.project_types WHERE slug = 'fotografico'  AND is_system;
  SELECT id INTO v_cine         FROM public.project_types WHERE slug = 'cine'         AND is_system;
  SELECT id INTO v_publicitario FROM public.project_types WHERE slug = 'publicitario' AND is_system;
  SELECT id INTO v_podcast      FROM public.project_types WHERE slug = 'podcast'      AND is_system;

  -------------------------------------------------------
  -- COMMON FIELDS (project_type_id = NULL → all types)
  -------------------------------------------------------
  INSERT INTO public.form_field_definitions
    (project_type_id, organization_id, field_key, label, field_type,
     placeholder, helper_text, is_required, display_order, is_system)
  VALUES
    (NULL, NULL, 'full_name', 'Nombre completo',     'text',
     'Ej: María García',    NULL,
     true,  1,  true),
    (NULL, NULL, 'email',     'Email',                'email',
     'tu@email.com',        'Te enviaremos el estado de tu solicitud aquí',
     true,  2,  true),
    (NULL, NULL, 'phone',     'Teléfono / WhatsApp',  'tel',
     '+34 600 000 000',     NULL,
     true,  3,  true),
    (NULL, NULL, 'city',      'Ciudad',               'text',
     'Ej: Madrid',          NULL,
     true,  4,  true),
    (NULL, NULL, 'notes',     'Notas adicionales',    'textarea',
     'Cualquier cosa que quieras añadir...', NULL,
     false, 99, true);

  -------------------------------------------------------
  -- MUSICAL
  -------------------------------------------------------
  INSERT INTO public.form_field_definitions
    (project_type_id, organization_id, field_key, label, field_type,
     placeholder, helper_text, is_required, display_order, is_system)
  VALUES
    (v_musical, NULL, 'instrument_role',    'Instrumento o Rol',
     'text',     'Ej: Guitarra, Voz, Batería, DJ...',
     NULL,                                                           true,  10, true),
    (v_musical, NULL, 'music_links',        'Links a tu música',
     'url',      'https://open.spotify.com/...',
     'Spotify, YouTube, SoundCloud, Bandcamp...',                    true,  11, true),
    (v_musical, NULL, 'band_members_count', 'Número de integrantes',
     'number',   'Ej: 4',
     'Si aplicas como grupo, indica cuántos sois',                   false, 12, true),
    (v_musical, NULL, 'technical_rider',    'Rider técnico',
     'textarea', 'Backline, monitores, cables, canales de mesa...',
     'Si no tienes rider formal, describe tus necesidades básicas',  false, 13, true);

  -------------------------------------------------------
  -- FOTOGRÁFICO
  -------------------------------------------------------
  INSERT INTO public.form_field_definitions
    (project_type_id, organization_id, field_key, label, field_type,
     placeholder, helper_text, is_required, options, display_order, is_system)
  VALUES
    (v_fotografico, NULL, 'portfolio_url',    'Portfolio / Instagram',
     'url',        'https://www.instagram.com/...',
     'Link a tu trabajo más representativo',
     true,  NULL, 10, true),
    (v_fotografico, NULL, 'height_size',      'Altura y tallas',
     'text',       'Ej: 175cm, Talla M, Pie 42',
     'Opcional. Solo para convocatorias de modelo o actor/actriz',
     false, NULL, 11, true),
    (v_fotografico, NULL, 'own_equipment',    '¿Dispones de equipo propio?',
     'multiselect', NULL,
     'Selecciona todo lo que tengas disponible',
     false,
     '[
       {"value":"camera",    "label":"Cámara propia"},
       {"value":"lights",    "label":"Equipo de iluminación"},
       {"value":"tripod",    "label":"Trípode / Gimbal"},
       {"value":"backdrops", "label":"Fondos / Telones"},
       {"value":"lenses",    "label":"Objetivos adicionales"}
     ]'::jsonb,
     12, true),
    (v_fotografico, NULL, 'style_references', 'Referencias de estilo',
     'textarea', NULL,
     'Lookbook, tableros de Pinterest o descripción de tu estilo fotográfico',
     false, NULL, 13, true);

  -------------------------------------------------------
  -- AUDIOVISUAL
  -------------------------------------------------------
  INSERT INTO public.form_field_definitions
    (project_type_id, organization_id, field_key, label, field_type,
     placeholder, helper_text, is_required, options, display_order, is_system)
  VALUES
    (v_audiovisual, NULL, 'portfolio_url',   'Portfolio / Canal',
     'url',        'https://vimeo.com/...',
     'Vimeo, YouTube, web o cualquier link a tu trabajo',
     true,  NULL, 10, true),
    (v_audiovisual, NULL, 'speciality_role', 'Especialidad o Rol',
     'text',       'Ej: Cámara, Edición, DOP, Iluminación...',
     NULL,
     true,  NULL, 11, true),
    (v_audiovisual, NULL, 'own_equipment',   '¿Dispones de equipo propio?',
     'multiselect', NULL,
     'Selecciona todo lo que tengas disponible',
     false,
     '[
       {"value":"camera",  "label":"Cámara de video"},
       {"value":"lights",  "label":"Kit de iluminación"},
       {"value":"audio",   "label":"Micrófono / Boom"},
       {"value":"gimbal",  "label":"Gimbal / Steadicam"},
       {"value":"drone",   "label":"Dron"},
       {"value":"monitor", "label":"Monitor de campo"}
     ]'::jsonb,
     12, true);

  -------------------------------------------------------
  -- CINE / CORTOMETRAJES
  -------------------------------------------------------
  INSERT INTO public.form_field_definitions
    (project_type_id, organization_id, field_key, label, field_type,
     placeholder, helper_text, is_required, options, display_order, is_system)
  VALUES
    (v_cine, NULL, 'applied_role',      'Rol al que aplicas',
     'select', NULL, NULL,
     true,
     '[
       {"value":"actor",         "label":"Actor / Actriz"},
       {"value":"dop",           "label":"Director/a de Fotografía"},
       {"value":"director",      "label":"Director/a"},
       {"value":"screenwriter",  "label":"Guionista"},
       {"value":"art_director",  "label":"Director/a de Arte"},
       {"value":"sound",         "label":"Técnico/a de Sonido Directo"},
       {"value":"producer",      "label":"Productor/a"},
       {"value":"other",         "label":"Otro (especificar en notas)"}
     ]'::jsonb,
     10, true),
    (v_cine, NULL, 'reel_url',          'Reel o Videobook',
     'url',     'https://vimeo.com/...',
     'Tu trabajo más representativo para este rol',
     true,  NULL, 11, true),
    (v_cine, NULL, 'imdb_url',          'Perfil en IMDb',
     'url',     'https://www.imdb.com/name/...',
     'Opcional',
     false, NULL, 12, true),
    (v_cine, NULL, 'acting_experience', 'Experiencia o filmografía',
     'textarea', NULL,
     'Proyectos, festivales, premios o formación relevante',
     false, NULL, 13, true);

  -------------------------------------------------------
  -- PUBLICITARIO
  -------------------------------------------------------
  INSERT INTO public.form_field_definitions
    (project_type_id, organization_id, field_key, label, field_type,
     placeholder, helper_text, is_required, options, display_order, is_system)
  VALUES
    (v_publicitario, NULL, 'applied_role',    'Rol al que aplicas',
     'select', NULL, NULL,
     true,
     '[
       {"value":"actor_model",   "label":"Actor / Modelo"},
       {"value":"photographer",  "label":"Fotógrafo/a"},
       {"value":"camera",        "label":"Operador/a de Cámara"},
       {"value":"director",      "label":"Director/a"},
       {"value":"producer",      "label":"Productor/a"},
       {"value":"graphic",       "label":"Diseñador/a Gráfico/a"},
       {"value":"other",         "label":"Otro (especificar en notas)"}
     ]'::jsonb,
     10, true),
    (v_publicitario, NULL, 'reel_url',         'Reel o Portfolio',
     'url',     'https://...',
     'Tu mejor trabajo para este tipo de proyecto',
     true,  NULL, 11, true),
    (v_publicitario, NULL, 'brand_experience', 'Marcas o campañas anteriores',
     'textarea', NULL,
     'Menciona las marcas o campañas más relevantes de tu carrera',
     false, NULL, 12, true);

  -------------------------------------------------------
  -- PODCAST / RADIO
  -------------------------------------------------------
  INSERT INTO public.form_field_definitions
    (project_type_id, organization_id, field_key, label, field_type,
     placeholder, helper_text, is_required, options, display_order, is_system)
  VALUES
    (v_podcast, NULL, 'audio_links',         'Links a trabajos de audio',
     'url',      'https://open.spotify.com/show/...',
     'Spotify, iVoox, Apple Podcasts o cualquier plataforma',
     true,  NULL, 10, true),
    (v_podcast, NULL, 'show_topic',          'Temática / Idea del show',
     'textarea', NULL,
     'Describe el concepto, target y enfoque de tu programa',
     true,  NULL, 11, true),
    (v_podcast, NULL, 'recording_equipment', 'Equipo de grabación',
     'text',     'Ej: Shure SM7B, Focusrite Scarlett 2i2...',
     'Micrófono, interfaz de audio y software que usas',
     false, NULL, 12, true),
    (v_podcast, NULL, 'guest_experience',    '¿Has participado como invitado/a en otros podcasts?',
     'checkbox', NULL, NULL,
     false, NULL, 13, true);

END;
$$;

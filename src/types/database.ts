/**
 * Hand-written database types matching 001_initial_schema.sql
 *
 * Regenerate automatically after deploying to Supabase with:
 *   npx supabase gen types typescript --project-id <your-id> > src/types/database.ts
 *
 * Until then this file is the source of truth and is kept in sync
 * with the migration manually.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ── Enums ──────────────────────────────────────────────────────────

export type OrgMemberRole      = 'owner' | 'coordinator' | 'staff'
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'cancelled'
export type ProjectStatus      = 'draft' | 'active' | 'completed' | 'archived'
export type SessionStatus      = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
export type ApplicationStatus  =
  | 'pending' | 'pre_approved' | 'contract_sent' | 'confirmed'
  | 'rejected' | 'waitlisted'  | 'cancelled'
export type CancellationActor  = 'applicant' | 'producer' | 'system'
export type JobOfferStatus     = 'open' | 'filled' | 'closed' | 'cancelled'
export type RateUnit           = 'hour' | 'day' | 'project' | 'flat'
export type ContractStatus     =
  | 'draft' | 'sent' | 'viewed' | 'signed_by_party'
  | 'fully_signed' | 'rejected' | 'cancelled'
export type FormFieldType      =
  | 'text' | 'email' | 'tel' | 'url' | 'textarea'
  | 'select' | 'multiselect' | 'file' | 'checkbox' | 'number' | 'date'
export type IncomeType         = 'artist_payment' | 'sponsor_cash' | 'other'
export type ExpenseType        = 'staff_fee' | 'catering' | 'transport' | 'equipment_rental' | 'venue' | 'other'
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'bounced'

// ── Row types per table ────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id:         string
          full_name:  string
          email:      string
          phone:      string | null
          city:       string | null
          country:    string
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id:         string
          full_name?: string
          email:      string
          phone?:     string | null
          city?:      string | null
          country?:   string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          full_name?:  string
          phone?:      string | null
          city?:       string | null
          country?:    string
          avatar_url?: string | null
          updated_at?: string
        }
      }

      specialties: {
        Row: {
          id:            string
          name:          string
          slug:          string
          category:      string
          display_order: number
          created_at:    string
        }
        Insert: {
          id?:            string
          name:           string
          slug:           string
          category:       string
          display_order?: number
          created_at?:    string
        }
        Update: {
          name?:          string
          category?:      string
          display_order?: number
        }
      }

      technician_profiles: {
        Row: {
          id:                    string
          user_id:               string
          bio:                   string | null
          portfolio_url:         string | null
          instagram_url:         string | null
          website_url:           string | null
          equipment_description: string | null
          daily_rate:            number | null
          rate_currency:         string
          is_available_for_hire: boolean
          years_experience:      number | null
          created_at:            string
          updated_at:            string
        }
        Insert: {
          id?:                    string
          user_id:                string
          bio?:                   string | null
          portfolio_url?:         string | null
          instagram_url?:         string | null
          website_url?:           string | null
          equipment_description?: string | null
          daily_rate?:            number | null
          rate_currency?:         string
          is_available_for_hire?: boolean
          years_experience?:      number | null
        }
        Update: {
          bio?:                   string | null
          portfolio_url?:         string | null
          instagram_url?:         string | null
          website_url?:           string | null
          equipment_description?: string | null
          daily_rate?:            number | null
          rate_currency?:         string
          is_available_for_hire?: boolean
          years_experience?:      number | null
          updated_at?:            string
        }
      }

      technician_specialties: {
        Row: {
          technician_id: string
          specialty_id:  string
          is_primary:    boolean
          created_at:    string
        }
        Insert: {
          technician_id: string
          specialty_id:  string
          is_primary?:   boolean
          created_at?:   string
        }
        Update: {
          is_primary?: boolean
        }
      }

      organizations: {
        Row: {
          id:            string
          owner_id:      string
          name:          string
          slug:          string
          logo_url:      string | null
          bio:           string | null
          website_url:   string | null
          instagram_url: string | null
          city:          string | null
          country:       string
          created_at:    string
          updated_at:    string
        }
        Insert: {
          id?:            string
          owner_id:       string
          name:           string
          slug?:          string
          logo_url?:      string | null
          bio?:           string | null
          website_url?:   string | null
          instagram_url?: string | null
          city?:          string | null
          country?:       string
        }
        Update: {
          name?:          string
          slug?:          string
          logo_url?:      string | null
          bio?:           string | null
          website_url?:   string | null
          instagram_url?: string | null
          city?:          string | null
          country?:       string
          updated_at?:    string
        }
      }

      organization_members: {
        Row: {
          id:              string
          organization_id: string
          user_id:         string
          role:            OrgMemberRole
          invited_at:      string
          accepted_at:     string | null
        }
        Insert: {
          id?:              string
          organization_id:  string
          user_id:          string
          role?:            OrgMemberRole
          invited_at?:      string
          accepted_at?:     string | null
        }
        Update: {
          role?:        OrgMemberRole
          accepted_at?: string | null
        }
      }

      subscription_plans: {
        Row: {
          id:                              string
          name:                            string
          display_name:                    string
          max_active_projects:             number | null
          max_team_members:                number | null
          can_post_jobs:                   boolean
          can_custom_form_fields:          boolean
          can_custom_project_types:        boolean
          can_custom_contracts:            boolean
          can_search_technician_directory: boolean
          price_monthly_eur:               number
          price_annual_eur:                number
          created_at:                      string
        }
        Insert: never
        Update: never
      }

      organization_subscriptions: {
        Row: {
          id:                       string
          organization_id:          string
          plan_id:                  string
          status:                   SubscriptionStatus
          payment_provider:         string | null
          external_subscription_id: string | null
          current_period_start:     string | null
          current_period_end:       string | null
          cancelled_at:             string | null
          created_at:               string
          updated_at:               string
        }
        Insert: {
          id?:                       string
          organization_id:           string
          plan_id:                   string
          status?:                   SubscriptionStatus
          payment_provider?:         string | null
          external_subscription_id?: string | null
          current_period_start?:     string | null
          current_period_end?:       string | null
        }
        Update: {
          plan_id?:                  string
          status?:                   SubscriptionStatus
          payment_provider?:         string | null
          external_subscription_id?: string | null
          current_period_start?:     string | null
          current_period_end?:       string | null
          cancelled_at?:             string | null
          updated_at?:               string
        }
      }

      project_types: {
        Row: {
          id:              string
          organization_id: string | null
          name:            string
          slug:            string
          icon:            string | null
          is_system:       boolean
          display_order:   number
          created_at:      string
        }
        Insert: {
          id?:              string
          organization_id?: string | null
          name:             string
          slug:             string
          icon?:            string | null
          is_system?:       boolean
          display_order?:   number
        }
        Update: {
          name?:          string
          slug?:          string
          icon?:          string | null
          display_order?: number
        }
      }

      projects: {
        Row: {
          id:                          string
          organization_id:             string
          project_type_id:             string
          created_by:                  string
          title:                       string
          description:                 string | null
          cover_image_url:             string | null
          status:                      ProjectStatus
          registration_open:           boolean
          registration_link_token:     string
          hide_status_from_applicants: boolean
          created_at:                  string
          updated_at:                  string
        }
        Insert: {
          id?:                          string
          organization_id:              string
          project_type_id:              string
          created_by:                   string
          title:                        string
          description?:                 string | null
          cover_image_url?:             string | null
          status?:                      ProjectStatus
          registration_open?:           boolean
          hide_status_from_applicants?: boolean
        }
        Update: {
          title?:                       string
          description?:                 string | null
          cover_image_url?:             string | null
          status?:                      ProjectStatus
          registration_open?:           boolean
          hide_status_from_applicants?: boolean
          updated_at?:                  string
        }
      }

      sessions: {
        Row: {
          id:                string
          project_id:        string
          organization_id:   string
          title:             string
          scheduled_date:    string
          start_time:        string | null
          end_time:          string | null
          location:          string | null
          location_address:  string | null
          location_maps_url: string | null
          internal_notes:    string | null
          status:            SessionStatus
          created_at:        string
          updated_at:        string
        }
        Insert: {
          id?:                string
          project_id:         string
          organization_id?:   string
          title:              string
          scheduled_date:     string
          start_time?:        string | null
          end_time?:          string | null
          location?:          string | null
          location_address?:  string | null
          location_maps_url?: string | null
          internal_notes?:    string | null
          status?:            SessionStatus
        }
        Update: {
          title?:             string
          scheduled_date?:    string
          start_time?:        string | null
          end_time?:          string | null
          location?:          string | null
          location_address?:  string | null
          location_maps_url?: string | null
          internal_notes?:    string | null
          status?:            SessionStatus
          updated_at?:        string
        }
      }

      session_slots: {
        Row: {
          id:         string
          session_id: string
          role_name:  string
          max_slots:  number
          created_at: string
        }
        Insert: {
          id?:         string
          session_id:  string
          role_name:   string
          max_slots?:  number
        }
        Update: {
          role_name?: string
          max_slots?: number
        }
      }

      form_field_definitions: {
        Row: {
          id:              string
          project_type_id: string | null
          organization_id: string | null
          field_key:       string
          label:           string
          field_type:      FormFieldType
          placeholder:     string | null
          helper_text:     string | null
          is_required:     boolean
          options:         Json | null
          display_order:   number
          is_system:       boolean
          created_at:      string
        }
        Insert: {
          id?:              string
          project_type_id?: string | null
          organization_id?: string | null
          field_key:        string
          label:            string
          field_type:       FormFieldType
          placeholder?:     string | null
          helper_text?:     string | null
          is_required?:     boolean
          options?:         Json | null
          display_order?:   number
          is_system?:       boolean
        }
        Update: {
          label?:         string
          placeholder?:   string | null
          helper_text?:   string | null
          is_required?:   boolean
          options?:       Json | null
          display_order?: number
        }
      }

      organization_field_settings: {
        Row: {
          id:                  string
          organization_id:     string
          field_definition_id: string
          is_active:           boolean
          is_required:         boolean | null
          custom_label:        string | null
          display_order:       number | null
          created_at:          string
        }
        Insert: {
          id?:                  string
          organization_id:      string
          field_definition_id:  string
          is_active?:           boolean
          is_required?:         boolean | null
          custom_label?:        string | null
          display_order?:       number | null
        }
        Update: {
          is_active?:     boolean
          is_required?:   boolean | null
          custom_label?:  string | null
          display_order?: number | null
        }
      }

      artist_applications: {
        Row: {
          id:                   string
          project_id:           string
          organization_id:      string
          preferred_session_id: string | null
          assigned_session_id:  string | null
          assigned_slot_id:     string | null
          user_id:              string | null
          guest_email:          string
          guest_name:           string
          access_token:         string
          status:               ApplicationStatus
          status_updated_at:    string | null
          status_updated_by:    string | null
          producer_notes:       string | null
          cancellation_reason:  string | null
          cancelled_by:         CancellationActor | null
          cancelled_at:         string | null
          submitted_at:         string
          created_at:           string
          updated_at:           string
        }
        Insert: {
          id?:                   string
          project_id:            string
          organization_id?:      string
          preferred_session_id?: string | null
          assigned_session_id?:  string | null
          assigned_slot_id?:     string | null
          user_id?:              string | null
          guest_email:           string
          guest_name:            string
          status?:               ApplicationStatus
          producer_notes?:       string | null
        }
        Update: {
          preferred_session_id?: string | null
          assigned_session_id?:  string | null
          assigned_slot_id?:     string | null
          user_id?:              string | null
          status?:               ApplicationStatus
          status_updated_at?:    string | null
          status_updated_by?:    string | null
          producer_notes?:       string | null
          cancellation_reason?:  string | null
          cancelled_by?:         CancellationActor | null
          cancelled_at?:         string | null
          updated_at?:           string
        }
      }

      artist_application_answers: {
        Row: {
          id:             string
          application_id: string
          field_key:      string
          field_label:    string
          answer:         Json
          created_at:     string
        }
        Insert: {
          id?:             string
          application_id:  string
          field_key:       string
          field_label:     string
          answer:          Json
        }
        Update: never
      }

      job_offers: {
        Row: {
          id:                   string
          organization_id:      string
          project_id:           string
          session_id:           string | null
          created_by:           string
          title:                string
          description:          string
          speciality:           string
          is_paid:              boolean
          is_barter:            boolean
          estimated_rate:       number | null
          rate_unit:            RateUnit | null
          rate_currency:        string
          barter_description:   string | null
          target_technician_id: string | null
          status:               JobOfferStatus
          max_applicants:       number | null
          required_date:        string | null
          location:             string | null
          created_at:           string
          updated_at:           string
        }
        Insert: {
          id?:                   string
          organization_id:       string
          project_id:            string
          session_id?:           string | null
          created_by:            string
          title:                 string
          description:           string
          speciality:            string
          is_paid?:              boolean
          is_barter?:            boolean
          estimated_rate?:       number | null
          rate_unit?:            RateUnit | null
          rate_currency?:        string
          barter_description?:   string | null
          target_technician_id?: string | null
          max_applicants?:       number | null
          required_date?:        string | null
          location?:             string | null
        }
        Update: {
          title?:               string
          description?:         string
          speciality?:          string
          is_paid?:             boolean
          is_barter?:           boolean
          estimated_rate?:      number | null
          rate_unit?:           RateUnit | null
          barter_description?:  string | null
          status?:              JobOfferStatus
          max_applicants?:      number | null
          required_date?:       string | null
          location?:            string | null
          updated_at?:          string
        }
      }

      technician_applications: {
        Row: {
          id:                 string
          job_offer_id:       string
          technician_id:      string
          organization_id:    string
          status:             ApplicationStatus
          cover_note:         string | null
          proposed_rate:      number | null
          agreed_rate:        number | null
          status_updated_at:  string | null
          status_updated_by:  string | null
          cancellation_reason: string | null
          cancelled_by:       CancellationActor | null
          cancelled_at:       string | null
          submitted_at:       string
          created_at:         string
          updated_at:         string
        }
        Insert: {
          id?:                 string
          job_offer_id:        string
          technician_id:       string
          organization_id?:    string
          status?:             ApplicationStatus
          cover_note?:         string | null
          proposed_rate?:      number | null
        }
        Update: {
          status?:             ApplicationStatus
          agreed_rate?:        number | null
          status_updated_at?:  string | null
          status_updated_by?:  string | null
          cancellation_reason?: string | null
          cancelled_by?:       CancellationActor | null
          cancelled_at?:       string | null
          updated_at?:         string
        }
      }

      contract_templates: {
        Row: {
          id:               string
          organization_id:  string
          name:             string
          applies_to:       'artist' | 'technician'
          project_type_id:  string | null
          content_template: string
          is_default:       boolean
          created_at:       string
          updated_at:       string
        }
        Insert: {
          id?:               string
          organization_id:   string
          name:              string
          applies_to:        'artist' | 'technician'
          project_type_id?:  string | null
          content_template:  string
          is_default?:       boolean
        }
        Update: {
          name?:             string
          applies_to?:       'artist' | 'technician'
          project_type_id?:  string | null
          content_template?: string
          is_default?:       boolean
          updated_at?:       string
        }
      }

      contracts: {
        Row: {
          id:                        string
          organization_id:           string
          template_id:               string | null
          artist_application_id:     string | null
          technician_application_id: string | null
          content:                   string
          status:                    ContractStatus
          signing_token:             string
          signed_by_party_at:        string | null
          signed_by_party_ip:        string | null
          signed_by_producer_at:     string | null
          signed_by_producer_id:     string | null
          sent_at:                   string | null
          viewed_at:                 string | null
          expires_at:                string | null
          created_at:                string
          updated_at:                string
        }
        Insert: {
          id?:                        string
          organization_id:            string
          template_id?:               string | null
          artist_application_id?:     string | null
          technician_application_id?: string | null
          content:                    string
          status?:                    ContractStatus
          expires_at?:                string | null
        }
        Update: {
          content?:                   string
          status?:                    ContractStatus
          signed_by_party_at?:        string | null
          signed_by_party_ip?:        string | null
          signed_by_producer_at?:     string | null
          signed_by_producer_id?:     string | null
          sent_at?:                   string | null
          viewed_at?:                 string | null
          expires_at?:                string | null
          updated_at?:                string
        }
      }

      session_financials: {
        Row: {
          id:              string
          session_id:      string
          organization_id: string
          notes:           string | null
          created_at:      string
          updated_at:      string
        }
        Insert: {
          id?:              string
          session_id:       string
          organization_id?: string
          notes?:           string | null
        }
        Update: {
          notes?:      string | null
          updated_at?: string
        }
      }

      income_items: {
        Row: {
          id:                    string
          session_financial_id:  string
          description:           string
          type:                  IncomeType
          amount:                number
          currency:              string
          artist_application_id: string | null
          received_at:           string | null
          notes:                 string | null
          created_at:            string
        }
        Insert: {
          id?:                    string
          session_financial_id:   string
          description:            string
          type:                   IncomeType
          amount:                 number
          currency?:              string
          artist_application_id?: string | null
          received_at?:           string | null
          notes?:                 string | null
        }
        Update: {
          description?:           string
          type?:                  IncomeType
          amount?:                number
          artist_application_id?: string | null
          received_at?:           string | null
          notes?:                 string | null
        }
      }

      expense_items: {
        Row: {
          id:                        string
          session_financial_id:      string
          description:               string
          type:                      ExpenseType
          amount:                    number
          currency:                  string
          is_barter:                 boolean
          sponsor_name:              string | null
          technician_application_id: string | null
          paid_at:                   string | null
          notes:                     string | null
          created_at:                string
        }
        Insert: {
          id?:                        string
          session_financial_id:       string
          description:                string
          type:                       ExpenseType
          amount:                     number
          currency?:                  string
          is_barter?:                 boolean
          sponsor_name?:              string | null
          technician_application_id?: string | null
          paid_at?:                   string | null
          notes?:                     string | null
        }
        Update: {
          description?:               string
          type?:                      ExpenseType
          amount?:                    number
          is_barter?:                 boolean
          sponsor_name?:              string | null
          paid_at?:                   string | null
          notes?:                     string | null
        }
      }

      activity_logs: {
        Row: {
          id:              string
          organization_id: string
          actor_id:        string | null
          entity_type:     string
          entity_id:       string
          action:          string
          metadata:        Json | null
          created_at:      string
        }
        Insert: {
          id?:              string
          organization_id:  string
          actor_id?:        string | null
          entity_type:      string
          entity_id:        string
          action:           string
          metadata?:        Json | null
        }
        Update: never
      }

      email_notifications: {
        Row: {
          id:              string
          organization_id: string | null
          recipient_email: string
          recipient_name:  string | null
          template_name:   string
          subject:         string
          body_html:       string
          body_text:       string | null
          metadata:        Json | null
          status:          NotificationStatus
          attempts:        number
          sent_at:         string | null
          error_message:   string | null
          created_at:      string
        }
        Insert: {
          id?:              string
          organization_id?: string | null
          recipient_email:  string
          recipient_name?:  string | null
          template_name:    string
          subject:          string
          body_html:        string
          body_text?:       string | null
          metadata?:        Json | null
          status?:          NotificationStatus
        }
        Update: {
          status?:        NotificationStatus
          attempts?:      number
          sent_at?:       string | null
          error_message?: string | null
        }
      }
    }

    Views: {
      session_balance_view: {
        Row: {
          session_financial_id: string
          session_id:           string
          organization_id:      string
          project_id:           string
          session_title:        string
          scheduled_date:       string
          total_income:         number
          total_expenses:       number
          total_barter_value:   number
          balance:              number
          income_count:         number
          expense_count:        number
        }
      }
    }

    Functions: {
      is_org_member: {
        Args:    { p_organization_id: string }
        Returns: boolean
      }
      is_org_owner: {
        Args:    { p_organization_id: string }
        Returns: boolean
      }
      generate_slug: {
        Args:    { input_text: string }
        Returns: string
      }
    }

    Enums: {
      org_member_role:      OrgMemberRole
      subscription_status:  SubscriptionStatus
      project_status:       ProjectStatus
      session_status:       SessionStatus
      application_status:   ApplicationStatus
      cancellation_actor:   CancellationActor
      job_offer_status:     JobOfferStatus
      rate_unit:            RateUnit
      contract_status:      ContractStatus
      form_field_type:      FormFieldType
      income_type:          IncomeType
      expense_type:         ExpenseType
      notification_status:  NotificationStatus
    }
  }
}

// ── Convenience shorthand types ────────────────────────────────────

type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

type Views<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row']

export type Profile                  = Tables<'profiles'>
export type Specialty                = Tables<'specialties'>
export type TechnicianProfile        = Tables<'technician_profiles'>
export type TechnicianSpecialty      = Tables<'technician_specialties'>
export type Organization             = Tables<'organizations'>
export type OrganizationMember       = Tables<'organization_members'>
export type SubscriptionPlan         = Tables<'subscription_plans'>
export type OrganizationSubscription = Tables<'organization_subscriptions'>
export type ProjectType              = Tables<'project_types'>
export type Project                  = Tables<'projects'>
export type Session                  = Tables<'sessions'>
export type SessionSlot              = Tables<'session_slots'>
export type FormFieldDefinition      = Tables<'form_field_definitions'>
export type OrgFieldSetting          = Tables<'organization_field_settings'>
export type ArtistApplication        = Tables<'artist_applications'>
export type ArtistApplicationAnswer  = Tables<'artist_application_answers'>
export type JobOffer                 = Tables<'job_offers'>
export type TechnicianApplication    = Tables<'technician_applications'>
export type ContractTemplate         = Tables<'contract_templates'>
export type Contract                 = Tables<'contracts'>
export type SessionFinancial         = Tables<'session_financials'>
export type IncomeItem               = Tables<'income_items'>
export type ExpenseItem              = Tables<'expense_items'>
export type ActivityLog              = Tables<'activity_logs'>
export type EmailNotification        = Tables<'email_notifications'>

export type SessionBalanceView       = Views<'session_balance_view'>

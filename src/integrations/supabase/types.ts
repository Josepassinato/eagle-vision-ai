export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      antitheft_incidents: {
        Row: {
          camera_id: string
          id: number
          meta: Json | null
          person_id: string | null
          severity: string
          ts: string
        }
        Insert: {
          camera_id: string
          id?: number
          meta?: Json | null
          person_id?: string | null
          severity: string
          ts?: string
        }
        Update: {
          camera_id?: string
          id?: number
          meta?: Json | null
          person_id?: string | null
          severity?: string
          ts?: string
        }
        Relationships: []
      }
      antitheft_receipts: {
        Row: {
          created_at: string
          id: string
          items: Json
          person_id: string | null
          ts: string
        }
        Insert: {
          created_at?: string
          id?: string
          items: Json
          person_id?: string | null
          ts?: string
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          person_id?: string | null
          ts?: string
        }
        Relationships: []
      }
      antitheft_signals: {
        Row: {
          camera_id: string
          id: number
          meta: Json | null
          track_id: number | null
          ts: string
          type: string
        }
        Insert: {
          camera_id: string
          id?: number
          meta?: Json | null
          track_id?: number | null
          ts?: string
          type: string
        }
        Update: {
          camera_id?: string
          id?: number
          meta?: Json | null
          track_id?: number | null
          ts?: string
          type?: string
        }
        Relationships: []
      }
      antitheft_zones: {
        Row: {
          camera_id: string
          created_at: string
          id: string
          updated_at: string
          zones: Json
        }
        Insert: {
          camera_id: string
          created_at?: string
          id?: string
          updated_at?: string
          zones: Json
        }
        Update: {
          camera_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          zones?: Json
        }
        Relationships: []
      }
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          id: string
          ip_address: unknown | null
          metadata: Json | null
          org_id: string
          resource_id: string | null
          resource_type: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          org_id: string
          resource_id?: string | null
          resource_type: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          org_id?: string
          resource_id?: string | null
          resource_type?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_jobs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          job_type: string
          last_run: string | null
          metadata: Json | null
          next_run: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_type: string
          last_run?: string | null
          metadata?: Json | null
          next_run?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_type?: string
          last_run?: string | null
          metadata?: Json | null
          next_run?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      billing_periods: {
        Row: {
          created_at: string | null
          id: string
          org_id: string | null
          period_end: string
          period_start: string
          status: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          org_id?: string | null
          period_end: string
          period_start: string
          status?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          org_id?: string | null
          period_end?: string
          period_start?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_periods_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_rates: {
        Row: {
          created_at: string | null
          currency: string
          effective_from: string
          effective_until: string | null
          id: string
          metric_type: string
          stripe_price_id: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          currency?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          metric_type: string
          stripe_price_id?: string | null
          unit_price: number
        }
        Update: {
          created_at?: string | null
          currency?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          metric_type?: string
          stripe_price_id?: string | null
          unit_price?: number
        }
        Relationships: []
      }
      camera_configs: {
        Row: {
          camera_id: string
          counting_lines: Json | null
          created_at: string
          id: string
          person_threshold: number
          updated_at: string
          vehicle_threshold: number
        }
        Insert: {
          camera_id: string
          counting_lines?: Json | null
          created_at?: string
          id?: string
          person_threshold?: number
          updated_at?: string
          vehicle_threshold?: number
        }
        Update: {
          camera_id?: string
          counting_lines?: Json | null
          created_at?: string
          id?: string
          person_threshold?: number
          updated_at?: string
          vehicle_threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "camera_configs_camera_id_fkey"
            columns: ["camera_id"]
            isOneToOne: true
            referencedRelation: "cameras"
            referencedColumns: ["id"]
          },
        ]
      }
      cameras: {
        Row: {
          created_at: string
          id: string
          last_seen: string | null
          name: string | null
          online: boolean
          org_id: string | null
          stream_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          last_seen?: string | null
          name?: string | null
          online?: boolean
          org_id?: string | null
          stream_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen?: string | null
          name?: string | null
          online?: boolean
          org_id?: string | null
          stream_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cameras_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          metadata: Json | null
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          metadata?: Json | null
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          metadata?: Json | null
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      data_subject_requests: {
        Row: {
          completed_at: string | null
          completion_notes: string | null
          created_at: string
          data_subject_id: string
          data_subject_type: string
          description: string | null
          id: string
          org_id: string
          request_type: string
          requester_email: string | null
          requester_name: string | null
          response_due_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          data_subject_id: string
          data_subject_type: string
          description?: string | null
          id?: string
          org_id: string
          request_type: string
          requester_email?: string | null
          requester_name?: string | null
          response_due_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          data_subject_id?: string
          data_subject_type?: string
          description?: string | null
          id?: string
          org_id?: string
          request_type?: string
          requester_email?: string | null
          requester_name?: string | null
          response_due_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_subject_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_bindings: {
        Row: {
          created_at: string
          demo_id: string | null
          id: string
          params: Json | null
          service: string
        }
        Insert: {
          created_at?: string
          demo_id?: string | null
          id?: string
          params?: Json | null
          service: string
        }
        Update: {
          created_at?: string
          demo_id?: string | null
          id?: string
          params?: Json | null
          service?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_bindings_demo_id_fkey"
            columns: ["demo_id"]
            isOneToOne: false
            referencedRelation: "demo_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_sources: {
        Row: {
          active: boolean | null
          analytic: string
          confidence: number | null
          created_at: string
          id: string
          location: string | null
          name: string
          protocol: string
          url: string
        }
        Insert: {
          active?: boolean | null
          analytic: string
          confidence?: number | null
          created_at?: string
          id?: string
          location?: string | null
          name: string
          protocol: string
          url: string
        }
        Update: {
          active?: boolean | null
          analytic?: string
          confidence?: number | null
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          protocol?: string
          url?: string
        }
        Relationships: []
      }
      edge_clips: {
        Row: {
          camera_id: string | null
          clip_path: string
          clip_url: string | null
          created_at: string
          device_id: string
          duration_seconds: number | null
          end_time: string
          file_size_bytes: number | null
          id: string
          metadata: Json | null
          org_id: string
          start_time: string
          upload_requested_at: string
          upload_status: string
          uploaded_at: string | null
        }
        Insert: {
          camera_id?: string | null
          clip_path: string
          clip_url?: string | null
          created_at?: string
          device_id: string
          duration_seconds?: number | null
          end_time: string
          file_size_bytes?: number | null
          id?: string
          metadata?: Json | null
          org_id: string
          start_time: string
          upload_requested_at?: string
          upload_status?: string
          uploaded_at?: string | null
        }
        Update: {
          camera_id?: string | null
          clip_path?: string
          clip_url?: string | null
          created_at?: string
          device_id?: string
          duration_seconds?: number | null
          end_time?: string
          file_size_bytes?: number | null
          id?: string
          metadata?: Json | null
          org_id?: string
          start_time?: string
          upload_requested_at?: string
          upload_status?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "edge_clips_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "edge_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edge_clips_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_devices: {
        Row: {
          created_at: string
          device_id: string
          device_name: string
          device_type: string
          id: string
          ip_address: string | null
          last_seen: string | null
          linked_at: string | null
          location: string | null
          metadata: Json | null
          org_id: string
          status: string
          updated_at: string
          version: string | null
        }
        Insert: {
          created_at?: string
          device_id: string
          device_name: string
          device_type?: string
          id?: string
          ip_address?: string | null
          last_seen?: string | null
          linked_at?: string | null
          location?: string | null
          metadata?: Json | null
          org_id: string
          status?: string
          updated_at?: string
          version?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string
          device_name?: string
          device_type?: string
          id?: string
          ip_address?: string | null
          last_seen?: string | null
          linked_at?: string | null
          location?: string | null
          metadata?: Json | null
          org_id?: string
          status?: string
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "edge_devices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_classes: {
        Row: {
          created_at: string | null
          id: string
          name: string
          timezone: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          timezone?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          timezone?: string | null
        }
        Relationships: []
      }
      edu_incidents: {
        Row: {
          aggregation_key: string | null
          class_id: string | null
          clip_url: string | null
          first_ts: string | null
          id: string
          last_ts: string | null
          notes: string | null
          severity: string
          signals_count: number | null
          status: string
          student_id: string | null
        }
        Insert: {
          aggregation_key?: string | null
          class_id?: string | null
          clip_url?: string | null
          first_ts?: string | null
          id?: string
          last_ts?: string | null
          notes?: string | null
          severity: string
          signals_count?: number | null
          status?: string
          student_id?: string | null
        }
        Update: {
          aggregation_key?: string | null
          class_id?: string | null
          clip_url?: string | null
          first_ts?: string | null
          id?: string
          last_ts?: string | null
          notes?: string | null
          severity?: string
          signals_count?: number | null
          status?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "edu_incidents_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "edu_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_incidents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "edu_roster"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_policies: {
        Row: {
          class_id: string | null
          id: string
          notify_min_severity: string | null
          thresholds: Json
        }
        Insert: {
          class_id?: string | null
          id?: string
          notify_min_severity?: string | null
          thresholds: Json
        }
        Update: {
          class_id?: string | null
          id?: string
          notify_min_severity?: string | null
          thresholds?: Json
        }
        Relationships: [
          {
            foreignKeyName: "edu_policies_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "edu_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_reviews: {
        Row: {
          decision: string
          id: string
          incident_id: string | null
          notes: string | null
          reviewed_at: string | null
          reviewer_user_id: string | null
        }
        Insert: {
          decision: string
          id?: string
          incident_id?: string | null
          notes?: string | null
          reviewed_at?: string | null
          reviewer_user_id?: string | null
        }
        Update: {
          decision?: string
          id?: string
          incident_id?: string | null
          notes?: string | null
          reviewed_at?: string | null
          reviewer_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "edu_reviews_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "edu_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_roster: {
        Row: {
          class_id: string | null
          id: string
          metadata: Json | null
          student_code: string
        }
        Insert: {
          class_id?: string | null
          id?: string
          metadata?: Json | null
          student_code: string
        }
        Update: {
          class_id?: string | null
          id?: string
          metadata?: Json | null
          student_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "edu_roster_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "edu_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_signals: {
        Row: {
          affect_probs: Json | null
          affect_state: string | null
          camera_id: string | null
          class_id: string | null
          details: Json | null
          frame_url: string | null
          id: string
          severity: string
          student_id: string | null
          ts: string | null
          type: string
        }
        Insert: {
          affect_probs?: Json | null
          affect_state?: string | null
          camera_id?: string | null
          class_id?: string | null
          details?: Json | null
          frame_url?: string | null
          id?: string
          severity: string
          student_id?: string | null
          ts?: string | null
          type: string
        }
        Update: {
          affect_probs?: Json | null
          affect_state?: string | null
          camera_id?: string | null
          class_id?: string | null
          details?: Json | null
          frame_url?: string | null
          id?: string
          severity?: string
          student_id?: string | null
          ts?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "edu_signals_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "edu_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_signals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "edu_roster"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          camera_id: string | null
          face_similarity: number | null
          frames_confirmed: number | null
          id: number
          movement_px: number | null
          person_id: string | null
          reason: string | null
          reid_similarity: number | null
          ts: string | null
        }
        Insert: {
          camera_id?: string | null
          face_similarity?: number | null
          frames_confirmed?: number | null
          id?: number
          movement_px?: number | null
          person_id?: string | null
          reason?: string | null
          reid_similarity?: number | null
          ts?: string | null
        }
        Update: {
          camera_id?: string | null
          face_similarity?: number | null
          frames_confirmed?: number | null
          id?: number
          movement_px?: number | null
          person_id?: string | null
          reason?: string | null
          reid_similarity?: number | null
          ts?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          clip_url: string | null
          first_ts: string | null
          id: string
          last_ts: string | null
          org_id: string | null
          report_url: string | null
          severity: string
          signals_count: number | null
          status: string
          stream_id: string | null
        }
        Insert: {
          clip_url?: string | null
          first_ts?: string | null
          id?: string
          last_ts?: string | null
          org_id?: string | null
          report_url?: string | null
          severity: string
          signals_count?: number | null
          status?: string
          stream_id?: string | null
        }
        Update: {
          clip_url?: string | null
          first_ts?: string | null
          id?: string
          last_ts?: string | null
          org_id?: string | null
          report_url?: string | null
          severity?: string
          signals_count?: number | null
          status?: string
          stream_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          amount: number
          created_at: string | null
          description: string
          id: string
          invoice_id: string | null
          metric_type: string
          quantity: number
          stripe_price_id: string | null
          unit_price: number
        }
        Insert: {
          amount: number
          created_at?: string | null
          description: string
          id?: string
          invoice_id?: string | null
          metric_type: string
          quantity: number
          stripe_price_id?: string | null
          unit_price: number
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string
          id?: string
          invoice_id?: string | null
          metric_type?: string
          quantity?: number
          stripe_price_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          billing_period_id: string | null
          created_at: string | null
          currency: string
          due_date: string | null
          id: string
          invoice_number: string | null
          org_id: string | null
          paid_at: string | null
          period_end: string
          period_start: string
          status: string
          stripe_invoice_id: string | null
          subtotal_amount: number
          tax_amount: number | null
          total_amount: number
          total_analytics: number | null
          total_minutes: number | null
          total_storage_gb: number | null
          updated_at: string | null
        }
        Insert: {
          billing_period_id?: string | null
          created_at?: string | null
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          org_id?: string | null
          paid_at?: string | null
          period_end: string
          period_start: string
          status?: string
          stripe_invoice_id?: string | null
          subtotal_amount?: number
          tax_amount?: number | null
          total_amount?: number
          total_analytics?: number | null
          total_minutes?: number | null
          total_storage_gb?: number | null
          updated_at?: string | null
        }
        Update: {
          billing_period_id?: string | null
          created_at?: string | null
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          org_id?: string | null
          paid_at?: string | null
          period_end?: string
          period_start?: string
          status?: string
          stripe_invoice_id?: string | null
          subtotal_amount?: number
          tax_amount?: number | null
          total_amount?: number
          total_analytics?: number | null
          total_minutes?: number | null
          total_storage_gb?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_billing_period_id_fkey"
            columns: ["billing_period_id"]
            isOneToOne: false
            referencedRelation: "billing_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_api_keys: {
        Row: {
          created_at: string | null
          id: string
          last_used_at: string | null
          name: string
          org_id: string | null
          secret: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          name: string
          org_id?: string | null
          secret: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          org_id?: string | null
          secret?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_api_keys_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_users: {
        Row: {
          created_at: string | null
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      orgs: {
        Row: {
          created_at: string | null
          id: string
          name: string
          plan: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          plan?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          plan?: string
        }
        Relationships: []
      }
      payment_sessions: {
        Row: {
          amount: number
          created_at: string
          credits: number
          currency: string
          id: string
          status: string
          stripe_session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          credits: number
          currency?: string
          id?: string
          status: string
          stripe_session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          credits?: number
          currency?: string
          id?: string
          status?: string
          stripe_session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      people: {
        Row: {
          body_embedding: string | null
          created_at: string | null
          face_embedding: string | null
          id: string
          name: string
        }
        Insert: {
          body_embedding?: string | null
          created_at?: string | null
          face_embedding?: string | null
          id?: string
          name: string
        }
        Update: {
          body_embedding?: string | null
          created_at?: string | null
          face_embedding?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      people_faces: {
        Row: {
          created_at: string
          embedding: string
          id: string
          person_id: string
        }
        Insert: {
          created_at?: string
          embedding: string
          id?: string
          person_id: string
        }
        Update: {
          created_at?: string
          embedding?: string
          id?: string
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_faces_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_consents: {
        Row: {
          consent_date: string | null
          consent_status: string
          consent_type: string
          created_at: string
          data_subject_id: string | null
          data_subject_type: string
          expiry_date: string | null
          id: string
          legal_basis: string
          metadata: Json | null
          org_id: string
          purpose: string
          updated_at: string
          withdrawal_date: string | null
        }
        Insert: {
          consent_date?: string | null
          consent_status?: string
          consent_type: string
          created_at?: string
          data_subject_id?: string | null
          data_subject_type: string
          expiry_date?: string | null
          id?: string
          legal_basis: string
          metadata?: Json | null
          org_id: string
          purpose: string
          updated_at?: string
          withdrawal_date?: string | null
        }
        Update: {
          consent_date?: string | null
          consent_status?: string
          consent_type?: string
          created_at?: string
          data_subject_id?: string | null
          data_subject_type?: string
          expiry_date?: string | null
          id?: string
          legal_basis?: string
          metadata?: Json | null
          org_id?: string
          purpose?: string
          updated_at?: string
          withdrawal_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "privacy_consents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_settings: {
        Row: {
          anonymization_mode: string
          compliance_framework: string
          consent_required: boolean
          created_at: string
          data_minimization: boolean
          face_blur_enabled: boolean
          id: string
          license_plate_blur_enabled: boolean
          org_id: string
          retention_override: Json | null
          updated_at: string
        }
        Insert: {
          anonymization_mode?: string
          compliance_framework?: string
          consent_required?: boolean
          created_at?: string
          data_minimization?: boolean
          face_blur_enabled?: boolean
          id?: string
          license_plate_blur_enabled?: boolean
          org_id: string
          retention_override?: Json | null
          updated_at?: string
        }
        Update: {
          anonymization_mode?: string
          compliance_framework?: string
          consent_required?: boolean
          created_at?: string
          data_minimization?: boolean
          face_blur_enabled?: boolean
          id?: string
          license_plate_blur_enabled?: boolean
          org_id?: string
          retention_override?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "privacy_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      quotas: {
        Row: {
          max_minutes_month: number
          max_storage_gb: number
          max_streams: number
          org_id: string
          overage_allowed: boolean | null
        }
        Insert: {
          max_minutes_month?: number
          max_storage_gb?: number
          max_streams?: number
          org_id: string
          overage_allowed?: boolean | null
        }
        Update: {
          max_minutes_month?: number
          max_storage_gb?: number
          max_streams?: number
          org_id?: string
          overage_allowed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "quotas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      retention_policies: {
        Row: {
          auto_delete: boolean
          created_at: string
          data_type: string
          id: string
          legal_basis: string | null
          org_id: string
          retention_days: number
          updated_at: string
        }
        Insert: {
          auto_delete?: boolean
          created_at?: string
          data_type: string
          id?: string
          legal_basis?: string | null
          org_id: string
          retention_days: number
          updated_at?: string
        }
        Update: {
          auto_delete?: boolean
          created_at?: string
          data_type?: string
          id?: string
          legal_basis?: string | null
          org_id?: string
          retention_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retention_policies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_incidents: {
        Row: {
          aggregation_key: string | null
          clip_url: string | null
          created_at: string | null
          first_ts: string | null
          id: string
          last_ts: string | null
          report_url: string | null
          severity: string
          signals_count: number | null
          site_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          aggregation_key?: string | null
          clip_url?: string | null
          created_at?: string | null
          first_ts?: string | null
          id?: string
          last_ts?: string | null
          report_url?: string | null
          severity: string
          signals_count?: number | null
          site_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          aggregation_key?: string | null
          clip_url?: string | null
          created_at?: string | null
          first_ts?: string | null
          id?: string
          last_ts?: string | null
          report_url?: string | null
          severity?: string
          signals_count?: number | null
          site_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safety_incidents_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "safety_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_policies: {
        Row: {
          created_at: string | null
          id: string
          required_epis: Json
          site_id: string | null
          thresholds: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          required_epis: Json
          site_id?: string | null
          thresholds: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          required_epis?: Json
          site_id?: string | null
          thresholds?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safety_policies_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "safety_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_signals: {
        Row: {
          camera_id: string | null
          details: Json | null
          frame_url: string | null
          id: string
          site_id: string | null
          ts: string
          type: string
          zone_id: string | null
        }
        Insert: {
          camera_id?: string | null
          details?: Json | null
          frame_url?: string | null
          id?: string
          site_id?: string | null
          ts?: string
          type: string
          zone_id?: string | null
        }
        Update: {
          camera_id?: string | null
          details?: Json | null
          frame_url?: string | null
          id?: string
          site_id?: string | null
          ts?: string
          type?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safety_signals_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "safety_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_signals_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "safety_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_sites: {
        Row: {
          created_at: string | null
          id: string
          name: string
          timezone: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          timezone?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          timezone?: string | null
        }
        Relationships: []
      }
      safety_zones: {
        Row: {
          created_at: string | null
          id: string
          label: string
          polygon: Json
          site_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          label: string
          polygon: Json
          site_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          label?: string
          polygon?: Json
          site_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safety_zones_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "safety_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      service_policies: {
        Row: {
          camera_id: string | null
          class_id: string | null
          config: Json
          created_at: string
          id: string
          org_id: string | null
          policy_type: string
          service_name: string
          site_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          camera_id?: string | null
          class_id?: string | null
          config?: Json
          created_at?: string
          id?: string
          org_id?: string | null
          policy_type: string
          service_name: string
          site_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          camera_id?: string | null
          class_id?: string | null
          config?: Json
          created_at?: string
          id?: string
          org_id?: string | null
          policy_type?: string
          service_name?: string
          site_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_policies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      signals: {
        Row: {
          details: Json | null
          frame_url: string | null
          id: string
          org_id: string | null
          severity: string
          stream_id: string | null
          ts: string | null
          type: string
        }
        Insert: {
          details?: Json | null
          frame_url?: string | null
          id?: string
          org_id?: string | null
          severity: string
          stream_id?: string | null
          ts?: string | null
          type: string
        }
        Update: {
          details?: Json | null
          frame_url?: string | null
          id?: string
          org_id?: string | null
          severity?: string
          stream_id?: string | null
          ts?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "signals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      streams: {
        Row: {
          analytic: string
          camera_id: string
          created_at: string | null
          id: string
          org_id: string | null
          status: string
        }
        Insert: {
          analytic: string
          camera_id: string
          created_at?: string | null
          id?: string
          org_id?: string | null
          status?: string
        }
        Update: {
          analytic?: string
          camera_id?: string
          created_at?: string | null
          id?: string
          org_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "streams_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          analytic: string
          created_at: string | null
          frames: number | null
          id: number
          metadata: Json | null
          minutes: number
          org_id: string | null
          storage_mb: number | null
          stream_id: string | null
          ts_end: string
          ts_start: string
        }
        Insert: {
          analytic: string
          created_at?: string | null
          frames?: number | null
          id?: number
          metadata?: Json | null
          minutes: number
          org_id?: string | null
          storage_mb?: number | null
          stream_id?: string | null
          ts_end: string
          ts_start: string
        }
        Update: {
          analytic?: string
          created_at?: string | null
          frames?: number | null
          id?: number
          metadata?: Json | null
          minutes?: number
          org_id?: string | null
          storage_mb?: number | null
          stream_id?: string | null
          ts_end?: string
          ts_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_events_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicle_events: {
        Row: {
          bbox: Json | null
          camera_id: string | null
          confidence: number | null
          event_id: number | null
          id: number
          person_id: string | null
          plate: string | null
          ts: string
        }
        Insert: {
          bbox?: Json | null
          camera_id?: string | null
          confidence?: number | null
          event_id?: number | null
          id?: number
          person_id?: string | null
          plate?: string | null
          ts?: string
        }
        Update: {
          bbox?: Json | null
          camera_id?: string | null
          confidence?: number | null
          event_id?: number | null
          id?: number
          person_id?: string | null
          plate?: string | null
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          created_at: string
          id: string
          label: string | null
          notes: string | null
          plate: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          notes?: string | null
          plate: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          notes?: string | null
          plate?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      current_org: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_antitheft_incidents: {
        Args: {
          p_from?: string
          p_to?: string
          p_camera_id?: string
          p_severity?: string
        }
        Returns: {
          camera_id: string
          id: number
          meta: Json | null
          person_id: string | null
          severity: string
          ts: string
        }[]
      }
      get_media_retention_days: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      has_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: unknown
      }
      match_body: {
        Args: { query: string; k?: number }
        Returns: {
          id: string
          name: string
          similarity: number
        }[]
      }
      match_face: {
        Args: { query: string; k?: number }
        Returns: {
          id: string
          name: string
          similarity: number
        }[]
      }
      set_config: {
        Args: { parameter: string; value: string }
        Returns: string
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      user_belongs_to_org: {
        Args: { user_id: string; org_id: string }
        Returns: boolean
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "operator" | "viewer" | "security"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "operator", "viewer", "security"],
    },
  },
} as const

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      cities: {
        Row: {
          country: string
          created_at: string
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          slug: string
          state: string | null
          timezone: string
        }
        Insert: {
          country?: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          slug: string
          state?: string | null
          timezone?: string
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          slug?: string
          state?: string | null
          timezone?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          body: string
          created_at: string
          event_id: string
          id: string
          is_approved: boolean
          is_flagged: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          event_id: string
          id?: string
          is_approved?: boolean
          is_flagged?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          event_id?: string
          id?: string
          is_approved?: boolean
          is_flagged?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_sources: {
        Row: {
          city_id: string | null
          created_at: string
          error_count: number
          id: string
          is_active: boolean
          last_scraped_at: string | null
          last_status: string | null
          name: string
          notes: string | null
          scrape_interval_hours: number
          source_type: string
          updated_at: string
          url: string
        }
        Insert: {
          city_id?: string | null
          created_at?: string
          error_count?: number
          id?: string
          is_active?: boolean
          last_scraped_at?: string | null
          last_status?: string | null
          name: string
          notes?: string | null
          scrape_interval_hours?: number
          source_type?: string
          updated_at?: string
          url: string
        }
        Update: {
          city_id?: string | null
          created_at?: string
          error_count?: number
          id?: string
          is_active?: boolean
          last_scraped_at?: string | null
          last_status?: string | null
          name?: string
          notes?: string | null
          scrape_interval_hours?: number
          source_type?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_sources_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      event_tags: {
        Row: {
          confidence: number
          created_at: string
          event_id: string
          is_manual_override: boolean
          tag_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          event_id: string
          is_manual_override?: boolean
          tag_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          event_id?: string
          is_manual_override?: boolean
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_tags_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          address: string | null
          age_max: number | null
          age_min: number | null
          ai_confidence: number | null
          ai_tag_provider: string | null
          city_id: string | null
          created_at: string
          description: string | null
          end_datetime: string | null
          id: string
          images: Json
          is_featured: boolean
          is_free: boolean
          latitude: number | null
          longitude: number | null
          price: number | null
          recurrence_info: Json | null
          search_vector: unknown
          source_id: string | null
          source_name: string | null
          source_url: string | null
          start_datetime: string
          status: string
          timezone: string
          title: string
          updated_at: string
          venue_name: string | null
          view_count: number
        }
        Insert: {
          address?: string | null
          age_max?: number | null
          age_min?: number | null
          ai_confidence?: number | null
          ai_tag_provider?: string | null
          city_id?: string | null
          created_at?: string
          description?: string | null
          end_datetime?: string | null
          id?: string
          images?: Json
          is_featured?: boolean
          is_free?: boolean
          latitude?: number | null
          longitude?: number | null
          price?: number | null
          recurrence_info?: Json | null
          search_vector?: unknown
          source_id?: string | null
          source_name?: string | null
          source_url?: string | null
          start_datetime: string
          status?: string
          timezone?: string
          title: string
          updated_at?: string
          venue_name?: string | null
          view_count?: number
        }
        Update: {
          address?: string | null
          age_max?: number | null
          age_min?: number | null
          ai_confidence?: number | null
          ai_tag_provider?: string | null
          city_id?: string | null
          created_at?: string
          description?: string | null
          end_datetime?: string | null
          id?: string
          images?: Json
          is_featured?: boolean
          is_free?: boolean
          latitude?: number | null
          longitude?: number | null
          price?: number | null
          recurrence_info?: Json | null
          search_vector?: unknown
          source_id?: string | null
          source_name?: string | null
          source_url?: string | null
          start_datetime?: string
          status?: string
          timezone?: string
          title?: string
          updated_at?: string
          venue_name?: string | null
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "events_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "event_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          max_uses: number
          notes: string | null
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          max_uses?: number
          notes?: string | null
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          max_uses?: number
          notes?: string | null
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_access: {
        Row: {
          created_at: string
          disabled_at: string | null
          disabled_reason: string | null
          enabled_at: string | null
          is_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          disabled_at?: string | null
          disabled_reason?: string | null
          enabled_at?: string | null
          is_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          disabled_at?: string | null
          disabled_reason?: string | null
          enabled_at?: string | null
          is_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          created_at: string
          event_id: string
          id: string
          score: number
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          score: number
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_signals: {
        Row: {
          created_at: string
          event_id: string
          id: string
          signal_type: string
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          signal_type: string
          user_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          signal_type?: string
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_signals_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_signals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      source_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_log: string | null
          events_found: number
          events_imported: number
          events_skipped: number
          id: string
          source_id: string | null
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_log?: string | null
          events_found?: number
          events_imported?: number
          events_skipped?: number
          id?: string
          source_id?: string | null
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_log?: string | null
          events_found?: number
          events_imported?: number
          events_skipped?: number
          id?: string
          source_id?: string | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "event_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          category: string
          color: string
          created_at: string
          id: string
          is_system: boolean
          name: string
          slug: string
        }
        Insert: {
          category?: string
          color?: string
          created_at?: string
          id?: string
          is_system?: boolean
          name: string
          slug: string
        }
        Update: {
          category?: string
          color?: string
          created_at?: string
          id?: string
          is_system?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      user_calendar_events: {
        Row: {
          added_at: string
          event_id: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          added_at?: string
          event_id: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          added_at?: string
          event_id?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_calendar_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_calendar_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          child_age: number | null
          child_name: string | null
          city_preference_id: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          child_age?: number | null
          child_name?: string | null
          city_preference_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          child_age?: number | null
          child_name?: string | null
          city_preference_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_city_preference_id_fkey"
            columns: ["city_preference_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      event_rating_stats: {
        Row: {
          avg_score: number | null
          event_id: string | null
          rating_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ratings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      claim_pending_invite_access: { Args: never; Returns: boolean }
      invites_required: { Args: never; Returns: boolean }
      invoke_scrape_source: {
        Args: { source_uuid: string }
        Returns: undefined
      }
      redeem_invite_for_email: {
        Args: { p_code: string; p_email: string }
        Returns: boolean
      }
      redeem_invite: { Args: { p_code: string }; Returns: boolean }
      run_due_source_scrapes: { Args: never; Returns: undefined }
      search_events: {
        Args: {
          p_age_max?: number
          p_age_min?: number
          p_city_id?: string
          p_date_from?: string
          p_date_to?: string
          p_is_featured?: boolean
          p_is_free?: boolean
          p_keyword?: string
          p_limit?: number
          p_offset?: number
          p_status?: string
          p_tag_slugs?: string[]
        }
        Returns: {
          address: string | null
          age_max: number | null
          age_min: number | null
          ai_confidence: number | null
          ai_tag_provider: string | null
          city_id: string | null
          created_at: string
          description: string | null
          end_datetime: string | null
          id: string
          images: Json
          is_featured: boolean
          is_free: boolean
          latitude: number | null
          longitude: number | null
          price: number | null
          recurrence_info: Json | null
          search_vector: unknown
          source_id: string | null
          source_name: string | null
          source_url: string | null
          start_datetime: string
          status: string
          timezone: string
          title: string
          updated_at: string
          venue_name: string | null
          view_count: number
        }[]
        SetofOptions: {
          from: "*"
          to: "events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      [_ in never]: never
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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    Enums: {},
  },
} as const

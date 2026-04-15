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
          last_status: "pending" | "success" | "error" | "partial" | null
          name: string
          notes: string | null
          scrape_interval_hours: number
          source_type: "website" | "ical" | "rss" | "manual"
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
          last_status?: "pending" | "success" | "error" | "partial" | null
          name: string
          notes?: string | null
          scrape_interval_hours?: number
          source_type: "website" | "ical" | "rss" | "manual"
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
          last_status?: "pending" | "success" | "error" | "partial" | null
          name?: string
          notes?: string | null
          scrape_interval_hours?: number
          source_type?: "website" | "ical" | "rss" | "manual"
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
          city_id: string | null
          created_at: string
          description: string | null
          end_datetime: string | null
          id: string
          images: string[]
          is_featured: boolean
          is_free: boolean
          latitude: number | null
          longitude: number | null
          price: number | null
          recurrence_info: Json | null
          search_vector: string | null
          source_id: string | null
          source_name: string | null
          source_url: string | null
          start_datetime: string
          status: "draft" | "published" | "rejected" | "archived"
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
          city_id?: string | null
          created_at?: string
          description?: string | null
          end_datetime?: string | null
          id?: string
          images?: string[]
          is_featured?: boolean
          is_free?: boolean
          latitude?: number | null
          longitude?: number | null
          price?: number | null
          recurrence_info?: Json | null
          search_vector?: string | null
          source_id?: string | null
          source_name?: string | null
          source_url?: string | null
          start_datetime: string
          status?: "draft" | "published" | "rejected" | "archived"
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
          city_id?: string | null
          created_at?: string
          description?: string | null
          end_datetime?: string | null
          id?: string
          images?: string[]
          is_featured?: boolean
          is_free?: boolean
          latitude?: number | null
          longitude?: number | null
          price?: number | null
          recurrence_info?: Json | null
          search_vector?: string | null
          source_id?: string | null
          source_name?: string | null
          source_url?: string | null
          start_datetime?: string
          status?: "draft" | "published" | "rejected" | "archived"
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
          signal_type: "view" | "favorite" | "calendar" | "rate" | "comment"
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          signal_type: "view" | "favorite" | "calendar" | "rate" | "comment"
          user_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          signal_type?: "view" | "favorite" | "calendar" | "rate" | "comment"
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
          status: "running" | "success" | "error" | "partial"
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
          status?: "running" | "success" | "error" | "partial"
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
          status?: "running" | "success" | "error" | "partial"
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
          role: "user" | "admin"
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
          role?: "user" | "admin"
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
          role?: "user" | "admin"
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
      [_ in never]: never
    }
    Functions: {
      invoke_scrape_source: {
        Args: { source_id: string }
        Returns: boolean
      }
      run_due_source_scrapes: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
    }
    Enums: {
      event_source_status: "pending" | "success" | "error" | "partial"
      event_source_type: "website" | "ical" | "rss" | "manual"
      event_status: "draft" | "published" | "rejected" | "archived"
      recommendation_signal_type: "view" | "favorite" | "calendar" | "rate" | "comment"
      source_run_status: "running" | "success" | "error" | "partial"
      user_role: "user" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<
  PublicTableNameOrOptions extends keyof PublicSchema["Tables"] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Row: infer RowType
    }
    ? RowType
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Row: infer RowType
      }
      ? RowType
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends keyof PublicSchema["Tables"] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer InsertType
    }
    ? InsertType
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer InsertType
      }
      ? InsertType
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends keyof PublicSchema["Tables"] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer UpdateType
    }
    ? UpdateType
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer UpdateType
      }
      ? UpdateType
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends keyof PublicSchema["Enums"] | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

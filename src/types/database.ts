export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      buddy_group_members: {
        Row: {
          buddy_group_id: string
          id: string
          joined_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          buddy_group_id: string
          id?: string
          joined_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          buddy_group_id?: string
          id?: string
          joined_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buddy_group_members_buddy_group_id_fkey"
            columns: ["buddy_group_id"]
            isOneToOne: false
            referencedRelation: "buddy_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      buddy_groups: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_private: boolean
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_private?: boolean
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_private?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "buddy_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_invitation_codes: {
        Row: {
          club_id: string
          code_hash: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
        }
        Insert: {
          club_id: string
          code_hash: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
        }
        Update: {
          club_id?: string
          code_hash?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "club_invitation_codes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_invitation_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_memberships: {
        Row: {
          club_id: string
          created_at: string
          ended_at: string | null
          id: string
          joined_at: string | null
          status: Database["public"]["Enums"]["membership_status"]
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          joined_at?: string | null
          status?: Database["public"]["Enums"]["membership_status"]
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          joined_at?: string | null
          status?: Database["public"]["Enums"]["membership_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_memberships_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          club_type: Database["public"]["Enums"]["club_type"]
          created_at: string
          created_by: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["org_status"]
          zone_id: string
        }
        Insert: {
          club_type: Database["public"]["Enums"]["club_type"]
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["org_status"]
          zone_id: string
        }
        Update: {
          club_type?: Database["public"]["Enums"]["club_type"]
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["org_status"]
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clubs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clubs_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      districts: {
        Row: {
          country_code: string | null
          created_at: string
          id: string
          name: string
          status: Database["public"]["Enums"]["org_status"]
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["org_status"]
        }
        Update: {
          country_code?: string | null
          created_at?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["org_status"]
        }
        Relationships: []
      }
      match_participants: {
        Row: {
          buddy_group_id: string | null
          id: string
          joined_at: string
          match_id: string
          representation: Database["public"]["Enums"]["representation_scope"]
          representation_locked_at: string | null
          represented_entity_id: string | null
          user_id: string
        }
        Insert: {
          buddy_group_id?: string | null
          id?: string
          joined_at?: string
          match_id: string
          representation?: Database["public"]["Enums"]["representation_scope"]
          representation_locked_at?: string | null
          represented_entity_id?: string | null
          user_id: string
        }
        Update: {
          buddy_group_id?: string | null
          id?: string
          joined_at?: string
          match_id?: string
          representation?: Database["public"]["Enums"]["representation_scope"]
          representation_locked_at?: string | null
          represented_entity_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_participants_buddy_group_id_fkey"
            columns: ["buddy_group_id"]
            isOneToOne: false
            referencedRelation: "buddy_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_participants_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string
          created_by: string
          ended_at: string | null
          game_code: string
          id: string
          is_official: boolean
          rule_version: string
          starts_at: string | null
          status: Database["public"]["Enums"]["match_status"]
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          ended_at?: string | null
          game_code: string
          id?: string
          is_official?: boolean
          rule_version?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          ended_at?: string | null
          game_code?: string
          id?: string
          is_official?: boolean
          rule_version?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_history: {
        Row: {
          action: string
          approved_by: string | null
          id: string
          initiated_by: string | null
          new_club_id: string | null
          notes: string | null
          occurred_at: string
          old_club_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          approved_by?: string | null
          id?: string
          initiated_by?: string | null
          new_club_id?: string | null
          notes?: string | null
          occurred_at?: string
          old_club_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          approved_by?: string | null
          id?: string
          initiated_by?: string | null
          new_club_id?: string | null
          notes?: string | null
          occurred_at?: string
          old_club_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_history_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_history_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_history_new_club_id_fkey"
            columns: ["new_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_history_old_club_id_fkey"
            columns: ["old_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          platform_role: Database["public"]["Enums"]["platform_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id: string
          platform_role?: Database["public"]["Enums"]["platform_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          platform_role?: Database["public"]["Enums"]["platform_role"]
          updated_at?: string
        }
        Relationships: []
      }
      score_ledger: {
        Row: {
          destination_entity_id: string | null
          destination_scope: Database["public"]["Enums"]["representation_scope"]
          id: string
          idempotency_key: string
          match_id: string
          participant_id: string | null
          player_id: string
          points: number
          recorded_at: string
          reverses_entry_id: string | null
          rule_version: string
          score_type: string
        }
        Insert: {
          destination_entity_id?: string | null
          destination_scope?: Database["public"]["Enums"]["representation_scope"]
          id?: string
          idempotency_key: string
          match_id: string
          participant_id?: string | null
          player_id: string
          points: number
          recorded_at?: string
          reverses_entry_id?: string | null
          rule_version: string
          score_type: string
        }
        Update: {
          destination_entity_id?: string | null
          destination_scope?: Database["public"]["Enums"]["representation_scope"]
          id?: string
          idempotency_key?: string
          match_id?: string
          participant_id?: string | null
          player_id?: string
          points?: number
          recorded_at?: string
          reverses_entry_id?: string | null
          rule_version?: string
          score_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_ledger_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_ledger_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "match_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_ledger_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_ledger_reverses_entry_id_fkey"
            columns: ["reverses_entry_id"]
            isOneToOne: false
            referencedRelation: "score_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      zones: {
        Row: {
          created_at: string
          district_id: string
          id: string
          name: string
          status: Database["public"]["Enums"]["org_status"]
        }
        Insert: {
          created_at?: string
          district_id: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["org_status"]
        }
        Update: {
          created_at?: string
          district_id?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["org_status"]
        }
        Relationships: [
          {
            foreignKeyName: "zones_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      club_type: "rotary" | "rotaract"
      match_status: "draft" | "open" | "in_progress" | "completed" | "cancelled"
      membership_status:
        | "pending"
        | "active"
        | "transferred"
        | "dismissed"
        | "rejected"
      org_status: "pending" | "approved" | "rejected" | "suspended"
      platform_role: "member" | "platform_admin"
      representation_scope:
        | "none"
        | "individual"
        | "buddy_group"
        | "club"
        | "zone"
        | "district"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      club_type: ["rotary", "rotaract"],
      match_status: ["draft", "open", "in_progress", "completed", "cancelled"],
      membership_status: [
        "pending",
        "active",
        "transferred",
        "dismissed",
        "rejected",
      ],
      org_status: ["pending", "approved", "rejected", "suspended"],
      platform_role: ["member", "platform_admin"],
      representation_scope: [
        "none",
        "individual",
        "buddy_group",
        "club",
        "zone",
        "district",
      ],
    },
  },
} as const

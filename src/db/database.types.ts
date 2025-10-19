export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  graphql_public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
  public: {
    Tables: {
      activities: {
        Row: {
          cost: number;
          created_at: string;
          description: string | null;
          facility_id: number;
          id: number;
          name: string;
          participant_limit: number;
          start_datetime: string;
          worker_id: number;
        };
        Insert: {
          cost: number;
          created_at?: string;
          description?: string | null;
          facility_id: number;
          id?: number;
          name: string;
          participant_limit: number;
          start_datetime: string;
          worker_id: number;
        };
        Update: {
          cost?: number;
          created_at?: string;
          description?: string | null;
          facility_id?: number;
          id?: number;
          name?: string;
          participant_limit?: number;
          start_datetime?: string;
          worker_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "activities_facility_id_fkey";
            columns: ["facility_id"];
            isOneToOne: false;
            referencedRelation: "facilities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "workers";
            referencedColumns: ["id"];
          },
        ];
      };
      activity_tags: {
        Row: {
          activity_id: number;
          created_at: string;
          id: number;
          tag: string;
        };
        Insert: {
          activity_id: number;
          created_at?: string;
          id?: number;
          tag: string;
        };
        Update: {
          activity_id?: number;
          created_at?: string;
          id?: number;
          tag?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_tags_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          },
        ];
      };
      children: {
        Row: {
          birth_date: string;
          created_at: string;
          description: string | null;
          first_name: string;
          id: number;
          last_name: string;
          parent_id: string;
        };
        Insert: {
          birth_date: string;
          created_at?: string;
          description?: string | null;
          first_name: string;
          id?: number;
          last_name: string;
          parent_id: string;
        };
        Update: {
          birth_date?: string;
          created_at?: string;
          description?: string | null;
          first_name?: string;
          id?: number;
          last_name?: string;
          parent_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "children_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      enrollments: {
        Row: {
          activity_id: number;
          child_id: number;
          enrolled_at: string;
        };
        Insert: {
          activity_id: number;
          child_id: number;
          enrolled_at?: string;
        };
        Update: {
          activity_id?: number;
          child_id?: number;
          enrolled_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "enrollments_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrollments_child_id_fkey";
            columns: ["child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["id"];
          },
        ];
      };
      facilities: {
        Row: {
          address: string | null;
          created_at: string;
          id: number;
          name: string;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          id?: number;
          name: string;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          id?: number;
          name?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          first_name: string | null;
          id: string;
          last_name: string | null;
          role: Database["public"]["Enums"]["user_role"];
        };
        Insert: {
          created_at?: string;
          first_name?: string | null;
          id: string;
          last_name?: string | null;
          role: Database["public"]["Enums"]["user_role"];
        };
        Update: {
          created_at?: string;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
        };
        Relationships: [];
      };
      workers: {
        Row: {
          created_at: string;
          email: string;
          first_name: string;
          id: number;
          last_name: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          first_name: string;
          id?: number;
          last_name: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          first_name?: string;
          id?: number;
          last_name?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      user_role: "admin" | "parent";
    };
    CompositeTypes: Record<never, never>;
  };
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      user_role: ["admin", "parent"],
    },
  },
} as const;

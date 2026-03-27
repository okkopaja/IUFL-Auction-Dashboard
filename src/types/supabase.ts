export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4";
  };
  public: {
    Tables: {
      AuctionSession: {
        Row: {
          createdAt: string;
          id: string;
          isActive: boolean;
          name: string;
          totalPoints: number;
          updatedAt: string;
        };
        Insert: {
          createdAt?: string;
          id: string;
          isActive?: boolean;
          name: string;
          totalPoints?: number;
          updatedAt: string;
        };
        Update: {
          createdAt?: string;
          id?: string;
          isActive?: boolean;
          name?: string;
          totalPoints?: number;
          updatedAt?: string;
        };
        Relationships: [];
      };
      Player: {
        Row: {
          basePrice: number;
          createdAt: string;
          id: string;
          imageUrl: string | null;
          importOrder: number;
          name: string;
          position1: string;
          position2: string | null;
          sessionId: string;
          status: Database["public"]["Enums"]["PlayerStatus"];
          stream: string;
          teamId: string | null;
          updatedAt: string;
          whatsappNumber: string;
          year: string | null;
        };
        Insert: {
          basePrice?: number;
          createdAt?: string;
          id: string;
          imageUrl?: string | null;
          importOrder?: number;
          name: string;
          position1: string;
          position2?: string | null;
          sessionId: string;
          status?: Database["public"]["Enums"]["PlayerStatus"];
          stream?: string;
          teamId?: string | null;
          updatedAt?: string;
          whatsappNumber?: string;
          year?: string | null;
        };
        Update: {
          basePrice?: number;
          createdAt?: string;
          id?: string;
          imageUrl?: string | null;
          importOrder?: number;
          name?: string;
          position1?: string;
          position2?: string | null;
          sessionId?: string;
          status?: Database["public"]["Enums"]["PlayerStatus"];
          stream?: string;
          teamId?: string | null;
          updatedAt?: string;
          whatsappNumber?: string;
          year?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "Player_sessionId_fkey";
            columns: ["sessionId"];
            isOneToOne: false;
            referencedRelation: "AuctionSession";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "Player_teamId_fkey";
            columns: ["teamId"];
            isOneToOne: false;
            referencedRelation: "Team";
            referencedColumns: ["id"];
          },
        ];
      };
      Team: {
        Row: {
          createdAt: string;
          domain: string;
          id: string;
          name: string;
          pointsSpent: number;
          pointsTotal: number;
          sessionId: string;
          shortCode: string;
        };
        Insert: {
          createdAt?: string;
          domain: string;
          id: string;
          name: string;
          pointsSpent?: number;
          pointsTotal?: number;
          sessionId: string;
          shortCode: string;
        };
        Update: {
          createdAt?: string;
          domain?: string;
          id?: string;
          name?: string;
          pointsSpent?: number;
          pointsTotal?: number;
          sessionId?: string;
          shortCode?: string;
        };
        Relationships: [
          {
            foreignKeyName: "Team_sessionId_fkey";
            columns: ["sessionId"];
            isOneToOne: false;
            referencedRelation: "AuctionSession";
            referencedColumns: ["id"];
          },
        ];
      };
      Transaction: {
        Row: {
          amount: number;
          createdAt: string;
          id: string;
          playerId: string;
          sessionId: string;
          teamId: string;
        };
        Insert: {
          amount: number;
          createdAt?: string;
          id: string;
          playerId: string;
          sessionId: string;
          teamId: string;
        };
        Update: {
          amount?: number;
          createdAt?: string;
          id?: string;
          playerId?: string;
          sessionId?: string;
          teamId?: string;
        };
        Relationships: [
          {
            foreignKeyName: "Transaction_playerId_fkey";
            columns: ["playerId"];
            isOneToOne: false;
            referencedRelation: "Player";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "Transaction_sessionId_fkey";
            columns: ["sessionId"];
            isOneToOne: false;
            referencedRelation: "AuctionSession";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "Transaction_teamId_fkey";
            columns: ["teamId"];
            isOneToOne: false;
            referencedRelation: "Team";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      requesting_user_id: { Args: never; Returns: string };
    };
    Enums: {
      PlayerStatus: "UNSOLD" | "SOLD" | "IN_AUCTION";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
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
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
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
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
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
  public: {
    Enums: {
      PlayerStatus: ["UNSOLD", "SOLD", "IN_AUCTION"],
    },
  },
} as const;

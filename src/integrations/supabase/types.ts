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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      customer_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          name: string | null
          phone: string | null
          resolved: boolean
          restaurant_id: string
          table_number: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          name?: string | null
          phone?: string | null
          resolved?: boolean
          restaurant_id: string
          table_number?: string | null
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          name?: string | null
          phone?: string | null
          resolved?: boolean
          restaurant_id?: string
          table_number?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      category_flows: {
        Row: {
          id: string
          restaurant_id: string
          trigger_category: string
          steps: string[]
          created_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          trigger_category: string
          steps: string[]
          created_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          trigger_category?: string
          steps?: string[]
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_flows_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          amount: number
          created_at: string
          event_date: string | null
          expires_at: string | null
          id: string
          name: string
          paid_at: string | null
          payment_status: string
          paystack_reference: string | null
          qr_enabled: boolean
          restaurant_id: string
          table_count: number
          tier: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          event_date?: string | null
          expires_at?: string | null
          id?: string
          name: string
          paid_at?: string | null
          payment_status?: string
          paystack_reference?: string | null
          qr_enabled?: boolean
          restaurant_id: string
          table_count?: number
          tier?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          event_date?: string | null
          expires_at?: string | null
          id?: string
          name?: string
          paid_at?: string | null
          payment_status?: string
          paystack_reference?: string | null
          qr_enabled?: boolean
          restaurant_id?: string
          table_count?: number
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          available: boolean
          category: string
          created_at: string
          description: string | null
          id: string
          image: string | null
          name: string
          pairs_with: string[]
          price: number
          restaurant_id: string
          updated_at: string
          barcode: string | null
          expiry_date: string | null
          batch_number: string | null
          requires_prescription: boolean | null
        }
        Insert: {
          available?: boolean
          category: string
          created_at?: string
          description?: string | null
          id?: string
          image?: string | null
          name: string
          pairs_with?: string[]
          price: number
          restaurant_id: string
          updated_at?: string
          barcode?: string | null
          expiry_date?: string | null
          batch_number?: string | null
          requires_prescription?: boolean | null
        }
        Update: {
          available?: boolean
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image?: string | null
          name?: string
          pairs_with?: string[]
          price?: number
          restaurant_id?: string
          updated_at?: string
          barcode?: string | null
          expiry_date?: string | null
          batch_number?: string | null
          requires_prescription?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          restaurant_id: string
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          restaurant_id: string
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          restaurant_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          item_intent: string | null
          menu_item_id: string | null
          name: string
          order_id: string
          price: number
          qty: number
        }
        Insert: {
          id?: string
          item_intent?: string | null
          menu_item_id?: string | null
          name: string
          order_id: string
          price: number
          qty: number
        }
        Update: {
          id?: string
          item_intent?: string | null
          menu_item_id?: string | null
          name?: string
          order_id?: string
          price?: number
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_messages: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          order_id: string
          payload: Json | null
          read_at: string | null
          sender: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          order_id: string
          payload?: Json | null
          read_at?: string | null
          sender: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          order_id?: string
          payload?: Json | null
          read_at?: string | null
          sender?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          acknowledged: boolean
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          id: string
          intent: string
          payment_screenshot_url: string | null
          payment_status: string
          restaurant_id: string
          short_code: string
          status: string
          table_number: string
          total: number
          updated_at: string
          patient_id: string | null
        }
        Insert: {
          acknowledged?: boolean
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          intent?: string
          payment_screenshot_url?: string | null
          payment_status?: string
          restaurant_id: string
          short_code: string
          status?: string
          table_number: string
          total?: number
          updated_at?: string
          patient_id?: string | null
        }
        Update: {
          acknowledged?: boolean
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          intent?: string
          payment_screenshot_url?: string | null
          payment_status?: string
          restaurant_id?: string
          short_code?: string
          status?: string
          table_number?: string
          total?: number
          updated_at?: string
          patient_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          active_event_id: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          base_url: string | null
          business_type: string | null
          category_order: string[] | null
          created_at: string
          id: string
          last_payment_at: string | null
          logo_url: string | null
          name: string
          owner_id: string | null
          paystack_reference: string | null
          phone: string | null
          subscription_expires_at: string | null
          subscription_period: string | null
          subscription_plan: string | null
          subscription_status: string
          table_count: number
          trial_ends_at: string | null
          latitude: number | null
          longitude: number | null
          geofencing_enabled: boolean | null
          geofencing_radius: number | null
          staff_codes: string[] | null
          is_accepting_orders: boolean | null
        }
        Insert: {
          active_event_id?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          base_url?: string | null
          business_type?: string | null
          category_order?: string[] | null
          created_at?: string
          id?: string
          last_payment_at?: string | null
          logo_url?: string | null
          name: string
          owner_id?: string | null
          paystack_reference?: string | null
          phone?: string | null
          subscription_expires_at?: string | null
          subscription_period?: string | null
          subscription_plan?: string | null
          subscription_status?: string
          table_count?: number
          trial_ends_at?: string | null
          latitude?: number | null
          longitude?: number | null
          geofencing_enabled?: boolean | null
          geofencing_radius?: number | null
          staff_codes?: string[] | null
          is_accepting_orders?: boolean | null
        }
        Update: {
          active_event_id?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          base_url?: string | null
          business_type?: string | null
          category_order?: string[] | null
          created_at?: string
          id?: string
          last_payment_at?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          paystack_reference?: string | null
          phone?: string | null
          subscription_expires_at?: string | null
          subscription_period?: string | null
          subscription_plan?: string | null
          subscription_status?: string
          table_count?: number
          trial_ends_at?: string | null
          latitude?: number | null
          longitude?: number | null
          geofencing_enabled?: boolean | null
          geofencing_radius?: number | null
          staff_codes?: string[] | null
          is_accepting_orders?: boolean | null
        }
        Relationships: []
      }
      staff_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          restaurant_id: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          restaurant_id: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          restaurant_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_invites_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _restaurant_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_restaurant_member: {
        Args: { _restaurant_id: string }
        Returns: boolean
      }
      redeem_staff_invite: { Args: { _token: string }; Returns: string }
    }
    Enums: {
      app_role: "owner" | "manager" | "staff"
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
      app_role: ["owner", "manager", "staff"],
    },
  },
} as const

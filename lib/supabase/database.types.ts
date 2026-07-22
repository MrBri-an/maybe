export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      app_members: {
        Row: {
          id: string;
          approved_email: string;
          user_id: string | null;
          role: "owner" | "guest";
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          approved_email: string;
          user_id?: string | null;
          role?: "owner" | "guest";
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          approved_email?: string;
          user_id?: string | null;
          role?: "owner" | "guest";
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type AppMember = Database["public"]["Tables"]["app_members"]["Row"];

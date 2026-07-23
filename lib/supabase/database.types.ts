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
      library_books: {
        Row: {
          id: string;
          uploader_user_id: string;
          title: string;
          author: string;
          description: string;
          personal_note: string;
          shelf: "jessicas_shelf" | "read_together";
          reading_status: "not_started" | "reading" | "completed";
          original_filename: string;
          storage_path: string;
          mime_type: string;
          file_extension: "pdf" | "epub" | "txt" | "docx";
          size_bytes: number;
          allow_download: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          uploader_user_id: string;
          title: string;
          author: string;
          description?: string;
          personal_note?: string;
          shelf: "jessicas_shelf" | "read_together";
          reading_status?: "not_started" | "reading" | "completed";
          original_filename: string;
          storage_path: string;
          mime_type: string;
          file_extension: "pdf" | "epub" | "txt" | "docx";
          size_bytes: number;
          allow_download?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          author?: string;
          description?: string;
          personal_note?: string;
          shelf?: "jessicas_shelf" | "read_together";
          reading_status?: "not_started" | "reading" | "completed";
          allow_download?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_journey_progress: {
        Row: {
          user_id: string;
          storybook_page: number;
          storybook_page_updated_at: string | null;
          storybook_completed_at: string | null;
          library_completed_at: string | null;
          puzzle_millionaire_completed_at: string | null;
          puzzle_kculture_completed_at: string | null;
          puzzle_constellation_completed_at: string | null;
          puzzle_millionaire_skipped_at: string | null;
          puzzle_kculture_skipped_at: string | null;
          puzzle_constellation_skipped_at: string | null;
          puzzle_millionaire_best_score: number;
          puzzle_kculture_best_score: number;
          puzzle_millionaire_attempt_state: Json | null;
          puzzle_millionaire_attempt_updated_at: string | null;
          puzzle_kculture_attempt_state: Json | null;
          puzzle_kculture_attempt_updated_at: string | null;
          puzzle_room_completed_at: string | null;
          last_location: "world" | "storybook" | "library" | "puzzle_room";
          last_world_destination: "storybook" | "library" | "puzzle-room" | "jessicas-radio" | "question-garden" | "gallery" | "our-journey" | "maybe-days" | "our-corner" | "open-when" | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          storybook_page?: number;
          storybook_page_updated_at?: string | null;
          storybook_completed_at?: string | null;
          library_completed_at?: string | null;
          puzzle_millionaire_completed_at?: string | null;
          puzzle_kculture_completed_at?: string | null;
          puzzle_constellation_completed_at?: string | null;
          puzzle_millionaire_skipped_at?: string | null;
          puzzle_kculture_skipped_at?: string | null;
          puzzle_constellation_skipped_at?: string | null;
          puzzle_millionaire_best_score?: number;
          puzzle_kculture_best_score?: number;
          puzzle_millionaire_attempt_state?: Json | null;
          puzzle_millionaire_attempt_updated_at?: string | null;
          puzzle_kculture_attempt_state?: Json | null;
          puzzle_kculture_attempt_updated_at?: string | null;
          puzzle_room_completed_at?: string | null;
          last_location?: "world" | "storybook" | "library" | "puzzle_room";
          last_world_destination?: "storybook" | "library" | "puzzle-room" | "jessicas-radio" | "question-garden" | "gallery" | "our-journey" | "maybe-days" | "our-corner" | "open-when" | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          storybook_page?: number;
          storybook_page_updated_at?: string | null;
          storybook_completed_at?: string | null;
          library_completed_at?: string | null;
          puzzle_millionaire_completed_at?: string | null;
          puzzle_kculture_completed_at?: string | null;
          puzzle_constellation_completed_at?: string | null;
          puzzle_millionaire_skipped_at?: string | null;
          puzzle_kculture_skipped_at?: string | null;
          puzzle_constellation_skipped_at?: string | null;
          puzzle_millionaire_best_score?: number;
          puzzle_kculture_best_score?: number;
          puzzle_millionaire_attempt_state?: Json | null;
          puzzle_millionaire_attempt_updated_at?: string | null;
          puzzle_kculture_attempt_state?: Json | null;
          puzzle_kculture_attempt_updated_at?: string | null;
          puzzle_room_completed_at?: string | null;
          last_location?: "world" | "storybook" | "library" | "puzzle_room";
          last_world_destination?: "storybook" | "library" | "puzzle-room" | "jessicas-radio" | "question-garden" | "gallery" | "our-journey" | "maybe-days" | "our-corner" | "open-when" | null;
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
export type LibraryBook = Database["public"]["Tables"]["library_books"]["Row"];
export type UserJourneyProgress = Database["public"]["Tables"]["user_journey_progress"]["Row"];

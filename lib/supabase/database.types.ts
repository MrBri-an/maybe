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
      radio_tracks: {
        Row: {
          id: string;
          uploader_user_id: string;
          title: string;
          artist: string | null;
          personal_note: string | null;
          original_filename: string;
          storage_path: string;
          mime_type: string;
          file_extension: "mp3" | "m4a" | "aac" | "wav" | "ogg";
          size_bytes: number;
          duration_seconds: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          uploader_user_id: string;
          title: string;
          artist?: string | null;
          personal_note?: string | null;
          original_filename: string;
          storage_path: string;
          mime_type: string;
          file_extension: "mp3" | "m4a" | "aac" | "wav" | "ogg";
          size_bytes: number;
          duration_seconds?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          artist?: string | null;
          personal_note?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      question_garden_questions: {
        Row: {
          id: string;
          source_type: "curated" | "custom";
          category: "How We Began" | "Little Things" | "Dreams and the Future" | "You, Me and Us" | "Fun and Unexpected";
          prompt: string;
          response_type: "long_text" | "short_text" | "choice";
          options: Json | null;
          personal_note: string | null;
          planted_by_user_id: string | null;
          sort_order: number;
          active: boolean;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source_type: "curated" | "custom";
          category: "How We Began" | "Little Things" | "Dreams and the Future" | "You, Me and Us" | "Fun and Unexpected";
          prompt: string;
          response_type: "long_text" | "short_text" | "choice";
          options?: Json | null;
          personal_note?: string | null;
          planted_by_user_id?: string | null;
          sort_order: number;
          active?: boolean;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          category?: "How We Began" | "Little Things" | "Dreams and the Future" | "You, Me and Us" | "Fun and Unexpected";
          prompt?: string;
          response_type?: "long_text" | "short_text" | "choice";
          options?: Json | null;
          personal_note?: string | null;
          sort_order?: number;
          active?: boolean;
          archived_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      question_garden_answers: {
        Row: {
          id: string;
          question_id: string;
          user_id: string;
          status: "draft" | "submitted" | "skipped";
          answer_text: string | null;
          selected_option: string | null;
          submitted_at: string | null;
          revealed_at: string | null;
          follow_up_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          question_id: string;
          user_id: string;
          status?: "draft" | "submitted" | "skipped";
          answer_text?: string | null;
          selected_option?: string | null;
          submitted_at?: string | null;
          revealed_at?: string | null;
          follow_up_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "draft" | "submitted" | "skipped";
          answer_text?: string | null;
          selected_option?: string | null;
          submitted_at?: string | null;
          revealed_at?: string | null;
          follow_up_note?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      question_garden_reactions: {
        Row: {
          id: string;
          question_id: string;
          user_id: string;
          reaction: "heart" | "laugh" | "sparkle" | "emotional";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          question_id: string;
          user_id: string;
          reaction: "heart" | "laugh" | "sparkle" | "emotional";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          reaction?: "heart" | "laugh" | "sparkle" | "emotional";
          updated_at?: string;
        };
        Relationships: [];
      };
      question_garden_member_state: {
        Row: {
          user_id: string;
          last_question_id: string | null;
          last_category: "How We Began" | "Little Things" | "Dreams and the Future" | "You, Me and Us" | "Fun and Unexpected" | null;
          last_visited_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          last_question_id?: string | null;
          last_category?: "How We Began" | "Little Things" | "Dreams and the Future" | "You, Me and Us" | "Fun and Unexpected" | null;
          last_visited_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          last_question_id?: string | null;
          last_category?: "How We Began" | "Little Things" | "Dreams and the Future" | "You, Me and Us" | "Fun and Unexpected" | null;
          last_visited_at?: string;
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
          radio_completed_at: string | null;
          question_garden_completed_at: string | null;
          last_location: "world" | "storybook" | "library" | "puzzle_room" | "radio" | "question_garden";
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
          radio_completed_at?: string | null;
          question_garden_completed_at?: string | null;
          last_location?: "world" | "storybook" | "library" | "puzzle_room" | "radio" | "question_garden";
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
          radio_completed_at?: string | null;
          question_garden_completed_at?: string | null;
          last_location?: "world" | "storybook" | "library" | "puzzle_room" | "radio" | "question_garden";
          last_world_destination?: "storybook" | "library" | "puzzle-room" | "jessicas-radio" | "question-garden" | "gallery" | "our-journey" | "maybe-days" | "our-corner" | "open-when" | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      submit_question_garden_answer: {
        Args: {
          p_question_id: string;
          p_user_id: string;
          p_answer_text: string | null;
          p_selected_option: string | null;
        };
        Returns: {
          revealed: boolean;
          reveal_timestamp: string | null;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type AppMember = Database["public"]["Tables"]["app_members"]["Row"];
export type LibraryBook = Database["public"]["Tables"]["library_books"]["Row"];
export type RadioTrack = Database["public"]["Tables"]["radio_tracks"]["Row"];
export type QuestionGardenQuestion = Database["public"]["Tables"]["question_garden_questions"]["Row"];
export type QuestionGardenAnswer = Database["public"]["Tables"]["question_garden_answers"]["Row"];
export type UserJourneyProgress = Database["public"]["Tables"]["user_journey_progress"]["Row"];

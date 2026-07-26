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
      gallery_media: {
        Row: {
          id: string;
          uploader_user_id: string;
          storage_path: string;
          original_filename: string;
          media_kind: "image" | "video";
          mime_type: string;
          file_size_bytes: number;
          title: string | null;
          caption: string | null;
          width: number | null;
          height: number | null;
          duration_seconds: number | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          uploader_user_id: string;
          storage_path: string;
          original_filename: string;
          media_kind: "image" | "video";
          mime_type: string;
          file_size_bytes: number;
          title?: string | null;
          caption?: string | null;
          width?: number | null;
          height?: number | null;
          duration_seconds?: number | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          title?: string | null;
          caption?: string | null;
          archived_at?: string | null;
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
      her_universe_objects: {
        Row: { id: string; slug: string; object_type: "sun" | "moon" | "galaxy" | "planet" | "nebula" | "constellation" | "ocean_moon" | "north_star" | "star"; name: string; caption: string; visual_variant: string; sort_order: number; is_active: boolean; created_at: string };
        Insert: { id?: string; slug: string; object_type: "sun" | "moon" | "galaxy" | "planet" | "nebula" | "constellation" | "ocean_moon" | "north_star" | "star"; name: string; caption: string; visual_variant: string; sort_order: number; is_active?: boolean; created_at?: string };
        Update: { slug?: string; object_type?: "sun" | "moon" | "galaxy" | "planet" | "nebula" | "constellation" | "ocean_moon" | "north_star" | "star"; name?: string; caption?: string; visual_variant?: string; sort_order?: number; is_active?: boolean };
        Relationships: [];
      };
      her_universe_messages: {
        Row: { id: string; object_id: string; author_user_id: string; body: string; display_order: number; animation_variant: "drift" | "orbit" | "glow" | "rise"; created_at: string; updated_at: string; archived_at: string | null };
        Insert: { id?: string; object_id: string; author_user_id: string; body: string; display_order?: number; animation_variant?: "drift" | "orbit" | "glow" | "rise"; created_at?: string; updated_at?: string; archived_at?: string | null };
        Update: { body?: string; display_order?: number; animation_variant?: "drift" | "orbit" | "glow" | "rise"; archived_at?: string | null; updated_at?: string };
        Relationships: [];
      };
      her_universe_object_visits: {
        Row: { object_id: string; user_id: string; visit_count: number; first_visited_at: string; last_visited_at: string };
        Insert: { object_id: string; user_id: string; visit_count?: number; first_visited_at?: string; last_visited_at?: string };
        Update: { visit_count?: number; last_visited_at?: string };
        Relationships: [];
      };
      her_universe_message_reactions: {
        Row: { message_id: string; user_id: string; reaction: "star" | "heart" | "moon" | "spark"; created_at: string; updated_at: string };
        Insert: { message_id: string; user_id: string; reaction: "star" | "heart" | "moon" | "spark"; created_at?: string; updated_at?: string };
        Update: { reaction?: "star" | "heart" | "moon" | "spark"; updated_at?: string };
        Relationships: [];
      };
      her_universe_message_favourites: {
        Row: { message_id: string; user_id: string; created_at: string };
        Insert: { message_id: string; user_id: string; created_at?: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      her_universe_private_responses: {
        Row: { id: string; object_id: string; user_id: string; body: string; created_at: string; updated_at: string; archived_at: string | null };
        Insert: { id?: string; object_id: string; user_id: string; body: string; created_at?: string; updated_at?: string; archived_at?: string | null };
        Update: { body?: string; updated_at?: string; archived_at?: string | null };
        Relationships: [];
      };
      maybe_day_activities: {
        Row: { id: string; slug: string; title: string; prompt: string; category: "conversation" | "creative" | "games" | "music" | "photos" | "watch-together"; icon_key: string; estimated_minutes: number | null; requires_voice: boolean; requires_video: boolean; sort_order: number; is_active: boolean; created_at: string };
        Insert: { id?: string; slug: string; title: string; prompt: string; category: "conversation" | "creative" | "games" | "music" | "photos" | "watch-together"; icon_key: string; estimated_minutes?: number | null; requires_voice?: boolean; requires_video?: boolean; sort_order?: number; is_active?: boolean; created_at?: string };
        Update: { slug?: string; title?: string; prompt?: string; category?: "conversation" | "creative" | "games" | "music" | "photos" | "watch-together"; icon_key?: string; estimated_minutes?: number | null; requires_voice?: boolean; requires_video?: boolean; sort_order?: number; is_active?: boolean };
        Relationships: [];
      };
      maybe_day_draws: {
        Row: { id: string; activity_id: string; selected_by_user_id: string; status: "selected" | "started" | "completed" | "skipped"; selected_at: string; started_at: string | null; completed_at: string | null; skipped_at: string | null; skip_reason: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; activity_id: string; selected_by_user_id: string; status?: "selected" | "started" | "completed" | "skipped"; selected_at?: string; started_at?: string | null; completed_at?: string | null; skipped_at?: string | null; skip_reason?: string | null; created_at?: string; updated_at?: string };
        Update: { status?: "selected" | "started" | "completed" | "skipped"; started_at?: string | null; completed_at?: string | null; skipped_at?: string | null; skip_reason?: string | null; updated_at?: string };
        Relationships: [];
      };
      maybe_day_checkins: {
        Row: { draw_id: string; user_id: string; confirmed_at: string; created_at: string; updated_at: string };
        Insert: { draw_id: string; user_id: string; confirmed_at?: string; created_at?: string; updated_at?: string };
        Update: { confirmed_at?: string; updated_at?: string };
        Relationships: [];
      };
      maybe_day_comments: {
        Row: { id: string; draw_id: string; author_user_id: string; body: string; created_at: string; updated_at: string; archived_at: string | null };
        Insert: { id?: string; draw_id: string; author_user_id: string; body: string; created_at?: string; updated_at?: string; archived_at?: string | null };
        Update: { body?: string; updated_at?: string; archived_at?: string | null };
        Relationships: [];
      };
      maybe_day_hearts: {
        Row: { draw_id: string; user_id: string; created_at: string };
        Insert: { draw_id: string; user_id: string; created_at?: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      our_corner_conversations: {
        Row: { id: string; created_at: string; updated_at: string; is_active: boolean };
        Insert: { id?: string; created_at?: string; updated_at?: string; is_active?: boolean };
        Update: { updated_at?: string; is_active?: boolean };
        Relationships: [];
      };
      our_corner_members: {
        Row: { conversation_id: string; user_id: string; joined_at: string; last_read_at: string | null; last_seen_message_id: string | null };
        Insert: { conversation_id: string; user_id: string; joined_at?: string; last_read_at?: string | null; last_seen_message_id?: string | null };
        Update: { last_read_at?: string | null; last_seen_message_id?: string | null };
        Relationships: [];
      };
      our_corner_messages: {
        Row: { id: string; conversation_id: string; sender_user_id: string; client_message_id: string; message_kind: "text" | "voice" | "shared"; body: string | null; reply_to_message_id: string | null; shared_type: "song" | "question" | "activity" | "memory" | null; shared_reference: string | null; created_at: string; updated_at: string; edited_at: string | null; archived_at: string | null };
        Insert: { id?: string; conversation_id: string; sender_user_id: string; client_message_id: string; message_kind: "text" | "voice" | "shared"; body?: string | null; reply_to_message_id?: string | null; shared_type?: "song" | "question" | "activity" | "memory" | null; shared_reference?: string | null; created_at?: string; updated_at?: string; edited_at?: string | null; archived_at?: string | null };
        Update: { message_kind?: "text" | "voice" | "shared"; body?: string | null; reply_to_message_id?: string | null; shared_type?: "song" | "question" | "activity" | "memory" | null; shared_reference?: string | null; updated_at?: string; edited_at?: string | null; archived_at?: string | null };
        Relationships: [];
      };
      our_corner_message_hearts: {
        Row: { message_id: string; user_id: string; created_at: string };
        Insert: { message_id: string; user_id: string; created_at?: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      our_corner_read_receipts: {
        Row: { message_id: string; user_id: string; read_at: string };
        Insert: { message_id: string; user_id: string; read_at?: string };
        Update: { read_at?: string };
        Relationships: [];
      };
      our_corner_pinned_messages: {
        Row: { conversation_id: string; message_id: string; pinned_by_user_id: string; pinned_at: string };
        Insert: { conversation_id: string; message_id: string; pinned_by_user_id: string; pinned_at?: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      our_corner_daily_notes: {
        Row: { id: string; conversation_id: string; author_user_id: string; note_date: string; body: string; created_at: string; updated_at: string; archived_at: string | null };
        Insert: { id?: string; conversation_id: string; author_user_id: string; note_date?: string; body: string; created_at?: string; updated_at?: string; archived_at?: string | null };
        Update: { note_date?: string; body?: string; updated_at?: string; archived_at?: string | null };
        Relationships: [];
      };
      our_corner_temporary_moods: {
        Row: { conversation_id: string; user_id: string; mood: string; created_at: string; expires_at: string };
        Insert: { conversation_id: string; user_id: string; mood: string; created_at?: string; expires_at: string };
        Update: { mood?: string; expires_at?: string };
        Relationships: [];
      };
      our_corner_voice_notes: {
        Row: { message_id: string; storage_object_path: string; mime_type: "audio/webm" | "audio/mp4" | "audio/x-m4a" | "audio/m4a" | "audio/ogg"; size_bytes: number; duration_seconds: number; created_at: string };
        Insert: { message_id: string; storage_object_path: string; mime_type: "audio/webm" | "audio/mp4" | "audio/x-m4a" | "audio/m4a" | "audio/ogg"; size_bytes: number; duration_seconds: number; created_at?: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      final_world_letter: {
        Row: {
          id: string;
          author_user_id: string;
          recipient_user_id: string;
          title: string;
          body: string;
          status: "draft" | "sealed" | "opened" | "withdrawn";
          sealed_at: string | null;
          opened_at: string | null;
          withdrawn_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_user_id: string;
          recipient_user_id: string;
          title: string;
          body: string;
          status?: "draft" | "sealed" | "opened" | "withdrawn";
          sealed_at?: string | null;
          opened_at?: string | null;
          withdrawn_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          body?: string;
          status?: "draft" | "sealed" | "opened" | "withdrawn";
          sealed_at?: string | null;
          opened_at?: string | null;
          withdrawn_at?: string | null;
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
          gallery_completed_at: string | null;
          her_universe_completed_at: string | null;
          maybe_days_completed_at: string | null;
          our_corner_completed_at: string | null;
          final_world_completed_at: string | null;
          last_location: "world" | "storybook" | "library" | "puzzle_room" | "radio" | "question_garden" | "gallery" | "her-universe" | "maybe-days" | "our-corner" | "the-world-i-can-give-you";
          last_world_destination: "storybook" | "library" | "puzzle-room" | "jessicas-radio" | "question-garden" | "gallery" | "her-universe" | "maybe-days" | "our-corner" | "the-world-i-can-give-you" | null;
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
          gallery_completed_at?: string | null;
          her_universe_completed_at?: string | null;
          maybe_days_completed_at?: string | null;
          our_corner_completed_at?: string | null;
          final_world_completed_at?: string | null;
          last_location?: "world" | "storybook" | "library" | "puzzle_room" | "radio" | "question_garden" | "gallery" | "her-universe" | "maybe-days" | "our-corner" | "the-world-i-can-give-you";
          last_world_destination?: "storybook" | "library" | "puzzle-room" | "jessicas-radio" | "question-garden" | "gallery" | "her-universe" | "maybe-days" | "our-corner" | "the-world-i-can-give-you" | null;
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
          gallery_completed_at?: string | null;
          her_universe_completed_at?: string | null;
          maybe_days_completed_at?: string | null;
          our_corner_completed_at?: string | null;
          final_world_completed_at?: string | null;
          last_location?: "world" | "storybook" | "library" | "puzzle_room" | "radio" | "question_garden" | "gallery" | "her-universe" | "maybe-days" | "our-corner" | "the-world-i-can-give-you";
          last_world_destination?: "storybook" | "library" | "puzzle-room" | "jessicas-radio" | "question-garden" | "gallery" | "her-universe" | "maybe-days" | "our-corner" | "the-world-i-can-give-you" | null;
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
      select_maybe_day_activity: {
        Args: { p_selected_by_user_id: string };
        Returns: Database["public"]["Tables"]["maybe_day_draws"]["Row"];
      };
      complete_maybe_day_if_confirmed: {
        Args: { p_draw_id: string };
        Returns: Database["public"]["Tables"]["maybe_day_draws"]["Row"];
      };
      has_final_world_access: {
        Args: { p_user_id?: string };
        Returns: boolean;
      };
      save_final_world_letter_draft: {
        Args: { p_title: string; p_body: string };
        Returns: Database["public"]["Tables"]["final_world_letter"]["Row"];
      };
      seal_final_world_letter: {
        Args: { p_letter_id: string };
        Returns: Database["public"]["Tables"]["final_world_letter"]["Row"];
      };
      open_final_world_letter: {
        Args: { p_letter_id: string };
        Returns: Database["public"]["Tables"]["final_world_letter"]["Row"];
      };
      withdraw_final_world_letter: {
        Args: { p_letter_id: string };
        Returns: Database["public"]["Tables"]["final_world_letter"]["Row"];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type AppMember = Database["public"]["Tables"]["app_members"]["Row"];
export type LibraryBook = Database["public"]["Tables"]["library_books"]["Row"];
export type RadioTrack = Database["public"]["Tables"]["radio_tracks"]["Row"];
export type GalleryMedia = Database["public"]["Tables"]["gallery_media"]["Row"];
export type QuestionGardenQuestion = Database["public"]["Tables"]["question_garden_questions"]["Row"];
export type QuestionGardenAnswer = Database["public"]["Tables"]["question_garden_answers"]["Row"];
export type UserJourneyProgress = Database["public"]["Tables"]["user_journey_progress"]["Row"];
export type FinalWorldLetter = Database["public"]["Tables"]["final_world_letter"]["Row"];

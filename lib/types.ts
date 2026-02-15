export interface TranscriptSnippet {
  text: string;
  start: number;
  duration: number;
}

export interface TranscriptResponse {
  video_id: string;
  transcript: TranscriptSnippet[];
  success: boolean;
  message?: string;
}

export interface TextResponse {
  video_id: string;
  text: string;
  success: boolean;
  message?: string;
}

export interface LanguageInfo {
  language_code: string;
  language: string;
  is_generated: boolean;
  is_translatable: boolean;
}

export interface LanguagesResponse {
  video_id: string;
  available_languages: LanguageInfo[];
  success: boolean;
}

export interface SummaryResponse {
  video_id: string;
  summary: string;
  word_count: number;
  requested_length: number;
  success: boolean;
  message?: string;
}

export interface ErrorResponse {
  detail: string;
}

export type SummaryStatus = "pending" | "processing" | "completed" | "failed";

export interface VideoSummaryRecord {
  id: string;
  user_email: string;
  video_id: string;
  video_title: string | null;
  video_thumbnail_url: string | null;
  summary: string | null;
  status: SummaryStatus;
  error_message: string | null;
  language: string;
  requested_length: number;
  word_count: number | null;
  audio_url: string | null;
  created_at: string;
  updated_at: string;
}

import { sql } from "@vercel/postgres";
import type { VideoSummaryRecord } from "./types";

export async function createOrUpdateSummary(
  userEmail: string,
  videoId: string,
  language: string,
  requestedLength: number
): Promise<VideoSummaryRecord> {
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

  const { rows } = await sql<VideoSummaryRecord>`
    INSERT INTO video_summaries (user_email, video_id, video_thumbnail_url, language, requested_length, status)
    VALUES (${userEmail}, ${videoId}, ${thumbnailUrl}, ${language}, ${requestedLength}, 'pending')
    ON CONFLICT (user_email, video_id)
    DO UPDATE SET
      language = ${language},
      requested_length = ${requestedLength},
      status = 'pending',
      summary = NULL,
      error_message = NULL,
      word_count = NULL,
      audio_url = NULL,
      updated_at = now()
    RETURNING *
  `;

  return rows[0];
}

export async function getSummaryById(
  id: string,
  userEmail: string
): Promise<VideoSummaryRecord | null> {
  const { rows } = await sql<VideoSummaryRecord>`
    SELECT * FROM video_summaries WHERE id = ${id} AND user_email = ${userEmail}
  `;
  return rows[0] ?? null;
}

export async function getUserSummaries(
  userEmail: string
): Promise<VideoSummaryRecord[]> {
  const { rows } = await sql<VideoSummaryRecord>`
    SELECT * FROM video_summaries
    WHERE user_email = ${userEmail}
    ORDER BY created_at DESC
  `;
  return rows;
}

export async function checkRateLimit(userEmail: string): Promise<boolean> {
  const { rows } = await sql<{ count: string }>`
    SELECT COUNT(*) as count FROM video_summaries
    WHERE user_email = ${userEmail}
      AND created_at > now() - INTERVAL '24 hours'
  `;
  return parseInt(rows[0].count, 10) >= 5;
}

export async function updateSummaryStatus(
  id: string,
  fields: {
    status?: string;
    summary?: string;
    error_message?: string;
    word_count?: number;
    video_title?: string;
    audio_url?: string;
    language?: string;
  }
): Promise<void> {
  const { status, summary, error_message, word_count, video_title, audio_url, language } = fields;

  await sql`
    UPDATE video_summaries SET
      status = COALESCE(${status ?? null}, status),
      summary = COALESCE(${summary ?? null}, summary),
      error_message = COALESCE(${error_message ?? null}, error_message),
      word_count = COALESCE(${word_count ?? null}, word_count),
      video_title = COALESCE(${video_title ?? null}, video_title),
      audio_url = COALESCE(${audio_url ?? null}, audio_url),
      language = COALESCE(${language ?? null}, language)
    WHERE id = ${id}
  `;
}

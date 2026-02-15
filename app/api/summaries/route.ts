import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { waitUntil } from "@vercel/functions";
import {
  createOrUpdateSummary,
  getUserSummaries,
  checkRateLimit,
  updateSummaryStatus,
} from "@/lib/db";
import { extractVideoId, fetchTranscript, transcriptToText, fetchVideoTitle } from "@/lib/youtube";
import { generateSummary, generateSpeech } from "@/lib/openai";
import { uploadAudio } from "@/lib/storage";

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { url, language = "en", length = 300 } = body;

  if (!url) {
    return NextResponse.json({ detail: "URL is required" }, { status: 400 });
  }

  const videoId = extractVideoId(url);

  const rateLimited = await checkRateLimit(email);
  if (rateLimited) {
    return NextResponse.json(
      { detail: "Rate limit reached: 5 videos per day" },
      { status: 429 }
    );
  }

  const record = await createOrUpdateSummary(email, videoId, language, length);

  const processInBackground = async () => {
    try {
      console.log(`[summary:${record.id}] Starting processing for video ${videoId}, lang=${language}, length=${length}`);
      await updateSummaryStatus(record.id, { status: "processing" });

      // Fetch video title (non-critical)
      const videoTitle = await fetchVideoTitle(videoId);
      if (videoTitle) {
        console.log(`[summary:${record.id}] Video title: ${videoTitle}`);
        await updateSummaryStatus(record.id, { video_title: videoTitle });
      }

      console.log(`[summary:${record.id}] Fetching transcript...`);
      const transcript = await fetchTranscript(videoId, language);
      console.log(`[summary:${record.id}] Transcript fetched: ${transcript.length} segments`);

      const text = transcriptToText(transcript);
      console.log(`[summary:${record.id}] Transcript text length: ${text.length} chars, generating summary...`);

      const summary = await generateSummary(text, length);
      const wordCount = summary.split(/\s+/).length;
      console.log(`[summary:${record.id}] Summary generated: ${wordCount} words`);

      await updateSummaryStatus(record.id, {
        status: "completed",
        summary,
        word_count: wordCount,
      });
      console.log(`[summary:${record.id}] Completed successfully`);

      // Generate TTS audio (non-critical — summary is already saved)
      try {
        console.log(`[summary:${record.id}] Generating TTS audio...`);
        const audioBuffer = await generateSpeech(summary);
        console.log(`[summary:${record.id}] TTS audio generated: ${audioBuffer.length} bytes`);

        const audioUrl = await uploadAudio(audioBuffer, videoId);
        console.log(`[summary:${record.id}] Audio uploaded: ${audioUrl}`);

        await updateSummaryStatus(record.id, { audio_url: audioUrl });
      } catch (ttsErr) {
        console.error(`[summary:${record.id}] TTS generation failed (non-critical):`, ttsErr);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "detail" in err
            ? String((err as { detail: unknown }).detail)
            : "Unknown error";
      console.error(`[summary:${record.id}] Failed: ${message}`);
      await updateSummaryStatus(record.id, {
        status: "failed",
        error_message: message,
      });
    }
  };

  try {
    waitUntil(processInBackground());
  } catch {
    // Local dev fallback: waitUntil may not be available
    processInBackground();
  }

  return NextResponse.json(record);
}

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const summaries = await getUserSummaries(email);
  return NextResponse.json(summaries);
}

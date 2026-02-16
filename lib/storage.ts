import { put, del } from "@vercel/blob";

export async function uploadAudio(
  buffer: Buffer,
  videoId: string,
  oldAudioUrl?: string | null
): Promise<string> {
  const blob = await put(`audio/${videoId}-${Date.now()}.mp3`, buffer, {
    access: "public",
    contentType: "audio/mpeg",
  });

  // Clean up the previous audio blob if it exists
  if (oldAudioUrl) {
    try {
      await del(oldAudioUrl);
    } catch {
      // ignore deletion errors
    }
  }

  return blob.url;
}

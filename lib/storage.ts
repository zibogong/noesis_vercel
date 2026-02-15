import { put } from "@vercel/blob";

export async function uploadAudio(
  buffer: Buffer,
  videoId: string
): Promise<string> {
  const blob = await put(`audio/${videoId}.mp3`, buffer, {
    access: "public",
    contentType: "audio/mpeg",
  });
  return blob.url;
}

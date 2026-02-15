import OpenAI from "openai";

const OPENAI_MODEL = "gpt-4o-mini";
const MAX_TOKENS_ESTIMATE = 80000;

function estimateTokens(text: string): number {
  return Math.floor(text.length / 4);
}

export async function generateSummary(
  transcriptText: string,
  maxWords: number
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw { status: 500, detail: "OpenAI API key not configured. Please set OPENAI_API_KEY in .env.local file." };
  }

  const estimatedTokens = estimateTokens(transcriptText);
  if (estimatedTokens > MAX_TOKENS_ESTIMATE) {
    throw {
      status: 413,
      detail: `Transcript too long for summarization (${estimatedTokens} tokens estimated). Maximum is ${MAX_TOKENS_ESTIMATE} tokens. Try a shorter video.`,
    };
  }

  const prompt = `
    Summarize the following transcript as a natural spoken audio script.

    Requirements:
    1. Write in a conversational, spoken tone — as if you are talking to one person.
    2. Do NOT use any markdown formatting: no headings, no bold, no bullet points, no numbered lists, no asterisks.
    3. Use plain text only. Separate ideas with short paragraphs.
    4. Start with a strong hook that highlights the core problem or insight.
    5. Use conversational transitions like "Here is the key insight", "So what does this mean?", "Think about it this way".
    6. Convert abstract ideas into concrete, actionable steps using natural sentences.
    7. Keep sentences short and punchy. Use punctuation to create natural pauses.
    8. End with a practical reflection question for the listener.
    9. Do not include URLs, parenthetical asides, or any visual-only formatting.
    10. Length: approximately ${maxWords} words.

    Transcript:
    ${transcriptText}`;

  const client = new OpenAI({ apiKey });

  try {
    const response = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that creates concise, conversational summaries of video transcripts optimized for text-to-speech playback. Write in plain text only, no markdown.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: maxWords * 2,
    });

    const summary = response.choices[0]?.message?.content?.trim();
    if (!summary) {
      throw { status: 500, detail: "OpenAI returned an empty response" };
    }
    return summary;
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err && "detail" in err) {
      throw err;
    }
    if (err instanceof OpenAI.APIError) {
      if (err.status === 401) throw { status: 401, detail: "Invalid OpenAI API key" };
      if (err.status === 429) throw { status: 429, detail: "OpenAI API rate limit exceeded" };
      if (err.status && err.status >= 500) throw { status: 503, detail: "OpenAI API service unavailable" };
      throw { status: 500, detail: `OpenAI API error: ${err.message}` };
    }
    throw { status: 500, detail: `Error generating summary: ${String(err)}` };
  }
}

export async function generateSpeech(text: string): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key not configured");
  }

  const client = new OpenAI({ apiKey });
  const response = await client.audio.speech.create({
    model: "tts-1",
    voice: "alloy",
    input: text,
  });

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

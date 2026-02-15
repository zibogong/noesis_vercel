"use client";

import { useState, useRef, useCallback, FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { VideoSummaryRecord } from "@/lib/types";
import { extractVideoId } from "@/lib/youtube";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "zh", label: "Chinese" },
  { code: "es", label: "Spanish" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
  { code: "ar", label: "Arabic" },
];

const LENGTHS = [
  { value: 100, label: "Short (~100 words)" },
  { value: 300, label: "Medium (~300 words)" },
  { value: 500, label: "Long (~500 words)" },
  { value: 800, label: "Detailed (~800 words)" },
];

const selectStyle = {
  padding: "0.6rem 0.8rem",
  border: "1px solid #ccc",
  borderRadius: 4,
  fontSize: "0.9rem",
  background: "white",
};

type Status = "idle" | "pending" | "processing" | "completed" | "failed";

const MAX_AUDIO_POLLS = 60; // 60 * 2s = 2 min timeout

export default function TranscriptViewer() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState("en");
  const [length, setLength] = useState(300);
  const [summary, setSummary] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [waitingForAudio, setWaitingForAudio] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioPollCountRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    audioPollCountRef.current = 0;
  }, []);

  const pollStatus = useCallback(
    (id: string) => {
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/summaries/${id}`);
          if (!res.ok) return;
          const data: VideoSummaryRecord = await res.json();

          setStatus(data.status);

          if (data.video_title) {
            setVideoTitle(data.video_title);
          }

          if (data.status === "completed") {
            setSummary(data.summary ?? "");
            setWordCount(data.word_count ?? 0);

            if (data.audio_url) {
              setAudioUrl(data.audio_url);
              setWaitingForAudio(false);
              stopPolling();
              router.refresh();
            } else {
              // Summary done but audio still generating — keep polling
              setWaitingForAudio(true);
              audioPollCountRef.current += 1;
              if (audioPollCountRef.current >= MAX_AUDIO_POLLS) {
                // Timeout — stop waiting for audio
                setWaitingForAudio(false);
                stopPolling();
                router.refresh();
              }
            }
          } else if (data.status === "failed") {
            stopPolling();
            setError(data.error_message ?? "Summary generation failed");
          }
        } catch {
          // ignore transient poll errors
        }
      }, 2000);
    },
    [stopPolling, router]
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    stopPolling();
    setStatus("pending");
    setError("");
    setSummary("");
    setWordCount(0);
    setAudioUrl(null);
    setWaitingForAudio(false);
    setVideoTitle(null);

    // Extract video ID for thumbnail
    const vid = extractVideoId(url.trim());
    setVideoId(vid);

    try {
      const res = await fetch("/api/summaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), language, length }),
      });
      const data = await res.json();

      if (res.status === 429) {
        setStatus("idle");
        setError("Rate limit reached: 5 videos per day");
        return;
      }

      if (!res.ok) {
        setStatus("idle");
        setError(data.detail || "Failed to create summary request");
        return;
      }

      setStatus(data.status);
      pollStatus(data.id);
    } catch {
      setStatus("idle");
      setError("Network error. Please try again.");
    }
  }

  const loading = status === "pending" || status === "processing" || waitingForAudio;
  const statusLabel =
    status === "pending"
      ? "Pending..."
      : status === "processing"
        ? "Processing..."
        : waitingForAudio
          ? "Generating audio..."
          : "Summarize";

  const showThumbnail = status !== "idle" && videoId;

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste YouTube URL or video ID..."
            style={{
              flex: 1,
              padding: "0.6rem 0.8rem",
              border: "1px solid #ccc",
              borderRadius: 4,
              fontSize: "1rem",
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "0.6rem 1.2rem",
              background: loading ? "#999" : "#0070f3",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "1rem",
              whiteSpace: "nowrap",
            }}
          >
            {statusLabel}
          </button>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.9rem", color: "#555" }}>
            Language
            <select value={language} onChange={(e) => setLanguage(e.target.value)} style={selectStyle}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.9rem", color: "#555" }}>
            Length
            <select value={length} onChange={(e) => setLength(Number(e.target.value))} style={selectStyle}>
              {LENGTHS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </label>
        </div>
      </form>

      {error && (
        <div style={{ padding: "1rem", background: "#fee", border: "1px solid #fcc", borderRadius: 4, color: "#c00", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {(showThumbnail || summary) && (
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            background: "white",
            overflow: "hidden",
          }}
        >
          {showThumbnail && (
            <div style={{ display: "flex", gap: "1rem", padding: "1rem 1.5rem", alignItems: "center", borderBottom: summary ? "1px solid #eee" : "none" }}>
              <img
                src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                alt={videoTitle || "Video thumbnail"}
                style={{ borderRadius: 6, width: 160, height: 90, objectFit: "cover", flexShrink: 0 }}
              />
              <div style={{ minWidth: 0 }}>
                {videoTitle && (
                  <div style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.4 }}>
                    {videoTitle}
                  </div>
                )}
                {!summary && (
                  <div style={{ marginTop: "0.4rem", fontSize: "0.85rem", color: "#888" }}>
                    {status === "pending" ? "Waiting to process..." : status === "processing" ? "Generating summary..." : ""}
                  </div>
                )}
              </div>
            </div>
          )}

          {summary && (
            <div style={{ padding: "1.5rem", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
              {summary}
              <div style={{ marginTop: "1rem", fontSize: "0.85rem", color: "#666" }}>
                {wordCount} words
              </div>

              {waitingForAudio && (
                <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "#888" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 14,
                      height: 14,
                      border: "2px solid #ddd",
                      borderTopColor: "#0070f3",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  Generating audio...
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {audioUrl && (
                <div style={{ marginTop: "1rem" }}>
                  <audio controls src={audioUrl} style={{ width: "100%" }}>
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

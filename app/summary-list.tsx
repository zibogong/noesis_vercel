"use client";

import { useState } from "react";
import type { VideoSummaryRecord } from "@/lib/types";

const statusColors: Record<string, { bg: string; color: string }> = {
  pending: { bg: "#fff3cd", color: "#856404" },
  processing: { bg: "#cce5ff", color: "#004085" },
  completed: { bg: "#d4edda", color: "#155724" },
  failed: { bg: "#f8d7da", color: "#721c24" },
};

export default function SummaryList({
  summaries,
}: {
  summaries: VideoSummaryRecord[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (summaries.length === 0) return null;

  return (
    <div style={{ marginTop: "2rem" }}>
      <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>
        Past Summaries
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {summaries.map((s) => {
          const colors = statusColors[s.status] ?? statusColors.pending;
          const isExpanded = expandedId === s.id;

          return (
            <div
              key={s.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 4,
                background: "white",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  padding: "0.75rem",
                  cursor: s.summary ? "pointer" : "default",
                }}
                onClick={() =>
                  s.summary &&
                  setExpandedId(isExpanded ? null : s.id)
                }
              >
                {s.video_thumbnail_url && (
                  <img
                    src={s.video_thumbnail_url}
                    alt={s.video_id}
                    style={{
                      width: 120,
                      height: 68,
                      objectFit: "cover",
                      borderRadius: 4,
                      flexShrink: 0,
                    }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "0.25rem",
                    }}
                  >
                    <span
                      style={{ fontWeight: 600, fontSize: "0.95rem" }}
                    >
                      {s.video_title || s.video_id}
                    </span>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        padding: "0.1rem 0.4rem",
                        borderRadius: 3,
                        background: colors.bg,
                        color: colors.color,
                        fontWeight: 500,
                      }}
                    >
                      {s.status}
                    </span>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "#999",
                        textTransform: "uppercase",
                      }}
                    >
                      {s.language}
                    </span>
                  </div>
                  {s.video_title && (
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#888",
                        marginBottom: "0.25rem",
                      }}
                    >
                      {s.video_id}
                    </div>
                  )}
                  {s.summary && !isExpanded && (
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.85rem",
                        color: "#666",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.summary}
                    </p>
                  )}
                  {s.error_message && (
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.85rem",
                        color: "#c00",
                      }}
                    >
                      {s.error_message}
                    </p>
                  )}
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "#aaa",
                    }}
                  >
                    {new Date(s.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
              {isExpanded && s.summary && (
                <div
                  style={{
                    padding: "0 0.75rem 0.75rem",
                    fontSize: "0.9rem",
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                    borderTop: "1px solid #eee",
                    paddingTop: "0.75rem",
                  }}
                >
                  {s.summary}
                  {s.audio_url ? (
                    <div style={{ marginTop: "0.75rem" }}>
                      <audio
                        controls
                        src={s.audio_url}
                        style={{ width: "100%" }}
                      />
                    </div>
                  ) : s.status === "completed" && (
                    <div
                      style={{
                        marginTop: "0.5rem",
                        fontSize: "0.8rem",
                        color: "#999",
                        fontStyle: "italic",
                      }}
                    >
                      Generating audio...
                    </div>
                  )}
                  {s.word_count && (
                    <div
                      style={{
                        marginTop: "0.5rem",
                        fontSize: "0.8rem",
                        color: "#999",
                      }}
                    >
                      {s.word_count} words
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

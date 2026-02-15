import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Noesis - YouTube Video Summarizer",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: "1rem", backgroundColor: "#fafafa" }}>
        <style>{`@media (min-width: 640px) { body { padding: 2rem !important; } }`}</style>
        {children}
      </body>
    </html>
  );
}

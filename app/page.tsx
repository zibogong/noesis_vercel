import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { getUserSummaries } from "@/lib/db";
import TranscriptViewer from "./transcript-viewer";
import SummaryList from "./summary-list";

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  const summaries = await getUserSummaries(session.user.email!);

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "0" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Noesis</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span>{session.user.name}</span>
          <form
            action={async () => {
              "use server";
              await signOut();
            }}
          >
            <button
              type="submit"
              style={{
                padding: "0.4rem 0.8rem",
                border: "1px solid #ccc",
                borderRadius: 4,
                background: "white",
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <TranscriptViewer />
      <SummaryList summaries={summaries} />
    </main>
  );
}

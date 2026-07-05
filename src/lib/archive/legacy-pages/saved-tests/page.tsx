import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SavedTestCard } from "@/components/saved-test-card";
import { savedTests } from "@/lib/mock-data";

export default function SavedTestsPage() {
  return (
    <AppShell currentPath="/saved-tests">
      <PageHeader
        eyebrow="Library"
        title="Saved and reusable test sessions"
        description="Use this view for prior attempts, draft extractions, and completed evaluated tests. Replace mock cards with data from saved test/session endpoints."
      />
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {savedTests.map((test) => (
          <SavedTestCard key={test.id} test={test} />
        ))}
      </div>
    </AppShell>
  );
}

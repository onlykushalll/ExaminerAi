import { AppShell } from "@/components/app-shell";
import { DetailedReviewTable } from "@/components/detailed-review-table";
import { PageHeader } from "@/components/page-header";

export default function DetailedReviewPage() {
  return (
    <AppShell currentPath="/results">
      <PageHeader
        eyebrow="Step 7"
        title="Detailed answer review"
        description="Inspect expected answers, student answers, marks awarded, grading reasons, confidence labels, and review recommendations."
      />
      <DetailedReviewTable />
    </AppShell>
  );
}

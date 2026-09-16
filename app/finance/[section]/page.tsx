import { notFound } from "next/navigation";
import { InternalWorkspaceScreen } from "@/components/internal-workspace-screen";
import { requireWorkspaceIdentity } from "@/lib/office/guard";
import { financeSections, type FinanceSection } from "@/lib/office/workspaces";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { params: Promise<{ section: string }> };

export default async function FinanceSectionPage({ params }: Props) {
  const { section } = await params;
  if (!(section in financeSections)) notFound();
  const path = `/finance/${section}`;
  const identity = await requireWorkspaceIdentity("finance", path);
  return <InternalWorkspaceScreen workspace="finance" section={section as FinanceSection} identity={identity} />;
}

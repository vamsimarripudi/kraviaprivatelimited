import { notFound } from "next/navigation";
import { InternalWorkspaceScreen } from "@/components/internal-workspace-screen";
import { financeSections, type FinanceSection } from "@/lib/office/workspaces";

type Props = { params: Promise<{ section: string }> };

export default async function FinanceSectionPage({ params }: Props) {
  const { section } = await params;
  if (!(section in financeSections)) notFound();
  return <InternalWorkspaceScreen workspace="finance" section={section as FinanceSection} />;
}

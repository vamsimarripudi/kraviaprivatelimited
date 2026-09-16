import { notFound } from "next/navigation";
import { InternalWorkspaceScreen } from "@/components/internal-workspace-screen";
import { requireWorkspaceIdentity } from "@/lib/office/guard";
import { officeSections, type OfficeSection } from "@/lib/office/workspaces";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { params: Promise<{ section: string }> };

export default async function OfficeSectionPage({ params }: Props) {
  const { section } = await params;
  if (!(section in officeSections)) notFound();
  const path = `/office/${section}`;
  const identity = await requireWorkspaceIdentity("office", path);
  return <InternalWorkspaceScreen workspace="office" section={section as OfficeSection} identity={identity} />;
}

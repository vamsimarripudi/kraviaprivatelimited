import { notFound } from "next/navigation";
import { InternalWorkspaceScreen } from "@/components/internal-workspace-screen";
import { officeSections, type OfficeSection } from "@/lib/office/workspaces";

type Props = { params: Promise<{ section: string }> };

export default async function OfficeSectionPage({ params }: Props) {
  const { section } = await params;
  if (!(section in officeSections)) notFound();
  return <InternalWorkspaceScreen workspace="office" section={section as OfficeSection} />;
}

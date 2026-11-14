import { OfficeRolePortfolio } from "@/components/office-role-portfolio";

export const dynamic = "force-dynamic";

export default async function OfficeRoleSeatPage({
  params,
}: {
  params: Promise<{ seatId: string }>;
}) {
  const { seatId } = await params;
  return <OfficeRolePortfolio focusSeatId={seatId} />;
}

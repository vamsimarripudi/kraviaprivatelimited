import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function CorporateLogin() {
  redirect("/office/login");
}

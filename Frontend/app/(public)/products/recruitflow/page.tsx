import { permanentRedirect } from "next/navigation";

export default function LegacyRecruitFlowRoute() {
  permanentRedirect("/products/nicerole");
}

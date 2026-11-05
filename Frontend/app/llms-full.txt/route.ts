import { companyFaqMarkdown, companyFaqPath, discoveryTextResponse } from "@/lib/public-discovery";

export function GET() {
  return discoveryTextResponse(companyFaqMarkdown(), companyFaqPath);
}

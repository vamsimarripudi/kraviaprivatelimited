import { discoveryTextResponse, llmsIndex } from "@/lib/public-discovery";

export function GET() {
  return discoveryTextResponse(llmsIndex(), "/llms.txt");
}

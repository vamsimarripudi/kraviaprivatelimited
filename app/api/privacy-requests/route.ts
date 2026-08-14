import { POST as submitEnquiry } from "@/app/api/enquiries/route";
export async function POST(request: Request) { return submitEnquiry(request); }

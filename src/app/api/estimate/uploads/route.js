import { handleDirectUpload } from "@/lib/directUploadRoutes";

export const runtime = "nodejs";
export async function POST(request) { return handleDirectUpload(request, "estimate", "begin"); }

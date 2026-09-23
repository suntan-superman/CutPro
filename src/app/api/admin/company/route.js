import { authorizeAdminRequest } from "@/lib/adminAuthorization";
import { createServiceClient } from "@/lib/supabase/server";
import { companyContentHandlers } from "@/lib/companyContentRoutes";

const handlers = companyContentHandlers({
  authorize: authorizeAdminRequest,
  createClient: () => createServiceClient({ timeoutMs: 8000 }),
});
export const GET = handlers.GET;
export const PUT = handlers.PUT;

import { requireAdmin } from "@/lib/adminAuthorization";
import CompanyContentEditor from "@/components/admin/CompanyContentEditor";

export const metadata = { title: "Company / About" };

export default async function AdminCompanyPage() {
  await requireAdmin();
  return <><header className="admin-page-header"><div><p>Website content</p><h1>Company / About</h1><span>Keep your company story and experience up to date.</span></div></header><CompanyContentEditor /></>;
}

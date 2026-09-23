import { getBusinessSettings } from "@/lib/data";
import SettingsForm from "@/components/admin/SettingsForm";
import AdminUsersManager from "@/components/admin/AdminUsersManager";

export default async function AdminSettingsPage() { const settings = await getBusinessSettings(); return <><header className="admin-page-header"><div><p>Website operations</p><h1>Business settings</h1><span>Update a few safe day-to-day details without changing technical configuration.</span></div></header><SettingsForm settings={settings} /><AdminUsersManager /></>; }

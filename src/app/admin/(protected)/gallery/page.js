import { getAdminGallery } from "@/lib/data";
import GalleryManager from "@/components/admin/GalleryManager";

export default async function AdminGalleryPage() { const items = await getAdminGallery(); return <><header className="admin-page-header"><div><p>Website media</p><h1>Gallery</h1><span>Add authentic project photos, control publication, and build before-and-after pairs.</span></div></header><GalleryManager initialItems={items} /></>; }


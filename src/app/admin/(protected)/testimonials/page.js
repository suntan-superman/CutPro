import { getAdminTestimonials } from "@/lib/data";
import TestimonialsManager from "@/components/admin/TestimonialsManager";

export default async function AdminTestimonialsPage() { const items = await getAdminTestimonials(); return <><header className="admin-page-header"><div><p>Customer feedback</p><h1>Testimonials</h1><span>Manage only genuine, permissioned feedback and its original source.</span></div></header><TestimonialsManager initialItems={items} /></>; }


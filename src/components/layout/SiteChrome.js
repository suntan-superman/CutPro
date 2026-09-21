"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import MobileActionBar from "@/components/layout/MobileActionBar";

export default function SiteChrome({ children }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return children;
  return <><Header /><main id="main-content">{children}</main><Footer /><MobileActionBar /></>;
}


import type { Metadata, Viewport } from "next";
import Shell from "@/components/Shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tour Steliant · Transporte terrestre premium en RD",
  description: "Tour Steliant: autobuses premium entre 40+ ciudades de República Dominicana. Elige tu asiento, sigue tu viaje en vivo, envía paquetes y pide a tu asiento.",
  openGraph: { title: "Tour Steliant", description: "Recorre la isla con otra clase.", type: "website" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#071419" };

const themeInit = `try{var t=localStorage.getItem("ts-theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://images.unsplash.com" />
        <link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@500;700;800;900&family=Instrument+Sans:ital,wght@0,400..700;1,400..600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <link rel="icon" href={`${process.env.NEXT_PUBLIC_BASE ?? ""}/steliant-logo.png`} />
      </head>
      <body suppressHydrationWarning><Shell>{children}</Shell></body>
    </html>
  );
}

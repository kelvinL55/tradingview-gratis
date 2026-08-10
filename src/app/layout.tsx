import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trading_KL — Plataforma de Trading y Análisis en Tiempo Real",
  description:
    "Plataforma profesional de análisis técnico y gráficos crypto en tiempo real. Powered by Trading_KL.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "Trading_KL",
    description: "Plataforma profesional de análisis técnico y gráficos crypto en tiempo real.",
    siteName: "Trading_KL",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`dark ${inter.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden bg-tv-bg text-tv-text">
        <TooltipProvider delay={150}>{children}</TooltipProvider>
      </body>
    </html>
  );
}

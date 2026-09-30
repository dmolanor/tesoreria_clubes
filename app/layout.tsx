import type { Metadata } from "next"
import { IBM_Plex_Sans } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const plex = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: "Raza Ultimate · Tesorería",
  description: "Cobros, comprobantes y conciliación del club",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${plex.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-[14px]">
        {children}
        <Toaster position="top-center" richColors={false} />
      </body>
    </html>
  )
}

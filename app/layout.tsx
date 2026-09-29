import type { Metadata } from "next"
import { IBM_Plex_Sans } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import { TopBar } from "@/components/shell/top-bar"
import { getSession } from "@/lib/auth/session"
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await getSession()
  return (
    <html lang="es" className={`${plex.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-[14px]">
        <TopBar session={session} />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
        <Toaster position="top-center" richColors={false} />
      </body>
    </html>
  )
}

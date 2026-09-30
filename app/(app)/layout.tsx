import { TopBar } from "@/components/shell/top-bar"
import { getSession } from "@/lib/auth/session"

// Todo lo que está dentro de (app) requiere sesión y membresía (getSession redirige si no).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  return (
    <>
      <TopBar session={session} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </>
  )
}

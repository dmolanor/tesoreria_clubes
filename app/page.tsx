import { redirect } from "next/navigation"
import { getSession, ROL_HOME } from "@/lib/auth/session"

export default async function Home() {
  const s = await getSession()
  redirect(ROL_HOME[s.rolActivo])
}

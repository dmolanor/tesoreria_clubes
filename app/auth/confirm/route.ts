import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Enlace del correo (plantilla con token_hash): funciona aunque se abra en otro dispositivo o navegador.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const code = searchParams.get("code")
  const destino = request.nextUrl.clone()
  destino.search = ""
  destino.pathname = "/"

  const supabase = await createClient()
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) return NextResponse.redirect(destino)
  } else if (code) {
    // Plantilla por defecto (PKCE): solo funciona en el mismo navegador donde se pidió el enlace.
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(destino)
  }
  destino.pathname = "/login"
  destino.searchParams.set("error", "enlace")
  return NextResponse.redirect(destino)
}

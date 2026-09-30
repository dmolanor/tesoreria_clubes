import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const PUBLICAS = ["/login", "/auth", "/sin-acceso"]

/**
 * Refresca el token de Supabase en cada request (los Server Components no pueden escribir cookies)
 * y manda a /login a quien no tenga sesión. La autorización real la hacen RLS y `requireRole`.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  // No poner código entre createServerClient y getClaims (recomendación de Supabase).
  const { data } = await supabase.auth.getClaims()
  const publica = PUBLICAS.some((p) => request.nextUrl.pathname.startsWith(p))
  if (!data?.claims && !publica) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = ""
    return NextResponse.redirect(url)
  }
  return response
}

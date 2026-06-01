import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { pathname } = request.nextUrl

  // Эти страницы всегда доступны без проверки сессии
  const publicPaths = ['/auth', '/auth/update-password', '/auth/confirmed']
  if (publicPaths.some(p => pathname.startsWith(p))) {
    return supabaseResponse
  }

  // Статические ресурсы — пропускаем
  if (pathname.startsWith('/_next') || pathname.includes('.')) {
    return supabaseResponse
  }

  try {
    const { data: { user } } = await supabase.auth.getUser()

    const protectedPaths = ['/passenger', '/driver', '/market', '/profile', '/chats']
    const isProtected    = protectedPaths.some(p => pathname.startsWith(p))

    if (!user && isProtected) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth'
      return NextResponse.redirect(url)
    }
  } catch {
    // При ошибке Supabase — просто пропускаем, клиент разберётся
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}

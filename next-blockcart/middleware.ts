import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveRoleAndWebUser } from "@/lib/roles";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log(
    "Middleware - pathname:",
    request.nextUrl.pathname,
    "user:",
    user?.email
  );

  // Redirect to login if not authenticated
  if (!user && !request.nextUrl.pathname.startsWith("/login")) {
    console.log("No user found, redirecting to login");
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    const { isWebUser } = resolveRoleAndWebUser(user);

    if (!isWebUser) {
      console.log(
        "Authenticated user is not a web user, redirecting to login"
      );
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("access_denied", "true");
      return NextResponse.redirect(url);
    }

    console.log("Authenticated web user detected, access granted");
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

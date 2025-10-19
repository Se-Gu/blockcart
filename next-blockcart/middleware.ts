import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  // If user is authenticated, check if they exist in web_users table
  if (user) {
    const { data: webUser, error } = await supabase
      .from("web_users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error checking web_users table:", error);
      // On error, redirect to login for safety
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    if (!webUser) {
      console.log("User not found in web_users table, redirecting to login");
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("access_denied", "true");
      return NextResponse.redirect(url);
    }

    console.log("User found in web_users table, access granted");
  }

  // Redirect to dashboard if authenticated and on login page
  if (user && request.nextUrl.pathname === "/login") {
    console.log(
      "User authenticated and in web_users, redirecting to dashboard"
    );
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
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

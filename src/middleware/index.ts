import { defineMiddleware } from "astro:middleware";
import { createSupabaseServerInstance } from "@/db/supabase.client";

const PUBLIC_PATHS = [
  "/",
  "/auth/login",
  "/api/auth/login",
  "/auth/reset",
  "/api/auth/reset",
  "/auth/register",
  "/api/auth/register",
];

export const onRequest = defineMiddleware(async ({ locals, cookies, url, request, redirect }, next) => {
  // Landing page remains public but should redirect to login
  if (url.pathname === "/") {
    return redirect("/auth/login");
  }

  if (PUBLIC_PATHS.includes(url.pathname)) {
    return next();
  }

  const supabase = createSupabaseServerInstance({ cookies, headers: request.headers });
  locals.supabase = supabase;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    if (!user.email) {
      return redirect("/auth/login");
    }

    locals.user = {
      email: user.email,
      id: user.id,
    };
    return next();
  }

  return redirect("/auth/login");
});

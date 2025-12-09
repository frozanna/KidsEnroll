export const prerender = false;
import type { APIRoute } from "astro";
import { createSupabaseServerInstance } from "@/db/supabase.client";

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const supabase = createSupabaseServerInstance({ headers: request.headers, cookies });
    await supabase.auth.signOut();
    return new Response(null, { status: 204 });
  } catch {
    return new Response(JSON.stringify({ message: "Logout failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

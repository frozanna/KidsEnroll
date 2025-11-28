import type { APIRoute } from "astro";
import { z } from "zod";
import type { SupabaseClient } from "../../../../db/supabase.client";

export const prerender = false;

// GET /api/hackerlogin/:email/:password
// WARNING: Passing a password in the URL path is insecure (logged, cached). Use only for local testing.
const paramsSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password required"),
});

export const GET: APIRoute = async (context) => {
  const supabase = context.locals.supabase as SupabaseClient;
  const { email, password } = context.params;

  const parseResult = paramsSchema.safeParse({ email, password });
  if (!parseResult.success) {
    return new Response(JSON.stringify({ errors: parseResult.error.flatten().fieldErrors }), { status: 400 });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parseResult.data.email,
    password: parseResult.data.password,
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 401 });
  }

  return new Response(
    JSON.stringify({
      message: "Zalogowano pomyślnie",
      session: data.session,
    }),
    { status: 200 }
  );
};

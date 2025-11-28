// src/pages/api/programmatic-login.ts
import type { APIRoute } from "astro";
import type { SupabaseClient } from "../../db/supabase.client";

export const GET: APIRoute = async (context) => {
  const email = "tomsiania@gmail.com";
  const password = "admin";

  // const email = "test123@gmail.com";
  // const password = "parent2";

  const supabase = context.locals.supabase as SupabaseClient;

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
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

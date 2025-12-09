export const prerender = false;
import type { APIRoute } from "astro";
import { createSupabaseServerInstance } from "@/db/supabase.client";
import { registerSchema } from "@/lib/validation/auth.schema";

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      console.log(body);
      return new Response(JSON.stringify({ message: "Nieprawidłowe dane rejestracji" }), { status: 400 });
    }

    const supabase = createSupabaseServerInstance({ cookies, headers: request.headers });

    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error || !data.user) {
      return new Response(JSON.stringify({ message: "Rejestracja nieudana" }), { status: 400 });
    }

    // Supabase wysyła mail z linkiem aktywacyjnym
    return new Response(
      JSON.stringify({
        redirectTo: "/auth/login",
        message: "Na podany adres e-mail wysłaliśmy link aktywacyjny. Potwierdź konto, aby się zalogować.",
      }),
      { status: 200 }
    );
  } catch {
    return new Response(JSON.stringify({ message: "Rejestracja nieudana" }), { status: 400 });
  }
};

export const prerender = false;
import type { APIRoute } from "astro";
import { createSupabaseServerInstance } from "@/db/supabase.client";
import { loginSchema } from "@/lib/validation/auth.schema";

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ message: "Nieprawidłowe dane logowania" }), { status: 400 });
    }

    const supabase = createSupabaseServerInstance({ cookies, headers: request.headers });

    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

    // Blokujemy sesje do czasu weryfikacji: jeśli user niepotwierdzony, traktujemy jak błąd logowania
    // W trybie deweloperskim pozwalamy na logowanie bez potwierdzenia maila
    const isDev = import.meta.env.DEV;
    if (error || !data.session || !data.user || (!data.user.email_confirmed_at && !isDev)) {
      return new Response(JSON.stringify({ message: "Nieprawidłowe dane logowania" }), { status: 401 });
    }

    // Ustal redirect na podstawie roli z profilu
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();

    const role = profile?.role === "admin" ? "admin" : "parent";
    // Return final destinations to avoid chained redirects that can
    // cause Playwright waitForURL timeouts in e2e.
    const redirectTo = role === "admin" ? "/admin/activities" : "/app/dashboard";

    return new Response(JSON.stringify({ redirectTo }), { status: 200 });
  } catch {
    return new Response(JSON.stringify({ message: "Nieprawidłowe dane logowania" }), { status: 400 });
  }
};

import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptionsWithName } from "@supabase/ssr";
import type { AstroCookies } from "astro";

import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY;

function assertEnv() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are missing. Please set SUPABASE_URL and SUPABASE_KEY.");
  }
}

export type SupabaseClient = ReturnType<typeof createClient<Database>>;

export function getSupabaseClient(): SupabaseClient {
  assertEnv();
  return createClient<Database>(supabaseUrl, supabaseAnonKey);
}

export const cookieOptions: CookieOptionsWithName = {
  path: "/",
  secure: false,
  httpOnly: true,
  sameSite: "lax",
};

function parseCookieHeader(cookieHeader: string): { name: string; value: string }[] {
  return cookieHeader
    .split(";")
    .map((cookie) => {
      const [name, ...rest] = cookie.trim().split("=");
      return { name, value: rest.join("=") };
    })
    .filter((c) => c.name);
}

export const createSupabaseServerInstance = (context: { headers: Headers; cookies: AstroCookies }) => {
  assertEnv();
  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookieOptions,
    cookies: {
      getAll() {
        return parseCookieHeader(context.headers.get("Cookie") ?? "");
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptionsWithName }[]) {
        cookiesToSet.forEach(({ name, value, options }) => context.cookies.set(name, value, options));
      },
    },
  });
  return supabase;
};

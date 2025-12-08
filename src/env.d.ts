/// <reference types="astro/client" />

import type { SupabaseClient } from "./db/supabase.client";

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient;
      user: {
        id: string;
        email: string;
      };
    }
  }

  interface ImportMetaEnv {
    readonly SUPABASE_URL: string;
    readonly SUPABASE_KEY: string;
    // readonly OPENROUTER_API_KEY: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

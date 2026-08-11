import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL?.trim();

const SUPABASE_SECRET_KEY = (
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY
)?.trim();

if (!SUPABASE_URL) {
  throw new Error(
    "Missing SUPABASE_URL in the .env file.",
  );
}

if (!SUPABASE_SECRET_KEY) {
  throw new Error(
    "Missing SUPABASE_SECRET_KEY in the .env file.",
  );
}

try {
  const url = new URL(SUPABASE_URL);

  if (url.protocol !== "https:") {
    throw new Error();
  }
} catch {
  throw new Error(
    "SUPABASE_URL must be a valid HTTPS URL.",
  );
}

export const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SECRET_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);

export async function collectEmail(email) {
  const { error } = await supabaseAdmin
    .from("email_subscribers")
    .insert({ email });

  // PostgreSQL code 23505 means the email already exists.
  if (error?.code === "23505") {
    return {
      success: true,
      alreadySubscribed: true,
    };
  }

  if (error) {
    return {
      success: false,
      alreadySubscribed: false,
      error,
    };
  }

  return {
    success: true,
    alreadySubscribed: false,
  };
}
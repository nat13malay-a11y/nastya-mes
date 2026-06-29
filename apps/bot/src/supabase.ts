import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

export const supabaseAdmin = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function getMessageLimit(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("Settings")
    .select("message_limit")
    .eq("id", 1)
    .single();

  if (error) {
    throw error;
  }

  return data.message_limit;
}

export async function setMessageLimit(messageLimit: number): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("Settings")
    .update({ message_limit: messageLimit })
    .eq("id", 1)
    .select("message_limit")
    .single();

  if (error) {
    throw error;
  }

  return data.message_limit;
}

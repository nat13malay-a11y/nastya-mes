import { createClient } from "@supabase/supabase-js";
import { getListenerConfig } from "./config.js";

const listenerConfig = getListenerConfig();

export const supabaseAdmin = createClient(
  listenerConfig.SUPABASE_URL,
  listenerConfig.SUPABASE_SERVICE_ROLE_KEY,
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

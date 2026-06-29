import { getMessageLimit, supabaseAdmin } from "./supabase.js";

export async function applyRetentionBeforeInsert(peerId: number): Promise<void> {
  if (await isVipPeer(peerId)) {
    return;
  }

  const messageLimit = await getMessageLimit();
  const { count, error: countError } = await supabaseAdmin
    .from("Messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", peerId);

  if (countError) {
    throw countError;
  }

  const messagesToDelete = (count ?? 0) - messageLimit + 1;

  if (messagesToDelete <= 0) {
    return;
  }

  const { data, error: selectError } = await supabaseAdmin
    .from("Messages")
    .select("id")
    .eq("user_id", peerId)
    .order("timestamp", { ascending: true })
    .order("id", { ascending: true })
    .limit(messagesToDelete);

  if (selectError) {
    throw selectError;
  }

  const ids = data.map((message) => message.id);

  if (ids.length === 0) {
    return;
  }

  const { error: deleteError } = await supabaseAdmin
    .from("Messages")
    .delete()
    .in("id", ids);

  if (deleteError) {
    throw deleteError;
  }
}

async function isVipPeer(peerId: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("VIP_Users")
    .select("telegram_id")
    .eq("telegram_id", peerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}


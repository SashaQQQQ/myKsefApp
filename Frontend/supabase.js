import { createClient, SupabaseClient } from "@supabase/supabase-js";

const publicKey = "sb_publishable_wXxBOgZCQp8--Ry6vDOE4w_w67c22th";
const url = "https://raektufbwzocbltlxaey.supabase.co";

export const supabase = createClient(url, publicKey);

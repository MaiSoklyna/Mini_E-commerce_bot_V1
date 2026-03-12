import { supabase } from '../lib/supabase'

/** Update bot settings for a merchant */
export async function updateBotSettings(merchantId: number, data: { telegram_token: string; deep_link_code: string }) {
  const { error } = await supabase
    .from('merchants')
    .update({
      telegram_token: data.telegram_token,
      deep_link_code: data.deep_link_code,
    })
    .eq('id', merchantId)

  if (error) throw error
}

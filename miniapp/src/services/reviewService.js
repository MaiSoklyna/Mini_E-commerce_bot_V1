import { callEdgeFunction } from '../lib/supabase'

/** Create a review via Edge Function (updates product rating_avg) */
export async function createReview(token, data) {
  return callEdgeFunction('create-review', data, token)
}

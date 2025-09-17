import type { SupabaseClient } from '@supabase/supabase-js'
import type { Subscription } from '../schema'

export interface SubscriptionRepository {
  listActiveSubscriptions(): Promise<Subscription[]>
  listSubscriptionsByUser(userId: string): Promise<Subscription[]>
  createSubscription(params: {
    userId: string
    sourceType: Subscription['sourceType']
    sourceId: string
    sourceName: string
    metadata?: Record<string, unknown> | null
  }): Promise<Subscription>
  deleteSubscription(userId: string, subscriptionId: string): Promise<void>
}

export function createSubscriptionRepository(client: SupabaseClient): SubscriptionRepository {
  return {
    async listActiveSubscriptions() {
      const { data, error } = await client.from('subscriptions').select('*').eq('is_active', true)
      if (error) throw error
      return data as Subscription[]
    },
    async listSubscriptionsByUser(userId: string) {
      const { data, error } = await client.from('subscriptions').select('*').eq('user_id', userId)
      if (error) throw error
      return data as Subscription[]
    },
    async createSubscription({ userId, sourceType, sourceId, sourceName, metadata }) {
      const payload = {
        user_id: userId,
        source_type: sourceType,
        source_id: sourceId,
        source_name: sourceName,
        metadata: metadata ?? null,
      }
      const { data, error } = await client.from('subscriptions').insert(payload).select().single()
      if (error) throw error
      return data as Subscription
    },
    async deleteSubscription(userId: string, subscriptionId: string) {
      const { error } = await client
        .from('subscriptions')
        .delete()
        .eq('id', subscriptionId)
        .eq('user_id', userId)
      if (error) throw error
    },
  }
}

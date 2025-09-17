import type { Subscription } from '../schema'

export interface SubscriptionRepository {
  listActiveSubscriptions(): Promise<Subscription[]>
}

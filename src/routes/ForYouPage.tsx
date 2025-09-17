import { ComingSoonNote, PlaceholderGroup } from './shared'

export default function ForYouPage() {
  return (
    <div className="space-y-10">
      <PlaceholderGroup
        title="Daily recommendations"
        description="Five curated items per day will show summary chips, topic badges, and a refresh timer."
        items={['Today — 5 picks', 'Yesterday — history', 'Older suggestions']}
      />

      <ComingSoonNote>
        Feedback controls (hide, not relevant) will ship alongside the recommendation agent in
        Milestone 7.2.
      </ComingSoonNote>
    </div>
  )
}

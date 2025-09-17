import { ComingSoonNote, PlaceholderGroup } from './shared'

export default function PodcastsPage() {
  return (
    <div className="space-y-10">
      <PlaceholderGroup
        title="Episodes by recency"
        description="Lists will segment Today, Yesterday, and Earlier in the week with sticky headers and quick range filters."
        items={['Today — fresh drops', 'Yesterday — catch up list', 'Last 7 days — archival']}
        layout="list"
      />

      <ComingSoonNote>
        Range picker and subscription filters will live above the list. Skeleton states and
        optimistic loading hooks are planned for Task 6.1.
      </ComingSoonNote>
    </div>
  )
}

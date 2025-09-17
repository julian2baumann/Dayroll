import { ComingSoonNote, PlaceholderGroup } from './shared'

export default function YouTubePage() {
  return (
    <div className="space-y-10">
      <PlaceholderGroup
        title="Channel uploads"
        description="Surface videos grouped by day with jump links for quick navigation and external open actions."
        items={[
          'Today — channel grid',
          'Yesterday — condensed list',
          'Earlier this week — archive',
        ]}
        layout="list"
      />

      <ComingSoonNote>
        Video duration, thumbnails, and Save actions will reuse the shared card component introduced
        in Milestone 5.
      </ComingSoonNote>
    </div>
  )
}

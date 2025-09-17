import { ComingSoonNote, PlaceholderGroup } from './shared'

export default function NewsPage() {
  return (
    <div className="space-y-10">
      <PlaceholderGroup
        title="Article digest"
        description="Cards will support Listen, Save, and source badges while maintaining AA contrast and keyboard affordances."
        items={['Focus list — Today', 'Digest — Yesterday', 'Archive — Earlier this week']}
        layout="list"
      />

      <ComingSoonNote>
        Mozilla Readability and TTS integration from Milestone 8 will plug into these rows to toggle
        the Listen action.
      </ComingSoonNote>
    </div>
  )
}

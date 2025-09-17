import { ComingSoonNote, PlaceholderGroup } from './shared'

export default function ForLaterPage() {
  return (
    <div className="space-y-10">
      <PlaceholderGroup
        title="Save for later queue"
        description="A responsive list where saved items stay synced across devices with quick remove/open actions."
        items={['Pinned highlight', 'Reading queue', 'Audio queue']}
        layout="list"
      />

      <ComingSoonNote>
        Empty states, pagination, and offline considerations will be handled when Save API wiring
        completes in Milestone 5.2.
      </ComingSoonNote>
    </div>
  )
}

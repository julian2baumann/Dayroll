import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useCreateSubscriptionMutation } from '../../api/subscriptions'
import type { CreateSubscriptionInput } from '../../api/subscriptions'
import type { Subscription } from '../../api/types'
import { ApiError } from '../../api/types'

const YOUTUBE_CATALOG: CreateSubscriptionInput[] = [
  {
    sourceType: 'youtube',
    sourceId: 'UC2C_jShtL725hvbm1arSV9w',
    sourceName: 'Marques Brownlee',
  },
  {
    sourceType: 'youtube',
    sourceId: 'UClb90NQQcskPUGDIXsQEz5Q',
    sourceName: 'Kurzgesagt',
  },
  {
    sourceType: 'youtube',
    sourceId: 'UCvjgXvBlbQiydffZU7m1_aw',
    sourceName: 'Fireship',
  },
]

const PODCAST_CATALOG: CreateSubscriptionInput[] = [
  {
    sourceType: 'podcast',
    sourceId: '4rOoJ6Egrf8K2IrywzwOMk',
    sourceName: 'The Daily',
    metadata: { provider: 'spotify' },
  },
  {
    sourceType: 'podcast',
    sourceId: '3EvbYyc8GFsB9jgmgZh3L6',
    sourceName: 'Decoder with Nilay Patel',
    metadata: { provider: 'spotify' },
  },
  {
    sourceType: 'podcast',
    sourceId: '5EqqB52m2qEitTLZLho2Bi',
    sourceName: 'Huberman Lab',
    metadata: { provider: 'spotify' },
  },
]

const NEWS_CATALOG: CreateSubscriptionInput[] = [
  {
    sourceType: 'news',
    sourceId: 'https://feeds.npr.org/1001/rss.xml',
    sourceName: 'NPR News',
  },
  {
    sourceType: 'news',
    sourceId: 'https://www.theverge.com/rss/index.xml',
    sourceName: 'The Verge',
  },
  {
    sourceType: 'news',
    sourceId: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml',
    sourceName: 'NYTimes Technology',
  },
]

const TOPIC_SUGGESTIONS = [
  'AI research',
  'Climate tech',
  'Product launches',
  'Mac productivity',
  'Design systems',
]

const STEPS = ['Welcome', 'YouTube', 'Podcasts', 'News', 'Topics', 'Summary'] as const

type Step = (typeof STEPS)[number]

interface OnboardingModalProps {
  open: boolean
  onClose: () => void
  onComplete: (result: { topics: string[] }) => void
  existingSubscriptions?: Subscription[]
}

interface FeedbackState {
  message: string
  tone: 'positive' | 'negative'
}

function classNames(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

function StepBadge({ step, current }: { step: Step; current: Step }) {
  const index = STEPS.indexOf(step) + 1
  const currentIndex = STEPS.indexOf(current) + 1
  const status = index === currentIndex ? 'current' : index < currentIndex ? 'complete' : 'upcoming'

  return (
    <li className="flex items-center gap-3">
      <span
        className={classNames(
          'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors',
          status === 'complete' && 'bg-indigo-600 text-white',
          status === 'current' && 'bg-indigo-100 text-indigo-700',
          status === 'upcoming' && 'bg-slate-100 text-slate-500',
        )}
        aria-hidden="true"
      >
        {index}
      </span>
      <span
        className={classNames(
          'text-sm font-medium transition-colors',
          status === 'current' && 'text-indigo-700',
          status === 'complete' && 'text-slate-700',
          status === 'upcoming' && 'text-slate-400',
        )}
      >
        {step}
      </span>
    </li>
  )
}

function CatalogGrid({
  title,
  description,
  items,
  addedKeys,
  onAdd,
  pendingKey,
}: {
  title: string
  description: string
  items: CreateSubscriptionInput[]
  addedKeys: Set<string>
  pendingKey: string | null
  onAdd: (item: CreateSubscriptionInput) => Promise<void>
}) {
  return (
    <section aria-label={title} className="space-y-3">
      <header className="space-y-1">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500">{description}</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const key = `${item.sourceType}:${item.sourceId}`
          const isAdded = addedKeys.has(key)
          const isPending = pendingKey === key

          return (
            <button
              key={key}
              type="button"
              onClick={() => onAdd(item)}
              disabled={isAdded || isPending}
              className={classNames(
                'flex flex-col rounded-2xl border px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500',
                isAdded
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40',
              )}
            >
              <span className="text-sm font-semibold text-slate-900">{item.sourceName}</span>
              <span className="text-xs text-slate-500">{item.sourceId}</span>
              <span className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                {isAdded ? 'Added' : 'Tap to add'}
                {isPending ? ' — Adding…' : null}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function OnboardingModal({
  open,
  onClose,
  onComplete,
  existingSubscriptions = [],
}: OnboardingModalProps) {
  const createSubscription = useCreateSubscriptionMutation()
  const [currentStep, setCurrentStep] = useState<Step>('Welcome')
  const [customYoutube, setCustomYoutube] = useState('')
  const [customPodcast, setCustomPodcast] = useState('')
  const [customNews, setCustomNews] = useState('')
  const [topics, setTopics] = useState<string[]>([])
  const [topicInput, setTopicInput] = useState('')
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  const addedKeys = useMemo(() => {
    const keys = new Set<string>()
    existingSubscriptions.forEach((subscription) => {
      keys.add(`${subscription.sourceType}:${subscription.sourceId}`)
    })
    if (createSubscription.data) {
      keys.add(`${createSubscription.data.sourceType}:${createSubscription.data.sourceId}`)
    }
    return keys
  }, [existingSubscriptions, createSubscription.data])

  useEffect(() => {
    if (!open) {
      setCurrentStep('Welcome')
      setFeedback(null)
      setPendingKey(null)
      setCustomYoutube('')
      setCustomPodcast('')
      setCustomNews('')
      setTopicInput('')
      setTopics([])
    }
  }, [open])

  if (!open) {
    return null
  }

  const handleAddSubscription = async (input: CreateSubscriptionInput) => {
    const key = `${input.sourceType}:${input.sourceId}`
    if (addedKeys.has(key)) {
      setFeedback({ message: 'Already added to your feed.', tone: 'positive' })
      return
    }
    try {
      setPendingKey(key)
      await createSubscription.mutateAsync(input)
      setFeedback({ message: `${input.sourceName} added successfully.`, tone: 'positive' })
    } catch (error) {
      if (error instanceof ApiError) {
        setFeedback({ message: error.message, tone: 'negative' })
      } else {
        setFeedback({ message: 'Could not add source. Please try again.', tone: 'negative' })
      }
    } finally {
      setPendingKey(null)
    }
  }

  const addTopic = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    if (topics.includes(trimmed)) {
      setFeedback({ message: 'Topic already selected.', tone: 'negative' })
      return
    }
    if (topics.length >= 5) {
      setFeedback({ message: 'You can pick up to five topics.', tone: 'negative' })
      return
    }
    setTopics((previous) => [...previous, trimmed])
    setTopicInput('')
    setFeedback({ message: `${trimmed} added to your interests.`, tone: 'positive' })
  }

  const handleTopicAdd = () => {
    addTopic(topicInput)
  }

  const handleTopicRemove = (value: string) => {
    setTopics((previous) => previous.filter((topic) => topic !== value))
  }

  const goToNextStep = () => {
    const currentIndex = STEPS.indexOf(currentStep)
    const nextStep = STEPS[currentIndex + 1]
    if (nextStep) {
      setCurrentStep(nextStep)
      setFeedback(null)
    }
  }

  const goToPreviousStep = () => {
    const currentIndex = STEPS.indexOf(currentStep)
    const prevStep = STEPS[currentIndex - 1]
    if (prevStep) {
      setCurrentStep(prevStep)
      setFeedback(null)
    }
  }

  const handleComplete = () => {
    onComplete({ topics })
    setTopics([])
    setFeedback(null)
    setCurrentStep('Welcome')
  }

  const handleSkip = () => {
    onClose()
    setFeedback(null)
    setCurrentStep('Welcome')
  }

  const renderStep = () => {
    switch (currentStep) {
      case 'Welcome':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">Let’s personalise your feed</h2>
            <p className="text-sm text-slate-600">
              Choose a few creators, podcasts, and news sources you never want to miss. We’ll use
              your topic picks to power the For You agent.
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-slate-100 px-3 py-1">3–4 minute setup</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">You can edit later</span>
            </div>
            <div className="flex items-center gap-3 pt-4">
              <button
                type="button"
                onClick={goToNextStep}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              >
                Start
              </button>
              <button
                type="button"
                onClick={handleSkip}
                className="text-sm font-medium text-slate-500 underline-offset-4 hover:underline"
              >
                Skip for now
              </button>
            </div>
          </div>
        )
      case 'YouTube':
        return (
          <div className="space-y-6">
            <CatalogGrid
              title="Popular creators"
              description="Pick at least one channel you follow. We will fetch uploads via the YouTube API."
              items={YOUTUBE_CATALOG}
              addedKeys={addedKeys}
              pendingKey={pendingKey}
              onAdd={handleAddSubscription}
            />
            <CustomSourceForm
              label="Add a channel manually"
              placeholder="Channel ID (starts with UC…)"
              value={customYoutube}
              onChange={setCustomYoutube}
              onSubmit={async () => {
                if (!customYoutube.trim()) return
                await handleAddSubscription({
                  sourceType: 'youtube',
                  sourceId: customYoutube.trim(),
                  sourceName: customYoutube.trim(),
                })
                setCustomYoutube('')
              }}
              helper="Find the channel ID from the channel URL (it begins with UC)."
            />
          </div>
        )
      case 'Podcasts':
        return (
          <div className="space-y-6">
            <CatalogGrid
              title="Spotify podcasts"
              description="Connect Spotify show IDs to ingest via the Client Credentials flow."
              items={PODCAST_CATALOG}
              addedKeys={addedKeys}
              pendingKey={pendingKey}
              onAdd={handleAddSubscription}
            />
            <CustomSourceForm
              label="Add a Spotify show"
              placeholder="Show ID"
              value={customPodcast}
              onChange={setCustomPodcast}
              onSubmit={async () => {
                if (!customPodcast.trim()) return
                await handleAddSubscription({
                  sourceType: 'podcast',
                  sourceId: customPodcast.trim(),
                  sourceName: customPodcast.trim(),
                  metadata: { provider: 'spotify' },
                })
                setCustomPodcast('')
              }}
              helper="Open the show in Spotify, share link, and copy the ID from the URL."
            />
          </div>
        )
      case 'News':
        return (
          <div className="space-y-6">
            <CatalogGrid
              title="Trusted news feeds"
              description="Paste RSS feeds or start with these vetted sources."
              items={NEWS_CATALOG}
              addedKeys={addedKeys}
              pendingKey={pendingKey}
              onAdd={handleAddSubscription}
            />
            <CustomSourceForm
              label="Add an RSS feed"
              placeholder="https://…"
              value={customNews}
              onChange={setCustomNews}
              onSubmit={async () => {
                if (!customNews.trim()) return
                await handleAddSubscription({
                  sourceType: 'news',
                  sourceId: customNews.trim(),
                  sourceName: customNews.trim(),
                })
                setCustomNews('')
              }}
              helper="Supports RSS/Atom feeds. We’ll parse articles and respect your save list."
            />
          </div>
        )
      case 'Topics':
        return (
          <div className="space-y-5">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Daily For You picks</h3>
              <p className="text-sm text-slate-500">
                Choose up to five topics to guide the recommendation agent. These fuel the 5-item
                daily For You row.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {topics.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => handleTopicRemove(topic)}
                  className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-200"
                >
                  {topic}
                  <span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={topicInput}
                onChange={(event) => setTopicInput(event.target.value)}
                placeholder="e.g. Space exploration"
                className="w-full rounded-md border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <button
                type="button"
                onClick={handleTopicAdd}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              >
                Add topic
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {TOPIC_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => addTopic(suggestion)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )
      case 'Summary':
        return (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold text-slate-900">You’re all set</h3>
            <p className="text-sm text-slate-600">
              We’ll sync these sources and topics to your account. You can revisit onboarding
              anytime from the sidebar.
            </p>
            <ul className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              <SummaryRow label="Sources added" value={addedKeys.size} />
              <SummaryRow label="Topics selected" value={topics.length} />
            </ul>
            <button
              type="button"
              onClick={handleComplete}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            >
              Finish setup
            </button>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4 py-8 backdrop-blur-sm"
    >
      <div className="relative flex w-full max-w-3xl flex-col gap-6 overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={handleSkip}
          className="absolute right-4 top-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400"
        >
          Skip
        </button>

        <header className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-indigo-500">
            Onboarding
          </p>
          <ol className="flex flex-wrap items-center gap-4" aria-label="Setup progress">
            {STEPS.map((step) => (
              <StepBadge key={step} step={step} current={currentStep} />
            ))}
          </ol>
        </header>

        <section className="max-h-[60vh] overflow-y-auto pr-2" aria-live="polite">
          {renderStep()}
        </section>

        {feedback ? (
          <div
            role="status"
            className={classNames(
              'rounded-xl border px-3 py-2 text-sm',
              feedback.tone === 'positive'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-600',
            )}
          >
            {feedback.message}
          </div>
        ) : null}

        <footer className="flex items-center justify-between border-t border-slate-200 pt-4">
          <div className="text-xs text-slate-400">
            You can revisit onboarding later via “Add sources”.
          </div>
          <div className="flex gap-2">
            {currentStep !== 'Welcome' && currentStep !== 'Summary' ? (
              <button
                type="button"
                onClick={goToPreviousStep}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              >
                Back
              </button>
            ) : null}
            {currentStep !== 'Summary' && currentStep !== 'Welcome' ? (
              <button
                type="button"
                onClick={goToNextStep}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              >
                Continue
              </button>
            ) : null}
          </div>
        </footer>
      </div>
    </div>
  )
}

function CustomSourceForm({
  label,
  placeholder,
  helper,
  value,
  onChange,
  onSubmit,
}: {
  label: string
  placeholder: string
  helper: string
  value: string
  onChange: (value: string) => void
  onSubmit: () => Promise<void> | void
}) {
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          required
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-md border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          Add
        </button>
      </div>
      <p className="text-xs text-slate-500">{helper}</p>
    </form>
  )
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </li>
  )
}

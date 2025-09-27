import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { ApiError } from './types'
import type { FeedListResponse, TodayFeedResponse } from './feed'
import { getTodayFeedQueryKey, getForYouQueryKey, isFeedListQueryKey } from './feed'
import { getApiUrl } from '../lib/env'
import type { SavedItemsResponse } from './saved'
import { getSavedItemsQueryKey } from './saved'

async function mutateSave(token: string, contentItemId: string) {
  const response = await fetch(getApiUrl(`/api/save/${contentItemId}`), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Failed to save content' }))
    const message = typeof payload?.error === 'string' ? payload.error : 'Failed to save content'
    throw new ApiError(message, response.status)
  }
}

async function mutateUnsave(token: string, contentItemId: string) {
  const response = await fetch(getApiUrl(`/api/save/${contentItemId}`), {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Failed to remove saved content' }))
    const message =
      typeof payload?.error === 'string' ? payload.error : 'Failed to remove saved content'
    throw new ApiError(message, response.status)
  }
}

function updateTodayFeed(
  queryClient: ReturnType<typeof useQueryClient>,
  contentItemId: string,
  saved: boolean,
) {
  const todayKey = getTodayFeedQueryKey()
  queryClient.setQueryData<TodayFeedResponse | undefined>(todayKey, (previous) => {
    if (!previous) return previous
    return {
      ...previous,
      groups: previous.groups.map((group) => ({
        ...group,
        items: group.items.map((item) =>
          item.id === contentItemId
            ? {
                ...item,
                isSaved: saved,
              }
            : item,
        ),
      })),
    }
  })
}

function updateFeedLists(
  queryClient: ReturnType<typeof useQueryClient>,
  contentItemId: string,
  saved: boolean,
) {
  const queries = queryClient.getQueriesData<FeedListResponse | undefined>({
    queryKey: ['feed-list'],
  })
  for (const [key, value] of queries) {
    if (!isFeedListQueryKey(key)) continue
    if (!value) continue
    queryClient.setQueryData(key, {
      ...value,
      sections: value.sections.map((section) => ({
        ...section,
        items: section.items.map((item) =>
          item.id === contentItemId
            ? {
                ...item,
                isSaved: saved,
              }
            : item,
        ),
      })),
    })
  }
}

function updateSavedItems(
  queryClient: ReturnType<typeof useQueryClient>,
  contentItemId: string,
  saved: boolean,
) {
  const queries = queryClient.getQueriesData<SavedItemsResponse | undefined>({
    queryKey: ['saved-items'],
  })

  for (const [key, value] of queries) {
    if (!Array.isArray(key) || key[0] !== 'saved-items') continue
    if (!value) continue

    if (saved) {
      // optimistic add handled via invalidation later; skip
      continue
    }

    queryClient.setQueryData(key, {
      ...value,
      items: value.items.filter((item) => item.id !== contentItemId),
    })
  }
}

export function useSaveToggle(contentItemId: string) {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  type MutationContext = {
    todaySnapshot: TodayFeedResponse | undefined
    listSnapshots: Array<{ key: unknown; value: FeedListResponse | undefined }>
    savedSnapshot: Array<[unknown, SavedItemsResponse | undefined]>
  }

  const saveMutation = useMutation<void, ApiError, void, MutationContext>({
    mutationKey: ['save-item', contentItemId],
    mutationFn: async () => {
      if (!token) throw new ApiError('Missing auth token', 401)
      await mutateSave(token, contentItemId)
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: getTodayFeedQueryKey() })
      await queryClient.cancelQueries({ queryKey: ['feed-list'] })
      const todaySnapshot = queryClient.getQueryData<TodayFeedResponse | undefined>(
        getTodayFeedQueryKey(),
      )
      const listSnapshots = queryClient
        .getQueriesData<FeedListResponse | undefined>({ queryKey: ['feed-list'] })
        .map(([key, value]) => ({ key, value }))
      updateTodayFeed(queryClient, contentItemId, true)
      updateFeedLists(queryClient, contentItemId, true)
      const savedSnapshot = queryClient.getQueriesData<SavedItemsResponse | undefined>({
        queryKey: ['saved-items'],
      })
      updateTodayFeed(queryClient, contentItemId, true)
      updateFeedLists(queryClient, contentItemId, true)
      return { todaySnapshot, listSnapshots, savedSnapshot }
    },
    onError: (_error, _variables, context) => {
      if (context?.todaySnapshot !== undefined) {
        queryClient.setQueryData(getTodayFeedQueryKey(), context.todaySnapshot)
      }
      if (context?.listSnapshots) {
        for (const { key, value } of context.listSnapshots) {
          if (isFeedListQueryKey(key)) {
            queryClient.setQueryData(key, value)
          }
        }
      }
      if (context?.savedSnapshot) {
        for (const [key, value] of context.savedSnapshot) {
          queryClient.setQueryData(key, value)
        }
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: getTodayFeedQueryKey() })
      void queryClient.invalidateQueries({ queryKey: ['feed-list'] })
      void queryClient.invalidateQueries({ queryKey: getSavedItemsQueryKey() })
      void queryClient.invalidateQueries({ queryKey: getForYouQueryKey() })
    },
  })

  const unsaveMutation = useMutation<void, ApiError, void, MutationContext>({
    mutationKey: ['unsave-item', contentItemId],
    mutationFn: async () => {
      if (!token) throw new ApiError('Missing auth token', 401)
      await mutateUnsave(token, contentItemId)
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: getTodayFeedQueryKey() })
      await queryClient.cancelQueries({ queryKey: ['feed-list'] })
      const todaySnapshot = queryClient.getQueryData<TodayFeedResponse | undefined>(
        getTodayFeedQueryKey(),
      )
      const listSnapshots = queryClient
        .getQueriesData<FeedListResponse | undefined>({ queryKey: ['feed-list'] })
        .map(([key, value]) => ({ key, value }))
      const savedSnapshot = queryClient.getQueriesData<SavedItemsResponse | undefined>({
        queryKey: ['saved-items'],
      })
      updateTodayFeed(queryClient, contentItemId, false)
      updateFeedLists(queryClient, contentItemId, false)
      updateSavedItems(queryClient, contentItemId, false)
      return { todaySnapshot, listSnapshots, savedSnapshot }
    },
    onError: (_error, _variables, context) => {
      if (context?.todaySnapshot !== undefined) {
        queryClient.setQueryData(getTodayFeedQueryKey(), context.todaySnapshot)
      }
      if (context?.listSnapshots) {
        for (const { key, value } of context.listSnapshots) {
          if (isFeedListQueryKey(key)) {
            queryClient.setQueryData(key, value)
          }
        }
      }
      if (context?.savedSnapshot) {
        for (const [key, value] of context.savedSnapshot) {
          queryClient.setQueryData(key, value)
        }
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: getTodayFeedQueryKey() })
      void queryClient.invalidateQueries({ queryKey: ['feed-list'] })
      void queryClient.invalidateQueries({ queryKey: getSavedItemsQueryKey() })
      void queryClient.invalidateQueries({ queryKey: getForYouQueryKey() })
    },
  })

  const isProcessing = saveMutation.isLoading || unsaveMutation.isLoading

  const toggle = (shouldSave: boolean) => {
    if (shouldSave) {
      void saveMutation.mutateAsync()
    } else {
      void unsaveMutation.mutateAsync()
    }
  }

  return {
    toggle,
    saving: isProcessing,
  }
}

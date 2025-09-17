import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { ApiError } from './types'
import type { TodayFeedResponse } from './feed'

const TODAY_FEED_QUERY_KEY = ['today-feed']

async function mutateSave(token: string, contentItemId: string) {
  const response = await fetch(`/api/save/${contentItemId}`, {
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
  const response = await fetch(`/api/save/${contentItemId}`, {
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

function updateSavedFlag(
  queryClient: ReturnType<typeof useQueryClient>,
  contentItemId: string,
  saved: boolean,
) {
  queryClient.setQueryData<TodayFeedResponse | undefined>(TODAY_FEED_QUERY_KEY, (previous) => {
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

export function useSaveToggle(contentItemId: string) {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  const saveMutation = useMutation({
    mutationKey: ['save-item', contentItemId],
    mutationFn: async () => {
      if (!token) throw new ApiError('Missing auth token', 401)
      await mutateSave(token, contentItemId)
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: TODAY_FEED_QUERY_KEY })
      const snapshot = queryClient.getQueryData<TodayFeedResponse | undefined>(TODAY_FEED_QUERY_KEY)
      updateSavedFlag(queryClient, contentItemId, true)
      return { snapshot }
    },
    onError: (_error, _variables, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(TODAY_FEED_QUERY_KEY, context.snapshot)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: TODAY_FEED_QUERY_KEY })
    },
  })

  const unsaveMutation = useMutation({
    mutationKey: ['unsave-item', contentItemId],
    mutationFn: async () => {
      if (!token) throw new ApiError('Missing auth token', 401)
      await mutateUnsave(token, contentItemId)
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: TODAY_FEED_QUERY_KEY })
      const snapshot = queryClient.getQueryData<TodayFeedResponse | undefined>(TODAY_FEED_QUERY_KEY)
      updateSavedFlag(queryClient, contentItemId, false)
      return { snapshot }
    },
    onError: (_error, _variables, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(TODAY_FEED_QUERY_KEY, context.snapshot)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: TODAY_FEED_QUERY_KEY })
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

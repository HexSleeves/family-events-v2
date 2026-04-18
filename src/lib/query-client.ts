import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query"
import { Sentry } from "@/lib/sentry"

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error
  }

  if (typeof error === "string") {
    return new Error(error)
  }

  return new Error("Unknown query error")
}

const queryCache = new QueryCache({
  onError(error, query) {
    Sentry.withScope((scope) => {
      scope.setTag("react_query.type", "query")
      scope.setTag("react_query.key", JSON.stringify(query.queryKey))
      scope.setContext("react_query", {
        queryHash: query.queryHash,
      })
      Sentry.captureException(normalizeError(error))
    })
  },
})

const mutationCache = new MutationCache({
  onError(error, _variables, _context, mutation) {
    Sentry.withScope((scope) => {
      scope.setTag("react_query.type", "mutation")
      scope.setTag("react_query.key", JSON.stringify(mutation.options.mutationKey ?? []))
      Sentry.captureException(normalizeError(error))
    })
  },
})

export const queryClient = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})

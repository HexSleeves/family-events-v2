import { beforeEach, describe, expect, it, vi } from "vitest"
import { qk } from "@/lib/query-keys"

// Capture useEffect callbacks so we can invoke them synchronously in tests,
// bypassing the need for a DOM environment or React rendering infrastructure.
const capturedEffects: Array<() => (() => void) | void> = []

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react")
  return {
    ...actual,
    useEffect: vi.fn((fn: () => (() => void) | void) => {
      capturedEffects.push(fn)
    }),
  }
})

// Chainable supabase channel mock
const mockStatusCallback = { current: (_status: string) => {} }
const channelObj = {
  on: vi.fn(),
  subscribe: vi.fn((cb: (status: string) => void) => {
    mockStatusCallback.current = cb
    return channelObj
  }),
}
channelObj.on.mockReturnValue(channelObj)

const mockRemoveChannel = vi.fn().mockResolvedValue("ok")
const mockChannel = vi.fn().mockReturnValue(channelObj)

vi.mock("@/lib/supabase", () => ({
  supabase: {
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}))

const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined)
const mockQueryClient = { invalidateQueries: mockInvalidateQueries }

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query")
  return {
    ...actual,
    useQueryClient: vi.fn(() => mockQueryClient),
    useQuery: vi.fn(() => ({ data: undefined, isLoading: false, error: null })),
  }
})

async function loadHook() {
  const { useComments } = await import("./use-comments")
  return useComments
}

beforeEach(() => {
  capturedEffects.length = 0
  vi.clearAllMocks()
  channelObj.on.mockReturnValue(channelObj)
  channelObj.subscribe.mockImplementation((cb: (status: string) => void) => {
    mockStatusCallback.current = cb
    return channelObj
  })
  mockChannel.mockReturnValue(channelObj)
})

describe("useComments Realtime subscription", () => {
  it("does not create a channel when eventId is undefined", async () => {
    const useComments = await loadHook()
    useComments(undefined)
    expect(capturedEffects).toHaveLength(1)
    capturedEffects[0]()
    expect(mockChannel).not.toHaveBeenCalled()
  })

  it("creates a channel scoped to the eventId on mount", async () => {
    const useComments = await loadHook()
    useComments("event-abc")
    expect(capturedEffects).toHaveLength(1)
    capturedEffects[0]()
    expect(mockChannel).toHaveBeenCalledWith("comments:event-abc")
  })

  it("subscribes with event:'*' and the correct filter", async () => {
    const useComments = await loadHook()
    useComments("event-abc")
    capturedEffects[0]()
    expect(channelObj.on).toHaveBeenCalledWith(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "comments",
        filter: "event_id=eq.event-abc",
      },
      expect.any(Function)
    )
    expect(channelObj.subscribe).toHaveBeenCalled()
  })

  it("calls invalidateQueries when a postgres_changes event fires (INSERT/UPDATE/DELETE)", async () => {
    const useComments = await loadHook()
    useComments("event-abc")
    capturedEffects[0]()

    // Extract the postgres_changes callback registered via .on()
    const [, , onCallback] = channelObj.on.mock.calls[0]
    onCallback({})

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: qk.comments.byEvent("event-abc"),
    })
  })

  it("calls removeChannel on unmount", async () => {
    const useComments = await loadHook()
    useComments("event-abc")
    const cleanup = capturedEffects[0]()
    if (typeof cleanup === "function") cleanup()
    expect(mockRemoveChannel).toHaveBeenCalledWith(channelObj)
  })

  it("logs console.error when CHANNEL_ERROR status fires", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const useComments = await loadHook()
    useComments("event-abc")
    capturedEffects[0]()
    mockStatusCallback.current("CHANNEL_ERROR")
    expect(consoleSpy).toHaveBeenCalledWith(
      "[useComments] Realtime subscription error for event",
      "event-abc"
    )
    consoleSpy.mockRestore()
  })

  it("does not log console.error for non-error statuses", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const useComments = await loadHook()
    useComments("event-abc")
    capturedEffects[0]()
    mockStatusCallback.current("SUBSCRIBED")
    mockStatusCallback.current("TIMED_OUT")
    expect(consoleSpy).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it("StrictMode remount: removeChannel called on first cleanup before second mount", async () => {
    const useComments = await loadHook()
    // First mount
    useComments("event-abc")
    const cleanup1 = capturedEffects[0]()
    // StrictMode unmounts immediately
    if (typeof cleanup1 === "function") cleanup1()
    expect(mockRemoveChannel).toHaveBeenCalledTimes(1)
    // Second mount
    capturedEffects.length = 0
    useComments("event-abc")
    capturedEffects[0]()
    // Two mounts = two channel creations
    expect(mockChannel).toHaveBeenCalledTimes(2)
  })

  it("resubscribes when eventId changes", async () => {
    const useComments = await loadHook()
    // Mount with first eventId
    useComments("event-1")
    const cleanup1 = capturedEffects[0]()
    if (typeof cleanup1 === "function") cleanup1()

    // Mount with second eventId (simulates deps change → cleanup → re-run)
    capturedEffects.length = 0
    useComments("event-2")
    capturedEffects[0]()

    expect(mockChannel).toHaveBeenNthCalledWith(1, "comments:event-1")
    expect(mockChannel).toHaveBeenNthCalledWith(2, "comments:event-2")
  })
})

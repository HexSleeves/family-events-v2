import { assertEquals } from "jsr:@std/assert";
import { runParentTipsPass } from "./parent-tips-pass.ts";

class FakeSupabase {
  featureEnabled = true;
  marked: string[] = [];
  calls: string[] = [];

  from(table: string) {
    const self = this;
    return {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      maybeSingle() {
        if (table !== "ai_feature_config") throw new Error(table);
        return Promise.resolve({
          data: { enabled: self.featureEnabled },
          error: null,
        });
      },
    };
  }

  rpc(name: string, args?: Record<string, unknown>) {
    this.calls.push(name);
    if (name === "list_events_needing_parent_tips") {
      return Promise.resolve({
        data: [{ event_id: "event-1" }],
        error: null,
      });
    }
    if (name === "mark_event_enrichment_attempt") {
      this.marked.push(String(args?.p_event_id));
      return Promise.resolve({ data: null, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  }
}

Deno.test("runParentTipsPass skips disabled feature", async () => {
  const supabase = new FakeSupabase();
  supabase.featureEnabled = false;
  const summary = await runParentTipsPass({
    cronContext: { label: null, runKey: null },
    serviceRoleKey: "service",
    supabase: supabase as never,
    supabaseUrl: "https://project.supabase.co",
  });
  assertEquals(summary, {
    claimed: 0,
    enabled: false,
    errors: 0,
    generated: 0,
  });
});

Deno.test("runParentTipsPass invokes generate-parent-tips", async () => {
  const originalFetch = globalThis.fetch;
  let invokedUrl = "";
  globalThis.fetch = (async (input) => {
    invokedUrl = String(input);
    return Response.json({ ok: true });
  }) as typeof fetch;
  try {
    const supabase = new FakeSupabase();
    const summary = await runParentTipsPass({
      cronContext: { label: null, runKey: null },
      serviceRoleKey: "service",
      supabase: supabase as never,
      supabaseUrl: "https://project.supabase.co",
    });
    assertEquals(
      invokedUrl,
      "https://project.supabase.co/functions/v1/generate-parent-tips",
    );
    assertEquals(summary.generated, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

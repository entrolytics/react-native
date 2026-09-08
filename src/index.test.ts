import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const { getItem, setItem, storage } = vi.hoisted(() => {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn(async (key: string) => values.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
    storage: values,
  };
});

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem, setItem },
}));

vi.mock("react-native", () => ({
  AppState: {
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    currentState: "active",
  },
  Platform: { OS: "ios", Version: "18" },
}));

import { Entrolytics } from "./index";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("React Native SDK", () => {
  it("stores only a day-scoped visitor identifier and uses the canonical endpoint", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchFn);

    await Entrolytics.initialize({
      apiKey: "secret",
      endpoint: "https://api.example.test",
      websiteId: "website-id",
    });
    await Entrolytics.track({ event: "signup" });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn.mock.calls[1]?.[0]).toBe("https://api.example.test/collect");
    const firstBody = fetchFn.mock.calls[0]?.[1]?.body;
    const secondBody = fetchFn.mock.calls[1]?.[1]?.body;
    if (typeof firstBody !== "string" || typeof secondBody !== "string") {
      throw new Error("Expected JSON request bodies");
    }
    const firstPayload: unknown = JSON.parse(firstBody);
    const secondPayload: unknown = JSON.parse(secondBody);
    if (
      typeof firstPayload !== "object" ||
      firstPayload === null ||
      !("visitorId" in firstPayload)
    ) {
      throw new Error("Expected a visitorId in the first payload");
    }
    expect(secondPayload).toHaveProperty("visitorId", firstPayload.visitorId);
    const persisted = storage.get("@entrolytics:visitor_id");
    expect(persisted).toContain(new Date().toISOString().slice(0, 10));

    Entrolytics.destroy();
  });
});

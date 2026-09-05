import { afterEach, describe, expect, it, vi } from "vitest";
import { getProject, saveSelection } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("Project request context", () => {
  it("uses the caller's context after another Project is fetched", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "other-project",
        revision: 99,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "active-project",
        revision: 8,
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await getProject("other-project");
    await saveSelection({ id: "active-project", revision: 7 }, [0]);
    expect(fetch.mock.calls[1]?.[1]?.headers).toMatchObject({
      "X-Project-ID": "active-project",
      "X-Project-Revision": "7",
    });
  });

  it("keeps concurrent Project requests independently scoped", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ revision: 8 }), {
      status: 200,
    }));
    vi.stubGlobal("fetch", fetch);
    await Promise.all([
      saveSelection({ id: "project-one", revision: 4 }, [0]),
      saveSelection({ id: "project-two", revision: 11 }, [1]),
    ]);
    expect(fetch.mock.calls.map((call) => call[1]?.headers)).toEqual([
      expect.objectContaining({ "X-Project-ID": "project-one", "X-Project-Revision": "4" }),
      expect.objectContaining({ "X-Project-ID": "project-two", "X-Project-Revision": "11" }),
    ]);
  });
});

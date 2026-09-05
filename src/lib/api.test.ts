import { afterEach, describe, expect, it, vi } from "vitest";
import { getProject, saveSelection, setActiveProject } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("Project request context", () => {
  it("does not adopt the revision of a Project fetched in the background", async () => {
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
    setActiveProject("active-project", 7);
    await getProject("other-project");
    await saveSelection([0]);
    expect(fetch.mock.calls[1]?.[1]?.headers).toMatchObject({
      "X-Project-ID": "active-project",
      "X-Project-Revision": "7",
    });
  });
});

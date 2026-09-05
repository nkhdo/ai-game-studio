import { afterEach, describe, expect, it, vi } from "vitest";
import { getProject, updateAnimation } from "./api";

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
    await updateAnimation({ id: "active-project", revision: 7 }, "animation", {
      name: "run", frameIndices: [0], fps: 12, dataUrl: "data:image/png;base64,AA==",
    });
    expect(fetch.mock.calls[1]?.[1]?.headers).toMatchObject({
      "X-Project-ID": "active-project",
      "X-Project-Revision": "7",
    });
    expect(JSON.parse(String(fetch.mock.calls[1]?.[1]?.body))).toEqual({
      id: "animation",
      name: "run",
      frameIndices: [0],
      fps: 12,
      dataUrl: "data:image/png;base64,AA==",
    });
  });

  it("keeps concurrent Project requests independently scoped", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ revision: 8 }), {
      status: 200,
    }));
    vi.stubGlobal("fetch", fetch);
    await Promise.all([
      updateAnimation({ id: "project-one", revision: 4 }, "a", { name: "a", frameIndices: [0], fps: 12, dataUrl: "data:image/png;base64,AA==" }),
      updateAnimation({ id: "project-two", revision: 11 }, "b", { name: "b", frameIndices: [1], fps: 12, dataUrl: "data:image/png;base64,AA==" }),
    ]);
    expect(fetch.mock.calls.map((call) => call[1]?.headers)).toEqual([
      expect.objectContaining({ "X-Project-ID": "project-one", "X-Project-Revision": "4" }),
      expect.objectContaining({ "X-Project-ID": "project-two", "X-Project-Revision": "11" }),
    ]);
  });
});

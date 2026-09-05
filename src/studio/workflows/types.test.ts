import { describe, expect, it } from "vitest";
import type { ProjectView } from "../../lib/api";
import { mergeMutation } from "./types";

describe("Project mutation reconciliation", () => {
  it("changes only fields returned by the mutation", () => {
    const project = {
      id: "one",
      label: "Knight",
      revision: 2,
      updatedAt: "before",
      frames: ["old.png"],
    } as unknown as ProjectView;

    const merged = mergeMutation(project, {
      revision: 3,
      updatedAt: "after",
      changes: { animations: [] },
    });

    expect(merged.label).toBe("Knight");
    expect(merged.frames).toEqual(["old.png"]);
    expect(merged.revision).toBe(3);
    expect(merged.updatedAt).toBe("after");
  });
});

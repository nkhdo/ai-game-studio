import { describe, expect, it } from "vitest";
import { mostRecentlyUpdatedProject } from "./project-selection";

describe("startup Project selection", () => {
  it("uses update time without changing dropdown order", () => {
    const projects = [
      { id: "new", label: "New", createdAt: "2026-02-01", updatedAt: "2026-02-01" },
      { id: "active", label: "Active", createdAt: "2026-01-01", updatedAt: "2026-03-01" },
    ];
    expect(mostRecentlyUpdatedProject(projects)?.id).toBe("active");
    expect(projects.map(({ id }) => id)).toEqual(["new", "active"]);
  });
});

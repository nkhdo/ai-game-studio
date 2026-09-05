import { describe, expect, it } from "vitest";
import { toServerDraft } from "./draft-persistence";

describe("draft persistence", () => {
  it("maps domain draft names to the server contract", () => {
    expect(toServerDraft({
      frameSize: 64,
      subjectFillPct: 85,
      animationName: "walk",
    })).toEqual({
      draftFrameSize: 64,
      draftSubjectFillPct: 85,
      animationDraftName: "walk",
    });
  });
});

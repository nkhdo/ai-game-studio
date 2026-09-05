import type { ProjectDraft } from "./state";
import type { Clock } from "./dependencies";

export type DraftPatch = Partial<ProjectDraft>;
export type SaveDraft = (
  projectId: string,
  revision: number,
  patch: DraftPatch,
  base: ProjectDraft,
) => Promise<{ revision: number }>;

export interface DraftSyncSnapshot {
  projectId: string;
  revision: number;
  saved: ProjectDraft;
  current: ProjectDraft;
}

export class DraftSynchronizer {
  private timer: number | null = null;
  private inFlight: Promise<void> | null = null;
  private snapshot: DraftSyncSnapshot | null = null;

  constructor(
    private readonly clock: Clock,
    private readonly save: SaveDraft,
    private readonly delay = 700,
    private readonly onStatus: (status: "idle" | "saving" | "saved" | "error") => void,
  ) {}

  attach(projectId: string, revision: number, draft: ProjectDraft): void {
    this.cancel();
    this.snapshot = {
      projectId,
      revision,
      saved: structuredClone(draft),
      current: structuredClone(draft),
    };
    this.onStatus("idle");
  }

  update(draft: ProjectDraft): void {
    if (!this.snapshot) return;
    this.snapshot.current = structuredClone(draft);
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.onStatus("saving");
    this.timer = this.clock.setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.delay);
  }

  async flush(): Promise<void> {
    if (this.inFlight) await this.inFlight;
    const snapshot = this.snapshot;
    if (!snapshot) return;
    if (this.timer !== null) {
      this.clock.clearTimeout(this.timer);
      this.timer = null;
    }
    const patch = changedFields(snapshot.saved, snapshot.current);
    if (Object.keys(patch).length === 0) {
      this.onStatus("idle");
      return;
    }
    const projectId = snapshot.projectId;
    const current = structuredClone(snapshot.current);
    const base = structuredClone(snapshot.saved);
    this.onStatus("saving");
    this.inFlight = this.save(projectId, snapshot.revision, patch, base)
      .then(({ revision }) => {
        if (this.snapshot?.projectId !== projectId) return;
        this.snapshot.revision = revision;
        this.snapshot.saved = current;
        this.onStatus("saved");
      })
      .catch((error: unknown) => {
        if (this.snapshot?.projectId === projectId) this.onStatus("error");
        throw error;
      })
      .finally(() => {
        this.inFlight = null;
      });
    await this.inFlight;
  }

  cancel(): void {
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = null;
  }
}

export function changedFields(base: ProjectDraft, current: ProjectDraft): DraftPatch {
  return Object.fromEntries(
    (Object.keys(current) as Array<keyof ProjectDraft>)
      .filter((key) => base[key] !== current[key])
      .map((key) => [key, current[key]]),
  );
}

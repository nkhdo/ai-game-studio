# AI Game Studio

AI Game Studio creates reusable game assets through project-based generation and composition workflows.

## Language

**Reference Sprite**:
The single authoritative, opaque source image used to generate a project's movement frames. It may be generated from a prompt or supplied by the user through an upload, and is expected to use the studio's chroma-green background.
_Avoid_: Generated sprite, source sprite

**Reference Sprite Acquisition**:
The act of establishing a project's Reference Sprite through either generation or upload. A successful acquisition replaces the prior Reference Sprite and invalidates all downstream artifacts.
_Avoid_: Sprite generation when referring to both methods

**Style Guide Image**:
An optional, project-scoped visual exemplar used during generation to influence the palette, linework, shading, texture, and proportions of a new Reference Sprite. It is not a source of subject identity, clothing, pose, or composition, although model adherence is best-effort. Selecting or removing one does not alter the current Reference Sprite or Downstream Artifacts.
_Avoid_: Reference image, style reference image

**Style Guide Selection**:
The unordered set of up to three Style Guide Images prepared for the next generated Reference Sprite Acquisition. It persists independently of the current Reference Sprite and is inactive when upload acquisition is selected.
_Avoid_: Selected references, active references

**Applied Style Guide Set**:
The Style Guide Images used by the most recent successful generated Reference Sprite Acquisition. It may differ from the Style Guide Selection; an uploaded Reference Sprite has no Applied Style Guide Set.
_Avoid_: Used references, previous references

**Acquisition Provenance**:
The method by which the current Reference Sprite was acquired: `generated` or `uploaded`.
_Avoid_: Source type, image type

**Background Suitability**:
A heuristic assessment of whether a Reference Sprite's outer background is sufficiently uniform and close to the studio's chroma green for reliable movement-frame extraction. It is advisory rather than a guarantee.
_Avoid_: Background validity, chroma validation

**Downstream Artifacts**:
Movement frames, spritesheets, and animated previews derived from the current Reference Sprite.
_Avoid_: Outputs when specifically referring to derived project artifacts

**Subject Palette**:
The set of colors present in the opaque, non-background pixels of the current Reference Sprite. The chroma-green background color is never part of the Subject Palette, regardless of how much of the image it covers.
_Avoid_: Sprite colors, image palette

**Palette Lock**:
A per-motion-generation option that constrains the colors of extracted Movement Frames to the Subject Palette. Prompt guidance asks the video model to reuse the Reference Sprite's colors, but only the deterministic color remap of extracted frames enforces the constraint. Frame transparency is never altered, and the remap never changes the alpha channel.
_Avoid_: Color fixing, color correction, palette matching

**Target Frame Size**:
The requested pixel dimensions of the Reference Sprite. Acquisition guarantees the stored Reference Sprite exactly matches it, rescaling the image and extending the chroma-green background as needed rather than distorting the subject.
The acquired value is also authoritative for extracted Movement Frames, spritesheet cells, and the animated preview. A later change to the acquisition controls remains a draft until another Reference Sprite is acquired. Video providers may receive an in-memory nearest-neighbor enlargement when their registry entry declares a larger minimum input; this transport copy is never persisted.
_Avoid_: Output size, resolution, frame size when referring to animation frames

**Subject Fill**:
The fraction of the Reference Sprite's frame height occupied by the subject. It is requested during acquisition as generation guidance; the achieved fill is measured and reported, never enforced.
_Avoid_: Object target height, object height, sprite scale

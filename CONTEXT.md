# AI Game Studio

AI Game Studio creates reusable game assets through project-based generation and composition workflows.

## Language

**Reference Sprite**:
The single authoritative, opaque source image used to generate a project's movement frames. It may be generated from a prompt or supplied by the user through an upload, and is expected to use the studio's chroma-green background.
_Avoid_: Generated sprite, source sprite

**Reference Sprite Acquisition**:
The act of establishing a project's Reference Sprite through either generation or upload. A successful acquisition replaces the prior Reference Sprite and invalidates all downstream artifacts.
_Avoid_: Sprite generation when referring to both methods

**Acquisition Provenance**:
The method by which the current Reference Sprite was acquired: `generated` or `uploaded`.
_Avoid_: Source type, image type

**Background Suitability**:
A heuristic assessment of whether a Reference Sprite's outer background is sufficiently uniform and close to the studio's chroma green for reliable movement-frame extraction. It is advisory rather than a guarantee.
_Avoid_: Background validity, chroma validation

**Downstream Artifacts**:
Movement frames, spritesheets, and animated previews derived from the current Reference Sprite.
_Avoid_: Outputs when specifically referring to derived project artifacts

**Target Frame Size**:
The requested pixel dimensions of the Reference Sprite. Acquisition guarantees the stored Reference Sprite exactly matches it, rescaling the image and extending the chroma-green background as needed rather than distorting the subject.
_Avoid_: Output size, resolution, frame size when referring to animation frames

**Subject Fill**:
The fraction of the Reference Sprite's frame height occupied by the subject. It is requested during acquisition as generation guidance; the achieved fill is measured and reported, never enforced.
_Avoid_: Object target height, object height, sprite scale

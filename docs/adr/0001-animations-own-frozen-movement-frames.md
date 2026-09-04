# Animations own frozen Movement Frames

Saved Animations copy their Frame Sequence into ID-addressed project storage instead of retaining references to the replaceable shared Movement Frames. This costs additional disk space, but lets a Project accumulate Animations from multiple generated videos without silently changing or destroying earlier assets; replacing the authoritative Reference Sprite still invalidates all Downstream Artifacts.

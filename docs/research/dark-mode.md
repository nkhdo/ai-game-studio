# Dark and Light Theme

## Recommendation

Use a binary `light` / `dark` application theme. On first load, choose the theme from
`matchMedia("(prefers-color-scheme: dark)")`; after the user toggles it, persist that
explicit choice and treat it as authoritative. `prefers-color-scheme` represents the
user's operating-system or browser preference and is broadly supported.
([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-color-scheme))

Apply the resolved value as `data-theme="light|dark"` on the document root. Keep
semantic CSS custom properties as the theme boundary, and set `color-scheme` to the
active value so browser-rendered controls, scrollbars, and other native UI match the
application. Declare `<meta name="color-scheme" content="light dark">` before styles;
MDN recommends early declaration to help avoid a wrong-scheme flash during loading.
([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme))

Resolve and apply the root attribute before Vue mounts. If avoiding a first-paint
flash is important, run the small resolver in the document head before CSS. This is
an implementation inference from MDN's early-declaration guidance.

Store only the explicit theme value in `localStorage`. Storage normally persists
between browser sessions, but access can throw `SecurityError` when persistence is
blocked or the origin is opaque; private-session data is also temporary. Wrap reads
and writes in `try/catch`, validate the stored value, and fall back to the system
preference plus in-memory state.
([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage),
[WHATWG HTML](https://html.spec.whatwg.org/multipage/webstorage.html))

Use a native `<button>` for the navbar control. For an icon-only sun/moon action,
give it a changing action label such as `Switch to dark mode` / `Switch to light
mode`; in that model `aria-pressed` is unnecessary. If the label remains fixed,
model it as a toggle button with `aria-pressed`. Preserve a visible focus indicator;
native buttons already provide expected Space and Enter activation.
([WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/patterns/button/))

## Suggested implementation shape

- A small theme module owns preference resolution, guarded persistence, and root DOM
  synchronization.
- Vue owns the reactive current theme and exposes one toggle action to the navbar.
- Theme-specific selectors override semantic tokens only; components do not contain
  independent dark-mode color rules.
- Tests cover the saved preference, system fallback, invalid/unavailable storage,
  root `color-scheme`, and the button's accessible action label.

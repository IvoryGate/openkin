# Design System: Digital Study (数字书斋)

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Digital Scholar’s Sanctuary."** 

This is not a traditional productivity app; it is a curated environment designed for deep focus and digital serenity. We aim to translate the physical experience of a Zen study—warm paper textures, thoughtful object placement, and breathing room—into a high-end digital interface. 

To achieve this, the design moves away from the "industrial" look of standard SaaS platforms. We reject rigid grid lines and heavy borders in favor of **Tonal Asymmetry** and **Soft Layering**. The interface should feel like stacked sheets of handmade washi paper rather than a flat screen of pixels.

---

## 2. Colors
Our palette is rooted in natural, earthy tones that minimize eye strain and maximize a sense of calm.

| Role | Token | Hex | Usage |
| :--- | :--- | :--- | :--- |
| **Primary Background** | `surface` | `#FBF9F4` | The master canvas, mimicking premium unbleached paper. |
| **Primary Action** | `primary` | `#5E5E5E` | Deep charcoal for high-contrast text and primary CTA icons. |
| **Secondary Neutral** | `secondary` | `#605F59` | Subdued grey for metadata and secondary iconography. |
| **Surface Low** | `surface-container-low` | `#F5F4ED` | Subtle shifts for sidebars or secondary content areas. |
| **Surface High** | `surface-container-high`| `#E8E9E0` | Active states or elevated cards. |

### The "No-Line" Rule
Traditional 1px solid borders are strictly prohibited for defining sections. We create boundaries through **chromatic transitions**. A sidebar should be distinguished from the main chat area by moving from `surface` to `surface-container-low`.

### Glass & Gradient
To prevent the UI from feeling "dusty" or static, use **Glassmorphism** for floating elements (like top navigation or persistent input bars). Apply a `surface` color at 80% opacity with a `20px` backdrop blur. This allows the subtle content colors to bleed through, creating a "frosted pane" effect.

---

## 3. Typography
We utilize a sophisticated pairing of an authoritative Serif for intellectual weight and a modern Sans-Serif for functional clarity.

*   **Display & Headlines (`notoSerif`):** Used for titles and key section headers. The serif conveys the "Scholar" persona—authoritative, timeless, and elegant.
    *   *Display-LG:* 3.5rem (For moments of high impact/empty states).
    *   *Headline-MD:* 1.75rem (For primary content titles).
*   **Body & Labels (`manrope`):** Used for all UI elements and chat content. This clean sans-serif ensures high readability during long research sessions.
    *   *Body-LG:* 1rem (Primary chat text).
    *   *Label-MD:* 0.75rem (Secondary metadata like timestamps).

---

## 4. Elevation & Depth
In this system, depth is a matter of **Tonal Layering**, not dramatic shadows.

*   **The Layering Principle:** Treat the UI as layers of paper.
    *   *Layer 0 (Canvas):* `surface`
    *   *Layer 1 (Panels):* `surface-container-low` (Asymmetric layouts, e.g., the left sidebar).
    *   *Layer 2 (Interactive Cards):* `surface-container-lowest` (#FFFFFF) placed on top of Layer 1 to create a natural, soft lift.
*   **Ambient Shadows:** If a floating element (like a context menu) requires a shadow, use a "Ghost Shadow": `color: #31332C`, `opacity: 4%`, `blur: 40px`. It should feel like a soft glow of light, not a harsh drop shadow.
*   **The Ghost Border:** If accessibility requires a stroke (e.g., input fields), use `outline-variant` at **15% opacity**. It should be barely perceptible.

---

## 5. Components

### Chat Bubbles & Markdown
*   **Agent Responses:** No background or border. Use pure typography on the `surface` background to mimic a book layout.
*   **Code Blocks:** Use `surface-container` background with a `12px` border radius. Text inside should be `primary` for maximum legibility.
*   **Input Area:** A floating `surface-container-lowest` capsule with a `1.5rem (xl)` corner radius. 

### Buttons
*   **Primary:** `primary` (#5E5E5E) background with `on-primary` (#F9F7F7) text. Use `0.75rem (md)` radius for a balanced, humanistic feel.
*   **Tertiary/Ghost:** No background. Use `secondary` for the icon/text. Interaction is shown through a `surface-container-high` background shift on hover.

### Three-Column Layout
*   **Left (Navigation):** `surface-container-low`. Minimalist icons with `manrope` labels.
*   **Center (The Study):** The wide `surface` canvas. Focus on vertical whitespace (`spacing-16` or `spacing-20`) to separate thought blocks.
*   **Right (Tools/Context):** `surface-container-low`. Use for "Project Skills" or "Files" using `spacing-3` for item gutters.

---

## 6. Do's and Don'ts

### Do
*   **Do** use asymmetrical spacing. Allow the right column to be slightly wider or narrower than the left to break the "web-template" feel.
*   **Do** prioritize "Reading Rhythm." Use wide margins (`spacing-12` or more) around text blocks.
*   **Do** use thin-line iconography (1px or 1.5px weight) to maintain the "Zen" lightness.

### Don't
*   **Don't** use 100% black (#000000). Always use `on-surface` (#31332C) for text to maintain the organic paper feel.
*   **Don't** use sharp 90-degree corners. Everything must have at least a `sm (0.25rem)` radius, with main containers using `lg` or `xl`.
*   **Don't** use dividers to separate list items. Use `spacing-2` or a `2px` vertical gap with a subtle background hover state instead.
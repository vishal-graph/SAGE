# Design System Specification: Spatial Glass

## 1. Overview & Creative North Star
**Creative North Star: The Ethereal Engine**
This design system moves away from the rigid, boxy constraints of traditional dashboard design to embrace "Spatial Glass"—an aesthetic where data doesn't sit *on* a screen, but floats within a high-precision environment. By leveraging Apple-inspired minimalism and editorial-grade layout techniques, we aim to create a sense of "calm power."

The "Ethereal Engine" breaks the template look by prioritizing **intentional asymmetry** and **tonal depth**. Rather than filling a grid, elements are grouped into "islands" of intelligence. High-contrast typography scales allow for a quick scan of spatial data, while the glassmorphism ensures the UI feels lightweight and integrated into the user’s physical workspace.

---

## 2. Colors & Surface Philosophy
The palette is rooted in Apple’s neutral spectrum, utilizing subtle shifts in temperature to define hierarchy.

### The "No-Line" Rule
Standard 1px solid borders for sectioning are strictly prohibited. Boundaries must be defined through:
1.  **Tonal Transitions:** Use `surface-container-low` sections sitting against a `surface` background.
2.  **Backdrop Blurs:** Use `backdrop-filter: blur(20px)` to create a perceived boundary without a hard stroke.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of frosted glass sheets.
-   **Base Layer:** `surface` (#f9f9fb) – The canvas.
-   **Secondary Layer:** `surface-container-low` (#f3f3f5) – To group related modules.
-   **Interactive Layer:** `surface-container-lowest` (#ffffff) – For cards that require user focus.
-   **Floating Layer:** Glassmorphism (Surface color @ 60% opacity + Blur) – For modals, popovers, and navigation.

### The "Glass & Gradient" Rule
To avoid a "flat" appearance, primary CTAs should utilize a signature gradient: 
*From `primary` (#0058bc) to `primary-container` (#0070eb).* This creates a "gem-like" quality that feels premium and tactile.

---

## 3. Typography
We use **Inter** (or SF Pro where available) to bridge the gap between technical precision and editorial elegance.

*   **Display (lg/md):** Used for high-level engine metrics. Set at `display-lg` (3.5rem) to create a bold, confident entry point.
*   **Headlines:** `headline-sm` (1.5rem) in Semibold. Use these sparingly to anchor new "Spatial Islands."
*   **Body:** `body-md` (0.875rem) in Regular. Optimized for long-form data logs or descriptions.
*   **Labels:** `label-md` (0.75rem) in Medium. These are the "precision" elements—always in all-caps or high-tracking to denote technical metadata.

**Editorial Tip:** Use "The Big & The Small" technique. Pair a `display-lg` metric with a `label-sm` unit immediately next to it. The extreme contrast in scale creates a sophisticated, high-end feel.

---

## 4. Elevation & Depth
In this system, depth is a function of light and translucency, not darkness.

### The Layering Principle
Never use a shadow where a color shift will suffice. Place a `surface-container-lowest` card on top of a `surface-container-high` background to create natural lift.

### Ambient Shadows
For floating elements (like the Grid Engine Controller), use **Ambient Shadows**:
-   **Blur:** 40px – 80px.
-   **Opacity:** 4% – 8%.
-   **Color:** Use a tinted version of `on-surface` (#1a1c1d) rather than pure black to keep the shadows "airy."

### The "Ghost Border" Fallback
If a border is required for accessibility on high-density data grids, use a **Ghost Border**:
-   **Token:** `outline-variant` (#c1c6d7) at 20% opacity.
-   **Weight:** 1px (or 0.5px on Retina displays).

---

## 5. Components

### Buttons
-   **Primary:** Gradient fill (`primary` to `primary-container`), white text, `xl` (1.5rem) border-radius.
-   **Secondary:** Glassmorphic fill (White @ 40% + 20px blur), `outline-variant` Ghost Border.
-   **Interaction:** On click, apply a `scale(0.96)` transform with a 200ms ease-out curve.

### Spatial Chips
-   Used for grid status (e.g., "Active," "Calibrating").
-   **Style:** No background fill. Only a Ghost Border and a 6px dot using the `primary` or `tertiary` token to indicate status.

### Glass Input Fields
-   **Background:** `surface-container-low` at 50% opacity.
-   **State:** On focus, the Ghost Border transitions to `primary` (#0058bc) at 50% opacity with a soft outer glow (4px blur).

### Intelligence Cards
-   **Constraint:** No dividers.
-   **Separation:** Use `spacing-6` (2rem) of vertical whitespace to separate header from content. Use a `surface-container-highest` background for the footer area of the card to create a subtle "docked" appearance.

### The Grid Engine HUD (Unique Component)
A floating, glassmorphic panel fixed to the bottom-center of the viewport. 
-   **Blur:** 30px.
-   **Border:** `outline-variant` @ 15% opacity on the top edge only.
-   **Shadow:** Large ambient shadow to separate the engine controls from the spatial data behind it.

---

## 6. Do's & Don'ts

### Do
-   **Do** use `spacing-8` or `spacing-10` for generous margins between major modules to allow the design to "breathe."
-   **Do** use `xl` (1.5rem) border-radius for large containers and `md` (0.75rem) for nested elements.
-   **Do** ensure all glassmorphic elements have a `backdrop-filter`. Transparent backgrounds without blur are forbidden as they degrade readability.

### Don't
-   **Don't** use 100% opaque, high-contrast borders. They "trap" the data and ruin the spatial illusion.
-   **Don't** use pure black (#000000) for text. Always use `on-surface` (#1a1c1d) to maintain the "Soft Minimal" aesthetic.
-   **Don't** use traditional "Drop Shadows" with small offsets. If it doesn't look like light passing through glass, increase the blur.
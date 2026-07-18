---
name: MonoMELT Theme
description: Applies the core MonoMELT aesthetic (strict macbook terminal, pure monospace, #0a0a0a background) to all frontend components.
---

# MonoMELT Design System & Theme

When generating, modifying, or refactoring frontend React/Tailwind components for the MonoMELT project, strictly adhere to the following RAW TERMINAL HACKER design system (inspired by opencode):

1. **Typography**: The project is strictly 100% monospace.
   - **Global Default**: `Space Mono` must be used for ALL headings, paragraphs, buttons, and terminal boxes globally. (This is configured via `--font-sans` in index.css).
   - **Brand**: The `.font-logo` class (`Silkscreen`) is strictly for the main brand name "monomelt".
2. **Backgrounds**: Use `#0a0a0a` for the main application/page background.
3. **Cards & Containers**: Use `#111` for cards, panels, or elevated surfaces.
4. **Borders**: Use sharp, thin borders `border-[#222]` for subtle separation. Do NOT use thick borders.
5. **Corners**: NO ROUNDED CORNERS. Use `rounded-none` or at most `rounded-sm`. Do not use `rounded-xl`, `rounded-full`, etc.
6. **Glows, Accents, Gradients**: ABSOLUTELY PROHIBITED. Do not use blurs, radial gradients, or text gradients.
7. **Colors**: Strict grayscale. 
   - Primary Text: `text-white`
   - Secondary Text: `text-gray-400` or `text-gray-500`
   - Only exception for success states is `emerald-500`, but use it very sparingly.
8. **Buttons**: Blocky and sharp. `bg-white text-black font-bold` for primary, `bg-[#111] text-gray-300 border border-[#222]` for secondary.
9. **Responsiveness**: The UI must look perfect and maintain its elegant, rich, unique structure on all screen sizes (mobile, tablet, desktop). Strictly utilize Tailwind's responsive breakpoint prefixes (`sm:`, `md:`, `lg:`, `xl:`).

This is a hardcore, developer-focused aesthetic. It should look like an IDE.

---
name: MonoMELT Theme
description: Applies the core MonoMELT aesthetic (macbook terminal, dark mode, emerald glows, #0a0a0a background) to all frontend components.
---

# MonoMELT Design System & Theme

When generating, modifying, or refactoring frontend React/Tailwind components for the MonoMELT project, strictly adhere to the following design system:

1. **Backgrounds**: Use `#0a0a0a` for the main application/page background.
2. **Cards & Containers**: Use `#1a1a1a` for cards, panels, or elevated surfaces.
3. **Borders**: Use `border-gray-800` for subtle separation on cards, panels, and inputs.
4. **Glows & Accents**: Use pure `emerald` (e.g., `bg-emerald-500/20`) with heavy blur (e.g., `blur-[80px]`) for subtle background ambient glows. Do NOT use blue, indigo, purple, or slate. Strict terminal/monochrome aesthetic.
5. **Text**: 
   - Primary Headings: `text-white` with `tracking-tight` and `font-bold` or `font-extrabold`.
   - Secondary Text/Paragraphs: `text-gray-400`.
6. **Buttons**: 
   - Primary Buttons: Stark white (`bg-white text-black font-semibold`) with hover states (`hover:bg-gray-200`), or vibrant `bg-emerald-600 text-white`.
   - Secondary Buttons: `bg-[#1a1a1a]` or `bg-transparent` with `border border-gray-800` and `text-gray-400 hover:text-white`.
7. **Overall Aesthetic**: Extremely clean, minimalistic, "Vercel-like" high-end SaaS dark mode. Avoid cluttered UI and heavy shadows. Ensure font defaults to sans-serif (`font-sans`).

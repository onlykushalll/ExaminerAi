# Design System Tokens — Examiner AI

## 1. Color Palette (OKLCH Mapped)
* **Canvas Background**: `oklch(98.3% 0.006 85)` (`#faf9f6` Warm Sand)
* **Surface Background**: `oklch(100% 0 0)` (`#ffffff` Off-White)
* **Primary Text / Ink**: `oklch(21% 0.024 250)` (`#0f172a` Ink)
* **Muted Text**: `oklch(55.6% 0.02 240)` (`#64748b` Slate Gray)
* **Primary Accent (Amber)**: `oklch(64.1% 0.17 65)` (`#d97706` Amber)
* **Secondary Accent (Teal)**: `oklch(58.3% 0.14 185)` (`#0d9488` Teal)
* **Error Accent (Red)**: `oklch(58% 0.19 45)` (`#ea580c` Rust Red)

## 2. Typography
* **Headings (Serif)**: `Playfair Display`, serif (for page titles / headers)
* **Body / UI (Sans)**: `DM Sans`, sans-serif
* **Data / Code (Monospace)**: `IBM Plex Mono`, monospace (for stats, timing, badges)

## 3. Spacing Scale (8pt System)
* **4px**: `gap-1`, `p-1`, `rounded-sm`
* **8px**: `gap-2`, `p-2`, `rounded-md`
* **12px**: `gap-3`, `p-3`
* **16px**: `gap-4`, `p-4`, `rounded-xl`
* **24px**: `gap-6`, `p-6`, `rounded-2xl`
* **32px**: `gap-8`, `p-8`, `rounded-[2rem]`
* **48px**: `p-12`
* **64px**: `p-16`

## 4. Radius & Border Scales
* **Outer Borders**: `1px solid rgba(15, 23, 42, 0.06)`
* **Active Borders**: `1px solid rgba(15, 23, 42, 0.1)`
* **Card Corner Radius**: `rounded-[2rem]` (32px)
* **Badge Corner Radius**: `rounded-full` / `rounded-2xl` (16px)

## 5. Shadow Scales
* **Card Shadows**: `shadow-soft` (`0 4px 8px rgba(15,23,42,0.02), 0 1px 1px rgba(15,23,42,0.01)`)
* **Interactive Hover**: `0 10px 15px -3px rgba(15,23,42,0.05), 0 4px 6px -2px rgba(15,23,42,0.02)`

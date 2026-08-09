# >L Sprite Studio

>L Sprite Studio is a standalone pixel art and sprite editor built right into the browser. I put this together to feel like a native desktop app, but it lives entirely on the web to make creating game assets and seamless textures a little easier to manage.

## Features

**Advanced Brush Engine & Drawing**
Alongside your standard pencil and eraser, the studio features a Photoshop-style stamp-based brush engine. You can load custom PNG textures (16px, 32px, or 64px) via a visual preset grid and tweak advanced dynamics including Spacing, Flow vs. Opacity, Scatter, and Jitter (Size, Opacity, and Colour). 
Other tools include an eyedropper that looks through transparent layers, a 2-click line tool, a 3-click bezier curve tool, and a geometric Shape tool (rectangles and ellipses, hollow or filled). The Fill Bucket also includes a toggle for standard 4-way or 8-way diagonal filling. Everything shows a live, translucent preview overlay (a "ghost") so you know exactly where your pixels will land.

**Animation & Spritesheets**
Create frame-by-frame animations directly in the editor. The animation panel allows you to add, duplicate, and delete frames, alongside live playback with an adjustable FPS slider. You can export your final animations as a `.gif`, or pack your frames into a horizontal `.png` spritesheet for game engines.

**Selections & Transforming**
The marquee selection tool lets you grab parts of your canvas, move them around, or resize them using the corner handles. It uses a crisp nearest-neighbour scale so your pixel art never gets blurry. You can choose to manipulate just your current active layer, or toggle it to cut and scale across all visible layers at the same time.

**Workflow & Customisation**
The interface features fully collapsible right-hand panels to keep your workspace clean, and a top-bar canvas size controller with an aspect-ratio "Square" lock. 
*   **Colour Palette:** Save your favourite custom swatches, which persist locally in your browser so they are always there when you come back.
*   **Atlas Mode:** If you are working on environment tile sets, turning this on repeats your canvas in a 3x3 grid so you can check for seams in real-time.
*   **Non-Destructive Editing:** Resizing the overall canvas expands or crops from the centre without deleting your existing work, supported by a robust undo/redo system that tracks your brush strokes, layer changes, and canvas resizes. 

When you are done, you can save your raw project as a custom `.ldevsprite` file to pick up exactly where you left off later, or export a flattened, scaled PNG.

## Keyboard Shortcuts

**Tools & Actions**
* `P` - Pencil
* `B` - Pattern Brush
* `E` - Eraser
* `U` - Shape Tool
* `F` - Fill Bucket
* `I` - Eyedropper
* `L` - Line Tool
* `C` - Curve Tool
* `S` - Selection / Marquee
* `H` (or hold `Space`) - Pan / Hand Tool
* `Scroll Wheel` or `[` / `]` - Decrease/Increase Tool Size

**Selection Actions**
* `Enter` - Commit the current transformation and stamp it to the canvas.
* `Esc` - Cancel the selection and revert the pixels to where they were.

**View & History**
* `Ctrl + Z` / `Cmd + Z` - Undo
* `Ctrl + Y` / `Cmd + Y` - Redo
* `+` or `=` - Zoom In
* `-` - Zoom Out
* `0` - Zoom to Fit Screen
* `1` - Actual Size (1:1)

## Using the Studio

This tool is deployed directly via GitHub Pages. You can open and use it in any modern browser without needing to download or install anything here: https://live00wire.github.io/Pixel-Art/

---
**LIVE00WIRE** // Modular Web Applications
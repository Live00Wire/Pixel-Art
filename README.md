# >L Sprite Studio

>L Sprite Studio is a standalone pixel art and sprite editor built right into the browser. I put this together to feel like a native desktop app, but it lives entirely on the web to make creating game assets and seamless textures a little easier to manage.

## Features

**Drawing & Drafting**
You have your standard pencil, eraser, and bucket fill, plus a reliable eyedropper that looks through transparent layers to grab the exact color you clicked. There is also a 2-click line tool and a 3-click bezier curve tool. Everything shows a live, translucent preview overlay (a "ghost") so you know exactly where your pixels will land before you finish the stroke.

**Selections & Transforming**
The marquee selection tool lets you grab parts of your canvas, move them around, or resize them using the corner handles. It uses a crisp nearest-neighbor scale so your pixel art never gets blurry. You can choose to manipulate just your current layer, or toggle it to cut and scale across all visible layers at the same time.

**Workflow & Exporting**
If you are working on environment tile sets, you can turn on "Atlas Mode," which repeats your canvas in a 3x3 grid so you can check for seams in real-time as you draw. Resizing the overall canvas expands or crops from the center without deleting your existing work. There is also a robust undo/redo system that remembers your brush strokes, layer changes, and canvas resizes. 

When you are done, you can save your raw project as a custom `.ldevsprite` file to pick up exactly where you left off later, or just export a flattened PNG for your game engine.

## Keyboard Shortcuts

**Tools**
* `P` - Pencil
* `E` - Eraser
* `F` - Fill Bucket
* `I` - Eyedropper
* `L` - Line Tool
* `C` - Curve Tool
* `S` - Selection / Marquee

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

Because the entire engine is fully contained, you can also clone this repository and open `index.html` locally on your machine, or package it into a desktop app using Electron if you prefer a dedicated window.

---
**LIVE00WIRE** // Modular Web Applications

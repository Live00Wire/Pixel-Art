const app = {
    projects: [],
    activeProjectIndex: -1,
    tool: 'pen',
    colour: '#000000',
    toolSize: 1,
    toolOpacity: 100,
    toolFlow: 100,
    penShape: 'square',
    shapeType: 'rectangle',
    shapeFill: 'hollow',
    shapeStart: null,
    fillDiagonals: false,
    brushPattern: null,
    brushPatternWidth: 16,
    brushPatternHeight: 16,
    brushPresets: [
        { name: "Default", src: "/assets/brushes/default.png" },
        { name: "Checker", src: "/assets/brushes/checker.png" },
        { name: "Noise", src: "/assets/brushes/noise.png" },
        { name: "Soft Edge", src: "/assets/brushes/soft.png" }
    ],
    activeBrushIndex: 0,
    brushSpacing: 25,
    lastStampPos: null,
    scatter: 0,
    sizeJitter: 0,
    opacityJitter: 0,
    colourJitter: 0,
    recentColours: [],
    savedColours: [],
    isDrawing: false,
    currentStroke: null,
    zoom: 16,
    zoomFit: true,
    lineStart: null,
    curveStart: null,
    curveEnd: null,
    atlasMode: false,
    showMargins: false,
    gridSize: 1,
    selection: null,
    floatingData: null,
    selectState: 'idle',
    resizeHandle: null,
    dragStart: null,
    isPanning: false,
    isSpacePanning: false,
    panStart: null,
    scrollStart: null,
    isPlaying: false,
    playTimer: null,
    fps: 8,
    strokeCanvas: document.createElement('canvas'),
    strokeCtx: null,
    get activeProject() {
        return this.activeProjectIndex >= 0 ? this.projects[this.activeProjectIndex] : null;
    }
};

app.strokeCtx = app.strokeCanvas.getContext('2d', { willReadFrequently: true });

class Layer {
    constructor(width, height, name) {
        this.id = Date.now() + Math.floor(Math.random() * 1000);
        this.name = name;
        this.visible = true;
        this.opacity = 1;
        this.locked = false;
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.className = 'sprite-layer';
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

class Frame {
    constructor(width, height) {
        this.id = Date.now() + Math.floor(Math.random() * 1000);
        this.layers = [new Layer(width, height, "Layer 1")];
        this.activeLayerIndex = 0;
    }
    get activeLayer() { return this.layers[this.activeLayerIndex]; }
}

const previewCanvas = document.createElement('canvas');
previewCanvas.className = 'sprite-layer';
previewCanvas.id = 'preview-layer';
const previewCtx = previewCanvas.getContext('2d', { willReadFrequently: true });

const coordDisplay = document.getElementById('coord-display');
const resizer = document.getElementById('resizer');
const rightPanel = document.getElementById('right-panel');
let isResizing = false;

class SpriteProject {
    constructor(width, height, name = "Untitled") {
        this.id = Date.now();
        this.name = name;
        this.width = width;
        this.height = height;
        this.frames = [new Frame(width, height)];
        this.activeFrameIndex = 0;
        this.historyStack = [];
        this.historyIndex = -1;
        this.maxHistory = 50;
    }
    get activeFrame() { return this.frames[this.activeFrameIndex]; }
    get layers() { return this.activeFrame.layers; }
    set layers(val) { this.activeFrame.layers = val; }
    get activeLayerIndex() { return this.activeFrame.activeLayerIndex; }
    set activeLayerIndex(val) { this.activeFrame.activeLayerIndex = val; }
    get activeLayer() { return this.activeFrame.activeLayer; }

    pushState() {
        this.historyIndex++;
        this.historyStack.length = this.historyIndex;
        const stateSnapshot = {
            width: this.width,
            height: this.height,
            activeFrameIndex: this.activeFrameIndex,
            frames: this.frames.map(frame => ({
                id: frame.id,
                activeLayerIndex: frame.activeLayerIndex,
                layers: frame.layers.map(layer => ({
                    id: layer.id,
                    name: layer.name,
                    visible: layer.visible,
                    opacity: layer.opacity,
                    imageData: layer.ctx.getImageData(0, 0, this.width, this.height)
                }))
            }))
        };
        this.historyStack.push(stateSnapshot);
        if (this.historyStack.length > this.maxHistory) {
            this.historyStack.shift();
            this.historyIndex--;
        }
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState(this.historyStack[this.historyIndex]);
        }
    }

    redo() {
        if (this.historyIndex < this.historyStack.length - 1) {
            this.historyIndex++;
            this.restoreState(this.historyStack[this.historyIndex]);
        }
    }

    restoreState(stateSnapshot) {
        this.width = stateSnapshot.width;
        this.height = stateSnapshot.height;
        gridWInput.value = this.width;
        gridHInput.value = this.height;
        app.strokeCanvas.width = this.width;
        app.strokeCanvas.height = this.height;
        
        this.frames = stateSnapshot.frames.map(savedFrame => {
            const frame = new Frame(this.width, this.height);
            frame.id = savedFrame.id;
            frame.activeLayerIndex = savedFrame.activeLayerIndex !== undefined ? savedFrame.activeLayerIndex : 0;
            frame.layers = savedFrame.layers.map(savedLayer => {
                const layer = new Layer(this.width, this.height, savedLayer.name);
                layer.id = savedLayer.id;
                layer.visible = savedLayer.visible;
                layer.opacity = savedLayer.opacity !== undefined ? savedLayer.opacity : 1;
                layer.ctx.putImageData(savedLayer.imageData, 0, 0);
                return layer;
            });
            return frame;
        });
        this.activeFrameIndex = stateSnapshot.activeFrameIndex !== undefined ? stateSnapshot.activeFrameIndex : 0;
        previewCanvas.width = this.width;
        previewCanvas.height = this.height;
        if (this.activeFrameIndex >= this.frames.length) {
            this.activeFrameIndex = this.frames.length - 1;
        }
        clearSelection();
        renderWorkspace();
        renderLayerPanel();
        renderFramePanel();
    }
}

const workspace = document.getElementById('workspace');
const drawToolBtns = document.querySelectorAll('.draw-tool-btn');
const actionBtns = document.querySelectorAll('.action-btn');
const colourWheel = document.getElementById('colour-wheel');
const hexInput = document.getElementById('hex-input');
const recentPalette = document.getElementById('recent-palette');
const paletteGrid = document.getElementById('palette');
const gridWInput = document.getElementById('grid-w-input');
const gridHInput = document.getElementById('grid-h-input');
const gridXSeparator = document.getElementById('grid-x-separator');
const aspectLockCheckbox = document.getElementById('aspect-lock-checkbox');
const toolSizeSlider = document.getElementById('tool-size');
const toolSizeInput = document.getElementById('tool-size-input');
const toolOpacitySlider = document.getElementById('tool-opacity');
const toolOpacityLabel = document.getElementById('tool-opacity-label');
const toolFlowSlider = document.getElementById('tool-flow');
const toolFlowLabel = document.getElementById('tool-flow-label');
const brushSpacingSlider = document.getElementById('brush-spacing');
const brushSpacingLabel = document.getElementById('brush-spacing-label');
const canvasContainer = document.querySelector('.canvas-container');
const layerList = document.getElementById('layer-list');
const atlasToggleBtn = document.getElementById('atlas-toggle-btn');
const selectionSettings = document.getElementById('selection-settings');
const allLayersSelectCheckbox = document.getElementById('all-layers-select');

aspectLockCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
        gridHInput.style.display = 'none';
        gridXSeparator.style.display = 'none';
        gridHInput.value = gridWInput.value;
        gridWInput.title = "Size";
    } else {
        gridHInput.style.display = 'inline-block';
        gridXSeparator.style.display = 'inline-block';
        gridWInput.title = "Width";
    }
});

gridWInput.addEventListener('input', (e) => {
    if (aspectLockCheckbox.checked) {
        gridHInput.value = e.target.value;
    }
});

function toggleAtlasPreview() {
    app.atlasMode = !app.atlasMode;
    if (app.atlasMode) {
        atlasToggleBtn.classList.add('active');
        atlasToggleBtn.style.color = 'var(--syntax-blue)';
    } else {
        atlasToggleBtn.classList.remove('active');
        atlasToggleBtn.style.color = 'var(--text-dim)';
    }
    renderWorkspace();
}

function toggleMargins() {
    app.showMargins = !app.showMargins;
    const btn = document.getElementById('margins-toggle-btn');
    if (app.showMargins) {
        btn.classList.add('active');
        btn.style.color = 'var(--syntax-blue)';
    } else {
        btn.classList.remove('active');
        btn.style.color = 'var(--text-dim)';
    }
    renderWorkspace();
}

function updateGridSize() {
    let val = parseInt(document.getElementById('grid-size-input').value);
    if (isNaN(val) || val < 1) val = 1;
    document.getElementById('grid-size-input').value = val;
    app.gridSize = val;
    if (app.showMargins) renderWorkspace();
}

function getActiveColour() {
    return app.colour; 
}

function setPenShape(shape) {
    app.penShape = shape;
    document.getElementById('pen-shape-square').classList.toggle('active', shape === 'square');
    document.getElementById('pen-shape-circle').classList.toggle('active', shape === 'circle');
}

function setShapeType(type) {
    app.shapeType = type;
    document.getElementById('shape-type-rect').classList.toggle('active', type === 'rectangle');
    document.getElementById('shape-type-ellipse').classList.toggle('active', type === 'ellipse');
}

function setShapeFill(fill) {
    app.shapeFill = fill;
    document.getElementById('shape-fill-hollow').classList.toggle('active', fill === 'hollow');
    document.getElementById('shape-fill-filled').classList.toggle('active', fill === 'filled');
}

function updatePatternPreview() {
    const pCanvas = document.getElementById('pattern-preview');
    pCanvas.width = app.brushPatternWidth;
    pCanvas.height = app.brushPatternHeight;
    const pCtx = pCanvas.getContext('2d');
    pCtx.clearRect(0,0, app.brushPatternWidth, app.brushPatternHeight);
    for(let y = 0; y < app.brushPatternHeight; y++){
        for(let x = 0; x < app.brushPatternWidth; x++){
            const alpha = app.brushPattern[y * app.brushPatternWidth + x];
            if(alpha > 0) {
                pCtx.fillStyle = `rgba(255, 255, 255, ${alpha / 255})`;
                pCtx.fillRect(x, y, 1, 1);
            }
        }
    }
}

function createFallbackPattern() {
    app.brushPatternWidth = 16;
    app.brushPatternHeight = 16;
    app.brushPattern = new Uint8Array(256);
    for(let i=0; i<256; i++){
        let x = i % 16;
        let y = Math.floor(i / 16);
        if ((x + y) % 2 === 0) app.brushPattern[i] = 255;
    }
    updatePatternPreview();
}

function loadBrushFromUrl(url, index = -1) {
    const img = new Image();
    img.crossOrigin = "Anonymous"; 
    img.onload = () => {
        if ([16, 32, 64].includes(img.width) && [16, 32, 64].includes(img.height)) {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, img.width, img.height).data;
            
            app.brushPatternWidth = img.width;
            app.brushPatternHeight = img.height;
            app.brushPattern = new Uint8Array(img.width * img.height);
            
            for (let i = 0; i < imgData.length; i += 4) {
                app.brushPattern[i / 4] = imgData[i + 3];
            }
            updatePatternPreview();
            app.activeBrushIndex = index;
            renderBrushPresets();
        } else {
            createFallbackPattern();
        }
    };
    img.onerror = () => createFallbackPattern();
    img.src = url;
}

function renderBrushPresets() {
    const container = document.getElementById('brush-presets');
    if (!container) return;
    container.innerHTML = '';
    app.brushPresets.forEach((preset, i) => {
        const btn = document.createElement('button');
        btn.className = `brush-preset-btn ${i === app.activeBrushIndex ? 'active' : ''}`;
        btn.title = preset.name;
        btn.onclick = () => loadBrushFromUrl(preset.src, i);
        
        const img = document.createElement('img');
        img.src = preset.src;
        
        btn.appendChild(img);
        container.appendChild(btn);
    });
}

function loadBrushPattern(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            if (![16, 32, 64].includes(img.width) || ![16, 32, 64].includes(img.height)) {
                alert("Pattern must be exactly 16x16, 32x32, or 64x64 pixels.");
                return;
            }
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, img.width, img.height).data;
            
            app.brushPatternWidth = img.width;
            app.brushPatternHeight = img.height;
            app.brushPattern = new Uint8Array(img.width * img.height);
            
            for (let i = 0; i < imgData.length; i += 4) {
                app.brushPattern[i / 4] = imgData[i + 3]; 
            }
            updatePatternPreview();
            app.activeBrushIndex = -1; 
            renderBrushPresets();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

function clearSelection() {
    commitSelection();
    app.selection = null;
    app.selectState = 'idle';
}

function commitSelection() {
    if (app.floatingData) {
        const project = app.activeProject;
        app.floatingData.forEach(fObj => {
            fObj.targetLayer.ctx.imageSmoothingEnabled = false;
            fObj.targetLayer.ctx.drawImage(
                fObj.patchCanvas,
                app.selection.x,
                app.selection.y,
                app.selection.w,
                app.selection.h
            );
        });
        app.floatingData = null;
        project.pushState();
    }
}

function pickupSelection() {
    if (!app.selection || app.floatingData) return;
    const project = app.activeProject;
    const allLayers = allLayersSelectCheckbox.checked;
    const targetLayers = allLayers ? project.layers.filter(l => l.visible) : [project.activeLayer];

    app.floatingData = targetLayers.map(layer => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = project.width;
        tempCanvas.height = project.height;
        tempCanvas.getContext('2d').drawImage(layer.canvas, 0, 0);

        const patchCanvas = document.createElement('canvas');
        patchCanvas.width = app.selection.w;
        patchCanvas.height = app.selection.h;
        const pCtx = patchCanvas.getContext('2d');
        pCtx.imageSmoothingEnabled = false;
        pCtx.drawImage(layer.canvas, app.selection.x, app.selection.y, app.selection.w, app.selection.h, 0, 0, app.selection.w, app.selection.h);

        layer.ctx.clearRect(app.selection.x, app.selection.y, app.selection.w, app.selection.h);

        return { tempCanvas, patchCanvas, targetLayer: layer, origX: app.selection.x, origY: app.selection.y, origW: app.selection.w, origH: app.selection.h };
    });
}

function renderFramePanel() {
    const project = app.activeProject;
    const frameList = document.getElementById('frame-list');
    if (!project || !frameList) return;
    frameList.innerHTML = '';
    
    project.frames.forEach((frame, i) => {
        const btn = document.createElement('div');
        btn.className = `frame-item ${i === project.activeFrameIndex ? 'active' : ''}`;
        btn.innerText = i + 1;
        btn.onclick = () => {
            if (project.activeFrameIndex !== i) {
                clearSelection();
                project.activeFrameIndex = i;
                renderWorkspace();
                renderLayerPanel();
                renderFramePanel();
            }
        };
        frameList.appendChild(btn);
    });
}

function addFrame() {
    const project = app.activeProject;
    if (!project) return;
    clearSelection();
    
    const newFrame = new Frame(project.width, project.height);
    
    project.frames.push(newFrame);
    project.activeFrameIndex = project.frames.length - 1;
    
    renderWorkspace();
    renderLayerPanel();
    renderFramePanel();
    project.pushState();
}

function duplicateFrame() {
    const project = app.activeProject;
    if (!project) return;
    clearSelection();
    
    const currentFrame = project.activeFrame;
    const newFrame = new Frame(project.width, project.height);
    
    newFrame.layers = currentFrame.layers.map(l => {
        const nl = new Layer(project.width, project.height, l.name);
        nl.visible = l.visible;
        nl.opacity = l.opacity;
        nl.ctx.drawImage(l.canvas, 0, 0); 
        return nl;
    });
    newFrame.activeLayerIndex = currentFrame.activeLayerIndex;
    
    project.frames.splice(project.activeFrameIndex + 1, 0, newFrame);
    project.activeFrameIndex++;
    
    renderWorkspace();
    renderLayerPanel();
    renderFramePanel();
    project.pushState();
}

function deleteFrame() {
    const project = app.activeProject;
    if (!project || project.frames.length <= 1) return;
    clearSelection();
    
    project.frames.splice(project.activeFrameIndex, 1);
    if (project.activeFrameIndex >= project.frames.length) {
        project.activeFrameIndex = project.frames.length - 1;
    }
    
    renderWorkspace();
    renderLayerPanel();
    renderFramePanel();
    project.pushState();
}

function togglePlay() {
    const project = app.activeProject;
    if (!project) return;
    const playBtn = document.getElementById('play-btn');
    
    app.isPlaying = !app.isPlaying;
    if (app.isPlaying) {
        playBtn.innerText = "⏸ Pause";
        playBtn.classList.add('active');
        playBtn.style.color = "var(--syntax-orange)";
        app.fps = parseInt(document.getElementById('fps-input').value) || 8;
        
        app.playTimer = setInterval(() => {
            project.activeFrameIndex = (project.activeFrameIndex + 1) % project.frames.length;
            clearSelection();
            renderWorkspace();
            renderFramePanel();
            renderLayerPanel();
        }, 1000 / app.fps);
    } else {
        playBtn.innerText = "▶ Play";
        playBtn.classList.remove('active');
        playBtn.style.color = "var(--syntax-green)";
        clearInterval(app.playTimer);
    }
}

function renderLayerPanel() {
    const project = app.activeProject;
    if (!project) return;
    layerList.innerHTML = '';
    for (let i = project.layers.length - 1; i >= 0; i--) {
        const layer = project.layers[i];
        const item = document.createElement('div');
        item.className = `layer-item ${i === project.activeLayerIndex ? 'active' : ''}`;
        item.onclick = (e) => {
            if (!e.target.closest('.layer-btn') && !e.target.closest('.layer-name-input') && !e.target.closest('.layer-opacity-input')) {
                if (project.activeLayerIndex !== i) {
                    clearSelection();
                    project.activeLayerIndex = i;
                    renderLayerPanel();
                }
            }
        };
        const nameSpan = document.createElement('span');
        nameSpan.innerText = layer.name;
        nameSpan.style.flexGrow = '1';
        nameSpan.style.overflow = 'hidden';
        nameSpan.style.textOverflow = 'ellipsis';
        nameSpan.style.whiteSpace = 'nowrap';
        nameSpan.title = "Double-click to rename";
        nameSpan.ondblclick = () => {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'layer-name-input';
            input.value = layer.name;
            const saveRename = () => {
                const newName = input.value.trim();
                if (newName) {
                    layer.name = newName;
                }
                renderLayerPanel();
            };
            input.onblur = saveRename;
            input.onkeydown = (ev) => {
                if (ev.key === 'Enter') {
                    saveRename();
                } else if (ev.key === 'Escape') {
                    renderLayerPanel();
                }
            };
            nameSpan.replaceWith(input);
            input.focus();
            input.select();
        };
        const controlsDiv = document.createElement('div');
        controlsDiv.style.display = 'flex';
        controlsDiv.style.gap = '2px';
        controlsDiv.style.flexShrink = '0';
        controlsDiv.style.alignItems = 'center';
        const opacityInput = document.createElement('input');
        opacityInput.type = 'number';
        opacityInput.className = 'layer-opacity-input';
        opacityInput.min = '0';
        opacityInput.max = '100';
        opacityInput.title = 'Layer Opacity %';
        opacityInput.value = Math.round((layer.opacity !== undefined ? layer.opacity : 1) * 100);
        opacityInput.onclick = (e) => e.stopPropagation();
        opacityInput.onchange = (e) => {
            let val = parseInt(e.target.value);
            if (isNaN(val)) val = 100;
            val = Math.max(0, Math.min(100, val));
            e.target.value = val;
            project.frames.forEach(f => f.layers[i].opacity = val / 100);
            renderWorkspace();
            project.pushState();
        };
        const upBtn = document.createElement('button');
        upBtn.className = 'layer-btn';
        upBtn.innerText = '▲';
        upBtn.title = 'Move Up';
        if (i === project.layers.length - 1) {
            upBtn.style.opacity = '0.3';
            upBtn.style.cursor = 'default';
        } else {
            upBtn.onclick = (e) => {
                e.stopPropagation();
                clearSelection();
                const temp = project.layers[i];
                project.layers[i] = project.layers[i + 1];
                project.layers[i + 1] = temp;
                if (project.activeLayerIndex === i) project.activeLayerIndex = i + 1;
                else if (project.activeLayerIndex === i + 1) project.activeLayerIndex = i;
                renderWorkspace();
                renderLayerPanel();
                project.pushState();
            };
        }
        const downBtn = document.createElement('button');
        downBtn.className = 'layer-btn';
        downBtn.innerText = '▼';
        downBtn.title = 'Move Down';
        if (i === 0) {
            downBtn.style.opacity = '0.3';
            downBtn.style.cursor = 'default';
        } else {
            downBtn.onclick = (e) => {
                e.stopPropagation();
                clearSelection();
                const temp = project.layers[i];
                project.layers[i] = project.layers[i - 1];
                project.layers[i - 1] = temp;
                if (project.activeLayerIndex === i) project.activeLayerIndex = i - 1;
                else if (project.activeLayerIndex === i - 1) project.activeLayerIndex = i;
                renderWorkspace();
                renderLayerPanel();
                project.pushState();
            };
        }
        const cloneBtn = document.createElement('button');
        cloneBtn.className = 'layer-btn';
        cloneBtn.innerText = '⧉';
        cloneBtn.title = 'Clone Layer';
        cloneBtn.onclick = (e) => {
            e.stopPropagation();
            clearSelection();
            const newLayer = new Layer(project.width, project.height, layer.name + " (Copy)");
            newLayer.visible = layer.visible;
            newLayer.opacity = layer.opacity !== undefined ? layer.opacity : 1;
            newLayer.ctx.drawImage(layer.canvas, 0, 0);
            project.layers.splice(i + 1, 0, newLayer);
            project.activeLayerIndex = i + 1;
            renderWorkspace();
            renderLayerPanel();
            project.pushState();
        };
        const renameBtn = document.createElement('button');
        renameBtn.className = 'layer-btn';
        renameBtn.innerText = '✎';
        renameBtn.title = 'Rename Layer';
        renameBtn.onclick = (e) => {
            e.stopPropagation();
            nameSpan.ondblclick();
        }
        const visBtn = document.createElement('button');
        visBtn.className = 'layer-btn';
        visBtn.innerText = layer.visible ? '👁' : '✖';
        visBtn.title = 'Toggle Visibility';
        visBtn.onclick = (e) => {
            e.stopPropagation();
            layer.visible = !layer.visible;
            renderWorkspace();
            renderLayerPanel();
        };
        const delBtn = document.createElement('button');
        delBtn.className = 'layer-btn';
        delBtn.innerText = '🗑';
        delBtn.title = 'Delete Layer';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            if (project.layers.length > 1) {
                clearSelection();
                project.layers.splice(i, 1);
                if (project.activeLayerIndex >= project.layers.length) {
                    project.activeLayerIndex = project.layers.length - 1;
                }
                renderWorkspace();
                renderLayerPanel();
                project.pushState();
            }
        };
        controlsDiv.appendChild(opacityInput);
        controlsDiv.appendChild(upBtn);
        controlsDiv.appendChild(downBtn);
        controlsDiv.appendChild(cloneBtn);
        controlsDiv.appendChild(renameBtn);
        controlsDiv.appendChild(visBtn);
        if (project.layers.length > 1) controlsDiv.appendChild(delBtn);
        item.appendChild(nameSpan);
        item.appendChild(controlsDiv);
        layerList.appendChild(item);
    }
}

function addLayer() {
    const project = app.activeProject;
    if (!project) return;
    clearSelection();
    const name = `Layer ${project.layers.length + 1}`;
    const newLayer = new Layer(project.width, project.height, name);
    project.layers.push(newLayer);
    project.activeLayerIndex = project.layers.length - 1;
    renderWorkspace();
    renderLayerPanel();
    project.pushState();
}

function createFloatingPatchDOM(sourceCanvas, x, y, w, h) {
    const patch = document.createElement('canvas');
    patch.width = sourceCanvas.width;
    patch.height = sourceCanvas.height;
    patch.getContext('2d').drawImage(sourceCanvas, 0, 0);
    patch.className = 'floating-patch';
    patch.style.width = `${w * app.zoom}px`;
    patch.style.height = `${h * app.zoom}px`;
    patch.style.left = `${x * app.zoom}px`;
    patch.style.top = `${y * app.zoom}px`;
    return patch;
}

function createMarqueeDOM(x, y, w, h) {
    const marquee = document.createElement('div');
    marquee.className = 'selection-marquee';
    marquee.style.left = `${x * app.zoom}px`;
    marquee.style.top = `${y * app.zoom}px`;
    marquee.style.width = `${w * app.zoom}px`;
    marquee.style.height = `${h * app.zoom}px`;
    if (app.selectState === 'selected' || app.selectState === 'resizing') {
        ['nw', 'ne', 'sw', 'se'].forEach(pos => {
            const handle = document.createElement('div');
            handle.className = `resize-handle handle-${pos}`;
            marquee.appendChild(handle);
        });
    }
    return marquee;
}

function renderWorkspace() {
    const project = app.activeProject;
    if (!project) return;
    const mult = app.atlasMode ? 3 : 1;
    const targetW = project.width * mult;
    const targetH = project.height * mult;
    if (app.zoomFit) {
        const availableW = canvasContainer.clientWidth - 80;
        const availableH = canvasContainer.clientHeight - 80;
        const scaleW = availableW / targetW;
        const scaleH = availableH / targetH;
        app.zoom = Math.max(1, Math.min(scaleW, scaleH));
    }
    workspace.style.width = `${targetW * app.zoom}px`;
    workspace.style.height = `${targetH * app.zoom}px`;
    const checkerSize = app.zoom * 2;
    workspace.style.backgroundSize = `${checkerSize}px ${checkerSize}px`;
    workspace.style.backgroundPosition = `0 0, 0 ${app.zoom}px, ${app.zoom}px ${app.zoom}px, ${app.zoom}px 0`;
    workspace.innerHTML = '';
    
    project.layers.forEach((layer, i) => {
        if (app.atlasMode) {
            const atlasCanvas = document.createElement('canvas');
            atlasCanvas.width = targetW;
            atlasCanvas.height = targetH;
            atlasCanvas.className = 'sprite-layer';
            atlasCanvas.style.display = layer.visible ? 'block' : 'none';
            const aCtx = atlasCanvas.getContext('2d');
            aCtx.imageSmoothingEnabled = false;
            aCtx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1;
            for (let x = 0; x < 3; x++) {
                for (let y = 0; y < 3; y++) {
                    aCtx.drawImage(layer.canvas, x * project.width, y * project.height);
                }
            }
            workspace.appendChild(atlasCanvas);
            
            if (app.isDrawing && i === project.activeLayerIndex && ['pen', 'brush', 'line', 'curve', 'shape'].includes(app.tool)) {
                const strokeAtlas = document.createElement('canvas');
                strokeAtlas.width = targetW;
                strokeAtlas.height = targetH;
                strokeAtlas.className = 'sprite-layer';
                const saCtx = strokeAtlas.getContext('2d');
                saCtx.imageSmoothingEnabled = false;
                saCtx.globalAlpha = app.toolOpacity / 100;
                for (let x = 0; x < 3; x++) {
                    for (let y = 0; y < 3; y++) {
                        saCtx.drawImage(app.strokeCanvas, x * project.width, y * project.height);
                    }
                }
                workspace.appendChild(strokeAtlas);
            }

        } else {
            layer.canvas.style.opacity = layer.opacity !== undefined ? layer.opacity : 1;
            workspace.appendChild(layer.canvas);
            layer.canvas.style.display = layer.visible ? 'block' : 'none';
            
            if (app.isDrawing && i === project.activeLayerIndex && ['pen', 'brush', 'line', 'curve', 'shape'].includes(app.tool)) {
                const strokeOverlay = document.createElement('canvas');
                strokeOverlay.width = project.width;
                strokeOverlay.height = project.height;
                strokeOverlay.className = 'sprite-layer';
                strokeOverlay.style.opacity = app.toolOpacity / 100;
                const soCtx = strokeOverlay.getContext('2d');
                soCtx.imageSmoothingEnabled = false;
                soCtx.drawImage(app.strokeCanvas, 0, 0);
                workspace.appendChild(strokeOverlay);
            }
        }
    });

    if (app.showMargins && app.zoom * app.gridSize >= 2) {
        const gridOverlay = document.createElement('div');
        gridOverlay.className = 'sprite-layer';
        gridOverlay.style.zIndex = '990';
        gridOverlay.style.backgroundImage = `
            linear-gradient(to right, rgba(255, 255, 255, 0.15) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.15) 1px, transparent 1px)
        `;
        gridOverlay.style.backgroundSize = `${app.zoom * app.gridSize}px ${app.zoom * app.gridSize}px`;
        workspace.appendChild(gridOverlay);
    }
    if (app.atlasMode) {
        const atlasPreviewCanvas = document.createElement('canvas');
        atlasPreviewCanvas.width = targetW;
        atlasPreviewCanvas.height = targetH;
        atlasPreviewCanvas.className = 'sprite-layer';
        atlasPreviewCanvas.id = 'preview-layer';
        const apCtx = atlasPreviewCanvas.getContext('2d');
        apCtx.imageSmoothingEnabled = false;
        apCtx.globalAlpha = app.toolOpacity / 100;
        for (let x = 0; x < 3; x++) {
            for (let y = 0; y < 3; y++) {
                apCtx.drawImage(previewCanvas, x * project.width, y * project.height);
            }
        }
        workspace.appendChild(atlasPreviewCanvas);
    } else {
        previewCanvas.style.opacity = app.toolOpacity / 100;
        workspace.appendChild(previewCanvas);
    }
    if (app.floatingData) {
        app.floatingData.forEach(fObj => {
            for (let mx = 0; mx < mult; mx++) {
                for (let my = 0; my < mult; my++) {
                    const px = app.selection.x + (mx * project.width);
                    const py = app.selection.y + (my * project.height);
                    workspace.appendChild(createFloatingPatchDOM(fObj.patchCanvas, px, py, app.selection.w, app.selection.h));
                }
            }
        });
    }
    if (app.selection && app.selection.w > 0 && app.selection.h > 0) {
        for (let mx = 0; mx < mult; mx++) {
            for (let my = 0; my < mult; my++) {
                const px = app.selection.x + (mx * project.width);
                const py = app.selection.y + (my * project.height);
                workspace.appendChild(createMarqueeDOM(px, py, app.selection.w, app.selection.h));
            }
        }
    }
}

function init() {
    try {
        const saved = localStorage.getItem('l_sprite_saved_colours');
        if (saved) app.savedColours = JSON.parse(saved);
        else throw new Error("No saved colours");
    } catch (e) {
        app.savedColours = [
            '#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8',
            '#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA'
        ];
    }
    renderSavedColours();

    renderBrushPresets();
    if (app.brushPresets.length > 0) {
        loadBrushFromUrl(app.brushPresets[0].src, 0);
    } else {
        createFallbackPattern();
    }

    const defaultProject = new SpriteProject(32, 32, "Project 1");
    app.projects.push(defaultProject);
    app.activeProjectIndex = 0;
    
    app.strokeCanvas.width = defaultProject.width;
    app.strokeCanvas.height = defaultProject.height;

    previewCanvas.width = defaultProject.width;
    previewCanvas.height = defaultProject.height;
    gridWInput.value = defaultProject.width;
    gridHInput.value = defaultProject.height;

    document.getElementById('tool-size').addEventListener('input', (e) => {
        app.toolSize = parseInt(e.target.value);
        document.getElementById('tool-size-input').value = app.toolSize;
    });
    
    document.getElementById('tool-size-input').addEventListener('input', (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val) || val < 1) val = 1;
        if (val > 64) val = 64;
        app.toolSize = val;
        document.getElementById('tool-size').value = app.toolSize;
    });
    
    document.getElementById('tool-opacity').addEventListener('input', (e) => {
        app.toolOpacity = parseInt(e.target.value);
        document.getElementById('tool-opacity-label').innerText = app.toolOpacity + '%';
    });
    
    document.getElementById('tool-flow').addEventListener('input', (e) => {
        app.toolFlow = parseInt(e.target.value);
        document.getElementById('tool-flow-label').innerText = app.toolFlow + '%';
    });
    
    document.getElementById('jitter-scatter').addEventListener('input', (e) => {
        app.scatter = parseInt(e.target.value);
        document.getElementById('jitter-scatter-label').innerText = app.scatter + '%';
    });
    
    document.getElementById('jitter-size').addEventListener('input', (e) => {
        app.sizeJitter = parseInt(e.target.value);
        document.getElementById('jitter-size-label').innerText = app.sizeJitter + '%';
    });
    
    document.getElementById('jitter-opacity').addEventListener('input', (e) => {
        app.opacityJitter = parseInt(e.target.value);
        document.getElementById('jitter-opacity-label').innerText = app.opacityJitter + '%';
    });
    
    document.getElementById('jitter-colour').addEventListener('input', (e) => {
        app.colourJitter = parseInt(e.target.value);
        document.getElementById('jitter-colour-label').innerText = app.colourJitter + '%';
    });

    document.getElementById('fill-diagonals').addEventListener('change', (e) => {
    app.fillDiagonals = e.target.checked;
    });

    brushSpacingSlider.addEventListener('input', (e) => {
        app.brushSpacing = parseInt(e.target.value);
        brushSpacingLabel.innerText = app.brushSpacing + '%';
    });

    window.addEventListener('resize', () => {
        if (app.zoomFit) renderWorkspace();
    });

    renderWorkspace();
    renderFramePanel();
    renderLayerPanel();
    app.activeProject.pushState();
}

function setCanvasSize(w, h) {
    const project = app.activeProject;
    if (!project) return;
    clearSelection();
    const newW = parseInt(w);
    const newH = parseInt(h);
    if (newW === project.width && newH === project.height) return;
    const oldW = project.width;
    const oldH = project.height;
    project.width = newW;
    project.height = newH;
    gridWInput.value = project.width;
    gridHInput.value = project.height;
    app.strokeCanvas.width = newW;
    app.strokeCanvas.height = newH;
    const offsetX = Math.floor((newW - oldW) / 2);
    const offsetY = Math.floor((newH - oldH) / 2);
    project.frames.forEach(frame => {
        frame.layers.forEach(layer => {
            const oldCanvas = document.createElement('canvas');
            oldCanvas.width = oldW;
            oldCanvas.height = oldH;
            oldCanvas.getContext('2d').drawImage(layer.canvas, 0, 0);
            layer.canvas.width = project.width;
            layer.canvas.height = project.height;
            layer.ctx.imageSmoothingEnabled = false;
            layer.ctx.drawImage(oldCanvas, offsetX, offsetY);
        });
    });
    previewCanvas.width = newW;
    previewCanvas.height = newH;
    renderWorkspace();
    renderLayerPanel();
    project.pushState();
    updateExportPreview();
}

function applyCustomSize() {
    if(aspectLockCheckbox.checked) {
        setCanvasSize(gridWInput.value, gridWInput.value);
    } else {
        setCanvasSize(gridWInput.value, gridHInput.value);
    }
}

function updateActiveSwatches() {
    document.querySelectorAll('.colour-swatch').forEach(s => {
        if (s.dataset.colour && s.dataset.colour.toUpperCase() === app.colour.toUpperCase()) {
            s.classList.add('active');
        } else {
            s.classList.remove('active');
        }
    });
}

function setColour(hex) {
    app.colour = hex.toUpperCase();
    colourWheel.value = app.colour;
    hexInput.value = app.colour;
    updateActiveSwatches();
    if (app.tool === 'eraser') setTool('pen');
}

function saveCurrentColour() {
    const hex = app.colour.toUpperCase();
    if (!app.savedColours.includes(hex)) {
        app.savedColours.push(hex);
        localStorage.setItem('l_sprite_saved_colours', JSON.stringify(app.savedColours));
        renderSavedColours();
    }
}

function renderSavedColours() {
    paletteGrid.innerHTML = '';
    app.savedColours.forEach((hex, index) => {
        const swatch = document.createElement('div');
        const isActive = (app.colour === hex) ? 'active' : '';
        swatch.className = `colour-swatch ${isActive}`;
        swatch.style.background = hex;
        swatch.dataset.colour = hex;
        swatch.title = hex;
        swatch.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            app.savedColours.splice(index, 1);
            localStorage.setItem('l_sprite_saved_colours', JSON.stringify(app.savedColours));
            renderSavedColours();
        });
        paletteGrid.appendChild(swatch);
    });
}

function addRecentColour(hex) {
    hex = hex.toUpperCase();
    app.recentColours = app.recentColours.filter(c => c !== hex);
    app.recentColours.unshift(hex);
    if (app.recentColours.length > 6) app.recentColours.pop();
    const recentGrid = document.getElementById('recent-palette');
    recentGrid.innerHTML = '';
    for (let i = 0; i < 6; i++) {
        if (i < app.recentColours.length) {
            const cHex = app.recentColours[i];
            const isActive = (app.colour === cHex) ? 'active' : '';
            recentGrid.innerHTML += `<div class="colour-swatch ${isActive}" style="background: ${cHex};" data-colour="${cHex}"></div>`;
        } else {
            recentGrid.innerHTML += `<div class="colour-swatch recent-empty"></div>`;
        }
    }
}

colourWheel.addEventListener('input', (e) => setColour(e.target.value));
colourWheel.addEventListener('change', (e) => addRecentColour(e.target.value));

hexInput.addEventListener('change', (e) => {
    let val = e.target.value.trim();
    if (!val.startsWith('#')) val = '#' + val;
    if (/^#[0-9A-F]{6}$/i.test(val)) {
        setColour(val);
        addRecentColour(val);
    } else {
        hexInput.value = app.colour;
    }
});

function handleSwatchClick(e) {
    const swatch = e.target.closest('.colour-swatch');
    if (!swatch || !swatch.dataset.colour) return;
    setColour(swatch.dataset.colour);
    addRecentColour(swatch.dataset.colour);
}

paletteGrid.addEventListener('click', handleSwatchClick);
document.getElementById('recent-palette').addEventListener('click', handleSwatchClick);

function setTool(toolName) {
    clearSelection();
    renderWorkspace();
    app.tool = toolName;
    if (toolName === 'pan') {
        canvasContainer.style.cursor = 'grab';
    } else {
        canvasContainer.style.cursor = '';
    }
    if (toolName !== 'line' && toolName !== 'shape') app.lineStart = null;
    if (toolName !== 'curve') {
        app.curveStart = null;
        app.curveEnd = null;
    }
    if (toolName !== 'shape') app.shapeStart = null;
    drawToolBtns.forEach(b => {
        if (b.dataset.tool === toolName) b.classList.add('active');
        else b.classList.remove('active');
    });
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    
    document.getElementById('selection-settings').style.display = (toolName === 'select') ? 'block' : 'none';
    document.getElementById('pen-settings').style.display = (toolName === 'pen' || toolName === 'eraser') ? 'block' : 'none';
    document.getElementById('pattern-settings').style.display = (toolName === 'brush') ? 'block' : 'none';
    document.getElementById('shape-settings').style.display = (toolName === 'shape') ? 'block' : 'none';
    document.getElementById('fill-settings').style.display = (toolName === 'fill') ? 'block' : 'none';
    document.getElementById('brush-dynamics-section').style.display = (toolName === 'brush') ? 'block' : 'none';
}

function triggerAction(actionName) {
    const project = app.activeProject;
    if (!project) return;
    if (actionName === 'clear') {
        clearSelection();
        const w = project.width;
        const h = project.height;
        project.frames = [new Frame(w, h)];
        project.activeFrameIndex = 0;
        renderWorkspace();
        renderLayerPanel();
        renderFramePanel();
        project.pushState();
    } else if (actionName === 'undo') {
        clearSelection();
        project.undo();
    } else if (actionName === 'redo') {
        clearSelection();
        project.redo();
    } else if (actionName === 'zoom-in') {
        app.zoomFit = false;
        app.zoom *= 1.25;
        if (app.zoom > 100) app.zoom = 100;
        renderWorkspace();
    } else if (actionName === 'zoom-out') {
        app.zoomFit = false;
        app.zoom /= 1.25;
        if (app.zoom < 0.25) app.zoom = 0.25;
        renderWorkspace();
    } else if (actionName === 'zoom-reset') {
        app.zoomFit = false;
        app.zoom = 1;
        renderWorkspace();
    } else if (actionName === 'zoom-fit') {
        app.zoomFit = true;
        renderWorkspace();
    }
}

drawToolBtns.forEach(btn => btn.addEventListener('click', () => setTool(btn.dataset.tool)));
actionBtns.forEach(btn => btn.addEventListener('click', () => triggerAction(btn.dataset.action)));

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT' && document.activeElement.type !== 'number') {
        if (!app.isSpacePanning && !app.isPanning) {
            app.isSpacePanning = true;
            canvasContainer.style.cursor = 'grab';
        }
        e.preventDefault(); 
        return;
    }
    if (e.key === 'Enter') {
        commitSelection();
        clearSelection();
        renderWorkspace();
        return;
    }
    if (e.key === 'Escape') {
        if (app.floatingData) {
            const project = app.activeProject;
            app.floatingData.forEach(fObj => {
                fObj.targetLayer.ctx.clearRect(0, 0, project.width, project.height);
                fObj.targetLayer.ctx.drawImage(fObj.tempCanvas, 0, 0);
            });
            app.floatingData = null;
        }
        clearSelection();
        renderWorkspace();
        if (document.getElementById('export-modal').style.display === 'flex') {
            closeExportMenu();
        }
        return;
    }
    if (['INPUT'].includes(document.activeElement.tagName)) return;
    
    if (e.key === '[' || e.key === ']') {
        app.toolSize = e.key === '[' ? Math.max(1, app.toolSize - 1) : Math.min(64, app.toolSize + 1);
        document.getElementById('tool-size').value = app.toolSize;
        document.getElementById('tool-size-input').value = app.toolSize;
        if (app.lastGridX !== undefined && app.lastGridY !== undefined) {
            updatePreview(app.lastGridX, app.lastGridY);
        }
        e.preventDefault();
        return;
    }

    const project = app.activeProject;

    if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') {
            clearSelection();
            if (e.shiftKey) project?.redo();
            else project?.undo();
            e.preventDefault();
            return;
        }
        if (e.key.toLowerCase() === 'y') {
            clearSelection();
            project?.redo();
            e.preventDefault();
            return;
        }
        if (e.key === '=' || e.key === '+') {
            triggerAction('zoom-in');
            e.preventDefault(); return;
        }
        if (e.key === '-') {
            triggerAction('zoom-out');
            e.preventDefault(); return;
        }
        if (e.key === '0') {
            triggerAction('zoom-fit');
            e.preventDefault(); return;
        }
        if (e.key === '1') {
            triggerAction('zoom-reset');
            e.preventDefault(); return;
        }
    }
    if (e.key.toLowerCase() === 'p') setTool('pen');
    if (e.key.toLowerCase() === 'b') setTool('brush');
    if (e.key.toLowerCase() === 'e') setTool('eraser');
    if (e.key.toLowerCase() === 'f') setTool('fill');
    if (e.key.toLowerCase() === 'i') setTool('eyedropper');
    if (e.key.toLowerCase() === 'l') setTool('line');
    if (e.key.toLowerCase() === 'c') setTool('curve');
    if (e.key.toLowerCase() === 'u') setTool('shape');
    if (e.key.toLowerCase() === 's') setTool('select');
    if (e.key.toLowerCase() === 'h') setTool('pan');
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        app.isSpacePanning = false;
        if (!app.isPanning) {
            canvasContainer.style.cursor = app.tool === 'pan' ? 'grab' : '';
        }
    }
});

canvasContainer.addEventListener('mousedown', (e) => {
    if (e.button === 1 || app.tool === 'pan' || app.isSpacePanning) {
        app.isPanning = true;
        app.panStart = { x: e.clientX, y: e.clientY };
        app.scrollStart = { x: canvasContainer.scrollLeft, y: canvasContainer.scrollTop };
        canvasContainer.style.cursor = 'grabbing';
        e.preventDefault(); 
    }
});

canvasContainer.addEventListener('wheel', (e) => {
    if (!['pen', 'brush', 'eraser', 'shape', 'line', 'curve'].includes(app.tool)) return;
    e.preventDefault();
    if (e.deltaY > 0) {
        app.toolSize = Math.max(1, app.toolSize - 1);
    } else {
        app.toolSize = Math.min(64, app.toolSize + 1);
    }
    document.getElementById('tool-size').value = app.toolSize;
    document.getElementById('tool-size-input').value = app.toolSize;
    if (app.lastGridX !== undefined && app.lastGridY !== undefined) {
        updatePreview(app.lastGridX, app.lastGridY);
    }
}, { passive: false });

window.addEventListener('mousemove', (e) => {
    if (app.isPanning) {
        const dx = e.clientX - app.panStart.x;
        const dy = e.clientY - app.panStart.y;
        canvasContainer.scrollLeft = app.scrollStart.x - dx;
        canvasContainer.scrollTop = app.scrollStart.y - dy;
    }
    if (!isResizing) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth > 200 && newWidth < 600) {
        rightPanel.style.width = `${newWidth}px`;
    }
});

window.addEventListener('mouseup', () => {
    if (app.isPanning) {
        app.isPanning = false;
        canvasContainer.style.cursor = (app.tool === 'pan' || app.isSpacePanning) ? 'grab' : '';
    }
    if (isResizing) {
        isResizing = false;
        resizer.classList.remove('active');
        document.body.style.cursor = '';
        if (app.zoomFit) renderWorkspace();
    }
});

function getGridCoordinates(e) {
    const rect = workspace.getBoundingClientRect();
    const project = app.activeProject;
    const mult = app.atlasMode ? 3 : 1;
    const scaleX = (project.width * mult) / rect.width;
    const scaleY = (project.height * mult) / rect.height;
    const renderX = Math.floor((e.clientX - rect.left) * scaleX);
    const renderY = Math.floor((e.clientY - rect.top) * scaleY);
    const x = renderX % project.width;
    const y = renderY % project.height;
    return { x, y };
}

function applyPixel(ctx, px, py, isPreview, patternAlphaMult = 1, customFlow = null, customColour = null) {
    const project = app.activeProject;
    const flow = customFlow !== null ? customFlow : app.toolFlow;
    const finalAlpha = (flow / 100) * patternAlphaMult;
    
    if (finalAlpha <= 0) return;

    if (app.tool === 'eraser') {
        if (finalAlpha >= 1) {
            ctx.clearRect(px, py, 1, 1);
        } else {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = `rgba(0,0,0,${finalAlpha})`;
            ctx.fillRect(px, py, 1, 1);
            ctx.globalCompositeOperation = 'source-over';
        }
    } else {
        const rgb = hexToRgba(customColour || app.colour);
        ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${finalAlpha})`;
        ctx.fillRect(px, py, 1, 1);
    }
}

function drawShape(ctx, x0, y0, x1, y1, size, isLine) {
    const project = app.activeProject;
    const isPreview = (ctx === previewCtx);
    let tempStampPos = isPreview ? null : app.lastStampPos;

    const applyStamp = (cx, cy) => {
        let stampX = cx;
        let stampY = cy;
        let stampSize = size;
        let stampFlow = app.toolFlow;
        let stampColour = app.colour;

        if (app.scatter > 0 || app.sizeJitter > 0 || app.opacityJitter > 0 || app.colourJitter > 0) {
            if (app.scatter > 0) {
                const spread = (size * 2) * (app.scatter / 100);
                stampX += Math.round((Math.random() - 0.5) * spread);
                stampY += Math.round((Math.random() - 0.5) * spread);
            }
            if (app.sizeJitter > 0) {
                const shrink = size * (app.sizeJitter / 100) * Math.random();
                stampSize = Math.max(1, Math.round(size - shrink));
            }
            if (app.opacityJitter > 0) {
                stampFlow = Math.max(0, stampFlow - stampFlow * (app.opacityJitter / 100) * Math.random());
            }
            if (app.colourJitter > 0) {
                const rgb = hexToRgba(stampColour);
                const shift = (app.colourJitter / 100) * 100; 
                const r = Math.max(0, Math.min(255, Math.round(rgb[0] + (Math.random()-0.5)*shift*2)));
                const g = Math.max(0, Math.min(255, Math.round(rgb[1] + (Math.random()-0.5)*shift*2)));
                const b = Math.max(0, Math.min(255, Math.round(rgb[2] + (Math.random()-0.5)*shift*2)));
                stampColour = "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
            }
        }

        const offsetStart = -Math.floor(stampSize / 2);
        const offsetEnd = Math.floor((stampSize - 1) / 2);

        for (let ix = offsetStart; ix <= offsetEnd; ix++) {
            for (let iy = offsetStart; iy <= offsetEnd; iy++) {
                let patternAlphaMult = 1;
                if (app.tool === 'brush') {
                    const localX = ix - offsetStart;
                    const localY = iy - offsetStart;
                    const patX = Math.floor((localX / stampSize) * app.brushPatternWidth);
                    const patY = Math.floor((localY / stampSize) * app.brushPatternHeight);
                    const patternIndex = patY * app.brushPatternWidth + patX;
                    const patA = app.brushPattern[patternIndex];
                    if (patA === 0) continue;
                    patternAlphaMult = patA / 255;
                }
                if ((app.tool === 'pen' || app.tool === 'eraser') && app.penShape === 'circle' && stampSize > 2) {
                    const radiusSq = (stampSize / 2) * (stampSize / 2);
                    const pdx = ix + (stampSize % 2 === 0 ? 0.5 : 0);
                    const pdy = iy + (stampSize % 2 === 0 ? 0.5 : 0);
                    if (pdx * pdx + pdy * pdy > radiusSq) continue;
                }
                const px = stampX + ix;
                const py = stampY + iy;
                if (px >= 0 && px < project.width && py >= 0 && py < project.height) {
                    applyPixel(ctx, px, py, isPreview, patternAlphaMult, stampFlow, stampColour);
                }
            }
        }
    };

    if (isLine) {
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = (x0 < x1) ? 1 : -1;
        const sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;
        let cx = x0, cy = y0;

        while (true) {
            let shouldStamp = true;
            if (app.tool === 'brush' || app.tool === 'pen' || app.tool === 'eraser') {
                if (tempStampPos) {
                    const dist = Math.hypot(cx - tempStampPos.x, cy - tempStampPos.y);
                    const spacingPx = Math.max(1, (size * app.brushSpacing) / 100);
                    if (dist < spacingPx) {
                        shouldStamp = false;
                    }
                }
                if (shouldStamp) {
                    tempStampPos = { x: cx, y: cy };
                    if (!isPreview) app.lastStampPos = tempStampPos;
                }
            }

            if (shouldStamp) {
                applyStamp(cx, cy);
            }

            if (cx === x1 && cy === y1) break;
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; cx += sx; }
            if (e2 < dx) { err += dx; cy += sy; }
        }
    } else {
        applyStamp(x0, y0);
    }
}

function drawCurve(ctx, x0, y0, cx, cy, x1, y1, size) {
    const steps = 50;
    let prevX = x0;
    let prevY = y0;
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const invT = 1 - t;
        const currX = Math.round(invT * invT * x0 + 2 * invT * t * cx + t * t * x1);
        const currY = Math.round(invT * invT * y0 + 2 * invT * t * cy + t * t * y1);
        drawShape(ctx, prevX, prevY, currX, currY, size, true);
        prevX = currX;
        prevY = currY;
    }
}

function drawGeometricShape(ctx, x0, y0, x1, y1, type, fill, size) {
    const project = app.activeProject;
    const isPreview = (ctx === previewCtx);
    if (!isPreview && app.tool === 'shape' && app.currentStroke === null) {
        app.currentStroke = new Set();
    }
    const xMin = Math.min(x0, x1);
    const xMax = Math.max(x0, x1);
    const yMin = Math.min(y0, y1);
    const yMax = Math.max(y0, y1);

    if (type === 'rectangle') {
        for (let px = xMin; px <= xMax; px++) {
            for (let py = yMin; py <= yMax; py++) {
                let onBoundary = (px === xMin || px === xMax || py === yMin || py === yMax);
                if (fill === 'filled' && !onBoundary) {
                    if (px >= 0 && px < project.width && py >= 0 && py < project.height) {
                        applyPixel(ctx, px, py, isPreview);
                    }
                }
                if (onBoundary) {
                    drawShape(ctx, px, py, px, py, size, false);
                }
            }
        }
    } else if (type === 'ellipse') {
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        const rx = Math.abs(x1 - x0) / 2;
        const ry = Math.abs(y1 - y0) / 2;
        const rxSq = rx * rx;
        const rySq = ry * ry;
        const limit = rxSq * rySq;
        const isInside = (x, y) => {
            if (rx === 0 || ry === 0) return true;
            const dx = x - cx;
            const dy = y - cy;
            return (dx*dx*rySq + dy*dy*rxSq) <= limit;
        };
        for (let px = xMin; px <= xMax; px++) {
            for (let py = yMin; py <= yMax; py++) {
                if (isInside(px, py)) {
                    let onBoundary = !isInside(px+1, py) || !isInside(px-1, py) || !isInside(px, py+1) || !isInside(px, py-1);
                    if (fill === 'filled' && !onBoundary) {
                        if (px >= 0 && px < project.width && py >= 0 && py < project.height) {
                            applyPixel(ctx, px, py, isPreview);
                        }
                    }
                    if (onBoundary || (fill==='hollow' && (rx===0 || ry===0))) {
                        drawShape(ctx, px, py, px, py, size, false);
                    }
                }
            }
        }
    }
}

function updatePreview(x, y) {
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    const project = app.activeProject;
    if (!project) return;
    if (app.tool === 'pen' || app.tool === 'brush' || app.tool === 'eraser' || app.tool === 'line') {
        if (app.tool === 'line' && app.lineStart) {
            drawShape(previewCtx, app.lineStart.x, app.lineStart.y, x, y, app.toolSize, true);
        } else if (app.tool !== 'line') {
            drawShape(previewCtx, x, y, x, y, app.toolSize, false);
        }
    }
    else if (app.tool === 'curve') {
        if (app.curveStart && !app.curveEnd) {
            drawShape(previewCtx, app.curveStart.x, app.curveStart.y, x, y, app.toolSize, true);
        } else if (app.curveStart && app.curveEnd) {
            drawCurve(previewCtx, app.curveStart.x, app.curveStart.y, x, y, app.curveEnd.x, app.curveEnd.y, app.toolSize);
        }
    }
    else if (app.tool === 'shape') {
        if (app.shapeStart) {
            drawGeometricShape(previewCtx, app.shapeStart.x, app.shapeStart.y, x, y, app.shapeType, app.shapeFill, app.toolSize);
        }
    }
    if (app.atlasMode) renderWorkspace();
}

function getResizeHandleAt(x, y) {
    if (!app.selection) return null;
    const { x: sx, y: sy, w: sw, h: sh } = app.selection;
    const threshold = Math.max(1, 5 / app.zoom);
    if (Math.abs(x - sx) <= threshold && Math.abs(y - sy) <= threshold) return 'nw';
    if (Math.abs(x - (sx + sw)) <= threshold && Math.abs(y - sy) <= threshold) return 'ne';
    if (Math.abs(x - sx) <= threshold && Math.abs(y - (sy + sh)) <= threshold) return 'sw';
    if (Math.abs(x - (sx + sw)) <= threshold && Math.abs(y - (sy + sh)) <= threshold) return 'se';
    return null;
}

workspace.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

workspace.addEventListener('mousedown', (e) => {
    if (app.tool === 'pan' || app.isSpacePanning || e.button === 1) return;
    const project = app.activeProject;
    if (!project) return;
    const { x, y } = getGridCoordinates(e);

    if (e.button === 2) {
        if (app.tool === 'line' && app.lineStart) {
            app.lineStart = null;
            previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
            renderWorkspace();
        } else if (app.tool === 'curve' && (app.curveStart || app.curveEnd)) {
            app.curveStart = null;
            app.curveEnd = null;
            previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
            renderWorkspace();
        } else if (app.tool === 'shape' && app.shapeStart) {
            app.shapeStart = null;
            previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
            renderWorkspace();
        }
        return;
    }

    if (app.tool === 'select') {
        if (app.selection && (app.selectState === 'selected' || app.selectState === 'resizing' || app.selectState === 'moving')) {
            const handle = getResizeHandleAt(x, y);
            if (handle) {
                app.selectState = 'resizing';
                app.resizeHandle = handle;
                app.dragStart = { x, y, origSel: { ...app.selection } };
                pickupSelection();
                return;
            }
        }
        if (app.selection && x >= app.selection.x && x < app.selection.x + app.selection.w && y >= app.selection.y && y < app.selection.y + app.selection.h) {
            app.selectState = 'moving';
            app.dragStart = { x, y, origSel: { ...app.selection } };
            pickupSelection();
            return;
        }
        commitSelection();
        app.selection = { x, y, w: 0, h: 0 };
        app.selectState = 'dragging_new';
        app.dragStart = { x, y };
        renderWorkspace();
        return;
    }

    if (app.tool === 'eyedropper') {
        if (x >= 0 && x < project.width && y >= 0 && y < project.height) {
            for (let i = project.layers.length - 1; i >= 0; i--) {
                const layer = project.layers[i];
                if (!layer.visible) continue;
                const pixelData = layer.ctx.getImageData(x, y, 1, 1).data;
                if (pixelData[3] > 0) {
                    const hex = "#" + (1 << 24 | pixelData[0] << 16 | pixelData[1] << 8 | pixelData[2]).toString(16).slice(1).toUpperCase();
                    setColour(hex);
                    addRecentColour(hex);
                    break;
                }
            }
        }
        return;
    }

    if (app.tool === 'line') {
                if (!app.lineStart) {
                    app.lineStart = { x, y };
                } else {
                    if (project.activeLayer.visible && !project.activeLayer.locked) {
                        app.currentStroke = new Set();
                        app.strokeCtx.clearRect(0, 0, project.width, project.height);
                        
                        drawShape(app.strokeCtx, app.lineStart.x, app.lineStart.y, x, y, app.toolSize, true);
                        
                        const ctx = project.activeLayer.ctx;
                        ctx.globalAlpha = app.toolOpacity / 100;
                        ctx.drawImage(app.strokeCanvas, 0, 0);
                        ctx.globalAlpha = 1.0;
                        
                        app.strokeCtx.clearRect(0, 0, project.width, project.height);
                        project.pushState();
                    }
                    app.lineStart = null;
                    app.currentStroke = null;
                    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
                    renderWorkspace();
                }
                return;
            }

            if (app.tool === 'curve') {
                if (!app.curveStart) {
                    app.curveStart = { x, y };
                } else if (!app.curveEnd) {
                    app.curveEnd = { x, y };
                } else {
                    if (project.activeLayer.visible && !project.activeLayer.locked) {
                        app.currentStroke = new Set();
                        app.strokeCtx.clearRect(0, 0, project.width, project.height);

                        drawCurve(app.strokeCtx, app.curveStart.x, app.curveStart.y, x, y, app.curveEnd.x, app.curveEnd.y, app.toolSize);
                        
                        const ctx = project.activeLayer.ctx;
                        ctx.globalAlpha = app.toolOpacity / 100;
                        ctx.drawImage(app.strokeCanvas, 0, 0);
                        ctx.globalAlpha = 1.0;
                        
                        app.strokeCtx.clearRect(0, 0, project.width, project.height);
                        project.pushState();
                    }
                    app.curveStart = null;
                    app.curveEnd = null;
                    app.currentStroke = null;
                    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
                    renderWorkspace();
                }
                return;
            }
            
            if (app.tool === 'shape') {
                if (!app.shapeStart) {
                    app.shapeStart = { x, y };
                } else {
                    if (project.activeLayer.visible && !project.activeLayer.locked) {
                        app.currentStroke = new Set();
                        app.strokeCtx.clearRect(0, 0, project.width, project.height);

                        drawGeometricShape(app.strokeCtx, app.shapeStart.x, app.shapeStart.y, x, y, app.shapeType, app.shapeFill, app.toolSize);
                        
                        const ctx = project.activeLayer.ctx;
                        ctx.globalAlpha = app.toolOpacity / 100;
                        ctx.drawImage(app.strokeCanvas, 0, 0);
                        ctx.globalAlpha = 1.0;
                        
                        app.strokeCtx.clearRect(0, 0, project.width, project.height);
                        project.pushState();
                    }
                    app.shapeStart = null;
                    app.currentStroke = null;
                    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
                    renderWorkspace();
                }
                return;
            }

    if (!project.activeLayer.visible) return;

    if (app.tool === 'fill') {
        if (x >= 0 && x < project.width && y >= 0 && y < project.height) {
            floodFill(x, y, getActiveColour());
        }
        return;
    }

    app.isDrawing = true;
    app.lastStampPos = null;
    
    let targetCtx = project.activeLayer.ctx;
    if (app.tool === 'pen' || app.tool === 'brush' || app.tool === 'shape' || app.tool === 'line' || app.tool === 'curve') {
        targetCtx = app.strokeCtx;
        app.strokeCtx.clearRect(0, 0, project.width, project.height);
    }
    
    drawShape(targetCtx, x, y, x, y, app.toolSize, false);
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    renderWorkspace();
});

workspace.addEventListener('mousemove', (e) => {
    const project = app.activeProject;
    if (!project) return;
    const { x, y } = getGridCoordinates(e);
    app.lastGridX = x;
    app.lastGridY = y;
    
    if (x >= 0 && x < project.width && y >= 0 && y < project.height) {
        coordDisplay.innerText = `X: ${x}  Y: ${y}`;
    } else {
        coordDisplay.innerText = ``;
    }

    if (app.tool === 'pan' || app.isSpacePanning || app.isPanning) {
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        return;
    }

    if (app.tool === 'select') {
        if (app.selectState === 'dragging_new') {
            const minX = Math.min(app.dragStart.x, x);
            const minY = Math.min(app.dragStart.y, y);
            const maxX = Math.max(app.dragStart.x, x);
            const maxY = Math.max(app.dragStart.y, y);
            app.selection = { x: minX, y: minY, w: (maxX - minX) + 1, h: (maxY - minY) + 1 };
            renderWorkspace();
        } else if (app.selectState === 'moving' && app.floatingData) {
            const dx = x - app.dragStart.x;
            const dy = y - app.dragStart.y;
            app.selection.x = app.dragStart.origSel.x + dx;
            app.selection.y = app.dragStart.origSel.y + dy;
            renderWorkspace();
        } else if (app.selectState === 'resizing' && app.floatingData) {
            const orig = app.dragStart.origSel;
            let nx = orig.x, ny = orig.y, nw = orig.w, nh = orig.h;
            if (app.resizeHandle === 'nw') {
                nw = orig.w + (orig.x - x);
                nh = orig.h + (orig.y - y);
                nx = x; ny = y;
            } else if (app.resizeHandle === 'ne') {
                nw = (x - orig.x);
                nh = orig.h + (orig.y - y);
                ny = y;
            } else if (app.resizeHandle === 'sw') {
                nw = orig.w + (orig.x - x);
                nh = (y - orig.y);
                nx = x;
            } else if (app.resizeHandle === 'se') {
                nw = (x - orig.x);
                nh = (y - orig.y);
            }
            if (nw < 1) { nx = orig.x + orig.w - 1; nw = 1; }
            if (nh < 1) { ny = orig.y + orig.h - 1; nh = 1; }
            app.selection = { x: nx, y: ny, w: nw, h: nh };
            renderWorkspace();
        }
        return;
    }

    updatePreview(x, y);

    if (!app.isDrawing) return;
    if (app.tool === 'fill' || app.tool === 'line' || app.tool === 'curve' || app.tool === 'shape' || app.tool === 'eyedropper') return;
    if (!project.activeLayer.visible) return;

    let targetCtx = project.activeLayer.ctx;
    if (app.tool === 'pen' || app.tool === 'brush') {
        targetCtx = app.strokeCtx;
    }
    
    drawShape(targetCtx, x, y, x, y, app.toolSize, false);
    renderWorkspace();
});

workspace.addEventListener('mouseleave', () => {
    coordDisplay.innerText = ``;
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    if (app.atlasMode) renderWorkspace();

    if (app.selectState === 'dragging_new' || app.selectState === 'moving' || app.selectState === 'resizing') {
        app.selectState = app.selection ? 'selected' : 'idle';
    }
    if (app.isDrawing) {
        if (['pen', 'brush', 'line', 'curve', 'shape'].includes(app.tool)) {
            const project = app.activeProject;
            if (project && project.activeLayer.visible && !project.activeLayer.locked) {
                const ctx = project.activeLayer.ctx;
                ctx.globalAlpha = app.toolOpacity / 100;
                ctx.drawImage(app.strokeCanvas, 0, 0);
                ctx.globalAlpha = 1.0;
                app.strokeCtx.clearRect(0, 0, project.width, project.height);
            }
        }
        app.isDrawing = false;
        app.lastStampPos = null;
        app.activeProject?.pushState();
        renderWorkspace();
    }
});

workspace.addEventListener('mouseup', () => {
    if (app.selectState === 'dragging_new') {
        app.selectState = app.selection && app.selection.w > 0 && app.selection.h > 0 ? 'selected' : 'idle';
        if (app.selectState === 'idle') app.selection = null;
        renderWorkspace();
    } else if (app.selectState === 'moving' || app.selectState === 'resizing') {
        app.selectState = 'selected';
    }
    if (app.isDrawing) {
        if (['pen', 'brush', 'line', 'curve', 'shape'].includes(app.tool)) {
            const project = app.activeProject;
            if (project && project.activeLayer.visible && !project.activeLayer.locked) {
                const ctx = project.activeLayer.ctx;
                ctx.globalAlpha = app.toolOpacity / 100;
                ctx.drawImage(app.strokeCanvas, 0, 0);
                ctx.globalAlpha = 1.0;
                app.strokeCtx.clearRect(0, 0, project.width, project.height);
            }
        }
        app.isDrawing = false;
        app.lastStampPos = null;
        app.activeProject?.pushState();
        renderWorkspace();
    }
});

function hexToRgba(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const a = hex.length === 9 ? parseInt(hex.slice(7, 9), 16) : 255;
    return [r, g, b, a];
}

function floodFill(startX, startY, fillColourHex) {
    const project = app.activeProject;
    if (!project) return;
    const ctx = project.activeLayer.ctx;
    const imgData = ctx.getImageData(0, 0, project.width, project.height);
    const data = imgData.data;
    const fillRgba = hexToRgba(fillColourHex);
    const startPos = (startY * project.width + startX) * 4;
    const startR = data[startPos];
    const startG = data[startPos + 1];
    const startB = data[startPos + 2];
    const startA = data[startPos + 3];

    if (startR === fillRgba[0] && startG === fillRgba[1] && startB === fillRgba[2] && startA === fillRgba[3]) return;

    function matchStartColour(x, y) {
        if (x < 0 || x >= project.width || y < 0 || y >= project.height) return false;
        const pos = (y * project.width + x) * 4;
        return data[pos] === startR && data[pos + 1] === startG && data[pos + 2] === startB && data[pos + 3] === startA;
    }

    const stack = [[startX, startY]];
    while (stack.length > 0) {
        const [x, y] = stack.pop();
        const pos = (y * project.width + x) * 4;

        data[pos] = fillRgba[0];
        data[pos + 1] = fillRgba[1];
        data[pos + 2] = fillRgba[2];
        data[pos + 3] = fillRgba[3];

        if (matchStartColour(x + 1, y)) stack.push([x + 1, y]);
        if (matchStartColour(x - 1, y)) stack.push([x - 1, y]);
        if (matchStartColour(x, y + 1)) stack.push([x, y + 1]);
        if (matchStartColour(x, y - 1)) stack.push([x, y - 1]);
        
        if (app.fillDiagonals) {
            if (matchStartColour(x + 1, y + 1)) stack.push([x + 1, y + 1]);
            if (matchStartColour(x - 1, y - 1)) stack.push([x - 1, y - 1]);
            if (matchStartColour(x + 1, y - 1)) stack.push([x + 1, y - 1]);
            if (matchStartColour(x - 1, y + 1)) stack.push([x - 1, y + 1]);
        }
    }
    ctx.putImageData(imgData, 0, 0);
    project.pushState();
    renderWorkspace();
}

function saveSprite() {
    commitSelection();
    const project = app.activeProject;
    if (!project) return;
    const frameData = project.frames.map(frame => {
        return {
            layers: frame.layers.map(layer => {
                const imgData = layer.ctx.getImageData(0, 0, project.width, project.height).data;
                const pixels = [];
                for (let i = 0; i < imgData.length; i += 4) {
                    const r = imgData[i], g = imgData[i + 1], b = imgData[i + 2], a = imgData[i + 3];
                    const hex = "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
                    if (a === 0) {
                        pixels.push(null);
                    } else if (a === 255) {
                        pixels.push(hex);
                    } else {
                        const alphaHex = a.toString(16).padStart(2, '0').toUpperCase();
                        pixels.push(hex + alphaHex);
                    }
                }
                return {
                    name: layer.name,
                    visible: layer.visible,
                    opacity: layer.opacity !== undefined ? layer.opacity : 1,
                    pixels: pixels
                };
            })
        };
    });
    const payload = {
        format: ">L_SPRITE_DATA",
        version: "1.3",
        grid_width: project.width,
        grid_height: project.height,
        timestamp: new Date().toISOString(),
        frames: frameData
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project_${Date.now()}.ldevsprite`;
    a.click();
    URL.revokeObjectURL(url);
}

function loadSprite(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.format !== ">L_SPRITE_DATA") {
                alert("Error: Invalid or corrupted .ldevsprite file.");
                return;
            }
            const w = data.grid_width || data.grid_size;
            const h = data.grid_height || data.grid_size;
            const project = app.activeProject;
            clearSelection();
            project.width = parseInt(w);
            project.height = parseInt(h);
            gridWInput.value = project.width;
            gridHInput.value = project.height;
            app.strokeCanvas.width = project.width;
            app.strokeCanvas.height = project.height;

            if (data.version === "1.3" && data.frames) {
                project.frames = data.frames.map((fData, fIndex) => {
                    const frame = new Frame(w, h);
                    frame.layers = fData.layers.map((lData, index) => {
                        const layer = new Layer(w, h, lData.name || `Layer ${index + 1}`);
                        layer.visible = lData.visible !== false;
                        layer.opacity = lData.opacity !== undefined ? lData.opacity : 1;
                        const pixels = lData.pixels;
                        for (let i = 0; i < pixels.length; i++) {
                            if (pixels[i] !== null) {
                                const x = i % w;
                                const y = Math.floor(i / w);
                                layer.ctx.fillStyle = pixels[i];
                                layer.ctx.fillRect(x, y, 1, 1);
                            }
                        }
                        return layer;
                    });
                    return frame;
                });
                project.activeFrameIndex = 0;
            } else if (data.version === "1.2" && data.layers) {
                const frame = new Frame(w, h);
                frame.layers = data.layers.map((lData, index) => {
                    const layer = new Layer(w, h, lData.name || `Layer ${index + 1}`);
                    layer.visible = lData.visible !== false;
                    layer.opacity = 1;
                    const pixels = lData.pixels;
                    for (let i = 0; i < pixels.length; i++) {
                        if (pixels[i] !== null) {
                            const x = i % w;
                            const y = Math.floor(i / w);
                            layer.ctx.fillStyle = pixels[i];
                            layer.ctx.fillRect(x, y, 1, 1);
                        }
                    }
                    return layer;
                });
                project.frames = [frame];
                project.activeFrameIndex = 0;
            }
            previewCanvas.width = w;
            previewCanvas.height = h;
            project.historyStack = [];
            project.historyIndex = -1;
            renderWorkspace();
            renderLayerPanel();
            renderFramePanel();
            project.pushState();
        } catch (err) {
            alert("Error: Failed to parse .ldevsprite file.");
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

document.getElementById('export-scale').addEventListener('input', updateExportPreview);

function updateExportPreview() {
    const scale = parseInt(document.getElementById('export-scale').value) || 1;
    const project = app.activeProject;
    if(project) {
        document.getElementById('export-size-preview').innerText = `${project.width * scale}x${project.height * scale}`;
    }
}

function openExportMenu() {
    updateExportPreview();
    document.getElementById('export-modal').style.display = 'flex';
}

function closeExportMenu() {
    document.getElementById('export-modal').style.display = 'none';
}

function createExportCanvas(w, h, scale) {
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return {canvas, ctx};
}

function downloadCanvas(canvas, filename) {
    const dataURL = canvas.toDataURL("image/png");
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = filename;
    a.click();
}

let gifWorkerUrl = null;
async function getGifWorker() {
    if (gifWorkerUrl) return gifWorkerUrl;
    const workerScript = `importScripts('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js');`;
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    gifWorkerUrl = URL.createObjectURL(blob);
    return gifWorkerUrl;
}

async function executeExport(type) {
    commitSelection();
    const project = app.activeProject;
    if (!project) return;
    const scale = parseInt(document.getElementById('export-scale').value) || 1;

    if (type === 'spritesheet') {
        const {canvas, ctx} = createExportCanvas(project.width * project.frames.length, project.height, scale);
        project.frames.forEach((frame, index) => {
            frame.layers.forEach(layer => {
                if (layer.visible) {
                    ctx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1;
                    ctx.drawImage(layer.canvas, index * project.width * scale, 0, project.width * scale, project.height * scale);
                }
            });
        });
        downloadCanvas(canvas, `spritesheet_${Date.now()}.png`);
        closeExportMenu();
    } else if (type === 'frame') {
        const {canvas, ctx} = createExportCanvas(project.width, project.height, scale);
        project.activeFrame.layers.forEach(layer => {
            if (layer.visible) {
                ctx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1;
                ctx.drawImage(layer.canvas, 0, 0, project.width * scale, project.height * scale);
            }
        });
        downloadCanvas(canvas, `frame_${Date.now()}.png`);
        closeExportMenu();
    } else if (type === 'gif') {
        const gifBtn = document.getElementById('gif-export-btn');
        const originalText = gifBtn.innerText;
        try {
            gifBtn.innerText = "⏳ Encoding GIF... Please wait.";
            gifBtn.style.pointerEvents = 'none';
            const workerUrl = await getGifWorker();
            const CHROMA_KEY = '#FF00FF'; 
            const gif = new GIF({
                workers: 2,
                quality: 10,
                width: project.width * scale,
                height: project.height * scale,
                workerScript: workerUrl,
                transparent: CHROMA_KEY
            });
            project.frames.forEach(frame => {
                const {canvas, ctx} = createExportCanvas(project.width, project.height, scale);
                ctx.fillStyle = CHROMA_KEY;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                frame.layers.forEach(layer => {
                    if (layer.visible) {
                        ctx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1;
                        ctx.drawImage(layer.canvas, 0, 0, canvas.width, canvas.height);
                    }
                });
                gif.addFrame(canvas, { delay: 1000 / app.fps, copy: true });
            });
            gif.on('finished', function(blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `animation_${Date.now()}.gif`;
                a.click();
                URL.revokeObjectURL(url);
                gifBtn.innerText = originalText;
                gifBtn.style.pointerEvents = 'auto';
                closeExportMenu();
            });
            gif.render();
        } catch (err) {
            alert("Failed to export GIF. Make sure you are connected to the internet to load the GIF encoder.");
            gifBtn.innerText = originalText;
            gifBtn.style.pointerEvents = 'auto';
        }
    }
}

resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizer.classList.add('active');
    document.body.style.cursor = 'ew-resize';
});

init();
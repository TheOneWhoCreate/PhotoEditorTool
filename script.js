//Checking for script load
console.log("Script loaded successfully.");

// --- Global State ---
let currentFiles = [];
let currentIndex = 0;
let cropperInstance = null;
let previewTimeout;

function triggerPreview() {
    clearTimeout(previewTimeout);
    previewTimeout = setTimeout(updatePreview, 150);
}

// Entry point: Decides between Manual Crop or Bulk Auto mode
async function startProcess() {
    const fileInput = document.getElementById('fileInput');
    const isManualCrop = document.getElementById('manualCropCheck').checked;
    const statusText = document.getElementById('status');

    if (fileInput.files.length === 0) {
        statusText.innerText = "Please select some photos first!";
        return;
    }

    if (isManualCrop) {
        currentFiles = Array.from(fileInput.files);
        currentIndex = 0;
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('cropper-ui').style.display = 'block';
        loadNextCropper();
    } else {
        statusText.innerText = `Processing ${fileInput.files.length} images... Please wait.`;
        await runBulkProcess(fileInput.files);
        statusText.innerText = "Processing complete. Check your downloads.";
    }
}

/* ==========================================================================
   MANUAL CROP MODE (Cropper.js Logic)
   ========================================================================== */

function loadNextCropper() {
    if (currentIndex >= currentFiles.length) {
        finishCropping();
        return;
    }

    document.getElementById('crop-counter').innerText = `Photo ${currentIndex + 1} of ${currentFiles.length}`;

    const file = currentFiles[currentIndex];
    const url = URL.createObjectURL(file);
    const imageEl = document.getElementById('crop-image');

    imageEl.src = url;

    // Clean up previous instance to prevent memory leaks
    if (cropperInstance) { cropperInstance.destroy(); }

    const purpose = document.getElementById('purpose').value;
    let targetRatio = NaN; // Default to free crop

    if (purpose === 'insta-feed (3:4)') targetRatio = 3 / 4;
    if (purpose === 'insta-feed (4:5)') targetRatio = 4 / 5;
    if (purpose === 'insta-story') targetRatio = 9 / 16;
    if (purpose === 'insta-square') targetRatio = 1 / 1;

    imageEl.onload = () => {
        cropperInstance = new Cropper(imageEl, {
            aspectRatio: targetRatio,
            viewMode: 2,
            dragMode: 'move',
            autoCropArea: 0.9,
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false,
        });
    };
}

async function saveCropAndNext() {
    if (!cropperInstance) return;

    // High quality crop capture
    const croppedCanvas = cropperInstance.getCroppedCanvas({ maxWidth: 1500, maxHeight: 1500 });
    const effect = document.getElementById('effect').value;
    const format = document.getElementById('format').value;
    const file = currentFiles[currentIndex];

    // Extract filename without extension
    let originalName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

    await applyEffectAndDownload(croppedCanvas, effect, format, originalName);

    currentIndex++;
    loadNextCropper();
}

function skipAndNext() {
    currentIndex++;
    loadNextCropper();
}

function cancelCropping() {
    // 1. Ask for confirmation so they don't lose progress by accident
    if (!confirm("Are you sure? This will cancel the current session and you'll lose any un-saved crops.")) {
        return;
    }

    // 2. Clean up the Cropper instance to free memory
    if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
    }

    // 3. UI Toggle: Hide Cropper and Show Main Menu
    document.getElementById('cropper-ui').style.display = 'none';
    document.getElementById('main-menu').style.display = 'block';

    // 4. Reset states
    currentIndex = 0;
    currentFiles = [];
    document.getElementById('fileInput').value = ""; // Clear the file input
    document.getElementById('status').innerText = "Session cancelled.";
}

function finishCropping(customMessage = "All photos processed and saved.") {
    if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
    }
    document.getElementById('cropper-ui').style.display = 'none';
    document.getElementById('main-menu').style.display = 'block';
    document.getElementById('status').innerText = customMessage;
    document.getElementById('fileInput').value = ""; // Reset input
}

/* ==========================================================================
   BULK AUTO MODE
   ========================================================================== */

async function runBulkProcess(files) {
    const effect = document.getElementById('effect').value;
    const format = document.getElementById('format').value;

    for (let i = 0; i < files.length; i++) {
        let file = files[i];
        let originalName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

        document.getElementById('status').innerText = `Processing ${i + 1} of ${files.length}...`;

        const img = await loadImage(file);
        await applyEffectAndDownload(img, effect, format, originalName);

        img.src = "";
        // Throttle downloads slightly to help browser stability
        await new Promise(r => setTimeout(r, 400));
    }
}


async function drawEffectToCanvas(canvas, sourceImg, effect, userPadding, userColor, imgW, imgH, label) {
    const ctx = canvas.getContext('2d');

    // EFFECTS
    if (effect === 'border') {
        canvas.width = imgW + userPadding * 2;
        canvas.height = imgH + userPadding * 2;
        ctx.fillStyle = userColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(sourceImg, userPadding, userPadding, imgW, imgH);
    }

    else if (effect === 'polaroid') {
        let pad = userPadding;
        let bottomPad = Math.max(userPadding * 3, 80);

        // Scaling logic to keep high resolution
        let scale = Math.min(1, 2000 / (imgW + pad * 2), 2000 / (imgH + pad + bottomPad));
        pad *= scale;
        bottomPad *= scale;
        imgW *= scale;
        imgH *= scale;

        canvas.width = imgW + (pad * 2);
        canvas.height = imgH + pad + bottomPad;

        // 1. Draw the Main Background Frame
        ctx.fillStyle = userColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. DRAW THE OUTLINE (White Border) 
        // We draw this BEFORE the image so the image sits inside it
        const outlineThickness = Math.max(1, imgW * 0.002); // Subtle but visible
        ctx.fillStyle = "#000000";
        ctx.fillRect(
            pad - outlineThickness,
            pad - outlineThickness,
            imgW + (outlineThickness * 2),
            imgH + (outlineThickness * 2)
        );

        // 3. Draw the Image with Shadow
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.2)";
        ctx.shadowBlur = 15 * scale;
        ctx.shadowOffsetY = 5 * scale;
        ctx.drawImage(sourceImg, pad, pad, imgW, imgH);
        ctx.restore();

        // 4. Text Caption
        ctx.shadowColor = "transparent";

        if (label) {
            const isDark = (c) => {
                const hex = c.replace('#', '');
                const rgb = [0, 2, 4].map(p => parseInt(hex.substr(p, 2), 16));
                return (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) < 128;
            };
            ctx.fillStyle = isDark(userColor) ? "#ffffff" : "#333333";
            ctx.textAlign = "center";
            let fontSize = Math.max(16 * scale, Math.min(bottomPad * 0.35, 60));

            ctx.font = `${fontSize}px 'Segoe Script', cursive`;
            // Shrink font if too long
            while (ctx.measureText(label).width > (canvas.width * 0.9) && fontSize > 10) {
                fontSize--;
                ctx.font = `${fontSize}px 'Segoe Script', cursive`;
            }

            // Vertical center in the bottom area
            const textY = canvas.height - (bottomPad / 2) + (fontSize / 3);
            ctx.fillText(label, canvas.width / 2, textY);
        }
    }

    else if (effect === 'vintage') {
        canvas.width = imgW;
        canvas.height = imgH;
        ctx.drawImage(sourceImg, 0, 0, imgW, imgH);
        let idata = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let d = idata.data;
        for (let i = 0; i < d.length; i += 4) {
            let r = d[i], g = d[i + 1], b = d[i + 2];
            d[i] = (r * 0.393) + (g * 0.769) + (b * 0.189);
            d[i + 1] = (r * 0.349) + (g * 0.686) + (b * 0.168);
            d[i + 2] = (r * 0.272) + (g * 0.534) + (b * 0.131);
        }
        ctx.putImageData(idata, 0, 0);
    }

    else if (effect === 'blurBg') {
        canvas.width = 800; canvas.height = 600;
        ctx.filter = "blur(20px)";
        ctx.drawImage(sourceImg, 0, 0, 800, 600);
        ctx.filter = "none";
        let s = Math.min(800 / sourceImg.width, 600 / sourceImg.height);
        let w = sourceImg.width * s, h = sourceImg.height * s;
        ctx.drawImage(sourceImg, (800 - w) / 2, (600 - h) / 2, w, h);
    }

    else if (effect === 'glassFrame') {
        let margin = imgW * 0.12;
        canvas.width = imgW + (margin * 2);
        canvas.height = imgH + (margin * 2);

        // 1. Background (Blurred & Scaled)
        ctx.save();
        ctx.filter = "blur(30px) brightness(0.85)";
        ctx.drawImage(sourceImg, -20, -20, canvas.width + 40, canvas.height + 40);
        ctx.restore();

        // 2. The "Frosted" Overlay
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 3. Subtle Frame Edge (Outer stroke of the glass itself)
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 2;
        ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

        // 4. Main Image & Border with Shadow
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
        ctx.shadowBlur = 25;
        ctx.shadowOffsetY = 12;

        const borderThickness = Math.max(1, imgW * 0.005); // Min 2px for visibility

        // Draw white border rectangle
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(
            margin - borderThickness,
            margin - borderThickness,
            imgW + (borderThickness * 2),
            imgH + (borderThickness * 2)
        );

        // Draw Image
        ctx.shadowColor = "transparent"; // Turn off shadow specifically for the image to keep edges crisp
        ctx.drawImage(sourceImg, margin, margin, imgW, imgH);

        ctx.restore();
    }

    else if (effect === 'goldenHour') {
        canvas.width = imgW;
        canvas.height = imgH;

        // 1. Draw the original image first
        ctx.drawImage(sourceImg, 0, 0, imgW, imgH);

        // 2. Add a warm saturation and brightness boost
        ctx.filter = "saturate(1.3) brightness(1.05) contrast(1.1)";
        ctx.drawImage(canvas, 0, 0);
        ctx.filter = "none";

        // 3. Create a "Sun" Gradient
        // We create a radial gradient starting from the top-right corner
        const gradient = ctx.createRadialGradient(imgW, 0, imgW * 0.1, imgW * 0.8, imgH * 0.2, imgW);
        gradient.addColorStop(0, "rgba(255, 165, 0, 0.25)"); // Warm Orange
        gradient.addColorStop(0.5, "rgba(255, 69, 0, 0.1)");  // Reddish Tint
        gradient.addColorStop(1, "transparent");

        // 4. Blend the gradient
        ctx.globalCompositeOperation = "overlay";
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, imgW, imgH);

        // Reset composite operation for future drawing
        ctx.globalCompositeOperation = "source-over";
    }

    // DEFAULT EFFECT
    else {
        canvas.width = imgW; canvas.height = imgH;
        ctx.drawImage(sourceImg, 0, 0, imgW, imgH);
    }
}

/* ==========================================================================
   CORE EFFECT ENGINE
   ========================================================================== */

async function applyEffectAndDownload(sourceImg, effect, format, originalName) {
    let ext = format.split('/')[1] === 'jpeg' ? 'jpg' : format.split('/')[1];
    const userColor = document.getElementById('frameColor').value;
    const mWidth = parseInt(document.getElementById('manualWidth').value);
    const mHeight = parseInt(document.getElementById('manualHeight').value);
    const label = document.getElementById('polaroidText').value;

    // 1. Calculate base dimensions
    let imgW, imgH;
    if (!isNaN(mWidth) && !isNaN(mHeight)) {
        imgW = mWidth;
        imgH = mHeight;
    } else {
        const maxBounds = 1000;
        let scale = Math.min(maxBounds / sourceImg.width, maxBounds / sourceImg.height, 1);
        imgW = sourceImg.width * scale;
        imgH = sourceImg.height * scale;
    }

    // 2. Safe Padding Calculation
    let userPadding = parseInt(document.getElementById('paddingInput')?.value);

    if (isNaN(userPadding)) {
        userPadding = 20;
    }

    let maxPad = Math.min(imgW, imgH) * 0.4;
    userPadding = Math.max(0, Math.min(userPadding, maxPad));

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    await drawEffectToCanvas(canvas, sourceImg, effect, userPadding, userColor, imgW, imgH, label);

    // 3. Trigger Download
    const quality = format === "image/png" ? undefined : 0.85;

    canvas.toBlob(blob => {
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = `ready_${originalName}.${ext}`;
        link.click();

        // Revoke the URL after a short delay to free memory
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }, format, quality);
}

/* ==========================================================================
   UTILITIES
   ========================================================================== */

function loadImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

document.querySelectorAll("input, select").forEach(el => {
    el.addEventListener("focus", () => el.style.transform = "scale(1.02)");
    el.addEventListener("blur", () => el.style.transform = "scale(1)");
});

/* ==========================================================================
   EVENT LISTENERS
   ========================================================================== */

function effectChanges() {
    const effect = document.getElementById('effect').value;
    const paddingInput = document.getElementById('paddingInput');
    const colorPicker = document.getElementById('frameColor');

    const isPol = effect === 'polaroid';
    const isBord = effect === 'border';

    // 1. UI Visibility Logic
    document.getElementById('color-disclaimer').style.display = isPol ? 'block' : 'none';
    paddingInput.style.display = (isPol || isBord) ? 'block' : 'none';
    document.getElementById('polaroidText').style.display = isPol ? 'block' : 'none';
    document.getElementById('caption').style.display = isPol ? 'block' : 'none';

    // 2. Reset padding and handle smart defaults
    if (isPol) {
        paddingInput.value = 20;
        colorPicker.value = "#ffffff";
    } else if (isBord) {
        paddingInput.value = 2;
    } else {
        paddingInput.value = 0;
    }

}

function purposeChanges() {
    const purpose = document.getElementById('purpose').value;
    const manualCropCheck = document.getElementById('manualCropCheck');

    if (purpose.includes('insta')) {
        manualCropCheck.checked = true;
        manualCropCheck.disabled = true;
        manualCropCheck.parentElement.style.border = "1.5px solid var(--primary)";
    } else {
        manualCropCheck.checked = false;
        manualCropCheck.disabled = false;
        manualCropCheck.parentElement.style.border = "1px solid #eee";
    }
}


async function updatePreview() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput.files.length === 0) return;

    const previewCanvas = document.getElementById('previewCanvas');

    // Load image
    const img = await loadImage(fileInput.files[0]);

    // Settings (same as main pipeline)
    const effect = document.getElementById('effect').value;
    const userColor = document.getElementById('frameColor').value;

    const val = document.getElementById('paddingInput')?.value;
    let userPadding = val === "" ? 20 : parseInt(val);

    const label = document.getElementById('polaroidText').value;

    // Scale for preview (IMPORTANT for performance)
    const maxPreview = 400;
    let scale = Math.min(maxPreview / img.width, maxPreview / img.height);

    let imgW = img.width * scale;
    let imgH = img.height * scale;

    // Apply real effect logic
    await drawEffectToCanvas(
        previewCanvas,
        img,
        effect,
        userPadding,
        userColor,
        imgW,
        imgH,
        label
    );
}

// --- Event Listeners Hub ---
const effectDrop = document.getElementById('effect');
const purposeDrop = document.getElementById('purpose');

if (effectDrop) effectDrop.addEventListener('change', effectChanges);
if (purposeDrop) purposeDrop.addEventListener('change', purposeChanges);

// --- Event Listeners for Live Preview ---
document.getElementById('fileInput').addEventListener('change', triggerPreview);
document.getElementById('effect').addEventListener('change', triggerPreview);
document.getElementById('frameColor').addEventListener('input', triggerPreview);
document.getElementById('paddingInput').addEventListener('input', triggerPreview);
document.getElementById('polaroidText').addEventListener('input', triggerPreview);

// Initialization
effectChanges();
purposeChanges();

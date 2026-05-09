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
    const purpose = document.getElementById('purpose').value;

    if (fileInput.files.length === 0) {
        statusText.innerText = "Please select some photos first!";
        return;
    }

    if (purpose === "passport") {
        statusText.innerText = "Processing passport photos...";
        await runPassportProcess(fileInput.files);
        statusText.innerText = "Passport PDF ready!";
    }
    else if (isManualCrop) {
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
    if (purpose === 'insta-square') targetRatio = 1 / 1;
    if (purpose === 'passport') targetRatio = 35 / 45;

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
    const filter = document.getElementById('filter').value;
    const frame = document.getElementById('frame').value;
    const format = document.getElementById('format').value;
    const file = currentFiles[currentIndex];

    // Extract filename without extension
    let originalName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

    await applyEffectAndDownload(croppedCanvas, filter, frame, format, originalName);

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
    const filter = document.getElementById('filter').value;
    const frame = document.getElementById('frame').value;
    const format = document.getElementById('format').value;

    for (let i = 0; i < files.length; i++) {
        let file = files[i];
        let originalName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

        document.getElementById('status').innerText = `Processing ${i + 1} of ${files.length}...`;

        const img = await loadImage(file);
        await applyEffectAndDownload(img, filter, frame, format, originalName);

        img.src = "";
        // Throttle downloads slightly to help browser stability
        await new Promise(r => setTimeout(r, 400));
    }
}

async function runPassportProcess(files) {
    const images = [];

    for (let i = 0; i < files.length; i++) {
        const img = await loadImage(files[i]);

        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Passport standard size (pixel scaled)
        const w = 350;
        const h = 450;

        canvas.width = w;
        canvas.height = h;

        // White background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);

        // Fit image inside
        const scale = Math.min(w / img.width, h / img.height);
        const iw = img.width * scale;
        const ih = img.height * scale;

        ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);

        images.push(canvas.toDataURL("image/jpeg"));
    }

    generatePassportPDF(images);
}

function generatePassportPDF(images) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const imgW = 35; // mm
    const imgH = 45; // mm

    const pageW = 210;
    const pageH = 297;

    const cols = Math.floor(pageW / imgW);
    const rows = Math.floor(pageH / imgH);

    let index = 0;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (index >= images.length) break;

            doc.addImage(
                images[index],
                "JPEG",
                c * imgW,
                r * imgH,
                imgW,
                imgH
            );

            index++;
        }
    }

    doc.save("passport_photos.pdf");
}

/* ==========================================================================
   EFFECTS
   ========================================================================== */

async function drawEffectToCanvas(canvas, sourceImg, filter, frame, userPadding, userColor, imgW, imgH, label) {
    const ctx = canvas.getContext('2d');

    const filterCanvas = document.createElement('canvas');
    filterCanvas.width = imgW;
    filterCanvas.height = imgH;
    const fCtx = filterCanvas.getContext('2d');
    fCtx.drawImage(sourceImg, 0, 0, imgW, imgH);

    // FILTERS (fCtx for frames)
    if (filter === 'vintage') {
        let idata = fCtx.getImageData(0, 0, imgW, imgH);
        let d = idata.data;
        for (let i = 0; i < d.length; i += 4) {
            let r = d[i], g = d[i + 1], b = d[i + 2];
            d[i] = (r * 0.393) + (g * 0.769) + (b * 0.189);
            d[i + 1] = (r * 0.349) + (g * 0.686) + (b * 0.168);
            d[i + 2] = (r * 0.272) + (g * 0.534) + (b * 0.131);
        }
        fCtx.putImageData(idata, 0, 0);
    }

    if (filter === 'goldenHour') {
        fCtx.filter = "saturate(1.3) brightness(1.05) contrast(1.1)";
        fCtx.drawImage(filterCanvas, 0, 0);
        fCtx.filter = "none";

        const gradient = fCtx.createRadialGradient(imgW, 0, imgW * 0.1, imgW * 0.8, imgH * 0.2, imgW);
        gradient.addColorStop(0, "rgba(255, 165, 0, 0.25)");
        gradient.addColorStop(0.5, "rgba(255, 69, 0, 0.1)");
        gradient.addColorStop(1, "transparent");

        fCtx.globalCompositeOperation = "overlay";
        fCtx.fillStyle = gradient;
        fCtx.fillRect(0, 0, imgW, imgH);
        fCtx.globalCompositeOperation = "source-over";
    }

    if (filter === 'noir') {
        let idata = fCtx.getImageData(0, 0, imgW, imgH);
        let d = idata.data;
        for (let i = 0; i < d.length; i += 4) {
            // Weighted grayscale for better human perception
            let avg = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];

            // Increase contrast: push darks darker and lights lighter
            avg = ((avg - 128) * 1.3) + 128;

            d[i] = d[i + 1] = d[i + 2] = avg;
        }
        fCtx.putImageData(idata, 0, 0);
    }

    if (filter === 'lomo') {
        // 1. Boost Saturation and Contrast using CSS Filters
        fCtx.filter = "saturate(1.8) contrast(1.2)";
        fCtx.drawImage(filterCanvas, 0, 0);
        fCtx.filter = "none";

        // 2. Add Vignette (dark edges)
        const vignette = fCtx.createRadialGradient(
            imgW / 2, imgH / 2, imgW * 0.2, // Inner circle
            imgW / 2, imgH / 2, imgW * 0.8  // Outer circle
        );
        vignette.addColorStop(0, "transparent");
        vignette.addColorStop(1, "rgba(0, 0, 0, 0.7)");

        fCtx.fillStyle = vignette;
        fCtx.fillRect(0, 0, imgW, imgH);
    }

    if (filter === 'coldbrew') {
        fCtx.filter = "brightness(1.05) contrast(0.9) saturate(0.8) hue-rotate(10deg)";
        fCtx.drawImage(filterCanvas, 0, 0);
        fCtx.filter = "none";

        // Layer a very subtle navy blue tint
        fCtx.globalCompositeOperation = "soft-light";
        fCtx.fillStyle = "rgba(0, 50, 100, 0.2)";
        fCtx.fillRect(0, 0, imgW, imgH);
        fCtx.globalCompositeOperation = "source-over";
    }

    if (filter === 'dreamy') {

        // Warm cinematic tone
        fCtx.globalCompositeOperation = "soft-light";
        fCtx.fillStyle = "rgba(255,210,180,0.22)";
        fCtx.fillRect(0, 0, imgW, imgH);

        fCtx.globalCompositeOperation = "source-over";

        // Soft glow
        fCtx.save();

        fCtx.globalAlpha = 0.22;
        fCtx.filter = "blur(12px) brightness(1.08)";

        fCtx.drawImage(filterCanvas, 0, 0);

        fCtx.restore();

        fCtx.filter = "none";

        // Tiny sparkles
        for (let i = 0; i < 300; i++) {

            let x = Math.random() * imgW;
            let y = Math.random() * imgH;

            if (
                x > imgW * 0.35 &&
                x < imgW * 0.65 &&
                y > imgH * 0.2 &&
                y < imgH * 0.7
            ) continue;

            let r = Math.random() * 1.8;

            fCtx.beginPath();
            fCtx.arc(x, y, r, 0, Math.PI * 2);

            fCtx.fillStyle = "rgba(255,255,255,0.7)";
            fCtx.fill();
        }
    }

    canvas.width = imgW;
    canvas.height = imgH;
    ctx.drawImage(filterCanvas, 0, 0, imgW, imgH);

    //FRAMES (ctx for frames)
    if (frame === 'border') {
        canvas.width = imgW + userPadding * 2;
        canvas.height = imgH + userPadding * 2;
        ctx.fillStyle = userColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(filterCanvas, userPadding, userPadding, imgW, imgH);
    }

    else if (frame === 'polaroid') {
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
        ctx.drawImage(filterCanvas, pad, pad, imgW, imgH);
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

    else if (frame === 'filmStrip') {
        const barHeight = imgH * 0.15;
        canvas.width = imgW;
        canvas.height = imgH + (barHeight * 2);

        // 1. Draw black background bars
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. Draw the filtered image in the center
        ctx.drawImage(filterCanvas, 0, barHeight, imgW, imgH);

        // 3. Draw sprocket holes
        ctx.fillStyle = "#fff";
        const holeW = imgW * 0.02;
        const holeH = holeW * 1.5;
        const gap = holeW * 2;

        for (let x = gap; x < canvas.width; x += (holeW + gap)) {
            // Top holes
            ctx.fillRect(x, barHeight / 2 - holeH / 2, holeW, holeH);
            // Bottom holes
            ctx.fillRect(x, canvas.height - (barHeight / 2) - (holeH / 2), holeW, holeH);
        }
    }

    else if (frame === 'gallery') {
        const margin = imgW * 0.1;
        const innerGap = 5; // Space between image and mat

        canvas.width = imgW + (margin * 2);
        canvas.height = imgH + (margin * 2);

        // 1. Outer Frame (User selected color)
        ctx.fillStyle = userColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. Inner White Mat
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(margin - innerGap, margin - innerGap, imgW + (innerGap * 2), imgH + (innerGap * 2));

        // 3. Image Shadow
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.3)";
        ctx.shadowBlur = 20;
        ctx.drawImage(filterCanvas, margin, margin, imgW, imgH);
        ctx.restore();
    }

    else if (frame === 'blurBg') {
        canvas.width = 800; canvas.height = 600;
        ctx.filter = "blur(20px)";
        ctx.drawImage(filterCanvas, 0, 0, 800, 600);
        ctx.filter = "none";
        let s = Math.min(800 / filterCanvas.width, 600 / filterCanvas.height);
        let w = filterCanvas.width * s, h = filterCanvas.height * s;
        ctx.drawImage(filterCanvas, (800 - w) / 2, (600 - h) / 2, w, h);
    }

    else if (frame === 'glassFrame') {
        let margin = imgW * 0.12;
        canvas.width = imgW + (margin * 2);
        canvas.height = imgH + (margin * 2);

        // 1. Background (Blurred & Scaled)
        ctx.save();
        ctx.filter = "blur(30px) brightness(0.85)";
        ctx.drawImage(filterCanvas, -20, -20, canvas.width + 40, canvas.height + 40);
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
        ctx.drawImage(filterCanvas, margin, margin, imgW, imgH);

        ctx.restore();
    }
}

/* ==========================================================================
   CORE ENGINE
   ========================================================================== */

async function applyEffectAndDownload(sourceImg, filter, frame, format, originalName) {
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

    await drawEffectToCanvas(canvas, sourceImg, filter, frame, userPadding, userColor, imgW, imgH, label);

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
    const filter = document.getElementById('filter').value;
    const frame = document.getElementById('frame').value;
    const paddingInput = document.getElementById('paddingInput');
    const colorPicker = document.getElementById('frameColor');
    const colorLabel = document.getElementById('colorlabel');

    const isPol = frame === 'polaroid';
    const isBord = frame === 'border';
    const isMusi = frame === 'gallery';

    // 1. UI Visibility Logic
    document.getElementById('color-disclaimer').style.display = isPol ? 'block' : 'none';
    paddingInput.style.display = (isPol || isBord) ? 'block' : 'none';
    colorPicker.style.display = (isPol || isMusi) ? 'block' : 'none';
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

    if (isPol || isMusi || isBord) {
        colorLabel.classList.remove('hidden');
    } else {
        colorLabel.classList.add('hidden');
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
    const filter = document.getElementById('filter').value;
    const frame = document.getElementById('frame').value;
    const fileInput = document.getElementById('fileInput');
    if (fileInput.files.length === 0) return;

    const previewCanvas = document.getElementById('previewCanvas');

    // Load image
    const img = await loadImage(fileInput.files[0]);

    // Settings
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
        filter,
        frame,
        userPadding,
        userColor,
        imgW,
        imgH,
        label
    );
}

// --- Event Listeners Hub ---
const filterDrop = document.getElementById('filter');
const frameDrop = document.getElementById('frame');
const purposeDrop = document.getElementById('purpose');

if (filterDrop) filterDrop.addEventListener('change', effectChanges);
if (frameDrop) frameDrop.addEventListener('change', effectChanges);
if (purposeDrop) purposeDrop.addEventListener('change', purposeChanges);

// --- Event Listeners for Live Preview ---
document.getElementById('fileInput').addEventListener('change', triggerPreview);
document.getElementById('filter').addEventListener('change', triggerPreview);
document.getElementById('frame').addEventListener('change', triggerPreview);
document.getElementById('frameColor').addEventListener('input', triggerPreview);
document.getElementById('paddingInput').addEventListener('input', triggerPreview);
document.getElementById('polaroidText').addEventListener('input', triggerPreview);

// Initialization
effectChanges();
purposeChanges();
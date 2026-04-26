let currentFiles = [];
let currentIndex = 0;
let cropperInstance = null;

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

/* =========================================
   MANUAL CROP MODE
   ========================================= */
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

    if (cropperInstance) { cropperInstance.destroy(); }

    imageEl.onload = () => {
        cropperInstance = new Cropper(imageEl, {
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

    const croppedCanvas = cropperInstance.getCroppedCanvas({ maxWidth: 1500, maxHeight: 1500 });

    const effect = document.getElementById('effect').value;
    const format = document.getElementById('format').value;
    const file = currentFiles[currentIndex];
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
    finishCropping("Process cancelled.");
}

function finishCropping(customMessage = "All photos processed and saved.") {
    if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
    }
    document.getElementById('cropper-ui').style.display = 'none';
    document.getElementById('main-menu').style.display = 'block';
    document.getElementById('status').innerText = customMessage;

    // Ensure the input stays unchecked when resetting the form
    document.getElementById('fileInput').value = "";
    // document.getElementById('manualCropCheck').checked = false; // Optional: Force it off every time
}

/* =========================================
   BULK AUTO MODE (Skipping Manual Crop)
   ========================================= */
async function runBulkProcess(files) {
    const effect = document.getElementById('effect').value;
    const format = document.getElementById('format').value;

    for (let i = 0; i < files.length; i++) {
        let file = files[i];
        let originalName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

        // Status update for the user
        document.getElementById('status').innerText = `Processing ${i + 1} of ${files.length}...`;

        const img = await loadImage(file);
        await applyEffectAndDownload(img, effect, format, originalName);

        // Small delay to prevent browser download caps
        await new Promise(r => setTimeout(r, 400));
    }
}

/* =========================================
   CORE EFFECT & DOWNLOAD GENERATOR
   ========================================= */
async function applyEffectAndDownload(sourceImg, effect, format, originalName) {
    let ext = format.split('/')[1];
    if (ext === 'jpeg') ext = 'jpg';

    const userColor = document.getElementById('frameColor').value;

    // Manual dimensions
    const mWidth = parseInt(document.getElementById('manualWidth').value);
    const mHeight = parseInt(document.getElementById('manualHeight').value);

    let imgW, imgH;

    if (!isNaN(mWidth) && !isNaN(mHeight)) {
        imgW = mWidth;
        imgH = mHeight;
    } else {
        const maxBounds = 1000;
        let scale = Math.min(maxBounds / sourceImg.width, maxBounds / sourceImg.height);
        if (scale > 1) scale = 1;
        imgW = sourceImg.width * scale;
        imgH = sourceImg.height * scale;
    }

    // 🔥 Padding (safe + clamped)
    let userPadding = parseInt(document.getElementById('paddingInput')?.value);
    if (isNaN(userPadding)) userPadding = 20;

    let maxPad = Math.min(imgW, imgH) * 0.4;
    userPadding = Math.max(0, Math.min(userPadding, maxPad));

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    /* =========================
       PAD SLIDER
    ========================= */
    if (effect === 'padSlider') {
        let boxWidth = imgW + userPadding * 2;
        let boxHeight = imgH + userPadding * 2;

        canvas.width = boxWidth;
        canvas.height = boxHeight;

        ctx.fillStyle = userColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.drawImage(sourceImg, userPadding, userPadding, imgW, imgH);
    }

    /* =========================
       POLAROID (UPGRADED)
    ========================= */
    else if (effect === 'polaroid') {
        let pad = userPadding;
        let bottomPad = Math.max(userPadding * 3, 80);

        let desiredWidth = imgW + (pad * 2);
        let desiredHeight = imgH + pad + bottomPad;

        // 🔥 Safe scaling
        let MAX_CANVAS = 2000;
        let scale = Math.min(1, MAX_CANVAS / desiredWidth, MAX_CANVAS / desiredHeight);

        pad *= scale;
        bottomPad *= scale;
        imgW *= scale;
        imgH *= scale;

        canvas.width = imgW + (pad * 2);
        canvas.height = imgH + pad + bottomPad;

        // Frame
        ctx.fillStyle = userColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Shadow
        ctx.shadowColor = "rgba(0,0,0,0.25)";
        ctx.shadowBlur = 15 * scale;
        ctx.shadowOffsetY = 6 * scale;

        ctx.drawImage(sourceImg, pad, pad, imgW, imgH);

        // Reset shadow
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Text
        const isDark = (color) => {
            const hex = color.replace('#', '');
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);
            return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
        };

        const label = document.getElementById('polaroidText').value;

        if (label) {
            ctx.fillStyle = isDark(userColor) ? "#ffffff" : "#333333";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            const textY = canvas.height - (bottomPad / 2);
            const maxWidth = canvas.width * 0.9;

            let fontSize = Math.max(16 * scale, Math.min(bottomPad * 0.35, 60));

            do {
                ctx.font = `${fontSize}px 'Segoe Script', cursive`;
                fontSize--;
            } while (ctx.measureText(label).width > maxWidth && fontSize > 12 * scale);

            ctx.fillText(label, canvas.width / 2, textY);
        }
    }

    /* =========================
       BORDER
    ========================= */
    else if (effect === 'border') {
        let pad = userPadding;

        canvas.width = imgW + (pad * 2);
        canvas.height = imgH + (pad * 2);

        ctx.fillStyle = userColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.drawImage(sourceImg, pad, pad, imgW, imgH);
    }

    /* =========================
       VINTAGE
    ========================= */
    else if (effect === 'vintage') {
        canvas.width = imgW;
        canvas.height = imgH;

        ctx.drawImage(sourceImg, 0, 0, imgW, imgH);

        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];

            data[i] = (0.393 * r + 0.769 * g + 0.189 * b);
            data[i + 1] = (0.349 * r + 0.686 * g + 0.168 * b);
            data[i + 2] = (0.272 * r + 0.534 * g + 0.131 * b);
        }

        ctx.putImageData(imageData, 0, 0);
    }

    /* =========================
       BLUR BACKGROUND
    ========================= */
    else if (effect === 'blurBg') {
        let boxWidth = 800;
        let boxHeight = 600;

        canvas.width = boxWidth;
        canvas.height = boxHeight;

        ctx.filter = "blur(20px)";
        ctx.drawImage(sourceImg, 0, 0, boxWidth, boxHeight);

        ctx.filter = "none";

        let scale = Math.min(boxWidth / sourceImg.width, boxHeight / sourceImg.height);
        let w = sourceImg.width * scale;
        let h = sourceImg.height * scale;

        let dx = (boxWidth - w) / 2;
        let dy = (boxHeight - h) / 2;

        ctx.drawImage(sourceImg, dx, dy, w, h);
    }

    /* =========================
       DEFAULT
    ========================= */
    else {
        canvas.width = imgW;
        canvas.height = imgH;
        ctx.drawImage(sourceImg, 0, 0, imgW, imgH);
    }

    canvas.toBlob(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `ready_${originalName}.${ext}`;
        link.click();
    }, format, 0.85);
}

document.querySelectorAll("input, select").forEach(el => {
    el.addEventListener("focus", () => {
        el.style.transform = "scale(1.02)";
    });
    el.addEventListener("blur", () => {
        el.style.transform = "scale(1)";
    });
});

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

// Function to toggle the disclaimer
function toggleDisclaimer() {
    const effect = document.getElementById('effect').value;
    const disclaimer = document.getElementById('color-disclaimer');
    const paddingInput = document.getElementById('paddingInput');
    const polaroidText = document.getElementById('polaroidText');

    // 🔹 POLAROID
    if (effect === 'polaroid') {
        disclaimer.style.display = 'block';
        paddingInput.style.display = 'block';

        polaroidText.placeholder = "Enter caption...";
    }

    // 🔹 BORDER
    else if (effect === 'border') {
        disclaimer.style.display = 'none';
        paddingInput.style.display = 'block';

        polaroidText.placeholder = "Caption not used in border";
    }

    // 🔹 ALL OTHER EFFECTS
    else {
        disclaimer.style.display = 'none';
        paddingInput.style.display = 'none';

        polaroidText.placeholder = "Only for polaroid effect";
    }

    polaroidText.disabled = (effect !== 'polaroid');
}

// Add the event listener to the dropdown
document.getElementById('effect').addEventListener('change', toggleDisclaimer);

// Run once on load just in case Polaroid is pre-selected
toggleDisclaimer();
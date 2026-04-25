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

    // Get manual dimensions
    const mWidth = parseInt(document.getElementById('manualWidth').value);
    const mHeight = parseInt(document.getElementById('manualHeight').value);

    let imgW, imgH;

    // Logic: If BOTH Width and Height are provided, use them. 
    // Otherwise, use the default auto-scaling logic.
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

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (effect === 'padSlider') {
        let boxWidth = (!isNaN(mWidth)) ? mWidth : 800;
        let boxHeight = (!isNaN(mHeight)) ? mHeight : 600;

        let fitScale = Math.min(boxWidth / sourceImg.width, boxHeight / sourceImg.height);
        let fitW = sourceImg.width * fitScale;
        let fitH = sourceImg.height * fitScale;

        canvas.width = boxWidth;
        canvas.height = boxHeight;
        ctx.fillStyle = userColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        let dx = (boxWidth - fitW) / 2;
        let dy = (boxHeight - fitH) / 2;
        ctx.drawImage(sourceImg, dx, dy, fitW, fitH);
    }

    else if (effect === 'polaroid') {
        let pad = 10, bottomPad = 70;
        canvas.width = imgW + (pad * 2);
        canvas.height = imgH + pad + bottomPad;

        // STEP 1: Draw the main background frame
        ctx.fillStyle = userColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // STEP 2: Draw the inner shadow (for depth)
        ctx.shadowColor = "rgba(0,0,0,0.3)"; // Slightly darker for better visibility
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 0;
        ctx.strokeRect(pad, pad, imgW, imgH);

        // STEP 3: Draw the image
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 5;
        ctx.drawImage(sourceImg, pad, pad, imgW, imgH);

        // STEP 4: Dynamic Label (Brightness check)
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
            ctx.font = "30px 'Brush Script MT', sans-serif";
            ctx.textAlign = "center";
            // Calculate the middle point of the bottomPad area
            const textY = (canvas.height - bottomPad) + (bottomPad / 2);
            ctx.fillText(label, canvas.width / 2, textY + 10); // +10 to adjust for vertical centering
        }
    }

    else if (effect === 'border') {
        let pad = 10;
        canvas.width = imgW + (pad * 2);
        canvas.height = imgH + (pad * 2);
        ctx.fillStyle = userColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(sourceImg, pad, pad, imgW, imgH);
    }

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

    if (effect === 'polaroid') {
        disclaimer.style.display = 'inline';
    } else {
        disclaimer.style.display = 'none';
    }
}

// Add the event listener to the dropdown
document.getElementById('effect').addEventListener('change', toggleDisclaimer);

// Run once on load just in case Polaroid is pre-selected
toggleDisclaimer();
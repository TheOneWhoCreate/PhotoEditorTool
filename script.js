//Checking for script load
console.log("Script loaded successfully.");

// --- Global State ---
let currentFiles = [];
let currentIndex = 0;
let cropperInstance = null;
let previewTimeout;
let filtersExpanded = false;
let allFilterOptions = [];

// Trigger Debounce
function triggerPreview() {
    clearTimeout(previewTimeout);
    previewTimeout = setTimeout(updatePreview, 150);
}

// Decides between Manual Crop or Bulk Auto mode
async function startProcess() {
    const fileInput = document.getElementById('fileInput');
    const isManualCrop = document.getElementById('manualCropCheck').checked;
    const statusText = document.getElementById('status');
    const purpose = document.getElementById('purpose').value;

    if (fileInput.files.length === 0) {
        statusText.innerText = "Please select some photos first!";
        return;
    }

    // Initialize tracking arrays for bulk passport storage during the cropping session
    window.passportCanvasArray = [];

    // FIX: If it's passport OR manual crop is checked, open the Cropper UI
    if (purpose === "passport" || isManualCrop) {
        currentFiles = Array.from(fileInput.files);
        currentIndex = 0;
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('cropper-ui').style.display = 'block';
        loadNextCropper();
    } else {
        await runBulkProcess(fileInput.files);
        statusText.innerText = "Processing complete. Check your downloads.";
    }
}

// MANUAL CROP MODE (Cropper.js Logic)
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

    const purpose = document.getElementById('purpose').value;
    const filter = document.getElementById('filter').value;
    const frame = document.getElementById('frame').value;
    const format = document.getElementById('format').value;
    const file = currentFiles[currentIndex];
    let originalName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

    if (purpose === "passport") {
        // High-density canvas output for sharp passport printing
        const croppedCanvas = cropperInstance.getCroppedCanvas({ width: 350, height: 450 });

        // Render white background & center image safely if the canvas bounds shift
        const passportCanvas = document.createElement('canvas');
        passportCanvas.width = 350;
        passportCanvas.height = 450;
        const pCtx = passportCanvas.getContext('2d');
        pCtx.fillStyle = "#ffffff";
        pCtx.fillRect(0, 0, 350, 450);
        pCtx.drawImage(croppedCanvas, 0, 0, 350, 450);

        // Save base64 data to the global temporary window array
        window.passportCanvasArray.push(passportCanvas.toDataURL("image/jpeg", 0.95));
    } else {
        // Standard high-quality crop execution path for regular filters/frames
        const croppedCanvas = cropperInstance.getCroppedCanvas({ maxWidth: 1500, maxHeight: 1500 });
        await applyEffectAndDownload(croppedCanvas, filter, frame, format, originalName);
    }

    currentIndex++;

    // Check if we reached the end of the upload batch array
    if (currentIndex >= currentFiles.length) {
        if (purpose === "passport") {
            document.getElementById('status').innerText = "Generating Passport PDF...";
            generatePassportPDF(window.passportCanvasArray);
            finishCropping("Passport PDF sheet generated successfully!");
        } else {
            finishCropping();
        }
    } else {
        loadNextCropper();
    }
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

// DROPDOWN INTERACTION LOGIC:
document.addEventListener("DOMContentLoaded", () => {
    const filterSelect = document.getElementById('filter');
    if (filterSelect) {
        // Backup all filters exactly as written in the markup on load
        allFilterOptions = Array.from(filterSelect.options);
        applyFilterVisibility();
    }
});

function handleFilterDropdownChange(selectElement) {
    // 1. Intercept when the user clicks the special inline action row
    if (selectElement.value === "show-more-toggle") {
        filtersExpanded = !filtersExpanded;
        applyFilterVisibility();

        // CRITICAL FIX: Expand the dropdown physically into a picker box so it stays wide open
        selectElement.size = filterSelectOptionsCount();
        selectElement.focus();
    } else {
        // 2. If they click a REAL filter, make sure to collapse the box back down to a standard dropdown row
        selectElement.size = 1;
    }
}

// Helper to calculate exactly how many items are currently in view so the dropdown box heights match perfectly
function filterSelectOptionsCount() {
    const filterSelect = document.getElementById('filter');
    return filterSelect ? filterSelect.options.length : 1;
}

function applyFilterVisibility() {
    const filterSelect = document.getElementById('filter');
    if (!filterSelect) return;

    const currentValue = filterSelect.value;
    filterSelect.innerHTML = "";

    allFilterOptions.forEach(option => {
        if (option.value === "show-more-toggle") {
            const toggleClone = option.cloneNode(true);
            toggleClone.innerText = filtersExpanded ? "↩ Show Less Filters..." : "✨ Show More Filters...";
            filterSelect.appendChild(toggleClone);
        } else if (filtersExpanded || !option.classList.contains('extended-filter')) {
            filterSelect.appendChild(option.cloneNode(true));
        }
    });

    // Restore selected values or fall back gracefully
    if (currentValue !== "show-more-toggle") {
        filterSelect.value = currentValue;
    }
    if (filterSelect.selectedIndex === -1) {
        filterSelect.value = "none";
    }
}

// Add an extra listener: If the user clicks away or drops focus completely, collapse the dropdown safely
const filterDropNode = document.getElementById('filter');
if (filterDropNode) {
    filterDropNode.addEventListener('blur', () => {
        filterDropNode.size = 1;
    });
}

// BULK AUTO MODE
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

// PASSPORT
async function runPassportProcess(files) {
    const images = [];

    for (let i = 0; i < files.length; i++) {
        const img = await loadImage(files[i]);

        // Create a canvas calibrated specifically for a clean 35:45 printable aspect ratio
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Standard 350x450 pixel scale (maintains high-density print output)
        const w = 350;
        const h = 450;

        canvas.width = w;
        canvas.height = h;

        // Clean white backing block
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);

        // Portrait cropping simulation logic: Crop from the center-top (ideal for faces)
        const targetAspect = w / h;
        const inputAspect = img.width / img.height;

        let sourceX = 0, sourceY = 0, sourceWidth = img.width, sourceHeight = img.height;

        if (inputAspect > targetAspect) {
            // Image is too wide (Landscape): Crop the left and right sides
            sourceWidth = img.height * targetAspect;
            sourceX = (img.width - sourceWidth) / 2;
        } else if (inputAspect < targetAspect) {
            // Image is too tall (Portrait): Crop the bottom portion (keeps eyes/head centered)
            sourceHeight = img.width / targetAspect;
            sourceY = (img.height - sourceHeight) * 0.2; // Anchors slightly higher up the frame
        }

        ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, w, h);
        images.push(canvas.toDataURL("image/jpeg", 0.95));
    }

    generatePassportPDF(images);
}

function generatePassportPDF(images) {
    const { jsPDF } = window.jspdf;

    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });

    const pageW = 210;
    const pageH = 297;
    const imgW = 35;
    const imgH = 45;

    const cols = 5;
    const rows = 6;
    const maxPhotos = cols * rows; // Total 30 slots

    const gapX = 2.5;
    const gapY = 3.0;

    const totalGridWidth = (cols * imgW) + ((cols - 1) * gapX);
    const totalGridHeight = (rows * imgH) + ((rows - 1) * gapY);

    const startX = (pageW - totalGridWidth) / 2;
    const startY = (pageH - totalGridHeight) / 2;

    // Loop exactly 30 times to fill up every single slot on the printable page
    for (let i = 0; i < maxPhotos; i++) {
        // Use modulo (%) to cycle through available images repeatedly
        // If you upload 1 photo, it uses index 0 every time. If you upload 3, it cycles 0,1,2,0,1,2...
        const imageIndex = i % images.length;

        // Calculate columns (c) and rows (r) from the single master index loop
        const c = i % cols;
        const r = Math.floor(i / cols);

        const xPos = startX + c * (imgW + gapX);
        const yPos = startY + r * (imgH + gapY);

        doc.addImage(
            images[imageIndex],
            "JPEG",
            xPos,
            yPos,
            imgW,
            imgH,
            `passport_slot_${i}`, // Unique cache alias per slot prevents rendering glitches
            "FAST"
        );
    }

    doc.save("passport_print_sheet.pdf");
}

// CORE ENGINE
async function applyEffectAndDownload(sourceImg, filter, frame, format, originalName) {
    let ext = format.split('/')[1] === 'jpeg' ? 'jpg' : format.split('/')[1];

    // 1. Determine target dimensions (Normalization)
    const maxBounds = 1200; // Standardize output size for consistent effect look
    let scale = Math.min(maxBounds / sourceImg.width, maxBounds / sourceImg.height, 1);

    let targetW = sourceImg.width * scale;
    let targetH = sourceImg.height * scale;

    // 2. Build the Config
    const config = {
        userColor: document.getElementById('frameColor').value,
        userPadding: (parseInt(document.getElementById('paddingInput')?.value) || 20) * scale,
        label: document.getElementById('polaroidText').value,
        imgW: targetW,
        imgH: targetH
    };

    const canvas = document.createElement('canvas');

    // 3. Run the Engine
    await EffectsEngine.draw(canvas, sourceImg, filter, frame, config);

    // Download Logic
    const quality = format === "image/png" ? undefined : 0.85;
    canvas.toBlob(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Modified_${originalName}.${ext}`;
        link.click();
    }, format, quality);
}

// UTILITIES
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

// EVENT LISTENERS
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
    const fileInput = document.getElementById('fileInput');
    if (fileInput.files.length === 0) return;

    const filter = document.getElementById('filter').value;
    const frame = document.getElementById('frame').value;
    const previewCanvas = document.getElementById('previewCanvas');

    // 1. Load the image
    const img = await loadImage(fileInput.files[0]);

    // 2. Calculate Scale for the Preview (e.g., max 400px)
    const maxPreview = 400;
    let scale = Math.min(maxPreview / img.width, maxPreview / img.height, 1);

    // 3. Build the Preview Config
    const config = {
        userColor: document.getElementById('frameColor').value,
        // Scale the padding so the preview looks like the final download
        userPadding: (parseInt(document.getElementById('paddingInput')?.value) || 20) * scale,
        label: document.getElementById('polaroidText').value,
        imgW: img.width * scale,
        imgH: img.height * scale
    };

    // 4. Use the engine!
    await EffectsEngine.draw(previewCanvas, img, filter, frame, config);
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


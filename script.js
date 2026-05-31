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

// Passport Studio execution path with manual crop awareness and automatic reset
async function startPassportProcess() {
    const fileInput = document.getElementById('fileInput');
    const isManualCrop = document.getElementById('passportManualCropCheck').checked;
    const statusText = document.getElementById('status');

    if (!fileInput || fileInput.files.length === 0) {
        statusText.innerText = "Please select some photos first!";
        return;
    }

    // Initialize state
    window.passportCanvasArray = [];
    window.isPassportWorkflow = true; // <-- Add this state tracker line!

    if (!isManualCrop) {
        statusText.innerText = "Generating Passport PDF Sheet...";
        await runPassportProcess(fileInput.files);
        statusText.innerText = "Passport PDF sheet generated successfully!";

        // Reset state tracker when done
        window.isPassportWorkflow = false;
    } else {
        currentFiles = Array.from(fileInput.files);
        currentIndex = 0;
        document.getElementById('main-menu').style.display = 'none';
        document.querySelector('.top-nav-header').style.display = 'none';
        document.querySelector('.bottom-nav-footer').style.display = 'none';
        document.getElementById('cropper-ui').style.display = 'block';
        loadNextCropper();
    }
}

// Normal batch image loop operations control
async function startProcess() {
    const fileInput = document.getElementById('fileInput');
    const isManualCrop = document.getElementById('manualCropCheck').checked;
    const statusText = document.getElementById('status');

    if (!fileInput || fileInput.files.length === 0) {
        statusText.innerText = "Please select some photos first!";
        return;
    }

    // Explicitly guarantee passport workflow flag is dropped for standard operations
    window.isPassportWorkflow = false;
    window.passportCanvasArray = [];

    if (isManualCrop) {
        currentFiles = Array.from(fileInput.files);
        currentIndex = 0;
        document.getElementById('main-menu').style.display = 'none';
        document.querySelector('.top-nav-header').style.display = 'none';
        document.querySelector('.bottom-nav-footer').style.display = 'none';
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

    if (window.currentCropperBlobUrl) {
        URL.revokeObjectURL(window.currentCropperBlobUrl);
    }
    window.currentCropperBlobUrl = url; // Track the current active URL

    imageEl.src = url;

    if (cropperInstance) { cropperInstance.destroy(); }

    const purpose = document.getElementById('purpose').value;
    let targetRatio = NaN;

    if (window.isPassportWorkflow) {
        targetRatio = 35 / 45;
    } else {
        if (purpose === 'insta-feed (3:4)') targetRatio = 3 / 4;
        if (purpose === 'insta-feed (4:5)') targetRatio = 4 / 5;
        if (purpose === 'insta-square') targetRatio = 1 / 1;
    }

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

    if (window.isPassportWorkflow) {
        const croppedCanvas = cropperInstance.getCroppedCanvas({ width: 350, height: 450 });

        const passportCanvas = document.createElement('canvas');
        passportCanvas.width = 350;
        passportCanvas.height = 450;
        const pCtx = passportCanvas.getContext('2d');
        pCtx.fillStyle = "#ffffff";
        pCtx.fillRect(0, 0, 350, 450);
        pCtx.drawImage(croppedCanvas, 0, 0, 350, 450);

        window.passportCanvasArray.push(passportCanvas.toDataURL("image/jpeg", 0.95));
    } else {
        const croppedCanvas = cropperInstance.getCroppedCanvas({ maxWidth: 1500, maxHeight: 1500 });
        await applyEffectAndDownload(croppedCanvas, filter, frame, format, originalName);
    }

    currentIndex++;

    if (currentIndex >= currentFiles.length) {
        // Switch the final loop routing checkpoint to use the flag too 👇
        if (window.isPassportWorkflow) {
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
    if (!confirm("Are you sure? This will cancel the current session and you'll lose any un-saved crops.")) {
        return;
    }

    if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
    }

    document.getElementById('cropper-ui').style.display = 'none';
    document.getElementById('main-menu').style.display = 'grid';
    document.querySelector('.top-nav-header').style.display = 'flex';
    document.querySelector('.bottom-nav-footer').style.display = 'flex';

    document.getElementById('purpose').value = "custom";
    purposeChanges();

    currentIndex = 0;
    currentFiles = [];
    document.getElementById('fileInput').value = "";
    document.getElementById('status').innerText = "Session cancelled.";

    if (window.currentCropperBlobUrl) {
        URL.revokeObjectURL(window.currentCropperBlobUrl);
        window.currentCropperBlobUrl = null;
    }
}

function finishCropping(customMessage = "All photos processed and saved.") {
    if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
    }
    document.getElementById('cropper-ui').style.display = 'none';
    document.getElementById('main-menu').style.display = 'grid';
    document.querySelector('.top-nav-header').style.display = 'flex';
    document.querySelector('.bottom-nav-footer').style.display = 'flex';
    document.getElementById('status').innerText = customMessage;

    document.getElementById('purpose').value = "custom";
    purposeChanges();

    document.getElementById('fileInput').value = "";

    if (window.currentCropperBlobUrl) {
        URL.revokeObjectURL(window.currentCropperBlobUrl);
        window.currentCropperBlobUrl = null;
    }
}

// DROPDOWN INTERACTION LOGIC
document.addEventListener("DOMContentLoaded", () => {
    const filterSelect = document.getElementById('filter');
    if (filterSelect) {
        allFilterOptions = Array.from(filterSelect.options);
        applyFilterVisibility();
    }
});

function handleFilterDropdownChange(selectElement) {
    if (selectElement.value === "show-more-toggle") {
        filtersExpanded = !filtersExpanded;
        applyFilterVisibility();
        selectElement.size = filterSelectOptionsCount();
        selectElement.focus();
    } else {
        selectElement.size = 1;
    }
}

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
            toggleClone.innerText = filtersExpanded ? "Show Less Filters..." : "Show More Filters...";
            filterSelect.appendChild(toggleClone);
        } else if (filtersExpanded || !option.classList.contains('extended-filter')) {
            filterSelect.appendChild(option.cloneNode(true));
        }
    });

    if (currentValue !== "show-more-toggle") {
        filterSelect.value = currentValue;
    }
    if (filterSelect.selectedIndex === -1) {
        filterSelect.value = "none";
    }
}

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
        await new Promise(r => setTimeout(r, 400));
    }
}

// PASSPORT AUTO-COMPOSITION ENGINE
async function runPassportProcess(files) {
    const images = [];

    for (let i = 0; i < files.length; i++) {
        const img = await loadImage(files[i]);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const w = 350;
        const h = 450;

        canvas.width = w;
        canvas.height = h;

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);

        const targetAspect = w / h;
        const inputAspect = img.width / img.height;

        let sourceX = 0, sourceY = 0, sourceWidth = img.width, sourceHeight = img.height;

        if (inputAspect > targetAspect) {
            sourceWidth = img.height * targetAspect;
            sourceX = (img.width - sourceWidth) / 2;
        } else if (inputAspect < targetAspect) {
            sourceHeight = img.width / targetAspect;
            sourceY = (img.height - sourceHeight) * 0.2;
        }

        ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, w, h);
        images.push(canvas.toDataURL("image/jpeg", 0.95));
    }

    generatePassportPDF(images);
}

// DYNAMIC PASSPORT CONFIGURATION ENGINE
function generatePassportPDF(images) {
    const { jsPDF } = window.jspdf;

    // Read requested configuration layout matrix from UI selection
    const layoutConfig = document.getElementById('passportLayout')?.value || "pic30";

    let cols = 5;
    let rows = 6;
    let isCustom8pic = false;

    if (layoutConfig === "pic8") {
        cols = 4;
        rows = 2;
        isCustom8pic = true; // Flag to change page size to 4 x 6 inches
    } else if (layoutConfig === "pic24") {
        cols = 4;
        rows = 6;
    }

    // Define page dimensions dynamically based on layout choice
    let pageW, pageH, orientationSetting, formatSetting;

    if (isCustom8pic) {
        // 4 x 6 inches in mm = 101.6mm x 152.4mm
        orientationSetting = "landscape";
        formatSetting = [101.6, 152.4];
        pageW = 152.4; // Width is the larger side in landscape
        pageH = 101.6; // Height is the shorter side in landscape
    } else {
        // Default standard A4 Portrait settings for other layouts
        orientationSetting = "portrait";
        formatSetting = "a4";
        pageW = 210;
        pageH = 297;
    }

    const doc = new jsPDF({
        orientation: orientationSetting,
        unit: "mm",
        format: formatSetting
    });

    // Passport photo size specifications (35mm x 45mm)
    const imgW = 35;
    const imgH = 45;

    const maxPhotos = cols * rows;

    // Adjusted gaps slightly smaller for pic24 inch constraint fit
    const gapX = isCustom8pic ? 2.0 : 4.0;
    const gapY = (layoutConfig === "pic24") ? 2.5 : (isCustom8pic ? 2.0 : 4.0);

    const totalGridWidth = (cols * imgW) + ((cols - 1) * gapX);
    const totalGridHeight = (rows * imgH) + ((rows - 1) * gapY);

    // Center the grid onto the selected page frame dimension bounds
    const startX = (pageW - totalGridWidth) / 2;
    let startY = (pageH - totalGridHeight) / 2;

    // Maintain your legacy manual override offsets only on standard A4 template modes
    if (!isCustom8pic) {
        if (layoutConfig === "pic24") {
            // Safe centered distribution limit for 24 pictures
            if (startY < 8) startY = 8;
        }
    }

    for (let i = 0; i < maxPhotos; i++) {
        const imageIndex = i % images.length;

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
            `passport_slot_${i}`,
            "FAST"
        );

        doc.saveGraphicsState();
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.4); // Made border lines a bit thinner for small prints
        doc.rect(xPos, yPos, imgW, imgH, "S");
        doc.restoreGraphicsState();
    }

    doc.save(`passport_print_${layoutConfig}.pdf`);
}

// CORE ENGINE
async function applyEffectAndDownload(sourceImg, filter, frame, format, originalName) {
    let ext = format.split('/')[1] === 'jpeg' ? 'jpg' : format.split('/')[1];

    const maxBounds = 1200;
    let scale = Math.min(maxBounds / sourceImg.width, maxBounds / sourceImg.height, 1);

    let targetW = sourceImg.width * scale;
    let targetH = sourceImg.height * scale;

    const config = {
        userColor: document.getElementById('frameColor').value,
        userPadding: (parseInt(document.getElementById('paddingInput')?.value) || 20) * scale,
        label: document.getElementById('polaroidText').value,
        imgW: targetW,
        imgH: targetH
    };

    const canvas = document.createElement('canvas');
    await EffectsEngine.draw(canvas, sourceImg, filter, frame, config);

    const quality = format === "image/png" ? undefined : 0.85;
    canvas.toBlob(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Modified_${originalName}.${ext}`;
        link.click();
    }, format, quality);
}

// DYNAMIC GLOBAL THEME INTERACTION CONTROLLER 
function toggleWorkspaceTheme() {
    const isChecked = document.getElementById('themeToggleCheckbox').checked;

    if (isChecked) {
        // Apply dark attributes to document node element
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.classList.add('dark-mode-gradient');
        localStorage.setItem('workspaceThemeSetting', 'dark'); // Save user preference
    } else {
        // Reset document back to core factory default light scheme
        document.documentElement.removeAttribute('data-theme');
        document.body.classList.remove('dark-mode-gradient');
        localStorage.setItem('workspaceThemeSetting', 'light');
    }
}

// Auto-Load saved theme preference when the page initializes
document.addEventListener("DOMContentLoaded", () => {
    const savedTheme = localStorage.getItem('workspaceThemeSetting');
    const themeCheckbox = document.getElementById('themeToggleCheckbox');

    if (savedTheme === 'dark' && themeCheckbox) {
        themeCheckbox.checked = true;
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.classList.add('dark-mode-gradient');
    }
});

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
    const frame = document.getElementById('frame').value;
    const paddingInput = document.getElementById('paddingInput');
    const colorPicker = document.getElementById('frameColor');
    const colorLabel = document.getElementById('colorlabel');

    if (!paddingInput || !colorPicker || !colorLabel) return;

    const isPol = frame === 'polaroid';
    const isBord = frame === 'border';
    const isMusi = frame === 'gallery';

    document.getElementById('color-disclaimer').style.display = isPol ? 'block' : 'none';
    paddingInput.style.display = (isPol || isBord) ? 'block' : 'none';
    colorPicker.style.display = (isPol || isMusi) ? 'block' : 'none';
    document.getElementById('polaroidText').style.display = isPol ? 'block' : 'none';
    document.getElementById('caption').style.display = isPol ? 'block' : 'none';

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

    if (!manualCropCheck) return;

    if (purpose.includes('insta')) {
        manualCropCheck.checked = true;
        manualCropCheck.disabled = true;
        manualCropCheck.parentElement.style.border = "1.5px solid var(--primary)";
    } else {
        manualCropCheck.checked = false;
        manualCropCheck.disabled = false;
        manualCropCheck.parentElement.style.border = "1px solid #eee";
    }

    // Clean up dimensions if resetting to custom defaults 
    if (purpose === "custom") {
        document.getElementById('manualWidth').value = "";
        document.getElementById('manualHeight').value = "";
    }
}

// LIVE PREVIEW
async function updatePreview() {
    const fileInput = document.getElementById('fileInput');
    if (!fileInput || fileInput.files.length === 0) return;

    const filter = document.getElementById('filter').value;
    const frame = document.getElementById('frame').value;
    const previewCanvas = document.getElementById('previewCanvas');

    const img = await loadImage(fileInput.files[0]);

    const maxPreview = 400;
    let scale = Math.min(maxPreview / img.width, maxPreview / img.height, 1);

    const config = {
        userColor: document.getElementById('frameColor').value,
        userPadding: (parseInt(document.getElementById('paddingInput')?.value) || 20) * scale,
        label: document.getElementById('polaroidText').value,
        imgW: img.width * scale,
        imgH: img.height * scale
    };

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
const fileInpNode = document.getElementById('fileInput');
if (fileInpNode) fileInpNode.addEventListener('change', triggerPreview);
if (filterDrop) filterDrop.addEventListener('change', triggerPreview);
if (frameDrop) frameDrop.addEventListener('change', triggerPreview);

const fColorNode = document.getElementById('frameColor');
const pInputNode = document.getElementById('paddingInput');
const pTextNode = document.getElementById('polaroidText');

if (fColorNode) fColorNode.addEventListener('input', triggerPreview);
if (pInputNode) pInputNode.addEventListener('input', triggerPreview);
if (pTextNode) pTextNode.addEventListener('input', triggerPreview);

// Initialization
effectChanges();
purposeChanges();

// GLOBAL WORKSPACE RESET CONTROLLER
function resetGlobalWorkspace() {
    // 1. Terminate active cropper engines and clean memory leak allocations
    if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
    }
    if (window.currentCropperBlobUrl) {
        URL.revokeObjectURL(window.currentCropperBlobUrl);
        window.currentCropperBlobUrl = null;
    }

    // 2. Flush internal file pipeline matrices data queues
    currentFiles = [];
    currentIndex = 0;
    window.passportCanvasArray = [];
    window.isPassportWorkflow = false;

    // 3. Reset standard HTML input form text fields completely
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = "";

    const manualWidth = document.getElementById('manualWidth');
    const manualHeight = document.getElementById('manualHeight');
    const polaroidText = document.getElementById('polaroidText');

    if (manualWidth) manualWidth.value = "";
    if (manualHeight) manualHeight.value = "";
    if (polaroidText) polaroidText.value = "";

    // 4. Force dropdown selector values back to factory defaults
    if (document.getElementById('purpose')) document.getElementById('purpose').value = "custom";
    if (document.getElementById('format')) document.getElementById('format').value = "image/png";
    if (document.getElementById('filter')) document.getElementById('filter').value = "none";
    if (document.getElementById('frame')) document.getElementById('frame').value = "none";
    if (document.getElementById('passportLayout')) document.getElementById('passportLayout').value = "5x6";

    // 5. Reset manual checkbox markers safely
    const manualCropCheck = document.getElementById('manualCropCheck');
    const passportManualCropCheck = document.getElementById('passportManualCropCheck');
    if (manualCropCheck) manualCropCheck.checked = false;
    if (passportManualCropCheck) passportManualCropCheck.checked = true;

    // 6. Refresh UI visibility alignments panels
    purposeChanges();
    effectChanges();

    // 7. Wipe out preview canvases rendering boxes frames
    const previewCanvas = document.getElementById('previewCanvas');
    if (previewCanvas) {
        const pCtx = previewCanvas.getContext('2d');
        pCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    }

    // 8. Reset Workspace status message logger board
    const statusText = document.getElementById('status');
    if (statusText) {
        statusText.innerText = "Workspace cleared.";
        setTimeout(() => {
            if (statusText.innerText === "Workspace cleared.") statusText.innerText = "";
        }, 3000);
    }
}

const dropZone = document.getElementById('dropZoneContainer');
const fileInput = document.getElementById('fileInput');

// Trigger browse when clicking the zone
dropZone.addEventListener('click', () => fileInput.click());

// Drag effects
['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-active');
    }, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-active');
    }, false);
});

// Handle dropped files
dropZone.addEventListener('drop', (e) => {
    fileInput.files = e.dataTransfer.files;
    triggerPreview(); // Fire your live preview engine instantly
});
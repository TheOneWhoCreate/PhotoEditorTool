console.log("Script loaded successfully.");

// --- Global State ---
let currentFiles = [];
let currentIndex = 0;
let cropperInstance = null;
let previewTimeout;
let filtersExpanded = false;
let allFilterOptions = [];

// --- UI Layout Controllers (Tabs & Menu) ---
function switchTab(tabId, clickedButton) {
    document.querySelectorAll('.tab-section').forEach(tab => {
        tab.style.display = 'none';
        tab.classList.remove('active-tab');
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        targetTab.style.display = 'block';
        targetTab.classList.add('active-tab');
    }

    if (clickedButton) {
        clickedButton.classList.add('active');
    }
}

function toggleMobileMenu() {
    const navTabs = document.getElementById('navTabs');
    if (navTabs) {
        navTabs.classList.toggle('show');
    }
}

// Trigger Debounce
function triggerPreview() {
    clearTimeout(previewTimeout);
    previewTimeout = setTimeout(updatePreview, 150);
}

function clearPhotoWorkspaceSelection() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = "";
    renderUploadQueue([]);
    const previewCanvas = document.getElementById('previewCanvas');
    if (previewCanvas) {
        previewCanvas.getContext('2d').clearRect(0, 0, previewCanvas.width, previewCanvas.height);
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

    window.isPassportWorkflow = false;
    window.passportCanvasArray = [];

    if (isManualCrop) {
        currentFiles = Array.from(fileInput.files);
        currentIndex = 0;
        document.getElementById('main-content-box').style.display = 'none';
        document.querySelector('.top-nav-header').style.display = 'none';
        document.getElementById('cropper-ui').style.display = 'block';
        loadNextCropper();
    } else {
        await runBulkProcess(fileInput.files);
        statusText.innerText = "Processing complete. Check your downloads.";
        clearPhotoWorkspaceSelection();
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
    window.currentCropperBlobUrl = url;

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

    // Toggle aspect ratio select visibility and value in cropper UI
    const ratioControls = document.querySelector('.cropper-aspect-controls');
    if (window.isPassportWorkflow) {
        if (ratioControls) ratioControls.style.display = 'none';
    } else {
        if (ratioControls) ratioControls.style.display = 'flex';
        const ratioSelect = document.getElementById('cropperRatioSelect');
        if (ratioSelect) {
            if (purpose === 'insta-feed (3:4)') ratioSelect.value = '3:4';
            else if (purpose === 'insta-feed (4:5)') ratioSelect.value = '4:5';
            else if (purpose === 'insta-square') ratioSelect.value = '1:1';
            else ratioSelect.value = 'free';
        }
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
            ready: function() {
                if (window.isPassportWorkflow) {
                    const cropBox = document.querySelector('.cropper-crop-box');
                    if (cropBox && !document.getElementById('passport-alignment-guide')) {
                        const guide = document.createElement('div');
                        guide.id = 'passport-alignment-guide';
                        guide.innerHTML = `
                            <div class="guide-oval"></div>
                            <div class="guide-shoulders"></div>
                        `;
                        cropBox.appendChild(guide);
                    }
                }
            }
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
        if (window.isPassportWorkflow) {
            document.getElementById('passportStatus').innerText = "Generating Passport PDF...";
            const exportFormat = document.getElementById('passportExportFormat')?.value || "application/pdf";

            // Expand the cropped canvases according to selected quantities!
            const expandedCanvasArray = [];
            currentFiles.forEach((file, idx) => {
                const key = file.name + '_' + file.size;
                const qty = window.passportQuantities[key] || 1;
                const dataUrl = window.passportCanvasArray[idx];
                if (dataUrl) {
                    for (let q = 0; q < qty; q++) {
                        expandedCanvasArray.push(dataUrl);
                    }
                }
            });

            if (exportFormat === "application/pdf") {
                generatePassportPDF(expandedCanvasArray);
                finishCropping("Passport PDF sheet generated successfully!");
            } else {
                await generatePassportImage(expandedCanvasArray, exportFormat);
                finishCropping(`Passport sheet generated successfully!`);
            }
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
    if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
    document.getElementById('cropper-ui').style.display = 'none';
    document.getElementById('main-content-box').style.display = 'block';
    document.querySelector('.top-nav-header').style.display = 'flex';
    document.getElementById('purpose').value = "custom";
    purposeChanges();
    currentIndex = 0;
    currentFiles = [];
    document.getElementById('fileInput').value = "";
    document.getElementById('status').innerText = "Session cancelled.";
    if (window.currentCropperBlobUrl) { URL.revokeObjectURL(window.currentCropperBlobUrl); window.currentCropperBlobUrl = null; }
}

function finishCropping(customMessage = "All photos processed and saved.") {
    if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
    document.getElementById('cropper-ui').style.display = 'none';
    document.getElementById('main-content-box').style.display = 'block';
    document.querySelector('.top-nav-header').style.display = 'flex';

    if (window.isPassportWorkflow) {
        document.getElementById('passportStatus').innerText = customMessage;
        if (window.resetPassportFiles) window.resetPassportFiles();
    } else {
        document.getElementById('status').innerText = customMessage;
        clearPhotoWorkspaceSelection();
    }

    document.getElementById('purpose').value = "custom";
    purposeChanges();
    if (window.currentCropperBlobUrl) { URL.revokeObjectURL(window.currentCropperBlobUrl); window.currentCropperBlobUrl = null; }
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
    if (currentValue !== "show-more-toggle") filterSelect.value = currentValue;
    if (filterSelect.selectedIndex === -1) filterSelect.value = "none";
}

const filterDropNode = document.getElementById('filter');
if (filterDropNode) filterDropNode.addEventListener('blur', () => filterDropNode.size = 1);

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
        imgH: targetH,
        watermarkText: document.getElementById('watermarkText')?.value || "",
        watermarkPlacement: document.getElementById('watermarkPlacement')?.value || "bottom-right",
        watermarkOpacity: parseFloat(document.getElementById('watermarkOpacity')?.value) || 0.4
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

// THEME TOGGLE
function toggleWorkspaceTheme() {
    const isChecked = document.getElementById('themeToggleCheckbox').checked;
    if (isChecked) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.classList.add('dark-mode-gradient');
        localStorage.setItem('workspaceThemeSetting', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
        document.body.classList.remove('dark-mode-gradient');
        localStorage.setItem('workspaceThemeSetting', 'light');
    }
}

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

function effectChanges() {
    const frame = document.getElementById('frame').value;
    const paddingInput = document.getElementById('paddingInput');
    const colorPicker = document.getElementById('frameColor');
    const colorLabel = document.getElementById('colorlabel');

    if (!paddingInput || !colorPicker || !colorLabel) return;

    const isPol = frame === 'polaroid';
    const isBord = frame === 'border';
    const isMusi = frame === 'gallery';
    const isGlass = frame === 'glassFrame';
    const isStamp = frame === 'postageStamp';
    const isArt = frame === 'artMount';
    const isNeon = frame === 'neonGlow';
    const isPostcard = frame === 'postcard';

    document.getElementById('color-disclaimer').style.display = isPol ? 'block' : 'none';
    paddingInput.style.display = (isPol || isBord || isGlass || isStamp || isArt || isNeon) ? 'block' : 'none';
    colorPicker.style.display = (isPol || isMusi || isArt || isNeon) ? 'block' : 'none';
    document.getElementById('polaroidText').style.display = isPol ? 'block' : 'none';
    document.getElementById('caption').style.display = isPol ? 'block' : 'none';

    if (isNeon) {
        colorLabel.childNodes[0].nodeValue = "Neon Glow Color ";
    } else {
        colorLabel.childNodes[0].nodeValue = "Frame/Background Color ";
    }

    if (isPol) {
        paddingInput.value = 20;
        colorPicker.value = "#ffffff";
    } else if (isBord) {
        paddingInput.value = 2;
    } else if (isGlass) {
        paddingInput.value = 40;
      } else if (isStamp) {
        paddingInput.value = 28;
    } else if (isArt) {
        paddingInput.value = 40;
        colorPicker.value = "#f7f5f0";
    } else if (isNeon) {
        paddingInput.value = 15;
        colorPicker.value = "#3b82f6";
    } else {
        paddingInput.value = 0;
    }

    if (isPol || isMusi || isBord || isArt || isNeon) { colorLabel.classList.remove('hidden'); }
    else { colorLabel.classList.add('hidden'); }
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
    const maxPreview = 550;
    let scale = Math.min(maxPreview / img.width, maxPreview / img.height, 1);
    const config = {
        userColor: document.getElementById('frameColor').value,
        userPadding: (parseInt(document.getElementById('paddingInput')?.value) || 20) * scale,
        label: document.getElementById('polaroidText').value,
        imgW: img.width * scale,
        imgH: img.height * scale,
        watermarkText: document.getElementById('watermarkText')?.value || "",
        watermarkPlacement: document.getElementById('watermarkPlacement')?.value || "bottom-right",
        watermarkOpacity: parseFloat(document.getElementById('watermarkOpacity')?.value) || 0.4
    };
    await EffectsEngine.draw(previewCanvas, img, filter, frame, config);
}

const filterDrop = document.getElementById('filter');
const frameDrop = document.getElementById('frame');
const purposeDrop = document.getElementById('purpose');
if (filterDrop) filterDrop.addEventListener('change', effectChanges);
if (frameDrop) frameDrop.addEventListener('change', effectChanges);
if (purposeDrop) purposeDrop.addEventListener('change', purposeChanges);

const fileInpNode = document.getElementById('fileInput');
if (fileInpNode) fileInpNode.addEventListener('change', triggerPreview);
if (filterDrop) filterDrop.addEventListener('change', triggerPreview);
if (frameDrop) frameDrop.addEventListener('change', triggerPreview);
if (fileInpNode) {
    fileInpNode.addEventListener('change', (e) => {
        renderUploadQueue(e.target.files);
        triggerPreview();
    });
}
const fColorNode = document.getElementById('frameColor');
const pInputNode = document.getElementById('paddingInput');
const pTextNode = document.getElementById('polaroidText');
if (fColorNode) fColorNode.addEventListener('input', triggerPreview);
if (pInputNode) pInputNode.addEventListener('input', triggerPreview);
if (pTextNode) pTextNode.addEventListener('input', triggerPreview);

effectChanges();
purposeChanges();

function resetGlobalWorkspace() {
    if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
    if (window.currentCropperBlobUrl) { URL.revokeObjectURL(window.currentCropperBlobUrl); window.currentCropperBlobUrl = null; }
    currentFiles = [];
    currentIndex = 0;
    window.passportCanvasArray = [];
    window.isPassportWorkflow = false;
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = "";
    renderUploadQueue([]);
    if (document.getElementById('manualWidth')) document.getElementById('manualWidth').value = "";
    if (document.getElementById('manualHeight')) document.getElementById('manualHeight').value = "";
    if (document.getElementById('polaroidText')) document.getElementById('polaroidText').value = "";
    if (document.getElementById('watermarkText')) document.getElementById('watermarkText').value = "";
    if (document.getElementById('watermarkPlacement')) document.getElementById('watermarkPlacement').value = "bottom-right";
    if (document.getElementById('watermarkOpacity')) document.getElementById('watermarkOpacity').value = "0.4";
    if (document.getElementById('purpose')) document.getElementById('purpose').value = "custom";
    if (document.getElementById('format')) document.getElementById('format').value = "image/png";
    if (document.getElementById('filter')) document.getElementById('filter').value = "none";
    if (document.getElementById('frame')) document.getElementById('frame').value = "none";
    if (document.getElementById('passportLayout')) document.getElementById('passportLayout').value = "pic30";
    if (document.getElementById('manualCropCheck')) document.getElementById('manualCropCheck').checked = false;
    if (document.getElementById('passportManualCropCheck')) document.getElementById('passportManualCropCheck').checked = true;
    purposeChanges();
    effectChanges();
    const previewCanvas = document.getElementById('previewCanvas');
    if (previewCanvas) previewCanvas.getContext('2d').clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    const statusText = document.getElementById('status');
    if (statusText) {
        statusText.innerText = "Workspace cleared.";
        setTimeout(() => { if (statusText.innerText === "Workspace cleared.") statusText.innerText = ""; }, 3000);
    }
}

const dropZone = document.getElementById('dropZoneContainer');
const fileInputUI = document.getElementById('fileInput');
dropZone.addEventListener('click', () => fileInputUI.click());
['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => { e.preventDefault(); dropZone.classList.add('drag-active'); }, false);
});
['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => { e.preventDefault(); dropZone.classList.remove('drag-active'); }, false);
});
dropZone.addEventListener('drop', (e) => {
    fileInputUI.files = e.dataTransfer.files;
    renderUploadQueue(fileInputUI.files);
    triggerPreview();
});

function renderUploadQueue(files) {
    const counterBadge = document.getElementById('uploadQueue');
    const counterDisplay = document.getElementById('queue-counter-total');
    if (!counterBadge || !counterDisplay) return;
    if (!files || files.length === 0) {
        counterBadge.style.display = "none";
        return;
    }
    counterDisplay.innerText = files.length;
    counterBadge.style.display = "flex";
}

// Watermark event listeners
document.addEventListener("DOMContentLoaded", () => {
    const wTextNode = document.getElementById('watermarkText');
    const wPlacementNode = document.getElementById('watermarkPlacement');
    const wOpacityNode = document.getElementById('watermarkOpacity');
    if (wTextNode) wTextNode.addEventListener('input', triggerPreview);
    if (wPlacementNode) wPlacementNode.addEventListener('change', triggerPreview);
    if (wOpacityNode) wOpacityNode.addEventListener('input', triggerPreview);
});

// Cropper interaction helpers
window.rotateCropper = function(degree) {
    if (cropperInstance) {
        cropperInstance.rotate(degree);
    }
};

window.changeCropperRatio = function(ratioStr) {
    if (!cropperInstance) return;
    if (ratioStr === 'free') {
        cropperInstance.setAspectRatio(NaN);
    } else {
        const parts = ratioStr.split(':');
        const ratio = parseFloat(parts[0]) / parseFloat(parts[1]);
        cropperInstance.setAspectRatio(ratio);
    }
};
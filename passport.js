// PASSPORT AUTO-COMPOSITION ENGINE & WORKSPACE STATE
let passportFiles = [];
let passportQuantities = {}; // key is file name + size, value is quantity
let passportPreviewTimeout;

window.passportQuantities = passportQuantities;

// Global helper to reset passport files from main script
window.resetPassportFiles = function() {
    passportFiles = [];
    passportQuantities = {};
    window.passportQuantities = passportQuantities;
    const pInput = document.getElementById('passportFileInput');
    if (pInput) pInput.value = "";
    renderPassportUploadQueue([]);
    renderPassportQuantitySettings();
    triggerPassportPreview();
};

function handlePassportFilesChange(files) {
    passportFiles = Array.from(files);
    // Initialize or keep existing quantities
    passportFiles.forEach(file => {
        const key = file.name + '_' + file.size;
        if (!passportQuantities[key]) {
            passportQuantities[key] = 1;
        }
    });
    renderPassportUploadQueue(passportFiles);
    renderPassportQuantitySettings();
    triggerPassportPreview();
}

function renderPassportUploadQueue(files) {
    const counterBadge = document.getElementById('passportUploadQueue');
    const counterDisplay = document.getElementById('passport-queue-counter-total');
    if (!counterBadge || !counterDisplay) return;
    if (!files || files.length === 0) {
        counterBadge.style.display = "none";
        return;
    }
    counterDisplay.innerText = files.length;
    counterBadge.style.display = "flex";
}

function renderPassportQuantitySettings() {
    const container = document.getElementById('passport-quantity-settings');
    const listDiv = document.getElementById('passport-quantity-list');
    if (!container || !listDiv) return;

    if (passportFiles.length === 0) {
        container.style.display = 'none';
        listDiv.innerHTML = '';
        return;
    }

    container.style.display = 'block';
    listDiv.innerHTML = '';

    passportFiles.forEach((file, index) => {
        const key = file.name + '_' + file.size;
        const qty = passportQuantities[key] || 1;

        const row = document.createElement('div');
        row.className = 'quantity-row';

        const img = document.createElement('img');
        const fileUrl = URL.createObjectURL(file);
        img.src = fileUrl;
        
        // Clean up object URL after thumbnail loads to save memory
        img.onload = () => URL.revokeObjectURL(fileUrl);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'file-name';
        nameSpan.innerText = file.name;

        const input = document.createElement('input');
        input.type = 'number';
        input.min = '1';
        input.max = '30';
        input.value = qty;
        input.addEventListener('change', (e) => {
            let val = parseInt(e.target.value) || 1;
            if (val < 1) val = 1;
            if (val > 30) val = 30;
            e.target.value = val;
            passportQuantities[key] = val;
            triggerPassportPreview();
        });

        row.appendChild(img);
        row.appendChild(nameSpan);
        row.appendChild(input);
        listDiv.appendChild(row);
    });
}

function triggerPassportPreview() {
    clearTimeout(passportPreviewTimeout);
    passportPreviewTimeout = setTimeout(updatePassportPreview, 150);
}

async function updatePassportPreview() {
    const canvas = document.getElementById('passportPreviewCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const layoutConfig = document.getElementById('passportLayout')?.value || "pic30";
    let cols = 5, rows = 6, is4x6Paper = false;
    if (layoutConfig === "pic8") { cols = 4; rows = 2; is4x6Paper = true; }
    else if (layoutConfig === "pic24") { cols = 4; rows = 6; }

    const pageW_mm = is4x6Paper ? 152.4 : 210;
    const pageH_mm = is4x6Paper ? 101.6 : 297;

    const maxPreviewH = 480;
    const maxPreviewW = 480;
    
    let canvasH = maxPreviewH;
    let canvasW = canvasH * (pageW_mm / pageH_mm);
    if (canvasW > maxPreviewW) {
        canvasW = maxPreviewW;
        canvasH = canvasW * (pageH_mm / pageW_mm);
    }

    canvas.width = canvasW;
    canvas.height = canvasH;

    // Draw background sheet
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Scaling factor (mm to canvas pixels)
    const mmToPx = canvasW / pageW_mm;

    // Grid coordinates
    const imgW = 35 * mmToPx;
    const imgH = 45 * mmToPx;
    const gapX = (is4x6Paper ? 2.0 : 4.0) * mmToPx;
    const gapY = ((layoutConfig === "pic24") ? 2.5 : (is4x6Paper ? 2.0 : 4.0)) * mmToPx;
    const totalGridWidth = (cols * imgW) + ((cols - 1) * gapX);
    const totalGridHeight = (rows * imgH) + ((rows - 1) * gapY);
    const startX = (canvasW - totalGridWidth) / 2;
    let startY = (canvasH - totalGridHeight) / 2;
    if (!is4x6Paper && layoutConfig === "pic24" && startY < (8 * mmToPx)) startY = 8 * mmToPx;

    // Load uploaded images if any
    let images = [];
    let gridImages = [];
    if (passportFiles.length > 0) {
        images = await Promise.all(passportFiles.map(file => loadImage(file)));
        passportFiles.forEach((file, idx) => {
            const key = file.name + '_' + file.size;
            const qty = passportQuantities[key] || 1;
            const img = images[idx];
            for (let q = 0; q < qty; q++) {
                gridImages.push(img);
            }
        });
    }

    // Draw grid
    for (let i = 0; i < cols * rows; i++) {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const xPos = startX + c * (imgW + gapX);
        const yPos = startY + r * (imgH + gapY);

        if (gridImages.length > 0) {
            const img = gridImages[i % gridImages.length];
            const targetAspect = 35 / 45;
            const inputAspect = img.width / img.height;
            let sX = 0, sY = 0, sW = img.width, sH = img.height;
            if (inputAspect > targetAspect) {
                sW = img.height * targetAspect;
                sX = (img.width - sW) / 2;
            } else if (inputAspect < targetAspect) {
                sH = img.width / targetAspect;
                sY = (img.height - sH) * 0.2;
            }
            ctx.drawImage(img, sX, sY, sW, sH, xPos, yPos, imgW, imgH);
            
            // Draw fine passport border line
            ctx.save();
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 0.5;
            ctx.strokeRect(xPos, yPos, imgW, imgH);
            ctx.restore();
        } else {
            // Draw empty placeholder slot
            ctx.save();
            ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.strokeRect(xPos, yPos, imgW, imgH);
            
            // Draw dummy silhouette or text
            ctx.fillStyle = "rgba(0, 0, 0, 0.02)";
            ctx.fillRect(xPos, yPos, imgW, imgH);
            ctx.restore();
        }
    }
}

// Bind DOM elements on load
document.addEventListener("DOMContentLoaded", () => {
    const passportDropZone = document.getElementById('passportDropZoneContainer');
    const passportFileInput = document.getElementById('passportFileInput');
    const passportLayoutSelect = document.getElementById('passportLayout');

    if (passportDropZone && passportFileInput) {
        passportDropZone.addEventListener('click', () => passportFileInput.click());

        ['dragenter', 'dragover'].forEach(eventName => {
            passportDropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                passportDropZone.classList.add('drag-active');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            passportDropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                passportDropZone.classList.remove('drag-active');
            }, false);
        });

        passportDropZone.addEventListener('drop', (e) => {
            passportFileInput.files = e.dataTransfer.files;
            handlePassportFilesChange(passportFileInput.files);
        });

        passportFileInput.addEventListener('change', (e) => {
            handlePassportFilesChange(e.target.files);
        });
    }

    if (passportLayoutSelect) {
        passportLayoutSelect.addEventListener('change', () => {
            triggerPassportPreview();
        });
    }

    triggerPassportPreview();
});

function resetPassportWorkspace() {
    const fileInput = document.getElementById('passportFileInput');
    if (fileInput) fileInput.value = "";
    passportFiles = [];
    renderPassportUploadQueue([]);
    triggerPassportPreview();
    const statusText = document.getElementById('passportStatus');
    if (statusText) {
        statusText.innerText = "Passport workspace cleared.";
        setTimeout(() => { if (statusText.innerText === "Passport workspace cleared.") statusText.innerText = ""; }, 3000);
    }
}

async function startPassportProcess() {
    const fileInput = document.getElementById('passportFileInput');
    const isManualCrop = document.getElementById('passportManualCropCheck').checked;
    const statusText = document.getElementById('passportStatus');

    if (!fileInput || fileInput.files.length === 0) {
        statusText.innerText = "Please select or upload photos in the Passport Studio tab first!";
        return;
    }

    window.passportCanvasArray = [];
    window.isPassportWorkflow = true; 

    if (!isManualCrop) {
        statusText.innerText = "Compiling Passport Sheet...";
        const temporaryImagesArray = [];
        
        for (let i = 0; i < fileInput.files.length; i++) {
            const file = fileInput.files[i];
            const imgNode = await loadImage(file);
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = 350;
            tempCanvas.height = 450;
            const tCtx = tempCanvas.getContext('2d');
            tCtx.fillStyle = "#ffffff";
            tCtx.fillRect(0, 0, 350, 450);

            const targetAspect = 350 / 450;
            const inputAspect = imgNode.width / imgNode.height;
            let sX = 0, sY = 0, sW = imgNode.width, sH = imgNode.height;
            if (inputAspect > targetAspect) {
                sW = imgNode.height * targetAspect;
                sX = (imgNode.width - sW) / 2;
            } else if (inputAspect < targetAspect) {
                sH = imgNode.width / targetAspect;
                sY = (imgNode.height - sH) * 0.2;
            }
            tCtx.drawImage(imgNode, sX, sY, sW, sH, 0, 0, 350, 450);

            const key = file.name + '_' + file.size;
            const qty = passportQuantities[key] || 1;
            const dataUrl = tempCanvas.toDataURL("image/jpeg", 0.95);
            for (let q = 0; q < qty; q++) {
                temporaryImagesArray.push(dataUrl);
            }
        }

        const exportFormat = document.getElementById('passportExportFormat')?.value || "application/pdf";
        if (exportFormat === "application/pdf") {
            generatePassportPDF(temporaryImagesArray);
            statusText.innerText = "Passport PDF sheet generated successfully!";
        } else {
            await generatePassportImage(temporaryImagesArray, exportFormat);
            statusText.innerText = `Passport sheet generated as ${exportFormat.split('/')[1].toUpperCase()}!`;
        }
        window.isPassportWorkflow = false;
    } else {
        currentFiles = Array.from(fileInput.files);
        currentIndex = 0;
        document.getElementById('main-content-box').style.display = 'none';
        document.querySelector('.top-nav-header').style.display = 'none';
        document.getElementById('cropper-ui').style.display = 'block';
        loadNextCropper();
    }
}

async function runPassportProcess(files) {
    const images = [];
    for (let i = 0; i < files.length; i++) {
        const img = await loadImage(files[i]);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const w = 350; const h = 450;
        canvas.width = w; canvas.height = h;
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
        const targetAspect = w / h; const inputAspect = img.width / img.height;
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

function generatePassportPDF(images) {
    const { jsPDF } = window.jspdf;
    const layoutConfig = document.getElementById('passportLayout')?.value || "pic30";
    let cols = 5, rows = 6, isCustom8pic = false;
    
    if (layoutConfig === "pic8") { cols = 4; rows = 2; isCustom8pic = true; } 
    else if (layoutConfig === "pic24") { cols = 4; rows = 6; }

    let pageW, pageH, orientationSetting, formatSetting;
    if (isCustom8pic) {
        orientationSetting = "landscape"; formatSetting = [101.6, 152.4];
        pageW = 152.4; pageH = 101.6;
    } else {
        orientationSetting = "portrait"; formatSetting = "a4";
        pageW = 210; pageH = 297;
    }

    const doc = new jsPDF({ orientation: orientationSetting, unit: "mm", format: formatSetting });
    const imgW = 35, imgH = 45;
    const maxPhotos = cols * rows;
    const gapX = isCustom8pic ? 2.0 : 4.0;
    const gapY = (layoutConfig === "pic24") ? 2.5 : (isCustom8pic ? 2.0 : 4.0);
    const totalGridWidth = (cols * imgW) + ((cols - 1) * gapX);
    const totalGridHeight = (rows * imgH) + ((rows - 1) * gapY);
    const startX = (pageW - totalGridWidth) / 2;
    let startY = (pageH - totalGridHeight) / 2;

    if (!isCustom8pic && layoutConfig === "pic24" && startY < 8) startY = 8;

    for (let i = 0; i < maxPhotos; i++) {
        const imageIndex = i % images.length;
        const c = i % cols;
        const r = Math.floor(i / cols);
        const xPos = startX + c * (imgW + gapX);
        const yPos = startY + r * (imgH + gapY);
        doc.addImage(images[imageIndex], "JPEG", xPos, yPos, imgW, imgH, `passport_slot_${i}`, "FAST");
        doc.saveGraphicsState();
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.4); 
        doc.rect(xPos, yPos, imgW, imgH, "S");
        doc.restoreGraphicsState();
    }
    doc.save(`passport_print_${layoutConfig}.pdf`);
}

async function generatePassportImage(base64Images, mimeType) {
    const layoutConfig = document.getElementById('passportLayout')?.value || "pic30";
    const extension = mimeType === "image/webp" ? "webp" : "png";
    let cols = 5, rows = 6, is4x6Paper = false;
    
    if (layoutConfig === "pic8") { cols = 4; rows = 2; is4x6Paper = true; }
    else if (layoutConfig === "pic24") { cols = 4; rows = 6; }

    const mmToPx = 3.78; 
    const pageW = (is4x6Paper ? 152.4 : 210) * mmToPx;
    const pageH = (is4x6Paper ? 101.6 : 297) * mmToPx;

    const masterCanvas = document.createElement('canvas');
    masterCanvas.width = pageW; masterCanvas.height = pageH;
    const ctx = masterCanvas.toDataURL ? masterCanvas.getContext('2d') : null;
    if (!ctx) return;

    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, pageW, pageH);
    const imgW = 35 * mmToPx, imgH = 45 * mmToPx;
    const gapX = (is4x6Paper ? 2.0 : 4.0) * mmToPx;
    const gapY = ((layoutConfig === "pic24") ? 2.5 : (is4x6Paper ? 2.0 : 4.0)) * mmToPx;
    const totalGridWidth = (cols * imgW) + ((cols - 1) * gapX);
    const totalGridHeight = (rows * imgH) + ((rows - 1) * gapY);
    const startX = (pageW - totalGridWidth) / 2;
    let startY = (pageH - totalGridHeight) / 2;
    if (!is4x6Paper && layoutConfig === "pic24" && startY < (8 * mmToPx)) startY = 8 * mmToPx;

    const loadImgNode = (src) => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = src; });

    for (let i = 0; i < cols * rows; i++) {
        const imgIndex = i % base64Images.length;
        const c = i % cols;
        const r = Math.floor(i / cols);
        const xPos = startX + c * (imgW + gapX);
        const yPos = startY + r * (imgH + gapY);

        const loadedImg = await loadImgNode(base64Images[imgIndex]);
        ctx.drawImage(loadedImg, xPos, yPos, imgW, imgH);
        ctx.save();
        ctx.strokeStyle = "rgb(0, 0, 0)";
        ctx.lineWidth = 0.2 * mmToPx;
        const offset = 0.3 * mmToPx;
        ctx.strokeRect(xPos - offset, yPos - offset, imgW + (offset * 2), imgH + (offset * 2));
        ctx.restore();
    }
    const quality = mimeType === "image/webp" ? 0.92 : undefined;
    const dataUrl = masterCanvas.toDataURL(mimeType, quality);
    const downloadLink = document.createElement('a');
    downloadLink.href = dataUrl;
    downloadLink.download = `passport_sheet_${layoutConfig}.${extension}`;
    downloadLink.click();
}
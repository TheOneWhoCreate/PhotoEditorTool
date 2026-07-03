const EffectsEngine = {
    draw: async function (canvas, sourceImg, filter, frame, config) {
        const ctx = canvas.getContext('2d');
        let { imgW, imgH, userPadding, userColor, label } = config;

        const filterCanvas = document.createElement('canvas');
        filterCanvas.width = imgW;
        filterCanvas.height = imgH;
        const fCtx = filterCanvas.getContext('2d');
        fCtx.drawImage(sourceImg, 0, 0, imgW, imgH);

        this.applyFilter(fCtx, filter, imgW, imgH, filterCanvas);
        this.applyFrame(ctx, canvas, filterCanvas, frame, config);
    },

    applyFilter: function (fCtx, filter, imgW, imgH, filterCanvas) {
        if (filter === 'sepia') {
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

        if (filter === 'cinematic') {
            fCtx.filter = "contrast(1.12) saturate(1.05)";
            fCtx.drawImage(filterCanvas, 0, 0);
            fCtx.filter = "none";
            let idata = fCtx.getImageData(0, 0, imgW, imgH);
            let d = idata.data;
            for (let i = 0; i < d.length; i += 4) {
                let r = d[i], g = d[i+1], b = d[i+2];
                let avg = (r + g + b) / 3;
                if (avg > 128) {
                    d[i] = Math.min(255, r * 1.14);
                    d[i+1] = Math.min(255, g * 1.02);
                    d[i+2] = Math.max(0, b * 0.86);
                } else {
                    d[i] = Math.max(0, r * 0.84);
                    d[i+1] = Math.min(255, g * 1.08);
                    d[i+2] = Math.min(255, b * 1.22);
                }
            }
            fCtx.putImageData(idata, 0, 0);
        }

        if (filter === 'noir') {
            let idata = fCtx.getImageData(0, 0, imgW, imgH);
            let d = idata.data;
            for (let i = 0; i < d.length; i += 4) {
                let avg = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
                avg = ((avg - 128) * 1.3) + 128;
                d[i] = d[i + 1] = d[i + 2] = avg;
            }
            fCtx.putImageData(idata, 0, 0);
        }

        if (filter === 'cyberpunk') {
            fCtx.filter = "contrast(1.4) brightness(1.1) saturate(1.5)";
            fCtx.drawImage(filterCanvas, 0, 0);
            fCtx.filter = "none";
            let idata = fCtx.getImageData(0, 0, imgW, imgH);
            let d = idata.data;
            for (let i = 0; i < d.length; i += 4) {
                d[i] = Math.min(255, d[i] + 40);
                d[i + 1] = d[i + 1] * 0.7;
                d[i + 2] = Math.min(255, d[i + 2] + 80);
            }
            fCtx.putImageData(idata, 0, 0);
        }

        if (filter === 'lomo') {
            fCtx.filter = "saturate(1.8) contrast(1.2)";
            fCtx.drawImage(filterCanvas, 0, 0);
            fCtx.filter = "none";
            const vignette = fCtx.createRadialGradient(imgW / 2, imgH / 2, imgW * 0.2, imgW / 2, imgH / 2, imgW * 0.8);
            vignette.addColorStop(0, "transparent");
            vignette.addColorStop(1, "rgba(0, 0, 0, 0.7)");
            fCtx.fillStyle = vignette;
            fCtx.fillRect(0, 0, imgW, imgH);
        }

        if (filter === 'coldbrew') {
            fCtx.filter = "brightness(1.05) contrast(0.9) saturate(0.8) hue-rotate(10deg)";
            fCtx.drawImage(filterCanvas, 0, 0);
            fCtx.filter = "none";
            fCtx.globalCompositeOperation = "soft-light";
            fCtx.fillStyle = "rgba(0, 50, 100, 0.2)";
            fCtx.fillRect(0, 0, imgW, imgH);
            fCtx.globalCompositeOperation = "source-over";
        }

        if (filter === 'dreamy') {
            fCtx.globalCompositeOperation = "soft-light";
            fCtx.fillStyle = "rgba(255,210,180,0.22)";
            fCtx.fillRect(0, 0, imgW, imgH);
            fCtx.globalCompositeOperation = "source-over";
            fCtx.save();
            fCtx.globalAlpha = 0.22;
            fCtx.filter = "blur(12px) brightness(1.08)";
            fCtx.drawImage(filterCanvas, 0, 0);
            fCtx.restore();
            fCtx.filter = "none";
            for (let i = 0; i < 300; i++) {
                let x = Math.random() * imgW;
                let y = Math.random() * imgH;
                if (x > imgW * 0.35 && x < imgW * 0.65 && y > imgH * 0.2 && y < imgH * 0.7) continue;
                let r = Math.random() * 1.8;
                fCtx.beginPath();
                fCtx.arc(x, y, r, 0, Math.PI * 2);
                fCtx.fillStyle = "rgba(255,255,255,0.7)";
                fCtx.fill();
            }
        }

        if (filter === 'duotone') {
            let idata = fCtx.getImageData(0, 0, imgW, imgH);
            let d = idata.data;
            const colorA = [35, 39, 138];
            const colorB = [255, 204, 0];
            for (let i = 0; i < d.length; i += 4) {
                let avg = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
                d[i] = colorA[0] + avg * (colorB[0] - colorA[0]);
                d[i + 1] = colorA[1] + avg * (colorB[1] - colorA[1]);
                d[i + 2] = colorA[2] + avg * (colorB[2] - colorA[2]);
            }
            fCtx.putImageData(idata, 0, 0);
        }

        if (filter === 'brownie') {
            let idata = fCtx.getImageData(0, 0, imgW, imgH);
            let d = idata.data;
            for (let i = 0; i < d.length; i += 4) {
                let r = d[i], g = d[i + 1], b = d[i + 2];
                d[i] = (r * 0.75) + (g * 0.25) + (b * 0.10);
                d[i + 1] = (r * 0.40) + (g * 0.55) + (b * 0.05);
                d[i + 2] = (r * 0.20) + (g * 0.15) + (b * 0.45);
            }
            fCtx.putImageData(idata, 0, 0);
            fCtx.save();
            fCtx.filter = "contrast(1.25) brightness(1.02) saturate(1.1)";
            const tempSnap = document.createElement('canvas');
            tempSnap.width = imgW;
            tempSnap.height = imgH;
            tempSnap.getContext('2d').putImageData(idata, 0, 0);
            fCtx.clearRect(0, 0, imgW, imgH);
            fCtx.drawImage(tempSnap, 0, 0);
            fCtx.restore();
            fCtx.filter = "none";
        }

        if (filter === 'matcha') {
            let idata = fCtx.getImageData(0, 0, imgW, imgH);
            let d = idata.data;
            for (let i = 0; i < d.length; i += 4) {
                let r = d[i], g = d[i + 1], b = d[i + 2];
                d[i] = (r * 0.60) + (g * 0.30) + (b * 0.10);
                d[i + 1] = (r * 0.20) + (g * 0.75) + (b * 0.05);
                d[i + 2] = (r * 0.25) + (g * 0.25) + (b * 0.50);
            }
            fCtx.putImageData(idata, 0, 0);
            fCtx.filter = "contrast(1.1) saturate(0.9)";
            fCtx.drawImage(filterCanvas, 0, 0);
            fCtx.filter = "none";
        }

        if (filter === 'midnight') {
            fCtx.filter = "contrast(1.2) brightness(0.9) saturate(0.7) hue-rotate(15deg)";
            fCtx.drawImage(filterCanvas, 0, 0);
            fCtx.filter = "none";
            fCtx.globalCompositeOperation = "multiply";
            fCtx.fillStyle = "rgba(10, 25, 50, 0.3)";
            fCtx.fillRect(0, 0, imgW, imgH);
            fCtx.globalCompositeOperation = "source-over";
        }
    },

    applyFrame: function (ctx, canvas, filterCanvas, frame, config) {
        let { imgW, imgH, userPadding, userColor, label } = config;
        const shortSide = Math.min(imgW, imgH);
        const longSide = Math.max(imgW, imgH);

        if (frame === 'border') {
            canvas.width = imgW + userPadding * 2;
            canvas.height = imgH + userPadding * 2;
            ctx.fillStyle = userColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(filterCanvas, userPadding, userPadding, imgW, imgH);
        }

        else if (frame === 'polaroid') {
            let pad = userPadding;
            let bottomPad = Math.max(pad * 3.5, imgH * 0.22);
            let scale = Math.min(1, 2000 / (imgW + pad * 2), 2000 / (imgH + pad + bottomPad));
            pad *= scale;
            bottomPad *= scale;
            imgW *= scale;
            imgH *= scale;

            canvas.width = imgW + (pad * 2);
            canvas.height = imgH + pad + bottomPad;
            ctx.fillStyle = userColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const outline = Math.max(1, shortSide * 0.002 * scale);
            ctx.fillStyle = "#000000";
            ctx.fillRect(pad - outline, pad - outline, imgW + (outline * 2), imgH + (outline * 2));

            ctx.save();
            ctx.shadowColor = "rgba(0,0,0,0.2)";
            ctx.shadowBlur = 15 * scale;
            ctx.shadowOffsetY = 5 * scale;
            ctx.drawImage(filterCanvas, pad, pad, imgW, imgH);
            ctx.restore();

            if (label) {
                const isDark = (c) => {
                    const hex = c.replace('#', '');
                    const rgb = [0, 2, 4].map(p => parseInt(hex.substr(p, 2), 16));
                    return (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) < 128;
                };
                ctx.fillStyle = isDark(userColor) ? "#ffffff" : "#333333";
                ctx.textAlign = "center";
                let fontSize = Math.max(14 * scale, Math.min(bottomPad * 0.35, 55));
                ctx.font = `${fontSize}px 'Segoe Script', cursive`;
                while (ctx.measureText(label).width > (canvas.width * 0.88) && fontSize > 10) {
                    fontSize--;
                    ctx.font = `${fontSize}px 'Segoe Script', cursive`;
                }
                ctx.fillText(label, canvas.width / 2, canvas.height - (bottomPad / 2) + (fontSize / 3));
            }
        }

        else if (frame === 'filmStrip') {
            const barHeight = shortSide * 0.14;
            canvas.width = imgW;
            canvas.height = imgH + (barHeight * 2);
            ctx.fillStyle = "#111";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(filterCanvas, 0, barHeight, imgW, imgH);

            ctx.fillStyle = "#fff";
            const holeW = shortSide * 0.022;
            const holeH = holeW * 1.4;
            const gap = holeW * 1.8;
            for (let x = gap; x < canvas.width; x += (holeW + gap)) {
                ctx.fillRect(x, barHeight / 2 - holeH / 2, holeW, holeH);
                ctx.fillRect(x, canvas.height - (barHeight / 2) - (holeH / 2), holeW, holeH);
            }
        }

        else if (frame === 'gallery') {
            const margin = shortSide * 0.12;
            const innerGap = Math.max(3, shortSide * 0.006);
            canvas.width = imgW + (margin * 2);
            canvas.height = imgH + (margin * 2);
            ctx.fillStyle = userColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(margin - innerGap, margin - innerGap, imgW + (innerGap * 2), imgH + (innerGap * 2));
            ctx.save();
            ctx.shadowColor = "rgba(0,0,0,0.3)";
            ctx.shadowBlur = shortSide * 0.03;
            ctx.drawImage(filterCanvas, margin, margin, imgW, imgH);
            ctx.restore();
        }

        else if (frame === 'blurBg') {
            if (imgW >= imgH) { canvas.width = 800; canvas.height = 600; }
            else { canvas.width = 600; canvas.height = 800; }

            ctx.filter = "blur(20px)";
            ctx.drawImage(filterCanvas, 0, 0, canvas.width, canvas.height);
            ctx.filter = "none";
            let s = Math.min(canvas.width / filterCanvas.width, canvas.height / filterCanvas.height);
            let w = filterCanvas.width * s, h = filterCanvas.height * s;
            ctx.drawImage(filterCanvas, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
        }

        else if (frame === 'glassFrame') {
            let margin = userPadding; // Linked userPadding here!
            canvas.width = imgW + (margin * 2);
            canvas.height = imgH + (margin * 2);
            ctx.save();
            ctx.filter = "blur(30px) brightness(0.85)";
            ctx.drawImage(filterCanvas, -20, -20, canvas.width + 40, canvas.height + 40);
            ctx.restore();
            ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
            ctx.lineWidth = 2;
            ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
            ctx.save();
            ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
            ctx.shadowBlur = shortSide * 0.04;
            ctx.shadowOffsetY = shortSide * 0.02;
            const b = Math.max(1, shortSide * 0.006);
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(margin - b, margin - b, imgW + (b * 2), imgH + (b * 2));
            ctx.shadowColor = "transparent";
            ctx.drawImage(filterCanvas, margin, margin, imgW, imgH);
            ctx.restore();
        }

        else if (frame === 'magazine') {
            const topMargin = shortSide * 0.18;
            const sideMargin = shortSide * 0.05;
            const bottomMargin = shortSide * 0.12;
            canvas.width = imgW + (sideMargin * 2);
            canvas.height = imgH + topMargin + bottomMargin;
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(filterCanvas, sideMargin, topMargin, imgW, imgH);
            ctx.fillStyle = "#111111";
            ctx.textAlign = "center";
            let headSize = Math.max(16, topMargin * 0.35);
            ctx.font = `bold ${headSize}px 'Times New Roman', serif`;
            ctx.fillText("EDITORIAL", canvas.width / 2, topMargin * 0.65);
            let subSize = Math.max(10, bottomMargin * 0.35);
            ctx.font = `italic ${subSize}px 'Times New Roman', serif`;
            ctx.fillStyle = "#666666";
            ctx.fillText("• Limited Edition •", canvas.width / 2, canvas.height - (bottomMargin * 0.45));
        }

        else if (frame === 'postageStamp') {
            let pad = userPadding;
            canvas.width = imgW + pad * 2;
            canvas.height = imgH + pad * 2;
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(filterCanvas, pad, pad, imgW, imgH);

            // Draw inner dotted outline
            ctx.save();
            ctx.strokeStyle = "rgba(0, 0, 0, 0.18)";
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(pad - 2, pad - 2, imgW + 4, imgH + 4);
            ctx.restore();

            // Punch holes along edges
            const holeRadius = Math.max(4, pad * 0.22);
            const spacing = holeRadius * 2.8;
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = '#000000';
            
            // Top and Bottom edges
            for (let x = spacing; x < canvas.width; x += spacing) {
                ctx.beginPath();
                ctx.arc(x, 0, holeRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(x, canvas.height, holeRadius, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Left and Right edges
            for (let y = spacing; y < canvas.height; y += spacing) {
                ctx.beginPath();
                ctx.arc(0, y, holeRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(canvas.width, y, holeRadius, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        else if (frame === 'artMount') {
            let pad = userPadding;
            canvas.width = imgW + pad * 2;
            canvas.height = imgH + pad * 2;
            ctx.fillStyle = userColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Inner mount line
            ctx.save();
            ctx.strokeStyle = "rgba(0, 0, 0, 0.22)";
            ctx.lineWidth = Math.max(1, shortSide * 0.002);
            const lineOffset = Math.max(3, shortSide * 0.015);
            ctx.strokeRect(pad - lineOffset, pad - lineOffset, imgW + lineOffset * 2, imgH + lineOffset * 2);
            ctx.restore();
            
            ctx.drawImage(filterCanvas, pad, pad, imgW, imgH);
        }

        else if (frame === 'neonGlow') {
            let pad = userPadding;
            canvas.width = imgW + pad * 2;
            canvas.height = imgH + pad * 2;
            ctx.fillStyle = "#050505";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.drawImage(filterCanvas, pad, pad, imgW, imgH);

            // Glowing neon line tracing
            ctx.save();
            const neonColor = userColor || "#38bdf8";
            ctx.strokeStyle = neonColor;
            ctx.lineWidth = Math.max(2, shortSide * 0.006);
            ctx.shadowColor = neonColor;
            ctx.shadowBlur = Math.max(6, shortSide * 0.022);
            ctx.strokeRect(pad, pad, imgW, imgH);
            ctx.restore();
        }

        else if (frame === 'postcard') {
            const sideMargin = shortSide * 0.06;
            const topMargin = shortSide * 0.06;
            const bottomMargin = shortSide * 0.24;
            canvas.width = imgW + (sideMargin * 2);
            canvas.height = imgH + topMargin + bottomMargin;
            ctx.fillStyle = "#faf6eb"; // Vintage postcard paper color
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(filterCanvas, sideMargin, topMargin, imgW, imgH);

            const lineY = canvas.height - bottomMargin;
            const stampW = bottomMargin * 0.45;
            const stampH = stampW * 1.25;

            ctx.save();
            // Center divider
            ctx.strokeStyle = "rgba(120, 100, 80, 0.4)";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([2, 3]);
            ctx.beginPath();
            ctx.moveTo(canvas.width / 2, lineY + 12);
            ctx.lineTo(canvas.width / 2, canvas.height - 12);
            ctx.stroke();

            // Stamp placement box
            ctx.strokeStyle = "rgba(120, 100, 80, 0.5)";
            ctx.setLineDash([2, 2]);
            ctx.strokeRect(canvas.width - sideMargin - stampW, lineY + 15, stampW, stampH);

            // Postcard text & line values
            ctx.strokeStyle = "rgba(120, 100, 80, 0.3)";
            ctx.setLineDash([]);
            const startX = canvas.width / 2 + 15;
            const endX = canvas.width - sideMargin;
            const lineGap = bottomMargin * 0.16;
            let firstLineY = lineY + 20 + stampH;
            if (firstLineY > canvas.height - 15) firstLineY = lineY + 15 + stampH;

            for (let k = 0; k < 3; k++) {
                const y = firstLineY + k * lineGap;
                if (y < canvas.height - 5) {
                    ctx.beginPath();
                    ctx.moveTo(startX, y);
                    ctx.lineTo(endX - 5, y);
                    ctx.stroke();
                }
            }

            // Handwritten-style cursive postcard text
            ctx.fillStyle = "rgba(90, 70, 50, 0.8)";
            let titleSize = Math.max(10, bottomMargin * 0.22);
            ctx.font = `bold ${titleSize}px 'Courier New', monospace`;
            ctx.textAlign = "left";
            ctx.fillText("POST CARD", sideMargin + 10, lineY + bottomMargin * 0.4);

            let msgSize = Math.max(8, bottomMargin * 0.14);
            ctx.font = `italic ${msgSize}px 'Segoe Script', cursive`;
            ctx.fillStyle = "rgba(90, 70, 50, 0.6)";
            ctx.fillText("Wish you were here...", sideMargin + 10, lineY + bottomMargin * 0.7);
            ctx.restore();
        }

        else {
            canvas.width = imgW;
            canvas.height = imgH;
            ctx.drawImage(filterCanvas, 0, 0);
        }

        // DRAW WATERMARK OVERLAY
        if (config.watermarkText) {
            ctx.save();
            ctx.globalAlpha = config.watermarkOpacity || 0.4;
            ctx.fillStyle = "#ffffff";
            ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
            ctx.lineWidth = 1.5;
            
            const shortSide = Math.min(canvas.width, canvas.height);
            const fontSize = Math.max(12, shortSide * 0.04);
            ctx.font = `bold ${fontSize}px sans-serif`;
            
            const text = config.watermarkText;
            const textWidth = ctx.measureText(text).width;
            const margin = fontSize * 0.8;
            
            let x = canvas.width - textWidth - margin;
            let y = canvas.height - margin;
            
            const placement = config.watermarkPlacement || "bottom-right";
            if (placement === "bottom-left") {
                x = margin;
                y = canvas.height - margin;
            } else if (placement === "top-right") {
                x = canvas.width - textWidth - margin;
                y = margin + fontSize;
            } else if (placement === "top-left") {
                x = margin;
                y = margin + fontSize;
            } else if (placement === "center") {
                x = (canvas.width - textWidth) / 2;
                y = (canvas.height + fontSize) / 2;
            }
            
            ctx.strokeText(text, x, y);
            ctx.fillText(text, x, y);
            ctx.restore();
        }
    }
};
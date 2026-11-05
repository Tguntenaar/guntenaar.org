// The original frame occupies the central cell of a 3×3 painting. New art
// surrounds it, while the interactive houses keep their original coordinates.
// Composing once at load time keeps the existing texture-unit budget.
export function sceneTexture(original, extension, panorama, maxSize) {
    const scale = Math.min(1, maxSize / (Math.max(original.naturalWidth, original.naturalHeight) * 3));
    const width = Math.floor(original.naturalWidth * scale);
    const height = Math.floor(original.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width * 3;
    canvas.height = height * 3;
    const context = canvas.getContext('2d');

    if (panorama) {
        context.drawImage(panorama, 0, 0, canvas.width, canvas.height);
        // Registration measured against the original houses. Generation kept
        // the architecture but shifted its position within the larger canvas.
        const x = width * (1 - .808);
        const y = height * (1 - .960);
        const w = width * 2.611;
        const h = height * 2.612;
        const pw = panorama.naturalWidth, ph = panorama.naturalHeight;
        // Pad the outermost margins for very wide/tall screens. The visible
        // houses and reflections on ordinary displays use the full artwork.
        context.drawImage(panorama, 0, 0, pw, 1, x, 0, w, y);
        context.drawImage(panorama, 0, ph - 1, pw, 1, x, y + h, w, canvas.height - y - h);
        context.drawImage(panorama, 0, 0, 1, ph, 0, y, x, h);
        context.drawImage(panorama, pw - 1, 0, 1, ph, x + w, y, canvas.width - x - w, h);
        context.drawImage(panorama, x, y, w, h);
    } else {
        // A failed panorama request still fills the viewport with usable art.
        context.drawImage(extension || original, 0, 0, canvas.width, canvas.height);
    }

    const strip = document.createElement('canvas');
    strip.width = width;
    strip.height = height * 3;
    const paper = strip.getContext('2d');

    if (extension) {
        paper.drawImage(extension, 0, 0, width, height * 3);
    } else {
        // A failed extension request should still leave usable house art.
        paper.drawImage(original, 0, 0, original.naturalWidth, 1,
            0, 0, width, height * 2);
        paper.drawImage(original, 0, original.naturalHeight - 1, original.naturalWidth, 1,
            0, height * 2, width, height);
    }

    const center = document.createElement('canvas');
    center.width = width;
    center.height = height;
    const ink = center.getContext('2d');
    ink.drawImage(original, 0, 0, width, height);
    ink.globalCompositeOperation = 'destination-in';
    const edge = ink.createLinearGradient(0, 0, 0, height);
    edge.addColorStop(0, 'transparent');
    edge.addColorStop(.07, '#000');
    edge.addColorStop(.92, '#000');
    edge.addColorStop(1, 'transparent');
    ink.fillStyle = edge;
    ink.fillRect(0, 0, width, height);
    paper.drawImage(center, 0, height);
    paper.globalCompositeOperation = 'destination-in';
    const sides = paper.createLinearGradient(0, 0, width, 0);
    sides.addColorStop(0, 'transparent');
    sides.addColorStop(.08, '#000');
    sides.addColorStop(.92, '#000');
    sides.addColorStop(1, 'transparent');
    paper.fillStyle = sides;
    paper.fillRect(0, 0, width, strip.height);
    context.drawImage(strip, width, 0);
    return canvas;
}

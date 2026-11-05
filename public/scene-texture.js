// Keep the original, precisely registered buildings in the middle third of
// the outpainted scene. Only the empty sky/water edges crossfade into new art.
// Composing once at load time keeps the original WebGL texture-unit budget.
export function sceneTexture(original, extension, maxSize) {
    const scale = Math.min(1, maxSize / (original.naturalHeight * 3));
    const width = Math.floor(original.naturalWidth * scale);
    const height = Math.floor(original.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height * 3;
    const context = canvas.getContext('2d');

    if (extension) {
        context.drawImage(extension, 0, 0, width, height * 3);
    } else {
        // A failed extension request should still leave usable house art.
        context.drawImage(original, 0, 0, original.naturalWidth, 1,
            0, 0, width, height * 2);
        context.drawImage(original, 0, original.naturalHeight - 1, original.naturalWidth, 1,
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
    context.drawImage(center, 0, height);
    return canvas;
}

// function that takes in a canvasrenderingcontext and draws a rectangle

async function loadImage(src: string) {
    const img = new Image();
    img.src = src;
    await img.decode();
    return img;
}

export async function renderGrass(ctx: CanvasRenderingContext2D) {
    console.log(ctx);
    ctx.drawImage(await loadImage('grass.png'), 0, 0);
    ctx.drawImage(await loadImage('Nomad_Atlas.webp'), 128, 128, 128, 128, 0, 0, 128, 128); 
}
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');

async function makeRounded() {
  const width = 256;
  const height = 256;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  try {
    const imgPath = 'C:\\Users\\bulan\\.gemini\\antigravity-ide\\brain\\c02deea0-1bb9-45d1-b353-f81e782dfe22\\ms_monogram_1782864093571.png';
    const img = await loadImage(imgPath);
    
    // Draw the image
    ctx.drawImage(img, 0, 0, width, height);

    // Create a rounded rectangle mask to make it look like a native app icon
    ctx.globalCompositeOperation = 'destination-in';
    const radius = 56; // Standard iOS-like radius
    
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(width - radius, 0);
    ctx.quadraticCurveTo(width, 0, width, radius);
    ctx.lineTo(width, height - radius);
    ctx.quadraticCurveTo(width, height, width - radius, height);
    ctx.lineTo(radius, height);
    ctx.quadraticCurveTo(0, height, 0, height - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.fill();

    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync('icon.png', buffer);
    console.log('Rounded icon generated successfully!');
  } catch (e) {
    console.error(e);
  }
}

makeRounded();

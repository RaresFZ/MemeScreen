const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');

async function fixCorners() {
  const width = 256;
  const height = 256;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  try {
    const img = await loadImage('icon.png');
    
    // Draw the image
    ctx.drawImage(img, 0, 0, width, height);

    // Apply a circular mask to cut out everything outside a radius
    // Radius 120 will clip the extreme corners (distance to corner is ~180)
    // while keeping the center intact.
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 120, 0, Math.PI * 2);
    ctx.fill();

    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync('icon.png', buffer);
    console.log('Fixed corners successfully!');
  } catch (e) {
    console.error(e);
  }
}

fixCorners();

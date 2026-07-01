const { createCanvas } = require('canvas');
const fs = require('fs');

async function drawCleanMS() {
  const width = 256;
  const height = 256;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background: Transparent
  ctx.clearRect(0, 0, width, height);

  // Draw a rounded square background
  const radius = 56;
  ctx.fillStyle = '#eab308'; // Neon yellow
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

  // Draw inner shadow/border or keep it flat? Flat is modern.
  // Text "MS"
  ctx.fillStyle = '#0f172a'; // Dark slate color from MemeScreen
  ctx.font = 'bold 130px "Arial Black", Impact, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Draw the text exactly in the center
  ctx.fillText('MS', width / 2, height / 2 + 8);
  
  // Save to file
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('icon.png', buffer);
  console.log('Clean MS icon generated successfully!');
}

drawCleanMS();

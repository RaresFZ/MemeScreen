const { createCanvas } = require('canvas');
const fs = require('fs');

async function createIntertwinedLogo() {
  const width = 256;
  const height = 256;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, width, height);

  const yellow = '#eab308';
  
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // Draw M
  ctx.lineWidth = 30;
  ctx.strokeStyle = yellow;
  ctx.beginPath();
  ctx.moveTo(50, 200);
  ctx.lineTo(50, 70);
  ctx.lineTo(100, 140);
  ctx.lineTo(150, 70);
  ctx.lineTo(150, 200);
  ctx.stroke();

  // Cut out space for the S where it crosses the M
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineWidth = 45; // 15px gap (45 - 30)
  ctx.beginPath();
  // Start cutting from the right side so we don't erase the fusion point
  ctx.moveTo(210, 70);
  ctx.lineTo(210, 135);
  ctx.lineTo(90, 135);
  ctx.lineTo(90, 200);
  ctx.lineTo(210, 200);
  ctx.stroke();

  // Draw S
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineWidth = 30;
  ctx.strokeStyle = yellow;
  ctx.beginPath();
  ctx.moveTo(150, 70); // Fusion point!
  ctx.lineTo(210, 70);
  ctx.lineTo(210, 135);
  ctx.lineTo(90, 135);
  ctx.lineTo(90, 200);
  ctx.lineTo(210, 200);
  ctx.stroke();

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('icon.png', buffer);
  console.log('Intertwined MS logo generated successfully!');
}
createIntertwinedLogo();

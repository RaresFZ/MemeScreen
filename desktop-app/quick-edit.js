const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

const memeCanvas = document.getElementById('memeCanvas');
const memeVideo = document.getElementById('memeVideo');
const ctx = memeCanvas.getContext('2d');
const memeTextInput = document.getElementById('memeText');
const sizeSlider = document.getElementById('sizeSlider');
const sendBtn = document.getElementById('sendBtn');
const cancelBtn = document.getElementById('cancelBtn');
const uploadStatus = document.getElementById('uploadStatus');

let currentMediaType = null;
let currentMediaPath = null;
let currentImage = null;

let memeText = {
  text: "",
  x: 0,
  y: 0,
  size: 80
};

let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

ipcRenderer.on('load-media', (event, { filePath, type }) => {
  currentMediaPath = filePath;
  currentMediaType = type;
  
  if (type === 'image') {
    memeVideo.style.display = 'none';
    memeCanvas.style.display = 'block';
    
    currentImage = new Image();
    currentImage.onload = () => {
      memeCanvas.width = currentImage.width;
      memeCanvas.height = currentImage.height;
      memeText.x = memeCanvas.width / 2;
      memeText.y = memeCanvas.height - (memeCanvas.height / 4);
      memeText.size = Math.floor(memeCanvas.height / 8) || 80;
      sizeSlider.value = memeText.size;
      drawMeme();
    };
    currentImage.src = 'file:///' + filePath.replace(/\\/g, '/');
  } else if (type === 'video') {
    currentImage = null;
    memeVideo.style.display = 'block';
    
    memeVideo.src = 'file:///' + filePath.replace(/\\/g, '/');
    memeVideo.onloadedmetadata = () => {
      memeCanvas.width = memeVideo.videoWidth;
      memeCanvas.height = memeVideo.videoHeight;
      memeText.x = memeCanvas.width / 2;
      memeText.y = memeCanvas.height - (memeCanvas.height / 4);
      memeText.size = Math.floor(memeCanvas.height / 8) || 80;
      sizeSlider.value = memeText.size;
      drawMeme();
    };
  }
});

function drawMeme() {
  if (currentMediaType === 'image' && currentImage) {
    ctx.drawImage(currentImage, 0, 0);
  } else if (currentMediaType === 'video') {
    ctx.clearRect(0, 0, memeCanvas.width, memeCanvas.height);
  }
  
  if (!memeText.text) return;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  
  ctx.font = `900 ${memeText.size}px Impact, Arial Black, sans-serif`;
  ctx.lineWidth = Math.max(2, Math.floor(memeText.size / 15));
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'black';
  
  const lines = memeText.text.split('\n');
  
  for (let j = 0; j < lines.length; j++) {
    const lineY = memeText.y + (j * memeText.size * 1.1);
    ctx.fillText(lines[j], memeText.x, lineY);
    ctx.strokeText(lines[j], memeText.x, lineY);
  }
}

function getMousePos(evt) {
  const rect = memeCanvas.getBoundingClientRect();
  const scaleX = memeCanvas.width / rect.width;
  const scaleY = memeCanvas.height / rect.height;
  return {
    x: (evt.clientX - rect.left) * scaleX,
    y: (evt.clientY - rect.top) * scaleY
  };
}

memeCanvas.addEventListener('mousedown', (e) => {
  if (!memeText.text) return;
  const pos = getMousePos(e);
  
  // Hitbox simplifiée
  isDragging = true;
  dragOffsetX = pos.x - memeText.x;
  dragOffsetY = pos.y - memeText.y;
});

memeCanvas.addEventListener('mousemove', (e) => {
  if (isDragging) {
    const pos = getMousePos(e);
    memeText.x = pos.x - dragOffsetX;
    memeText.y = pos.y - dragOffsetY;
    drawMeme();
  }
});

window.addEventListener('mouseup', () => { isDragging = false; });

memeTextInput.addEventListener('input', (e) => {
  memeText.text = e.target.value.toUpperCase();
  drawMeme();
});

sizeSlider.addEventListener('input', (e) => {
  memeText.size = parseInt(e.target.value, 10);
  drawMeme();
});

cancelBtn.addEventListener('click', () => {
  window.close();
});

sendBtn.addEventListener('click', () => {
  sendBtn.disabled = true;
  sendBtn.textContent = "Traitement... ⏳";
  
  let textsArr = [];
  if (memeText.text.trim().length > 0) {
    textsArr.push(memeText);
  }
  
  if (currentMediaType === 'image') {
    setTimeout(() => {
      memeCanvas.toBlob(async (blob) => {
        if (!blob) return;
        const buffer = Buffer.from(await blob.arrayBuffer());
        const tempPath = path.join(os.tmpdir(), `meme_${Date.now()}.png`);
        fs.writeFileSync(tempPath, buffer);
        
        ipcRenderer.send('discord-upload', { filePath: tempPath, fileName: 'meme.png' });
      }, 'image/png');
    }, 100);
  } else if (currentMediaType === 'video') {
    ipcRenderer.send('process-video', {
      inputPath: currentMediaPath,
      texts: textsArr,
      width: memeCanvas.width,
      height: memeCanvas.height
    });
  }
});

ipcRenderer.on('upload-status', (event, response) => {
  if (response.success) {
    window.close();
  } else {
    sendBtn.disabled = false;
    sendBtn.textContent = "Envoyer 🚀";
    uploadStatus.textContent = response.error || "Erreur lors de l'upload.";
    uploadStatus.style.color = "#ef4444";
    setTimeout(() => { uploadStatus.textContent = ""; }, 5000);
  }
});

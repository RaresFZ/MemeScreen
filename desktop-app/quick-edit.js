const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

const memeCanvas = document.getElementById('memeCanvas');
const memeVideo = document.getElementById('memeVideo');
const ctx = memeCanvas.getContext('2d');

const sizeSlider = document.getElementById('sizeSlider');
const sendBtn = document.getElementById('sendBtn');
const cancelBtn = document.getElementById('cancelBtn');
const headerCloseBtn = document.getElementById('headerCloseBtn');
if(headerCloseBtn) headerCloseBtn.addEventListener('click', () => window.close());

const headerBackBtn = document.getElementById('headerBackBtn');
if(headerBackBtn) {
  headerBackBtn.addEventListener('click', () => {
    ipcRenderer.send('return-to-quick-menu');
    window.close();
  });
}

const uploadStatus = document.getElementById('uploadStatus');

let currentMediaType = null;
let currentMediaPath = null;
let currentImage = null;



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
      memeTexts[0].x = memeCanvas.width / 2;
      memeTexts[0].y = memeCanvas.height - (memeCanvas.height / 4);
      memeTexts[0].size = Math.floor(memeCanvas.height / 8) || 80;
      sizeSlider.value = memeTexts[0].size;
      drawMeme();
    };
    
    if (filePath.startsWith('http')) {
      currentImage.crossOrigin = "Anonymous";
      currentImage.src = filePath;
    } else {
      currentImage.src = 'file:///' + filePath.replace(/\\/g, '/');
    }

  } else if (type === 'video') {
    currentImage = null;
    memeVideo.style.display = 'block';
    
    memeVideo.src = 'file:///' + filePath.replace(/\\/g, '/');
    memeVideo.onloadedmetadata = () => {
      memeCanvas.width = memeVideo.videoWidth;
      memeCanvas.height = memeVideo.videoHeight;
      memeTexts[0].x = memeCanvas.width / 2;
      memeTexts[0].y = memeCanvas.height - (memeCanvas.height / 4);
      memeTexts[0].size = Math.floor(memeCanvas.height / 8) || 80;
      sizeSlider.value = memeTexts[0].size;
      drawMeme();
    };
  }
});

/* DRAW MEME REPLACED */


let memeTexts = [
  { text: "", x: 0, y: 0, size: 80 }
];
let draggingTextIndex = -1;

const textsContainer = document.getElementById('textsContainer');
const addTextBtn = document.getElementById('addTextBtn');

if (addTextBtn) {
  addTextBtn.addEventListener('click', () => {
    if (memeTexts.length >= 3) return;
    const newY = memeCanvas.height ? memeCanvas.height / (memeTexts.length + 2) : 0;
    memeTexts.push({ text: "", x: memeCanvas.width ? memeCanvas.width / 2 : 0, y: newY, size: memeTexts[0].size });
    
    const div = document.createElement('div');
    div.className = 'row text-row';
    div.innerHTML = `<input type="text" class="memeText" placeholder="Ligne supplémentaire...">`;
    textsContainer.appendChild(div);
    
    bindTextInputs();
  });
}

function bindTextInputs() {
  const inputs = document.querySelectorAll('.memeText');
  inputs.forEach((input, index) => {
    input.oninput = (e) => {
      if (memeTexts[index]) {
        memeTexts[index].text = e.target.value.toUpperCase();
        drawMeme();
      }
    };
  });
}
bindTextInputs();

// OVERWRITE old draw logic
function drawMeme() {
  if (currentMediaType === 'image' && currentImage) {
    ctx.drawImage(currentImage, 0, 0);
  } else if (currentMediaType === 'video') {
    ctx.clearRect(0, 0, memeCanvas.width, memeCanvas.height);
  }
  
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  
  memeTexts.forEach(txt => {
    if (!txt.text) return;
    ctx.font = `900 ${txt.size}px Impact, Arial Black, sans-serif`;
    ctx.lineWidth = Math.max(2, Math.floor(txt.size / 15));
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    
    const lines = txt.text.split('\n');
    for (let j = 0; j < lines.length; j++) {
      const lineY = txt.y + (j * txt.size * 1.1);
      ctx.fillText(lines[j], txt.x, lineY);
      ctx.strokeText(lines[j], txt.x, lineY);
    }
  });
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
  const pos = getMousePos(e);
  for (let i = memeTexts.length - 1; i >= 0; i--) {
    const t = memeTexts[i];
    if (!t.text) continue;
    // Simple hitbox approximation
    if (Math.abs(pos.x - t.x) < 200 && Math.abs(pos.y - t.y) < 100) {
      isDragging = true;
      draggingTextIndex = i;
      dragOffsetX = pos.x - t.x;
      dragOffsetY = pos.y - t.y;
      break;
    }
  }
});

memeCanvas.addEventListener('mousemove', (e) => {
  if (isDragging && draggingTextIndex > -1) {
    const pos = getMousePos(e);
    memeTexts[draggingTextIndex].x = pos.x - dragOffsetX;
    memeTexts[draggingTextIndex].y = pos.y - dragOffsetY;
    drawMeme();
  }
});


window.addEventListener('mouseup', () => { isDragging = false; });



sizeSlider.addEventListener('input', (e) => {
  memeTexts.forEach(t => t.size = parseInt(e.target.value, 10));
  drawMeme();
});

cancelBtn.addEventListener('click', () => {
  window.close();
});

sendBtn.addEventListener('click', () => {
  sendBtn.disabled = true;
  sendBtn.textContent = "Traitement... ⏳";
  
  
  let textsArr = memeTexts.filter(t => t.text.trim().length > 0);

  
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

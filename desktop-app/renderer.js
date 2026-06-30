const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

// UI Elements
const views = {
  login: document.getElementById('loginScreen'),
  main: document.getElementById('mainScreen'),
  editor: document.getElementById('editorScreen'),
  settings: document.getElementById('settingsScreen')
};

const navItems = {
  login: document.getElementById('nav-login'),
  main: document.getElementById('nav-main'),
  editor: document.getElementById('nav-editor'),
  settings: document.getElementById('nav-settings')
};

const inputs = {
  token: document.getElementById('botToken'),
  channelId: document.getElementById('channelId'),
  mediaInput: document.getElementById('mediaInput')
};

const buttons = {
  connect: document.getElementById('connectBtn'),
  disconnect: document.getElementById('disconnectBtn'),
  upload: document.getElementById('uploadBtn')
};

const texts = {
  connStatus: document.getElementById('connectionStatus'),
  botStatusText: document.getElementById('botStatusText'),
  botStatusDot: document.getElementById('botStatusDot'),
  uploadStatus: document.getElementById('uploadStatus')
};

// Editor UI
const memeCanvas = document.getElementById('memeCanvas');
const memeVideo = document.getElementById('memeVideo');
const ctx = memeCanvas.getContext('2d');
const cancelMemeBtn = document.getElementById('cancelMemeBtn');
const sendMemeBtn = document.getElementById('sendMemeBtn');

const addTextBtn = document.getElementById('addTextBtn');
const deleteTextBtn = document.getElementById('deleteTextBtn');
const textProperties = document.getElementById('textProperties');
const selectedTextInput = document.getElementById('selectedTextInput');
const sizeSlider = document.getElementById('sizeSlider');
const sizeValue = document.getElementById('sizeValue');

let currentMediaType = null; // 'image' or 'video'
let currentMediaPath = null;
let currentImage = null;
let memeTexts = [];
let selectedIndex = -1;
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

// --- NAVIGATION ---
function showView(viewName) {
  Object.values(views).forEach(v => v.classList.remove('active'));
  Object.values(navItems).forEach(n => n.classList.remove('active'));
  
  views[viewName].classList.add('active');
  navItems[viewName].classList.add('active');
}

navItems.login.addEventListener('click', () => showView('login'));
navItems.main.addEventListener('click', () => showView('main'));
navItems.editor.addEventListener('click', () => {
  if (currentMediaType) showView('editor');
});
navItems.settings.addEventListener('click', () => showView('settings'));

// --- SETTINGS LOGIC ---
const durationSlider = document.getElementById('durationSlider');
const durationValue = document.getElementById('durationValue');
const scaleSlider = document.getElementById('scaleSlider');
const scaleValue = document.getElementById('scaleValue');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const positionSelect = document.getElementById('positionSelect');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

let appSettings = { duration: 7, scale: 100, volume: 50, position: 'bottom-right' };
const storedSettings = localStorage.getItem('memescreen_settings');
if (storedSettings) {
  try { appSettings = JSON.parse(storedSettings); } catch (e) {}
}
if (!appSettings.position) appSettings.position = 'bottom-right';

durationSlider.value = appSettings.duration;
durationValue.textContent = appSettings.duration;
scaleSlider.value = appSettings.scale;
scaleValue.textContent = appSettings.scale;
volumeSlider.value = appSettings.volume;
volumeValue.textContent = appSettings.volume;
positionSelect.value = appSettings.position;

ipcRenderer.send('update-settings', appSettings);

durationSlider.addEventListener('input', (e) => durationValue.textContent = e.target.value);
scaleSlider.addEventListener('input', (e) => scaleValue.textContent = e.target.value);
volumeSlider.addEventListener('input', (e) => volumeValue.textContent = e.target.value);

saveSettingsBtn.addEventListener('click', () => {
  appSettings.duration = parseInt(durationSlider.value, 10);
  appSettings.scale = parseInt(scaleSlider.value, 10);
  appSettings.volume = parseInt(volumeSlider.value, 10);
  appSettings.position = positionSelect.value;
  
  localStorage.setItem('memescreen_settings', JSON.stringify(appSettings));
  ipcRenderer.send('update-settings', appSettings);
  showView('main');
});

// --- INIT ---
const packageJson = require('./package.json');
document.getElementById('appVersion').textContent = `v${packageJson.version}`;

const savedToken = localStorage.getItem('memescreen_token');
const savedChannel = localStorage.getItem('memescreen_channel');
if (savedToken) inputs.token.value = savedToken;
if (savedChannel) inputs.channelId.value = savedChannel;

// --- DISCORD LOGIN ---
buttons.connect.addEventListener('click', () => {
  const token = inputs.token.value.trim();
  const channelId = inputs.channelId.value.trim();
  
  if (!token || !channelId) {
    texts.connStatus.textContent = "Veuillez remplir les deux champs.";
    return;
  }
  
  texts.connStatus.textContent = "Connexion à Discord...";
  texts.connStatus.style.color = "#94a3b8";
  buttons.connect.disabled = true;

  ipcRenderer.send('discord-login', { token, channelId });
});

ipcRenderer.on('discord-status', (event, response) => {
  buttons.connect.disabled = false;
  if (response.success) {
    localStorage.setItem('memescreen_token', inputs.token.value.trim());
    localStorage.setItem('memescreen_channel', inputs.channelId.value.trim());
    
    navItems.main.disabled = false;
    navItems.settings.disabled = false;
    
    texts.botStatusDot.classList.add('online');
    texts.botStatusText.textContent = response.user;
    buttons.disconnect.style.display = 'block';
    
    texts.connStatus.textContent = "";
    showView('main');
  } else {
    texts.connStatus.textContent = response.error;
    texts.connStatus.style.color = "#ef4444";
  }
});

buttons.disconnect.addEventListener('click', () => {
  ipcRenderer.send('discord-logout');
  navItems.main.disabled = true;
  navItems.editor.disabled = true;
  navItems.settings.disabled = true;
  texts.botStatusDot.classList.remove('online');
  texts.botStatusText.textContent = 'Déconnecté';
  buttons.disconnect.style.display = 'none';
  showView('login');
});

// --- UPLOAD ---
buttons.upload.addEventListener('click', () => {
  inputs.mediaInput.click();
});

inputs.mediaInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const fileSize = file.size;

  if (fileSize > 15 * 1024 * 1024) {
    inputs.mediaInput.value = '';
    texts.uploadStatus.textContent = "❌ Fichier trop lourd ! (Max 15 Mo)";
    texts.uploadStatus.style.color = "#ef4444";
    setTimeout(() => { texts.uploadStatus.textContent = ""; }, 4000);
    return;
  }

  currentMediaPath = file.path;
  memeTexts = [];
  selectedIndex = -1;
  updateEditorUI();
  navItems.editor.disabled = false;

  if (file.type.startsWith('image/')) {
    currentMediaType = 'image';
    memeVideo.style.display = 'none';
    memeCanvas.style.display = 'block';
    
    const url = URL.createObjectURL(file);
    currentImage = new Image();
    currentImage.onload = () => {
      memeCanvas.width = currentImage.width;
      memeCanvas.height = currentImage.height;
      drawMeme();
      showView('editor');
    };
    currentImage.src = url;
  } else if (file.type.startsWith('video/')) {
    currentMediaType = 'video';
    currentImage = null;
    memeVideo.style.display = 'block';
    
    const url = URL.createObjectURL(file);
    memeVideo.src = url;
    memeVideo.onloadedmetadata = () => {
      memeCanvas.width = memeVideo.videoWidth;
      memeCanvas.height = memeVideo.videoHeight;
      drawMeme();
      showView('editor');
    };
  }
});

// --- CANVAS EDITOR LOGIC ---

function drawMeme() {
  if (currentMediaType === 'image' && currentImage) {
    ctx.drawImage(currentImage, 0, 0);
  } else if (currentMediaType === 'video') {
    ctx.clearRect(0, 0, memeCanvas.width, memeCanvas.height);
  }
  
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  
  for (let i = 0; i < memeTexts.length; i++) {
    const t = memeTexts[i];
    
    ctx.font = `900 ${t.size}px Impact, Arial Black, sans-serif`;
    ctx.lineWidth = Math.max(2, Math.floor(t.size / 15));
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    
    const lines = t.text.split('\n');
    let maxWidth = 0;
    
    for (let j = 0; j < lines.length; j++) {
      const lineY = t.y + (j * t.size * 1.1);
      ctx.fillText(lines[j], t.x, lineY);
      ctx.strokeText(lines[j], t.x, lineY);
      
      const metrics = ctx.measureText(lines[j]);
      if (metrics.width > maxWidth) maxWidth = metrics.width;
    }
    
    if (i === selectedIndex) {
      const width = maxWidth + 20;
      const height = (lines.length * t.size * 1.1) + 10;
      
      ctx.strokeStyle = '#6366f1'; 
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 5]);
      ctx.strokeRect(t.x - width/2, t.y - 10, width, height);
      ctx.setLineDash([]); 
    }
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

function getHitTextIndex(x, y) {
  for (let i = memeTexts.length - 1; i >= 0; i--) {
    const t = memeTexts[i];
    ctx.font = `900 ${t.size}px Impact, Arial Black, sans-serif`;
    
    const lines = t.text.split('\n');
    let maxWidth = 0;
    for (const line of lines) {
      const metrics = ctx.measureText(line);
      if (metrics.width > maxWidth) maxWidth = metrics.width;
    }
    
    const width = maxWidth;
    const height = lines.length * t.size * 1.1;
    
    if (x >= t.x - width/2 && x <= t.x + width/2 &&
        y >= t.y && y <= t.y + height) {
      return i;
    }
  }
  return -1;
}

memeCanvas.addEventListener('mousedown', (e) => {
  const pos = getMousePos(e);
  const hitIndex = getHitTextIndex(pos.x, pos.y);
  
  if (hitIndex !== -1) {
    selectedIndex = hitIndex;
    isDragging = true;
    dragOffsetX = pos.x - memeTexts[selectedIndex].x;
    dragOffsetY = pos.y - memeTexts[selectedIndex].y;
  } else {
    selectedIndex = -1;
  }
  updateEditorUI();
  drawMeme();
});

memeCanvas.addEventListener('mousemove', (e) => {
  if (isDragging && selectedIndex !== -1) {
    const pos = getMousePos(e);
    memeTexts[selectedIndex].x = pos.x - dragOffsetX;
    memeTexts[selectedIndex].y = pos.y - dragOffsetY;
    drawMeme();
  }
});

window.addEventListener('mouseup', () => { isDragging = false; });

function updateEditorUI() {
  if (selectedIndex !== -1) {
    textProperties.style.display = 'block';
    deleteTextBtn.disabled = false;
    selectedTextInput.value = memeTexts[selectedIndex].text;
    sizeSlider.value = memeTexts[selectedIndex].size;
    sizeValue.textContent = memeTexts[selectedIndex].size;
  } else {
    textProperties.style.display = 'none';
    deleteTextBtn.disabled = true;
  }
}

addTextBtn.addEventListener('click', () => {
  memeTexts.push({
    text: "NOUVEAU TEXTE",
    x: memeCanvas.width / 2,
    y: memeCanvas.height / 2,
    size: Math.floor(memeCanvas.height / 8) || 80
  });
  selectedIndex = memeTexts.length - 1;
  updateEditorUI();
  drawMeme();
});

deleteTextBtn.addEventListener('click', () => {
  if (selectedIndex !== -1) {
    memeTexts.splice(selectedIndex, 1);
    selectedIndex = -1;
    updateEditorUI();
    drawMeme();
  }
});

selectedTextInput.addEventListener('input', (e) => {
  if (selectedIndex !== -1) {
    memeTexts[selectedIndex].text = e.target.value.toUpperCase();
    drawMeme();
  }
});

sizeSlider.addEventListener('input', (e) => {
  if (selectedIndex !== -1) {
    memeTexts[selectedIndex].size = parseInt(e.target.value, 10);
    sizeValue.textContent = memeTexts[selectedIndex].size;
    drawMeme();
  }
});

cancelMemeBtn.addEventListener('click', () => {
  inputs.mediaInput.value = '';
  currentMediaType = null;
  currentMediaPath = null;
  currentImage = null;
  memeTexts = [];
  navItems.editor.disabled = true;
  memeVideo.pause();
  memeVideo.src = "";
  showView('main');
});

sendMemeBtn.addEventListener('click', () => {
  sendMemeBtn.disabled = true;
  sendMemeBtn.textContent = "Traitement... ⏳";
  
  selectedIndex = -1;
  updateEditorUI();
  drawMeme();
  
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
      texts: memeTexts,
      width: memeCanvas.width,
      height: memeCanvas.height
    });
  }
});

ipcRenderer.on('upload-status', (event, response) => {
  sendMemeBtn.disabled = false;
  sendMemeBtn.textContent = "Envoyer 🚀";
  inputs.mediaInput.value = '';
  memeVideo.pause();
  memeVideo.src = "";
  navItems.editor.disabled = true;
  
  showView('main');
  
  if (response.success) {
    texts.uploadStatus.textContent = "✅ Média envoyé avec succès !";
    texts.uploadStatus.style.color = "#10b981";
  } else {
    texts.uploadStatus.textContent = response.error || "Erreur lors de l'upload.";
    texts.uploadStatus.style.color = "#ef4444";
  }
  
  setTimeout(() => { texts.uploadStatus.textContent = ""; }, 4000);
});

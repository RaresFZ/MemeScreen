const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

// UI Elements
const views = {
  login: document.getElementById('loginScreen'),
  main: document.getElementById('mainScreen'),
  editor: document.getElementById('editorScreen'),
  troll: document.getElementById('trollScreen'),
  settings: document.getElementById('settingsScreen')
};

const navItems = {
  login: document.getElementById('nav-login'),
  main: document.getElementById('nav-main'),
  editor: document.getElementById('nav-editor'),
  troll: document.getElementById('nav-troll'),
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
navItems.editor.addEventListener('click', () => showView('editor'));
navItems.troll.addEventListener('click', () => showView('troll'));
navItems.settings.addEventListener('click', () => showView('settings'));

// --- TABS LOGIC ---
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(tc => tc.classList.remove('active'));
    
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
  });
});

// --- SETTINGS LOGIC ---
const durationSlider = document.getElementById('durationSliderSettings');
const durationValue = document.getElementById('durationValue');
const scaleSlider = document.getElementById('scaleSliderSettings');
const scaleValue = document.getElementById('scaleValue');
const volumeSlider = document.getElementById('volumeSliderSettings');
const volumeValue = document.getElementById('volumeValue');
const positionSelect = document.getElementById('positionSelectSettings');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

// Window controls
document.getElementById('minBtn').addEventListener('click', () => ipcRenderer.send('window-min'));
document.getElementById('maxBtn').addEventListener('click', () => ipcRenderer.send('window-max'));
document.getElementById('closeBtn').addEventListener('click', () => ipcRenderer.send('window-close'));

// HUD Live Logs Simulation
const liveLogs = document.getElementById('liveLogs');
const logMessages = [
  "CONNECTING TO OVERLAY...",
  "UPDATING MEDIA CACHE.",
  "FETCHING DISCORD STATUS...",
  "SYS_MEM: ALLOCATED 1024MB",
  "AWAITING COMMAND...",
  "SYNCING MACROS...",
  "PING: 14ms",
  "RENDER ENGINE: OK"
];
setInterval(() => {
  if (!liveLogs) return;
  const newLog = document.createElement('div');
  newLog.textContent = "> " + logMessages[Math.floor(Math.random() * logMessages.length)];
  liveLogs.appendChild(newLog);
  if (liveLogs.childElementCount > 15) {
    liveLogs.removeChild(liveLogs.firstChild);
  }
}, 3000);

let appSettings = { duration: 7, scale: 100, volume: 50, position: 'bottom-right' };
const storedSettings = localStorage.getItem('memescreen_settings');
if (storedSettings) {
  try { appSettings = JSON.parse(storedSettings); } catch (e) {}
}
if (!appSettings.position) appSettings.position = 'bottom-right';

if (durationSlider) durationSlider.value = appSettings.duration;
if (durationValue) durationValue.textContent = appSettings.duration;
if (scaleSlider) scaleSlider.value = appSettings.scale;
if (scaleValue) scaleValue.textContent = appSettings.scale;
if (volumeSlider) volumeSlider.value = appSettings.volume;
if (volumeValue) volumeValue.textContent = appSettings.volume;
if (positionSelect) positionSelect.value = appSettings.position;

const userPseudoInput = document.getElementById('userPseudo');
let myPseudo = localStorage.getItem('memescreen_pseudo') || '';
if (userPseudoInput) userPseudoInput.value = myPseudo;

ipcRenderer.send('update-settings', appSettings);

if (durationSlider) durationSlider.addEventListener('input', (e) => durationValue.textContent = e.target.value);
if (scaleSlider) scaleSlider.addEventListener('input', (e) => scaleValue.textContent = e.target.value);
if (volumeSlider) volumeSlider.addEventListener('input', (e) => volumeValue.textContent = e.target.value);

if (saveSettingsBtn) {
  saveSettingsBtn.addEventListener('click', () => {
    appSettings = {
      duration: parseInt(durationSlider.value, 10),
      scale: parseInt(scaleSlider.value, 10),
      volume: parseInt(volumeSlider.value, 10),
      position: positionSelect.value
    };
    localStorage.setItem('memescreen_settings', JSON.stringify(appSettings));
    
    if (userPseudoInput) {
      myPseudo = userPseudoInput.value.trim();
      localStorage.setItem('memescreen_pseudo', myPseudo);
    }
    
    ipcRenderer.send('update-settings', appSettings);
    
    const autoStart = document.getElementById('autoStartCheckbox').checked;
    ipcRenderer.send('set-autostart', autoStart);
    
    const btn = saveSettingsBtn;
    btn.textContent = 'Sauvegardé ✔️';
    btn.style.background = '#10b981';
    setTimeout(() => {
      btn.textContent = 'Sauvegarder';
      btn.style.background = '#6366f1';
    }, 2000);
  });
}

// --- INIT ---
const packageJson = require('./package.json');
document.getElementById('appVersion').textContent = `v${packageJson.version}`;

const savedToken = localStorage.getItem('memescreen_token');
const savedChannel = localStorage.getItem('memescreen_channel');
if (savedToken) inputs.token.value = savedToken;
if (savedChannel) inputs.channelId.value = savedChannel;

if (savedToken && savedChannel) {
  setTimeout(() => {
    buttons.connect.click();
  }, 500);
}

const autoStartCheckbox = document.getElementById('autoStartCheckbox');
if (autoStartCheckbox) {
  autoStartCheckbox.checked = localStorage.getItem('memescreen_autostart') === 'true';
  autoStartCheckbox.addEventListener('change', (e) => {
    localStorage.setItem('memescreen_autostart', e.target.checked);
    ipcRenderer.send('set-autostart', e.target.checked);
  });
}

// --- DISCORD LOGIN ---
buttons.connect.addEventListener('click', () => {
  const token = inputs.token.value.trim();
  const channelId = inputs.channelId.value.trim();
  
  if (!token || !channelId) {
    texts.connStatus.textContent = "Veuillez remplir les deux champs.";
    texts.connStatus.style.color = "#ef4444";
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
    
    navItems.main.removeAttribute('disabled');
    navItems.editor.removeAttribute('disabled');
    navItems.troll.removeAttribute('disabled');
    navItems.settings.removeAttribute('disabled');
    
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

const selectMediaBtn = document.getElementById('selectMediaBtn');
if (selectMediaBtn) {
  selectMediaBtn.addEventListener('click', () => {
    inputs.mediaInput.click();
  });
}

const mediaWrapper = document.getElementById('mediaWrapper');
const toolbarGroup = document.getElementById('toolbarGroup');
const sendControls = document.getElementById('sendControls');
const soundSelect = document.getElementById('soundSelect');

const memeImagePreview = document.getElementById('memeImagePreview');
const gifSearchInput = document.getElementById('gifSearchInput');
const gifSearchBtn = document.getElementById('gifSearchBtn');
const gifGrid = document.getElementById('gifGrid');

if (gifSearchBtn) {
  gifSearchBtn.addEventListener('click', async () => {
    const query = gifSearchInput.value.trim();
    if (!query) return;
    
    gifGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center;"><p class="text-muted">Recherche en cours... ⏳</p></div>';
    
    try {
      const res = await fetch(`https://api.tenor.com/v1/search?q=${encodeURIComponent(query)}&key=LIVDSRZULELA&limit=50`);
      const data = await res.json();
      
      gifGrid.innerHTML = '';
      if (data.results.length === 0) {
        gifGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center;"><p class="text-muted">Aucun résultat.</p></div>';
        return;
      }
      
      data.results.forEach(gif => {
        const img = document.createElement('img');
        img.src = gif.media[0].tinygif.url; // Use tinygif for preview
        img.style.width = '100%';
        img.style.height = '150px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '5px';
        img.style.cursor = 'pointer';
        
        img.addEventListener('click', async () => {
          gifGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center;"><p class="text-muted">Téléchargement du GIF... ⏳</p></div>';
          try {
            const bufRes = await fetch(gif.media[0].gif.url);
            const blob = await bufRes.blob();
            const buffer = Buffer.from(await blob.arrayBuffer());
            const tempPath = path.join(os.tmpdir(), `gif_${Date.now()}.gif`);
            fs.writeFileSync(tempPath, buffer);
            
            // Revenir à l'onglet local
            document.querySelector('.tab[data-tab="local"]').click();
            
            loadMediaFile({ path: tempPath, type: 'image/gif', name: 'meme.gif' });
            
            gifSearchBtn.click(); // re-fetch to restore grid
          } catch (e) {
            gifGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center;"><p class="text-muted" style="color:#ef4444;">Erreur.</p></div>';
          }
        });
        
        gifGrid.appendChild(img);
      });
    } catch (error) {
      gifGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center;"><p class="text-muted" style="color:#ef4444;">Erreur API.</p></div>';
    }
  });
  
  if (gifSearchInput) {
    gifSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') gifSearchBtn.click();
    });
  }
}

inputs.mediaInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) loadMediaFile(file);
});

function loadMediaFile(file) {
  const fileSize = file.size || 0; // Size can be undefined for downloaded buffers, but we check 15MB anyway

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
  resetAudioState();
  updateEditorUI();
  navItems.editor.disabled = false;
  
  if (mediaWrapper) mediaWrapper.style.display = 'block';
  const mediaPlaceholder = document.getElementById('mediaPlaceholder');
  if (mediaPlaceholder) mediaPlaceholder.style.display = 'none';
  const propertiesArea = document.getElementById('propertiesArea');
  if (propertiesArea) propertiesArea.style.display = 'block';
  if (toolbarGroup) toolbarGroup.style.display = 'flex';
  if (sendControls) sendControls.style.display = 'block';

  // Traiter le GIF comme une vidéo (pour le passer à FFmpeg)
  if (file.type.startsWith('image/') && !file.name.toLowerCase().endsWith('.gif')) {
    currentMediaType = 'image';
    memeVideo.style.display = 'none';
    if (memeImagePreview) memeImagePreview.style.display = 'none';
    memeCanvas.style.display = 'block';
    
    const url = (file instanceof File) ? URL.createObjectURL(file) : 'file:///' + file.path.replace(/\\/g, '/');
    currentImage = new Image();
    currentImage.onload = () => {
      memeCanvas.width = currentImage.width;
      memeCanvas.height = currentImage.height;
      drawMeme();
      showView('editor');
    };
    currentImage.src = url;
  } else if (file.type.startsWith('video/') || file.name.toLowerCase().endsWith('.gif')) {
    currentMediaType = 'video';
    currentImage = null;
    memeCanvas.style.display = 'block';
    
    const url = (file instanceof File) ? URL.createObjectURL(file) : 'file:///' + file.path.replace(/\\/g, '/');
    
    if (file.name.toLowerCase().endsWith('.gif')) {
      memeVideo.style.display = 'none';
      if (memeImagePreview) {
        memeImagePreview.style.display = 'block';
        memeImagePreview.src = url;
      }
      
      const tempImg = new Image();
      tempImg.onload = () => {
        memeCanvas.width = tempImg.width;
        memeCanvas.height = tempImg.height;
        drawMeme();
        showView('editor');
      };
      tempImg.src = url;
    } else {
      if (memeImagePreview) memeImagePreview.style.display = 'none';
      memeVideo.style.display = 'block';
      memeVideo.src = url;
      memeVideo.onloadedmetadata = () => {
        memeCanvas.width = memeVideo.videoWidth;
        memeCanvas.height = memeVideo.videoHeight;
        drawMeme();
        showView('editor');
      };
    }
  }
}

// --- MYINSTANTS SOUND SEARCH ---
const soundSearchInput = document.getElementById('soundSearchInput');
const soundSearchBtn = document.getElementById('soundSearchBtn');
const soundResults = document.getElementById('soundResults');
const selectedSoundName = document.getElementById('selectedSoundName');
const clearSoundBtn = document.getElementById('clearSoundBtn');
const previewControls = document.getElementById('previewControls');
const previewVolume = document.getElementById('previewVolume');
const stopPreviewBtn = document.getElementById('stopPreviewBtn');

let currentPreviewAudio = null;

if (previewVolume) {
  previewVolume.addEventListener('input', (e) => {
    if (currentPreviewAudio) {
      currentPreviewAudio.volume = e.target.value;
    }
  });
}

if (stopPreviewBtn) {
  stopPreviewBtn.addEventListener('click', () => {
    if (currentPreviewAudio) {
      currentPreviewAudio.pause();
      currentPreviewAudio.currentTime = 0;
      currentPreviewAudio = null;
      stopPreviewBtn.style.display = 'none';
    }
  });
}

if (soundSearchBtn) {
  soundSearchBtn.addEventListener('click', async () => {
    const query = soundSearchInput.value.trim();
    if (!query) return;
    
    soundSearchBtn.disabled = true;
    soundSearchBtn.textContent = "⏳";
    soundResults.style.display = 'block';
    if (previewControls) previewControls.style.display = 'flex';
    soundResults.innerHTML = '<p class="text-muted" style="text-align:center;">Recherche...</p>';
    
    try {
      const res = await fetch(`https://www.myinstants.com/api/v1/instants/?name=${encodeURIComponent(query)}`);
      const data = await res.json();
      
      soundResults.innerHTML = '';
      if (data.results && data.results.length > 0) {
        data.results.slice(0, 10).forEach(instant => {
          const div = document.createElement('div');
          div.style.padding = '5px';
          div.style.borderBottom = '1px solid #334155';
          div.style.display = 'flex';
          div.style.justifyContent = 'space-between';
          div.style.alignItems = 'center';
          
          const nameSpan = document.createElement('span');
          nameSpan.textContent = instant.name;
          nameSpan.style.color = '#fff';
          nameSpan.style.fontWeight = 'bold';
          nameSpan.style.fontSize = '0.9em';
          
          const buttonsDiv = document.createElement('div');
          buttonsDiv.style.display = 'flex';
          buttonsDiv.style.gap = '5px';

          const previewBtn = document.createElement('button');
          previewBtn.textContent = "▶️";
          previewBtn.className = "btn-small btn-secondary";
          previewBtn.style.padding = "2px 5px";
          previewBtn.title = "Écouter un aperçu";
          previewBtn.onclick = () => {
            if (currentPreviewAudio) {
              currentPreviewAudio.pause();
              currentPreviewAudio.currentTime = 0;
            }
            currentPreviewAudio = new Audio(instant.sound);
            currentPreviewAudio.volume = previewVolume ? previewVolume.value : 0.5;
            currentPreviewAudio.play();
            
            if (stopPreviewBtn) stopPreviewBtn.style.display = 'inline-block';
            
            currentPreviewAudio.onended = () => {
              if (stopPreviewBtn && currentPreviewAudio) {
                stopPreviewBtn.style.display = 'none';
              }
            };
          };

          const selectBtn = document.createElement('button');
          selectBtn.textContent = "Choisir";
          selectBtn.className = "btn-small primary-btn";
          selectBtn.style.padding = "2px 8px";
          selectBtn.onclick = async () => {
            if (currentPreviewAudio) {
              currentPreviewAudio.pause();
              currentPreviewAudio.currentTime = 0;
              currentPreviewAudio = null;
              if (stopPreviewBtn) stopPreviewBtn.style.display = 'none';
            }
            
            selectedSoundName.textContent = "Téléchargement...";
            selectedSoundName.style.color = "#fbbf24";
            soundResults.style.display = 'none';
            if (previewControls) previewControls.style.display = 'none';
            
            try {
              const soundRes = await fetch(instant.sound);
              const arrayBuffer = await soundRes.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              const tempSoundPath = path.join(os.tmpdir(), `myinstants_${Date.now()}.mp3`);
              fs.writeFileSync(tempSoundPath, buffer);
              
              soundSelect.value = tempSoundPath;
              selectedSoundName.textContent = instant.name;
              selectedSoundName.style.color = "#10b981";
              clearSoundBtn.style.display = 'flex';
            } catch (err) {
              selectedSoundName.textContent = "Erreur !";
              selectedSoundName.style.color = "#ef4444";
            }
          };
          
          buttonsDiv.appendChild(previewBtn);
          buttonsDiv.appendChild(selectBtn);

          div.appendChild(nameSpan);
          div.appendChild(buttonsDiv);
          soundResults.appendChild(div);
        });
      } else {
        soundResults.innerHTML = '<p class="text-muted" style="text-align:center;">Aucun résultat.</p>';
      }
    } catch (err) {
      soundResults.innerHTML = '<p class="text-danger" style="text-align:center;">Erreur réseau.</p>';
    }
    
    soundSearchBtn.disabled = false;
    soundSearchBtn.textContent = "Chercher";
  });
}

if (clearSoundBtn) {
  clearSoundBtn.addEventListener('click', () => {
    soundSelect.value = 'none';
    selectedSoundName.textContent = 'Aucun';
    selectedSoundName.style.color = '#10b981';
    clearSoundBtn.style.display = 'none';
  });
}

function resetAudioState() {
  const soundSelect = document.getElementById('soundSelect');
  const selectedSoundName = document.getElementById('selectedSoundName');
  const clearSoundBtn = document.getElementById('clearSoundBtn');
  if (soundSelect) soundSelect.value = 'none';
  if (selectedSoundName) {
    selectedSoundName.textContent = 'Aucun';
    selectedSoundName.style.color = '#10b981';
  }
  if (clearSoundBtn) clearSoundBtn.style.display = 'none';
}

// --- CANVAS EDITOR LOGIC ---

const sendTtsBtn = document.getElementById('sendTtsBtn');
const ttsInput = document.getElementById('ttsInput');
const ttsStatus = document.getElementById('ttsStatus');

if (sendTtsBtn) {
  sendTtsBtn.addEventListener('click', () => {
    const text = ttsInput.value.trim();
    if (!text) return;
    
    sendTtsBtn.disabled = true;
    sendTtsBtn.textContent = "Envoi... ⏳";
    
    ipcRenderer.send('discord-tts', { text });
  });
}

ipcRenderer.on('tts-status', (event, response) => {
  if (sendTtsBtn) {
    sendTtsBtn.disabled = false;
    sendTtsBtn.textContent = "Envoyer le Message Vocal 🚀";
  }
  
  if (response.success) {
    if (ttsInput) ttsInput.value = '';
    if (ttsStatus) {
      ttsStatus.textContent = "✅ Message vocal envoyé !";
      ttsStatus.style.color = "#10b981";
    }
  } else {
    if (ttsStatus) {
      ttsStatus.textContent = response.error || "Erreur.";
      ttsStatus.style.color = "#ef4444";
    }
  }
  
  if (ttsStatus) {
    setTimeout(() => { ttsStatus.textContent = ""; }, 4000);
  }
});

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
    resetAudioState();
    memeVideo.pause();
  memeVideo.src = "";
  
  if (mediaWrapper) mediaWrapper.style.display = 'none';
  const mediaPlaceholder = document.getElementById('mediaPlaceholder');
  if (mediaPlaceholder) mediaPlaceholder.style.display = 'block';
  const propertiesArea = document.getElementById('propertiesArea');
  if (propertiesArea) propertiesArea.style.display = 'none';
  if (toolbarGroup) toolbarGroup.style.display = 'none';
  if (sendControls) sendControls.style.display = 'none';
  
  showView('editor');
});

// --- MACROS / FAVORITES ---
const favoriteMemeBtn = document.getElementById('favoriteMemeBtn');
const favoritesDir = path.join(os.homedir(), '.memescreen', 'favorites');
if (!fs.existsSync(favoritesDir)) {
  fs.mkdirSync(favoritesDir, { recursive: true });
}

let macros = JSON.parse(localStorage.getItem('memescreen_macros') || '[]');

let editingMacroId = null;

function renderMacros() {
  const favoritesList = document.getElementById('favoritesList');
  if (!favoritesList) return;
  favoritesList.innerHTML = '';
  if (macros.length === 0) {
    favoritesList.innerHTML = '<div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 150px; text-align: center;"><p class="text-muted" style="margin:0; line-height: 1.5;">Aucun favori enregistré.<br>Clique sur "⭐ Ajouter aux favoris" dans l\'éditeur pour commencer.</p></div>';
    return;
  }
  
  macros.forEach(macro => {
    const div = document.createElement('div');
    div.className = 'fav-item';
    div.innerHTML = `
      <h4 style="margin-bottom: 5px; color: var(--primary);">${macro.name}</h4>
      <p style="font-size: 0.8rem; margin-bottom: 10px;">Raccourci: <kbd style="background:#333; padding:2px 5px; border-radius:3px;">${macro.shortcut || 'Aucun'}</kbd></p>
      <div style="display: flex; gap: 10px; margin-top: 10px;">
        <button class="primary-btn btn-small" style="flex:1;" onclick="sendMacroDirectly('${macro.id}')">🚀 Envoyer</button>
        <button class="btn-secondary btn-small" style="padding: 2px 8px;" title="Modifier le nom/raccourci" onclick="openEditMacroModal('${macro.id}')">✏️</button>
        <button class="btn-danger btn-small" style="padding: 2px 8px;" title="Supprimer" onclick="deleteMacro('${macro.id}')">🗑️</button>
      </div>
    `;
    favoritesList.appendChild(div);
  });
}


window.sendMacroDirectly = async (id) => {
  const m = macros.find(m => m.id === id);
  if (!m) return;
  
  const tempSound = m.soundPath;
  
  if (m.mediaType === 'image') {
    const img = new Image();
    img.src = "file://" + m.mediaPath;
    await new Promise(r => { img.onload = r; img.onerror = r; });
    
    const offCanvas = document.createElement('canvas');
    offCanvas.width = img.width || 800;
    offCanvas.height = img.height || 600;
    const oCtx = offCanvas.getContext('2d');
    
    oCtx.drawImage(img, 0, 0, offCanvas.width, offCanvas.height);
    
    m.texts.forEach(t => {
      oCtx.font = `${t.size}px Impact`;
      oCtx.fillStyle = t.color || 'white';
      oCtx.textAlign = 'center';
      oCtx.strokeStyle = 'black';
      oCtx.lineWidth = t.size / 10;
      oCtx.strokeText(t.text, t.x, t.y);
      oCtx.fillText(t.text, t.x, t.y);
    });
    
    offCanvas.toBlob(async (blob) => {
      if (!blob) return;
      const buffer = Buffer.from(await blob.arrayBuffer());
      const tempPath = require('path').join(require('os').tmpdir(), `meme_${Date.now()}.png`);
      require('fs').writeFileSync(tempPath, buffer);
      
      ipcRenderer.send('discord-upload', { 
        filePath: tempPath, 
        fileName: 'meme.png', 
        sound: tempSound 
      });
    }, 'image/png');
  } else if (m.mediaType === 'video') {
    const vid = document.createElement('video');
    vid.src = "file://" + m.mediaPath;
    await new Promise(r => { vid.onloadedmetadata = r; vid.onerror = r; });
    
    ipcRenderer.send('process-video', {
      inputPath: m.mediaPath,
      texts: m.texts,
      width: vid.videoWidth || 1280,
      height: vid.videoHeight || 720,
      sound: tempSound
    });
  }
};

window.deleteMacro = (id) => {
  macros = macros.filter(m => m.id !== id);
  localStorage.setItem('memescreen_macros', JSON.stringify(macros));
  renderMacros();
  ipcRenderer.send('update-macros', macros);
};




window.openEditMacroModal = async (id) => {
  editingMacroId = id;
  const m = macros.find(mac => mac.id === id);
  if (!m) return;
  
  const favNameInput = document.getElementById('favNameInput');
  const favShortcutInput = document.getElementById('favShortcutInput');
  const favModalTitle = document.getElementById('favModalTitle');
  const favEditExtraFields = document.getElementById('favEditExtraFields');
  const favSoundSelect = document.getElementById('favSoundSelect');
  const favSelectedSoundName = document.getElementById('favSelectedSoundName');
  const favClearSoundBtn = document.getElementById('favClearSoundBtn');
  const favTextsContainer = document.getElementById('favTextsContainer');
  const favoriteModal = document.getElementById('favoriteModal');
  const duplicateFavBtn = document.getElementById('duplicateFavBtn');
  
  if (favModalTitle) favModalTitle.textContent = "✏️ Modifier le Favori";
  if (favEditExtraFields) favEditExtraFields.style.display = 'block';
  if (duplicateFavBtn) duplicateFavBtn.style.display = 'block';
  
  favNameInput.value = m.name;
  favShortcutInput.value = m.shortcut || '';
  
  if (m.soundPath && m.soundPath !== 'none') {
    favSoundSelect.value = m.soundPath;
    favSelectedSoundName.textContent = require('path').basename(m.soundPath);
    favSelectedSoundName.style.color = '#10b981';
    if (favClearSoundBtn) favClearSoundBtn.style.display = 'inline-block';
  } else {
    favSoundSelect.value = 'none';
    favSelectedSoundName.textContent = 'Aucun';
    favSelectedSoundName.style.color = '#10b981';
    if (favClearSoundBtn) favClearSoundBtn.style.display = 'none';
  }
  
  favTextsContainer.innerHTML = '';
  if (m.texts && m.texts.length > 0) {
    m.texts.forEach((txt, index) => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = txt.text;
      input.className = 'fav-text-edit-input';
      input.dataset.index = index;
      input.style.width = '100%';
      input.style.padding = '8px';
      input.style.borderRadius = '5px';
      input.style.border = '1px solid #334155';
      input.style.background = '#0f172a';
      input.style.color = 'white';
      
      const label = document.createElement('label');
      label.textContent = `Texte ${index + 1} :`;
      label.style.fontSize = '0.85em';
      label.style.color = '#cbd5e1';
      
      const wrap = document.createElement('div');
      wrap.appendChild(label);
      wrap.appendChild(input);
      favTextsContainer.appendChild(wrap);
    });
  } else {
    favTextsContainer.innerHTML = '<p class="text-muted" style="font-size:0.9em;">Aucun texte associé.</p>';
  }
  
  
    if (favClearSoundBtn) {
      favClearSoundBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        favSoundSelect.value = 'none';
        if (favSelectedSoundName) {
          favSelectedSoundName.textContent = 'Aucun';
          favSelectedSoundName.style.color = '#10b981';
        }
        favClearSoundBtn.style.display = 'none';
      };
    }
    
    const favSoundSearchBtn = document.getElementById('favSoundSearchBtn');
    const favSoundSearchInput = document.getElementById('favSoundSearchInput');
    const favSoundResults = document.getElementById('favSoundResults');
    
    if (favSoundSearchBtn) {
      favSoundSearchBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const q = favSoundSearchInput ? favSoundSearchInput.value.trim() : '';
        if (!q) return;
        if (favSoundResults) {
          favSoundResults.innerHTML = '<p class="text-muted" style="text-align:center;">Recherche...</p>';
          favSoundResults.style.display = 'block';
        }
        
        try {
          const response = await fetch(`https://www.myinstants.com/api/v1/instants/?name=${encodeURIComponent(q)}`);
          const data = await response.json();
          if (favSoundResults) favSoundResults.innerHTML = '';
          
          if (data.results && data.results.length > 0) {
            data.results.forEach(instant => {
              const div = document.createElement('div');
              div.style.display = 'flex';
              div.style.justifyContent = 'space-between';
              div.style.alignItems = 'center';
              div.style.padding = '5px';
              div.style.borderBottom = '1px solid #334155';
              
              const name = document.createElement('span');
              name.textContent = instant.name;
              name.style.fontSize = '0.9em';
              name.style.flex = '1';
              
              const btn = document.createElement('button');
              btn.textContent = 'Choisir';
              btn.className = 'btn-small primary-btn';
              btn.style.padding = '2px 8px';
              
              btn.onclick = async (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                if (favSelectedSoundName) {
                  favSelectedSoundName.textContent = "Téléchargement...";
                  favSelectedSoundName.style.color = "#fbbf24";
                }
                if (favSoundResults) favSoundResults.style.display = 'none';
                try {
                  const soundRes = await fetch(instant.sound);
                  const buffer = await soundRes.arrayBuffer();
                  const tempPath = require('path').join(require('os').tmpdir(), `fav_sound_${Date.now()}.mp3`);
                  require('fs').writeFileSync(tempPath, Buffer.from(buffer));
                  if (favSoundSelect) favSoundSelect.value = tempPath;
                  if (favSelectedSoundName) {
                    favSelectedSoundName.textContent = instant.name;
                    favSelectedSoundName.style.color = "#10b981";
                  }
                  if (favClearSoundBtn) favClearSoundBtn.style.display = 'inline-block';
                } catch (err) {
                  if (favSelectedSoundName) {
                    favSelectedSoundName.textContent = "Erreur !";
                    favSelectedSoundName.style.color = "#ef4444";
                  }
                }
              };
              
              div.appendChild(name);
              div.appendChild(btn);
              if (favSoundResults) favSoundResults.appendChild(div);
            });
          } else {
            if (favSoundResults) favSoundResults.innerHTML = '<p class="text-muted" style="text-align:center;">Aucun résultat</p>';
          }
        } catch (err) {
          if (favSoundResults) favSoundResults.innerHTML = '<p style="color:#ef4444;text-align:center;">Erreur réseau</p>';
        }
      };
    }

    favoriteModal.style.display = 'flex';
};


const favoriteModal = document.getElementById('favoriteModal');
const favNameInput = document.getElementById('favNameInput');
const favShortcutInput = document.getElementById('favShortcutInput');
const cancelFavBtn = document.getElementById('cancelFavBtn');
const saveFavBtn = document.getElementById('saveFavBtn');

if (favoriteMemeBtn) {
  favoriteMemeBtn.addEventListener('click', () => {
    if (!currentMediaPath) return;
    editingMacroId = null;
    const favModalTitle = document.getElementById('favModalTitle');
    const favEditExtraFields = document.getElementById('favEditExtraFields');
    const duplicateFavBtn = document.getElementById('duplicateFavBtn');
    if (favModalTitle) favModalTitle.textContent = "⭐ Ajouter aux Favoris";
    if (favEditExtraFields) favEditExtraFields.style.display = 'none';
    if (duplicateFavBtn) duplicateFavBtn.style.display = 'none';
    
    favNameInput.value = '';
    favShortcutInput.value = '';
    favoriteModal.style.display = 'flex';
  });
}

if (cancelFavBtn) {
  cancelFavBtn.addEventListener('click', () => {
    favoriteModal.style.display = 'none';
  });
}

if (saveFavBtn) {
  
  const duplicateFavBtn = document.getElementById('duplicateFavBtn');
  if (duplicateFavBtn) {
    duplicateFavBtn.addEventListener('click', () => {
      const name = favNameInput.value.trim();
      if (!name) return;
      const shortcut = favShortcutInput.value.trim();
      
      favoriteModal.style.display = 'none';
      
      if (editingMacroId) {
        const original = macros.find(m => m.id === editingMacroId);
        if (original) {
          const finalName = (name === original.name) ? name + " (Copie)" : name;
          
          const favSoundSelect = document.getElementById('favSoundSelect');
          let soundPath = favSoundSelect ? favSoundSelect.value : 'none';
          if (soundPath !== 'none') {
            if (require('path').isAbsolute(soundPath) || soundPath.includes('tmp')) {
              const ext = require('path').extname(soundPath);
              const newSoundPath = require('path').join(favoritesDir, `sound_${Date.now()}${ext}`);
              try {
                require('fs').copyFileSync(soundPath, newSoundPath);
                soundPath = newSoundPath;
              } catch(e) { console.error("Erreur copie son", e); }
            } else {
              // It's already in favoritesDir, but we are duplicating, so let's copy it again to avoid linking issues
              const ext = require('path').extname(soundPath);
              const newSoundPath = require('path').join(favoritesDir, `sound_${Date.now()}${ext}`);
              try {
                require('fs').copyFileSync(soundPath, newSoundPath);
                soundPath = newSoundPath;
              } catch(e) { console.error("Erreur copie son original", e); }
            }
          }
          
          let newTexts = JSON.parse(JSON.stringify(original.texts || []));
          const textInputs = document.querySelectorAll('.fav-text-edit-input');
          textInputs.forEach(input => {
             const idx = parseInt(input.dataset.index, 10);
             if (newTexts[idx]) {
               newTexts[idx].text = input.value;
             }
          });
          
          let newMediaPath = original.mediaPath;
          if (original.mediaPath) {
             const ext = require('path').extname(original.mediaPath);
             newMediaPath = require('path').join(favoritesDir, `media_${Date.now()}${ext}`);
             try {
               require('fs').copyFileSync(original.mediaPath, newMediaPath);
             } catch(e) { console.error("Erreur copie media", e); }
          }
          
          const newMacro = {
            id: Date.now().toString(),
            name: finalName,
            shortcut: shortcut || null,
            mediaType: original.mediaType,
            mediaPath: newMediaPath,
            texts: newTexts,
            soundPath: soundPath
          };
          
          macros.push(newMacro);
          localStorage.setItem('memescreen_macros', JSON.stringify(macros));
          renderMacros();
          const { ipcRenderer } = require('electron');
          ipcRenderer.send('update-macros', macros);
        }
        editingMacroId = null;
      }
    });
  }

  saveFavBtn.addEventListener('click', () => {
    const name = favNameInput.value.trim();
    if (!name) return;
    const shortcut = favShortcutInput.value.trim();
    
    favoriteModal.style.display = 'none';
        if (editingMacroId) {
        const m = macros.find(m => m.id === editingMacroId);
        if (m) {
          m.name = name;
          m.shortcut = shortcut || null;
          
          const favSoundSelect = document.getElementById('favSoundSelect');
          let soundPath = favSoundSelect ? favSoundSelect.value : 'none';
          if (soundPath !== 'none' && soundPath !== m.soundPath) {
            const ext = path.extname(soundPath);
            const newSoundPath = path.join(favoritesDir, `sound_${Date.now()}${ext}`);
            try {
              fs.copyFileSync(soundPath, newSoundPath);
              soundPath = newSoundPath;
            } catch(e) { console.error("Erreur copie son favori", e); }
          }
          m.soundPath = soundPath;
          
          const textInputs = document.querySelectorAll('.fav-text-edit-input');
          textInputs.forEach(input => {
             const idx = parseInt(input.dataset.index, 10);
             if (m.texts && m.texts[idx]) {
               m.texts[idx].text = input.value;
             }
          });
          
          localStorage.setItem('memescreen_macros', JSON.stringify(macros));
          renderMacros();
          ipcRenderer.send('update-macros', macros);
        }
        editingMacroId = null;
        return;
      }
    
    let mediaPath = currentMediaPath;
    if (mediaPath) {
      const ext = path.extname(mediaPath);
      const newPath = path.join(favoritesDir, `media_${Date.now()}${ext}`);
      try {
        fs.copyFileSync(mediaPath, newPath);
        mediaPath = newPath;
      } catch(e) { console.error("Erreur copie media favori", e); }
    }
    
    let soundPath = soundSelect ? soundSelect.value : 'none';
    if (soundPath && soundPath !== 'none' && path.isAbsolute(soundPath)) {
      const ext = path.extname(soundPath);
      const newSoundPath = path.join(favoritesDir, `sound_${Date.now()}${ext}`);
      try {
        fs.copyFileSync(soundPath, newSoundPath);
        soundPath = newSoundPath;
      } catch(e) { console.error("Erreur copie son favori", e); }
    }

    const macro = {
      id: Date.now().toString(),
      name,
      shortcut: shortcut || null,
      mediaType: currentMediaType,
      mediaPath: mediaPath,
      texts: JSON.parse(JSON.stringify(memeTexts)),
      soundPath: soundPath
    };
    
    macros.push(macro);
    localStorage.setItem('memescreen_macros', JSON.stringify(macros));
    renderMacros();
    ipcRenderer.send('update-macros', macros);
  });
}

ipcRenderer.on('trigger-macro-shortcut', (event, id) => {
    sendMacroDirectly(id);
  });

// Initialize macros
renderMacros();
ipcRenderer.send('update-macros', macros);

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
        
        ipcRenderer.send('discord-upload', { 
          filePath: tempPath, 
          fileName: 'meme.png', 
          sound: soundSelect ? soundSelect.value : 'none' 
        });
      }, 'image/png');
    }, 100);
  } else if (currentMediaType === 'video') {
    ipcRenderer.send('process-video', {
      inputPath: currentMediaPath,
      texts: memeTexts,
      width: memeCanvas.width,
      height: memeCanvas.height,
      sound: soundSelect ? soundSelect.value : 'none'
    });
  }
});

ipcRenderer.on('upload-status', (event, response) => {
  sendMemeBtn.disabled = false;
  sendMemeBtn.textContent = "Envoyer 🚀";
  inputs.mediaInput.value = '';
  memeVideo.pause();
  memeVideo.src = "";
  
  if (mediaWrapper) mediaWrapper.style.display = 'none';
  const mediaPlaceholder = document.getElementById('mediaPlaceholder');
  if (mediaPlaceholder) mediaPlaceholder.style.display = 'block';
  const propertiesArea = document.getElementById('propertiesArea');
  if (propertiesArea) propertiesArea.style.display = 'none';
  if (toolbarGroup) toolbarGroup.style.display = 'none';
  if (sendControls) sendControls.style.display = 'none';
  
  showView('editor');
  
  if (response.success) {
    texts.uploadStatus.textContent = "✅ Média envoyé avec succès !";
    texts.uploadStatus.style.color = "#10b981";
  } else {
    texts.uploadStatus.textContent = response.error || "Erreur lors de l'upload.";
    texts.uploadStatus.style.color = "#ef4444";
  }
  
  setTimeout(() => { texts.uploadStatus.textContent = ""; }, 4000);
});

// --- TROLL SYSTEM LOGIC ---
const launchTrollBtn = document.getElementById('launchTrollBtn');
const trollTargetInput = document.getElementById('trollTargetInput');
const trollLaunchStatus = document.getElementById('trollLaunchStatus');

const trollVoteOverlay = document.getElementById('trollVoteOverlay');
const trollVoteTarget = document.getElementById('trollVoteTarget');
const trollTimerBar = document.getElementById('trollTimerBar');
const trollTimeLeft = document.getElementById('trollTimeLeft');
const trollVoteBtns = document.querySelectorAll('.troll-vote-btn');

let trollVoteInterval = null;

if (launchTrollBtn) {
  launchTrollBtn.addEventListener('click', () => {
    const target = trollTargetInput.value.trim();
    if (!target) {
      trollLaunchStatus.textContent = '❌ Tape un pseudo !';
      trollLaunchStatus.style.color = '#ef4444';
      return;
    }
    
    trollLaunchStatus.textContent = 'Lancement en cours...';
    trollLaunchStatus.style.color = '#eab308';
    
    ipcRenderer.send('launch-troll-vote', { target });
    setTimeout(() => { trollLaunchStatus.textContent = ''; }, 3000);
  });
}

ipcRenderer.on('troll-vote-started', (event, { target, duration, options }) => {
  trollVoteTarget.textContent = target;
  trollVoteOverlay.style.display = 'flex';
  
  trollVoteBtns.forEach(btn => {
    btn.style.borderColor = '#334155';
    btn.style.boxShadow = 'none';
    btn.querySelector('.vote-count').textContent = '0';
    
    // Update button text with random troll option if provided
    if (options) {
      const voteIndex = parseInt(btn.getAttribute('data-vote')) - 1;
      if (options[voteIndex]) {
        btn.querySelector('strong').textContent = options[voteIndex].name;
      }
    }
  });
  
  trollTimerBar.style.width = '100%';
  trollTimerBar.style.transition = 'none';
  setTimeout(() => {
    trollTimerBar.style.transition = `width ${duration}s linear`;
    trollTimerBar.style.width = '0%';
  }, 100);
  
  let timeLeft = duration;
  trollTimeLeft.textContent = timeLeft;
  
  if (trollVoteInterval) clearInterval(trollVoteInterval);
  trollVoteInterval = setInterval(() => {
    timeLeft--;
    trollTimeLeft.textContent = timeLeft;
    if (timeLeft <= 0) clearInterval(trollVoteInterval);
  }, 1000);
});

trollVoteBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const vote = btn.getAttribute('data-vote');
    ipcRenderer.send('send-troll-vote', { vote, myPseudo });
    
    trollVoteBtns.forEach(b => {
      b.style.borderColor = '#334155';
      b.style.boxShadow = 'none';
    });
    btn.style.borderColor = '#eab308';
    btn.style.boxShadow = '0 0 15px rgba(234, 179, 8, 0.5)';
  });
});

ipcRenderer.on('troll-vote-update', (event, { votes }) => {
  trollVoteBtns.forEach(btn => {
    const voteKey = btn.getAttribute('data-vote');
    btn.querySelector('.vote-count').textContent = votes[voteKey] || '0';
  });
});

ipcRenderer.on('troll-vote-ended', (event, { winner, target }) => {
  if (trollVoteInterval) clearInterval(trollVoteInterval);
  trollTimeLeft.textContent = '0';
  
  trollVoteBtns.forEach(btn => {
    if (btn.getAttribute('data-vote') === winner) {
      btn.style.borderColor = '#10b981';
      btn.style.boxShadow = '0 0 30px rgba(16, 185, 129, 0.8)';
    } else {
      btn.style.opacity = '0.5';
    }
  });
  
  setTimeout(() => {
    trollVoteOverlay.style.display = 'none';
    trollVoteBtns.forEach(btn => btn.style.opacity = '1');
  }, 4000);
});


const { ipcRenderer } = require('electron');
const path = require('path');

// Elements
const closeBtn = document.getElementById('closeBtn');
const backBtns = document.querySelectorAll('.back-btn');
const panels = document.querySelectorAll('.panel');
const dropZone = document.getElementById('dropZone');

const gifSearchInput = document.getElementById('gifSearchInput');
const gifResults = document.getElementById('gifResults');

const ttsInput = document.getElementById('ttsInput');
const sendTtsBtn = document.getElementById('sendTtsBtn');

const trollTargetInput = document.getElementById('trollTargetInput');
const sendTrollBtn = document.getElementById('sendTrollBtn');

// Navigation
const menuTitle = document.getElementById('menuTitle');
function showPanel(id) {
  panels.forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  
  if (menuTitle) {
    switch(id) {
      case 'hubPanel': menuTitle.textContent = '⚡ ACTIONS RAPIDES ⚡'; break;
      case 'mainPanel': menuTitle.textContent = '⚡ DRAG & DROP ⚡'; break;
      case 'gifPanel': menuTitle.textContent = '⚡ ENVOYER UN GIF ⚡'; break;
      case 'ttsPanel': menuTitle.textContent = '⚡ MESSAGE VOCAL ⚡'; break;
      case 'trollPanel': menuTitle.textContent = '⚡ LANCER TROLL ⚡'; break;
    }
  }
}

backBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    showPanel('hubPanel');
  });
});

// Close
if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    ipcRenderer.send('close-quick-menu');
  });
}


// Hub Logic
const btnMediaHub = document.getElementById('btnMediaHub');
const btnGifHub = document.getElementById('btnGifHub');
const btnTtsHub = document.getElementById('btnTtsHub');
const btnTrollHub = document.getElementById('btnTrollHub');

if (btnMediaHub) btnMediaHub.addEventListener('click', () => showPanel('mainPanel'));
if (btnGifHub) btnGifHub.addEventListener('click', () => { showPanel('gifPanel'); if(gifSearchInput) gifSearchInput.focus(); });
if (btnTtsHub) btnTtsHub.addEventListener('click', () => { showPanel('ttsPanel'); if(ttsInput) ttsInput.focus(); });
if (btnTrollHub) btnTrollHub.addEventListener('click', () => { showPanel('trollPanel'); if(trollTargetInput) trollTargetInput.focus(); });

// Drag & Drop
if (dropZone) {
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      openMedia(file.path);
    }
  });
  dropZone.addEventListener('click', () => {
    ipcRenderer.send('trigger-media-dialog');
  });
}

function openMedia(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = ['.mp4', '.webm', '.mov'].includes(ext) ? 'video' : 'image';
  ipcRenderer.send('open-quick-edit', { filePath, type });
}

// GIF Logic
let gifTimeout = null;
if (gifSearchInput) {
  gifSearchInput.addEventListener('input', (e) => {
    clearTimeout(gifTimeout);
    gifTimeout = setTimeout(() => searchGifs(e.target.value), 500);
  });
}

async function searchGifs(query) {
  if (!query) {
    gifResults.innerHTML = '';
    return;
  }
  gifResults.innerHTML = '<p style="color: var(--primary);">Recherche...</p>';
  try {
    const res = await fetch(`https://g.tenor.com/v1/search?q=${encodeURIComponent(query)}&key=LIVDSRZULELA&limit=10`);
    const data = await res.json();
    
    gifResults.innerHTML = '';
    if (data.results) {
      data.results.forEach(gif => {
        const img = document.createElement('img');
        img.src = gif.media[0].tinygif.url;
        img.className = 'gif-item';
        img.onclick = () => {
          ipcRenderer.send('open-quick-edit', { filePath: gif.media[0].gif.url, type: 'image' });
          ipcRenderer.send('close-quick-menu');
        };
        gifResults.appendChild(img);
      });
    }
  } catch (e) {
    gifResults.innerHTML = '<p style="color: var(--danger);">Erreur réseau</p>';
  }
}

// TTS Logic
if (sendTtsBtn) {
  sendTtsBtn.addEventListener('click', () => {
    const text = ttsInput.value.trim();
    if (!text) return;
    ipcRenderer.send('discord-tts', { text });
    ipcRenderer.send('close-quick-menu');
  });
}

// Troll Logic
if (sendTrollBtn) {
  sendTrollBtn.addEventListener('click', () => {
    const target = trollTargetInput.value.trim();
    if (!target) return;
    ipcRenderer.send('launch-troll-vote', { target });
    ipcRenderer.send('close-quick-menu');
  });
}

ipcRenderer.on('open-panel', (event, panel) => {
  if (panel === 'media') {
    ipcRenderer.send('trigger-media-dialog');
    showPanel('hubPanel');
  } else if (panel === 'gif') {
    showPanel('gifPanel');
    if (gifSearchInput) gifSearchInput.focus();
  } else if (panel === 'tts') {
    showPanel('ttsPanel');
    if (ttsInput) ttsInput.focus();
  } else if (panel === 'hub') {
    showPanel('hubPanel');
  } else if (panel === 'troll') {
    showPanel('trollPanel');
    if (trollTargetInput) trollTargetInput.focus();
  } else {
    showPanel('mainPanel');
  }
});

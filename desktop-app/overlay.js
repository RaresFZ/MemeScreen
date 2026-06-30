const { ipcRenderer } = require('electron');

let currentMedia = null;
let mediaQueue = [];
let progressInterval = null;

const widgetContainer = document.getElementById('widgetContainer');
const mediaContainer = document.getElementById('mediaContainer');
const progressBar = document.getElementById('progressBar');

let settings = { duration: 7, scale: 100, volume: 50, position: 'bottom-right' };

ipcRenderer.on('apply-settings', (event, newSettings) => {
  settings = newSettings;
  document.documentElement.style.setProperty('--overlay-scale', settings.scale / 100);
  
  // Apply position class
  widgetContainer.className = 'widget-container pos-' + settings.position;
});

// --- QUEUE LOGIC ---
ipcRenderer.on('new-media', (event, data) => {
  mediaQueue.push(data);
  processQueue();
});

function processQueue() {
  if (currentMedia !== null || mediaQueue.length === 0) return;
  
  const nextMedia = mediaQueue.shift();
  currentMedia = nextMedia;
  displayMedia(currentMedia);
}

let currentAudio = null;

function displayMedia(media) {
  mediaContainer.innerHTML = '';
  progressBar.style.transform = 'scaleX(1)'; // reset bar
  
  if (media.soundUrl) {
    currentAudio = new Audio(media.soundUrl);
    currentAudio.volume = settings.volume / 100;
    currentAudio.play().catch(e => console.error("Audio play failed:", e));
  }
  
  if (media.type === 'image') {
    const durationMs = settings.duration * 1000;
    const img = document.createElement('img');
    img.src = media.url;
    mediaContainer.appendChild(img);
    widgetContainer.classList.add('active');
    
    startProgressBar(durationMs);
    
    setTimeout(() => {
      endTakeover();
    }, durationMs);
  } 
  else if (media.type === 'video') {
    const video = document.createElement('video');
    video.src = media.url;
    video.autoplay = true;
    video.controls = false;
    // apply user volume
    video.volume = settings.volume / 100;
    
    // Une fois que les métadonnées de la vidéo sont chargées, on a la durée
    video.onloadedmetadata = () => {
      const durationMs = video.duration * 1000;
      startProgressBar(durationMs);
    };
    
    video.onended = () => {
      endTakeover();
    };
    
    mediaContainer.appendChild(video);
    widgetContainer.classList.add('active');
  } 
  else if (media.type === 'text') {
    const durationMs = settings.duration * 1000;
    
    const textContainer = document.createElement('div');
    textContainer.style.background = 'rgba(15, 23, 42, 0.9)';
    textContainer.style.color = '#fff';
    textContainer.style.padding = '30px';
    textContainer.style.borderRadius = '15px';
    textContainer.style.fontSize = '40px';
    textContainer.style.fontWeight = '900';
    textContainer.style.textAlign = 'center';
    textContainer.style.maxWidth = '80vw';
    textContainer.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
    textContainer.style.border = '4px solid #6366f1';
    textContainer.textContent = media.text;
    
    mediaContainer.appendChild(textContainer);
    widgetContainer.classList.add('active');
    
    if ('speechSynthesis' in window) {
      // Stop any ongoing speech
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(media.text);
      utterance.volume = settings.volume / 100;
      utterance.lang = 'fr-FR';
      window.speechSynthesis.speak(utterance);
    }
    
    startProgressBar(durationMs);
    
    setTimeout(() => {
      endTakeover();
    }, durationMs);
  }
}

function startProgressBar(durationMs) {
  if (progressInterval) clearInterval(progressInterval);
  
  const startTime = Date.now();
  
  progressInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const remainingPercentage = Math.max(0, 1 - (elapsed / durationMs));
    
    progressBar.style.transform = `scaleX(${remainingPercentage})`;
    
    if (remainingPercentage <= 0) {
      clearInterval(progressInterval);
    }
  }, 16); // ~60fps smooth animation
}

let isClosing = false;

function endTakeover() {
  if (isClosing) return;
  isClosing = true;
  
  widgetContainer.classList.remove('active');
  
  if (progressInterval) clearInterval(progressInterval);
  
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  
  // Pause le temps que l'animation de sortie se fasse
  setTimeout(() => {
    mediaContainer.innerHTML = '';
    currentMedia = null;
    isClosing = false;
    processQueue();
  }, 500); 
}

ipcRenderer.on('force-close-media', () => {
  if (currentMedia !== null) {
    endTakeover();
  }
});

ipcRenderer.on('new-text', (event, data) => {
  mediaQueue.push({ type: 'text', text: data.text });
  processQueue();
});

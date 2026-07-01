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
      textContainer.style.color = '#ffff00';
      textContainer.style.fontSize = '32px';
      textContainer.style.fontWeight = 'bold';
      textContainer.style.textAlign = 'center';
      textContainer.style.width = '100%';
      textContainer.style.wordWrap = 'break-word';
      textContainer.style.textShadow = '2px 2px 0px #000000';
      textContainer.style.fontFamily = "'Courier New', Courier, monospace";
      textContainer.style.textTransform = 'uppercase';
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

// --- TROLL EXECUTION LOGIC ---
function playTinnitus() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(8000, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 5);
    osc.stop(ctx.currentTime + 5);
  } catch(e){}
}

// (Screamer was removed)

ipcRenderer.on('execute-troll', (event, { type, target }) => {
  const myPseudo = localStorage.getItem('memescreen_pseudo');
  if (myPseudo !== target) return; 
  
  const container = document.getElementById('trollContainer');
  container.style.display = 'block';
  
  const resetAll = () => {
    container.style.display = 'none';
    ['troll-flashbang', 'troll-bsod', 'troll-dvd', 'troll-update', 'troll-crack', 'troll-discord-call', 'troll-fly', 'troll-matrix', 'troll-hacker', 'troll-notif-container'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  };

  resetAll();
  container.style.display = 'block';

  if (type === 'flashbang' || type === '1') { 
    const el = document.getElementById('troll-flashbang');
    el.style.display = 'block';
    el.style.opacity = '1';
    el.style.transition = 'none';
    playTinnitus();
    
    setTimeout(() => {
      el.style.transition = 'opacity 5s ease-out';
      el.style.opacity = '0';
      setTimeout(resetAll, 5000);
    }, 100);
  } 
  else if (type === 'bsod' || type === '2') { 
    const el = document.getElementById('troll-bsod');
    el.style.display = 'block';
    setTimeout(resetAll, 8000);
  }
  else if (type === 'dvd' || type === '3') { 
    const el = document.getElementById('troll-dvd');
    el.style.display = 'block';
    let x = Math.random() * (window.innerWidth - 300);
    let y = Math.random() * (window.innerHeight - 150);
    let vx = 6, vy = 6;
    
    const interval = setInterval(() => {
      x += vx; y += vy;
      if (x <= 0 || x + 300 >= window.innerWidth) { vx = -vx; el.style.fill = '#' + Math.floor(Math.random()*16777215).toString(16); }
      if (y <= 0 || y + 150 >= window.innerHeight) { vy = -vy; el.style.fill = '#' + Math.floor(Math.random()*16777215).toString(16); }
      el.style.transform = `translate(${x}px, ${y}px)`;
    }, 16);
    
    setTimeout(() => {
      clearInterval(interval);
      resetAll();
    }, 15000);
  }
  else if (type === 'update' || type === '4') { 
    const el = document.getElementById('troll-update');
    const percentEl = document.getElementById('winup-percent');
    container.style.display = 'flex';
    el.style.display = 'flex';
    
    let percent = 0;
    percentEl.innerText = percent;
    
    const interval = setInterval(() => {
      percent += Math.floor(Math.random() * 5);
      if (percent > 99) percent = 99;
      percentEl.innerText = percent;
    }, 800);
    
    setTimeout(() => {
      clearInterval(interval);
      resetAll();
    }, 15000);
  }
  else if (type === 'crack') {
    const el = document.getElementById('troll-crack');
    el.style.display = 'block';
    // Glass shatter sound
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1000, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch(e){}
    setTimeout(resetAll, 10000);
  }
  else if (type === 'discord-call') {
    const el = document.getElementById('troll-discord-call');
    container.style.display = 'flex';
    el.style.display = 'flex';
    // Fake ringtone
    let ringInterval;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const playRing = () => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(554, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      };
      ringInterval = setInterval(playRing, 1000);
    } catch(e){}
    
    setTimeout(() => {
      if (ringInterval) clearInterval(ringInterval);
      resetAll();
    }, 15000);
  }
  else if (type === 'fly') {
    const el = document.getElementById('troll-fly');
    el.style.display = 'block';
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let targetX = x;
    let targetY = y;
    
    const interval = setInterval(() => {
      if (Math.random() < 0.1) {
        targetX = Math.random() * window.innerWidth;
        targetY = Math.random() * window.innerHeight;
      }
      x += (targetX - x) * 0.1;
      y += (targetY - y) * 0.1;
      el.style.transform = `translate(${x}px, ${y}px) rotate(${Math.atan2(targetY - y, targetX - x)}rad)`;
    }, 30);
    setTimeout(() => {
      clearInterval(interval);
      resetAll();
    }, 20000);
  }
  else if (type === 'matrix') {
    const el = document.getElementById('troll-matrix');
    el.style.display = 'block';
    el.width = window.innerWidth;
    el.height = window.innerHeight;
    const ctx = el.getContext('2d');
    const chars = '0123456789ABCDEF!@#$%^&*()_+-=~[]{}|;:,.<>?';
    const columns = Math.floor(window.innerWidth / 20);
    const drops = [];
    for (let i = 0; i < columns; i++) drops[i] = 1;
    
    const interval = setInterval(() => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, el.width, el.height);
      ctx.fillStyle = '#0f0';
      ctx.font = '20px monospace';
      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * 20, drops[i] * 20);
        if (drops[i] * 20 > el.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    }, 33);
    setTimeout(() => {
      clearInterval(interval);
      resetAll();
    }, 15000);
  }
  else if (type === 'hacker') {
    const el = document.getElementById('troll-hacker');
    const textEl = document.getElementById('hacker-text');
    el.style.display = 'block';
    const lines = [
      'Initializing remote connection...',
      'Bypassing firewall...',
      'Accessing C:\\Windows\\System32...',
      'Downloading user passwords...',
      'Decrypting Chrome cookies...',
      'Uploading to remote server [192.168.1.x]...',
      'Access granted to webcam.',
      'Sending payload to all Discord contacts...',
      'Encryption of Drive C: started...',
      '0%...', '15%...', '42%...', '89%...', '100% DONE.'
    ];
    let i = 0;
    textEl.innerHTML = '';
    const interval = setInterval(() => {
      if (i < lines.length) {
        textEl.innerHTML += lines[i] + '<br>';
        el.scrollTop = el.scrollHeight;
        i++;
      }
    }, 800);
    setTimeout(() => {
      clearInterval(interval);
      resetAll();
    }, 12000);
  }
  else if (type === 'notif') {
    const el = document.getElementById('troll-notif-container');
    container.style.display = 'flex';
    el.style.display = 'flex';
    let count = 0;
    const interval = setInterval(() => {
      if (count >= 10) { clearInterval(interval); return; }
      const notif = document.createElement('div');
      notif.style.width = '300px';
      notif.style.background = '#2f3136';
      notif.style.color = 'white';
      notif.style.padding = '15px';
      notif.style.borderRadius = '5px';
      notif.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)';
      notif.style.display = 'flex';
      notif.style.gap = '10px';
      notif.style.fontFamily = 'sans-serif';
      notif.style.fontSize = '14px';
      
      notif.innerHTML = `
        <img src="https://cdn.discordapp.com/embed/avatars/0.png" width="40" height="40" style="border-radius:50%;">
        <div>
          <b style="color:#b9bbbe;">The Trollmaster</b>
          <div style="margin-top:2px;">Regarde derrière toi.</div>
        </div>
      `;
      el.appendChild(notif);
      count++;
      
      // Ping sound
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } catch(e){}
    }, 500);
    setTimeout(() => {
      el.innerHTML = '';
      resetAll();
    }, 10000);
  }
});
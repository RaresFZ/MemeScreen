const { app, BrowserWindow, ipcMain, screen, dialog, globalShortcut, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { autoUpdater } = require('electron-updater');
const { Client, GatewayIntentBits, AttachmentBuilder, Events } = require('discord.js');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');

let ffmpegPath = ffmpegStatic;
if (ffmpegPath.includes('app.asar')) {
  ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
}
ffmpeg.setFfmpegPath(ffmpegPath);

let mainWindow;
let overlayWindow;
let splashWindow;
let discordClient;
let tray = null;
let isQuitting = false;
let quickEditWindow = null;

function createWindow() {
  splashWindow = new BrowserWindow({
    width: 450,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    backgroundColor: '#000000'
  });
  splashWindow.loadFile('splash.html');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 400,
    minHeight: 500,
    backgroundColor: '#000000',
    show: false,
    frame: false,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile('index.html');
  
  mainWindow.once('ready-to-show', () => {
    if (process.argv.includes('--hidden')) {
      if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
      mainWindow.webContents.executeJavaScript('document.body.classList.add("app-ready")');
      return; // Démarrage invisible
    }
    
    // La main window est prête, on l'affiche et on cache le splash
    mainWindow.show();
    
    // Petite pause pour laisser le temps à l'OS d'afficher la fenêtre principale
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
      }
      // On déclenche l'animation d'entrée de l'interface
      mainWindow.webContents.executeJavaScript('document.body.classList.add("app-ready")');
    }, 100);
  });

  // Si on fait un Ctrl+R (reload), le splash est déjà fermé
  mainWindow.webContents.on('did-finish-load', () => {
    if (!splashWindow || splashWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript('document.body.classList.add("app-ready")');
    }
  });
  
  // Intercepter la fermeture de la fenêtre pour la mettre en arrière-plan
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createQuickEditWindow(filePath, type) {
  if (quickEditWindow && !quickEditWindow.isDestroyed()) {
    quickEditWindow.focus();
    return;
  }

  quickEditWindow = new BrowserWindow({
    width: 600,
    height: 700,
    backgroundColor: '#0f172a',
    title: 'Envoi Rapide',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  quickEditWindow.loadFile('quick-edit.html');

  quickEditWindow.webContents.once('did-finish-load', () => {
    quickEditWindow.webContents.send('load-media', { filePath, type });
  });

  quickEditWindow.on('closed', () => {
    quickEditWindow = null;
  });
}

function createOverlayWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  overlayWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  // On permet aux clics de passer au travers de cette fenêtre
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  
  // Priorité maximale pour passer au-dessus des jeux
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  
  overlayWindow.loadFile('overlay.html');
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Si l'utilisateur essaie d'ouvrir une deuxième instance, on focus la première
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Démarrage automatique avec Windows en arrière-plan
    app.setLoginItemSettings({
      openAtLogin: true,
      args: ['--hidden']
    });

    // Création de l'icône dans la barre des tâches (Tray)
    const iconPath = path.join(__dirname, 'icon.png');
    let trayIcon = nativeImage.createEmpty();
    if (fs.existsSync(iconPath)) {
      trayIcon = nativeImage.createFromPath(iconPath);
      // Ensure the icon is resized correctly for the tray on Windows
      trayIcon = trayIcon.resize({ width: 16, height: 16 });
    }
    
    tray = new Tray(trayIcon);
    tray.setToolTip('MemeScreen');
    
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Ouvrir MemeScreen', click: () => { if (mainWindow) mainWindow.show(); } },
      { label: 'Envoyer un Média (Rapide)', click: () => {
          dialog.showOpenDialog({
            title: 'Sélectionner une image ou vidéo',
            properties: ['openFile'],
            filters: [
              { name: 'Médias', extensions: ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'webm', 'mov'] }
            ]
          }).then(result => {
            if (!result.canceled && result.filePaths.length > 0) {
              const filePath = result.filePaths[0];
              const ext = path.extname(filePath).toLowerCase();
              const type = ['.mp4', '.webm', '.mov'].includes(ext) ? 'video' : 'image';
              createQuickEditWindow(filePath, type);
            }
          });
        }
      },
      { type: 'separator' },
      { label: 'Quitter', click: () => {
          isQuitting = true;
          app.quit();
        } 
      }
    ]);
    
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => { if (mainWindow) mainWindow.show(); });

    createWindow();
    createOverlayWindow();
    
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
        createOverlayWindow();
      }
    });

    // Check for updates automatically in the background
    autoUpdater.checkForUpdatesAndNotify();
    
    // Enregistrement du raccourci global pour couper l'overlay
    globalShortcut.register('CommandOrControl+Shift+X', () => {
      if (overlayWindow) {
        overlayWindow.webContents.send('force-close-media');
      }
    });
  });
}

// Auto Updater events
let updateWindow = null;

autoUpdater.on('update-downloaded', (info) => {
  if (updateWindow) return;
  updateWindow = new BrowserWindow({
    width: 450,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  updateWindow.loadFile('update.html');
  updateWindow.on('closed', () => {
    updateWindow = null;
  });
});

ipcMain.on('update-restart', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.on('update-later', () => {
  if (updateWindow) {
    updateWindow.close();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// --- DISCORD LOGIC ---
ipcMain.on('discord-login', async (event, { token, channelId }) => {
  if (discordClient) {
    discordClient.destroy();
  }

  discordClient = new Client({
    intents: [
      GatewayIntentBits.Guilds, 
      GatewayIntentBits.GuildMessages, 
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions
    ]
  });

  discordClient.once(Events.ClientReady, c => {
    event.reply('discord-status', { success: true, user: c.user.tag });
  });

  discordClient.on(Events.MessageCreate, message => {
    if (message.channelId === channelId) {
      if (message.attachments.size > 0) {
        const attachments = Array.from(message.attachments.values());
        
        let mediaAttach = attachments.find(a => a.contentType?.startsWith('image/') || a.contentType?.startsWith('video/'));
        let audioAttach = attachments.find(a => a.contentType?.startsWith('audio/'));
        
        if (!mediaAttach) return;
        
        const type = mediaAttach.contentType?.startsWith('video/') ? 'video' : 'image';
        
        // On envoie le signal UNIQUEMENT à l'overlay
        if (overlayWindow) {
          overlayWindow.webContents.send('new-media', {
            url: mediaAttach.url,
            type: type,
            soundUrl: audioAttach ? audioAttach.url : null
          });
        }
      }
      
      // Intercept Troll Voting messages to avoid reading the full text via TTS
      if (message.content.includes('VOTE TROLL LANCE CONTRE')) {
        if (overlayWindow) overlayWindow.webContents.send('new-text', { text: "Le vote du troll est ouvert." });
        return;
      }
      if (message.content.includes('LE VOTE EST TERMINE')) {
        if (overlayWindow) overlayWindow.webContents.send('new-text', { text: "Le vote du troll est terminé." });
        return;
      }
      
      // Hidden Message: In-App Vote
      if (message.content.startsWith('[MemeScreen')) {
          // Do not read this via TTS, just process it below
      } else if (message.content) {
        if (overlayWindow) {
          overlayWindow.webContents.send('new-text', { text: message.content });
        }
      }
      
      
        // Process Hidden Message: Troll Sync
        if (message.content.startsWith('[MemeScreenTrollStart]')) {
          const parts = message.content.substring(23).split(' ');
          const target = parts[0];
          const optionsStr = parts.slice(1).join(' ');
          try {
            const options = JSON.parse(optionsStr);
            if (!activeTrollVote) {
              const windows = require('electron').BrowserWindow.getAllWindows();
              windows.forEach(w => {
                try { w.webContents.send('troll-vote-started', { target, duration: 15, options }); } catch(e){}
              });
            }
            message.delete().catch(()=>{}).then();
          } catch(e) {}
          return;
        }
        
        if (message.content.startsWith('[MemeScreenTrollEnd]')) {
          const parts = message.content.split(' ');
          const target = parts[1];
          const winnerChoice = parts[2];
          const winningId = parts[3];
          
          const windows = require('electron').BrowserWindow.getAllWindows();
          windows.forEach(w => {
            try { w.webContents.send('troll-vote-ended', { winner: winnerChoice, target }); } catch(e){}
            try { w.webContents.send('execute-troll', { type: winningId, target }); } catch(e){}
          });
          
          try { message.delete().catch(()=>{}).then(); } catch(e){}
          return;
        }

        // Process Hidden Message: In-App Vote
      if (message.content.startsWith('[MemeScreenVote]')) {
        const parts = message.content.split(' ');
        if (parts.length >= 4) {
          const voteTarget = parts[1];
          const choice = parts[2];
          const pseudo = parts[3];
          
          if (activeTrollVote && activeTrollVote.target === voteTarget) {
            if (!activeTrollVote.voters.has(pseudo)) {
              activeTrollVote.voters.add(pseudo);
              if (!activeTrollVote.votes[choice]) activeTrollVote.votes[choice] = 0;
              activeTrollVote.votes[choice]++;
              broadcastTrollUpdate();
            }
          }
        }
        // Delete the hidden message to not spam
        try { message.delete().catch(()=>{}).then(); } catch(e){}
        return;
      }
      
      // Discord Command: !troll target
      if (message.content.startsWith('!troll ')) {
        const target = message.content.substring(7).trim();
        if (target) {
          startTrollVote(target);
        }
      }
    }
  });

  try {
    await discordClient.login(token);
    discordClient.targetChannelId = channelId;
  } catch (err) {
    event.reply('discord-status', { success: false, error: "Échec de connexion (Token invalide ?)" });
  }
});

ipcMain.on('discord-upload', async (event, { filePath, fileName, sound }) => {
  try {
    if (!discordClient || !discordClient.targetChannelId) {
      throw new Error("Bot non connecté.");
    }
    const channel = await discordClient.channels.fetch(discordClient.targetChannelId);
    if (!channel) throw new Error("Salon introuvable. Vérifiez l'ID.");

    let filesToSend = [new AttachmentBuilder(filePath, { name: fileName })];
    
    if (sound && sound !== 'none') {
      const soundPath = path.isAbsolute(sound) ? sound : path.join(__dirname, 'assets', 'sounds', sound);
      if (fs.existsSync(soundPath)) {
        filesToSend.push(new AttachmentBuilder(soundPath, { name: path.basename(soundPath) }));
      }
    }

    await channel.send({ files: filesToSend });
    
    event.reply('upload-status', { success: true });
  } catch (error) {
    console.error(error);
    event.reply('upload-status', { success: false, error: error.message });
  }
});

ipcMain.on('discord-tts', async (event, { text }) => {
  try {
    if (!discordClient || !discordClient.targetChannelId) {
      throw new Error("Bot non connecté.");
    }
    const channel = await discordClient.channels.fetch(discordClient.targetChannelId);
    if (!channel) throw new Error("Salon introuvable. Vérifiez l'ID.");

    await channel.send(text);
    event.reply('tts-status', { success: true });
  } catch (error) {
    console.error(error);
    event.reply('tts-status', { success: false, error: error.message });
  }
});

ipcMain.on('discord-logout', () => {
  if (discordClient) {
    discordClient.destroy();
    discordClient = null;
  }
});

ipcMain.on('update-settings', (event, settings) => {
  if (overlayWindow) {
    overlayWindow.webContents.send('apply-settings', settings);
  }
});

ipcMain.on('set-autostart', (event, enable) => {
  app.setLoginItemSettings({
    openAtLogin: enable,
    openAsHidden: enable,
    path: app.getPath('exe'),
    args: ['--hidden']
  });
});

ipcMain.on('window-min', () => {
  if (mainWindow) mainWindow.minimize();
});
ipcMain.on('window-max', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});
ipcMain.on('window-close', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

let currentMacros = [];
ipcMain.on('update-macros', (event, macros) => {
  currentMacros.forEach(m => {
    if (m.shortcut) {
      try { globalShortcut.unregister(m.shortcut); } catch(e){}
    }
  });
  
  currentMacros = macros;
  
  currentMacros.forEach(m => {
    if (m.shortcut) {
      try {
        globalShortcut.register(m.shortcut, () => {
          if (mainWindow) {
            mainWindow.webContents.send('trigger-macro-shortcut', m.id);
          }
        });
      } catch(e) {
        console.error(`Failed to register shortcut ${m.shortcut} for macro ${m.name}`);
      }
    }
  });
});

ipcMain.on('process-video', async (event, { inputPath, texts, width, height, sound }) => {
  if (!discordClient || !discordClient.targetChannelId) {
    event.reply('upload-status', { success: false, error: "Bot non connecté." });
    return;
  }
  
  const tempPath = path.join(os.tmpdir(), `meme_video_${Date.now()}.mp4`);
  let filterComplex = '';
  
  if (texts && texts.length > 0) {
    const filters = texts.map((t, idx) => {
      const textFilePath = path.join(os.tmpdir(), `text_${Date.now()}_${idx}.txt`);
      fs.writeFileSync(textFilePath, t.text);
      const safeTextPath = textFilePath.replace(/\\/g, '/').replace(/:/g, '\\\\:');
      
      const fontPath = 'C:/Windows/Fonts/impact.ttf'.replace(/:/g, '\\\\:');
      
      // FFmpeg defaults to top-left text origin. Our canvas is top-center.
      const xExp = `${t.x}-(text_w/2)`;
      const yExp = `${t.y}`;
      const borderW = Math.max(2, Math.floor(t.size / 15));
      
      return `drawtext=fontfile='${fontPath}':textfile='${safeTextPath}':fontcolor=white:bordercolor=black:borderw=${borderW}:fontsize=${t.size}:x=${xExp}:y=${yExp}`;
    });
    filterComplex = filters.join(',');
  }

  const command = ffmpeg(inputPath)
    .outputOptions([
      '-c:v libx264',
      '-preset veryfast', // Meilleur ratio vitesse/poids que ultrafast
      '-b:v 1500k',       // Force un bitrate max de 1.5 Mbps (environ 11 Mo par minute max)
      '-maxrate 1500k',
      '-bufsize 3000k',
      '-c:a aac',
      '-b:a 128k'
    ]);
    
  if (filterComplex) {
    command.videoFilters(filterComplex);
  }
  
  command.save(tempPath)
    .on('end', async () => {
      let fileSizeInMegabytes = 0;
      try {
        const stats = fs.statSync(tempPath);
        fileSizeInMegabytes = (stats.size / (1024 * 1024)).toFixed(2);
        
        const channel = await discordClient.channels.fetch(discordClient.targetChannelId);
        
        let filesToSend = [new AttachmentBuilder(tempPath, { name: 'meme.mp4' })];
        if (sound && sound !== 'none') {
          const soundPath = path.isAbsolute(sound) ? sound : path.join(__dirname, 'assets', 'sounds', sound);
          if (fs.existsSync(soundPath)) {
            filesToSend.push(new AttachmentBuilder(soundPath, { name: path.basename(soundPath) }));
          }
        }
        
        await channel.send({ files: filesToSend });
        event.reply('upload-status', { success: true });
      } catch (err) {
        let msg = err.message;
        if (fileSizeInMegabytes > 0) {
          msg = `${msg} (Taille tentée : ${fileSizeInMegabytes} Mo)`;
        }
        event.reply('upload-status', { success: false, error: msg });
      }
    })
    .on('error', (err) => {
      event.reply('upload-status', { success: false, error: err.message });
    });
});

// --- TROLL LOGIC ---
const ALL_TROLLS = [
  { id: 'flashbang', name: 'Flashbang 💣' },
  { id: 'bsod', name: 'Faux BSOD 💻' },
  { id: 'dvd', name: 'Bouncing DVD 📀' },
  { id: 'update', name: 'Fausse MAJ Windows 🔄' },
  { id: 'crack', name: 'Écran Fissuré 🔨' },
  { id: 'discord-call', name: 'Appel Discord 📞' },
  { id: 'fly', name: 'La Mouche 🪰' },
  { id: 'matrix', name: 'Matrix Rain 👨‍💻' },
  { id: 'hacker', name: 'Hacking CMD 💻' },
  { id: 'notif', name: 'Notification Spam 🔔' }
];

let activeTrollVote = null;

function broadcastTrollUpdate() {
  if (!activeTrollVote) return;
  const windows = require('electron').BrowserWindow.getAllWindows();
  windows.forEach(w => {
    try { w.webContents.send('troll-vote-update', { votes: activeTrollVote.votes }); } catch(e){}
  });
}

function startTrollVote(target) {
  if (activeTrollVote) return;
  if (!discordClient || !discordClient.targetChannelId) return;
  
  // Pick 4 random trolls
  const shuffled = [...ALL_TROLLS].sort(() => 0.5 - Math.random());
  const selectedTrolls = shuffled.slice(0, 4);
  
  activeTrollVote = {
    target,
    votes: { '1': 0, '2': 0, '3': 0, '4': 0 },
    options: selectedTrolls,
    voters: new Set(),
    endTime: Date.now() + 15000,
    messageId: null
  };
  
  const windows = require('electron').BrowserWindow.getAllWindows();
  windows.forEach(w => {
    try { w.webContents.send('troll-vote-started', { target, duration: 15, options: selectedTrolls }); } catch(e){}
  });
  
  discordClient.channels.fetch(discordClient.targetChannelId).then(channel => {
    if (!channel) return;
    
    let msgText = '🚨 **VOTE TROLL LANCE CONTRE `' + target + '` !** 🚨\n\n';
    msgText += '1️⃣ ' + selectedTrolls[0].name + '\n';
    msgText += '2️⃣ ' + selectedTrolls[1].name + '\n';
    msgText += '3️⃣ ' + selectedTrolls[2].name + '\n';
    msgText += '4️⃣ ' + selectedTrolls[3].name + '\n\n';
    msgText += '*Le vote se termine dans 15 secondes. Réagissez pour voter !*';
    
    channel.send(msgText).then(async msg => {
      activeTrollVote.messageId = msg.id;
      try {
        await msg.react('1️⃣');
        await msg.react('2️⃣');
        await msg.react('3️⃣');
        await msg.react('4️⃣');
      } catch(e){}
      
      const filter = (reaction, user) => !user.bot && ['1️⃣', '2️⃣', '3️⃣', '4️⃣'].includes(reaction.emoji.name);
      const collector = msg.createReactionCollector({ filter, time: 15000 });
      
      collector.on('collect', (reaction, user) => {
        if (!activeTrollVote) return;
        const choice = { '1️⃣': '1', '2️⃣': '2', '3️⃣': '3', '4️⃣': '4' }[reaction.emoji.name];
        if (!activeTrollVote.voters.has(user.id)) {
          activeTrollVote.voters.add(user.id);
          activeTrollVote.votes[choice]++;
          broadcastTrollUpdate();
        }
      });
      
      collector.on('end', () => endTrollVote(msg));
    });
  });
}

function endTrollVote(msg) {
  if (!activeTrollVote) return;
  
  let winnerChoice = '1';
  let maxVotes = -1;
  for (let i = 1; i <= 4; i++) {
    if (activeTrollVote.votes[i.toString()] > maxVotes) {
      maxVotes = activeTrollVote.votes[i.toString()];
      winnerChoice = i.toString();
    }
  }
  
  const target = activeTrollVote.target;
  const winningTroll = activeTrollVote.options[parseInt(winnerChoice) - 1];
  activeTrollVote = null;
  
  if (msg) {
    msg.edit('🚨 **LE VOTE EST TERMINE !** 🚨\nLe vainqueur est : **' + winningTroll.name + '** ! Execution en cours sur le PC de ' + target + '...');
  }
  
  const windows = require('electron').BrowserWindow.getAllWindows();
  windows.forEach(w => {
    try { w.webContents.send('troll-vote-ended', { winner: winnerChoice, target }); } catch(e){}
  });
  
  if (overlayWindow) {
    overlayWindow.webContents.send('execute-troll', { type: winningTroll.id, target });
  }
}

ipcMain.on('launch-troll-vote', (event, { target }) => startTrollVote(target));

ipcMain.on('send-troll-vote', async (event, { vote, myPseudo }) => {
  if (!activeTrollVote) return;
  if (discordClient && discordClient.targetChannelId) {
    try {
      const channel = await discordClient.channels.fetch(discordClient.targetChannelId);
      if (channel) {
        channel.send('[MemeScreenVote] ' + activeTrollVote.target + ' ' + vote + ' ' + (myPseudo || 'Anonyme_' + Date.now()));
      }
    } catch(e){}
  }
});

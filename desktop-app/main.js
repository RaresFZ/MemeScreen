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
    minWidth: 1000,
    minHeight: 700,
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
autoUpdater.on('update-downloaded', (info) => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Mise à jour disponible 🚀',
    message: 'Une nouvelle version a été téléchargée ! L\'application va redémarrer pour l\'installer.',
    buttons: ['Redémarrer maintenant', 'Plus tard']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
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
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
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
      } else if (message.content) {
        if (overlayWindow) {
          overlayWindow.webContents.send('new-text', { text: message.content });
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

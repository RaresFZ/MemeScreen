const { app, BrowserWindow, ipcMain, screen, dialog, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { autoUpdater } = require('electron-updater');
const { Client, GatewayIntentBits, AttachmentBuilder, Events } = require('discord.js');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegStatic);

let mainWindow;
let overlayWindow;
let splashWindow;
let discordClient;

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
    backgroundColor: '#000000',
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile('index.html');
  
  mainWindow.once('ready-to-show', () => {
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
  
  // Fermer toute l'application quand la fenêtre principale est fermée
  mainWindow.on('closed', () => {
    app.quit();
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
    globalShortcut.register('CommandOrControl+²', () => {
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
    if (message.channelId === channelId && message.attachments.size > 0) {
      const attachment = message.attachments.first();
      if (!attachment) return;
      
      const type = attachment.contentType?.startsWith('video/') ? 'video' : 'image';
      
      // On envoie le signal UNIQUEMENT à l'overlay
      if (overlayWindow) {
        overlayWindow.webContents.send('new-media', {
          url: attachment.url,
          type: type
        });
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

ipcMain.on('discord-upload', async (event, { filePath, fileName }) => {
  try {
    if (!discordClient || !discordClient.targetChannelId) {
      throw new Error("Bot non connecté.");
    }
    const channel = await discordClient.channels.fetch(discordClient.targetChannelId);
    if (!channel) throw new Error("Salon introuvable. Vérifiez l'ID.");

    const attachment = new AttachmentBuilder(filePath, { name: fileName });
    await channel.send({ files: [attachment] });
    
    event.reply('upload-status', { success: true });
  } catch (error) {
    console.error(error);
    event.reply('upload-status', { success: false, error: error.message });
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

ipcMain.on('process-video', async (event, { inputPath, texts, width, height }) => {
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
        const attachment = new AttachmentBuilder(tempPath, { name: 'meme.mp4' });
        await channel.send({ files: [attachment] });
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

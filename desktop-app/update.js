const { ipcRenderer } = require('electron');

document.getElementById('restartBtn').addEventListener('click', () => {
  ipcRenderer.send('update-restart');
});

document.getElementById('laterBtn').addEventListener('click', () => {
  ipcRenderer.send('update-later');
});

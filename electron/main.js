const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#09090b',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 14 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
  });

  if (!mainWindow) {
    mainWindow = win;
  }
  
  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  win.loadURL('http://localhost:5173');

  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { 
          label: 'Preferences...',
          accelerator: 'CmdOrCtrl+,',
          click: () => win.webContents.send('open-settings')
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    { 
      label: 'File', 
      submenu: [ 
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            const win = BrowserWindow.getFocusedWindow() || mainWindow || createWindow();
            win.webContents.send('new-tab');
          }
        },
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+N',
          click: () => createWindow()
        },
        { type: 'separator' },
        {
          label: 'Import Request...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const win = BrowserWindow.getFocusedWindow() || mainWindow || createWindow();
            const { canceled, filePaths } = await dialog.showOpenDialog(win, {
              properties: ['openFile'],
              filters: [{ name: 'JSON', extensions: ['json'] }]
            });
            if (!canceled && filePaths.length > 0) {
              try {
                const content = fs.readFileSync(filePaths[0], 'utf-8');
                const data = JSON.parse(content);
                win.webContents.send('import-request-data', data);
              } catch (e) {
                dialog.showErrorBox('Import Error', 'Failed to parse the JSON file.');
              }
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Export Request...',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            const win = BrowserWindow.getFocusedWindow() || mainWindow;
            if (win) win.webContents.send('trigger-export');
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' } 
      ] 
    },
    { label: 'Edit', submenu: [ { role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, ...(isMac ? [{ role: 'pasteAndMatchStyle' }, { role: 'delete' }, { role: 'selectAll' }] : [{ role: 'delete' }, { type: 'separator' }, { role: 'selectAll' }]) ] },
    { label: 'View', submenu: [ { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' } ] },
    { label: 'Window', submenu: [ { role: 'minimize' }, { role: 'zoom' }, ...(isMac ? [ { type: 'separator' }, { role: 'front' }, { type: 'separator' }, { role: 'window' } ] : [ { role: 'close' } ]) ] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  
  return win;
}

ipcMain.handle('save-file', async (event, data, defaultName) => {
  const win = BrowserWindow.getFocusedWindow();
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: defaultName,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (!canceled && filePath) {
    fs.writeFileSync(filePath, data, 'utf-8');
    return filePath;
  }
  return null;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

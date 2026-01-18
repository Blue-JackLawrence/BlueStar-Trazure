import { app, BrowserWindow, ipcMain, dialog } from 'electron' // 👈 新增 dialog
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// --- ⚙️ 简易配置管理器 (Config Manager) ---
// 配置文件存放在 AppData 里，体积极小，不占空间
const CONFIG_PATH = path.join(app.getPath('userData'), 'app-config.json');

// 默认存储路径 (C盘文档)
const DEFAULT_STORAGE_PATH = path.join(app.getPath('documents'), 'Trazure_Data');

// 1. 读取当前配置
const getStoragePath = (): string => {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      if (config.storagePath && fs.existsSync(config.storagePath)) {
        return config.storagePath;
      }
    }
  } catch (e) {
    console.error('Config load failed, using default.');
  }
  // 确保默认路径存在
  if (!fs.existsSync(DEFAULT_STORAGE_PATH)) {
    fs.mkdirSync(DEFAULT_STORAGE_PATH, { recursive: true });
  }
  return DEFAULT_STORAGE_PATH;
};

// 2. 保存新配置
const setStoragePath = (newPath: string) => {
  const config = { storagePath: newPath };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
};

let win: BrowserWindow | null

const createWindow = () => {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {

  // --- 📂 IPC 接口：文件操作 ---

  // 获取当前存储路径 (给前端展示用)
  ipcMain.handle('get-current-storage-path', () => {
    return getStoragePath();
  });

  // 核心功能：打开文件夹选择弹窗，并保存设置
  ipcMain.handle('change-storage-path', async () => {
    if (!win) return null;

    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'], // 允许选文件夹、允许新建
      title: '选择蓝星数据存储位置',
      defaultPath: getStoragePath()
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const newPath = result.filePaths[0];
      setStoragePath(newPath); // ✅ 记住这个新路径！
      return newPath;
    }
    return null; // 用户取消了
  });

  // 保存文件 (逻辑升级：使用 getStoragePath())
  ipcMain.handle('save-file', async (_event, { fileName, buffer, subDir }) => {
    try {
      const basePath = getStoragePath(); // 👈 动态获取
      const dirPath = subDir ? path.join(basePath, subDir) : basePath;

      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      const filePath = path.join(dirPath, fileName);
      await fs.promises.writeFile(filePath, Buffer.from(buffer));
      return { success: true, path: filePath };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // 读取文件
  ipcMain.handle('get-file', async (_event, { fileName, subDir }) => {
    try {
      const basePath = getStoragePath(); // 👈 动态获取
      const dirPath = subDir ? path.join(basePath, subDir) : basePath;
      const filePath = path.join(dirPath, fileName);
      if (!fs.existsSync(filePath)) return null;
      return await fs.promises.readFile(filePath);
    } catch (error) {
      return null;
    }
  });

  // 删除文件
  ipcMain.handle('delete-file', async (_event, { fileName, subDir }) => {
    try {
      const basePath = getStoragePath(); // 👈 动态获取
      const filePath = path.join(basePath, subDir || '', fileName);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  });

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

export interface ElectronAPI {
  saveFile: (data: { fileName: string; buffer: ArrayBuffer; subDir?: string }) => Promise<{ success: boolean; path?: string; error?: string }>;
  getFile: (data: { fileName: string; subDir?: string }) => Promise<Uint8Array | null>;
  deleteFile: (data: { fileName: string; subDir?: string }) => Promise<boolean>;

  // ✨ 新增类型
  getCurrentStoragePath: () => Promise<string>;
  changeStoragePath: () => Promise<string | null>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

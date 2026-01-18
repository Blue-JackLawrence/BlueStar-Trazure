import { ref } from 'vue'
import { ElMessage } from 'element-plus'

// 定义 ElectronAPI 类型 (避免 TS 报错)
const electronAPI = (window as any).electronAPI

export function useFileSystem(currentUserDir: string) {

  // 状态：当前存储路径
  const currentStoragePath = ref('正在读取...')

  // 1. 初始化读取路径
  const loadStoragePath = async () => {
    if (!electronAPI) return
    try {
      const path = await electronAPI.getCurrentStoragePath()
      currentStoragePath.value = path
    } catch (e) {
      console.error('读取路径失败', e)
    }
  }

  // 2. 修改存储路径
  const changeStoragePath = async () => {
    if (!electronAPI) {
      ElMessage.warning('请在桌面端运行以修改路径')
      return
    }
    try {
      const newPath = await electronAPI.changeStoragePath()
      if (newPath) {
        currentStoragePath.value = newPath
        ElMessage.success('存储位置已更新！新照片将存入此处。')
      }
    } catch (e) {
      ElMessage.error('修改失败')
    }
  }

  // 3. 保存文件 (File/Blob -> 硬盘)
  const saveToLocal = async (fileName: string, file: Blob | File) => {
    if (!electronAPI) return
    const buffer = await file.arrayBuffer()
    const result = await electronAPI.saveFile({
      fileName,
      buffer,
      subDir: currentUserDir
    })
    if (!result.success) {
      throw new Error('Electron save failed: ' + result.error)
    }
  }

  // 4. 读取文件 (硬盘 -> Blob)
  const getFromLocal = async (fileName: string): Promise<Blob | null> => {
    if (!electronAPI) return null
    const buffer = await electronAPI.getFile({
      fileName,
      subDir: currentUserDir
    })
    if (!buffer) return null
    return new Blob([buffer])
  }

  // 5. 删除文件
  const deleteFromLocal = async (fileName: string) => {
    if (!electronAPI) return
    await electronAPI.deleteFile({
      fileName,
      subDir: currentUserDir
    })
  }

  return {
    currentStoragePath,
    loadStoragePath,
    changeStoragePath,
    saveToLocal,
    getFromLocal,
    deleteFromLocal
  }
}

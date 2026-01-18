import { ref, unref, type Ref } from 'vue' //
import { ElMessage } from 'element-plus'

// 定义 ElectronAPI 类型
const electronAPI = (window as any).electronAPI

// 接收参数改为：可以是普通字符串，也可以是响应式的 Ref
export function useFileSystem(currentUserDir: string | Ref<string>) {

  const currentStoragePath = ref('正在读取...')

  // 辅助函数：随时获取最新的目录名
  const getDir = () => unref(currentUserDir)

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
    if (!electronAPI) return
    try {
      const newPath = await electronAPI.changeStoragePath()
      if (newPath) {
        currentStoragePath.value = newPath
        ElMessage.success('存储位置已更新')
      }
    } catch (e) {
      ElMessage.error('修改失败')
    }
  }

  // 3. 保存文件 (使用 getDir() 获取最新路径)
  const saveToLocal = async (fileName: string, file: Blob | File) => {
    if (!electronAPI) return
    const buffer = await file.arrayBuffer()
    // ✅ 关键修改：subDir 使用 getDir() 动态获取
    const result = await electronAPI.saveFile({
      fileName,
      buffer,
      subDir: getDir()
    })
    if (!result.success) {
      throw new Error('Electron save failed: ' + result.error)
    }
  }

  // 4. 读取文件 (使用 getDir() 获取最新路径)
  const getFromLocal = async (fileName: string): Promise<Blob | null> => {
    if (!electronAPI) return null
    // ✅ 关键修改：subDir 使用 getDir() 动态获取
    const buffer = await electronAPI.getFile({
      fileName,
      subDir: getDir()
    })
    if (!buffer) return null
    return new Blob([buffer])
  }

  // 5. 删除文件
  const deleteFromLocal = async (fileName: string) => {
    if (!electronAPI) return
    await electronAPI.deleteFile({
      fileName,
      subDir: getDir()
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

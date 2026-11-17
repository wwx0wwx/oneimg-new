import { requireAuthUser } from '../../utils/auth.js'

// 指向本项目真实仓库（旧地址 oneimg/oneimg 不存在，且包含第三方代理）
const DIRECT_URL = 'https://raw.githubusercontent.com/wwx0wwx/oneimg-new/main/package.json'

export default defineEventHandler(async (event) => {
  try {
    await requireAuthUser(event)

    const config = useRuntimeConfig()
    const currentVersion = config.appVersion || '1.0.0'

    let latestVersion = null
    let hasUpdate = false
    let error = null

    const remotePackage = await fetchPackageJson(DIRECT_URL)

    if (remotePackage && remotePackage.version) {
      latestVersion = remotePackage.version
      hasUpdate = compareVersions(latestVersion, currentVersion) > 0
    } else {
      error = '无法获取最新版本信息'
    }

    return {
      success: true,
      data: {
        currentVersion,
        latestVersion,
        hasUpdate,
        error
      }
    }
  } catch (err) {
    if (err.statusCode) {
      throw err
    }
    return {
      success: false,
      message: '版本检测失败'
    }
  }
})

async function fetchPackageJson(url) {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'OneImg-Version-Check'
      },
      signal: AbortSignal.timeout(10000)
    })

    if (response.ok) {
      return await response.json()
    }
  } catch (err) {
    console.log(`版本检测请求失败 (${url}):`, err.message)
  }
  return null
}

function compareVersions(v1, v2) {
  const parts1 = v1.replace(/^v/, '').split('.').map(p => parseInt(p) || 0)
  const parts2 = v2.replace(/^v/, '').split('.').map(p => parseInt(p) || 0)

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const num1 = parts1[i] || 0
    const num2 = parts2[i] || 0

    if (num1 > num2) return 1
    if (num1 < num2) return -1
  }

  return 0
}

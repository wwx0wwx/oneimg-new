import { createReadStream, existsSync } from 'fs'
import { requireAdmin } from '../../../utils/auth.js'
import { getMediaPath, getMimeTypeByExtension, normalizeExtension } from '../../../utils/media.js'
import { getMediaByUuid } from '../../../utils/mediaService.js'

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)

    let path = getRouterParam(event, 'path')
    if (Array.isArray(path)) {
      path = path.join('/')
    }

    if (!path) {
      throw createError({ statusCode: 404, message: '媒体不存在' })
    }

    const match = path.match(/^([a-f0-9-]+)\.(\w+)$/i)
    if (!match) {
      throw createError({ statusCode: 404, message: '媒体不存在' })
    }

    const [, uuid, ext] = match
    const media = await getMediaByUuid(uuid)
    if (!media) {
      throw createError({ statusCode: 404, message: '媒体不存在' })
    }

    if (normalizeExtension(ext) !== normalizeExtension(media.format)) {
      throw createError({ statusCode: 404, message: '媒体不存在' })
    }

    const filePath = getMediaPath(media.filename)
    if (!existsSync(filePath)) {
      throw createError({ statusCode: 404, message: '媒体文件不存在' })
    }

    setHeader(event, 'Content-Type', media.mimeType || getMimeTypeByExtension(media.format))
    setHeader(event, 'Content-Length', String(media.size || 0))
    setHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate')
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    setHeader(event, 'Accept-Ranges', 'bytes')

    // 与 /i/ 直链一致：SVG 强制下载 + 限制性 CSP，防止同源脚本执行
    if (normalizeExtension(ext) === 'svg') {
      setHeader(event, 'Content-Disposition', `attachment; filename="${media.uuid}.svg"`)
      setHeader(event, 'Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox")
    }

    return sendStream(event, createReadStream(filePath))
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('[Admin Preview] 获取媒体失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取媒体失败'
    })
  }
})

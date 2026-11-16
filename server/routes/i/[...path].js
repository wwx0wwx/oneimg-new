import { createReadStream, existsSync } from 'fs'
import { createHash } from 'crypto'
import { getAuthUser } from '../../utils/auth.js'
import { getMediaPath, getMimeTypeByExtension, normalizeExtension } from '../../utils/media.js'
import { assertMediaAccess } from '../../utils/mediaService.js'

export default defineEventHandler(async (event) => {
  try {
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
    const user = await getAuthUser(event)
    const media = await assertMediaAccess({ user, uuid })
    const requestedExt = normalizeExtension(ext)
    const actualExt = normalizeExtension(media.format)

    if (requestedExt !== actualExt) {
      throw createError({ statusCode: 404, message: '媒体不存在' })
    }

    const filePath = getMediaPath(media.filename)
    if (!existsSync(filePath)) {
      throw createError({ statusCode: 404, message: '媒体文件不存在' })
    }

    const contentType = media.mimeType || getMimeTypeByExtension(actualExt)
    const etag = `"${createHash('md5').update(`${media.uuid}-${media.updatedAt || media.uploadedAt || ''}`).digest('hex')}"`
    const ifNoneMatch = getHeader(event, 'if-none-match')

    if (ifNoneMatch === etag) {
      setResponseStatus(event, 304)
      return ''
    }

    const cacheable = media.visibility === 'public'
    const maxAge = cacheable ? 365 * 24 * 60 * 60 : 0

    setHeader(event, 'Content-Type', contentType)
    setHeader(event, 'Content-Length', String(media.size || 0))
    setHeader(event, 'ETag', etag)
    setHeader(event, 'Last-Modified', new Date(media.updatedAt || media.uploadedAt || Date.now()).toUTCString())
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    setHeader(event, 'Accept-Ranges', 'bytes')
    setHeader(event, 'Cache-Control', cacheable ? `public, max-age=${maxAge}, immutable` : 'private, no-store, no-cache, must-revalidate')

    // SVG 可内嵌脚本且与站点同源，直接在浏览器顶层打开会执行任意 JS
    //（可窃取 localStorage 中的 JWT）。强制下载（<img>/<video> 嵌入不受
    // Content-Disposition 影响，画廊缩略图仍正常），并叠加限制性 CSP 作为纵深防御。
    if (actualExt === 'svg') {
      setHeader(event, 'Content-Disposition', `attachment; filename="${media.uuid}.svg"`)
      setHeader(event, 'Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox")
    }

    if (cacheable) {
      setHeader(event, 'Expires', new Date(Date.now() + maxAge * 1000).toUTCString())
    }

    return sendStream(event, createReadStream(filePath))
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('[Media] 获取媒体失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取媒体失败'
    })
  }
})

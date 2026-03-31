import db from '../../utils/db.js'
import { requireAuthUser, canViewMedia, isAdminUser } from '../../utils/auth.js'
import { toMediaRecord, buildMediaLink } from '../../utils/media.js'
import { resolveSiteUrl } from '../../utils/mediaService.js'

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getLabel(media) {
  return media.originalName || media.filename || buildMediaLink(media)
}

function formatLink(media, format, origin) {
  const url = buildMediaLink(media, origin)
  const label = getLabel(media)
  const isVideo = media.mediaType === 'video'

  switch (format) {
    case 'html':
      return isVideo
        ? `<video controls src="${url}" title="${escapeHtml(label)}"></video>`
        : `<img src="${url}" alt="${escapeHtml(label)}" />`
    case 'markdown':
      return isVideo ? `[${label}](${url})` : `![${label}](${url})`
    case 'bbcode':
      return isVideo ? `[url=${url}]${label}[/url]` : `[img]${url}[/img]`
    case 'direct':
    default:
      return url
  }
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const body = await readBody(event)
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids.filter(Boolean))] : []
  const format = ['direct', 'markdown', 'html', 'bbcode'].includes(body.format) ? body.format : 'direct'

  if (ids.length === 0) {
    throw createError({ statusCode: 400, message: '请选择要提取的媒体' })
  }

  const origin = await resolveSiteUrl(event)
  const all = await db.images.find({ _id: { $in: ids }, isDeleted: false })
  const visible = all
    .map(toMediaRecord)
    .filter(item => !item.isDeleted)
    // NSFW媒体仅允许所有者和管理员查看
    .filter(item => !item.isNsfw || isAdminUser(user) || item.ownerId === user._id)
    .filter(item => canViewMedia(user, item))

  return {
    success: true,
    data: {
      items: visible.map(item => ({
        id: item._id,
        text: formatLink(item, format, origin)
      })),
      output: visible.map(item => formatLink(item, format, origin)).join('\n'),
      deniedCount: ids.length - visible.length
    }
  }
})

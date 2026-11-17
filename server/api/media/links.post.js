import db from '../../utils/db.js'
import { requireAuthUser, canViewMedia, isAdminUser } from '../../utils/auth.js'
import { toMediaRecord } from '../../utils/media.js'
import { resolveSiteUrl } from '../../utils/mediaService.js'
import { formatMediaLink, LINK_FORMATS } from '../../../shared/mediaLinks.js'

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const body = await readBody(event)
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids.filter(Boolean))] : []
  const format = LINK_FORMATS.includes(body.format) ? body.format : 'direct'

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
        text: formatMediaLink(item, format, origin)
      })),
      output: visible.map(item => formatMediaLink(item, format, origin)).join('\n'),
      deniedCount: ids.length - visible.length
    }
  }
})

// 前后端共享的链接格式化（单一实现，双端导入）。
// 服务端入口：server/api/media/links.post.js（origin = resolveSiteUrl）
// 前端入口：app/pages/index.vue（origin = window.location.origin）
// 注意：此前两份实现已出现 label 回退逻辑分叉，此处以服务端语义为基准统一。

export const LINK_FORMATS = ['direct', 'html', 'markdown', 'bbcode']

export function escapeHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildMediaUrl(media) {
  return media.url || `/i/${media.uuid}.${String(media.format || '').toLowerCase().replace(/^\./, '')}`
}

function getLabel(media) {
  return media.originalName || media.filename || buildMediaUrl(media)
}

/**
 * 生成指定格式的媒体链接文本
 * @param {object} media 需含 url/uuid/format/originalName/filename/mediaType
 * @param {'direct'|'html'|'markdown'|'bbcode'} format
 * @param {string} origin 站点前缀（空字符串则为相对路径）
 */
export function formatMediaLink(media, format = 'direct', origin = '') {
  const base = String(origin || '').replace(/\/+$/, '')
  const url = base + buildMediaUrl(media)
  const label = getLabel(media)
  const alt = escapeHtml(label)
  const isVideo = media.mediaType === 'video'

  switch (format) {
    case 'html':
      return isVideo
        ? `<video controls src="${escapeHtml(url)}" title="${alt}"></video>`
        : `<img src="${escapeHtml(url)}" alt="${alt}" />`
    case 'markdown':
      return isVideo ? `[${label}](${url})` : `![${label}](${url})`
    case 'bbcode':
      return isVideo ? `[url=${url}]${label}[/url]` : `[img]${url}[/img]`
    case 'direct':
    default:
      return url
  }
}

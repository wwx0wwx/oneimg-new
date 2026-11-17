import crypto from 'crypto'

/**
 * CSP nonce：为 HTML 响应中的内联 <script>/<style> 注入 nonce，
 * 并下发带 nonce 的 Content-Security-Policy（覆盖 routeRules 的静态 CSP，
 * 使 script-src/style-src 摆脱 'unsafe-inline'）。
 * 仅作用于 HTML 文档响应（媒体/API 的 CSP 由各路由自行设置）。
 */
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('render:response', (response) => {
    const headers = response.headers || {}
    const contentType = String(headers['content-type'] || headers['Content-Type'] || '')
    if (!contentType.includes('text/html')) return

    const body = response.body
    if (typeof body !== 'string' || !body.includes('<script')) return

    const nonce = crypto.randomBytes(16).toString('base64url')
    response.body = body
      .replace(/<script(?![^>]*\bnonce=)([^>]*)>/g, `<script nonce="${nonce}"$1>`)
      .replace(/<style(?![^>]*\bnonce=)([^>]*)>/g, `<style nonce="${nonce}"$1>`)

    headers['Content-Security-Policy'] = [
      "default-src 'self'",
      "img-src 'self' data: blob: https: http:",
      "media-src 'self' blob:",
      "style-src 'self' 'nonce-" + nonce + "'",
      "script-src 'self' 'nonce-" + nonce + "'",
      "connect-src 'self'",
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'"
    ].join('; ')
  })
})

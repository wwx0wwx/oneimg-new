import crypto from 'crypto'

/**
 * CSP nonce（本插件是全站 CSP 的唯一出口，routeRules 中不再配置静态 CSP）。
 * 仅对 <script> 做 nonce——SPA（ssr:false）下 Vue 运行时会动态注入
 * 无 nonce 的 <style>（scoped 样式/v-bind CSS/motion 内联样式），
 * style-src 若不带 'unsafe-inline' 会产生海量违规并拦截动态样式
 * （样式注入无脚本执行风险，保留 unsafe-inline 是 SPA 的标准权衡）。
 */
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('render:response', (response) => {
    const headers = response.headers || {}
    const contentType = String(headers['content-type'] || headers['Content-Type'] || '')
    if (!contentType.includes('text/html')) return

    const body = response.body
    if (typeof body !== 'string' || !body.includes('<script')) return

    const nonce = crypto.randomBytes(16).toString('base64url')
    response.body = body.replace(/<script(?![^>]*\bnonce=)([^>]*)>/g, `<script nonce="${nonce}"$1>`)

    headers['Content-Security-Policy'] = [
      "default-src 'self'",
      "img-src 'self' data: blob: https: http:",
      "media-src 'self' blob:",
      "style-src 'self' 'unsafe-inline'",
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

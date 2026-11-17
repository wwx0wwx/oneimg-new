// 应用设置默认值（此前 4 份拷贝：database.js / settings/index.get / settings/public.get / settings/index.put）
export const DEFAULT_APP_SETTINGS = Object.freeze({
  appName: 'OneImg',
  appLogo: '',
  backgroundUrl: '',
  backgroundBlur: 0,
  siteUrl: '',
  appDescription: 'OneImg 是一个面向个人使用的媒体床，统一管理图片与视频。',
  announcement: Object.freeze({
    enabled: false,
    content: '',
    displayType: 'modal'
  })
})

## Changelog

### 1.3.1

**Legacy cleanup（L1-L19 遗留问题清零）:**

- **配置合并（L1）**：移除 `publicApiConfig` 中的死字段 `enabled`/`allowedFormats`/`maxFileSize`——服务端校验从未使用它们（真实开关在媒体策略）。管理页"启用公共 API"死开关与重复的"最大文件大小"输入框一并删除，API 读写兼容清理
- **URL 导入加固（L2/L5）**：下载改为**固定已校验 IP 的流式连接**（消灭 DNS rebinding TOCTOU 窗口），流式计数超过 100MB 立即中断（不再整包读入内存）；单个/批量（SSE）接口服务端强制单次 ≤20 个 URL
- **通知密钥治理（L3）**：Telegram Token/邮箱密码/Server酱 SendKey 以 AES-256-GCM 加密落库（主密钥从 `ONEIMG_SECRET_KEY` 或 jwtSecret 派生），管理端 GET 只返回尾 4 位脱敏；提交脱敏占位时自动保留库中原值
- **登录注入与信息泄露（L4）**：登录入参强制字符串类型（堵 NeDB 查询操作符注入），500 不再回显内部错误文本
- **出站统一防护（L7）**：Webhook 通知/测试与内容安全检测服务地址复用与 URL 导入相同的私网拦截标准，全部出站请求增加 15-30s 超时
- **性能（L8/L11/L12）**：媒体列表/违规列表/IP 黑名单的过滤排序分页下推存储层（不再全表读入内存）；`verifyToken` 单次查库并携带完整用户字段（此前每请求两次）；审核队列空闲时停止 5 秒轮询，新任务到达再启动
- **权限感知（L10）**：API/统计/通知导航与页面仅管理员可见（前端引导 + 服务端 403 兜底）；设置页的应用/公告区块仅管理员可见，普通用户仅见账户设置
- **强制改密（L16）**：初始密码未修改的账户登录后自动引导至设置页改密
- **防盗链伪装开关化（L13）**：URL 导入默认不再伪造目标站 Referer/Origin，需 `ONEIMG_SPOOF_REFERER=1` 显式开启
- **隐私披露（L14）**：管理页与 README 显著说明"内容安全检测会把图片发送到第三方"；README 新增隐私与出站行为章节及环境变量参考
- **文档对齐（L15）**：nsfw_detector 适配器注释与实际解析结构对齐，并说明自建服务需要返回的响应结构
- **全站 CSP（L18）**：新增增量式 Content-Security-Policy（object-src/base-uri/form-action/frame-ancestors 等实际防护；script-src 暂含 unsafe-inline，nonce 方案列入后续）
- **siteUrl 防护（L19）**：未配置 siteUrl 时清洗 `x-forwarded-proto`/`host` 头并输出生产告警；README 强制要求生产配置固定 siteUrl
- **依赖更新（L17）**：`pnpm update` 范围内升级传递依赖并复核
- **死代码清理（L9）**：移除 api.vue 中无引用的黑名单 UI 逻辑与 media.js 未使用导出

### 1.3.0

**Security Fixes:**

- **修复 SVG 存储型 XSS**：`/i/` 直链与管理员预览接口对 SVG 强制 `Content-Disposition: attachment` 并叠加限制性 CSP（`<img>` 嵌入不受影响，画廊缩略图正常；仅阻断顶层导航时的同源脚本执行）
- **修复公告净化器绕过**：手写正则净化替换为 `sanitize-html` 白名单方案（实测旧实现下未加引号的 `href=javascript:alert(1)` 可存活）；设置页预览改为仅渲染服务端净化后的内容
- **修复 URL 导入 SSRF**：归一化 IP 判定——剥 IPv6 hostname 方括号、IPv4-mapped IPv6（`::ffff:127.0.0.1`）还原为 IPv4 判断、新增 `0.0.0.0/8`、`100.64.0.0/10`（CGNAT）、`fec0:` 等拒绝段；IPv6 字面量不再因解析崩溃返回泛化错误；域名解析失败返回明确提示
- **移除前端硬编码的第三方 NSFW API Key**：`api.vue` 默认配置中的 key 已删除（历史 key 应视为已泄露并吊销）；服务端保存配置时剥离客户端回传的厂商密钥，密钥只认 `NSFWDET_API_KEY` 等环境变量
- **JWT 强化**：有效期 30 天 → 7 天；新增 `tokenVersion` 撤销机制——修改密码/用户名、管理员重置密码后所有旧 token 立即失效，改密接口为当前会话换发新 token
- **登录防爆破**：登录接口改用独立限速（每 IP 每分钟 5 次），不再与 `privateApiConfig.rateLimit` 耦合
- **API Key 弃用 query 传参**：仅接受 `X-API-Key` 请求头，避免密钥进入反代日志/浏览器历史

**Bug Fixes:**

- **修复媒体策略无法保存（P0）**：`saveMediaConfig` 不再把 `_id` 放进 NeDB `$set`——此前首次启动即崩溃（unhandledRejection）且 `PUT /api/media/config` 永远 500，匿名上传开关/扩展名白名单/三级大小限制/默认可见性全部无法持久化
- **修复公共上传 100% 被拒（P0）**：`checkPublicRateLimit` / `checkPublicConcurrency` 补上 `await`——此前 `.allowed` 恒为 `undefined`，匿名上传第一个请求即 429"请 undefined 秒后重试"；并发计数改为仅在 acquire 后对称 release，消除计数漂移
- **修复私有媒体"上传成功却缩略图裂图"**：画廊卡片、图片查看器、违规预览统一改用带凭证的 fetch + Blob URL 加载需鉴权媒体（公开媒体仍走直链，模块级缓存避免重复请求）
- **修复 Docker 部署端口矛盾**：`docker-compose.yml` 的 `PORT=3000` 与 `8888:8888` 映射冲突 → 统一为 8888；README 环境变量示例同步为 8888；移除拉取不存在镜像的 watchtower 服务及 Docker socket 暴露
- base64 上传硬上限 10MB → 100MB，与 multipart 角色限额逻辑对齐（实际限额仍由 `validateMediaByConfig` 按角色校验）
- IP 黑名单 IPv4 正则收紧为逐段 0-255（不再放行 `999.999.999.999`）
- 版本检查指向本仓库真实地址（旧地址 `oneimg/oneimg` 不存在，且经第三方代理）
- 前端媒体策略默认大小与后端默认值对齐（用户 50MB/管理员 100MB）

**Chore:**

- `nuxt` 依赖从 `latest` 固定为 `^4.2.2`；Dockerfile 固定 `pnpm@9.15.9`；新增容器 healthcheck（Dockerfile 与 compose）
- 新增 `ONEIMG_DATA_DIR` 环境变量：可显式覆盖数据/上传目录（默认行为不变），便于隔离部署、备份与多实例

### 1.2.1

**Security Fixes:**

- 修复批量删除 API 权限绕过漏洞（仅管理员可调用）
- 移除硬编码的 NSFW API Key，改为环境变量配置
- 私有上传接口添加速率限制
- 补全 rateLimit.js 缺失的导出函数

### 1.2.0

当前版本为 `OneImg` 的统一收口版本，重点包括：

- 统一以 `media` 作为唯一业务模型
- 清理旧兼容分支与历史命名残留
- 修复私有媒体访问控制与访问路由错误
- 修复登录上传与 API Key 归属错误
- 统一匿名 / 用户 / 管理员的大小限制与默认可见性
- 收紧管理员配置、内容安全、API Key 与用户管理权限
- 完成图片 / 视频上传、访问、批量提链与后台管理闭环

### 1.1.0

- 升级为统一媒体床架构
- 增加视频上传、展示、预览与提链能力
- 引入账号系统与三级权限
- 增加媒体策略配置

### 1.0.0

- 原始版本发布
- 以图片上传与图库管理为主

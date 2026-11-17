## Changelog

### 2.2.1

**修复:**

- `scripts/purge-legacy-keys.mjs`：NeDB compact 会以新 inode 重写 settings.db——当脚本以 root 运行而服务以低权限用户（www-data）运行时，新文件属主变为 root，导致服务写入 EACCES 并卡死 NeDB 持久化队列（后续所有 settings 查询挂起）。现于压缩后恢复原属主与权限；README 式用法说明同步更新（并建议以服务同一用户执行）

### 2.2.0

**清理期（v2.1.0 结构重构的收尾）：**

- **删除 notification.js 转发 shim**：7 处引用全部直指 `notification/index.js`
- **旧配置键出清**：移除 `mediaConfig`/`publicApiConfig`/`privateApiConfig` 的读取兜底与写入双写；迁移简化为"新键存在即跳过"；数据库不再初始化旧键；提供停机出清脚本 `scripts/purge-legacy-keys.mjs`（自动备份 settings.db 并压缩）
- **数据文件更名**：`images.db` → `media.db`（启动时一次性复制迁移，旧文件保留为快照）
- **uploadedByType 枚举化**：`UPLOADED_BY_TYPES` 常量 + 创建入口校验 + 存量记录读取归一化
- **图标本地化**：`@iconify-json/heroicons` 构建期打包 + `clientBundle` 显式清单——运行时零外联（实测 0 次 iconify 请求）
- **CSP 收紧（nonce 化）**：移除 `api.iconify.design` 白名单与 `script-src/style-src` 的 `unsafe-inline`——HTML 响应注入一次性 nonce（`server/plugins/csp-nonce.js`），实测 0 违规
- **回滚语义变化（重要）**：旧配置键出清后，回滚到 v1.x 将读到默认配置；`media.db` 更名后回滚到 v2.1.x 会丢失 v2.2 期间的新增媒体。**回滚前请备份 `db/` 目录**

### 2.1.0

**结构重构（按重构方案 P0-P5，零行为变化 + 配置模型统一）：**

- **回归护栏（P0）**：`test/unit`（CI 可跑）+ `test/regression`（自包含实例的 28 项 e2e 断言，覆盖三轮审计全部安全/功能项）；恢复 GitHub Actions CI（install + unit + build）
- **纯抽取（P1）**：`shared/mediaLinks.js` 前后端单一链接格式化实现（label 回退语义统一为服务端）；`media.js#derivePresentation` 唯一 url/coverUrl/poster 推导；moderation 三适配器共享 `postMultipart/postJson`（514→488 行）
- **notification 目录化（P2）**：974 行巨石拆为 config（唯一接触加解密）/template/channels 四渠道适配器（统一 `{send,test}` 接口）/index 编排；原文件保留为转发 shim（v2.2 移除）；对外导出与引用方零改动
- **api.vue 面板化（P3）**：896 行 SFC 拆为 54 行薄壳 + 5 个 `components/admin/*Panel`；`useConfigForm` 收敛三份重复表单生命周期
- **uploadPolicy 单一事实源（P4）**：新模型统一 策略/压缩处理/各接口限速/并发/内容安全；读取优先新键、旧三键即时合并兜底；启动幂等迁移（内容比较）；**旧端点形状不变并双写旧键——任意时刻可回滚 v1.3.3 且配置一致**；新增管理端点 `GET/PUT /api/upload-policy`
- **死字段删除**：`privateApiConfig.maxFileSize` 与 `showOnHomepage`（均无服务端消费方，UI 输入一并移除；实际限额在媒体策略中配置）
- **压缩/转换合一说明**：历史上 public/private 各存一份压缩配置，统一为全局 `processing`（合并取登录侧值；两份不一致的部署请在新端点重新确认）

### 1.3.3

**修复:**

- **`ONEIMG_DATA_DIR` 语义统一**：库文件位于 `<ONEIMG_DATA_DIR>/db/`，与 `<ONEIMG_DATA_DIR>/uploads/` 对称。此前 `db.js` 把该值直接当作库目录，设置后库文件会散落到数据根目录（无该环境变量时不受影响；测试站降权部署时暴露）

### 1.3.2

**P0 修复（v1.3.1 回归与渲染缺陷）:**

- **修复全站图标消失**：CSP `connect-src` 补充 `https://api.iconify.design`（@nuxt/icon 运行时图标源，v1.3.1 引入的 CSP 将其拦截）
- **修复公告顶部横幅显示 HTML 源码**：横幅分支改用 `v-html` 渲染服务端净化后的内容（与弹窗一致）

**安全加固:**

- **上传内容真实格式校验（S1/S2）**：新增 magic bytes 嗅探——图片经 `sharp` 解析真实格式（ico 手动识别 magic），视频校验容器头（mp4/mov=ftyp、webm=EBML）；垃圾字节伪装媒体直接 400；MIME 与扩展名改为精确匹配（此前 .png 声明 image/jpeg 也能通过）；apng↔png 视为等价格式
- **URL 导入限速（S3）**：单发与 SSE 批量接口每 IP 每分钟 10 次，超出 429
- **通知配置 PUT 响应脱敏（S4）**：响应与 GET 一致只回尾 4 位（此前原样回显明文密钥）
- **netGuard 保留段补全（S5）**：新增 `2002::/16`（6to4）、`64:ff9b::/96`（NAT64）、IPv4-compatible `::a.b.c.d`、`224.0.0.0/4`（组播）、`240.0.0.0/4`、`192.0.0.0/24`、`198.18.0.0/15`
- **出站请求固定 IP（S6）**：新增 `pinnedFetch`（校验地址 + 固定 IP 连接 + 超时 + 响应上限），Webhook 发送/测试与三个内容安全适配器全部切换——与 URL 导入真正同标准，消除检查后解析 TOCTOU
- **管理员改用户名/角色撤销旧 token（S7）**；**唯一活跃管理员不可自我降级（S8）**
- **Server酱出站补超时（S9）**；**base64 上传先按字符长度估算再解码（S10）**，避免先解码 ~133MB 再检查的内存尖峰

**BUG 修复:**

- **私有并发"死开关"移除（B5）**：`privateApiConfig.maxConcurrent` 从未接线，连同 4 个死函数与配置字段一并删除
- **回收站/审核任务定时清理（B6/B7）**：每日维护任务——软删除超 30 天的媒体自动硬删除、completed/error 审核任务超 7 天清理（此前永久累积）
- **审核覆盖统一（B8）**：登录上传与 URL 导入的审核开关统一读取 `publicApiConfig.contentSafety`（此前登录上传读不存在的 privateApiConfig 字段导致永不审核、URL 导入完全不审核）；管理员 URL 导入不再硬编码 public，与 multipart 一致走默认可见性
- **预审隐藏（B9）**：审核 pending 期间媒体仅所有者/管理员可见（消除"先公开后审核"暴露窗口）；IP 黑名单覆盖登录上传与 URL 导入（此前只挡匿名）
- 统计"检测图片总数"改为只统计真正送检完成的（B10）；视频 poster 不再指向视频自身（B11）；contentSafety.providers 部分提交与现有配置合并（B12）；创建/重置用户密码不再 trim（B13）
- 重复响应头：应用层保留 `X-Content-Type-Options`，nginx 层去除（部署项）

**代码清理:**

- 删除 0 引用的 `server/utils/authMiddleware.js`；`database.js` 恢复 `DEFAULT_MEDIA_CONFIG` 显式 import（消除对 Nitro auto-import 的隐式依赖）

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

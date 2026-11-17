<div align="center">

## OneImg

一个面向个人部署场景的 **统一媒体床**，支持图片与视频的上传、展示、预览、提链与权限管理。

基于 `Nuxt` + `Nitro Server API` + `Pinia` + `NeDB` 构建，当前版本以 **OneImg 的 media 模型** 为唯一标准。

</div>

---

## 项目简介

`OneImg` 是一个围绕 **media** 统一设计的轻量媒体系统，适合个人自部署与小团队内部使用。

它适合以下场景：

- **个人自部署媒体床**
- **统一管理图片与视频资源**
- **需要简单账号权限控制的上传系统**
- **希望获得清晰权限与归属模型的媒体服务**

## 当前版本特性

### 媒体能力

- 支持图片与视频统一上传
- 支持点击、拖拽、粘贴、本地多文件上传
- 支持单个 URL 导入与批量 URL 导入
- 支持首页混合媒体瀑布墙展示
- 支持图片查看与视频播放预览
- 支持批量提取以下格式链接：
  - 原始直链
  - Markdown
  - HTML
  - BBCode

### 权限能力

- 支持三级身份：
  - **匿名访客**
  - **普通用户**
  - **管理员**
- 匿名上传开关可由管理员控制
- 普通用户默认只能管理自己的媒体
- 管理员可管理全部媒体、用户、配置与黑名单
- 支持登录鉴权与 API Key 上传调用
- **用户是资源 owner，API Key 只是上传凭证**

### 上传策略

管理员可配置：

- 是否允许匿名公开上传
- 允许上传的媒体扩展名
- 匿名 / 普通用户 / 管理员的上传大小限制
- 登录用户默认上传可见性

服务端会统一校验：

- 扩展名
- MIME 类型
- 文件大小
- 上传身份与角色权限
- 匿名上传是否允许
- 私有媒体是否有访问权限

## 版本定位

当前 `OneImg` 的目标不是兼容历史图片床心智，而是提供一套结构清晰、权限闭环、上传链路完整的统一媒体系统。

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 本地开发

```bash
pnpm dev
```

### 生产构建

```bash
pnpm build
node .output/server/index.mjs
```

### 单机部署建议

推荐用于个人或小规模单机部署，默认使用本地文件与本地数据库目录：

- `db/`
- `uploads/`

建议在生产环境至少配置以下环境变量：

```bash
NODE_ENV=production
JWT_SECRET=请替换为强随机长字符串
PORT=8888
```

推荐的单机运行策略：

- 默认关闭匿名上传，仅在明确需要时开启
- 已登录网页上传使用登录令牌；`API Key` 仅用于外部脚本或第三方工具
- 尽量使用 `multipart/form-data` 上传，避免大体积 base64 请求
- URL 导入仅允许公网 HTTP/HTTPS 资源，系统会拒绝本地和内网地址
- 首次部署后请及时修改初始化管理员密码，并设置站点 `siteUrl`

## 目录结构

- `app/`：前端页面、组件、状态管理
- `server/api/`：后端接口
- `server/utils/`：媒体、鉴权、通知、审核等工具逻辑
- `server/plugins/`：数据库初始化与服务端插件
- `db/`：本地数据库目录
- `uploads/`：本地上传文件目录

## 初始化说明

首次启动时，如果当前没有管理员账户，系统会自动创建临时管理员：

- 用户名：`oneimg-admin`
- 密码：输出在启动日志中

> 建议首次登录后立即修改管理员密码。

## 默认支持格式

### 图片格式

- `jpg`
- `jpeg`
- `png`
- `gif`
- `webp`
- `avif`
- `svg`
- `bmp`
- `ico`
- `apng`
- `tiff`

### 视频格式

- `mp4`
- `webm`
- `mov`

> 实际可上传格式以后台媒体策略配置为准。

## 数据与备份

### 默认目录

开发环境默认使用项目根目录下：

- `db/`
- `uploads/`

### 关键数据文件

- `db/users.db`：用户数据
- `db/images.db`：媒体数据
- `db/settings.db`：系统设置
- `db/apikeys.db`：API Key 数据

### 备份建议

只需备份以下目录：

```bash
db/
uploads/
```

## 当前标准数据模型

系统内部以 `media` 为唯一标准，核心字段包括：

- `uuid`
- `filename`
- `originalName`
- `format`
- `mimeType`
- `mediaType`
- `size`
- `width`
- `height`
- `duration`
- `visibility`
- `ownerId`
- `ownerName`
- `ownerRole`
- `uploadedByType`
- `apiKeyId`
- `isDeleted`
- `isNsfw`
- `moderationStatus`

## 推荐验收清单

- 匿名上传开关是否正常
- 图片与视频上传是否正常
- 私有媒体直链权限是否正常
- 批量提链是否正常
- API Key 是否绑定到真实用户
- 管理员是否可管理全部媒体、用户与配置

## 已知说明

- 当前内容安全流程主要针对**图片内容**生效
- 当前版本重点是稳定性、权限正确性和一致性
- 数据文件名仍沿用 `images.db`，但业务模型统一为 `media`

## 隐私与出站行为（务必阅读）

- **内容安全检测会把图片发送到第三方服务**（nsfwdet.com 或自建 nsfw_detector）。涉及隐私的图片请勿开启，或自建检测服务。
- **部署提醒**：审核提供商故障时媒体保持隐藏（fail-close），不会重新公开待审内容。
- **URL 导入**会由服务端向目标地址发起下载请求（出站）；内网/回环/云元数据地址已被强制拒绝。
- **通知渠道**（Webhook/Telegram/邮件/Server酱）由管理员配置，同样禁止指向内网地址；通知密钥在数据库中加密存储。
- URL 导入默认**不再伪造 Referer/Origin** 绕过防盗链；如确需开启，设置环境变量 `ONEIMG_SPOOF_REFERER=1` 并自担合规责任。
- **生产部署请务必在后台配置固定的站点 URL（siteUrl）**，否则外链将依据请求 Host 头推断，存在被污染的风险。

### JWT 存储说明

当前 JWT 存储于 `localStorage`（有效期 7 天）。CSP nonce + 公告白名单净化已将 XSS 面压到极小；
若需纵深防御（如高安全场景），可评估迁移为 httpOnly cookie（需前后端配合改造）。

## 环境变量参考

| 变量 | 说明 |
|---|---|
| `JWT_SECRET` | JWT 签名密钥（不设则自动生成并持久化到数据库） |
| `ONEIMG_SECRET_KEY` | 通知密钥等敏感配置的加密主密钥（不设则从 jwtSecret 派生） |
| `ONEIMG_DATA_DIR` | 覆盖数据/上传目录（默认 `/app/db`、`/app/uploads`） |
| `ONEIMG_SPOOF_REFERER` | `1` 时 URL 导入伪造目标站 Referer（默认关闭） |
| `NSFWDET_API_KEY` | nsfwdet 检测服务密钥（仅服务端） |
| `TELEGRAM_API_URL` | Telegram Bot API 反代地址 |

## 常见问题

### 如何重置管理员？

备份后删除 `db/users.db`，重启服务即可重新初始化管理员。

### 为什么数据库里还是 `images.db`？

这是底层存储文件名，当前业务模型和权限语义都已经按 `media` 工作。

## 开源协议

本项目使用 [Apache License 2.0](LICENSE)。

# 构建阶段
FROM node:20-alpine AS builder

# 安装 pnpm（固定版本，保证构建可复现）
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# 设置工作目录
WORKDIR /app

# 复制包管理文件
COPY package.json pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建应用
RUN pnpm build

# 生产阶段
FROM node:20-alpine AS production

# 设置工作目录
WORKDIR /app

# 从构建阶段复制构建产物
COPY --from=builder /app/.output ./.output

# 暴露端口
EXPOSE 8888

# 设置环境变量
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8888

# 健康检查（与 docker-compose.yml 的 PORT 保持一致）
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8888/api/settings/public || exit 1

# 非特权用户运行
USER node

# 启动应用
CMD ["node", ".output/server/index.mjs"]
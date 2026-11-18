#!/bin/bash
# OneImg 每日备份：NeDB 数据文件 + uploads 增量同步
# 用法：加入 crontab，如 `0 3 * * * /home/oneimg-test/scripts/backup.sh`
set -euo pipefail

DATA_DIR="${ONEIMG_DATA_DIR:-/app}"
BACKUP_ROOT="${BACKUP_ROOT:-/root/oneimg-backups}"
DATE=$(date +%Y%m%d_%H%M%S)
KEEP_DAYS=7

mkdir -p "$BACKUP_ROOT/$DATE"

# 数据库文件快照（NeDB 是 append-only 单文件，直接拷贝即可）
cp -a "$DATA_DIR/db/"*.db "$BACKUP_ROOT/$DATE/" 2>/dev/null || true

# uploads 增量同步（rsync --link-dest 做硬链接快照，省空间）
if [ -d "$DATA_DIR/uploads" ]; then
  PREV=$(ls -1t "$BACKUP_ROOT" | grep -v "$DATE" | head -1 || true)
  if [ -n "$PREV" ] && [ -d "$BACKUP_ROOT/$PREV/uploads" ]; then
    rsync -a --link-dest="$BACKUP_ROOT/$PREV/uploads" "$DATA_DIR/uploads/" "$BACKUP_ROOT/$DATE/uploads/"
  else
    rsync -a "$DATA_DIR/uploads/" "$BACKUP_ROOT/$DATE/uploads/"
  fi
fi

# 清理过期备份
find "$BACKUP_ROOT" -maxdepth 1 -type d -name "20*" -mtime +$KEEP_DAYS -exec rm -rf {} + 2>/dev/null || true

echo "[$(date)] 备份完成: $BACKUP_ROOT/$DATE"

#!/bin/sh
# Git权限修复脚本 - 用于跨平台开发环境

echo "🔧 开始修复Git权限配置..."

# 设置核心配置
git config core.filemode false
git config core.autocrlf input
git config core.symlinks true
git config core.ignorecase false

echo "✅ Git核心配置已更新"

# 确保脚本文件有执行权限
if [ -f "scripts/docker-entrypoint.sh" ]; then
    chmod +x scripts/docker-entrypoint.sh
fi

if [ -f "scripts/build.sh" ]; then
    chmod +x scripts/build.sh
fi

if [ -f "scripts/start.sh" ]; then
    chmod +x scripts/start.sh
fi

echo "✅ 脚本文件权限已修复"

# 重新规范化所有文件的行结束符
git add . && git add -u
git commit -m "Fix: Normalize line endings and permissions for cross-platform compatibility" --allow-empty

echo "🎉 跨平台权限配置完成！"
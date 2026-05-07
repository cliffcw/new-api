# bella-api 分支开发与部署流程

本文档定义本项目在 `bella-api` 分支上的固定工作流：本地开发与验证 → 推送到 GitHub → 部署到远程服务器 `47.84.55.119`（systemd 常驻，非 Docker）。

## 约定

- 只在 `bella-api` 分支开发与发布
- 远程仓库（部署分支来源）：`git@github.com:cliffcw/new-api.git`
  - 本地 remote 名称约定为：`cliff`
- 远程服务器：
  - SSH：`root@47.84.55.119`
  - 服务目录：`/opt/new-api`
  - 环境文件：`/etc/new-api/new-api.env`
  - systemd 服务：`new-api.service`
  - 监听端口：`3000`
- 口令与安全：
  - 不要把服务器密码写进脚本或 Git
  - 本机通过环境变量 `ALY_PASSWORD` 给 `sshpass` 使用（不要回显）

## 一次完整发布（本地 → GitHub → 服务器）

### 1) 确认分支与远程

```bash
cd /Users/diudiu/Projects/new-api
git checkout bella-api
git pull --ff-only cliff bella-api
```

可选：如果需要同步上游改动（上游为 `origin=https://github.com/QuantumNous/new-api.git`），先在本地合并验证后再推 `cliff`。

### 2) 本地开发

- 修改代码与配置
- 确保不会引入敏感信息（Key、密码、Token 等）到仓库

### 3) 本地验证（最少集）

后端：

```bash
cd /Users/diudiu/Projects/new-api
go test ./...
```

前端（default 主题产物会被嵌入二进制，部署前必须 build）：

```bash
cd /Users/diudiu/Projects/new-api/web/default
npm install
npm run build
npm run typecheck
```

### 4) 提交并推送到 GitHub（cliff/bella-api）

```bash
cd /Users/diudiu/Projects/new-api
git status
git add -A
git commit -m "feat: <summary>"
git push cliff bella-api
```

### 5) 构建 Linux 二进制（amd64）并上传服务器

远端机器为 `x86_64`，因此使用 `GOARCH=amd64`。

```bash
cd /Users/diudiu/Projects/new-api
mkdir -p ./dist-new-api-linux-amd64
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o ./dist-new-api-linux-amd64/new-api .
```

上传：

```bash
sshpass -p "$ALY_PASSWORD" scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  ./dist-new-api-linux-amd64/new-api root@47.84.55.119:/opt/new-api/new-api
```

### 6) 远端重启并自检

```bash
sshpass -p "$ALY_PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  root@47.84.55.119 'bash -s' <<'EOF'
set -e

chmod +x /opt/new-api/new-api
systemctl restart new-api

for i in {1..40}; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/ || true)
  if [ "$code" = "200" ]; then echo ok; exit 0; fi
  sleep 1
done

echo start_failed
systemctl --no-pager --full status new-api | head -n 120
exit 1
EOF
```

完成后访问：

- `http://47.84.55.119:3000/`

## 服务器首次初始化（只做一次）

如果服务器上没有 `new-api.service` 或目录尚未创建，按以下初始化：

```bash
sshpass -p "$ALY_PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  root@47.84.55.119 'bash -s' <<'EOF'
set -e

mkdir -p /opt/new-api /opt/new-api/data /opt/new-api/logs /etc/new-api

SESSION_SECRET=$(openssl rand -hex 32)
CRYPTO_SECRET=$(openssl rand -hex 32)

cat >/etc/new-api/new-api.env <<ENVEOF
TZ=Asia/Shanghai
PORT=3000
SESSION_SECRET=${SESSION_SECRET}
CRYPTO_SECRET=${CRYPTO_SECRET}
SQLITE_PATH=/opt/new-api/data/one-api.db?_busy_timeout=30000
ENVEOF

cat >/etc/systemd/system/new-api.service <<SERVICEEOF
[Unit]
Description=New API
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/new-api
EnvironmentFile=/etc/new-api/new-api.env
ExecStart=/opt/new-api/new-api
Restart=always
RestartSec=3
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
SERVICEEOF

systemctl daemon-reload
systemctl enable --now new-api
EOF
```

## 回滚

### 回滚到上一个二进制（推荐做法）

- 在覆盖 `/opt/new-api/new-api` 前先备份：

```bash
sshpass -p "$ALY_PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  root@47.84.55.119 'cp -f /opt/new-api/new-api /opt/new-api/new-api.bak.$(date +%Y%m%d%H%M%S) || true'
```

- 回滚时把备份文件覆盖回去并重启：

```bash
sshpass -p "$ALY_PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  root@47.84.55.119 'ls -1t /opt/new-api/new-api.bak.* | head -n 1'
```

把输出的备份文件名替换到下面命令中：

```bash
sshpass -p "$ALY_PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  root@47.84.55.119 'cp -f /opt/new-api/new-api.bak.<timestamp> /opt/new-api/new-api && systemctl restart new-api'
```

### 按 commit 回滚再发布

```bash
cd /Users/diudiu/Projects/new-api
git checkout bella-api
git log --oneline -n 20
git reset --hard <commit>
git push --force-with-lease cliff bella-api
```

然后按“发布步骤”重新构建与部署。

## 排错

- 看服务状态：
  - `systemctl status new-api --no-pager --full`
- 看日志：
  - `journalctl -u new-api -n 200 --no-pager`
- 看端口：
  - `ss -ltnp '( sport = :3000 )'`

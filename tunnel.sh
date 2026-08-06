#!/usr/bin/env bash
# Named Cloudflare Tunnel setup + run for the video player.
#
#   bash tunnel.sh                          # create/config route DNS and run
#   TUNNEL_HOSTNAME=video.example.com bash tunnel.sh   # skip the hostname prompt
#
# Requirements: cloudflared installed (`pkg install cloudflared`) and a
# Cloudflare account with the domain's DNS managed by Cloudflare.

set -euo pipefail

TUNNEL_NAME="${TUNNEL_NAME:-videohub}"
CONFIG_DIR="${HOME}/.cloudflared"
CONFIG_FILE="${CONFIG_DIR}/${TUNNEL_NAME}.yml"
SUBDOMAIN="${TUNNEL_HOSTNAME:-}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "✗ cloudflared chưa được cài. Chạy: pkg install cloudflared"
  exit 1
fi

echo "==> Đăng nhập Cloudflare (mở trình duyệt để xác nhận)…"
cloudflared tunnel login

echo "==> Tạo Named Tunnel '${TUNNEL_NAME}' (bỏ qua nếu đã có)…"
cloudflared tunnel create "${TUNNEL_NAME}" >/dev/null 2>&1 || echo "   Tunnel đã tồn tại."

if [ -z "${SUBDOMAIN}" ]; then
  read -rp "Nhập hostname (ví dụ: video.example.com): " SUBDOMAIN
fi
SUBDOMAIN="$(echo "${SUBDOMAIN}" | tr -d '[:space:]')"
if [ -z "${SUBDOMAIN}" ]; then
  echo "✗ Chưa nhập hostname."
  exit 1
fi

echo "==> Ghi cấu hình ${CONFIG_FILE}…"
mkdir -p "${CONFIG_DIR}"
cat > "${CONFIG_FILE}" <<EOF
tunnel: ${TUNNEL_NAME}
credentials-file: ${CONFIG_DIR}/${TUNNEL_NAME}.json

ingress:
  - hostname: ${SUBDOMAIN}
    service: http://localhost:3000
  - service: http_status:404
EOF

echo "==> Trỏ DNS ${SUBDOMAIN} tới tunnel…"
cloudflared tunnel route dns "${TUNNEL_NAME}" "${SUBDOMAIN}"

echo "==> Đang chạy tunnel ${TUNNEL_NAME} → https://${SUBDOMAIN} (Ctrl+C để dừng)…"
cloudflared tunnel --config "${CONFIG_FILE}" run "${TUNNEL_NAME}"

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
if cloudflared tunnel list 2>/dev/null | grep -q "${TUNNEL_NAME}"; then
  echo "   Tunnel đã tồn tại."
else
  cloudflared tunnel create "${TUNNEL_NAME}" 2>&1 | while IFS= read -r line; do echo "   ${line}"; done
fi

# cloudflared tạo credentials file theo UUID, không phải theo tên tunnel.
# Copy file credentials thực tế thành <tunnel-name>.json nếu chưa có.
CANDIDATE=$(ls -t "${CONFIG_DIR}"/*.json 2>/dev/null | head -1)
EXPECTED="${CONFIG_DIR}/${TUNNEL_NAME}.json"
if [ -n "${CANDIDATE}" ] && [ ! -f "${EXPECTED}" ]; then
  cp "${CANDIDATE}" "${EXPECTED}"
  echo "   Đã copy credentials → ${EXPECTED}"
fi

if [ -z "${SUBDOMAIN}" ]; then
  read -rp "Nhập hostname (ví dụ: video.example.com): " SUBDOMAIN
fi
SUBDOMAIN="$(echo "${SUBDOMAIN}" | tr -d '[:space:]')"
if [ -z "${SUBDOMAIN}" ]; then
  echo "✗ Chưa nhập hostname."
  exit 1
fi

EXPECTED="${CONFIG_DIR}/${TUNNEL_NAME}.json"
if [ -f "${EXPECTED}" ] && [ -f "${CONFIG_FILE}" ]; then
  echo "==> Đã có cấu hình ${CONFIG_FILE} — bỏ qua setup, đang chạy tunnel…"
else
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
  if ! cloudflared tunnel route dns "${TUNNEL_NAME}" "${SUBDOMAIN}" 2>&1 | while IFS= read -r line; do echo "   ${line}"; done; then
    echo ""
    echo "✗ Không thể trỏ DNS. Hãy đảm bảo:"
    echo "   1. Domain ${SUBDOMAIN} đã được thêm vào Cloudflare account."
    echo "   2. Nameservers của domain đã trỏ về Cloudflare."
    echo "   Sau khi DNS sẵn sàng, chạy lại: bash tunnel.sh"
    exit 1
  fi
fi

echo "==> Đang chạy tunnel ${TUNNEL_NAME} → https://${SUBDOMAIN} (Ctrl+C để dừng)…"
cloudflared tunnel --config "${CONFIG_FILE}" run "${TUNNEL_NAME}"

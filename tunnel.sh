#!/usr/bin/env bash
# Cloudflare Tunnel setup + run for the video player.
# Supports both Quick Tunnel (free, no account) and Named Tunnel with DuckDNS (free DDNS).
#
#   bash tunnel.sh                              # interactive setup
#   TUNNEL_HOSTNAME=videohubhuy.duckdns.org bash tunnel.sh  # skip hostname prompt
#   DUCKDNS_TOKEN=... DUCKDNS_DOMAIN=... bash tunnel.sh    # auto-update DuckDNS

set -euo pipefail

TUNNEL_NAME="${TUNNEL_NAME:-videohub}"
CONFIG_DIR="${HOME}/.cloudflared"
CONFIG_FILE="${CONFIG_DIR}/${TUNNEL_NAME}.yml"
SUBDOMAIN="${TUNNEL_HOSTNAME:-}"

# Đọc biến môi trường từ .env (nếu có) — không đưa file này lên git.
ENV_FILE="${CONFIG_DIR}/.env"
if [ -f "${ENV_FILE}" ]; then
  set -a
  source "${ENV_FILE}"
  set +a
fi

DUCKDNS_TOKEN="${DUCKDNS_TOKEN:-}"
DUCKDNS_DOMAIN="${DUCKDNS_DOMAIN:-}"

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

# Nếu có DuckDNS token + domain, tự động update DDNS.
if [ -n "${DUCKDNS_TOKEN}" ] && [ -n "${DUCKDNS_DOMAIN}" ]; then
  echo "==> Cập nhật DuckDNS ${DUCKDNS_DOMAIN}…"
  DUCKDNS_IP=$(curl -s "https://www.duckdns.org/update?domains=${DUCKDNS_DOMAIN}&token=${DUCKDNS_TOKEN}&ip=")
  echo "   DuckDNS response: ${DUCKDNS_IP}"
  if [ "${DUCKDNS_IP}" != "OK" ]; then
    echo "   ⚠ DuckDNS update có thể thất bại — kiểm tra token và domain."
  fi
  SUBDOMAIN="${DUCKDNS_DOMAIN}"
fi

if [ -z "${SUBDOMAIN}" ]; then
  read -rp "Nhập hostname (ví dụ: video.example.com hoặc videohubhuy.duckdns.org): " SUBDOMAIN
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
    echo "⚠ Không thể trỏ DNS qua Cloudflare (domain có thể không nằm trên Cloudflare)."
    echo "   Tunnel vẫn chạy — dùng Quick Tunnel URL tạm thời:"
    echo "   cloudflared tunnel --url http://localhost:3000"
    echo "   Hoặc đảm bảo domain đã thêm vào Cloudflare và nameserver trỏ về Cloudflare."
  fi
fi

echo "==> Đang chạy tunnel ${TUNNEL_NAME} → https://${SUBDOMAIN} (Ctrl+C để dừng)…"
cloudflared tunnel --config "${CONFIG_FILE}" run "${TUNNEL_NAME}"
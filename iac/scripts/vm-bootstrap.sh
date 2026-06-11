#!/usr/bin/env bash
# Idempotent VM bootstrap (Docker + Caddy + firewall) for Oracle Linux 9.
set -euo pipefail

APP_DOMAIN="${APP_DOMAIN:-}"
ORIGIN_HOST="${ORIGIN_HOST:-}"

install_docker() {
  echo "Installing Docker (Oracle Linux / dnf)..."
  sudo dnf install -y dnf-plugins-core
  sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo || true
  sudo rpm --import https://download.docker.com/linux/centos/gpg
  sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo systemctl enable --now docker
  sudo usermod -aG docker opc
}

if ! command -v docker >/dev/null 2>&1; then
  install_docker
elif ! docker compose version >/dev/null 2>&1; then
  install_docker
fi

sudo systemctl enable --now firewalld 2>/dev/null || true
sudo firewall-cmd --permanent --add-service=ssh 2>/dev/null || true
sudo firewall-cmd --permanent --add-service=http 2>/dev/null || true
sudo firewall-cmd --permanent --add-service=https 2>/dev/null || true
sudo firewall-cmd --reload 2>/dev/null || true

if ! command -v caddy >/dev/null 2>&1; then
  echo "Installing Caddy..."
  sudo dnf install -y dnf-plugins-core
  sudo dnf copr enable -y @caddy/caddy
  sudo dnf install -y caddy
fi

if [ -n "$APP_DOMAIN" ]; then
  if [ -z "$ORIGIN_HOST" ] && [ -n "$APP_DOMAIN" ]; then
    ORIGIN_HOST="origin-${APP_DOMAIN%%.*}.${APP_DOMAIN#*.}"
  fi
  sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
http://${APP_DOMAIN} {
    reverse_proxy 127.0.0.1:3000
}

http://${ORIGIN_HOST} {
    reverse_proxy 127.0.0.1:3000
}

:80 {
    reverse_proxy 127.0.0.1:3000
}
EOF
else
  sudo tee /etc/caddy/Caddyfile >/dev/null <<'EOF'
:80 {
    reverse_proxy 127.0.0.1:3000
}
EOF
fi

sudo systemctl enable --now caddy
sudo systemctl reload caddy 2>/dev/null || sudo systemctl restart caddy

docker --version
docker compose version
caddy version

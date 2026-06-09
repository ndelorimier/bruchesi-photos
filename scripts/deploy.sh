#!/bin/bash
# Usage: ./scripts/deploy.sh user@nas-ip
# Déploie l'app sur le NAS Synology via SSH + rsync

set -e
TARGET=$1
REMOTE_DIR="/volume1/docker/bruchesi-photos"

if [ -z "$TARGET" ]; then
  echo "Usage: $0 user@nas-ip"
  exit 1
fi

echo "==> Sync files vers $TARGET:$REMOTE_DIR"
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.env' \
  --exclude='pwa/dist' --exclude='api/node_modules' --exclude='pwa/node_modules' \
  ./ "$TARGET:$REMOTE_DIR/"

echo "==> Build PWA sur le NAS"
ssh "$TARGET" "cd $REMOTE_DIR/pwa && npm ci && npm run build && cp -r dist ../pwa_dist/ 2>/dev/null || mkdir -p ../pwa_dist && cp -r dist/* ../pwa_dist/"

echo "==> Docker Compose up"
ssh "$TARGET" "cd $REMOTE_DIR && docker-compose pull compreface postgres 2>/dev/null; docker-compose up -d --build app nginx"

echo ""
echo "✅ Done! App disponible sur le NAS."
echo "   Pour vérifier: ssh $TARGET 'cd $REMOTE_DIR && docker-compose ps'"

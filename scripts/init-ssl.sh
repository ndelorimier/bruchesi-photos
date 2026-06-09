#!/bin/bash
# Usage: ./scripts/init-ssl.sh user@nas-ip ton-domaine.com admin@email.com
# Génère un certificat Let's Encrypt sur le NAS via certbot Docker
#
# Pour tests locaux sans domaine, utilise un certificat auto-signé :
#   ssh admin@NAS_IP "mkdir -p /volume1/docker/bruchesi-photos/nginx/ssl && \
#     openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
#     -keyout /volume1/docker/bruchesi-photos/nginx/ssl/privkey.pem \
#     -out /volume1/docker/bruchesi-photos/nginx/ssl/fullchain.pem \
#     -subj '/CN=localhost'"

set -e
TARGET=$1
DOMAIN=$2
EMAIL=$3
REMOTE_DIR="/volume1/docker/bruchesi-photos"

if [ -z "$TARGET" ] || [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "Usage: $0 user@nas-ip domaine.com admin@email.com"
  echo ""
  echo "Pour un certificat auto-signé (tests locaux):"
  echo "  ssh \$TARGET \"mkdir -p $REMOTE_DIR/nginx/ssl && \\"
  echo "    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\"
  echo "    -keyout $REMOTE_DIR/nginx/ssl/privkey.pem \\"
  echo "    -out $REMOTE_DIR/nginx/ssl/fullchain.pem \\"
  echo "    -subj '/CN=localhost'\""
  exit 1
fi

echo "==> Génération certificat Let's Encrypt pour $DOMAIN"
ssh "$TARGET" "docker run --rm \
  -v $REMOTE_DIR/nginx/ssl:/etc/letsencrypt \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  --email $EMAIL --agree-tos --no-eff-email \
  -d $DOMAIN"

echo ""
echo "✅ Certificat généré dans nginx/ssl/live/$DOMAIN/"
echo "   Chemins dans nginx.conf :"
echo "   ssl_certificate /etc/nginx/ssl/live/$DOMAIN/fullchain.pem;"
echo "   ssl_certificate_key /etc/nginx/ssl/live/$DOMAIN/privkey.pem;"
echo ""
echo "==> Redémarrage nginx"
ssh "$TARGET" "cd $REMOTE_DIR && docker-compose restart nginx"
echo "✅ Nginx redémarré — https://$DOMAIN est opérationnel"

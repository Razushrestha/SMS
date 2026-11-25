# Namecheap VPS — meroauction.com

Host **Postgres + Nest API + Next.js** on one Ubuntu VPS. Public names:

| Host | Role |
|------|------|
| `sms.meroauction.com` | School + platform web |
| `api.meroauction.com` | Nest API (`/api/...`) |

Do **not** point the auction site root `@` at this stack unless you want SMS on `meroauction.com` itself.

## DNS (Namecheap)

A records to the VPS IPv4:

- `sms` → VPS IP  
- `api` → VPS IP  

## Server

Ubuntu 22.04/24.04, 4 GB RAM preferred. As root:

```bash
apt update && apt install -y nginx certbot python3-certbot-nginx ufw postgresql postgresql-contrib
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
```

Do not open 3000, 4000, or 5432.

```bash
adduser --system --group --home /var/www/nepatronix-sms nepatronix
```

## Postgres (host install, systemd path)

```bash
sudo -u postgres psql -c "CREATE USER nepatronix WITH PASSWORD 'same-as-POSTGRES_PASSWORD-in-env';"
sudo -u postgres psql -c "CREATE DATABASE nepatronix OWNER nepatronix;"
```

Keep `listen_addresses = 'localhost'` in PostgreSQL.

## App

```bash
git clone https://github.com/Razushrestha/SMS.git /var/www/nepatronix-sms
cd /var/www/nepatronix-sms
cp .env.vps.example .env
# edit passwords, then:
chown -R nepatronix:nepatronix /var/www/nepatronix-sms
sudo -u nepatronix npm ci
sudo -u nepatronix npm run db:migrate
sudo -u nepatronix npm run build
```

Copy units and nginx:

```bash
cp deploy/nepatronix-api.service deploy/nepatronix-web.service /etc/systemd/system/
cp deploy/nginx-sms.meroauction.com.conf /etc/nginx/sites-available/sms.meroauction.com
cp deploy/nginx-api.meroauction.com.conf /etc/nginx/sites-available/api.meroauction.com
ln -s /etc/nginx/sites-available/sms.meroauction.com /etc/nginx/sites-enabled/
ln -s /etc/nginx/sites-available/api.meroauction.com /etc/nginx/sites-enabled/
nginx -t
```

Certificates (HTTP server blocks first; comment SSL server{} until certs exist, or use certbot nginx plugin after a temporary HTTP-only proxy):

```bash
mkdir -p /var/www/certbot
certbot --nginx -d sms.meroauction.com -d api.meroauction.com
systemctl daemon-reload
systemctl enable --now nepatronix-api nepatronix-web
systemctl reload nginx
```

If certbot cannot read the SSL paths yet, enable only the `listen 80` servers, obtain certs, then enable the `443` blocks.

## Docker alternative

Uses bundled Postgres instead of apt PostgreSQL. Do not run both.

```bash
cd /var/www/nepatronix-sms
cp .env.vps.example .env
# For Docker, DATABASE_URL in .env is overridden to the postgres service.
docker compose -f docker-compose.vps.yml --env-file .env up --build -d
docker compose -f docker-compose.vps.yml exec api sh -c "cd /app && npm run db:migrate"
```

nginx still fronts `127.0.0.1:3000` and `127.0.0.1:4000`.

## Checks

```bash
curl -sS https://api.meroauction.com/api/health
curl -sS https://api.meroauction.com/api/ready
```

Open `https://sms.meroauction.com/login`. Platform: `/platform`.

RFID ingest: `https://api.meroauction.com/api/rfid/ingest`  
GPS ingest: `https://api.meroauction.com/api/gps/points`

## Backup

```bash
chmod +x deploy/backup-db.sh
# crontab -e  (as root)
0 2 * * * /var/www/nepatronix-sms/deploy/backup-db.sh
```

Copy `/var/backups/nepatronix` off the VPS.

## Update

```bash
cd /var/www/nepatronix-sms
sudo -u nepatronix git pull
sudo -u nepatronix npm ci
sudo -u nepatronix npm run db:migrate
sudo -u nepatronix npm run build
systemctl restart nepatronix-api nepatronix-web
```

Run a **single** API process. Caches, rate limits, and jobs are in-memory.

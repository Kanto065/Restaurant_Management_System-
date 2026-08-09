# Production deployment (Contabo VPS)

One-time VPS setup:

```bash
# Docker + compose plugin
curl -fsSL https://get.docker.com | sh

# Clone the repo (or let the CD pipeline do this — see .github/workflows/deploy.yml)
git clone https://github.com/Kanto065/Restaurant_Management_System-.git /opt/platform
cd /opt/platform/deploy
cp .env.example .env
# edit .env with real secrets — never commit this file

docker compose -f docker-compose.prod.yml up -d --build
```

Nightly backups (add to root's crontab, `crontab -e`):

```
0 3 * * * BACKUP_DIR=/var/backups/platform-postgres /opt/platform/deploy/backup-postgres.sh >> /var/log/platform-backup.log 2>&1
```

Ship `/var/backups/platform-postgres` off-box on a separate schedule (rsync/rclone to
another provider) — a backup that only lives on the same VPS as the primary isn't a backup.

Redeploying (also what the GitHub Actions deploy job runs):

```bash
cd /opt/platform && git pull
cd deploy && docker compose -f docker-compose.prod.yml up -d --build
```

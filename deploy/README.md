# Production deployment (Contabo VPS)

## CI/CD

Branching: work happens on `feature/<name>` branches. Merging into `deploy`
triggers `.github/workflows/deploy.yml`, which runs the full CI suite
(`.github/workflows/ci.yml` — backend build+test, admin-frontend build+lint)
as a prerequisite job, and only SSHes into the VPS to redeploy if every test
passes. `main` stays the default/integration branch; merge `deploy` back into
`main` (or vice versa) to keep them in sync however you prefer.

Before the deploy job can run, add these as **repository secrets** (Settings
-> Secrets and variables -> Actions), ideally scoped to a `production`
[environment](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
so you can require manual approval before it fires:

| Secret | Value |
|---|---|
| `VPS_HOST` | `169.58.119.208` (or the VPS's current IP/hostname) |
| `VPS_SSH_USER` | A dedicated deploy user — **not** `root` (see below) |
| `VPS_SSH_PRIVATE_KEY` | Private half of an SSH keypair authorized for that user |
| `VPS_DEPLOY_PATH` | e.g. `/opt/platform` — where the repo is cloned on the VPS |

**Do not use the root password from `vps.txt` for automated deploys.** Create
a dedicated non-root user with passwordless `docker` access instead:

```bash
# on the VPS, as root, one-time setup
adduser deploy
usermod -aG docker deploy
mkdir -p /home/deploy/.ssh
# paste the PUBLIC half of a new keypair generated on your machine into:
# /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh && chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
```
Then set `VPS_SSH_PRIVATE_KEY` to the matching private key and `VPS_SSH_USER`
to `deploy`. Rotate the VPS root password (the one currently sitting in
`vps.txt`) once this is set up, since that file was shared in plaintext.


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

## UAT environment

A second, fully isolated stack (own Postgres, own MinIO, own volumes) runs
alongside production on the **same VPS**, deployed from a separate clone at
`/home/deploy/platform-uat` tracking the `uat` branch (push to `uat` triggers
`.github/workflows/deploy-uat.yml`, mirroring how `deploy` works for
production). It lives under the `deploy` user's home directory rather than
`/opt` because `/opt` is root-owned and the `deploy` user deliberately has no
sudo access (see the CI/CD setup above) — no functional difference, just a
different parent directory. It serves `uat.porttennanttandoori.co.uk`,
`adminuat.porttennanttandoori.co.uk`, and
`apiuat.porttennanttandoori.co.uk`.

**Why UAT has no Caddy of its own**: only one process can bind ports 80/443 on
the VPS, so production's Caddy (`docker-compose.prod.yml`) is the sole TLS
terminator for both stacks. It reaches UAT's containers (`uat-postgres`,
`uat-minio`, `uat-api`, `uat-admin-frontend`, `uat-storefront` — service keys
*and* `container_name`s are prefixed `uat-`, not just plain `api`/`minio`/etc,
so their DNS aliases never collide with prod's own) by joining them all
directly to prod's existing `internal` network, declared `external: true,
name: platform_internal` in `docker-compose.uat.yml`.

**Do not give any container here (or Caddy) a second network to bridge
stacks with — even a purpose-built one.** An earlier version of this setup
used a separate shared `platform-edge` network so Caddy and UAT's containers
could each keep their own private per-stack network too. Confirmed live on
this VPS (2026-09-05, broke production admin login): a container attached to
**more than one** Docker bridge network silently corrupts/strips certain
outbound HTTP response headers (`Access-Control-*`/`Vary` specifically) -
reproduced with disposable containers regardless of which side of a
reverse-proxied request was the dual-homed one, and regardless of which of
its networks was used for the connection. This is a host-level Docker/kernel
networking quirk, not a Caddy or app bug - the only reliable fix found was
eliminating dual-homing entirely. Every container both stacks use must stay
on `platform_internal` and nothing else. This does mean UAT's Postgres/MinIO
are reachable (not just discoverable by name) from prod's containers on that
network and vice versa - not perfectly isolated at the network level, only by
distinct credentials/container names. Acceptable trade-off given the
alternative reproduced a production outage; revisit if this VPS's kernel/
Docker version ever gets upgraded and the underlying bug might be gone.

**Caddyfile changes still ship through the normal production pipeline.** Even
though a change might only add or touch a UAT route, the Caddyfile lives in
`docker-compose.prod.yml`'s world and is only picked up when production's
`caddy` container is recreated — i.e. by pushing to `deploy`, same as any
other Caddyfile edit (see the `--force-recreate caddy` gotcha above).

Bringing up UAT for the first time or after a reset:

```bash
cd /home/deploy/platform-uat/deploy
cp .env.example .env.uat   # then edit: distinct passwords/keys, and Stripe
                            # TEST-mode keys only - UAT must never hold live keys
docker compose -f docker-compose.uat.yml --env-file .env.uat up -d --build
```

Backing up UAT's database (the default `backup-postgres.sh` values target
production's container/db names, so always override them explicitly for UAT):

```bash
POSTGRES_CONTAINER=uat-postgres POSTGRES_DB=platform_uat \
  POSTGRES_USER=platform_uat BACKUP_DIR=/var/backups/platform-uat-postgres \
  /home/deploy/platform-uat/deploy/backup-postgres.sh
```

## Console Instance Provisioning Hook

To enable real "New Instance" provisioning from the console backend:

1. Deploy `scripts/provision-instance.sh` to the server at:
   `/srv/zawadi/apps/scripts/provision-instance.sh`
2. Ensure execute permission:
   `chmod +x /srv/zawadi/apps/scripts/provision-instance.sh`
3. Set in `/srv/zawadi/apps/.env.console`:
   `CONSOLE_INSTANCE_PROVISION_SCRIPT=/srv/zawadi/apps/scripts/provision-instance.sh`
4. Restart `zawadi-console` container.

The script expects one JSON argument and provisions a full stack using:
- `/srv/zawadi/apps/docker-compose.stack.yml`
- env files under `/srv/zawadi/apps/env/.zawadi-<slug>.env`

It validates ports, creates secrets, applies Prisma schema, starts containers, and returns JSON.

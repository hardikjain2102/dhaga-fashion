# Conventions (single source of truth)

## Names and ports
- Backend containers and web-ui (nginx-unprivileged) listen on **8080**.
- Every Kubernetes Service is ClusterIP, exposes port **80**, targetPort **8080**.
- Health endpoints on every backend: `GET /healthz` (liveness), `GET /readyz` (readiness).
- Image: `ghcr.io/hardikjain2102/dhaga-<service>:<git-sha>` (never `latest`).
  Example: `ghcr.io/hardikjain2102/dhaga-auth-svc`.

## Namespaces
`ingress-nginx`, `frontend`, `services`, `payments`, `data`

## In-cluster DNS
`<service>.<namespace>.svc.cluster.local`, for example
`http://catalog-svc.services.svc.cluster.local` (port 80).
Data tier: `postgres.data.svc.cluster.local:5432`,
`redis.data.svc.cluster.local:6379`, `rabbitmq.data.svc.cluster.local:5672`.

## Ingress routes (one host, path routing)
| Path | Service |
|---|---|
| `/` | web-ui |
| `/api/auth` | auth-svc |
| `/api/products` | catalog-svc |
| `/api/cart` | cart-svc |
| `/api/orders` | order-svc |
| `/api/payments` | payment-svc |

## Kubernetes labels (every object)
`app=<service>`, `tier=<frontend|backend|data>`, `team=dhaga`,
`env=<dev|prod>`, `version=<git-sha>`. Selectors use `app` only.

## Application roles (JWT `role` claim)
`customer`, `seller`, `admin`. Sellers also carry status `pending|approved|suspended`.

## Environment variables
- Plain settings: ConfigMap. Sensitive values: Secret mounted as a **file**;
  the env var holds the file path and ends in `_PATH`.
- Never commit real values. Each service has a `.env.example` listing names only.

## Code
- TypeScript strict mode, Zod for input validation, pino JSON logs to stdout.
- Log the `x-request-id` header on every request. Never log passwords, tokens
  or payment details.
- Handle SIGTERM gracefully (rolling updates depend on it).

## Git
- `main` is always deployable. Work on feature branches; open a pull request.
- Commit style: `type: summary` (feat, fix, chore, docs, ci).

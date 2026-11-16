# Dhaga Fashion

E-commerce microservices on a 3-node kubeadm Kubernetes cluster
(1 control plane + 2 workers).

| Service | Path | Namespace |
|---|---|---|
| web-ui | frontend/web-ui | frontend |
| auth-svc | services/auth-svc | services |
| catalog-svc | services/catalog-svc | services |
| cart-svc | services/cart-svc | services |
| order-svc | services/order-svc | services |
| notification-svc | services/notification-svc | services |
| payment-svc | services/payment-svc | payments |

Data tier (postgres, redis, rabbitmq) runs in namespace `data`.

See `docs/CONVENTIONS.md` for names, ports, labels and environment variables.

# Docs Master Rollout

This repo's `k8s-master-deployment.yaml` assumes:

- the docs frontend and docs API run in the same `master/docs` pod
- the docs API serves on port `4010`
- Augur base analyses are fetched from `http://kord-api.kord.svc.cluster.local:9091`
- the API key is exposed in the `master` namespace as secret `docs-augur-api`

## 1. Mirror the Augur API key into `master`

The `kord-api-key` secret lives in namespace `kord`. Kubernetes cannot mount that secret directly into pods in `master`, so the key must be copied into a `master`-local secret:

```bash
ssh ottawa-server '
  API_KEY=$(sudo kubectl -n kord get secret kord-api-key -o jsonpath={.data.api-key})
  cat <<EOF | sudo kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: docs-augur-api
  namespace: master
type: Opaque
data:
  api-key: ${API_KEY}
EOF
'
```

## 2. Apply the docs deployment

```bash
scp k8s-master-deployment.yaml ottawa-server:/tmp/k8s-master-deployment.yaml
ssh ottawa-server 'sudo kubectl apply -f /tmp/k8s-master-deployment.yaml'
```

This updates:

- `Deployment/master/docs`
- `Service/master/docs`

The service exposes:

- `80` -> frontend
- `4010` -> docs API sidecar

## 3. Update the workstation Caddy config

Add the docs API route before the broader `docs.khaledkord.com` host handler:

```caddy
  @docs_api {
    host docs.khaledkord.com
    path /api/*
  }
  handle @docs_api {
    uri strip_prefix /api
    reverse_proxy docs.master.svc.cluster.local:4010
  }

  @docs host docs.khaledkord.com
  handle @docs {
    reverse_proxy docs.master.svc.cluster.local:80
  }
```

Apply it on the cluster:

```bash
ssh ottawa-server '
  sudo kubectl -n master get configmap workstation-caddyfile -o yaml > /tmp/workstation-caddyfile.yaml
  ${EDITOR:-vi} /tmp/workstation-caddyfile.yaml
  sudo kubectl apply -f /tmp/workstation-caddyfile.yaml
  sudo kubectl -n master rollout restart deployment/workstation
'
```

## 4. Verify

Cluster-internal:

```bash
ssh ottawa-server '
  sudo kubectl -n master exec deploy/workstation -c caddy -- \
    wget -qO- http://docs.master.svc.cluster.local:4010/health
'
```

Public:

```bash
curl https://docs.khaledkord.com/api/health
curl https://docs.khaledkord.com/api/projects
```

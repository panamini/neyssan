# Grafana Dashboard Deployment Guide

## Service Account Setup
1. In Grafana, navigate to **Administration → Service accounts**
2. Create new service account named "CI/CD Dashboard Deployer"
3. Assign permissions:
   - **Role**: Editor
   - **Custom permissions**: 
     - `dashboards:write`
     - `folders:read`
     - `folders:write`
4. Generate long-lived token with 1 year expiration (or match your security policy)

## CI/CD Configuration
```yaml
# .github/workflows/deploy-dashboards.yml
name: Deploy Grafana Dashboards
on:
  push:
    branches: [main]
    paths:
      - 'monitoring/dashboards/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: grafana/dashboard-updater-action@v2
        with:
          grafana-url: ${{ secrets.GRAFANA_URL }}
          grafana-api-token: ${{ secrets.GRAFANA_SERVICE_ACCOUNT_TOKEN }}
          directory: 'monitoring/dashboards'
          folder-name: 'Convex'
          delete-missing: true
```

##

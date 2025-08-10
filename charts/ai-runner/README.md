# AI Runner Helm Chart

This Helm chart deploys a multi-tenant AI video analytics platform on Kubernetes with autoscaling capabilities.

## Features

- **Multi-tenant architecture** with organization isolation
- **Horizontal Pod Autoscaling** based on CPU, memory, and custom metrics
- **GPU support** for ALPR workloads
- **MediaMTX integration** for RTSP/HLS streaming
- **Monitoring and metrics** with Prometheus
- **Network security** with NetworkPolicies
- **TLS termination** with automatic certificate management

## Components

- **Fusion**: Main orchestrator service
- **MediaMTX**: RTSP/HLS media server
- **Workers**: AI analytics services
  - People Vision
  - Vehicle Vision
  - Safety Vision
  - EduBehavior
  - ALPR (with GPU support)

## Prerequisites

- Kubernetes 1.19+
- Helm 3.0+
- NGINX Ingress Controller
- Cert-Manager (for TLS)
- Prometheus Operator (for monitoring)
- Storage classes: `fast-ssd`

## Installation

1. Create the namespace:
```bash
kubectl create namespace ai-runner
```

2. Create the Supabase secret:
```bash
kubectl create secret generic supabase \
  --from-literal=url="https://your-project.supabase.co" \
  --from-literal=service_key="your-service-role-key" \
  -n ai-runner
```

3. Install the chart:
```bash
helm install ai-runner ./charts/ai-runner -n ai-runner
```

## Configuration

### Core Values

| Parameter | Description | Default |
|-----------|-------------|---------|
| `global.imagePullPolicy` | Image pull policy | `IfNotPresent` |
| `fusion.replicas` | Number of fusion replicas | `2` |
| `mediamtx.replicas` | Number of MediaMTX replicas | `1` |

### Autoscaling

| Parameter | Description | Default |
|-----------|-------------|---------|
| `hpa.enabled` | Enable HPA | `true` |
| `hpa.minReplicas` | Minimum replicas | `1` |
| `hpa.maxReplicas` | Maximum replicas | `10` |
| `hpa.targetCPUUtilizationPercentage` | Target CPU utilization | `70` |

### Ingress

| Parameter | Description | Default |
|-----------|-------------|---------|
| `ingress.enabled` | Enable ingress | `true` |
| `ingress.className` | Ingress class | `nginx` |
| `ingress.hosts[0].host` | Hostname | `api.yourdomain.com` |

### Storage

| Parameter | Description | Default |
|-----------|-------------|---------|
| `storage.models.storageClass` | Storage class for models | `fast-ssd` |
| `storage.models.size` | Size for models PVC | `10Gi` |

## GPU Support

For ALPR workloads requiring GPU:

1. Ensure GPU nodes are available with proper taints/labels
2. Set `nodeAffinity.gpu.enabled: true`
3. Configure the node selector in `nodeAffinity.gpu.nodeSelector`

## Monitoring

The chart includes Prometheus metrics for:
- Service health and availability
- Processing queue lengths
- Resource utilization
- Custom business metrics

## Security

- **Network Policies**: Restrict inter-pod communication
- **RBAC**: Minimal required permissions
- **Pod Security**: Security contexts and policies
- **Secrets**: Sensitive data in Kubernetes secrets

## Scaling Strategies

1. **CPU-based**: Scales based on CPU utilization
2. **Memory-based**: Scales based on memory utilization  
3. **Queue-based**: (Optional) Scales based on processing queue length

## Troubleshooting

### Check pod status:
```bash
kubectl get pods -n ai-runner
```

### View logs:
```bash
kubectl logs -f deployment/ai-runner-fusion -n ai-runner
```

### Check HPA status:
```bash
kubectl get hpa -n ai-runner
```

### Monitor resource usage:
```bash
kubectl top pods -n ai-runner
```

## Upgrading

```bash
helm upgrade ai-runner ./charts/ai-runner -n ai-runner
```

## Uninstalling

```bash
helm uninstall ai-runner -n ai-runner
```
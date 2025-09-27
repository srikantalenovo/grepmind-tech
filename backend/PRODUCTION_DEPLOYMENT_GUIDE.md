# Production Deployment Guide - GrepMind Tech Backend

## 🚀 Production-Grade AI Backend System

This system is designed for **production deployment only** with real model inference. No fallback responses or mock data - strictly production-grade AI services.

## 📋 Prerequisites

### Essential Requirements
- **Node.js 18+** with native compilation support
- **Python 3.8+** for model dependencies
- **C++ Build Tools** for native modules
- **Minimum 4GB RAM** (8GB+ recommended)
- **10GB+ Free Disk Space** for models
- **Stable Internet** for model downloads

### Critical Dependencies
```bash
# Install build tools (Ubuntu/Debian)
sudo apt update
sudo apt install -y build-essential python3-dev python3-pip cmake

# Install build tools (CentOS/RHEL)
sudo yum groupinstall -y "Development Tools"
sudo yum install -y python3-devel cmake

# Install build tools (macOS)
xcode-select --install
brew install cmake
```

## 🛠️ Production Installation

### 1. Clone and Setup
```bash
git clone <repository>
cd grepmind-tech/backend

# Install dependencies with native compilation
npm install --production

# Verify native dependencies
npm list node-llama-cpp
```

### 2. Environment Configuration
```bash
# Create production environment file
cp .env.example .env
```

**Required Environment Variables:**
```env
# Server Configuration
NODE_ENV=production
PORT=5000
HOST=0.0.0.0

# AI Configuration
AI_THREADS=4
REQUIRE_NATIVE_SUPPORT=true
ENABLE_FALLBACK=false

# Security
CORS_ORIGIN=https://yourdomain.com
TRUST_PROXY=true
REQUIRE_HTTPS=true

# Monitoring
ENABLE_METRICS=true
ENABLE_ALERTING=true
INCLUDE_SYSTEM_INFO=false

# Logging
LOG_LEVEL=info
ENABLE_FILE_LOGGING=true
```

### 3. Production Model Setup
```bash
# Ensure model directories exist
mkdir -p models/chat models/llm

# The system will automatically download production models:
# - TinyLlama 1.1B Chat (669MB) for chat service
# - Llama 3.2 3B Instruct (1.9GB) for LLM service
```

## 🔧 Production Deployment

### 1. Docker Deployment (Recommended)
```dockerfile
FROM node:18-alpine

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cmake \
    linux-headers

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/ai/health || exit 1

EXPOSE 5000
CMD ["npm", "start"]
```

### 2. PM2 Production Process Manager
```bash
# Install PM2 globally
npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'grepmind-backend',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    max_memory_restart: '2G',
    node_args: '--max-old-space-size=4096'
  }]
}
EOF

# Start production server
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 3. Nginx Reverse Proxy Configuration
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    location /api/ai/health {
        proxy_pass http://localhost:5000;
        access_log off;
    }
}
```

## 📊 Production Monitoring

### 1. Health Check Endpoints
```bash
# Primary health check
curl https://yourdomain.com/api/ai/health

# Service status
curl https://yourdomain.com/api/ai/status

# Available models
curl https://yourdomain.com/api/ai/models
```

### 2. Expected Health Response
```json
{
  "status": "healthy",
  "healthy": true,
  "productionMode": true,
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600000,
  "checks": {
    "system": { "status": "healthy" },
    "memory": { "status": "healthy" },
    "ai_services": { 
      "status": "healthy",
      "production_ready": true,
      "native_support": true
    },
    "models": {
      "status": "healthy",
      "count": 2,
      "production_ready": true
    }
  }
}
```

### 3. Monitoring Alerts
Set up monitoring for:
- **Memory usage > 80%**
- **Response time > 5 seconds**
- **Error rate > 5%**
- **Model availability**
- **Native support status**

## 🔒 Production Security

### 1. Security Headers
```javascript
// Automatically configured in production mode:
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### 2. Rate Limiting
```javascript
// Production rate limits:
const rateLimits = {
  '/api/ai/chat': '60 requests per 15 minutes',
  '/api/ai/generate': '30 requests per 15 minutes',
  '/api/ai/health': '300 requests per 15 minutes'
};
```

### 3. Input Validation
- **Maximum prompt length: 8000 characters**
- **Request body size limit: 10MB**
- **Content-Type validation**
- **CORS origin restrictions**

## ⚡ Performance Optimization

### 1. Model Configuration
```javascript
const modelConfig = {
  cpuOnly: true,        // CPU-only for broader compatibility
  threads: -1,          // Auto-detect optimal thread count
  contextSize: 4096,    // 4K context window
  batchSize: 512,       // Optimized batch size
  gpuLayers: 0          // No GPU layers for stability
};
```

### 2. Memory Management
- **Automatic garbage collection every 5 minutes**
- **Model cleanup on inactivity**
- **Request queue management**
- **Memory usage monitoring**

### 3. Caching Strategy
- **Response caching disabled** (real-time AI responses)
- **Static asset caching: 1 hour**
- **Health check caching: 30 seconds**

## 🚨 Error Handling & Recovery

### 1. Graceful Degradation
```javascript
// Production error handling:
if (!nativeModelSupport) {
  throw new Error('Production requires native model support');
}

if (!modelAvailable) {
  throw new Error('Production model not available');
}
```

### 2. Circuit Breaker Pattern
- **Failure threshold: 5 errors in 1 minute**
- **Circuit open duration: 60 seconds**
- **Automatic recovery attempts**

### 3. Retry Logic
- **Maximum retries: 3**
- **Retry delay: 1 second (exponential backoff)**
- **Timeout: 30 seconds per request**

## 📈 Scaling Considerations

### 1. Horizontal Scaling
```bash
# Multiple PM2 instances
pm2 start ecosystem.config.js -i max

# Load balancer configuration required
# Sticky sessions not needed (stateless design)
```

### 2. Vertical Scaling
```javascript
// Resource recommendations per instance:
const resources = {
  minMemory: '2GB',      // Minimum RAM
  recommendedMemory: '4GB',  // Recommended RAM
  minCPU: '2 cores',     // Minimum CPU
  recommendedCPU: '4 cores', // Recommended CPU
  storage: '10GB'        // For models and logs
};
```

### 3. Database Considerations
- **Conversation history: Redis/Memory (temporary)**
- **Analytics data: PostgreSQL/MongoDB**
- **Model metadata: File system/Object storage**

## 🔄 Maintenance & Updates

### 1. Model Updates
```bash
# Backup current models
cp -r models models.backup.$(date +%Y%m%d)

# Download new models (automatic on restart)
npm run model:update

# Verify models
npm run model:verify
```

### 2. Application Updates
```bash
# Zero-downtime deployment with PM2
pm2 deploy production update
pm2 reload grepmind-backend
```

### 3. Log Rotation
```bash
# Automated log rotation (logrotate)
cat > /etc/logrotate.d/grepmind << 'EOF'
/path/to/app/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF
```

## 🆘 Troubleshooting

### Common Issues

1. **"Production requires native model support"**
   ```bash
   # Reinstall native dependencies
   npm rebuild node-llama-cpp
   
   # Check build tools
   npm run check:build-tools
   ```

2. **"Model not available"**
   ```bash
   # Check model files
   ls -la models/*/
   
   # Re-download models
   rm -rf models/*
   npm start  # Will auto-download
   ```

3. **High memory usage**
   ```bash
   # Check memory usage
   curl localhost:5000/api/ai/health | jq '.checks.memory'
   
   # Restart if needed
   pm2 restart grepmind-backend
   ```

### Performance Issues
```bash
# Check system resources
htop
iostat -x 1
free -h

# Check application metrics
curl localhost:5000/metrics

# Analyze logs
tail -f logs/production.log | grep ERROR
```

## 📞 Support & Monitoring

### Monitoring Dashboard
Set up monitoring for:
- **Application health**: `/api/ai/health`
- **Resource usage**: CPU, Memory, Disk
- **Response times**: Average, P95, P99
- **Error rates**: By endpoint and type
- **Model performance**: Inference time, throughput

### Alerting Rules
```yaml
# Example Prometheus alerting rules
groups:
  - name: grepmind-backend
    rules:
      - alert: HighErrorRate
        expr: error_rate > 0.05
        for: 5m
      - alert: HighMemoryUsage
        expr: memory_usage > 0.8
        for: 2m
      - alert: ModelUnavailable
        expr: models_available == 0
        for: 1m
```

## 🎯 Production Checklist

Before going live:

- [ ] Native dependencies installed and verified
- [ ] Models downloaded and validated
- [ ] Environment variables configured
- [ ] Security headers enabled
- [ ] Rate limiting configured
- [ ] Monitoring and alerting set up
- [ ] Log rotation configured
- [ ] Backup strategy implemented
- [ ] Load testing completed
- [ ] Health checks responding correctly
- [ ] SSL certificates installed
- [ ] Firewall rules configured

---

## 📚 Additional Resources

- [Node.js Production Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [PM2 Production Guide](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Nginx Configuration](https://nginx.org/en/docs/http/configuring_https_servers.html)
- [Security Headers](https://owasp.org/www-project-secure-headers/)

For technical support or deployment assistance, please refer to the system documentation or contact the development team.
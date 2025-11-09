# AEGIS Deployment Options

## 🎯 Cost-Effective Deployment Strategies

### Option 1: AWS Free Tier (Recommended for Testing)

**Services Used**:
- Lambda (1M requests/month free)
- DynamoDB (25GB storage free)
- S3 (5GB storage free)
- API Gateway (1M requests/month free)
- CloudWatch Logs (5GB free)

**Monthly Cost**: **$0-5** (within free tier limits)

**What's Included**:
- ✅ API Gateway + Lambda handlers
- ✅ Lambda-based scraper (replaces Fargate)
- ✅ Simple NER (replaces SageMaker)
- ✅ DynamoDB risk profiles
- ✅ S3 storage
- ✅ Basic monitoring

**What's Excluded**:
- ❌ Fargate (expensive)
- ❌ SageMaker (expensive)
- ❌ NAT Gateway ($32/month)
- ❌ VPC Endpoints ($7/month each)
- ❌ GuardDuty ($4/month)
- ❌ Macie ($1/GB scanned)

**Deploy**:
```bash
cd infrastructure
npm install
cdk deploy Aegis-Minimal-Stack --profile dev
```

---

### Option 2: Vercel + Supabase (No AWS Required)

**Services**:
- Vercel (Serverless Functions) - Free tier
- Supabase (PostgreSQL + Storage) - Free tier
- Upstash (Redis) - Free tier

**Monthly Cost**: **$0** (free tier)

**Architecture**:
```
Vercel Edge Functions (API)
    ↓
Vercel Serverless Functions (Scraper, NLP)
    ↓
Supabase PostgreSQL (Risk Profiles)
    ↓
Supabase Storage (Raw/Processed Data)
```

**Deploy**:
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd vercel-deployment
vercel deploy
```

---

### Option 3: Railway.app (Easiest)

**Services**:
- Railway (Containers + PostgreSQL) - $5/month
- Railway Cron Jobs (Scheduled scraping)

**Monthly Cost**: **$5-10**

**Deploy**:
```bash
# Install Railway CLI
npm i -g @railway/cli

# Deploy
railway login
railway init
railway up
```

---

### Option 4: Local Development (Free)

**Services**:
- LocalStack (AWS emulator)
- Docker Compose
- SQLite (instead of DynamoDB)

**Monthly Cost**: **$0**

**Run Locally**:
```bash
docker-compose up
npm run dev
```

---

## 📊 Cost Comparison

| Service | AWS (Full) | AWS (Minimal) | Vercel | Railway | Local |
|---------|-----------|---------------|--------|---------|-------|
| **Compute** | Fargate $30 | Lambda $0 | Free | $5 | Free |
| **ML/NLP** | SageMaker $100 | Lambda $0 | Free | $5 | Free |
| **Database** | DynamoDB $5 | DynamoDB $0 | Free | Included | Free |
| **Storage** | S3 $5 | S3 $0 | Free | Included | Free |
| **Networking** | VPC $50 | None $0 | Free | Included | Free |
| **Monitoring** | CloudWatch $10 | Basic $0 | Free | Included | Free |
| **Total/Month** | **$200+** | **$0-5** | **$0** | **$5-10** | **$0** |

---

## 🚀 Recommended Approach

### Phase 1: Local Development (Free)
```bash
# Use Docker Compose for local testing
docker-compose up
```

### Phase 2: Vercel Deployment (Free)
```bash
# Deploy to Vercel for public API
vercel deploy --prod
```

### Phase 3: AWS Free Tier (Free for 12 months)
```bash
# Deploy minimal AWS stack
cdk deploy Aegis-Minimal-Stack
```

### Phase 4: Production (When Revenue Justifies)
```bash
# Deploy full AWS stack with all security features
cdk deploy --all --context env=prod
```

---

## 🔧 Minimal AWS Stack (Free Tier)

### What's Deployed:
1. **API Gateway** - REST API (1M requests/month free)
2. **Lambda Functions** - API handlers (1M requests/month free)
3. **Lambda Scraper** - Replaces Fargate (runs on schedule)
4. **Lambda NER** - Simple entity extraction (no SageMaker)
5. **DynamoDB** - Risk profiles (25GB free)
6. **S3** - Raw/processed data (5GB free)
7. **EventBridge** - Scheduling (free)
8. **CloudWatch** - Basic logs (5GB free)

### What's NOT Deployed:
- ❌ VPC (not needed for Lambda)
- ❌ NAT Gateway ($32/month)
- ❌ VPC Endpoints ($7/month each)
- ❌ Fargate ($30/month)
- ❌ SageMaker ($100+/month)
- ❌ GuardDuty ($4/month)
- ❌ Macie ($1/GB)

### Deploy Minimal Stack:
```bash
cd infrastructure
npm install

# Deploy only essential services
cdk deploy \
  Aegis-Data-dev \
  Aegis-Compute-Minimal-dev \
  Aegis-Api-dev \
  --profile dev
```

---

## 💡 Cost Optimization Tips

### 1. Use Lambda Instead of Fargate
**Savings**: $30/month
```typescript
// Lambda scraper runs on schedule
new events.Rule(this, 'DailyScrape', {
  schedule: events.Schedule.cron({ hour: '2', minute: '0' }),
  targets: [new targets.LambdaFunction(scraperFunction)]
});
```

### 2. Skip VPC for Lambda
**Savings**: $50/month (NAT + Endpoints)
```typescript
// Lambda without VPC (can still access S3, DynamoDB)
const scraperFunction = new lambda.Function(this, 'Scraper', {
  // No vpc property = public Lambda (free)
});
```

### 3. Use Simple NER Instead of SageMaker
**Savings**: $100+/month
```typescript
// Regex-based NER in Lambda (free)
// For better accuracy, use AWS Comprehend pay-per-use
```

### 4. Use On-Demand DynamoDB
**Savings**: Automatic scaling, pay only for what you use
```typescript
const table = new dynamodb.Table(this, 'RiskProfiles', {
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST
});
```

### 5. S3 Intelligent-Tiering
**Savings**: 40-70% on storage
```typescript
rawBucket.addLifecycleRule({
  transitions: [{
    storageClass: s3.StorageClass.INTELLIGENT_TIERING,
    transitionAfter: cdk.Duration.days(0)
  }]
});
```

---

## 🎓 Learning Path (Free)

### Week 1: Local Development
- Run everything locally with Docker
- Test API endpoints
- Understand data flow

### Week 2: Vercel Deployment
- Deploy API to Vercel
- Use Supabase for database
- Test with real data

### Week 3: AWS Free Tier
- Deploy minimal AWS stack
- Learn AWS services
- Monitor costs

### Week 4: Optimize & Scale
- Add caching
- Optimize queries
- Monitor performance

---

## 📞 Support

**Free Resources**:
- AWS Free Tier: https://aws.amazon.com/free/
- Vercel Free Tier: https://vercel.com/pricing
- Supabase Free Tier: https://supabase.com/pricing
- Railway Free Trial: https://railway.app/pricing

**Community**:
- AWS re:Post (free support)
- Vercel Discord
- Supabase Discord

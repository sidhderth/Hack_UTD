# Web Scraping Strategy

## Overview

The AEGIS scraper supports flexible time ranges and multiple scraping modes to balance data freshness with resource efficiency.

## Scraping Modes

### 1. Incremental Mode (Default)
**Use Case**: Daily/hourly updates for fresh data

**Configuration**:
```bash
SCRAPE_MODE=incremental
LOOKBACK_DAYS=7  # Last 7 days
```

**Behavior**:
- Scrapes data from the last N days (default: 7)
- Ideal for adverse media, news sources
- Runs on schedule (e.g., daily at 2 AM)
- Minimizes resource usage

**Example Sources**:
- News articles (last 7 days)
- Press releases (last 14 days)
- Social media mentions (last 3 days)

### 2. Full Mode
**Use Case**: Initial setup or complete refresh

**Configuration**:
```bash
SCRAPE_MODE=full
LOOKBACK_DAYS=365  # Last year
```

**Behavior**:
- Scrapes entire historical dataset (e.g., 1 year)
- Used for initial data population
- Resource-intensive, run during off-peak hours
- May take several hours to complete

**Example Sources**:
- Sanctions lists (full historical data)
- PEP databases (all records)
- Court records (last 12 months)

### 3. Backfill Mode
**Use Case**: Fill gaps in historical data

**Configuration**:
```bash
SCRAPE_MODE=backfill
LOOKBACK_DAYS=90  # Last 3 months
```

**Behavior**:
- Scrapes specific date range (e.g., 90 days)
- Used to recover from outages or fill data gaps
- Can be run on-demand

**Example Sources**:
- Missing date ranges from previous failures
- New sources being added to the system

## Date Range Recommendations by Source Type

### Sanctions Lists (OFAC, UN, EU)
**Recommended**: Incremental (7-14 days)
- Updated weekly/monthly
- Small delta updates
- Full refresh: Quarterly

**Rationale**: Sanctions lists change infrequently. Weekly incremental scrapes capture new additions efficiently.

### PEP Databases
**Recommended**: Incremental (30 days)
- Updated monthly
- Moderate change rate
- Full refresh: Semi-annually

**Rationale**: PEP status changes slowly. Monthly incremental scrapes are sufficient.

### Adverse Media
**Recommended**: Incremental (3-7 days)
- Updated daily
- High volume
- Full refresh: Not needed (time-bound relevance)

**Rationale**: News is time-sensitive. Recent articles (last 7 days) are most relevant for risk assessment.

### Court Records
**Recommended**: Incremental (14-30 days)
- Updated weekly
- Moderate volume
- Full refresh: Annually

**Rationale**: Court filings have processing delays. 2-4 week lookback captures recent cases.

### Regulatory Filings
**Recommended**: Incremental (7 days)
- Updated daily/weekly
- Low-moderate volume
- Full refresh: Quarterly

**Rationale**: Regulatory updates are time-critical. Weekly scrapes ensure compliance.

## Scheduling Strategy

### Production Schedule

```yaml
# Daily incremental scrapes
Adverse Media:
  schedule: "0 2 * * *"  # 2 AM daily
  mode: incremental
  lookback: 7 days

Sanctions Lists:
  schedule: "0 3 * * 1"  # 3 AM every Monday
  mode: incremental
  lookback: 14 days

PEP Databases:
  schedule: "0 4 1 * *"  # 4 AM first day of month
  mode: incremental
  lookback: 30 days

Court Records:
  schedule: "0 5 * * 0"  # 5 AM every Sunday
  mode: incremental
  lookback: 14 days

# Quarterly full refreshes
Full Refresh:
  schedule: "0 1 1 */3 *"  # 1 AM first day of quarter
  mode: full
  lookback: 365 days
```

### EventBridge Cron Expressions

```typescript
// Daily adverse media scrape
new events.Rule(this, 'DailyAdverseMediaScrape', {
  schedule: events.Schedule.cron({
    hour: '2',
    minute: '0'
  }),
  targets: [new targets.EcsTask({
    cluster: fargateCluster,
    taskDefinition: scraperTask,
    containerOverrides: [{
      containerName: 'scraper',
      environment: [
        { name: 'SCRAPE_MODE', value: 'incremental' },
        { name: 'LOOKBACK_DAYS', value: '7' },
        { name: 'SOURCES_CONFIG', value: JSON.stringify(adverseMediaSources) }
      ]
    }]
  })]
});

// Weekly sanctions list scrape
new events.Rule(this, 'WeeklySanctionsScrape', {
  schedule: events.Schedule.cron({
    weekDay: 'MON',
    hour: '3',
    minute: '0'
  }),
  targets: [new targets.EcsTask({
    cluster: fargateCluster,
    taskDefinition: scraperTask,
    containerOverrides: [{
      containerName: 'scraper',
      environment: [
        { name: 'SCRAPE_MODE', value: 'incremental' },
        { name: 'LOOKBACK_DAYS', value: '14' },
        { name: 'SOURCES_CONFIG', value: JSON.stringify(sanctionsSources) }
      ]
    }]
  })]
});
```

## Source Configuration

### Example: Sanctions List

```json
{
  "name": "ofac_sdn",
  "url": "https://sanctionslist.ofac.treas.gov/",
  "type": "sanctions_list",
  "entry_selector": ".sanction-entry",
  "next_button": ".pagination-next",
  "fields": {
    "name": ".entity-name",
    "type": ".entity-type",
    "date_added": ".date-added"
  }
}
```

### Example: Adverse Media

```json
{
  "name": "financial_times",
  "url": "https://www.ft.com/search",
  "type": "adverse_media",
  "article_selector": ".article-item",
  "fields": {
    "title": ".article-title",
    "date": ".article-date",
    "content": ".article-summary"
  }
}
```

## Resource Optimization

### Pagination Limits

```bash
MAX_PAGES=100  # Prevent infinite loops
```

**Rationale**: Limits resource consumption. If a source has 1000+ pages, consider:
- Increasing MAX_PAGES for full mode
- Using API instead of scraping
- Splitting into multiple tasks

### Rate Limiting

```python
time.sleep(2)  # 2 seconds between pages
```

**Rationale**: Prevents IP bans and respects robots.txt. Adjust based on source's rate limits.

### Proxy Rotation

```bash
PROXY_ROTATION=true
PROXY_URL=http://proxy-pool.example.com:8080
```

**Rationale**: Distributes requests across IPs to avoid rate limiting and blocks.

## Data Volume Estimates

### Incremental Mode (7 days)

| Source Type | Records/Day | 7-Day Total | Storage |
|-------------|-------------|-------------|---------|
| Adverse Media | 50-100 | 350-700 | ~5 MB |
| Sanctions Lists | 5-10 | 35-70 | ~100 KB |
| PEP Updates | 10-20 | 70-140 | ~200 KB |
| Court Records | 20-30 | 140-210 | ~2 MB |
| **Total** | **85-160** | **595-1,120** | **~7.3 MB** |

### Full Mode (365 days)

| Source Type | Total Records | Storage |
|-------------|---------------|---------|
| Adverse Media | 18,000-36,000 | ~250 MB |
| Sanctions Lists | 50,000+ | ~50 MB |
| PEP Database | 100,000+ | ~100 MB |
| Court Records | 7,000-10,000 | ~100 MB |
| **Total** | **175,000-196,000** | **~500 MB** |

## Cost Optimization

### Fargate Task Sizing

**Incremental Mode**:
- CPU: 0.5 vCPU
- Memory: 1 GB
- Duration: 10-30 minutes
- Cost: ~$0.05 per run

**Full Mode**:
- CPU: 1 vCPU
- Memory: 2 GB
- Duration: 2-4 hours
- Cost: ~$0.50 per run

### Monthly Cost Estimate

```
Daily incremental (30 runs): $1.50
Weekly sanctions (4 runs): $0.20
Monthly PEP (1 run): $0.05
Quarterly full (0.33 runs): $0.17
---
Total: ~$2/month for scraping
```

## Monitoring & Alerts

### Key Metrics

- **Scrape Success Rate**: % of successful scrapes
- **Records Scraped**: Count per source per run
- **Scrape Duration**: Time to complete
- **Error Rate**: Failed attempts / total attempts

### CloudWatch Alarms

```typescript
new cloudwatch.Alarm(this, 'ScraperFailureAlarm', {
  metric: new cloudwatch.Metric({
    namespace: 'AEGIS/Scraper',
    metricName: 'FailureRate',
    statistic: 'Average'
  }),
  threshold: 0.2,  // 20% failure rate
  evaluationPeriods: 2,
  alarmDescription: 'Scraper failure rate exceeds 20%'
});
```

## Best Practices

1. **Start with Incremental**: Use 7-day lookback for new sources
2. **Monitor Data Quality**: Check record counts for anomalies
3. **Adjust Based on Source**: Some sources update hourly, others monthly
4. **Use Full Mode Sparingly**: Resource-intensive, schedule during off-peak
5. **Implement Retry Logic**: Network issues are common, retry with backoff
6. **Respect robots.txt**: Check source's scraping policy
7. **Rotate User Agents**: Avoid detection as bot
8. **Log Everything**: Structured logs for debugging and auditing

## Troubleshooting

### Issue: Too Many Records

**Solution**: Reduce LOOKBACK_DAYS or increase MAX_PAGES

### Issue: Missing Recent Data

**Solution**: Decrease LOOKBACK_DAYS or increase scrape frequency

### Issue: IP Blocked

**Solution**: Enable PROXY_ROTATION or reduce scrape frequency

### Issue: Stale Data

**Solution**: Increase scrape frequency or check source update schedule

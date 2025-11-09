# Data Sources Configuration

## Overview

AEGIS scrapes data from **100+ sources** across multiple categories. You need to configure which sources to use based on your compliance requirements and budget.

## Source Categories

### 1. Sanctions Lists (Free, Public)

#### OFAC SDN List (US Treasury)
- **URL**: https://sanctionslist.ofac.treas.gov/
- **Cost**: Free
- **Updates**: Weekly
- **Coverage**: ~10,000 entities
- **API Available**: Yes (XML/CSV downloads)
- **Legal**: Public domain, no restrictions

#### UN Security Council Sanctions
- **URL**: https://www.un.org/securitycouncil/sanctions/
- **Cost**: Free
- **Updates**: Monthly
- **Coverage**: ~1,000 entities
- **API Available**: Yes (XML)
- **Legal**: Public domain

#### EU Sanctions List
- **URL**: https://data.europa.eu/data/datasets/consolidated-list-of-persons-groups-and-entities-subject-to-eu-financial-sanctions
- **Cost**: Free
- **Updates**: Daily
- **Coverage**: ~2,000 entities
- **API Available**: Yes (XML/JSON)
- **Legal**: Open data license

#### UK HM Treasury Sanctions
- **URL**: https://www.gov.uk/government/publications/financial-sanctions-consolidated-list-of-targets
- **Cost**: Free
- **Updates**: Daily
- **Coverage**: ~1,500 entities
- **API Available**: Yes (CSV/JSON)
- **Legal**: Open Government License

### 2. PEP Databases (Commercial)

#### World-Check (Refinitiv)
- **Type**: Commercial API
- **Cost**: $10,000-$50,000/year (enterprise)
- **Coverage**: 2.5M+ profiles
- **API**: REST API with rate limits
- **Setup**: Contact Refinitiv sales

#### Dow Jones Risk & Compliance
- **Type**: Commercial API
- **Cost**: $15,000-$60,000/year
- **Coverage**: 3M+ profiles
- **API**: REST API
- **Setup**: Contact Dow Jones

#### ComplyAdvantage
- **Type**: Commercial API
- **Cost**: $5,000-$30,000/year
- **Coverage**: 1M+ profiles
- **API**: REST API with webhooks
- **Setup**: https://complyadvantage.com/

### 3. Adverse Media (Mixed)

#### Google News API
- **Cost**: Free (limited) or $0.01/query
- **Coverage**: Global news sources
- **API**: REST API
- **Rate Limit**: 100 requests/day (free)
- **Setup**: https://newsapi.org/

#### NewsAPI.org
- **Cost**: Free (limited) or $449/month
- **Coverage**: 80,000+ sources
- **API**: REST API
- **Rate Limit**: 100 requests/day (free), unlimited (paid)
- **Setup**: https://newsapi.org/

#### Reuters News API
- **Type**: Commercial
- **Cost**: Custom pricing
- **Coverage**: Reuters global news
- **API**: REST API
- **Setup**: Contact Reuters

### 4. Court Records

#### PACER (US Federal Courts)
- **URL**: https://pacer.uscourts.gov/
- **Cost**: $0.10/page
- **Coverage**: All US federal court cases
- **API**: Limited API, mostly scraping
- **Setup**: Register for PACER account

#### SEC EDGAR
- **URL**: https://www.sec.gov/edgar
- **Cost**: Free
- **Coverage**: All US public company filings
- **API**: REST API (rate limited)
- **Rate Limit**: 10 requests/second
- **Legal**: Public domain

### 5. Watchlists

#### Interpol Red Notices
- **URL**: https://www.interpol.int/en/How-we-work/Notices/Red-Notices
- **Cost**: Free
- **Coverage**: International wanted persons
- **API**: Limited public API
- **Legal**: Public information

#### FBI Most Wanted
- **URL**: https://www.fbi.gov/wanted
- **Cost**: Free
- **Coverage**: US federal fugitives
- **API**: No official API (scraping)
- **Legal**: Public domain

## Configuration Steps

### Step 1: Choose Your Sources

Based on your compliance requirements:

**Minimum (Free)**:
- OFAC SDN List
- UN Sanctions
- EU Sanctions
- Google News (free tier)
- SEC EDGAR

**Recommended (Mixed)**:
- All free sources above
- ComplyAdvantage (PEP)
- NewsAPI.org (paid tier)
- PACER (pay-per-use)

**Enterprise (Full Coverage)**:
- All sources above
- World-Check or Dow Jones
- Reuters News API
- Custom industry sources

### Step 2: Configure Sources

Edit `config/sources.json`:

```json
{
  "sources": [
    {
      "name": "ofac_sdn",
      "url": "https://sanctionslist.ofac.treas.gov/",
      "type": "sanctions_list",
      "enabled": true,
      "schedule": "0 3 * * 1"
    }
  ]
}
```

### Step 3: Set Up Authentication

For commercial sources, store API keys in Secrets Manager:

```bash
aws secretsmanager create-secret \
  --name aegis/sources/world-check-api-key \
  --secret-string '{"apiKey":"YOUR_API_KEY","apiSecret":"YOUR_SECRET"}' \
  --profile prod
```

### Step 4: Deploy Scraper Configuration

```bash
# Upload sources config to S3
aws s3 cp config/sources.json s3://aegis-config-prod/sources.json

# Update Fargate task environment
aws ecs update-service \
  --cluster aegis-scraper-prod \
  --service scraper-service \
  --force-new-deployment
```

### Step 5: Test Scraping

```bash
# Trigger manual scrape
aws ecs run-task \
  --cluster aegis-scraper-prod \
  --task-definition aegis-scraper:1 \
  --overrides '{
    "containerOverrides": [{
      "name": "scraper",
      "environment": [
        {"name": "SCRAPE_MODE", "value": "incremental"},
        {"name": "LOOKBACK_DAYS", "value": "7"}
      ]
    }]
  }'
```

## Legal & Compliance Considerations

### Terms of Service
- **Always check robots.txt** before scraping
- **Respect rate limits** to avoid IP bans
- **Review ToS** for each source
- **Use appropriate User-Agent** identifying your bot

### Data Licensing
- **Public domain sources**: No restrictions (OFAC, UN, EU)
- **Open data licenses**: Attribution required (some government sources)
- **Commercial APIs**: Bound by license agreement
- **News sources**: May require licensing for commercial use

### GDPR Compliance
- **Lawful basis**: Legitimate interest (fraud prevention)
- **Data minimization**: Only scrape necessary fields
- **Retention**: Define retention policies per source type
- **Right to erasure**: May not apply to public sanctions data

### Example robots.txt Check

```python
from urllib.robotparser import RobotFileParser

def check_robots_txt(url):
    rp = RobotFileParser()
    rp.set_url(f"{url}/robots.txt")
    rp.read()
    
    user_agent = "AEGIS Risk Intelligence Bot"
    
    if rp.can_fetch(user_agent, url):
        print(f"✓ Allowed to scrape {url}")
        return True
    else:
        print(f"✗ Not allowed to scrape {url}")
        return False
```

## Cost Estimates

### Free Tier (Public Sources Only)
- **Sources**: OFAC, UN, EU, UK, SEC, FBI
- **Monthly Cost**: $0
- **Coverage**: Basic sanctions + regulatory filings
- **Suitable For**: Startups, basic compliance

### Standard Tier
- **Sources**: Free + NewsAPI.org + ComplyAdvantage
- **Monthly Cost**: ~$500-$1,000
- **Coverage**: Sanctions + PEP + adverse media
- **Suitable For**: SMBs, moderate risk appetite

### Enterprise Tier
- **Sources**: All + World-Check + Reuters
- **Monthly Cost**: ~$3,000-$5,000
- **Coverage**: Comprehensive global coverage
- **Suitable For**: Banks, large enterprises, high-risk industries

## Monitoring Source Health

### Key Metrics
- **Scrape success rate**: % of successful scrapes
- **Records per scrape**: Detect anomalies
- **Scrape duration**: Performance monitoring
- **Source availability**: Uptime tracking

### CloudWatch Dashboard

```typescript
new cloudwatch.GraphWidget({
  title: 'Source Health',
  left: [
    new cloudwatch.Metric({
      namespace: 'AEGIS/Scraper',
      metricName: 'SuccessRate',
      dimensionsMap: { Source: 'ofac_sdn' }
    })
  ]
});
```

## Troubleshooting

### Issue: Source blocking IP
**Solution**: Enable proxy rotation or contact source for API access

### Issue: Data format changed
**Solution**: Update selectors in `sources.json`, test with sample data

### Issue: Rate limited
**Solution**: Reduce scrape frequency or upgrade to paid API tier

### Issue: Missing data
**Solution**: Check source availability, verify selectors, review logs

## Next Steps

1. **Review** the example sources configuration
2. **Choose** sources based on your budget and requirements
3. **Register** for commercial APIs if needed
4. **Configure** `config/sources.json` with your sources
5. **Test** scraping in dev environment
6. **Monitor** source health and data quality
7. **Iterate** based on false-positive rates and coverage gaps

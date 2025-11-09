import os
import json
import boto3
from datetime import datetime, timedelta
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

s3 = boto3.client('s3')
RAW_BUCKET = os.environ['RAW_BUCKET']

# Scraping configuration
SCRAPE_MODE = os.environ.get('SCRAPE_MODE', 'incremental')  # 'full', 'incremental', 'backfill'
LOOKBACK_DAYS = int(os.environ.get('LOOKBACK_DAYS', '7'))  # Default: 1 week
MAX_PAGES = int(os.environ.get('MAX_PAGES', '100'))  # Pagination limit
RETRY_ATTEMPTS = int(os.environ.get('RETRY_ATTEMPTS', '3'))
PROXY_ROTATION = os.environ.get('PROXY_ROTATION', 'false').lower() == 'true'

def get_chrome_driver(use_proxy=False):
    """
    Initialize Chrome driver with security and performance options
    """
    chrome_options = Options()
    chrome_options.add_argument('--headless')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--window-size=1920,1080')
    
    # User agent rotation
    chrome_options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
    
    # Proxy rotation (if enabled)
    if use_proxy and PROXY_ROTATION:
        proxy_url = os.environ.get('PROXY_URL')
        if proxy_url:
            chrome_options.add_argument(f'--proxy-server={proxy_url}')
    
    return webdriver.Chrome(options=chrome_options)

def calculate_date_range():
    """
    Calculate date range based on scrape mode
    """
    end_date = datetime.utcnow()
    
    if SCRAPE_MODE == 'full':
        # Full historical scrape (e.g., 1 year)
        start_date = end_date - timedelta(days=365)
        print(f"Full scrape mode: {start_date.date()} to {end_date.date()} (365 days)")
    elif SCRAPE_MODE == 'backfill':
        # Backfill mode (e.g., 90 days)
        start_date = end_date - timedelta(days=90)
        print(f"Backfill mode: {start_date.date()} to {end_date.date()} (90 days)")
    else:
        # Incremental mode (default: 7 days)
        start_date = end_date - timedelta(days=LOOKBACK_DAYS)
        print(f"Incremental mode: {start_date.date()} to {end_date.date()} ({LOOKBACK_DAYS} days)")
    
    return start_date, end_date

def scrape_source(source_config, start_date, end_date):
    """
    Scrape data from external source with date range and pagination
    
    Args:
        source_config: Dict with 'url', 'type', 'selectors'
        start_date: Start of date range
        end_date: End of date range
    """
    source_url = source_config['url']
    source_type = source_config.get('type', 'generic')
    
    driver = get_chrome_driver(use_proxy=PROXY_ROTATION)
    scraped_records = []
    
    try:
        print(f"Scraping {source_url} ({source_type})")
        
        # Navigate to source
        driver.get(source_url)
        
        # Wait for page load
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        
        # Source-specific scraping logic
        if source_type == 'sanctions_list':
            scraped_records = scrape_sanctions_list(driver, source_config, start_date, end_date)
        elif source_type == 'pep_database':
            scraped_records = scrape_pep_database(driver, source_config, start_date, end_date)
        elif source_type == 'adverse_media':
            scraped_records = scrape_adverse_media(driver, source_config, start_date, end_date)
        else:
            # Generic scraping
            scraped_records = scrape_generic(driver, source_config, start_date, end_date)
        
        print(f"Scraped {len(scraped_records)} records from {source_url}")
        
        return {
            'source': source_url,
            'sourceType': source_type,
            'scrapedAt': datetime.utcnow().isoformat(),
            'dateRange': {
                'start': start_date.isoformat(),
                'end': end_date.isoformat()
            },
            'recordCount': len(scraped_records),
            'records': scraped_records
        }
        
    finally:
        driver.quit()

def scrape_sanctions_list(driver, config, start_date, end_date):
    """
    Scrape sanctions lists (OFAC, UN, EU, etc.)
    Typically updated weekly/monthly, so date range is for "added since"
    """
    records = []
    page = 1
    
    while page <= MAX_PAGES:
        try:
            # Example: Find all sanction entries
            entries = driver.find_elements(By.CSS_SELECTOR, config.get('entry_selector', '.sanction-entry'))
            
            for entry in entries:
                try:
                    # Extract entity details
                    name = entry.find_element(By.CSS_SELECTOR, '.name').text
                    entity_type = entry.find_element(By.CSS_SELECTOR, '.type').text
                    date_added_str = entry.find_element(By.CSS_SELECTOR, '.date-added').text
                    
                    # Parse date
                    date_added = datetime.strptime(date_added_str, '%Y-%m-%d')
                    
                    # Filter by date range
                    if start_date <= date_added <= end_date:
                        records.append({
                            'name': name,
                            'entityType': entity_type,
                            'dateAdded': date_added.isoformat(),
                            'source': 'sanctions_list',
                            'aliases': [],  # Extract if available
                            'metadata': {}
                        })
                except Exception as e:
                    print(f"Error extracting entry: {str(e)}")
                    continue
            
            # Check for next page
            try:
                next_button = driver.find_element(By.CSS_SELECTOR, config.get('next_button', '.next-page'))
                if not next_button.is_enabled():
                    break
                next_button.click()
                time.sleep(2)  # Rate limiting
                page += 1
            except:
                break  # No more pages
                
        except Exception as e:
            print(f"Error on page {page}: {str(e)}")
            break
    
    return records

def scrape_pep_database(driver, config, start_date, end_date):
    """
    Scrape Politically Exposed Persons (PEP) databases
    """
    records = []
    # Similar pagination logic as sanctions_list
    # PEP databases typically have full historical data
    # Date range filters for "updated since" or "added since"
    return records

def scrape_adverse_media(driver, config, start_date, end_date):
    """
    Scrape adverse media sources (news articles, press releases)
    Date range is critical here - typically scrape last 7-30 days
    """
    records = []
    
    # Search with date filters
    search_url = f"{config['url']}?from={start_date.strftime('%Y-%m-%d')}&to={end_date.strftime('%Y-%m-%d')}"
    driver.get(search_url)
    
    # Extract articles within date range
    articles = driver.find_elements(By.CSS_SELECTOR, config.get('article_selector', '.article'))
    
    for article in articles:
        try:
            title = article.find_element(By.CSS_SELECTOR, '.title').text
            date_str = article.find_element(By.CSS_SELECTOR, '.date').text
            content = article.find_element(By.CSS_SELECTOR, '.content').text
            
            records.append({
                'title': title,
                'date': date_str,
                'content': content[:500],  # Truncate
                'source': 'adverse_media',
                'url': article.get_attribute('href')
            })
        except Exception as e:
            print(f"Error extracting article: {str(e)}")
            continue
    
    return records

def scrape_generic(driver, config, start_date, end_date):
    """
    Generic scraping for unstructured sources
    """
    records = []
    
    # Extract page content
    page_source = driver.page_source
    
    records.append({
        'content': page_source[:1000],  # Truncated
        'scrapedAt': datetime.utcnow().isoformat()
    })
    
    return records

def upload_to_s3(data, source_name):
    """
    Upload scraped data to S3 with partitioning by date
    """
    timestamp = datetime.utcnow()
    key = f"raw/{timestamp.strftime('%Y/%m/%d')}/{source_name}_{timestamp.strftime('%H%M%S')}.json"
    
    s3.put_object(
        Bucket=RAW_BUCKET,
        Key=key,
        Body=json.dumps(data, indent=2).encode('utf-8'),
        ContentType='application/json',
        ServerSideEncryption='aws:kms',
        Metadata={
            'source': source_name,
            'scrape-mode': SCRAPE_MODE,
            'record-count': str(data['recordCount'])
        }
    )
    
    print(f"Uploaded to s3://{RAW_BUCKET}/{key}")
    return key

def main():
    """
    Main scraper task - runs in Fargate
    Supports multiple scraping modes and date ranges
    """
    # Parse source configurations
    sources_json = os.environ.get('SOURCES_CONFIG', '[]')
    sources = json.loads(sources_json)
    
    if not sources:
        print("No sources configured. Set SOURCES_CONFIG environment variable.")
        return
    
    # Calculate date range based on mode
    start_date, end_date = calculate_date_range()
    
    # Scrape each source
    for source_config in sources:
        source_name = source_config.get('name', 'unknown')
        
        for attempt in range(RETRY_ATTEMPTS):
            try:
                print(f"\n{'='*60}")
                print(f"Source: {source_name} (Attempt {attempt + 1}/{RETRY_ATTEMPTS})")
                print(f"{'='*60}")
                
                data = scrape_source(source_config, start_date, end_date)
                
                # Upload to S3
                s3_key = upload_to_s3(data, source_name)
                
                print(f"✓ Successfully scraped {source_name}: {data['recordCount']} records")
                break  # Success, move to next source
                
            except Exception as e:
                print(f"✗ Error scraping {source_name} (attempt {attempt + 1}): {str(e)}")
                
                if attempt < RETRY_ATTEMPTS - 1:
                    wait_time = 2 ** attempt  # Exponential backoff
                    print(f"Retrying in {wait_time} seconds...")
                    time.sleep(wait_time)
                else:
                    print(f"Failed to scrape {source_name} after {RETRY_ATTEMPTS} attempts")

if __name__ == '__main__':
    main()

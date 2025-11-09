/**
 * Lambda-based web scraper (replaces Fargate)
 * Cost: ~$0.20 per 1M requests vs Fargate ~$30/month
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import * as cheerio from 'cheerio';

const s3Client = new S3Client({});
const RAW_BUCKET = process.env.RAW_BUCKET || 'aegis-raw-data-dev';

interface SourceConfig {
  name: string;
  url: string;
  type: string;
  selectors?: {
    entry_selector?: string;
    name?: string;
    type?: string;
    date_added?: string;
  };
}

interface ScrapedRecord {
  name: string;
  entityType: string;
  dateAdded: string;
  source: string;
  aliases: string[];
  metadata: Record<string, any>;
}

export const handler = async (event: any) => {
  console.log('Scraper Lambda triggered:', JSON.stringify(event));

  const sources: SourceConfig[] = event.sources || [];
  const scrapeMode = event.scrapeMode || 'incremental';
  const lookbackDays = event.lookbackDays || 7;

  const results = [];

  for (const source of sources) {
    try {
      console.log(`Scraping ${source.name}...`);

      const data = await scrapeSource(source, scrapeMode, lookbackDays);

      // Upload to S3
      const key = `raw/${new Date().toISOString().split('T')[0]}/${source.name}_${Date.now()}.json`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: RAW_BUCKET,
          Key: key,
          Body: JSON.stringify(data),
          ContentType: 'application/json',
          ServerSideEncryption: 'AES256',
        })
      );

      console.log(`✓ Uploaded to s3://${RAW_BUCKET}/${key}`);

      results.push({
        source: source.name,
        status: 'success',
        recordCount: data.recordCount,
        s3Key: key,
      });
    } catch (error) {
      console.error(`✗ Error scraping ${source.name}:`, error);
      results.push({
        source: source.name,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Scraping completed',
      results,
    }),
  };
};

async function scrapeSource(
  source: SourceConfig,
  scrapeMode: string,
  lookbackDays: number
): Promise<any> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - lookbackDays);

  // Fetch HTML
  const response = await axios.get(source.url, {
    headers: {
      'User-Agent': 'AEGIS Risk Intelligence Bot/1.0',
    },
    timeout: 25000, // Lambda has 30s timeout
  });

  const html = response.data;
  const $ = cheerio.load(html);

  const records: ScrapedRecord[] = [];

  // Source-specific scraping logic
  if (source.type === 'sanctions_list') {
    records.push(...scrapeSanctionsList($, source));
  } else if (source.type === 'adverse_media') {
    records.push(...scrapeAdverseMedia($, source));
  } else {
    records.push(...scrapeGeneric($, source));
  }

  return {
    source: source.url,
    sourceType: source.type,
    scrapedAt: new Date().toISOString(),
    dateRange: {
      start: startDate.toISOString(),
      end: new Date().toISOString(),
    },
    recordCount: records.length,
    records,
  };
}

function scrapeSanctionsList($: cheerio.CheerioAPI, source: SourceConfig): ScrapedRecord[] {
  const records: ScrapedRecord[] = [];
  const selector = source.selectors?.entry_selector || '.sanction-entry';

  $(selector).each((_, element) => {
    try {
      const name = $(element).find(source.selectors?.name || '.name').text().trim();
      const entityType = $(element).find(source.selectors?.type || '.type').text().trim();
      const dateAdded = $(element).find(source.selectors?.date_added || '.date-added').text().trim();

      if (name) {
        records.push({
          name,
          entityType: entityType || 'UNKNOWN',
          dateAdded: dateAdded || new Date().toISOString(),
          source: 'sanctions_list',
          aliases: [],
          metadata: {},
        });
      }
    } catch (error) {
      console.error('Error parsing entry:', error);
    }
  });

  return records;
}

function scrapeAdverseMedia($: cheerio.CheerioAPI, source: SourceConfig): ScrapedRecord[] {
  const records: ScrapedRecord[] = [];
  const selector = source.selectors?.entry_selector || '.article';

  $(selector).each((_, element) => {
    try {
      const title = $(element).find('.title').text().trim();
      const date = $(element).find('.date').text().trim();
      const content = $(element).find('.content').text().trim();

      if (title) {
        records.push({
          name: title,
          entityType: 'ARTICLE',
          dateAdded: date || new Date().toISOString(),
          source: 'adverse_media',
          aliases: [],
          metadata: {
            title,
            content: content.substring(0, 500),
          },
        });
      }
    } catch (error) {
      console.error('Error parsing article:', error);
    }
  });

  return records;
}

function scrapeGeneric($: cheerio.CheerioAPI, source: SourceConfig): ScrapedRecord[] {
  // Generic scraping - extract text content
  const text = $('body').text().trim().substring(0, 1000);

  return [
    {
      name: 'Generic Content',
      entityType: 'UNKNOWN',
      dateAdded: new Date().toISOString(),
      source: 'generic',
      aliases: [],
      metadata: {
        content: text,
      },
    },
  ];
}

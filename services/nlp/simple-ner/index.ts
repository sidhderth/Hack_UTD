/**
 * Simple NER using regex patterns (replaces SageMaker)
 * Cost: $0 (runs in Lambda)
 * For production, consider: AWS Comprehend, Hugging Face API, or OpenAI
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({});
const PROCESSED_BUCKET = process.env.PROCESSED_BUCKET || 'aegis-processed-dev';

interface Entity {
  text: string;
  type: string;
  score: number;
  start: number;
  end: number;
}

export const handler = async (event: any) => {
  console.log('NER Lambda triggered:', JSON.stringify(event));

  const bucket = event.bucket || event.detail?.bucket?.name;
  const key = event.key || event.detail?.object?.key;

  if (!bucket || !key) {
    throw new Error('Missing bucket or key in event');
  }

  // Download raw data from S3
  const getCommand = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await s3Client.send(getCommand);
  const rawData = JSON.parse(await response.Body!.transformToString());

  // Extract entities from records
  const allEntities: Entity[] = [];

  for (const record of rawData.records || []) {
    const text = JSON.stringify(record);
    const entities = extractEntities(text);
    allEntities.push(...entities);
  }

  // Write to processed bucket
  const outputKey = key.replace('raw/', 'ner/');
  const outputData = {
    sourceKey: key,
    entities: allEntities,
    processedAt: new Date().toISOString(),
    stage: 'ner',
  };

  await s3Client.send(
    new PutObjectCommand({
      Bucket: PROCESSED_BUCKET,
      Key: outputKey,
      Body: JSON.stringify(outputData),
      ContentType: 'application/json',
      ServerSideEncryption: 'AES256',
    })
  );

  console.log(`✓ NER complete: ${allEntities.length} entities extracted`);

  return {
    statusCode: 200,
    bucket: PROCESSED_BUCKET,
    key: outputKey,
    entities: allEntities,
  };
};

function extractEntities(text: string): Entity[] {
  const entities: Entity[] = [];

  // Person names (simple pattern)
  const personPattern = /\b([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b/g;
  let match;

  while ((match = personPattern.exec(text)) !== null) {
    entities.push({
      text: match[1],
      type: 'PERSON',
      score: 0.85,
      start: match.index,
      end: match.index + match[1].length,
    });
  }

  // Organizations (ending with Corp, Inc, Ltd, etc.)
  const orgPattern = /\b([A-Z][A-Za-z\s]+(?:Corp|Inc|Ltd|LLC|Company|Corporation))\b/g;

  while ((match = orgPattern.exec(text)) !== null) {
    entities.push({
      text: match[1],
      type: 'ORGANIZATION',
      score: 0.80,
      start: match.index,
      end: match.index + match[1].length,
    });
  }

  // Locations (countries, cities - simple list)
  const locations = [
    'United States',
    'Russia',
    'China',
    'Mexico',
    'British Virgin Islands',
    'New York',
    'London',
    'Moscow',
  ];

  for (const location of locations) {
    const index = text.indexOf(location);
    if (index !== -1) {
      entities.push({
        text: location,
        type: 'LOCATION',
        score: 0.90,
        start: index,
        end: index + location.length,
      });
    }
  }

  return entities;
}

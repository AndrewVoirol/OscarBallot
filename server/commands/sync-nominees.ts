
import { OscarTMDBPipeline } from '../tmdb-pipeline';
import { db } from '../db';

async function main() {
  const pipeline = new OscarTMDBPipeline(process.env.TMDB_ACCESS_TOKEN!);
  
  console.log('Starting 2024 nominees sync...');
  const results2024 = await pipeline.processNominees(2024, (progress) => {
    console.log(`2024 Progress: ${progress.toFixed(1)}%`);
  });
  console.log('2024 sync complete:', results2024);

  console.log('Starting 2025 nominees sync...');
  const results2025 = await pipeline.processNominees(2025, (progress) => {
    console.log(`2025 Progress: ${progress.toFixed(1)}%`);
  });
  console.log('2025 sync complete:', results2025);
}

main().catch(console.error);

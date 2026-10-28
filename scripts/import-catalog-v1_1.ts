import * as dotenv from 'dotenv';
import { importGlobalCatalogV11 } from '../src/db/workspace-repo.ts';
import { getPersistenceMode } from '../src/db/index.ts';

dotenv.config();

async function main() {
  const mode = getPersistenceMode();
  console.log(`[catalog:import] Starting canonical v1.1 Global Catalog import (PERSISTENCE_MODE=${mode})...`);
  const result = await importGlobalCatalogV11();
  console.log(
    `[catalog:import] Completed successfully: mode=${result.mode}, totalCatalogMaterials=${result.totalCatalogMaterials}, insertedOrUpdatedMaterials=${result.insertedOrUpdatedMaterials}, regulatoryRecordsUpserted=${result.regulatoryRecordsUpserted}`
  );
}

main().catch((err) => {
  console.error('[catalog:import] Failed:', err);
  process.exit(1);
});

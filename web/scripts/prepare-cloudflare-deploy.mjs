import { readFile, writeFile } from 'node:fs/promises';

const configPath = new URL('../dist/server/wrangler.json', import.meta.url);

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const databaseId = required('CLOUDFLARE_D1_DATABASE_ID');
const databaseName =
  process.env.CLOUDFLARE_D1_DATABASE_NAME?.trim() || 'highway-assist-db';
const workerName =
  process.env.CLOUDFLARE_WORKER_NAME?.trim() || 'highway-assist';

const config = JSON.parse(await readFile(configPath, 'utf8'));
const database = config.d1_databases?.find((item) => item.binding === 'DB');

if (!database) {
  throw new Error('The generated Worker config does not contain the DB binding.');
}

config.name = workerName;
config.topLevelName = workerName;
database.database_id = databaseId;
database.database_name = databaseName;

await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);


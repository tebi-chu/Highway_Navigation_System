import {writeFile} from 'node:fs/promises';

const required=['CLOUDFLARE_D1_DATABASE_ID','GOOGLE_CLIENT_ID','EDITOR_EMAILS','ALLOWED_ORIGINS'];
for(const name of required)if(!process.env[name]?.trim())throw new Error(`GitHubの設定 ${name} が未登録です。`);

const config={
  name:process.env.CLOUDFLARE_WORKER_NAME?.trim()||'highway-facility-sync',
  main:'src/index.js',
  compatibility_date:'2026-09-13',
  d1_databases:[{
    binding:'DB',
    database_name:process.env.CLOUDFLARE_D1_DATABASE_NAME?.trim()||'highway-facility-sync',
    database_id:process.env.CLOUDFLARE_D1_DATABASE_ID.trim(),
  }],
  vars:{
    GOOGLE_CLIENT_ID:process.env.GOOGLE_CLIENT_ID.trim(),
    EDITOR_EMAILS:process.env.EDITOR_EMAILS.trim(),
    ALLOWED_ORIGINS:process.env.ALLOWED_ORIGINS.trim(),
  },
  triggers:{crons:['17 3 * * *']},
};
await writeFile('wrangler.jsonc',JSON.stringify(config,null,2));

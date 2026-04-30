import dotenv from 'dotenv';
dotenv.config({ path: 'C:/projekty/chytreja-app/.env.local' });

// Dynamic import — ensures env vars are loaded before orchestrator.js runs
const { default: handler } = await import('../api/orchestrator.js');

const userId = process.argv[2] || 'qE09cLyXXGRBRxOBCGNZqTM2XRW2';
const nodeId = process.argv[3] || 'telo';

const req = {
  method: 'POST',
  body: { message: 'Co mám dnes dělat?', nodeId, userId },
};
const res = {
  status: (code) => ({ json: (d) => { console.log(`HTTP ${code}:`, JSON.stringify(d, null, 2)); } }),
  json: (d) => console.log('Response:', JSON.stringify(d, null, 2)),
};

console.log(`Spouštím orchestrátor pro ${userId} / ${nodeId}...\n`);
await handler(req, res);

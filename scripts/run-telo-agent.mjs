import dotenv from 'dotenv';
dotenv.config({ path: 'C:/projekty/chytreja-app/.env.local' });

const { default: handler } = await import('../api/agents/telo.js');

const userId = process.argv[2] || 'qE09cLyXXGRBRxOBCGNZqTM2XRW2';
const discipline = process.argv[3] || 'sila';

const req = {
  method: 'POST',
  body: { userId, discipline, nodeId: 'telo' },
};
const res = {
  status: (code) => ({ json: (d) => console.log(`HTTP ${code}:`, JSON.stringify(d, null, 2)) }),
  json: (d) => console.log('Response:', JSON.stringify(d, null, 2)),
};

console.log(`Tělo Agent — userId: ${userId}, discipline: ${discipline}\n`);
await handler(req, res);

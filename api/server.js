/**
 * ToolFi API — Local Development Server
 *
 * Run with: npm run dev (or npm start)
 * For production, deploy to Vercel which uses api/index.js directly.
 */

import 'dotenv/config';
import app from './index.js';

const PORT = process.env.PORT || 3402;

app.listen(PORT, () => {
  console.log(`ToolFi API running on port ${PORT}`);
  console.log(`Registry: ${process.env.REGISTRY_ADDRESS || 'NOT SET'}`);
  console.log(`RPC: ${process.env.RPC_URL || 'https://sepolia.base.org'}`);
});

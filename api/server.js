/**
 * ToolFi Demo API Server
 * 
 * Implements x402-style payment flow:
 * 1. Agent calls endpoint → gets 402 with payment instructions
 * 2. Agent pays USDC on-chain via ToolRegistry.payForCall()
 * 3. Agent retries with X-Payment-Tx header containing tx hash
 * 4. Server verifies payment on-chain → returns data
 */

import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());

// ─── Config ──────────────────────────────────────────────

const PORT = process.env.PORT || 3402;
const RPC_URL = process.env.RPC_URL || 'https://sepolia.base.org';
const REGISTRY_ADDRESS = process.env.REGISTRY_ADDRESS || '';
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

const provider = new ethers.JsonRpcProvider(RPC_URL);

// Minimal ABI for verification
const REGISTRY_ABI = [
  'function tools(uint256) view returns (uint256 id, address creator, string name, string endpoint, string description, uint256 pricePerCall, uint256 totalCalls, uint256 totalEarned, bool active)',
  'function userCallCount(address, uint256) view returns (uint256)',
  'event ToolCalled(uint256 indexed toolId, address indexed caller, uint256 amount, uint256 timestamp)',
];

const USDC_ABI = [
  'function balanceOf(address) view returns (uint256)',
];

let registry;
if (REGISTRY_ADDRESS) {
  registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);
}

// Track verified payments: txHash → { toolId, caller, verified }
const verifiedPayments = new Map();

// ─── Payment Verification ────────────────────────────────

async function verifyPayment(txHash, expectedToolId) {
  // Check cache first
  if (verifiedPayments.has(txHash)) {
    const cached = verifiedPayments.get(txHash);
    if (cached.toolId === expectedToolId) return cached;
    return null;
  }

  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1) return null;

    // Check the receipt is to our registry
    if (receipt.to?.toLowerCase() !== REGISTRY_ADDRESS.toLowerCase()) return null;

    // Parse ToolCalled events
    for (const log of receipt.logs) {
      try {
        const parsed = registry.interface.parseLog({ topics: log.topics, data: log.data });
        if (parsed?.name === 'ToolCalled') {
          const toolId = Number(parsed.args[0]);
          const caller = parsed.args[1];
          if (toolId === expectedToolId) {
            const result = { toolId, caller, verified: true, txHash };
            verifiedPayments.set(txHash, result);
            return result;
          }
        }
      } catch (e) {
        // Not our event, skip
      }
    }
  } catch (e) {
    console.error('Payment verification error:', e.message);
  }
  return null;
}

// ─── x402 Payment Required Response ──────────────────────

function send402(res, toolId, toolName, price) {
  res.status(402).json({
    status: 402,
    message: 'Payment Required',
    protocol: 'x402-toolfi',
    payment: {
      chain: 'base-sepolia',
      chainId: 84532,
      contract: REGISTRY_ADDRESS,
      method: 'payForCall(uint256 toolId)',
      toolId: toolId,
      toolName: toolName,
      price: price,
      priceFormatted: `${(price / 1e6).toFixed(6)} USDC`,
      usdc: USDC_ADDRESS,
      instructions: [
        `1. Approve USDC: usdc.approve(${REGISTRY_ADDRESS}, ${price})`,
        `2. Pay: registry.payForCall(${toolId})`,
        `3. Retry this request with header: X-Payment-Tx: <tx_hash>`,
      ],
    },
  });
}

// ─── Middleware: Check Payment ────────────────────────────

function requirePayment(toolId, toolName, price) {
  return async (req, res, next) => {
    const txHash = req.headers['x-payment-tx'];

    if (!txHash) {
      return send402(res, toolId, toolName, price);
    }

    if (!REGISTRY_ADDRESS) {
      // No registry deployed yet, accept any tx hash for demo
      req.paymentVerified = { toolId, caller: 'demo', txHash };
      return next();
    }

    const verification = await verifyPayment(txHash, toolId);
    if (!verification) {
      return res.status(403).json({
        status: 403,
        message: 'Payment verification failed',
        detail: 'Transaction not found, not confirmed, or paid for wrong tool.',
      });
    }

    req.paymentVerified = verification;
    next();
  };
}

// ─── Tool Endpoints ──────────────────────────────────────

// Tool 0: Crypto Price Oracle
app.get('/api/price', requirePayment(0, 'Crypto Price Oracle', 1000), async (req, res) => {
  const symbol = (req.query.symbol || 'bitcoin').toLowerCase();
  
  try {
    // Use DexScreener search for token data
    const searchUrl = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(symbol)}`;
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    if (data.pairs && data.pairs.length > 0) {
      const pair = data.pairs[0];
      return res.json({
        tool: 'Crypto Price Oracle',
        payment: req.paymentVerified,
        data: {
          token: pair.baseToken?.symbol || symbol,
          name: pair.baseToken?.name || symbol,
          priceUsd: pair.priceUsd,
          priceChange24h: pair.priceChange?.h24 || null,
          marketCap: pair.marketCap || null,
          liquidity: pair.liquidity?.usd || null,
          volume24h: pair.volume?.h24 || null,
          chain: pair.chainId,
          dexId: pair.dexId,
          pairAddress: pair.pairAddress,
          fetchedAt: new Date().toISOString(),
        },
      });
    }

    // Fallback: return mock data for common tokens
    const mockPrices = {
      bitcoin: { price: '96543.21', change: '+2.3%', mcap: '1.9T' },
      ethereum: { price: '3245.67', change: '+1.1%', mcap: '390B' },
      solana: { price: '198.45', change: '-0.5%', mcap: '92B' },
    };

    const mock = mockPrices[symbol] || { price: 'unknown', change: 'N/A', mcap: 'N/A' };
    res.json({
      tool: 'Crypto Price Oracle',
      payment: req.paymentVerified,
      data: {
        token: symbol.toUpperCase(),
        priceUsd: mock.price,
        priceChange24h: mock.change,
        marketCap: mock.mcap,
        source: 'fallback',
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    res.status(500).json({ error: 'Price fetch failed', detail: e.message });
  }
});

// Tool 1: Wallet Risk Scanner
app.get('/api/risk', requirePayment(1, 'Wallet Risk Scanner', 5000), async (req, res) => {
  const address = req.query.address;
  if (!address || !ethers.isAddress(address)) {
    return res.status(400).json({ error: 'Valid EVM address required. Use ?address=0x...' });
  }

  try {
    // Get on-chain data
    const balance = await provider.getBalance(address);
    const txCount = await provider.getTransactionCount(address);
    const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
    const usdcBalance = await usdcContract.balanceOf(address);

    // Simple risk heuristics
    const riskFactors = [];
    let riskScore = 0;

    if (txCount === 0) {
      riskFactors.push('New wallet with zero transactions');
      riskScore += 30;
    }
    if (balance === 0n && usdcBalance === 0n) {
      riskFactors.push('Empty wallet — no ETH or USDC');
      riskScore += 20;
    }
    if (txCount > 0 && txCount < 5) {
      riskFactors.push('Very low transaction count');
      riskScore += 10;
    }

    // Clamp score
    riskScore = Math.min(100, riskScore);
    const riskLevel = riskScore > 60 ? 'HIGH' : riskScore > 30 ? 'MEDIUM' : 'LOW';

    res.json({
      tool: 'Wallet Risk Scanner',
      payment: req.paymentVerified,
      data: {
        address,
        chain: 'base-sepolia',
        ethBalance: ethers.formatEther(balance),
        usdcBalance: ethers.formatUnits(usdcBalance, 6),
        transactionCount: txCount,
        riskScore,
        riskLevel,
        riskFactors,
        note: 'Risk analysis is based on Base Sepolia testnet data. Not financial advice.',
        analyzedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    res.status(500).json({ error: 'Risk scan failed', detail: e.message });
  }
});

// Tool 2: News Digest
app.get('/api/news', requirePayment(2, 'News Digest', 2000), async (req, res) => {
  const topic = req.query.topic || 'crypto';

  try {
    // Use Brave Search API for real news if available
    const braveKey = process.env.BRAVE_API_KEY;
    if (braveKey) {
      const searchUrl = `https://api.search.brave.com/res/v1/news/search?q=${encodeURIComponent(topic + ' cryptocurrency')}&count=5&freshness=pd`;
      const response = await fetch(searchUrl, {
        headers: { 'X-Subscription-Token': braveKey },
      });
      const data = await response.json();

      if (data.results) {
        return res.json({
          tool: 'News Digest',
          payment: req.paymentVerified,
          data: {
            topic,
            articles: data.results.map(r => ({
              title: r.title,
              description: r.description,
              url: r.url,
              source: r.meta_url?.hostname,
              age: r.age,
            })),
            fetchedAt: new Date().toISOString(),
          },
        });
      }
    }

    // Fallback: curated headlines
    res.json({
      tool: 'News Digest',
      payment: req.paymentVerified,
      data: {
        topic,
        articles: [
          { title: `Latest ${topic} developments - market update`, description: 'Markets showing mixed signals as institutional interest continues to grow.', source: 'demo' },
          { title: `AI agents driving new ${topic} use cases`, description: 'Autonomous agents are creating demand for on-chain payment infrastructure.', source: 'demo' },
          { title: `USDC adoption accelerates across L2 networks`, description: 'Circle reports record USDC volumes on Base and Arbitrum.', source: 'demo' },
        ],
        note: 'Set BRAVE_API_KEY for real news results.',
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    res.status(500).json({ error: 'News fetch failed', detail: e.message });
  }
});

// ─── Info Endpoints (free) ───────────────────────────────

app.get('/', (req, res) => {
  res.json({
    name: 'ToolFi API',
    version: '1.0.0',
    description: 'Agent tool marketplace with USDC payments (x402 style)',
    registry: REGISTRY_ADDRESS || 'not deployed yet',
    chain: 'Base Sepolia (84532)',
    usdc: USDC_ADDRESS,
    tools: [
      { id: 0, name: 'Crypto Price Oracle', endpoint: '/api/price?symbol=bitcoin', price: '0.001 USDC' },
      { id: 1, name: 'Wallet Risk Scanner', endpoint: '/api/risk?address=0x...', price: '0.005 USDC' },
      { id: 2, name: 'News Digest', endpoint: '/api/news?topic=defi', price: '0.002 USDC' },
    ],
    howToPay: {
      step1: 'Call any /api/* endpoint without payment → get 402 response with instructions',
      step2: 'Approve USDC and call registry.payForCall(toolId) on Base Sepolia',
      step3: 'Retry the request with header X-Payment-Tx: <tx_hash>',
    },
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ─── Start ───────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`ToolFi API running on port ${PORT}`);
  console.log(`Registry: ${REGISTRY_ADDRESS || 'NOT SET'}`);
  console.log(`RPC: ${RPC_URL}`);
});

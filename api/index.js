/**
 * ToolFi API — Vercel Serverless Entry Point
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
import { Redis } from '@upstash/redis';

const app = express();
app.use(cors());
app.use(express.json());

// ─── Upstash Redis ───────────────────────────────────────

let redis = null;
if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
  redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
}

const TOOLS_KEY = 'toolfi:tools';
const NEXT_ID_KEY = 'toolfi:next_id';

// ─── Tool Storage Functions ──────────────────────────────

async function getAllTools() {
  if (!redis) return [];
  try {
    const tools = await redis.hgetall(TOOLS_KEY);
    if (!tools) return [];
    return Object.values(tools).map(t => {
      try {
        return typeof t === 'string' ? JSON.parse(t) : t;
      } catch (e) {
        console.error('Failed to parse tool:', t);
        return null;
      }
    }).filter(Boolean);
  } catch (e) {
    console.error('Redis getAllTools error:', e.message);
    return [];
  }
}

async function getTool(id) {
  if (!redis) return null;
  const tool = await redis.hget(TOOLS_KEY, String(id));
  if (!tool) return null;
  return typeof tool === 'string' ? JSON.parse(tool) : tool;
}

async function createTool(toolData) {
  if (!redis) throw new Error('Database not configured');
  const id = await redis.incr(NEXT_ID_KEY);
  // User-uploaded tools start at ID 1000 to avoid conflicts with hardcoded tools
  const toolId = 1000 + id;
  const tool = {
    id: toolId,
    ...toolData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    totalCalls: 0,
    active: true,
  };
  await redis.hset(TOOLS_KEY, { [String(toolId)]: JSON.stringify(tool) });
  return tool;
}

async function updateTool(id, updates) {
  if (!redis) throw new Error('Database not configured');
  const existing = await getTool(id);
  if (!existing) return null;
  const updated = {
    ...existing,
    ...updates,
    id: existing.id, // Don't allow ID change
    updatedAt: new Date().toISOString(),
  };
  await redis.hset(TOOLS_KEY, { [String(id)]: JSON.stringify(updated) });
  return updated;
}

async function deleteTool(id) {
  if (!redis) throw new Error('Database not configured');
  await redis.hdel(TOOLS_KEY, String(id));
  return true;
}

// ─── Config ──────────────────────────────────────────────

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

// Tool 3: Rug Pull Scanner (GoPlus API)
app.get('/api/rugcheck', requirePayment(3, 'Rug Pull Scanner', 3000), async (req, res) => {
  const token = req.query.token;
  const chainId = req.query.chain || '1'; // Default to Ethereum mainnet

  if (!token) {
    return res.status(400).json({ error: 'Token address required. Use ?token=0x...&chain=1' });
  }

  try {
    // GoPlus Token Security API
    const goplusUrl = `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${token}`;
    const response = await fetch(goplusUrl);
    const data = await response.json();

    if (data.code !== 1 || !data.result || !data.result[token.toLowerCase()]) {
      return res.status(404).json({ 
        error: 'Token not found or not supported',
        detail: 'GoPlus may not have data for this token/chain combination'
      });
    }

    const tokenData = data.result[token.toLowerCase()];
    
    // Calculate rug pull probability score
    let rugScore = 0;
    const redFlags = [];
    const warnings = [];

    // Critical red flags (high weight)
    if (tokenData.is_honeypot === '1') {
      rugScore += 40;
      redFlags.push('🚨 HONEYPOT DETECTED - Cannot sell tokens');
    }
    if (tokenData.is_blacklisted === '1') {
      rugScore += 20;
      redFlags.push('Blacklist function enabled');
    }
    if (tokenData.can_take_back_ownership === '1') {
      rugScore += 25;
      redFlags.push('Owner can reclaim ownership after renouncing');
    }
    if (tokenData.owner_change_balance === '1') {
      rugScore += 30;
      redFlags.push('Owner can modify balances');
    }
    if (tokenData.hidden_owner === '1') {
      rugScore += 20;
      redFlags.push('Hidden owner detected');
    }
    if (tokenData.selfdestruct === '1') {
      rugScore += 35;
      redFlags.push('Contract can self-destruct');
    }
    if (tokenData.external_call === '1') {
      rugScore += 15;
      warnings.push('External calls in contract');
    }

    // Tax analysis
    const buyTax = parseFloat(tokenData.buy_tax || '0') * 100;
    const sellTax = parseFloat(tokenData.sell_tax || '0') * 100;
    if (sellTax > 10) {
      rugScore += 15;
      warnings.push(`High sell tax: ${sellTax.toFixed(1)}%`);
    }
    if (buyTax > 10) {
      rugScore += 10;
      warnings.push(`High buy tax: ${buyTax.toFixed(1)}%`);
    }

    // Ownership
    if (tokenData.is_open_source !== '1') {
      rugScore += 10;
      warnings.push('Contract not verified/open source');
    }
    if (tokenData.is_proxy === '1') {
      rugScore += 5;
      warnings.push('Proxy contract (upgradeable)');
    }
    if (tokenData.is_mintable === '1') {
      rugScore += 10;
      warnings.push('Token is mintable');
    }

    // Liquidity
    if (tokenData.lp_holders && tokenData.lp_holders.length > 0) {
      const topLpHolder = tokenData.lp_holders[0];
      if (parseFloat(topLpHolder.percent) > 0.9) {
        rugScore += 15;
        warnings.push(`Top LP holder owns ${(parseFloat(topLpHolder.percent) * 100).toFixed(1)}% of liquidity`);
      }
    }

    // Clamp score
    rugScore = Math.min(100, rugScore);
    
    // Determine risk level
    let riskLevel, riskEmoji;
    if (rugScore >= 60) {
      riskLevel = 'CRITICAL';
      riskEmoji = '🔴';
    } else if (rugScore >= 40) {
      riskLevel = 'HIGH';
      riskEmoji = '🟠';
    } else if (rugScore >= 20) {
      riskLevel = 'MEDIUM';
      riskEmoji = '🟡';
    } else {
      riskLevel = 'LOW';
      riskEmoji = '🟢';
    }

    res.json({
      tool: 'Rug Pull Scanner',
      payment: req.paymentVerified,
      data: {
        token: token,
        chain: chainId,
        tokenName: tokenData.token_name || 'Unknown',
        tokenSymbol: tokenData.token_symbol || 'Unknown',
        rugScore,
        riskLevel: `${riskEmoji} ${riskLevel}`,
        redFlags,
        warnings,
        details: {
          isHoneypot: tokenData.is_honeypot === '1',
          buyTax: `${buyTax.toFixed(2)}%`,
          sellTax: `${sellTax.toFixed(2)}%`,
          isOpenSource: tokenData.is_open_source === '1',
          isProxy: tokenData.is_proxy === '1',
          isMintable: tokenData.is_mintable === '1',
          ownerAddress: tokenData.owner_address || 'Renounced',
          totalSupply: tokenData.total_supply,
          holderCount: tokenData.holder_count,
        },
        source: 'GoPlus Security API',
        analyzedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    res.status(500).json({ error: 'Rug check failed', detail: e.message });
  }
});

// Tool 4: Cross-chain Bridge Router (Li.Fi API)
app.get('/api/bridge', requirePayment(4, 'Bridge Router', 2000), async (req, res) => {
  const { fromChain, toChain, fromToken, toToken, amount } = req.query;

  if (!fromChain || !toChain || !fromToken || !toToken || !amount) {
    return res.status(400).json({ 
      error: 'Missing parameters',
      required: {
        fromChain: 'Source chain ID (e.g., 1 for Ethereum, 42161 for Arbitrum)',
        toChain: 'Destination chain ID',
        fromToken: 'Source token address (use 0x0 for native)',
        toToken: 'Destination token address',
        amount: 'Amount in smallest unit (wei)'
      },
      example: '/api/bridge?fromChain=1&toChain=42161&fromToken=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48&toToken=0xaf88d065e77c8cC2239327C5EDb3A432268e5831&amount=1000000000'
    });
  }

  try {
    // Li.Fi Quote API
    const lifiUrl = new URL('https://li.quest/v1/quote');
    lifiUrl.searchParams.set('fromChain', fromChain);
    lifiUrl.searchParams.set('toChain', toChain);
    lifiUrl.searchParams.set('fromToken', fromToken);
    lifiUrl.searchParams.set('toToken', toToken);
    lifiUrl.searchParams.set('fromAmount', amount);
    lifiUrl.searchParams.set('fromAddress', '0x0000000000000000000000000000000000000000'); // Placeholder
    
    const response = await fetch(lifiUrl.toString(), {
      headers: {
        'x-lifi-integrator': 'tooldrop-demo'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: 'Li.Fi API error',
        detail: errorData.message || `Status ${response.status}`,
        hint: 'Check chain IDs and token addresses. Common chains: 1=Ethereum, 10=Optimism, 137=Polygon, 42161=Arbitrum, 8453=Base'
      });
    }

    const quote = await response.json();

    // Extract key info
    const route = quote.includedSteps?.map(step => ({
      type: step.type,
      tool: step.tool,
      fromChain: step.action?.fromChainId,
      toChain: step.action?.toChainId,
      fromToken: step.action?.fromToken?.symbol,
      toToken: step.action?.toToken?.symbol,
    })) || [];

    res.json({
      tool: 'Bridge Router',
      payment: req.paymentVerified,
      data: {
        quote: {
          fromChain: quote.action?.fromChainId,
          toChain: quote.action?.toChainId,
          fromToken: {
            symbol: quote.action?.fromToken?.symbol,
            address: quote.action?.fromToken?.address,
            decimals: quote.action?.fromToken?.decimals,
          },
          toToken: {
            symbol: quote.action?.toToken?.symbol,
            address: quote.action?.toToken?.address,
            decimals: quote.action?.toToken?.decimals,
          },
          fromAmount: quote.action?.fromAmount,
          toAmount: quote.estimate?.toAmount,
          toAmountMin: quote.estimate?.toAmountMin,
        },
        estimate: {
          executionDuration: `${Math.round((quote.estimate?.executionDuration || 0) / 60)} minutes`,
          gasCosts: quote.estimate?.gasCosts?.map(g => ({
            type: g.type,
            amount: g.amount,
            amountUSD: g.amountUSD,
            token: g.token?.symbol,
          })),
          feeCosts: quote.estimate?.feeCosts?.map(f => ({
            name: f.name,
            amount: f.amount,
            amountUSD: f.amountUSD,
            token: f.token?.symbol,
          })),
        },
        route,
        tool: quote.tool,
        toolDetails: quote.toolDetails,
        transactionRequest: quote.transactionRequest ? {
          to: quote.transactionRequest.to,
          data: quote.transactionRequest.data?.substring(0, 100) + '...', // Truncate for readability
          value: quote.transactionRequest.value,
          gasLimit: quote.transactionRequest.gasLimit,
        } : null,
        source: 'Li.Fi Aggregator',
        quotedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    res.status(500).json({ error: 'Bridge quote failed', detail: e.message });
  }
});

// Tool 5: DeFi Yields (DefiLlama)
app.get('/api/yields', requirePayment(5, 'DeFi Yield Finder', 2000), async (req, res) => {
  const { chain, project, minTvl, minApy, maxApy, stablecoinOnly, limit } = req.query;

  try {
    // DefiLlama Yields API
    const response = await fetch('https://yields.llama.fi/pools');
    const data = await response.json();

    if (!data.data) {
      return res.status(500).json({ error: 'DefiLlama API error' });
    }

    let pools = data.data;

    // Apply filters
    const chainFilter = chain?.toLowerCase();
    const projectFilter = project?.toLowerCase();
    const minTvlFilter = parseFloat(minTvl) || 100000;
    const minApyFilter = parseFloat(minApy) || 1;
    const maxApyFilter = parseFloat(maxApy) || 100;
    const limitFilter = parseInt(limit) || 20;

    pools = pools.filter(pool => {
      // Chain filter
      if (chainFilter && pool.chain?.toLowerCase() !== chainFilter) return false;
      
      // Project filter
      if (projectFilter && pool.project?.toLowerCase() !== projectFilter) return false;
      
      // TVL filter
      if ((pool.tvlUsd || 0) < minTvlFilter) return false;
      
      // APY filter
      const apy = pool.apy || 0;
      if (apy < minApyFilter || apy > maxApyFilter) return false;
      
      // Stablecoin filter
      if (stablecoinOnly === 'true' && !pool.stablecoin) return false;
      
      return true;
    });

    // Sort by APY descending
    pools.sort((a, b) => (b.apy || 0) - (a.apy || 0));

    // Limit results
    pools = pools.slice(0, limitFilter);

    // Format response
    const formattedPools = pools.map(pool => ({
      pool: pool.pool,
      chain: pool.chain,
      project: pool.project,
      symbol: pool.symbol,
      tvlUsd: pool.tvlUsd ? `$${(pool.tvlUsd / 1e6).toFixed(2)}M` : null,
      tvlUsdRaw: pool.tvlUsd,
      apy: pool.apy ? `${pool.apy.toFixed(2)}%` : null,
      apyRaw: pool.apy,
      apyBase: pool.apyBase ? `${pool.apyBase.toFixed(2)}%` : null,
      apyReward: pool.apyReward ? `${pool.apyReward.toFixed(2)}%` : null,
      rewardTokens: pool.rewardTokens || [],
      stablecoin: pool.stablecoin || false,
      ilRisk: pool.ilRisk || 'unknown',
    }));

    res.json({
      tool: 'DeFi Yield Finder',
      payment: req.paymentVerified,
      data: {
        filters: {
          chain: chainFilter || 'all',
          project: projectFilter || 'all',
          minTvl: `$${(minTvlFilter / 1000).toFixed(0)}K`,
          minApy: `${minApyFilter}%`,
          maxApy: `${maxApyFilter}%`,
          stablecoinOnly: stablecoinOnly === 'true',
        },
        count: formattedPools.length,
        pools: formattedPools,
        source: 'DefiLlama',
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    res.status(500).json({ error: 'DeFi yields fetch failed', detail: e.message });
  }
});

// Tool 6: Swap Router (Li.Fi - same chain swaps)
app.get('/api/swap', requirePayment(6, 'Swap Router', 2000), async (req, res) => {
  const { chain, fromToken, toToken, amount } = req.query;

  if (!chain || !fromToken || !toToken || !amount) {
    return res.status(400).json({
      error: 'Missing parameters',
      required: { chain: 'Chain ID', fromToken: 'Source token', toToken: 'Destination token', amount: 'Amount in wei' },
      example: '/api/swap?chain=1&fromToken=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48&toToken=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2&amount=1000000000'
    });
  }

  try {
    const lifiUrl = new URL('https://li.quest/v1/quote');
    lifiUrl.searchParams.set('fromChain', chain);
    lifiUrl.searchParams.set('toChain', chain); // Same chain for swap
    lifiUrl.searchParams.set('fromToken', fromToken);
    lifiUrl.searchParams.set('toToken', toToken);
    lifiUrl.searchParams.set('fromAmount', amount);
    lifiUrl.searchParams.set('fromAddress', '0x0000000000000000000000000000000000000000');

    const response = await fetch(lifiUrl.toString(), {
      headers: { 'x-lifi-integrator': 'tooldrop-demo' }
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: 'Li.Fi error', detail: err.message });
    }

    const quote = await response.json();
    res.json({
      tool: 'Swap Router',
      payment: req.paymentVerified,
      data: {
        fromToken: quote.action?.fromToken?.symbol,
        toToken: quote.action?.toToken?.symbol,
        fromAmount: quote.action?.fromAmount,
        toAmount: quote.estimate?.toAmount,
        toAmountMin: quote.estimate?.toAmountMin,
        executionTime: `${Math.round((quote.estimate?.executionDuration || 0) / 60)} min`,
        gasCostUsd: quote.estimate?.gasCosts?.reduce((sum, g) => sum + parseFloat(g.amountUSD || 0), 0).toFixed(2),
        route: quote.includedSteps?.map(s => s.tool) || [],
        source: 'Li.Fi',
        quotedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    res.status(500).json({ error: 'Swap quote failed', detail: e.message });
  }
});

// Tool 7: Trending Coins (CoinGecko)
app.get('/api/trending', requirePayment(7, 'Trending Coins', 1000), async (req, res) => {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/search/trending');
    const data = await response.json();

    if (!data.coins) {
      return res.status(500).json({ error: 'CoinGecko API error' });
    }

    const trending = data.coins.slice(0, 15).map((item, idx) => ({
      rank: idx + 1,
      id: item.item?.id,
      name: item.item?.name,
      symbol: item.item?.symbol,
      marketCapRank: item.item?.market_cap_rank,
      priceBtc: item.item?.price_btc,
      score: item.item?.score,
      thumb: item.item?.thumb,
    }));

    res.json({
      tool: 'Trending Coins',
      payment: req.paymentVerified,
      data: {
        count: trending.length,
        coins: trending,
        source: 'CoinGecko',
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    res.status(500).json({ error: 'Trending fetch failed', detail: e.message });
  }
});

// Tool 8: Protocol TVL (DefiLlama)
app.get('/api/tvl', requirePayment(8, 'Protocol TVL', 1000), async (req, res) => {
  const { protocol } = req.query;

  try {
    if (protocol) {
      // Get specific protocol TVL
      const response = await fetch(`https://api.llama.fi/protocol/${protocol}`);
      if (!response.ok) {
        return res.status(404).json({ error: 'Protocol not found' });
      }
      const data = await response.json();
      
      res.json({
        tool: 'Protocol TVL',
        payment: req.paymentVerified,
        data: {
          name: data.name,
          symbol: data.symbol,
          tvl: data.tvl ? `$${(data.tvl / 1e9).toFixed(2)}B` : null,
          tvlRaw: data.tvl,
          change24h: data.change_1d ? `${data.change_1d.toFixed(2)}%` : null,
          change7d: data.change_7d ? `${data.change_7d.toFixed(2)}%` : null,
          chains: data.chains || [],
          category: data.category,
          url: data.url,
          source: 'DefiLlama',
          fetchedAt: new Date().toISOString(),
        },
      });
    } else {
      // Get top protocols by TVL
      const response = await fetch('https://api.llama.fi/protocols');
      const data = await response.json();
      
      const top20 = data.slice(0, 20).map((p, idx) => ({
        rank: idx + 1,
        name: p.name,
        symbol: p.symbol,
        tvl: p.tvl ? `$${(p.tvl / 1e9).toFixed(2)}B` : null,
        tvlRaw: p.tvl,
        change24h: p.change_1d ? `${p.change_1d.toFixed(2)}%` : null,
        category: p.category,
        chains: p.chains?.slice(0, 5) || [],
      }));

      res.json({
        tool: 'Protocol TVL',
        payment: req.paymentVerified,
        data: {
          count: top20.length,
          protocols: top20,
          source: 'DefiLlama',
          fetchedAt: new Date().toISOString(),
        },
      });
    }
  } catch (e) {
    res.status(500).json({ error: 'TVL fetch failed', detail: e.message });
  }
});

// Tool 9: Gas Tracker
app.get('/api/gas', requirePayment(9, 'Gas Tracker', 500), async (req, res) => {
  const { chain } = req.query;
  const chainId = chain || '1';

  try {
    // Use Etherscan-style gas oracle for supported chains
    const gasOracles = {
      '1': 'https://api.etherscan.io/api?module=gastracker&action=gasoracle',
      '137': 'https://api.polygonscan.com/api?module=gastracker&action=gasoracle',
      '42161': 'https://api.arbiscan.io/api?module=gastracker&action=gasoracle',
    };

    if (gasOracles[chainId]) {
      const response = await fetch(gasOracles[chainId]);
      const data = await response.json();
      
      if (data.status === '1' && data.result) {
        return res.json({
          tool: 'Gas Tracker',
          payment: req.paymentVerified,
          data: {
            chain: chainId,
            safe: `${data.result.SafeGasPrice} Gwei`,
            standard: `${data.result.ProposeGasPrice} Gwei`,
            fast: `${data.result.FastGasPrice} Gwei`,
            baseFee: data.result.suggestBaseFee ? `${parseFloat(data.result.suggestBaseFee).toFixed(2)} Gwei` : null,
            source: 'Etherscan',
            fetchedAt: new Date().toISOString(),
          },
        });
      }
    }

    // Fallback: get gas from RPC
    const gasPrice = await provider.getFeeData();
    res.json({
      tool: 'Gas Tracker',
      payment: req.paymentVerified,
      data: {
        chain: chainId,
        gasPrice: gasPrice.gasPrice ? `${(Number(gasPrice.gasPrice) / 1e9).toFixed(2)} Gwei` : null,
        maxFeePerGas: gasPrice.maxFeePerGas ? `${(Number(gasPrice.maxFeePerGas) / 1e9).toFixed(2)} Gwei` : null,
        maxPriorityFee: gasPrice.maxPriorityFeePerGas ? `${(Number(gasPrice.maxPriorityFeePerGas) / 1e9).toFixed(2)} Gwei` : null,
        source: 'RPC',
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    res.status(500).json({ error: 'Gas fetch failed', detail: e.message });
  }
});

// ─── Tool Management (CRUD) ──────────────────────────────

// List all user-uploaded tools
app.get('/api/tools', async (req, res) => {
  try {
    const tools = await getAllTools();
    res.json({
      count: tools.length,
      tools,
      dbConnected: !!redis,
      redisUrl: process.env.KV_REST_API_URL ? 'configured' : 'not set',
    });
  } catch (e) {
    console.error('/api/tools error:', e);
    res.status(500).json({ error: 'Failed to fetch tools', detail: e.message, stack: e.stack });
  }
});

// Get a specific tool
app.get('/api/tools/:id', async (req, res) => {
  try {
    const tool = await getTool(req.params.id);
    if (!tool) {
      return res.status(404).json({ error: 'Tool not found' });
    }
    res.json(tool);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch tool', detail: e.message });
  }
});

// Create a new tool (upload)
app.post('/api/tools', async (req, res) => {
  try {
    const { name, description, endpoint, pricePerCall, category, parameters, creator } = req.body;
    
    // Validation
    if (!name || !endpoint) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['name', 'endpoint'],
        optional: ['description', 'pricePerCall', 'category', 'parameters', 'creator']
      });
    }

    // Validate endpoint URL
    try {
      new URL(endpoint);
    } catch {
      return res.status(400).json({ error: 'Invalid endpoint URL' });
    }

    const tool = await createTool({
      name,
      description: description || '',
      endpoint,
      pricePerCall: pricePerCall || 1000, // Default 0.001 USDC
      category: category || 'custom',
      parameters: parameters || {},
      creator: creator || 'anonymous',
    });

    res.status(201).json({
      message: 'Tool created successfully',
      tool,
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create tool', detail: e.message });
  }
});

// Update a tool
app.put('/api/tools/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (id < 1000) {
      return res.status(403).json({ error: 'Cannot modify built-in tools' });
    }

    const updates = req.body;
    delete updates.id; // Prevent ID change
    delete updates.createdAt; // Preserve creation time

    const tool = await updateTool(id, updates);
    if (!tool) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    res.json({
      message: 'Tool updated successfully',
      tool,
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update tool', detail: e.message });
  }
});

// Delete a tool
app.delete('/api/tools/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (id < 1000) {
      return res.status(403).json({ error: 'Cannot delete built-in tools' });
    }

    await deleteTool(id);
    res.json({ message: 'Tool deleted successfully', id });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete tool', detail: e.message });
  }
});

// ─── Info Endpoints (free) ───────────────────────────────

const BUILTIN_TOOLS = [
  { id: 0, name: 'Crypto Price Oracle', endpoint: '/api/price?symbol=bitcoin', price: '0.001 USDC', category: 'data' },
  { id: 1, name: 'Wallet Risk Scanner', endpoint: '/api/risk?address=0x...', price: '0.005 USDC', category: 'blockchain' },
  { id: 2, name: 'News Digest', endpoint: '/api/news?topic=defi', price: '0.002 USDC', category: 'data' },
  { id: 3, name: 'Rug Pull Scanner', endpoint: '/api/rugcheck?token=0x...&chain=1', price: '0.003 USDC', category: 'blockchain' },
  { id: 4, name: 'Bridge Router', endpoint: '/api/bridge?fromChain=1&toChain=42161&...', price: '0.002 USDC', category: 'blockchain' },
  { id: 5, name: 'DeFi Yield Finder', endpoint: '/api/yields?chain=ethereum&minApy=5', price: '0.002 USDC', category: 'data' },
  { id: 6, name: 'Swap Router', endpoint: '/api/swap?chain=1&fromToken=0x...&toToken=0x...&amount=1000000', price: '0.002 USDC', category: 'blockchain' },
  { id: 7, name: 'Trending Coins', endpoint: '/api/trending', price: '0.001 USDC', category: 'data' },
  { id: 8, name: 'Protocol TVL', endpoint: '/api/tvl?protocol=aave', price: '0.001 USDC', category: 'data' },
  { id: 9, name: 'Gas Tracker', endpoint: '/api/gas?chain=1', price: '0.0005 USDC', category: 'utility' },
];

app.get('/', async (req, res) => {
  // Fetch user-uploaded tools
  let uploadedTools = [];
  try {
    uploadedTools = await getAllTools();
  } catch (e) {
    console.error('Failed to fetch uploaded tools:', e.message);
  }

  res.json({
    name: 'ToolDrop API',
    version: '1.3.0',
    description: 'Agent tool marketplace with USDC payments (x402 style)',
    registry: REGISTRY_ADDRESS || 'not deployed yet',
    chain: 'Base Sepolia (84532)',
    usdc: USDC_ADDRESS,
    dbConnected: !!redis,
    tools: {
      builtin: BUILTIN_TOOLS,
      uploaded: uploadedTools.map(t => ({
        id: t.id,
        name: t.name,
        endpoint: t.endpoint,
        price: `${((t.pricePerCall || 1000) / 1e6).toFixed(6)} USDC`,
        category: t.category || 'custom',
        creator: t.creator || 'anonymous',
      })),
      total: BUILTIN_TOOLS.length + uploadedTools.length,
    },
    howToPay: {
      step1: 'Call any /api/* endpoint without payment → get 402 response with instructions',
      step2: 'Approve USDC and call registry.payForCall(toolId) on Base Sepolia',
      step3: 'Retry the request with header X-Payment-Tx: <tx_hash>',
    },
    toolManagement: {
      list: 'GET /api/tools',
      get: 'GET /api/tools/:id',
      create: 'POST /api/tools { name, endpoint, description?, pricePerCall?, category?, parameters?, creator? }',
      update: 'PUT /api/tools/:id { ...fields }',
      delete: 'DELETE /api/tools/:id',
    },
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ─── Export for Vercel ───────────────────────────────────

export default app;

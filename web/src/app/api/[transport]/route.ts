import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

const API_BASE = process.env.TOOLFI_API_URL || "https://toolfi.vercel.app";

// Helper to call our existing REST API
async function callToolfiApi(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(endpoint, API_BASE);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  
  const response = await fetch(url.toString());
  return response.json();
}

const handler = createMcpHandler(
  (server) => {
    // Tool 1: Crypto Price
    server.registerTool(
      "crypto_price",
      {
        title: "Crypto Price Oracle",
        description: "Get real-time cryptocurrency prices with 24h change, market cap, and liquidity data. Supports 1000+ tokens.",
        inputSchema: {
          symbol: z.string().describe("Token symbol or ID (e.g., bitcoin, ethereum, solana)"),
        },
      },
      async ({ symbol }) => {
        const data = await callToolfiApi("/api/price", { symbol });
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }
    );

    // Tool 2: Token Security (Rug Pull Scanner)
    server.registerTool(
      "token_security",
      {
        title: "Token Security Scanner",
        description: "Detect honeypots, hidden owners, tax mechanisms, and rug pull risks. Powered by GoPlus Security API.",
        inputSchema: {
          token: z.string().describe("Token contract address"),
          chain: z.string().optional().describe("Chain ID (1=ETH, 56=BSC, 8453=Base, 137=Polygon). Default: 1"),
        },
      },
      async ({ token, chain }) => {
        const data = await callToolfiApi("/api/rugcheck", { token, chain: chain || "1" });
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }
    );

    // Tool 3: DeFi Yields
    server.registerTool(
      "defi_yields",
      {
        title: "DeFi Yield Finder",
        description: "Find top DeFi yields across all chains. Filter by APY, TVL, stablecoin pools. Powered by DefiLlama.",
        inputSchema: {
          chain: z.string().optional().describe("Chain name (ethereum, base, arbitrum, etc.)"),
          minApy: z.string().optional().describe("Minimum APY percentage (default: 5)"),
          minTvl: z.string().optional().describe("Minimum TVL in USD (default: 1000000)"),
          stablecoinOnly: z.string().optional().describe("Only stablecoin pools (true/false)"),
        },
      },
      async ({ chain, minApy, minTvl, stablecoinOnly }) => {
        const data = await callToolfiApi("/api/yields", { 
          chain: chain || "", 
          minApy: minApy || "5", 
          minTvl: minTvl || "1000000",
          stablecoinOnly: stablecoinOnly || "false"
        });
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }
    );

    // Tool 4: Bridge Router
    server.registerTool(
      "bridge_quote",
      {
        title: "Cross-Chain Bridge Router",
        description: "Find optimal cross-chain bridge routes. Aggregates 30+ bridges via Li.Fi for best rates and speed.",
        inputSchema: {
          fromChain: z.string().describe("Source chain ID (1=ETH, 8453=Base, 42161=Arbitrum)"),
          toChain: z.string().describe("Destination chain ID"),
          fromToken: z.string().describe("Source token address"),
          toToken: z.string().describe("Destination token address"),
          amount: z.string().describe("Amount in wei (smallest unit)"),
        },
      },
      async ({ fromChain, toChain, fromToken, toToken, amount }) => {
        const data = await callToolfiApi("/api/bridge", { fromChain, toChain, fromToken, toToken, amount });
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }
    );

    // Tool 5: Swap Router
    server.registerTool(
      "swap_quote",
      {
        title: "DEX Swap Router",
        description: "Find optimal swap routes across DEXs. Aggregates Uniswap, Sushiswap, Curve and more via Li.Fi.",
        inputSchema: {
          chain: z.string().describe("Chain ID (1=ETH, 8453=Base, etc.)"),
          fromToken: z.string().describe("Source token address"),
          toToken: z.string().describe("Destination token address"),
          amount: z.string().describe("Amount in wei"),
        },
      },
      async ({ chain, fromToken, toToken, amount }) => {
        const data = await callToolfiApi("/api/swap", { chain, fromToken, toToken, amount });
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }
    );

    // Tool 6: Trending Coins
    server.registerTool(
      "trending_coins",
      {
        title: "Trending Coins",
        description: "Get top trending cryptocurrencies right now from CoinGecko.",
        inputSchema: {},
      },
      async () => {
        const data = await callToolfiApi("/api/trending");
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }
    );

    // Tool 7: Protocol TVL
    server.registerTool(
      "protocol_tvl",
      {
        title: "Protocol TVL",
        description: "Get Total Value Locked data for DeFi protocols via DefiLlama. Compare TVL across protocols.",
        inputSchema: {
          protocol: z.string().optional().describe("Protocol name (e.g., aave, uniswap). Leave empty for top 20."),
        },
      },
      async ({ protocol }) => {
        const data = await callToolfiApi("/api/tvl", { protocol: protocol || "" });
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }
    );

    // Tool 8: Gas Tracker
    server.registerTool(
      "gas_tracker",
      {
        title: "Gas Price Tracker",
        description: "Real-time gas prices for Ethereum, Polygon, Arbitrum. Get safe, standard, and fast estimates.",
        inputSchema: {
          chain: z.string().optional().describe("Chain ID (1=ETH, 137=Polygon, 42161=Arbitrum). Default: 1"),
        },
      },
      async ({ chain }) => {
        const data = await callToolfiApi("/api/gas", { chain: chain || "1" });
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }
    );
  },
  {},
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: true,
  }
);

export { handler as GET, handler as POST };

# ToolFi — API Marketplace for AI Agents

> "The next unicorn is an API marketplace for agents... where the right API should be selected by Claude and connected automatically" — [@auralix4](https://twitter.com/auralix4)

API marketplaces exist, but they're built for human developers. ToolFi is built for **AI workflows** — agents discover, select, and pay for APIs automatically, without human intervention.

🌐 **[Website](https://toolfi.dev)** · 📡 **[API](https://toolfi.vercel.app)** · 📜 **[Contract](https://sepolia.basescan.org/address/0x3D6C600799C67b45061eCAbfD5bBF8ef57Dded88)** · 🗺️ **[Roadmap](ROADMAP.md)**

## The Problem

AI agents need external data (prices, security checks, routes). Current solutions:
- **RapidAPI, etc.** — Built for humans. Agents can't browse and click "Subscribe"
- **Hardcoded keys** — Security risk, doesn't scale
- **Manual integration** — Every new tool needs human setup

## The Solution

**ToolFi** = APIs that agents can discover and use autonomously.

1. **Discovery** — Agents find tools via `.well-known/mcp.json`, MCP registries, semantic search
2. **Selection** — Rich descriptions help agents pick the right tool
3. **Payment** — USDC on Base, no API keys, just pay and use
4. **Data** — Structured responses optimized for LLM consumption

## How It Works

```
Agent → GET /api/price?symbol=ETH
                ↓
Server → 402 Payment Required
         { toolId, price, paymentInstructions }
                ↓
Agent → USDC.approve() → Registry.payForCall(toolId)
                ↓
Agent → Retry with X-Payment-Tx header
                ↓
Server → Verify on-chain → Return data
```

## Available Tools

| Tool | Price | What it does |
|------|-------|--------------|
| Crypto Price Oracle | 0.001 USDC | Real-time prices via DexScreener |
| Rug Pull Scanner | 0.003 USDC | Token security via GoPlus |
| Bridge Router | 0.002 USDC | Cross-chain routes via Li.Fi |
| DeFi Yield Finder | 0.002 USDC | Best yields via DefiLlama |
| Swap Router | 0.002 USDC | DEX aggregation via Li.Fi |
| Trending Coins | 0.001 USDC | What's hot via CoinGecko |
| Protocol TVL | 0.001 USDC | DeFi TVL data via DefiLlama |
| Gas Tracker | 0.0005 USDC | Gas prices for EVM chains |
| Wallet Risk Scanner | 0.005 USDC | Address risk analysis |
| News Digest | 0.002 USDC | Crypto news summary |

## Integration Options

### Option 1: HTTP API (Any Agent)

```bash
# Pay on-chain, then call with payment proof
curl -H "X-Payment-Tx: 0x..." "https://toolfi.vercel.app/api/price?symbol=ETH"
```

### Option 2: MCP Server (Claude Desktop)

```bash
cd mcp-server
uv venv && source .venv/bin/activate
uv pip install -e .
```

Add to Claude Desktop config:
```json
{
  "mcpServers": {
    "toolfi": {
      "command": "/path/to/.venv/bin/python",
      "args": ["-m", "src.server"],
      "cwd": "/path/to/mcp-server"
    }
  }
}
```

Then ask Claude: *"Check the security of token 0x... on Base"*

## For Tool Creators

Publish your API and earn USDC:

```bash
cast send $REGISTRY \
  "registerTool(string,string,string,uint256)" \
  "My Tool" "https://api.example.com" "Description" 10000 \
  --rpc-url https://sepolia.base.org --private-key $KEY
```

Price in 6 decimals: `10000` = $0.01/call

Withdraw earnings:
```bash
cast send $REGISTRY "withdraw()" --rpc-url https://sepolia.base.org
```

## Contract

| | |
|-|-|
| Chain | Base Sepolia (84532) |
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Registry | [`0x3D6C600799C67b45061eCAbfD5bBF8ef57Dded88`](https://sepolia.basescan.org/address/0x3D6C600799C67b45061eCAbfD5bBF8ef57Dded88) |

## Project Structure

```
toolfi/
├── api/           # Vercel serverless API
├── web/           # Next.js frontend
├── mcp-server/    # Python MCP server for Claude
├── src/           # Solidity contracts
├── skill/         # OpenClaw skill spec
└── script/        # Deployment scripts
```

## Development

```bash
# Contracts
forge build
forge test -v

# API
cd api && npm install && npm start

# MCP Server
cd mcp-server && uv pip install -e . && python -m src.server
```

## Roadmap

- [x] Core registry contract
- [x] Web API with 10 tools
- [x] MCP Server for Claude Desktop
- [ ] Mainnet deployment
- [ ] Creator dashboard
- [ ] Agent SDK (Python/TypeScript)
- [ ] Idempotency keys
- [ ] Usage analytics

## License

MIT

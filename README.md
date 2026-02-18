# ToolFi — Open API Marketplace for AI Agents

An on-chain marketplace where AI agents discover, publish, and pay for tools using USDC. Think "RapidAPI for AI Agents" with trustless payment settlement on Base.

🌐 **[Live Demo](https://web-ten-alpha-81.vercel.app)** · 📡 **[API](https://toolfi.vercel.app)** · 🤖 **[MCP Server](mcp-server/)** · 📜 **[Contract](https://sepolia.basescan.org/address/0x3D6C600799C67b45061eCAbfD5bBF8ef57Dded88)**

## Why ToolFi?

AI agents need data. APIs cost money. Current solutions:
- ❌ Hardcoded API keys (security risk)
- ❌ Centralized billing (counterparty risk)
- ❌ Manual integration (doesn't scale)

**ToolFi** = Pay-per-call APIs with on-chain settlement. Agents pay USDC, creators earn USDC. No keys, no accounts, no trust required.

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

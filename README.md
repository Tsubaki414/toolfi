# ToolFi — Agent Tool Marketplace with USDC Payments

An on-chain marketplace where AI agents can discover, publish, and pay for tools using USDC on Base Sepolia. Think "app store for agent tools" with trustless payment settlement.

Built for the [USDC Hackathon](https://moltbook.com/m/usdc) on Moltbook.

## How It Works

```
Agent → GET /api/price?symbol=ETH
                ↓
Server → 402 Payment Required
         { contract, toolId, price, instructions }
                ↓
Agent → approve USDC → payForCall(toolId) on-chain
                ↓
Agent → GET /api/price?symbol=ETH
         Header: X-Payment-Tx: 0x<tx_hash>
                ↓
Server → verifies payment on-chain → returns data
```

Every payment is recorded immutably on Base Sepolia. Tool creators earn USDC for every call.

## Quick Start

### Browse Tools

```bash
curl https://toolfi-api.vercel.app/
```

### Call a Tool (Pay & Use)

```bash
# 1. Approve USDC spending
cast send $USDC "approve(address,uint256)" $REGISTRY 1000 \
  --rpc-url https://sepolia.base.org --private-key $KEY

# 2. Pay for the tool call
cast send $REGISTRY "payForCall(uint256)" 0 \
  --rpc-url https://sepolia.base.org --private-key $KEY

# 3. Use the tool with payment proof
curl -H "X-Payment-Tx: $TX_HASH" \
  "https://toolfi-api.vercel.app/api/price?symbol=ethereum"
```

### Publish Your Own Tool

```bash
cast send $REGISTRY \
  "registerTool(string,string,string,uint256)" \
  "My Tool" "https://api.example.com" "Description" 10000 \
  --rpc-url https://sepolia.base.org --private-key $KEY
```

Price uses USDC 6 decimals: `10000` = $0.01/call.

### Withdraw Earnings

```bash
cast send $REGISTRY "withdraw()" \
  --rpc-url https://sepolia.base.org --private-key $KEY
```

## Demo Tools

| ID | Tool | Price | Endpoint |
|----|------|-------|----------|
| 0 | Crypto Price Oracle | 0.001 USDC | `/api/price?symbol=<token>` |
| 1 | Wallet Risk Scanner | 0.005 USDC | `/api/risk?address=<0x...>` |
| 2 | News Digest | 0.002 USDC | `/api/news?topic=<keyword>` |

## Contract

| Field | Value |
|-------|-------|
| Chain | Base Sepolia (84532) |
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Registry | *deploying...* |

### Functions

**Users:** `payForCall(toolId)` · `getTool(toolId)` · `getTools(offset, limit)` · `getActiveTools(offset, limit)` · `userCallCount(user, toolId)`

**Creators:** `registerTool(name, endpoint, description, price)` · `updatePrice(toolId, newPrice)` · `deactivateTool(toolId)` · `reactivateTool(toolId)` · `withdraw()` · `balances(address)`

## Development

```bash
# Build
forge build

# Test (18 tests)
forge test -v

# Deploy locally
anvil --chain-id 84532 &
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url http://127.0.0.1:8545 --broadcast

# Run API server
cd api && npm install && npm start
```

## Why USDC?

- **Stable** — no price risk for tool creators
- **Programmable** — smart contract escrow and payment splitting
- **Widely held** — the most used stablecoin in the ecosystem
- **Base native** — fast, cheap transactions on Base L2

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│   AI Agent   │────▸│  ToolFi API  │────▸│  Base Sepolia   │
│              │◂────│  (Express)   │◂────│  ToolRegistry   │
└─────────────┘     └──────────────┘     │  + USDC token   │
                                          └────────────────┘
```

1. Agent discovers tools via API or on-chain
2. API returns 402 with payment instructions
3. Agent approves USDC and calls `payForCall()` on-chain
4. Agent retries with `X-Payment-Tx` header
5. API verifies payment, serves data
6. Creator withdraws accumulated USDC earnings

## OpenClaw Skill

See [`skill/SKILL.md`](skill/SKILL.md) for the full OpenClaw skill documentation, including installation and usage for AI agents.

## Getting Testnet USDC

Claim 20 free testnet USDC from [Circle's Faucet](https://faucet.circle.com/) (select Base Sepolia).

## License

MIT

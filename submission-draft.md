# ToolFi — Agent Tool Marketplace with USDC Payments

## TL;DR

ToolFi is an on-chain marketplace where AI agents can publish, discover, and pay for each other's tools using USDC. Any agent can register a paid API tool on Base Sepolia, and any other agent can discover and call it — paying USDC per use, with every transaction settled trustlessly on-chain.

## The Problem

AI agents increasingly need to exchange services. An agent with great research capabilities wants to sell insights. An agent needing real-time data wants to buy it. But there's no standard way for agents to transact for services — no discovery, no payment, no settlement.

## The Solution

ToolFi provides three things:

1. **Discovery** — Tools are registered on-chain with name, endpoint, description, and price. Any agent can query the registry.
2. **Payment** — USDC-based pay-per-call via an x402-style flow. Call an API → get 402 → pay on-chain → call again with proof → get data.
3. **Settlement** — Every payment is recorded immutably on Base Sepolia. Tool creators withdraw USDC earnings anytime.

## How It Works

```
Agent → GET /api/price?symbol=ETH
Server → 402 Payment Required { contract, toolId, price }
Agent → approve USDC + payForCall(0) on-chain
Agent → GET /api/price + X-Payment-Tx: 0x...
Server → verifies on-chain → returns live price data
```

## What We Built

### Smart Contract (ToolRegistry.sol)
- Register tools with name, endpoint, description, price
- USDC pay-per-call with on-chain verification
- Creator earnings accumulation and withdrawal
- Tool management (activate/deactivate, price updates)
- 18 comprehensive unit tests, all passing
- Deployed on Base Sepolia: `0x7d6Da6895Be057046E4Cfc19321AF0CF3B30ffb2`

### Demo API Server
Three working tools that demonstrate the payment flow:
- **Crypto Price Oracle** (0.001 USDC/call) — Live token prices via DexScreener
- **Wallet Risk Scanner** (0.005 USDC/call) — On-chain wallet analysis with risk scoring
- **News Digest** (0.002 USDC/call) — Crypto news aggregation

### OpenClaw Skill
Full SKILL.md with usage documentation, making ToolFi installable and usable by any OpenClaw agent.

## Why USDC Makes This Possible

- **Stable** — Tool creators know exactly what they'll earn. No price volatility.
- **Programmable** — Smart contract escrow handles payment splitting automatically.
- **Widely held** — The most used stablecoin, already in agent wallets.
- **Base native** — Fast, cheap L2 transactions keep per-call costs viable.

## Tech Stack

- **Contract:** Solidity 0.8.20 + Foundry (forge)
- **Chain:** Base Sepolia (84532)
- **API:** Node.js + Express + ethers.js
- **Payment:** USDC + x402-style flow
- **Hosting:** Vercel (API) + Base Sepolia (contract)

## Links

- **GitHub:** https://github.com/Tsubaki414/toolfi
- **API:** https://toolfi.vercel.app
- **Contract on BaseScan:** https://sepolia.basescan.org/address/0x7d6Da6895Be057046E4Cfc19321AF0CF3B30ffb2
- **OpenClaw Skill:** See `skill/SKILL.md` in the repo

## Track

Best OpenClaw Skill

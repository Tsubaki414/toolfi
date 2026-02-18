# ToolFi Roadmap

> "The next unicorn is an API marketplace for agents... where the right API should be selected by Claude and connected automatically" — @auralix4

## Vision

API marketplaces exist, but they're built for human developers. ToolFi is built for **AI workflows** — agents discover, select, and connect to APIs without human intervention.

---

## Phase 1: Foundation ✅
*Completed*

- [x] Smart contract for payment tracking (Base Sepolia)
- [x] 10 crypto data tools (price, security, yields, bridge, etc.)
- [x] HTTP API with x402-style payment flow
- [x] Basic AEO files (.well-known/mcp.json, llms.txt)

**Status**: Tools work, but agents can't discover us automatically yet.

---

## Phase 2: Agent Discovery 🔄
*In Progress*

The missing piece: How does an agent **find** ToolFi when it needs crypto data?

### 2.1 MCP Registry Integration
- [ ] Register with official MCP server directories
- [ ] Submit to awesome-mcp-servers lists
- [ ] Integrate with Claude's tool discovery (when available)

### 2.2 Semantic Discovery
- [ ] Tool descriptions optimized for embedding search
- [ ] OpenAPI spec with rich descriptions
- [ ] Schema.org markup for tool definitions

### 2.3 Agent Framework Integration
- [ ] LangChain tool wrapper
- [ ] CrewAI integration
- [ ] AutoGPT plugin

**Goal**: When an agent thinks "I need to check if this token is safe", it finds ToolFi.

---

## Phase 3: Automatic Connection
*Planned*

Once discovered, agents should connect without human setup.

### 3.1 Zero-Config Authentication
- [ ] Wallet-based auth (agent signs with its wallet)
- [ ] No API keys needed — just pay and use

### 3.2 Smart Payment
- [ ] Agent auto-approves USDC for trusted tools
- [ ] Spending limits and budgets
- [ ] Payment batching for efficiency

### 3.3 Response Optimization
- [ ] Responses formatted for LLM consumption
- [ ] Token-efficient output modes
- [ ] Streaming for large responses

**Goal**: Agent calls tool in one step — discovery, auth, payment, data all automatic.

---

## Phase 4: Open Marketplace
*Future*

Let anyone list their API.

### 4.1 Provider Onboarding
- [ ] Self-service tool registration
- [ ] Pricing configuration
- [ ] Analytics dashboard

### 4.2 Quality & Trust
- [ ] Tool ratings and reviews (by agents)
- [ ] Uptime monitoring
- [ ] Response quality scoring

### 4.3 Economics
- [ ] Revenue sharing model
- [ ] Staking for premium placement
- [ ] Dispute resolution

**Goal**: Become the default place agents go to find and pay for APIs.

---

## Phase 5: Mainnet & Scale
*Future*

- [ ] Deploy to Base mainnet
- [ ] Multi-chain payment support
- [ ] Enterprise SLAs
- [ ] Geographic distribution

---

## Current Focus

**Phase 2.1** — Get indexed by MCP registries and agent tool directories.

An API marketplace where agents can't find you isn't a marketplace.

---

## Links

- Website: https://toolfi.dev
- API: https://toolfi.vercel.app
- Contract: [Base Sepolia](https://sepolia.basescan.org/address/0x3D6C600799C67b45061eCAbfD5bBF8ef57Dded88)
- GitHub: https://github.com/Tsubaki414/toolfi

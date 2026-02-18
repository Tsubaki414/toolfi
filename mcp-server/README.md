# ToolFi MCP Server

Python MCP Server for Claude Desktop. Provides crypto data tools.

## Tools

| Tool | Source | Description |
|------|--------|-------------|
| `token_security` | GoPlus | Token security scanning (honeypot, tax, blacklist) |
| `token_price` | CoinGecko | Token price by contract address |
| `crypto_price` | CoinGecko | Major coin prices (bitcoin, ethereum) |
| `defi_yields` | DefiLlama | DeFi yield opportunities |
| `bridge_quote` | Li.Fi | Cross-chain bridge quotes |
| `trending_coins` | CoinGecko | Trending cryptocurrencies |
| `supported_chains` | All | Supported chains list |

## Installation

```bash
cd mcp-server
uv venv && source .venv/bin/activate
uv pip install -e .
```

## Claude Desktop Config

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "toolfi": {
      "command": "/path/to/mcp-server/.venv/bin/python",
      "args": ["-m", "server"],
      "cwd": "/path/to/mcp-server"
    }
  }
}
```

## Usage Examples

In Claude Desktop:

```
Check the security of token 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 on Base
```

```
Find stablecoin pools on Ethereum with APY > 10%
```

```
Get a bridge quote for 1000 USDC from Ethereum to Base
```

## API Sources (all free tier)

- **GoPlus**: Token security scanning
- **CoinGecko**: Price data (30 calls/min free)
- **DefiLlama**: DeFi yields (unlimited)
- **Li.Fi**: Bridge routing (unlimited)

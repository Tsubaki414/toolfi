"""
Li.Fi API Wrapper

Provides cross-chain bridge and swap routing:
- Cross-chain token transfers
- DEX aggregation
- Route optimization

API Documentation: https://docs.li.fi/
Completely free for quotes, no API key required.
"""

import httpx
from typing import Optional, List
from pydantic import BaseModel
from enum import Enum


class RouteType(str, Enum):
    """Route preference type"""
    FASTEST = "fastest"
    CHEAPEST = "cheapest"
    SAFEST = "safest"


# Chain ID mapping
LIFI_CHAINS = {
    "ethereum": 1,
    "eth": 1,
    "arbitrum": 42161,
    "arb": 42161,
    "base": 8453,
    "optimism": 10,
    "op": 10,
    "polygon": 137,
    "matic": 137,
    "bsc": 56,
    "binance": 56,
    "avalanche": 43114,
    "avax": 43114,
    "fantom": 250,
    "ftm": 250,
    "gnosis": 100,
    "zksync": 324,
    "linea": 59144,
    "scroll": 534352,
    "blast": 81457,
    "mode": 34443,
    "mantle": 5000,
    "manta": 169,
    "solana": 1151111081099710,
}

# Common token addresses by chain
NATIVE_TOKENS = {
    1: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",  # ETH
    8453: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",  # ETH on Base
    42161: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",  # ETH on Arbitrum
    10: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",  # ETH on Optimism
    137: "0x0000000000000000000000000000000000001010",  # MATIC
    56: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",  # BNB
}

USDC_ADDRESSES = {
    1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    56: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
}


class BridgeQuote(BaseModel):
    """Bridge/swap quote result"""
    from_chain: str
    from_token: str
    from_amount: str
    from_amount_usd: float
    
    to_chain: str
    to_token: str
    to_amount: str
    to_amount_usd: float
    
    gas_cost_usd: float
    bridge_fee_usd: float
    total_fee_usd: float
    
    execution_time_seconds: int
    
    tool: str  # Bridge/DEX name
    steps: List[dict]
    
    slippage: float
    
    # Transaction data (if wallet provided)
    tx_data: Optional[dict] = None


class SupportedChain(BaseModel):
    """Supported blockchain info"""
    id: int
    name: str
    native_token: str
    native_token_symbol: str
    rpc_url: Optional[str] = None
    block_explorer: Optional[str] = None


class LiFiClient:
    """
    Li.Fi API Client
    
    Completely free for quotes. No API key required.
    
    Usage:
        client = LiFiClient()
        quote = await client.get_quote(
            from_chain="ethereum",
            to_chain="base",
            from_token="USDC",
            to_token="USDC",
            amount="1000000000"  # 1000 USDC (6 decimals)
        )
    """
    
    BASE_URL = "https://li.quest/v1"
    
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=60.0)
        self._chains_cache = None
    
    def _get_chain_id(self, chain: str) -> int:
        """Convert chain name to Li.Fi chain ID"""
        chain_lower = chain.lower().strip()
        if chain_lower in LIFI_CHAINS:
            return LIFI_CHAINS[chain_lower]
        # If it's already a number
        try:
            return int(chain)
        except ValueError:
            raise ValueError(f"Unknown chain: {chain}. Supported: {list(LIFI_CHAINS.keys())}")
    
    def _get_token_address(self, chain_id: int, token: str) -> str:
        """Get token address from symbol or return as-is if address"""
        token = token.strip()
        
        # If it's already an address
        if token.startswith("0x") and len(token) == 42:
            return token
        
        # Native token
        token_upper = token.upper()
        if token_upper in ["ETH", "MATIC", "BNB", "AVAX", "FTM", "NATIVE"]:
            return NATIVE_TOKENS.get(chain_id, "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE")
        
        # USDC
        if token_upper == "USDC":
            if chain_id in USDC_ADDRESSES:
                return USDC_ADDRESSES[chain_id]
            raise ValueError(f"USDC address not known for chain {chain_id}")
        
        raise ValueError(f"Unknown token: {token}. Provide full address or use ETH/USDC/NATIVE")
    
    async def get_chains(self) -> List[SupportedChain]:
        """
        Get all supported chains.
        
        Returns:
            List of supported blockchains
        """
        if self._chains_cache:
            return self._chains_cache
        
        url = f"{self.BASE_URL}/chains"
        response = await self.client.get(url)
        response.raise_for_status()
        
        data = response.json()
        
        chains = []
        for chain in data.get("chains", []):
            chains.append(SupportedChain(
                id=chain.get("id"),
                name=chain.get("name"),
                native_token=chain.get("nativeToken", {}).get("address", ""),
                native_token_symbol=chain.get("nativeToken", {}).get("symbol", ""),
                rpc_url=chain.get("metamask", {}).get("rpcUrls", [None])[0],
                block_explorer=chain.get("metamask", {}).get("blockExplorerUrls", [None])[0],
            ))
        
        self._chains_cache = chains
        return chains
    
    async def get_quote(
        self,
        from_chain: str,
        to_chain: str,
        from_token: str,
        to_token: str,
        amount: str,
        from_address: Optional[str] = None,
        to_address: Optional[str] = None,
        slippage: float = 0.5,
        route_preference: RouteType = RouteType.CHEAPEST,
    ) -> BridgeQuote:
        """
        Get a quote for bridging or swapping tokens.
        
        Args:
            from_chain: Source chain (e.g., "ethereum", "base")
            to_chain: Destination chain (e.g., "base", "arbitrum")
            from_token: Source token (address or "ETH", "USDC", "NATIVE")
            to_token: Destination token
            amount: Amount in smallest unit (e.g., "1000000" for 1 USDC)
            from_address: Sender wallet address (optional, needed for tx data)
            to_address: Recipient address (optional, defaults to from_address)
            slippage: Max slippage percentage (default 0.5%)
            route_preference: Optimize for fastest/cheapest/safest
            
        Returns:
            BridgeQuote with route details and transaction data
        """
        from_chain_id = self._get_chain_id(from_chain)
        to_chain_id = self._get_chain_id(to_chain)
        from_token_addr = self._get_token_address(from_chain_id, from_token)
        to_token_addr = self._get_token_address(to_chain_id, to_token)
        
        url = f"{self.BASE_URL}/quote"
        params = {
            "fromChain": from_chain_id,
            "toChain": to_chain_id,
            "fromToken": from_token_addr,
            "toToken": to_token_addr,
            "fromAmount": amount,
            "slippage": slippage / 100,  # API expects decimal (0.005 for 0.5%)
            "order": route_preference.value.upper(),
        }
        
        if from_address:
            params["fromAddress"] = from_address
        if to_address:
            params["toAddress"] = to_address
        
        response = await self.client.get(url, params=params)
        response.raise_for_status()
        
        data = response.json()
        
        # Parse estimate
        estimate = data.get("estimate", {})
        action = data.get("action", {})
        
        # Calculate fees
        gas_costs = estimate.get("gasCosts", [])
        total_gas = sum(float(g.get("amountUSD", 0)) for g in gas_costs)
        
        fee_costs = estimate.get("feeCosts", [])
        total_fees = sum(float(f.get("amountUSD", 0)) for f in fee_costs)
        
        # Parse steps
        steps = []
        for step in data.get("includedSteps", []):
            steps.append({
                "type": step.get("type"),
                "tool": step.get("tool"),
                "from_chain": step.get("action", {}).get("fromChainId"),
                "to_chain": step.get("action", {}).get("toChainId"),
            })
        
        return BridgeQuote(
            from_chain=from_chain,
            from_token=action.get("fromToken", {}).get("symbol", from_token),
            from_amount=amount,
            from_amount_usd=float(estimate.get("fromAmountUSD", 0)),
            
            to_chain=to_chain,
            to_token=estimate.get("toToken", {}).get("symbol", to_token),
            to_amount=estimate.get("toAmount", "0"),
            to_amount_usd=float(estimate.get("toAmountUSD", 0)),
            
            gas_cost_usd=total_gas,
            bridge_fee_usd=total_fees,
            total_fee_usd=total_gas + total_fees,
            
            execution_time_seconds=estimate.get("executionDuration", 0),
            
            tool=data.get("toolDetails", {}).get("name", "Li.Fi"),
            steps=steps,
            
            slippage=slippage,
            
            tx_data=data.get("transactionRequest") if from_address else None,
        )
    
    async def get_swap_quote(
        self,
        chain: str,
        from_token: str,
        to_token: str,
        amount: str,
        from_address: Optional[str] = None,
        slippage: float = 0.5,
    ) -> BridgeQuote:
        """
        Get a quote for same-chain swap (DEX aggregation).
        
        Convenience wrapper for get_quote when from_chain == to_chain.
        
        Args:
            chain: Blockchain (e.g., "base", "ethereum")
            from_token: Source token
            to_token: Destination token
            amount: Amount in smallest unit
            from_address: Sender wallet (optional)
            slippage: Max slippage percentage
            
        Returns:
            BridgeQuote with swap details
        """
        return await self.get_quote(
            from_chain=chain,
            to_chain=chain,
            from_token=from_token,
            to_token=to_token,
            amount=amount,
            from_address=from_address,
            slippage=slippage,
        )
    
    async def get_bridges(self) -> List[dict]:
        """
        Get list of supported bridges.
        
        Returns:
            List of bridge tools with names and supported chains
        """
        url = f"{self.BASE_URL}/tools"
        params = {"chains": ",".join(str(c) for c in LIFI_CHAINS.values())}
        
        response = await self.client.get(url, params=params)
        response.raise_for_status()
        
        data = response.json()
        
        bridges = []
        for bridge in data.get("bridges", []):
            bridges.append({
                "name": bridge.get("name"),
                "key": bridge.get("key"),
                "supported_chains": bridge.get("supportedChains", []),
            })
        
        return bridges
    
    async def get_token_info(self, chain: str, address: str) -> dict:
        """
        Get token information.
        
        Args:
            chain: Blockchain name
            address: Token contract address
            
        Returns:
            Token info including name, symbol, decimals
        """
        chain_id = self._get_chain_id(chain)
        
        url = f"{self.BASE_URL}/token"
        params = {"chain": chain_id, "token": address}
        
        response = await self.client.get(url, params=params)
        response.raise_for_status()
        
        data = response.json()
        
        return {
            "address": data.get("address"),
            "symbol": data.get("symbol"),
            "name": data.get("name"),
            "decimals": data.get("decimals"),
            "chain_id": data.get("chainId"),
            "logo_uri": data.get("logoURI"),
            "price_usd": data.get("priceUSD"),
        }
    
    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()


# Convenience functions
async def get_bridge_quote(
    from_chain: str,
    to_chain: str,
    from_token: str,
    to_token: str,
    amount: str
) -> BridgeQuote:
    """Quick bridge quote lookup."""
    client = LiFiClient()
    try:
        return await client.get_quote(
            from_chain=from_chain,
            to_chain=to_chain,
            from_token=from_token,
            to_token=to_token,
            amount=amount
        )
    finally:
        await client.close()


async def get_swap_quote(
    chain: str,
    from_token: str,
    to_token: str,
    amount: str
) -> BridgeQuote:
    """Quick swap quote lookup."""
    client = LiFiClient()
    try:
        return await client.get_swap_quote(
            chain=chain,
            from_token=from_token,
            to_token=to_token,
            amount=amount
        )
    finally:
        await client.close()

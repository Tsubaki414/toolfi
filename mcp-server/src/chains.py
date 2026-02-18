"""
链ID映射和配置
"""

from typing import Dict, Optional, Literal

# GoPlus 支持的链
GOPLUS_CHAINS: Dict[str, str] = {
    "ethereum": "1",
    "eth": "1",
    "bsc": "56",
    "binance": "56",
    "polygon": "137",
    "matic": "137",
    "arbitrum": "42161",
    "arb": "42161",
    "base": "8453",
    "optimism": "10",
    "op": "10",
    "avalanche": "43114",
    "avax": "43114",
    "solana": "solana",
    "sol": "solana",
    "linea": "59144",
    "zksync": "324",
    "scroll": "534352",
    "blast": "81457",
    "mantle": "5000",
}

# CoinGecko 平台ID
COINGECKO_PLATFORMS: Dict[str, str] = {
    "ethereum": "ethereum",
    "eth": "ethereum",
    "bsc": "binance-smart-chain",
    "binance": "binance-smart-chain",
    "polygon": "polygon-pos",
    "matic": "polygon-pos",
    "arbitrum": "arbitrum-one",
    "arb": "arbitrum-one",
    "base": "base",
    "optimism": "optimistic-ethereum",
    "op": "optimistic-ethereum",
    "avalanche": "avalanche",
    "avax": "avalanche",
    "solana": "solana",
    "sol": "solana",
}

# Li.Fi 链key
LIFI_CHAINS: Dict[str, int] = {
    "ethereum": 1,
    "eth": 1,
    "arbitrum": 42161,
    "arb": 42161,
    "base": 8453,
    "polygon": 137,
    "matic": 137,
    "optimism": 10,
    "op": 10,
    "bsc": 56,
    "binance": 56,
    "avalanche": 43114,
    "avax": 43114,
}

# DefiLlama 链名（需要大写首字母）
DEFILLAMA_CHAINS: Dict[str, str] = {
    "ethereum": "Ethereum",
    "eth": "Ethereum",
    "bsc": "BSC",
    "binance": "BSC",
    "polygon": "Polygon",
    "matic": "Polygon",
    "arbitrum": "Arbitrum",
    "arb": "Arbitrum",
    "base": "Base",
    "optimism": "Optimism",
    "op": "Optimism",
    "avalanche": "Avalanche",
    "avax": "Avalanche",
    "solana": "Solana",
    "sol": "Solana",
}


def get_goplus_chain_id(chain: str) -> Optional[str]:
    """获取GoPlus链ID"""
    return GOPLUS_CHAINS.get(chain.lower())


def get_coingecko_platform(chain: str) -> Optional[str]:
    """获取CoinGecko平台ID"""
    return COINGECKO_PLATFORMS.get(chain.lower())


def get_lifi_chain_id(chain: str) -> Optional[int]:
    """获取Li.Fi链ID"""
    return LIFI_CHAINS.get(chain.lower())


def get_defillama_chain(chain: str) -> Optional[str]:
    """获取DefiLlama链名"""
    return DEFILLAMA_CHAINS.get(chain.lower())


ChainName = Literal[
    "ethereum", "eth", "bsc", "binance", "polygon", "matic",
    "arbitrum", "arb", "base", "optimism", "op", "avalanche",
    "avax", "solana", "sol"
]

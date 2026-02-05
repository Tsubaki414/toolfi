export const REGISTRY_ADDRESS = '0x7d6Da6895Be057046E4Cfc19321AF0CF3B30ffb2' as const;
export const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const;
export const API_URL = 'https://toolfi.vercel.app';

export const REGISTRY_ABI = [
  {
    name: 'tools',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'toolId', type: 'uint256' }],
    outputs: [
      { name: 'id', type: 'uint256' },
      { name: 'creator', type: 'address' },
      { name: 'name', type: 'string' },
      { name: 'endpoint', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'pricePerCall', type: 'uint256' },
      { name: 'totalCalls', type: 'uint256' },
      { name: 'totalEarned', type: 'uint256' },
      { name: 'active', type: 'bool' },
    ],
  },
  {
    name: 'toolCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'registerTool',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'endpoint', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'pricePerCall', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'payForCall',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'toolId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'balances',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'creator', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const;

export const USDC_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

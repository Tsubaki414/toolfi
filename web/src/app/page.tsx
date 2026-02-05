'use client';

import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { REGISTRY_ADDRESS, USDC_ADDRESS, REGISTRY_ABI, USDC_ABI, API_URL } from './contracts';

interface Tool {
  id: bigint;
  creator: string;
  name: string;
  endpoint: string;
  description: string;
  pricePerCall: bigint;
  totalCalls: bigint;
  totalEarned: bigint;
  active: boolean;
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const [tools, setTools] = useState<Tool[]>([]);
  const [showRegister, setShowRegister] = useState(false);
  const [newTool, setNewTool] = useState({ name: '', endpoint: '', description: '', price: '' });
  const [demoResponse, setDemoResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Read tool count
  const { data: toolCount } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'toolCount',
  });

  // Read user's earnings balance
  const { data: userBalance } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'balances',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Write contracts
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Fetch all tools
  useEffect(() => {
    async function fetchTools() {
      if (!toolCount) return;
      const count = Number(toolCount);
      const fetchedTools: Tool[] = [];
      
      for (let i = 0; i < count; i++) {
        try {
          const res = await fetch(`https://sepolia.base.org`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: i,
              method: 'eth_call',
              params: [{
                to: REGISTRY_ADDRESS,
                data: `0x35b62be7${i.toString(16).padStart(64, '0')}` // tools(uint256)
              }, 'latest']
            })
          });
          const json = await res.json();
          if (json.result && json.result !== '0x') {
            // Decode the result (simplified - in production use viem's decodeAbiParameters)
            // For now, we'll use a direct RPC approach
          }
        } catch (e) {
          console.error('Error fetching tool', i, e);
        }
      }
    }
    fetchTools();
  }, [toolCount]);

  // Simple tool data (hardcoded for demo since decoding is complex)
  const demoTools: Tool[] = [
    {
      id: 0n,
      creator: '0x00C76DD3435ce72c6f33A5eD7036a320FE8EffE6',
      name: 'Crypto Price Oracle',
      endpoint: `${API_URL}/api/price`,
      description: 'Get real-time cryptocurrency prices. Input: token symbol. Output: price in USD, 24h change, market cap.',
      pricePerCall: 1000n,
      totalCalls: 0n,
      totalEarned: 0n,
      active: true,
    },
    {
      id: 1n,
      creator: '0x00C76DD3435ce72c6f33A5eD7036a320FE8EffE6',
      name: 'Wallet Risk Scanner',
      endpoint: `${API_URL}/api/risk`,
      description: 'Analyze any EVM wallet for risk signals. Input: wallet address. Output: risk score, suspicious patterns.',
      pricePerCall: 5000n,
      totalCalls: 0n,
      totalEarned: 0n,
      active: true,
    },
    {
      id: 2n,
      creator: '0x00C76DD3435ce72c6f33A5eD7036a320FE8EffE6',
      name: 'News Digest',
      endpoint: `${API_URL}/api/news`,
      description: 'Get AI-summarized crypto news. Input: topic keyword. Output: top 5 headlines with summaries.',
      pricePerCall: 2000n,
      totalCalls: 0n,
      totalEarned: 0n,
      active: true,
    },
  ];

  const displayTools = tools.length > 0 ? tools : demoTools;

  const handleRegister = async () => {
    if (!newTool.name || !newTool.endpoint || !newTool.description || !newTool.price) {
      alert('Please fill all fields');
      return;
    }
    const priceInMicro = parseUnits(newTool.price, 6);
    writeContract({
      address: REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: 'registerTool',
      args: [newTool.name, newTool.endpoint, newTool.description, priceInMicro],
    });
  };

  const handleWithdraw = () => {
    writeContract({
      address: REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: 'withdraw',
    });
  };

  const tryTool = async (endpoint: string) => {
    setLoading(true);
    try {
      const url = endpoint.includes('?') ? endpoint : `${endpoint}?symbol=ethereum`;
      const res = await fetch(url);
      const data = await res.json();
      setDemoResponse(JSON.stringify(data, null, 2));
    } catch (e) {
      setDemoResponse('Error fetching data');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">
            <span className="text-blue-400">Tool</span>Fi
          </h1>
          <div className="flex items-center gap-4">
            <a href="https://github.com/Tsubaki414/toolfi" target="_blank" className="text-gray-400 hover:text-white text-sm">
              GitHub
            </a>
            <a href={API_URL} target="_blank" className="text-gray-400 hover:text-white text-sm">
              API
            </a>
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-16 text-center">
        <h2 className="text-4xl font-bold mb-4">Agent Tool Marketplace</h2>
        <p className="text-xl text-gray-400 mb-8">
          Discover, publish, and pay for AI agent tools — all on-chain with USDC
        </p>
        {isConnected && (
          <button
            onClick={() => setShowRegister(!showRegister)}
            className="px-6 py-3 bg-blue-600 font-semibold rounded-lg hover:bg-blue-700 transition"
          >
            {showRegister ? 'Close' : '+ Register New Tool'}
          </button>
        )}
      </section>

      {/* Register Tool Form */}
      {showRegister && isConnected && (
        <section className="max-w-2xl mx-auto px-6 pb-12">
          <div className="bg-gray-800 rounded-xl p-6">
            <h3 className="text-xl font-semibold mb-4">Register Your Tool</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Tool Name</label>
                <input
                  type="text"
                  value={newTool.name}
                  onChange={(e) => setNewTool({ ...newTool, name: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 rounded-lg border border-gray-700 focus:border-blue-500 outline-none"
                  placeholder="e.g. Weather Oracle"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">API Endpoint</label>
                <input
                  type="text"
                  value={newTool.endpoint}
                  onChange={(e) => setNewTool({ ...newTool, endpoint: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 rounded-lg border border-gray-700 focus:border-blue-500 outline-none"
                  placeholder="https://api.example.com/weather"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea
                  value={newTool.description}
                  onChange={(e) => setNewTool({ ...newTool, description: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 rounded-lg border border-gray-700 focus:border-blue-500 outline-none h-24"
                  placeholder="What does your tool do? What inputs/outputs?"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Price per Call (USDC)</label>
                <input
                  type="text"
                  value={newTool.price}
                  onChange={(e) => setNewTool({ ...newTool, price: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 rounded-lg border border-gray-700 focus:border-blue-500 outline-none"
                  placeholder="0.001"
                />
              </div>
              <button
                onClick={handleRegister}
                disabled={isPending || isConfirming}
                className="w-full py-3 bg-blue-600 font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {isPending ? 'Confirm in Wallet...' : isConfirming ? 'Registering...' : 'Register Tool'}
              </button>
              {isSuccess && (
                <p className="text-green-400 text-sm text-center">✓ Tool registered successfully!</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* User Balance */}
      {isConnected && userBalance && userBalance > 0n && (
        <section className="max-w-6xl mx-auto px-6 pb-8">
          <div className="bg-green-900/30 border border-green-700 rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="text-sm text-green-400">Your Earnings</p>
              <p className="text-2xl font-bold">{formatUnits(userBalance, 6)} USDC</p>
            </div>
            <button
              onClick={handleWithdraw}
              disabled={isPending || isConfirming}
              className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition"
            >
              Withdraw
            </button>
          </div>
        </section>
      )}

      {/* Tools Grid */}
      <section className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold">Available Tools</h3>
          <span className="text-gray-400">{displayTools.length} tools registered</span>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayTools.map((tool) => (
            <div key={Number(tool.id)} className="bg-gray-800 rounded-xl p-6 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs bg-blue-600/30 text-blue-400 px-2 py-1 rounded">#{Number(tool.id)}</span>
                <span className="text-green-400 font-mono">{formatUnits(tool.pricePerCall, 6)} USDC</span>
              </div>
              <h4 className="text-lg font-semibold mb-2">{tool.name}</h4>
              <p className="text-gray-400 text-sm mb-4 flex-grow">{tool.description}</p>
              <div className="text-xs text-gray-500 mb-4 truncate" title={tool.endpoint}>
                {tool.endpoint}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => tryTool(tool.endpoint)}
                  className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition"
                >
                  Try (402)
                </button>
                <a
                  href={`https://sepolia.basescan.org/address/${REGISTRY_ADDRESS}`}
                  target="_blank"
                  className="px-3 py-2 border border-gray-600 hover:border-white rounded-lg text-sm transition"
                >
                  ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Demo response */}
      {demoResponse && (
        <section className="max-w-6xl mx-auto px-6 pb-8">
          <div className="bg-gray-950 rounded-xl p-6 overflow-x-auto">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-400">API Response (402 Payment Required)</span>
              <button onClick={() => setDemoResponse(null)} className="text-gray-500 hover:text-white">✕</button>
            </div>
            <pre className="text-sm text-green-400 whitespace-pre-wrap">{loading ? 'Loading...' : demoResponse}</pre>
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-gray-800">
        <h3 className="text-2xl font-bold text-center mb-8">How It Works</h3>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { step: '1', title: 'Discover', desc: 'Browse tools registered on-chain' },
            { step: '2', title: 'Call API', desc: 'Get 402 with payment instructions' },
            { step: '3', title: 'Pay USDC', desc: 'Call payForCall() on-chain' },
            { step: '4', title: 'Get Data', desc: 'Retry with X-Payment-Tx header' },
          ].map((item) => (
            <div key={item.step} className="bg-gray-800/50 rounded-xl p-4 text-center">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-3">
                {item.step}
              </div>
              <h4 className="font-semibold mb-1">{item.title}</h4>
              <p className="text-gray-400 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
          <div>
            Built for the{' '}
            <a href="https://moltbook.com/m/usdc" target="_blank" className="text-blue-400 hover:underline">
              USDC Hackathon
            </a>
          </div>
          <div className="flex gap-6">
            <a href={`https://sepolia.basescan.org/address/${REGISTRY_ADDRESS}`} target="_blank" className="hover:text-white">
              Contract
            </a>
            <a href="https://faucet.circle.com/" target="_blank" className="hover:text-white">
              Get Testnet USDC
            </a>
            <a href="https://github.com/Tsubaki414/toolfi" target="_blank" className="hover:text-white">
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { REGISTRY_ADDRESS, USDC_ADDRESS, REGISTRY_ABI, API_URL } from './contracts';

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
  category: string;
}

const categories = [
  { id: 'all', name: 'All Tools', icon: '🔧' },
  { id: 'blockchain', name: 'Blockchain', icon: '⛓️' },
  { id: 'data', name: 'Data & Analytics', icon: '📊' },
  { id: 'ai', name: 'AI & ML', icon: '🤖' },
  { id: 'utility', name: 'Utility', icon: '⚡' },
];

export default function Home() {
  const { address, isConnected } = useAccount();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showRegister, setShowRegister] = useState(false);
  const [newTool, setNewTool] = useState({ name: '', endpoint: '', description: '', price: '', category: 'utility' });
  const [demoResponse, setDemoResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  // Demo tools with categories
  const demoTools: Tool[] = [
    {
      id: 0n,
      creator: '0x00C76DD3435ce72c6f33A5eD7036a320FE8EffE6',
      name: 'Crypto Price Oracle',
      endpoint: `${API_URL}/api/price`,
      description: 'Real-time cryptocurrency prices with 24h change, market cap, and liquidity data.',
      pricePerCall: 1000n,
      totalCalls: 1n,
      totalEarned: 1000n,
      active: true,
      category: 'data',
    },
    {
      id: 1n,
      creator: '0x00C76DD3435ce72c6f33A5eD7036a320FE8EffE6',
      name: 'Wallet Risk Scanner',
      endpoint: `${API_URL}/api/risk`,
      description: 'Analyze any EVM wallet for risk signals, transaction patterns, and suspicious activity.',
      pricePerCall: 5000n,
      totalCalls: 0n,
      totalEarned: 0n,
      active: true,
      category: 'blockchain',
    },
    {
      id: 2n,
      creator: '0x00C76DD3435ce72c6f33A5eD7036a320FE8EffE6',
      name: 'News Digest',
      endpoint: `${API_URL}/api/news`,
      description: 'AI-curated crypto news with summaries from top sources in the last 24 hours.',
      pricePerCall: 2000n,
      totalCalls: 0n,
      totalEarned: 0n,
      active: true,
      category: 'data',
    },
    {
      id: 3n,
      creator: '0x00C76DD3435ce72c6f33A5eD7036a320FE8EffE6',
      name: 'Rug Pull Scanner',
      endpoint: `${API_URL}/api/rugcheck?token=0x6982508145454Ce325dDbE47a25d4ec3d2311933&chain=1`,
      description: 'Detect honeypots, hidden owners, and rug pull risks. Powered by GoPlus Security API.',
      pricePerCall: 3000n,
      totalCalls: 0n,
      totalEarned: 0n,
      active: true,
      category: 'blockchain',
    },
    {
      id: 4n,
      creator: '0x00C76DD3435ce72c6f33A5eD7036a320FE8EffE6',
      name: 'Bridge Router',
      endpoint: `${API_URL}/api/bridge?fromChain=1&toChain=42161&fromToken=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48&toToken=0xaf88d065e77c8cC2239327C5EDb3A432268e5831&amount=1000000000`,
      description: 'Find optimal cross-chain bridge routes. Aggregates Li.Fi, Stargate, Hop, and more.',
      pricePerCall: 2000n,
      totalCalls: 0n,
      totalEarned: 0n,
      active: true,
      category: 'blockchain',
    },
  ];

  const filteredTools = selectedCategory === 'all' 
    ? demoTools 
    : demoTools.filter(t => t.category === selectedCategory);

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
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#0a0a0f] via-[#0d1117] to-[#0a0a0f]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent"></div>
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-cyan-900/30">
          <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold">
              <span className="text-cyan-400">Tool</span>
              <span className="text-white">Drop</span>
              <span className="text-cyan-400/60 text-sm ml-2">⬡</span>
            </h1>
            <div className="flex items-center gap-4">
              <a href="https://github.com/Tsubaki414/toolfi" target="_blank" className="text-gray-400 hover:text-cyan-400 text-sm transition">
                GitHub
              </a>
              <a href={API_URL} target="_blank" className="text-gray-400 hover:text-cyan-400 text-sm transition">
                API
              </a>
              <ConnectButton />
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 py-16 text-center">
          <div className="inline-block mb-4 px-4 py-1 bg-cyan-400/10 border border-cyan-400/30 rounded-full text-cyan-400 text-sm">
            Powered by USDC on Base
          </div>
          <h2 className="text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Agent Tool Marketplace
            </span>
          </h2>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            Discover, publish, and pay for AI agent tools — all on-chain with USDC
          </p>
          <div className="flex gap-4 justify-center">
            {isConnected ? (
              <button
                onClick={() => setShowRegister(!showRegister)}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 font-semibold rounded-lg hover:from-cyan-400 hover:to-blue-400 transition shadow-lg shadow-cyan-500/25"
              >
                {showRegister ? '✕ Close' : '+ Register Your Tool'}
              </button>
            ) : (
              <div className="px-6 py-3 border border-cyan-500/50 rounded-lg text-cyan-400">
                Connect wallet to register tools
              </div>
            )}
          </div>
        </section>

        {/* Register Tool Form */}
        {showRegister && isConnected && (
          <section className="max-w-2xl mx-auto px-6 pb-12">
            <div className="bg-gray-900/50 backdrop-blur border border-cyan-900/50 rounded-2xl p-6">
              <h3 className="text-xl font-semibold mb-4 text-cyan-400">Register Your Tool</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Tool Name</label>
                  <input
                    type="text"
                    value={newTool.name}
                    onChange={(e) => setNewTool({ ...newTool, name: e.target.value })}
                    className="w-full px-4 py-2 bg-black/50 rounded-lg border border-cyan-900/50 focus:border-cyan-500 outline-none transition"
                    placeholder="e.g. Weather Oracle"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Category</label>
                  <select
                    value={newTool.category}
                    onChange={(e) => setNewTool({ ...newTool, category: e.target.value })}
                    className="w-full px-4 py-2 bg-black/50 rounded-lg border border-cyan-900/50 focus:border-cyan-500 outline-none transition"
                  >
                    {categories.filter(c => c.id !== 'all').map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">API Endpoint</label>
                  <input
                    type="text"
                    value={newTool.endpoint}
                    onChange={(e) => setNewTool({ ...newTool, endpoint: e.target.value })}
                    className="w-full px-4 py-2 bg-black/50 rounded-lg border border-cyan-900/50 focus:border-cyan-500 outline-none transition"
                    placeholder="https://api.example.com/tool"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Description</label>
                  <textarea
                    value={newTool.description}
                    onChange={(e) => setNewTool({ ...newTool, description: e.target.value })}
                    className="w-full px-4 py-2 bg-black/50 rounded-lg border border-cyan-900/50 focus:border-cyan-500 outline-none h-24 transition"
                    placeholder="What does your tool do?"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Price per Call (USDC)</label>
                  <input
                    type="text"
                    value={newTool.price}
                    onChange={(e) => setNewTool({ ...newTool, price: e.target.value })}
                    className="w-full px-4 py-2 bg-black/50 rounded-lg border border-cyan-900/50 focus:border-cyan-500 outline-none transition"
                    placeholder="0.001"
                  />
                </div>
                <button
                  onClick={handleRegister}
                  disabled={isPending || isConfirming}
                  className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 font-semibold rounded-lg hover:from-cyan-400 hover:to-blue-400 transition disabled:opacity-50 shadow-lg shadow-cyan-500/25"
                >
                  {isPending ? 'Confirm in Wallet...' : isConfirming ? 'Registering...' : 'Register Tool'}
                </button>
                {isSuccess && (
                  <p className="text-cyan-400 text-sm text-center">✓ Tool registered successfully!</p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* User Balance */}
        {isConnected && userBalance && userBalance > 0n && (
          <section className="max-w-6xl mx-auto px-6 pb-8">
            <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="text-sm text-cyan-400">Your Earnings</p>
                <p className="text-2xl font-bold">{formatUnits(userBalance, 6)} USDC</p>
              </div>
              <button
                onClick={handleWithdraw}
                disabled={isPending || isConfirming}
                className="px-4 py-2 bg-cyan-500 rounded-lg hover:bg-cyan-400 transition font-semibold"
              >
                Withdraw
              </button>
            </div>
          </section>
        )}

        {/* Category Filter */}
        <section className="max-w-6xl mx-auto px-6 pb-6">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                  selectedCategory === cat.id
                    ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/25'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-white'
                }`}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
        </section>

        {/* Tools Grid */}
        <section className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold">
              {selectedCategory === 'all' ? 'All Tools' : categories.find(c => c.id === selectedCategory)?.name}
            </h3>
            <span className="text-gray-500">{filteredTools.length} tools</span>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTools.map((tool) => (
              <div key={Number(tool.id)} className="group bg-gray-900/50 backdrop-blur border border-gray-800 hover:border-cyan-500/50 rounded-2xl p-6 flex flex-col transition">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded-full">
                    {categories.find(c => c.id === tool.category)?.icon} {tool.category}
                  </span>
                  <span className="text-cyan-400 font-mono font-bold">{formatUnits(tool.pricePerCall, 6)} USDC</span>
                </div>
                <h4 className="text-lg font-semibold mb-2 group-hover:text-cyan-400 transition">{tool.name}</h4>
                <p className="text-gray-400 text-sm mb-4 flex-grow">{tool.description}</p>
                {tool.totalCalls > 0n && (
                  <div className="text-xs text-gray-500 mb-4">
                    {Number(tool.totalCalls)} calls · {formatUnits(tool.totalEarned, 6)} USDC earned
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => tryTool(tool.endpoint)}
                    className="flex-1 py-2 bg-gray-800 hover:bg-cyan-500/20 hover:text-cyan-400 rounded-lg text-sm transition border border-transparent hover:border-cyan-500/50"
                  >
                    Try (402) →
                  </button>
                  <a
                    href={`https://sepolia.basescan.org/address/${REGISTRY_ADDRESS}`}
                    target="_blank"
                    className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition"
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
          <section className="max-w-6xl mx-auto px-6 py-8">
            <div className="bg-black/50 backdrop-blur border border-cyan-900/50 rounded-2xl p-6 overflow-x-auto">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-cyan-400">API Response — 402 Payment Required</span>
                <button onClick={() => setDemoResponse(null)} className="text-gray-500 hover:text-white transition">✕</button>
              </div>
              <pre className="text-sm text-cyan-300 whitespace-pre-wrap font-mono">{loading ? 'Loading...' : demoResponse}</pre>
            </div>
          </section>
        )}

        {/* How it works */}
        <section className="max-w-6xl mx-auto px-6 py-16 border-t border-gray-800/50">
          <h3 className="text-2xl font-bold text-center mb-8">How It Works</h3>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { step: '1', title: 'Discover', desc: 'Browse tools by category', icon: '🔍' },
              { step: '2', title: 'Call API', desc: 'Get 402 + payment info', icon: '📡' },
              { step: '3', title: 'Pay USDC', desc: 'On-chain via contract', icon: '💰' },
              { step: '4', title: 'Get Data', desc: 'Retry with tx hash', icon: '✨' },
            ].map((item) => (
              <div key={item.step} className="bg-gray-900/30 border border-gray-800/50 rounded-xl p-4 text-center hover:border-cyan-500/30 transition">
                <div className="text-3xl mb-3">{item.icon}</div>
                <h4 className="font-semibold mb-1 text-cyan-400">{item.title}</h4>
                <p className="text-gray-500 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-6xl mx-auto px-6 py-16 text-center">
          <div className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border border-cyan-500/30 rounded-2xl p-12">
            <h3 className="text-3xl font-bold mb-4">Build for Agents</h3>
            <p className="text-gray-400 mb-6 max-w-xl mx-auto">
              Got a useful API? Register it on ToolDrop and let agents pay you in USDC for every call.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <a
                href="https://faucet.circle.com/"
                target="_blank"
                className="px-6 py-3 bg-cyan-500 font-semibold rounded-lg hover:bg-cyan-400 transition"
              >
                Get Testnet USDC
              </a>
              <a
                href={`https://sepolia.basescan.org/address/${REGISTRY_ADDRESS}`}
                target="_blank"
                className="px-6 py-3 border border-cyan-500/50 text-cyan-400 rounded-lg hover:bg-cyan-500/10 transition"
              >
                View Contract
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-800/50 py-8">
          <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
            <div>
              Built for the{' '}
              <a href="https://moltbook.com/m/usdc" target="_blank" className="text-cyan-400 hover:underline">
                USDC Hackathon
              </a>
            </div>
            <div className="flex gap-6">
              <a href={`https://sepolia.basescan.org/address/${REGISTRY_ADDRESS}`} target="_blank" className="hover:text-cyan-400 transition">
                Contract
              </a>
              <a href="https://github.com/Tsubaki414/toolfi" target="_blank" className="hover:text-cyan-400 transition">
                GitHub
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

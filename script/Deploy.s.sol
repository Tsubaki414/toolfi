// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/ToolRegistry.sol";

contract DeployScript is Script {
    // Base Sepolia USDC
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        ToolRegistry registry = new ToolRegistry(USDC);
        console.log("ToolRegistry deployed at:", address(registry));

        // Register 3 demo tools
        registry.registerTool(
            "Crypto Price Oracle",
            "https://toolfi-api.vercel.app/api/price",
            "Get real-time cryptocurrency prices. Input: token symbol or address. Output: price in USD, 24h change, market cap.",
            1000 // 0.001 USDC per call
        );
        console.log("Tool 0: Crypto Price Oracle registered");

        registry.registerTool(
            "Wallet Risk Scanner",
            "https://toolfi-api.vercel.app/api/risk",
            "Analyze any EVM wallet for risk signals. Input: wallet address. Output: risk score, token diversity, suspicious patterns.",
            5000 // 0.005 USDC per call
        );
        console.log("Tool 1: Wallet Risk Scanner registered");

        registry.registerTool(
            "News Digest",
            "https://toolfi-api.vercel.app/api/news",
            "Get AI-summarized crypto news. Input: topic keyword. Output: top 5 headlines with summaries from the last 24h.",
            2000 // 0.002 USDC per call
        );
        console.log("Tool 2: News Digest registered");

        vm.stopBroadcast();
    }
}

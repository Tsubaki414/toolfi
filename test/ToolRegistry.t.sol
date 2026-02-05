// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ToolRegistry.sol";
import "../src/IERC20.sol";

/// @dev Minimal ERC20 for testing
contract MockUSDC is IERC20 {
    string public name = "USD Coin";
    string public symbol = "USDC";
    uint8 public decimals = 6;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "not approved");
        require(balanceOf[from] >= amount, "insufficient");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

contract ToolRegistryTest is Test {
    ToolRegistry public registry;
    MockUSDC public usdc;

    address creator = address(0xC1);
    address caller = address(0xC2);

    function setUp() public {
        usdc = new MockUSDC();
        registry = new ToolRegistry(address(usdc));

        // Give caller some USDC
        usdc.mint(caller, 1_000_000); // 1 USDC
    }

    // ─── Registration ────────────────────────────────────────

    function test_registerTool() public {
        vm.prank(creator);
        uint256 id = registry.registerTool(
            "Price Oracle",
            "https://api.toolfi.dev/price",
            "Get real-time crypto prices",
            10_000 // 0.01 USDC
        );

        assertEq(id, 0);
        assertEq(registry.toolCount(), 1);

        ToolRegistry.Tool memory t = registry.getTool(0);
        assertEq(t.creator, creator);
        assertEq(t.name, "Price Oracle");
        assertEq(t.pricePerCall, 10_000);
        assertTrue(t.active);
        assertEq(t.totalCalls, 0);
    }

    function test_registerMultipleTools() public {
        vm.startPrank(creator);
        registry.registerTool("Tool A", "https://a.com", "A", 10_000);
        registry.registerTool("Tool B", "https://b.com", "B", 20_000);
        registry.registerTool("Tool C", "https://c.com", "C", 30_000);
        vm.stopPrank();

        assertEq(registry.toolCount(), 3);
    }

    function test_revert_emptyName() public {
        vm.prank(creator);
        vm.expectRevert(ToolRegistry.EmptyName.selector);
        registry.registerTool("", "https://x.com", "desc", 10_000);
    }

    function test_revert_emptyEndpoint() public {
        vm.prank(creator);
        vm.expectRevert(ToolRegistry.EmptyEndpoint.selector);
        registry.registerTool("Tool", "", "desc", 10_000);
    }

    function test_revert_zeroPrice() public {
        vm.prank(creator);
        vm.expectRevert(ToolRegistry.ZeroPrice.selector);
        registry.registerTool("Tool", "https://x.com", "desc", 0);
    }

    // ─── Payments ────────────────────────────────────────────

    function test_payForCall() public {
        // Register a tool
        vm.prank(creator);
        registry.registerTool("Oracle", "https://api.com", "Prices", 10_000);

        // Caller approves and pays
        vm.startPrank(caller);
        usdc.approve(address(registry), 10_000);
        registry.payForCall(0);
        vm.stopPrank();

        // Check state
        ToolRegistry.Tool memory t = registry.getTool(0);
        assertEq(t.totalCalls, 1);
        assertEq(t.totalEarned, 10_000);
        assertEq(registry.balances(creator), 10_000);
        assertEq(usdc.balanceOf(caller), 990_000);
        assertEq(registry.userCallCount(caller, 0), 1);
    }

    function test_multipleCalls() public {
        vm.prank(creator);
        registry.registerTool("Oracle", "https://api.com", "Prices", 10_000);

        vm.startPrank(caller);
        usdc.approve(address(registry), 50_000);
        registry.payForCall(0);
        registry.payForCall(0);
        registry.payForCall(0);
        vm.stopPrank();

        ToolRegistry.Tool memory t = registry.getTool(0);
        assertEq(t.totalCalls, 3);
        assertEq(t.totalEarned, 30_000);
        assertEq(registry.balances(creator), 30_000);
    }

    function test_revert_payInactiveTool() public {
        vm.prank(creator);
        registry.registerTool("Oracle", "https://api.com", "Prices", 10_000);

        vm.prank(creator);
        registry.deactivateTool(0);

        vm.startPrank(caller);
        usdc.approve(address(registry), 10_000);
        vm.expectRevert(ToolRegistry.ToolInactive.selector);
        registry.payForCall(0);
        vm.stopPrank();
    }

    function test_revert_payNonexistent() public {
        vm.startPrank(caller);
        usdc.approve(address(registry), 10_000);
        vm.expectRevert(ToolRegistry.ToolNotFound.selector);
        registry.payForCall(99);
        vm.stopPrank();
    }

    // ─── Withdraw ────────────────────────────────────────────

    function test_withdraw() public {
        vm.prank(creator);
        registry.registerTool("Oracle", "https://api.com", "Prices", 10_000);

        vm.startPrank(caller);
        usdc.approve(address(registry), 10_000);
        registry.payForCall(0);
        vm.stopPrank();

        // Creator withdraws
        vm.prank(creator);
        registry.withdraw();

        assertEq(usdc.balanceOf(creator), 10_000);
        assertEq(registry.balances(creator), 0);
    }

    function test_revert_withdrawZero() public {
        vm.prank(creator);
        vm.expectRevert(ToolRegistry.NothingToWithdraw.selector);
        registry.withdraw();
    }

    // ─── Tool Management ─────────────────────────────────────

    function test_deactivateReactivate() public {
        vm.prank(creator);
        registry.registerTool("Oracle", "https://api.com", "Prices", 10_000);

        vm.prank(creator);
        registry.deactivateTool(0);
        assertFalse(registry.getTool(0).active);

        vm.prank(creator);
        registry.reactivateTool(0);
        assertTrue(registry.getTool(0).active);
    }

    function test_updatePrice() public {
        vm.prank(creator);
        registry.registerTool("Oracle", "https://api.com", "Prices", 10_000);

        vm.prank(creator);
        registry.updatePrice(0, 50_000);
        assertEq(registry.getTool(0).pricePerCall, 50_000);
    }

    function test_revert_notCreator() public {
        vm.prank(creator);
        registry.registerTool("Oracle", "https://api.com", "Prices", 10_000);

        vm.prank(caller);
        vm.expectRevert(ToolRegistry.NotToolCreator.selector);
        registry.deactivateTool(0);
    }

    // ─── Enumeration ─────────────────────────────────────────

    function test_getTools() public {
        vm.startPrank(creator);
        registry.registerTool("A", "https://a.com", "a", 10_000);
        registry.registerTool("B", "https://b.com", "b", 20_000);
        registry.registerTool("C", "https://c.com", "c", 30_000);
        vm.stopPrank();

        ToolRegistry.Tool[] memory all = registry.getTools(0, 10);
        assertEq(all.length, 3);
        assertEq(all[0].name, "A");
        assertEq(all[2].name, "C");

        // Pagination
        ToolRegistry.Tool[] memory page = registry.getTools(1, 1);
        assertEq(page.length, 1);
        assertEq(page[0].name, "B");
    }

    function test_getActiveTools() public {
        vm.startPrank(creator);
        registry.registerTool("A", "https://a.com", "a", 10_000);
        registry.registerTool("B", "https://b.com", "b", 20_000);
        registry.registerTool("C", "https://c.com", "c", 30_000);
        registry.deactivateTool(1); // deactivate B
        vm.stopPrank();

        ToolRegistry.Tool[] memory active = registry.getActiveTools(0, 10);
        assertEq(active.length, 2);
        assertEq(active[0].name, "A");
        assertEq(active[1].name, "C");
    }

    // ─── Events ──────────────────────────────────────────────

    function test_emitToolRegistered() public {
        vm.prank(creator);
        vm.expectEmit(true, true, false, true);
        emit ToolRegistry.ToolRegistered(0, creator, "Oracle", "https://api.com", 10_000);
        registry.registerTool("Oracle", "https://api.com", "Prices", 10_000);
    }

    function test_emitToolCalled() public {
        vm.prank(creator);
        registry.registerTool("Oracle", "https://api.com", "Prices", 10_000);

        vm.startPrank(caller);
        usdc.approve(address(registry), 10_000);
        vm.expectEmit(true, true, false, false);
        emit ToolRegistry.ToolCalled(0, caller, 10_000, block.timestamp);
        registry.payForCall(0);
        vm.stopPrank();
    }
}

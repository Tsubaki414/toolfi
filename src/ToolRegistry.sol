// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IERC20.sol";

/// @title ToolDrop — Agent Tool Marketplace
/// @notice Lets AI agents register paid tools and pay USDC to call them.
///         Built for the USDC Hackathon on Moltbook (Feb 2026).
contract ToolRegistry {
    // ─── State ───────────────────────────────────────────────

    IERC20 public immutable usdc;
    address public owner;

    struct Tool {
        uint256 id;
        address creator;
        string name;
        string endpoint;
        string description;
        uint256 pricePerCall; // in USDC (6 decimals)
        uint256 totalCalls;
        uint256 totalEarned;
        uint256 totalTips;    // total tips received
        bool active;
    }

    uint256 public nextToolId;
    mapping(uint256 => Tool) public tools;
    uint256[] public toolIds; // for enumeration

    // creator → accumulated withdrawable balance
    mapping(address => uint256) public balances;

    // usage log: caller → toolId → call count
    mapping(address => mapping(uint256 => uint256)) public userCallCount;

    // ─── Events ──────────────────────────────────────────────

    event ToolRegistered(
        uint256 indexed toolId,
        address indexed creator,
        string name,
        string endpoint,
        uint256 pricePerCall
    );

    event ToolCalled(
        uint256 indexed toolId,
        address indexed caller,
        uint256 amount,
        uint256 timestamp
    );

    event ToolDeactivated(uint256 indexed toolId);
    event ToolReactivated(uint256 indexed toolId);
    event ToolPriceUpdated(uint256 indexed toolId, uint256 oldPrice, uint256 newPrice);
    event Withdrawn(address indexed creator, uint256 amount);
    event Tipped(uint256 indexed toolId, address indexed tipper, uint256 amount, uint256 timestamp);

    // ─── Errors ──────────────────────────────────────────────

    error ToolNotFound();
    error ToolInactive();
    error NotToolCreator();
    error ZeroPrice();
    error ZeroAmount();
    error EmptyName();
    error EmptyEndpoint();
    error NothingToWithdraw();
    error TransferFailed();

    // ─── Constructor ─────────────────────────────────────────

    /// @param _usdc Address of the USDC token on this chain
    constructor(address _usdc) {
        usdc = IERC20(_usdc);
        owner = msg.sender;
    }

    // ─── Tool Management ─────────────────────────────────────

    /// @notice Register a new tool. Anyone can register.
    /// @param name        Human-readable tool name
    /// @param endpoint    API endpoint URL
    /// @param description What the tool does
    /// @param pricePerCall Price in USDC per invocation (6 decimals, e.g. 10000 = $0.01)
    /// @return toolId     The ID assigned to the new tool
    function registerTool(
        string calldata name,
        string calldata endpoint,
        string calldata description,
        uint256 pricePerCall
    ) external returns (uint256 toolId) {
        if (bytes(name).length == 0) revert EmptyName();
        if (bytes(endpoint).length == 0) revert EmptyEndpoint();
        if (pricePerCall == 0) revert ZeroPrice();

        toolId = nextToolId++;
        tools[toolId] = Tool({
            id: toolId,
            creator: msg.sender,
            name: name,
            endpoint: endpoint,
            description: description,
            pricePerCall: pricePerCall,
            totalCalls: 0,
            totalEarned: 0,
            totalTips: 0,
            active: true
        });
        toolIds.push(toolId);

        emit ToolRegistered(toolId, msg.sender, name, endpoint, pricePerCall);
    }

    /// @notice Pay USDC and record a tool call. Caller must have approved this contract.
    /// @param toolId ID of the tool to call
    function payForCall(uint256 toolId) external {
        Tool storage tool = tools[toolId];
        if (tool.creator == address(0)) revert ToolNotFound();
        if (!tool.active) revert ToolInactive();

        uint256 price = tool.pricePerCall;

        // Transfer USDC from caller to this contract
        bool ok = usdc.transferFrom(msg.sender, address(this), price);
        if (!ok) revert TransferFailed();

        // Credit the tool creator
        balances[tool.creator] += price;
        tool.totalCalls += 1;
        tool.totalEarned += price;
        userCallCount[msg.sender][toolId] += 1;

        emit ToolCalled(toolId, msg.sender, price, block.timestamp);
    }

    /// @notice Tip a tool creator. Caller must have approved this contract.
    /// @param toolId ID of the tool to tip
    /// @param amount Amount of USDC to tip (6 decimals)
    function tip(uint256 toolId, uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        Tool storage tool = tools[toolId];
        if (tool.creator == address(0)) revert ToolNotFound();

        // Transfer USDC from tipper to this contract
        bool ok = usdc.transferFrom(msg.sender, address(this), amount);
        if (!ok) revert TransferFailed();

        // Credit the tool creator
        balances[tool.creator] += amount;
        tool.totalTips += amount;

        emit Tipped(toolId, msg.sender, amount, block.timestamp);
    }

    /// @notice Withdraw accumulated earnings
    function withdraw() external {
        uint256 amount = balances[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        balances[msg.sender] = 0;
        bool ok = usdc.transfer(msg.sender, amount);
        if (!ok) revert TransferFailed();

        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Deactivate a tool (creator only)
    function deactivateTool(uint256 toolId) external {
        Tool storage tool = tools[toolId];
        if (tool.creator != msg.sender) revert NotToolCreator();
        tool.active = false;
        emit ToolDeactivated(toolId);
    }

    /// @notice Reactivate a tool (creator only)
    function reactivateTool(uint256 toolId) external {
        Tool storage tool = tools[toolId];
        if (tool.creator != msg.sender) revert NotToolCreator();
        tool.active = true;
        emit ToolReactivated(toolId);
    }

    /// @notice Update tool price (creator only)
    function updatePrice(uint256 toolId, uint256 newPrice) external {
        if (newPrice == 0) revert ZeroPrice();
        Tool storage tool = tools[toolId];
        if (tool.creator != msg.sender) revert NotToolCreator();
        uint256 oldPrice = tool.pricePerCall;
        tool.pricePerCall = newPrice;
        emit ToolPriceUpdated(toolId, oldPrice, newPrice);
    }

    // ─── View Functions ──────────────────────────────────────

    /// @notice Get full tool details
    function getTool(uint256 toolId) external view returns (Tool memory) {
        if (tools[toolId].creator == address(0)) revert ToolNotFound();
        return tools[toolId];
    }

    /// @notice Get total number of registered tools
    function toolCount() external view returns (uint256) {
        return toolIds.length;
    }

    /// @notice Get a page of tools (for enumeration)
    /// @param offset Start index
    /// @param limit  Max tools to return
    function getTools(uint256 offset, uint256 limit)
        external
        view
        returns (Tool[] memory result)
    {
        uint256 total = toolIds.length;
        if (offset >= total) return new Tool[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 count = end - offset;

        result = new Tool[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = tools[toolIds[offset + i]];
        }
    }

    /// @notice Get only active tools
    function getActiveTools(uint256 offset, uint256 limit)
        external
        view
        returns (Tool[] memory)
    {
        // First pass: count active tools
        uint256 total = toolIds.length;
        uint256 activeCount = 0;
        for (uint256 i = 0; i < total; i++) {
            if (tools[toolIds[i]].active) activeCount++;
        }

        if (offset >= activeCount) return new Tool[](0);

        uint256 end = offset + limit;
        if (end > activeCount) end = activeCount;
        uint256 count = end - offset;

        Tool[] memory result = new Tool[](count);
        uint256 found = 0;
        uint256 added = 0;
        for (uint256 i = 0; i < total && added < count; i++) {
            if (tools[toolIds[i]].active) {
                if (found >= offset) {
                    result[added] = tools[toolIds[i]];
                    added++;
                }
                found++;
            }
        }
        return result;
    }
}

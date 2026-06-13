// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract LiminalSpaceGame {
    address public owner;
    
    // On Arc Testnet, the USDC ERC-20 interface uses 6 decimals.
    // 0.1 USDC = 0.1 * 10^6 = 100,000 units.
    address public constant USDC_TOKEN = 0x3600000000000000000000000000000000000000;
    uint256 public constant PAYMENT_AMOUNT = 100000; 

    struct UserStats {
        uint256 highScore;
        uint256 bonusPoints;
        uint256 lastDailyCheckIn;
        uint256 pendingSessions; // Number of paid sessions that haven't submitted a score yet
    }

    struct LeaderboardEntry {
        address player;
        uint256 score;
        uint256 bonusPoints;
    }

    mapping(address => UserStats) public userStats;
    
    // Leaderboard tracking
    LeaderboardEntry[] public leaderboard;
    mapping(address => uint256) public leaderboardIndex; // 1-indexed (index + 1), 0 means not in leaderboard

    event SessionPaid(address indexed player, uint256 timestamp);
    event ScoreSubmitted(address indexed player, uint256 score, uint256 bonusPoints, uint256 timestamp);
    event DailyCheckInClaimed(address indexed player, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // Pay exactly 0.1 USDC (ERC20) to start a game session
    function payForSession() external {
        require(IERC20(USDC_TOKEN).transferFrom(msg.sender, address(this), PAYMENT_AMOUNT), "USDC transfer failed");
        userStats[msg.sender].pendingSessions += 1;
        emit SessionPaid(msg.sender, block.timestamp);
    }

    // Pay exactly 0.1 USDC (ERC20) to submit a score
    function submitScore(uint256 score) external {
        require(IERC20(USDC_TOKEN).transferFrom(msg.sender, address(this), PAYMENT_AMOUNT), "USDC transfer failed");
        UserStats storage stats = userStats[msg.sender];
        require(stats.pendingSessions > 0, "No pending game session found");

        stats.pendingSessions -= 1;
        if (score > stats.highScore) {
            stats.highScore = score;
        }

        _updateLeaderboard(msg.sender, stats.highScore, stats.bonusPoints);
        emit ScoreSubmitted(msg.sender, score, stats.bonusPoints, block.timestamp);
    }

    // Pay exactly 0.1 USDC (ERC20) to perform daily check-in
    function dailyCheckIn() external {
        require(IERC20(USDC_TOKEN).transferFrom(msg.sender, address(this), PAYMENT_AMOUNT), "USDC transfer failed");
        UserStats storage stats = userStats[msg.sender];
        require(block.timestamp >= stats.lastDailyCheckIn + 24 hours, "Daily check-in is on cooldown (24 hours)");

        stats.lastDailyCheckIn = block.timestamp;
        stats.bonusPoints += 10;

        if (stats.highScore > 0) {
            _updateLeaderboard(msg.sender, stats.highScore, stats.bonusPoints);
        }

        emit DailyCheckInClaimed(msg.sender, block.timestamp);
    }

    function _updateLeaderboard(address player, uint256 score, uint256 bonusPoints) internal {
        uint256 indexPlusOne = leaderboardIndex[player];
        
        if (indexPlusOne > 0) {
            // Player is already in the leaderboard, update their stats
            uint256 idx = indexPlusOne - 1;
            leaderboard[idx].score = score;
            leaderboard[idx].bonusPoints = bonusPoints;
        } else {
            // Player is not in the leaderboard, add new entry
            leaderboard.push(LeaderboardEntry({
                player: player,
                score: score,
                bonusPoints: bonusPoints
            }));
            leaderboardIndex[player] = leaderboard.length;
        }

        _sortLeaderboard();
    }

    function _sortLeaderboard() internal {
        uint256 n = leaderboard.length;
        for (uint256 i = 0; i < n; i++) {
            for (uint256 j = i + 1; j < n; j++) {
                if (leaderboard[j].score > leaderboard[i].score) {
                    // Swap entries
                    LeaderboardEntry memory temp = leaderboard[i];
                    leaderboard[i] = leaderboard[j];
                    leaderboard[j] = temp;

                    // Update index mapping (1-indexed)
                    leaderboardIndex[leaderboard[i].player] = i + 1;
                    leaderboardIndex[leaderboard[j].player] = j + 1;
                }
            }
        }

        // Cap leaderboard at top 12 elements to manage gas costs
        while (leaderboard.length > 12) {
            address lastPlayer = leaderboard[leaderboard.length - 1].player;
            leaderboardIndex[lastPlayer] = 0;
            leaderboard.pop();
        }
    }

    function getLeaderboard() external view returns (LeaderboardEntry[] memory) {
        return leaderboard;
    }

    function getStats(address user) external view returns (uint256 highScore, uint256 bonusPoints, uint256 lastDailyCheckIn, uint256 pendingSessions) {
        UserStats storage stats = userStats[user];
        return (stats.highScore, stats.bonusPoints, stats.lastDailyCheckIn, stats.pendingSessions);
    }

    // Allows owner to withdraw accumulated USDC from the contract
    function withdraw() external onlyOwner {
        uint256 balance = IERC20(USDC_TOKEN).balanceOf(address(this));
        require(balance > 0, "No balance to withdraw");
        require(IERC20(USDC_TOKEN).transfer(owner, balance), "USDC withdrawal failed");
    }
}

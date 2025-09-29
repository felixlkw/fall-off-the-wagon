// 작심삼일 RUN DAO - Contract Configuration
// Polygon zkEVM Testnet Contract Addresses and ABIs

// Contract Addresses (Test Deployment - Replace with actual after deployment)
window.CONTRACT_ADDRESSES = {
  // Polygon zkEVM Testnet addresses (placeholder)
  QuestFactory: "0x1234567890123456789012345678901234567890",
  EscrowVault: "0x2345678901234567890123456789012345678901", 
  MedalNFT: "0x3456789012345678901234567890123456789012"
};

// Contract ABIs (Main functions only for frontend use)
window.CONTRACT_ABIS = {
  
  QuestFactory: [
    // View functions
    "function quests(uint256) external view returns (uint256 id, address creator, string title, string description, uint256 startTime, uint256 endTime, uint256 distanceKm, uint256 timesPerWeek, address stakeToken, uint256 stakeAmount, uint256 maxSlots, uint256 successRate, uint256 daoRate, uint256 protocolFeeRate, uint8 status, uint256 participantCount)",
    "function questCounter() external view returns (uint256)",
    "function participations(uint256, address) external view returns (address participant, uint256 questId, uint256 joinedAt, uint256 completedSessions, uint256 totalDistanceKm, uint8 status)",
    "function questParticipants(uint256, uint256) external view returns (address)",
    "function getQuestParticipants(uint256) external view returns (address[])",
    
    // Main functions
    "function createQuest(string title, string description, uint256 crewId, uint256 startTime, uint256 endTime, uint256 distanceKm, uint256 timesPerWeek, uint256 maxSlots) external payable",
    "function joinQuest(uint256 questId) external payable",
    "function submitRunData(uint256 questId, uint256 distanceKm, uint256 duration, bytes32 gpsDataHash) external",
    "function completeQuest(uint256 questId) external",
    
    // Admin functions  
    "function setSupportedToken(address token, bool supported) external",
    "function setEscrowVault(address escrowVault) external",
    
    // Events
    "event QuestCreated(uint256 indexed questId, address indexed creator, string title, uint256 stakeAmount)",
    "event QuestJoined(uint256 indexed questId, address indexed participant, uint256 stakeAmount)",
    "event RunSubmitted(uint256 indexed questId, address indexed participant, uint256 distanceKm, uint256 duration)",
    "event QuestCompleted(uint256 indexed questId, address[] winners, address[] losers, uint256 totalStaked)"
  ],

  EscrowVault: [
    // View functions
    "function questStakes(uint256) external view returns (uint256 totalAmount, uint256 participantCount, bool isSettled)",
    "function userStakes(uint256, address) external view returns (uint256 amount, bool claimed)",
    
    // Main functions
    "function depositStake(uint256 questId, address participant) external payable",
    "function withdrawStake(uint256 questId, address participant) external",
    "function distributeRewards(uint256 questId, address[] winners, address[] losers, uint256 daoShare, uint256 protocolFee) external",
    
    // Events
    "event StakeDeposited(uint256 indexed questId, address indexed participant, uint256 amount)",
    "event StakeWithdrawn(uint256 indexed questId, address indexed participant, uint256 amount)",
    "event RewardsDistributed(uint256 indexed questId, uint256 totalAmount, uint256 winnersShare, uint256 losersShare)"
  ],

  MedalNFT: [
    // ERC721 standard functions
    "function balanceOf(address owner) external view returns (uint256)",
    "function ownerOf(uint256 tokenId) external view returns (address)",
    "function tokenURI(uint256 tokenId) external view returns (string)",
    "function approve(address to, uint256 tokenId) external",
    "function getApproved(uint256 tokenId) external view returns (address)",
    "function setApprovalForAll(address operator, bool approved) external",
    "function isApprovedForAll(address owner, address operator) external view returns (bool)",
    "function transferFrom(address from, address to, uint256 tokenId) external",
    "function safeTransferFrom(address from, address to, uint256 tokenId) external",
    "function safeTransferFrom(address from, address to, uint256 tokenId, bytes data) external",
    
    // Custom functions
    "function mintMedal(address to, uint256 questId, uint8 medalType, uint8 season, bool isWinner) external returns (uint256)",
    "function upgradeMedal(uint256 tokenId) external",
    "function getMedalInfo(uint256 tokenId) external view returns (uint256 questId, uint8 medalType, uint8 season, bool isWinner, uint8 upgradeLevel)",
    "function getUserMedals(address user) external view returns (uint256[])",
    
    // Events
    "event MedalMinted(uint256 indexed tokenId, address indexed recipient, uint256 indexed questId, uint8 medalType)",
    "event MedalUpgraded(uint256 indexed tokenId, uint8 newLevel)",
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
    "event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)",
    "event ApprovalForAll(address indexed owner, address indexed operator, bool approved)"
  ]
};

// Network Configuration
window.NETWORK_CONFIG = {
  chainId: 1442, // Polygon zkEVM Testnet
  chainName: "Polygon zkEVM Testnet",
  nativeCurrency: {
    name: "ETH",
    symbol: "ETH",
    decimals: 18
  },
  rpcUrls: ["https://rpc.public.zkevm-test.net"],
  blockExplorerUrls: ["https://testnet-zkevm.polygonscan.com/"]
};

// Quest Status Mapping
window.QUEST_STATUS = {
  0: "Draft",
  1: "Open", 
  2: "Active",
  3: "Completed",
  4: "Cancelled"
};

// Medal Types
window.MEDAL_TYPES = {
  0: "Gold",    // Winner medal
  1: "Grey",    // Participant medal  
  2: "Special"  // Special achievement medal
};

// Utility functions for contract interaction
window.ContractUtils = {
  
  // Format quest data from contract
  formatQuestData(questArray) {
    return {
      id: questArray[0],
      creator: questArray[1],
      title: questArray[2],
      description: questArray[3],
      startTime: Number(questArray[4]),
      endTime: Number(questArray[5]),
      distanceKm: Number(questArray[6]) / 1000, // Convert back from cm to km
      timesPerWeek: Number(questArray[7]),
      stakeToken: questArray[8],
      stakeAmount: questArray[9],
      maxSlots: Number(questArray[10]),
      successRate: Number(questArray[11]),
      daoRate: Number(questArray[12]),
      protocolFeeRate: Number(questArray[13]),
      status: Number(questArray[14]),
      participantCount: Number(questArray[15])
    };
  },
  
  // Format participation data from contract
  formatParticipationData(participationArray) {
    return {
      participant: participationArray[0],
      questId: Number(participationArray[1]),
      joinedAt: Number(participationArray[2]),
      completedSessions: Number(participationArray[3]),
      totalDistanceKm: Number(participationArray[4]) / 1000,
      status: Number(participationArray[5])
    };
  },
  
  // Convert km to contract format (cm)
  kmToCm(km) {
    return Math.floor(km * 1000);
  },
  
  // Convert contract format (cm) to km
  cmToKm(cm) {
    return cm / 1000;
  },
  
  // Get status text
  getStatusText(statusNumber) {
    return window.QUEST_STATUS[statusNumber] || "Unknown";
  },
  
  // Get medal type text
  getMedalTypeText(typeNumber) {
    return window.MEDAL_TYPES[typeNumber] || "Unknown";
  }
};

console.log("📄 Contract configuration loaded");
console.log("🏗️ Contract addresses:", window.CONTRACT_ADDRESSES);
console.log("📋 ABIs loaded for:", Object.keys(window.CONTRACT_ABIS));
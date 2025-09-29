// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title QuestFactory
 * @dev Factory contract for creating and managing running quests in RUN DAO
 * 
 * Features:
 * - Create quests with staking requirements
 * - Manage quest lifecycle (open -> active -> completed)
 * - Integration with EscrowVault for fund management
 * - Crew-based quest organization
 */
contract QuestFactory is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // Quest status enumeration
    enum QuestStatus { Draft, Open, Active, Completed, Cancelled }
    
    // Quest structure
    struct Quest {
        uint256 id;
        address creator;
        string title;
        string description;
        
        // Quest parameters
        uint256 startTime;
        uint256 endTime;
        uint256 distanceKm; // Distance in km * 1000 (for precision)
        uint256 timesPerWeek;
        
        // Staking parameters  
        address stakeToken;
        uint256 stakeAmount;
        uint256 maxSlots;
        
        // Settlement policy (in basis points, 10000 = 100%)
        uint256 successRate;    // Percentage to winners
        uint256 daoRate;        // Percentage to DAO treasury
        uint256 protocolFeeRate; // Protocol fee
        
        // State
        QuestStatus status;
        uint256 participantCount;
        uint256 createdAt;
    }
    
    // Quest participant structure
    struct Participation {
        address participant;
        uint256 stakedAmount;
        bool isActive;
        uint256 joinedAt;
    }
    
    // Events
    event QuestCreated(
        uint256 indexed questId,
        address indexed creator,
        string title,
        uint256 stakeAmount,
        address stakeToken
    );
    
    event QuestJoined(
        uint256 indexed questId,
        address indexed participant,
        uint256 stakedAmount
    );
    
    event QuestStatusChanged(
        uint256 indexed questId,
        QuestStatus oldStatus,
        QuestStatus newStatus
    );
    
    event QuestCompleted(
        uint256 indexed questId,
        address[] winners,
        address[] losers,
        uint256 totalStaked
    );
    
    // State variables
    mapping(uint256 => Quest) public quests;
    mapping(uint256 => mapping(address => Participation)) public participations;
    mapping(uint256 => address[]) public questParticipants;
    
    uint256 public questCounter;
    uint256 public defaultSuccessRate = 8000; // 80%
    uint256 public defaultDaoRate = 1000;     // 10%  
    uint256 public defaultProtocolFeeRate = 1000; // 10%
    
    // Contracts
    address public escrowVault;
    address public daoTreasury;
    
    // Supported tokens for staking
    mapping(address => bool) public supportedTokens;
    
    constructor(address _daoTreasury) {
        daoTreasury = _daoTreasury;
    }
    
    /**
     * @dev Set the escrow vault address
     */
    function setEscrowVault(address _escrowVault) external onlyOwner {
        escrowVault = _escrowVault;
    }
    
    /**
     * @dev Add supported token for staking
     */
    function setSupportedToken(address token, bool supported) external onlyOwner {
        supportedTokens[token] = supported;
    }
    
    /**
     * @dev Create a new quest
     */
    function createQuest(
        string memory _title,
        string memory _description,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _distanceKm,
        uint256 _timesPerWeek,
        address _stakeToken,
        uint256 _stakeAmount,
        uint256 _maxSlots
    ) external returns (uint256 questId) {
        require(_startTime > block.timestamp, "Start time must be in future");
        require(_endTime > _startTime, "End time must be after start time");
        require(_distanceKm > 0, "Distance must be positive");
        require(_timesPerWeek > 0, "Times per week must be positive");
        require(_stakeAmount > 0, "Stake amount must be positive");
        require(_maxSlots > 0, "Max slots must be positive");
        require(supportedTokens[_stakeToken], "Token not supported");
        
        questCounter++;
        questId = questCounter;
        
        quests[questId] = Quest({
            id: questId,
            creator: msg.sender,
            title: _title,
            description: _description,
            startTime: _startTime,
            endTime: _endTime,
            distanceKm: _distanceKm,
            timesPerWeek: _timesPerWeek,
            stakeToken: _stakeToken,
            stakeAmount: _stakeAmount,
            maxSlots: _maxSlots,
            successRate: defaultSuccessRate,
            daoRate: defaultDaoRate,
            protocolFeeRate: defaultProtocolFeeRate,
            status: QuestStatus.Open,
            participantCount: 0,
            createdAt: block.timestamp
        });
        
        emit QuestCreated(questId, msg.sender, _title, _stakeAmount, _stakeToken);
    }
    
    /**
     * @dev Join a quest by staking required amount
     */
    function joinQuest(uint256 _questId) external nonReentrant {
        Quest storage quest = quests[_questId];
        require(quest.id != 0, "Quest does not exist");
        require(quest.status == QuestStatus.Open, "Quest not open for joining");
        require(block.timestamp < quest.startTime, "Quest already started");
        require(quest.participantCount < quest.maxSlots, "Quest is full");
        require(!participations[_questId][msg.sender].isActive, "Already joined");
        
        // Transfer stake to escrow
        IERC20(quest.stakeToken).safeTransferFrom(
            msg.sender,
            escrowVault,
            quest.stakeAmount
        );
        
        // Record participation
        participations[_questId][msg.sender] = Participation({
            participant: msg.sender,
            stakedAmount: quest.stakeAmount,
            isActive: true,
            joinedAt: block.timestamp
        });
        
        questParticipants[_questId].push(msg.sender);
        quest.participantCount++;
        
        emit QuestJoined(_questId, msg.sender, quest.stakeAmount);
        
        // Auto-activate quest if it reaches start time and has participants
        if (block.timestamp >= quest.startTime && quest.status == QuestStatus.Open) {
            _changeQuestStatus(_questId, QuestStatus.Active);
        }
    }
    
    /**
     * @dev Complete quest and distribute rewards
     * @param _questId Quest ID to complete
     * @param _winners Array of winner addresses
     */
    function completeQuest(
        uint256 _questId,
        address[] calldata _winners
    ) external onlyOwner {
        Quest storage quest = quests[_questId];
        require(quest.id != 0, "Quest does not exist");
        require(quest.status == QuestStatus.Active, "Quest not active");
        require(block.timestamp >= quest.endTime, "Quest not ended yet");
        
        address[] memory allParticipants = questParticipants[_questId];
        uint256 totalStaked = quest.participantCount * quest.stakeAmount;
        
        // Calculate losers
        address[] memory losers = new address[](allParticipants.length - _winners.length);
        uint256 loserCount = 0;
        
        for (uint256 i = 0; i < allParticipants.length; i++) {
            bool isWinner = false;
            for (uint256 j = 0; j < _winners.length; j++) {
                if (allParticipants[i] == _winners[j]) {
                    isWinner = true;
                    break;
                }
            }
            if (!isWinner) {
                losers[loserCount] = allParticipants[i];
                loserCount++;
            }
        }
        
        // Call escrow to distribute funds
        IEscrowVault(escrowVault).distributeQuestRewards(
            _questId,
            quest.stakeToken,
            totalStaked,
            _winners,
            losers,
            quest.successRate,
            quest.daoRate,
            quest.protocolFeeRate,
            daoTreasury
        );
        
        _changeQuestStatus(_questId, QuestStatus.Completed);
        
        emit QuestCompleted(_questId, _winners, losers, totalStaked);
    }
    
    /**
     * @dev Cancel a quest (only before it starts)
     */
    function cancelQuest(uint256 _questId) external {
        Quest storage quest = quests[_questId];
        require(quest.id != 0, "Quest does not exist");
        require(
            msg.sender == quest.creator || msg.sender == owner(),
            "Not authorized"
        );
        require(quest.status == QuestStatus.Open, "Quest not open");
        require(block.timestamp < quest.startTime, "Quest already started");
        
        // Refund all participants
        address[] memory participants = questParticipants[_questId];
        for (uint256 i = 0; i < participants.length; i++) {
            address participant = participants[i];
            if (participations[_questId][participant].isActive) {
                IEscrowVault(escrowVault).refundParticipant(
                    _questId,
                    participant,
                    quest.stakeToken,
                    quest.stakeAmount
                );
                participations[_questId][participant].isActive = false;
            }
        }
        
        _changeQuestStatus(_questId, QuestStatus.Cancelled);
    }
    
    /**
     * @dev Get quest details
     */
    function getQuest(uint256 _questId) external view returns (Quest memory) {
        return quests[_questId];
    }
    
    /**
     * @dev Get quest participants
     */
    function getQuestParticipants(uint256 _questId) external view returns (address[] memory) {
        return questParticipants[_questId];
    }
    
    /**
     * @dev Internal function to change quest status
     */
    function _changeQuestStatus(uint256 _questId, QuestStatus _newStatus) internal {
        QuestStatus oldStatus = quests[_questId].status;
        quests[_questId].status = _newStatus;
        emit QuestStatusChanged(_questId, oldStatus, _newStatus);
    }
    
    /**
     * @dev Emergency function to update quest status (owner only)
     */
    function emergencyUpdateQuestStatus(uint256 _questId, QuestStatus _status) external onlyOwner {
        _changeQuestStatus(_questId, _status);
    }
}

/**
 * @dev Interface for EscrowVault
 */
interface IEscrowVault {
    function distributeQuestRewards(
        uint256 questId,
        address token,
        uint256 totalAmount,
        address[] calldata winners,
        address[] calldata losers,
        uint256 successRate,
        uint256 daoRate,
        uint256 protocolFeeRate,
        address daoTreasury
    ) external;
    
    function refundParticipant(
        uint256 questId,
        address participant,
        address token,
        uint256 amount
    ) external;
}
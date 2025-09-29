// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title EscrowVault
 * @dev Secure vault for holding and distributing quest stakes in RUN DAO
 * 
 * Features:
 * - Secure multi-signature-like access control
 * - Automated quest reward distribution
 * - Emergency recovery functions
 * - Gas-optimized batch operations
 * - Detailed event logging for transparency
 */
contract EscrowVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // Escrow record structure
    struct EscrowRecord {
        uint256 questId;
        address participant;
        address token;
        uint256 amount;
        bool isLocked;
        uint256 lockedAt;
    }
    
    // Settlement record for transparency
    struct Settlement {
        uint256 questId;
        address token;
        uint256 totalAmount;
        uint256 winnersCount;
        uint256 losersCount;
        uint256 winnersReward;
        uint256 daoAmount;
        uint256 protocolFee;
        uint256 settledAt;
    }
    
    // Events
    event FundsDeposited(
        uint256 indexed questId,
        address indexed participant,
        address indexed token,
        uint256 amount
    );
    
    event RewardsDistributed(
        uint256 indexed questId,
        address indexed token,
        uint256 totalAmount,
        uint256 winnersCount,
        uint256 winnersReward,
        uint256 daoAmount,
        uint256 protocolFee
    );
    
    event ParticipantRefunded(
        uint256 indexed questId,
        address indexed participant,
        address indexed token,
        uint256 amount
    );
    
    event EmergencyWithdrawal(
        address indexed token,
        address indexed recipient,
        uint256 amount,
        string reason
    );
    
    // State variables
    mapping(bytes32 => EscrowRecord) public escrowRecords;
    mapping(uint256 => Settlement) public settlements;
    mapping(address => mapping(address => uint256)) public balances; // token => user => amount
    mapping(address => uint256) public totalLocked; // token => total locked amount
    
    // Authorized contracts
    mapping(address => bool) public authorizedContracts;
    
    // Protocol settings
    uint256 public constant MAX_PROTOCOL_FEE = 2000; // 20% maximum
    address public protocolFeeRecipient;
    
    constructor(address _protocolFeeRecipient) {
        protocolFeeRecipient = _protocolFeeRecipient;
    }
    
    /**
     * @dev Set authorized contract (QuestFactory, etc.)
     */
    function setAuthorizedContract(address _contract, bool _authorized) external onlyOwner {
        authorizedContracts[_contract] = _authorized;
    }
    
    /**
     * @dev Update protocol fee recipient
     */
    function setProtocolFeeRecipient(address _recipient) external onlyOwner {
        require(_recipient != address(0), "Invalid recipient");
        protocolFeeRecipient = _recipient;
    }
    
    /**
     * @dev Deposit funds for a quest (called by QuestFactory)
     */
    function depositForQuest(
        uint256 _questId,
        address _participant,
        address _token,
        uint256 _amount
    ) external {
        require(authorizedContracts[msg.sender], "Not authorized");
        require(_amount > 0, "Amount must be positive");
        
        bytes32 recordId = keccak256(abi.encodePacked(_questId, _participant));
        
        // Update escrow record
        escrowRecords[recordId] = EscrowRecord({
            questId: _questId,
            participant: _participant,
            token: _token,
            amount: _amount,
            isLocked: true,
            lockedAt: block.timestamp
        });
        
        // Update balances
        balances[_token][_participant] += _amount;
        totalLocked[_token] += _amount;
        
        emit FundsDeposited(_questId, _participant, _token, _amount);
    }
    
    /**
     * @dev Distribute quest rewards (called by QuestFactory)
     */
    function distributeQuestRewards(
        uint256 _questId,
        address _token,
        uint256 _totalAmount,
        address[] calldata _winners,
        address[] calldata _losers,
        uint256 _successRate,
        uint256 _daoRate,
        uint256 _protocolFeeRate,
        address _daoTreasury
    ) external nonReentrant {
        require(authorizedContracts[msg.sender], "Not authorized");
        require(_successRate + _daoRate + _protocolFeeRate == 10000, "Rates must sum to 100%");
        require(_protocolFeeRate <= MAX_PROTOCOL_FEE, "Protocol fee too high");
        require(_totalAmount > 0, "Total amount must be positive");
        
        // Calculate distribution amounts
        uint256 winnersReward = (_totalAmount * _successRate) / 10000;
        uint256 daoAmount = (_totalAmount * _daoRate) / 10000;
        uint256 protocolFee = (_totalAmount * _protocolFeeRate) / 10000;
        
        // Distribute to winners
        if (_winners.length > 0 && winnersReward > 0) {
            uint256 rewardPerWinner = winnersReward / _winners.length;
            for (uint256 i = 0; i < _winners.length; i++) {
                _transferFromEscrow(_token, _winners[i], rewardPerWinner);
            }
        }
        
        // Transfer to DAO treasury
        if (daoAmount > 0 && _daoTreasury != address(0)) {
            IERC20(_token).safeTransfer(_daoTreasury, daoAmount);
        }
        
        // Transfer protocol fee
        if (protocolFee > 0 && protocolFeeRecipient != address(0)) {
            IERC20(_token).safeTransfer(protocolFeeRecipient, protocolFee);
        }
        
        // Update locked amounts for all participants
        _updateLockedAmountsAfterSettlement(_questId, _token, _winners, _losers);
        
        // Record settlement
        settlements[_questId] = Settlement({
            questId: _questId,
            token: _token,
            totalAmount: _totalAmount,
            winnersCount: _winners.length,
            losersCount: _losers.length,
            winnersReward: winnersReward,
            daoAmount: daoAmount,
            protocolFee: protocolFee,
            settledAt: block.timestamp
        });
        
        emit RewardsDistributed(
            _questId,
            _token,
            _totalAmount,
            _winners.length,
            winnersReward,
            daoAmount,
            protocolFee
        );
    }
    
    /**
     * @dev Refund participant (for cancelled quests)
     */
    function refundParticipant(
        uint256 _questId,
        address _participant,
        address _token,
        uint256 _amount
    ) external nonReentrant {
        require(authorizedContracts[msg.sender], "Not authorized");
        
        bytes32 recordId = keccak256(abi.encodePacked(_questId, _participant));
        EscrowRecord storage record = escrowRecords[recordId];
        
        require(record.isLocked, "Funds not locked");
        require(record.amount >= _amount, "Insufficient locked amount");
        
        // Update record
        record.amount -= _amount;
        record.isLocked = record.amount > 0;
        
        // Update balances
        balances[_token][_participant] -= _amount;
        totalLocked[_token] -= _amount;
        
        // Transfer refund
        IERC20(_token).safeTransfer(_participant, _amount);
        
        emit ParticipantRefunded(_questId, _participant, _token, _amount);
    }
    
    /**
     * @dev Batch refund multiple participants (gas optimization)
     */
    function batchRefundParticipants(
        uint256 _questId,
        address[] calldata _participants,
        address _token,
        uint256[] calldata _amounts
    ) external nonReentrant {
        require(authorizedContracts[msg.sender], "Not authorized");
        require(_participants.length == _amounts.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < _participants.length; i++) {
            bytes32 recordId = keccak256(abi.encodePacked(_questId, _participants[i]));
            EscrowRecord storage record = escrowRecords[recordId];
            
            if (record.isLocked && record.amount >= _amounts[i]) {
                // Update record
                record.amount -= _amounts[i];
                record.isLocked = record.amount > 0;
                
                // Update balances
                balances[_token][_participants[i]] -= _amounts[i];
                totalLocked[_token] -= _amounts[i];
                
                // Transfer refund
                IERC20(_token).safeTransfer(_participants[i], _amounts[i]);
                
                emit ParticipantRefunded(_questId, _participants[i], _token, _amounts[i]);
            }
        }
    }
    
    /**
     * @dev Emergency withdrawal (owner only, for extreme situations)
     */
    function emergencyWithdraw(
        address _token,
        address _recipient,
        uint256 _amount,
        string calldata _reason
    ) external onlyOwner {
        require(_recipient != address(0), "Invalid recipient");
        require(_amount > 0, "Amount must be positive");
        
        IERC20(_token).safeTransfer(_recipient, _amount);
        
        emit EmergencyWithdrawal(_token, _recipient, _amount, _reason);
    }
    
    /**
     * @dev Get escrow record
     */
    function getEscrowRecord(uint256 _questId, address _participant)
        external
        view
        returns (EscrowRecord memory)
    {
        bytes32 recordId = keccak256(abi.encodePacked(_questId, _participant));
        return escrowRecords[recordId];
    }
    
    /**
     * @dev Get settlement details
     */
    function getSettlement(uint256 _questId) external view returns (Settlement memory) {
        return settlements[_questId];
    }
    
    /**
     * @dev Get total contract balance for a token
     */
    function getContractBalance(address _token) external view returns (uint256) {
        return IERC20(_token).balanceOf(address(this));
    }
    
    /**
     * @dev Get available (unlocked) balance for a token
     */
    function getAvailableBalance(address _token) external view returns (uint256) {
        uint256 contractBalance = IERC20(_token).balanceOf(address(this));
        uint256 locked = totalLocked[_token];
        return contractBalance > locked ? contractBalance - locked : 0;
    }
    
    /**
     * @dev Internal function to transfer from escrow
     */
    function _transferFromEscrow(address _token, address _to, uint256 _amount) internal {
        require(_to != address(0), "Invalid recipient");
        require(_amount > 0, "Amount must be positive");
        
        IERC20(_token).safeTransfer(_to, _amount);
    }
    
    /**
     * @dev Internal function to update locked amounts after settlement
     */
    function _updateLockedAmountsAfterSettlement(
        uint256 _questId,
        address _token,
        address[] calldata _winners,
        address[] calldata _losers
    ) internal {
        // Unlock amounts for all participants
        address[] memory allParticipants = new address[](_winners.length + _losers.length);
        
        // Copy winners
        for (uint256 i = 0; i < _winners.length; i++) {
            allParticipants[i] = _winners[i];
        }
        
        // Copy losers
        for (uint256 i = 0; i < _losers.length; i++) {
            allParticipants[_winners.length + i] = _losers[i];
        }
        
        // Update escrow records
        for (uint256 i = 0; i < allParticipants.length; i++) {
            bytes32 recordId = keccak256(abi.encodePacked(_questId, allParticipants[i]));
            EscrowRecord storage record = escrowRecords[recordId];
            
            if (record.isLocked) {
                // Update balances
                balances[_token][allParticipants[i]] -= record.amount;
                totalLocked[_token] -= record.amount;
                
                // Mark as unlocked
                record.isLocked = false;
            }
        }
    }
    
    /**
     * @dev Receive function to accept ETH deposits
     */
    receive() external payable {
        // Allow ETH deposits for potential future use
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title MedalNFT
 * @dev NFT contract for RUN DAO quest medals and achievements
 * 
 * Features:
 * - Gold medals for quest winners
 * - Grey medals for participants (failure with value)
 * - Special achievement badges
 * - Dynamic metadata updates
 * - Season-based medal evolution
 * - IPFS integration for metadata storage
 */
contract MedalNFT is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    using Strings for uint256;
    
    // Medal types
    enum MedalType { Gold, Grey, Special, Seasonal }
    
    // Medal rarity levels
    enum Rarity { Common, Uncommon, Rare, Epic, Legendary }
    
    // Medal metadata structure
    struct Medal {
        uint256 tokenId;
        uint256 questId;
        address recipient;
        MedalType medalType;
        Rarity rarity;
        string title;
        string description;
        string imageHash; // IPFS hash
        uint256 mintedAt;
        
        // Achievement data
        uint256 distanceKm;
        uint256 completedSessions;
        uint256 totalParticipants;
        string personalStory;
        
        // Upgrade tracking
        bool isUpgradeable;
        uint256 upgradeLevel;
        uint256[] sourceTokenIds; // For merged medals
    }
    
    // Season tracking
    struct Season {
        uint256 seasonId;
        string name;
        uint256 startTime;
        uint256 endTime;
        string themeUri; // IPFS hash for season theme
    }
    
    // Events
    event MedalMinted(
        uint256 indexed tokenId,
        address indexed recipient,
        uint256 indexed questId,
        MedalType medalType,
        Rarity rarity
    );
    
    event MedalUpgraded(
        uint256 indexed tokenId,
        uint256 indexed newTokenId,
        uint256 newLevel,
        uint256[] sourceTokenIds
    );
    
    event SeasonCreated(
        uint256 indexed seasonId,
        string name,
        uint256 startTime,
        uint256 endTime
    );
    
    event MetadataUpdated(
        uint256 indexed tokenId,
        string newTokenURI
    );
    
    // State variables
    Counters.Counter private _tokenIdCounter;
    Counters.Counter private _seasonIdCounter;
    
    mapping(uint256 => Medal) public medals;
    mapping(uint256 => Season) public seasons;
    mapping(address => uint256[]) public userMedals;
    mapping(uint256 => uint256[]) public questMedals; // questId => tokenIds
    mapping(address => mapping(MedalType => uint256)) public userMedalCounts;
    
    // Authorized minters (QuestFactory, Admin, etc.)
    mapping(address => bool) public authorizedMinters;
    
    // Base URIs for different medal types
    mapping(MedalType => string) public baseURIs;
    
    // Current season
    uint256 public currentSeason;
    
    // Medal upgrade rules
    mapping(MedalType => mapping(uint256 => uint256)) public upgradeRequirements; // medalType => count => newRarity
    
    constructor() ERC721("RUN DAO Medal", "RUNDAO") {
        // Initialize first season
        _createSeason("Genesis Season", block.timestamp, block.timestamp + 365 days, "");
        
        // Set default upgrade requirements
        upgradeRequirements[MedalType.Grey][3] = uint256(Rarity.Uncommon); // 3 grey medals -> uncommon badge
        upgradeRequirements[MedalType.Grey][5] = uint256(Rarity.Rare);     // 5 grey medals -> rare badge
        upgradeRequirements[MedalType.Gold][10] = uint256(Rarity.Epic);    // 10 gold medals -> epic badge
    }
    
    /**
     * @dev Set authorized minter
     */
    function setAuthorizedMinter(address _minter, bool _authorized) external onlyOwner {
        authorizedMinters[_minter] = _authorized;
    }
    
    /**
     * @dev Set base URI for medal type
     */
    function setBaseURI(MedalType _medalType, string calldata _baseURI) external onlyOwner {
        baseURIs[_medalType] = _baseURI;
    }
    
    /**
     * @dev Create new season
     */
    function createSeason(
        string calldata _name,
        uint256 _startTime,
        uint256 _endTime,
        string calldata _themeUri
    ) external onlyOwner {
        _createSeason(_name, _startTime, _endTime, _themeUri);
    }
    
    /**
     * @dev Mint medal for quest completion
     */
    function mintQuestMedal(
        address _recipient,
        uint256 _questId,
        MedalType _medalType,
        string calldata _title,
        string calldata _description,
        string calldata _imageHash,
        uint256 _distanceKm,
        uint256 _completedSessions,
        uint256 _totalParticipants,
        string calldata _personalStory
    ) external nonReentrant returns (uint256 tokenId) {
        require(authorizedMinters[msg.sender], "Not authorized to mint");
        require(_recipient != address(0), "Invalid recipient");
        
        _tokenIdCounter.increment();
        tokenId = _tokenIdCounter.current();
        
        // Determine rarity based on performance and participation
        Rarity rarity = _calculateRarity(_medalType, _completedSessions, _totalParticipants);
        
        // Create medal record
        medals[tokenId] = Medal({
            tokenId: tokenId,
            questId: _questId,
            recipient: _recipient,
            medalType: _medalType,
            rarity: rarity,
            title: _title,
            description: _description,
            imageHash: _imageHash,
            mintedAt: block.timestamp,
            distanceKm: _distanceKm,
            completedSessions: _completedSessions,
            totalParticipants: _totalParticipants,
            personalStory: _personalStory,
            isUpgradeable: _medalType == MedalType.Grey, // Grey medals can be upgraded
            upgradeLevel: 0,
            sourceTokenIds: new uint256[](0)
        });
        
        // Mint NFT
        _safeMint(_recipient, tokenId);
        
        // Set token URI
        string memory tokenURI = _generateTokenURI(tokenId);
        _setTokenURI(tokenId, tokenURI);
        
        // Update tracking
        userMedals[_recipient].push(tokenId);
        questMedals[_questId].push(tokenId);
        userMedalCounts[_recipient][_medalType]++;
        
        emit MedalMinted(tokenId, _recipient, _questId, _medalType, rarity);
        
        // Check for auto-upgrade eligibility
        _checkAndAutoUpgrade(_recipient, _medalType);
        
        return tokenId;
    }
    
    /**
     * @dev Upgrade medals by burning source medals
     */
    function upgradeMedals(
        uint256[] calldata _sourceTokenIds,
        string calldata _newTitle,
        string calldata _newDescription,
        string calldata _newImageHash
    ) external nonReentrant returns (uint256 newTokenId) {
        require(_sourceTokenIds.length >= 3, "Need at least 3 medals to upgrade");
        
        // Verify ownership and medalType consistency
        MedalType sourceType;
        uint256 totalDistance = 0;
        uint256 totalSessions = 0;
        
        for (uint256 i = 0; i < _sourceTokenIds.length; i++) {
            uint256 tokenId = _sourceTokenIds[i];
            require(ownerOf(tokenId) == msg.sender, "Not owner of source medal");
            
            Medal storage medal = medals[tokenId];
            require(medal.isUpgradeable, "Medal not upgradeable");
            
            if (i == 0) {
                sourceType = medal.medalType;
            } else {
                require(medal.medalType == sourceType, "Medals must be same type");
            }
            
            totalDistance += medal.distanceKm;
            totalSessions += medal.completedSessions;
            
            // Burn source medal
            _burn(tokenId);
        }
        
        // Create upgraded medal
        _tokenIdCounter.increment();
        newTokenId = _tokenIdCounter.current();
        
        Rarity newRarity = Rarity(upgradeRequirements[sourceType][_sourceTokenIds.length]);
        
        medals[newTokenId] = Medal({
            tokenId: newTokenId,
            questId: 0, // Upgraded medals are not tied to specific quest
            recipient: msg.sender,
            medalType: MedalType.Special,
            rarity: newRarity,
            title: _newTitle,
            description: _newDescription,
            imageHash: _newImageHash,
            mintedAt: block.timestamp,
            distanceKm: totalDistance,
            completedSessions: totalSessions,
            totalParticipants: _sourceTokenIds.length,
            personalStory: "Upgraded from dedication and perseverance",
            isUpgradeable: false,
            upgradeLevel: 1,
            sourceTokenIds: _sourceTokenIds
        });
        
        // Mint new upgraded NFT
        _safeMint(msg.sender, newTokenId);
        string memory tokenURI = _generateTokenURI(newTokenId);
        _setTokenURI(newTokenId, tokenURI);
        
        // Update tracking
        userMedals[msg.sender].push(newTokenId);
        userMedalCounts[msg.sender][MedalType.Special]++;
        
        emit MedalUpgraded(newTokenId, newTokenId, 1, _sourceTokenIds);
        
        return newTokenId;
    }
    
    /**
     * @dev Update medal metadata (for dynamic evolution)
     */
    function updateMedalMetadata(
        uint256 _tokenId,
        string calldata _newDescription,
        string calldata _newImageHash,
        string calldata _newPersonalStory
    ) external {
        require(authorizedMinters[msg.sender] || msg.sender == owner(), "Not authorized");
        require(_exists(_tokenId), "Medal does not exist");
        
        Medal storage medal = medals[_tokenId];
        medal.description = _newDescription;
        medal.imageHash = _newImageHash;
        medal.personalStory = _newPersonalStory;
        
        // Update token URI
        string memory newTokenURI = _generateTokenURI(_tokenId);
        _setTokenURI(_tokenId, newTokenURI);
        
        emit MetadataUpdated(_tokenId, newTokenURI);
    }
    
    /**
     * @dev Get medal details
     */
    function getMedal(uint256 _tokenId) external view returns (Medal memory) {
        require(_exists(_tokenId), "Medal does not exist");
        return medals[_tokenId];
    }
    
    /**
     * @dev Get user's medals
     */
    function getUserMedals(address _user) external view returns (uint256[] memory) {
        return userMedals[_user];
    }
    
    /**
     * @dev Get medals for a quest
     */
    function getQuestMedals(uint256 _questId) external view returns (uint256[] memory) {
        return questMedals[_questId];
    }
    
    /**
     * @dev Get user medal statistics
     */
    function getUserMedalStats(address _user) external view returns (
        uint256 goldCount,
        uint256 greyCount,
        uint256 specialCount,
        uint256 seasonalCount,
        uint256 totalCount
    ) {
        goldCount = userMedalCounts[_user][MedalType.Gold];
        greyCount = userMedalCounts[_user][MedalType.Grey];
        specialCount = userMedalCounts[_user][MedalType.Special];
        seasonalCount = userMedalCounts[_user][MedalType.Seasonal];
        totalCount = goldCount + greyCount + specialCount + seasonalCount;
    }
    
    /**
     * @dev Internal function to calculate rarity
     */
    function _calculateRarity(
        MedalType _medalType,
        uint256 _completedSessions,
        uint256 _totalParticipants
    ) internal pure returns (Rarity) {
        if (_medalType == MedalType.Gold) {
            if (_totalParticipants >= 100) return Rarity.Legendary;
            if (_totalParticipants >= 50) return Rarity.Epic;
            if (_totalParticipants >= 20) return Rarity.Rare;
            return Rarity.Uncommon;
        }
        
        if (_medalType == MedalType.Grey) {
            if (_completedSessions >= 5) return Rarity.Uncommon;
            return Rarity.Common;
        }
        
        return Rarity.Common;
    }
    
    /**
     * @dev Internal function to create season
     */
    function _createSeason(
        string memory _name,
        uint256 _startTime,
        uint256 _endTime,
        string memory _themeUri
    ) internal {
        _seasonIdCounter.increment();
        uint256 seasonId = _seasonIdCounter.current();
        
        seasons[seasonId] = Season({
            seasonId: seasonId,
            name: _name,
            startTime: _startTime,
            endTime: _endTime,
            themeUri: _themeUri
        });
        
        currentSeason = seasonId;
        
        emit SeasonCreated(seasonId, _name, _startTime, _endTime);
    }
    
    /**
     * @dev Internal function to check and auto-upgrade
     */
    function _checkAndAutoUpgrade(address _user, MedalType _medalType) internal {
        uint256 count = userMedalCounts[_user][_medalType];
        
        // Auto-upgrade logic for grey medals
        if (_medalType == MedalType.Grey && count >= 3 && count % 3 == 0) {
            // User has enough grey medals for upgrade
            // This would trigger external upgrade process
        }
    }
    
    /**
     * @dev Internal function to generate token URI
     */
    function _generateTokenURI(uint256 _tokenId) internal view returns (string memory) {
        Medal memory medal = medals[_tokenId];
        
        // Create JSON metadata
        string memory json = string(abi.encodePacked(
            '{"name": "', medal.title, '",',
            '"description": "', medal.description, '",',
            '"image": "ipfs://', medal.imageHash, '",',
            '"attributes": [',
                '{"trait_type": "Medal Type", "value": "', _medalTypeToString(medal.medalType), '"},',
                '{"trait_type": "Rarity", "value": "', _rarityToString(medal.rarity), '"},',
                '{"trait_type": "Distance (km)", "value": ', medal.distanceKm.toString(), '},',
                '{"trait_type": "Sessions", "value": ', medal.completedSessions.toString(), '},',
                '{"trait_type": "Total Participants", "value": ', medal.totalParticipants.toString(), '},',
                '{"trait_type": "Season", "value": ', currentSeason.toString(), '}',
            '],',
            '"story": "', medal.personalStory, '"',
            '}'
        ));
        
        return string(abi.encodePacked("data:application/json;base64,", _base64Encode(bytes(json))));
    }
    
    /**
     * @dev Convert medal type to string
     */
    function _medalTypeToString(MedalType _type) internal pure returns (string memory) {
        if (_type == MedalType.Gold) return "Gold";
        if (_type == MedalType.Grey) return "Grey";
        if (_type == MedalType.Special) return "Special";
        if (_type == MedalType.Seasonal) return "Seasonal";
        return "Unknown";
    }
    
    /**
     * @dev Convert rarity to string
     */
    function _rarityToString(Rarity _rarity) internal pure returns (string memory) {
        if (_rarity == Rarity.Common) return "Common";
        if (_rarity == Rarity.Uncommon) return "Uncommon";
        if (_rarity == Rarity.Rare) return "Rare";
        if (_rarity == Rarity.Epic) return "Epic";
        if (_rarity == Rarity.Legendary) return "Legendary";
        return "Unknown";
    }
    
    /**
     * @dev Simple base64 encoding (for small data only)
     */
    function _base64Encode(bytes memory data) internal pure returns (string memory) {
        // This is a simplified base64 encoding for demonstration
        // In production, use a proper base64 library
        return ""; // Placeholder - implement proper base64 encoding
    }
    
    /**
     * @dev Override required by Solidity
     */
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }
    
    /**
     * @dev Override required by Solidity
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
    
    /**
     * @dev Override required by Solidity
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
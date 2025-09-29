// 작심삼일 RUN DAO - Web3 Integration

// Web3 Connection Manager
class Web3Manager {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.account = null;
    this.chainId = null;
    this.contracts = {};
    
    // Contract addresses (updated from contracts.js)
    this.contractAddresses = window.CONTRACT_ADDRESSES || {
      QuestFactory: null,
      EscrowVault: null,
      MedalNFT: null
    };
    
    // Polygon zkEVM Testnet configuration
    this.networks = {
      polygonZkEVMTestnet: {
        chainId: '0x5A2', // 1442 in hex
        chainName: 'Polygon zkEVM Testnet',
        nativeCurrency: {
          name: 'ETH',
          symbol: 'ETH',
          decimals: 18
        },
        rpcUrls: ['https://rpc.public.zkevm-test.net'],
        blockExplorerUrls: ['https://testnet-zkevm.polygonscan.com/']
      }
    };
    
    this.init();
  }
  
  async init() {
    console.log('🔗 Initializing Web3Manager...');
    
    // Check if MetaMask is installed
    if (typeof window.ethereum !== 'undefined') {
      this.provider = new ethers.BrowserProvider(window.ethereum);
      console.log('✅ MetaMask detected');
      
      // Listen for account changes
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          this.handleDisconnect();
        } else {
          this.account = accounts[0];
          this.updateUI();
        }
      });
      
      // Listen for chain changes
      window.ethereum.on('chainChanged', (chainId) => {
        this.chainId = chainId;
        this.updateUI();
        // Reload page to reset any contract instances
        window.location.reload();
      });
      
    } else {
      console.log('⚠️ MetaMask not detected');
    }
  }
  
  // Connect wallet
  async connectWallet() {
    try {
      if (!this.provider) {
        throw new Error('MetaMask not installed');
      }
      
      // Request account access
      const accounts = await this.provider.send('eth_requestAccounts', []);
      this.account = accounts[0];
      this.signer = await this.provider.getSigner();
      
      // Get chain ID
      const network = await this.provider.getNetwork();
      this.chainId = '0x' + network.chainId.toString(16);
      
      console.log('✅ Wallet connected:', this.account);
      console.log('🌐 Network:', network.name, 'Chain ID:', this.chainId);
      
      // Switch to Polygon zkEVM if not already
      if (this.chainId !== this.networks.polygonZkEVMTestnet.chainId) {
        await this.switchNetwork();
      }
      
      this.updateUI();
      Utils.showNotification('지갑이 연결되었습니다!', 'success');
      
      return {
        account: this.account,
        chainId: this.chainId
      };
      
    } catch (error) {
      console.error('❌ Wallet connection failed:', error);
      Utils.showNotification(`지갑 연결 실패: ${error.message}`, 'error');
      throw error;
    }
  }
  
  // Disconnect wallet
  async disconnectWallet() {
    this.handleDisconnect();
    Utils.showNotification('지갑 연결이 해제되었습니다', 'info');
  }
  
  // Handle disconnect
  handleDisconnect() {
    this.account = null;
    this.signer = null;
    this.contracts = {};
    this.updateUI();
  }
  
  // Switch to Polygon zkEVM Testnet
  async switchNetwork() {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: this.networks.polygonZkEVMTestnet.chainId }]
      });
      console.log('✅ Switched to Polygon zkEVM Testnet');
    } catch (switchError) {
      // Network not added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [this.networks.polygonZkEVMTestnet]
          });
          console.log('✅ Added and switched to Polygon zkEVM Testnet');
        } catch (addError) {
          console.error('❌ Failed to add network:', addError);
          throw addError;
        }
      } else {
        console.error('❌ Failed to switch network:', switchError);
        throw switchError;
      }
    }
  }
  
  // Get contract instance
  getContract(contractName) {
    if (!this.contracts[contractName]) {
      const address = this.contractAddresses[contractName];
      if (!address) {
        throw new Error(`${contractName} address not set`);
      }
      
      const abi = window.CONTRACT_ABIS[contractName];
      if (!abi) {
        throw new Error(`${contractName} ABI not found`);
      }
      
      this.contracts[contractName] = new ethers.Contract(address, abi, this.signer);
    }
    
    return this.contracts[contractName];
  }
  
  // Get all quest data (for development/testing)
  async getAllQuests() {
    try {
      const contract = this.getContract('QuestFactory');
      const questCounter = await contract.questCounter();
      const quests = [];
      
      for (let i = 1; i <= questCounter; i++) {
        try {
          const questData = await contract.quests(i);
          const formattedQuest = window.ContractUtils.formatQuestData(questData);
          quests.push(formattedQuest);
        } catch (error) {
          console.warn(`Error fetching quest ${i}:`, error);
        }
      }
      
      return quests;
    } catch (error) {
      console.error('Error fetching quests:', error);
      return [];
    }
  }
  
  // Get quest participants
  async getQuestParticipants(questId) {
    try {
      const contract = this.getContract('QuestFactory');
      return await contract.getQuestParticipants(questId);
    } catch (error) {
      console.error('Error fetching quest participants:', error);
      return [];
    }
  }
  
  // Check if wallet is connected
  isConnected() {
    return !!this.account;
  }
  
  // Get account balance
  async getBalance() {
    if (!this.account || !this.provider) return '0';
    
    try {
      const balance = await this.provider.getBalance(this.account);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Error getting balance:', error);
      return '0';
    }
  }
  
  // Update UI elements
  updateUI() {
    // Update wallet connection status
    const connectButton = document.getElementById('connect-wallet-btn');
    const walletInfo = document.getElementById('wallet-info');
    const accountDisplay = document.getElementById('account-display');
    
    if (this.isConnected()) {
      if (connectButton) {
        connectButton.textContent = '지갑 연결됨';
        connectButton.classList.add('bg-green-500');
        connectButton.classList.remove('bg-blue-500');
      }
      
      if (walletInfo) {
        walletInfo.style.display = 'block';
      }
      
      if (accountDisplay) {
        const shortAccount = `${this.account.slice(0, 6)}...${this.account.slice(-4)}`;
        accountDisplay.textContent = shortAccount;
      }
      
      // Update balance
      this.getBalance().then(balance => {
        const balanceDisplay = document.getElementById('balance-display');
        if (balanceDisplay) {
          balanceDisplay.textContent = `${parseFloat(balance).toFixed(4)} ETH`;
        }
      });
      
    } else {
      if (connectButton) {
        connectButton.textContent = '지갑 연결';
        connectButton.classList.remove('bg-green-500');
        connectButton.classList.add('bg-blue-500');
      }
      
      if (walletInfo) {
        walletInfo.style.display = 'none';
      }
    }
  }
}

// Social Login Manager (Web2.5 onboarding simulation)
class SocialLoginManager {
  constructor() {
    this.providers = {
      google: {
        name: 'Google',
        icon: '🔍',
        clientId: 'demo-google-client-id'
      },
      apple: {
        name: 'Apple',
        icon: '🍎', 
        clientId: 'demo-apple-client-id'
      },
      kakao: {
        name: 'Kakao',
        icon: '💬',
        clientId: 'demo-kakao-client-id'
      }
    };
    
    this.currentUser = null;
  }
  
  // Simulate social login
  async loginWith(provider) {
    try {
      console.log(`🔐 Logging in with ${provider}...`);
      
      // Simulate OAuth flow
      const mockUser = await this.simulateOAuthFlow(provider);
      
      // Generate custodial wallet
      const custodyWallet = await this.generateCustodialWallet(mockUser);
      
      this.currentUser = {
        ...mockUser,
        wallet: custodyWallet,
        loginMethod: provider,
        loginTime: new Date().toISOString()
      };
      
      // Save to localStorage for persistence
      localStorage.setItem('rundao_user', JSON.stringify(this.currentUser));
      
      Utils.showNotification(`${provider} 로그인 성공! 지갑이 자동 생성되었습니다.`, 'success');
      
      this.updateSocialUI();
      
      return this.currentUser;
      
    } catch (error) {
      console.error(`❌ ${provider} login failed:`, error);
      Utils.showNotification(`${provider} 로그인 실패: ${error.message}`, 'error');
      throw error;
    }
  }
  
  // Simulate OAuth flow
  async simulateOAuthFlow(provider) {
    // In real implementation, this would redirect to OAuth provider
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockUsers = {
          google: {
            id: 'google_' + Math.random().toString(36).substring(7),
            email: 'user@gmail.com',
            name: '구글 러너',
            picture: 'https://via.placeholder.com/40'
          },
          apple: {
            id: 'apple_' + Math.random().toString(36).substring(7),
            email: 'user@icloud.com', 
            name: '애플 러너',
            picture: 'https://via.placeholder.com/40'
          },
          kakao: {
            id: 'kakao_' + Math.random().toString(36).substring(7),
            email: 'user@kakao.com',
            name: '카카오 러너',
            picture: 'https://via.placeholder.com/40'
          }
        };
        
        resolve(mockUsers[provider]);
      }, 1000);
    });
  }
  
  // Generate custodial wallet
  async generateCustodialWallet(user) {
    // In real implementation, this would use secure key management
    // For demo, we'll generate a deterministic wallet from user ID
    
    const seed = ethers.id(user.id + 'rundao_salt_2024'); // Deterministic seed
    const wallet = new ethers.Wallet(seed);
    
    return {
      address: wallet.address,
      type: 'custodial',
      provider: 'rundao_custody',
      createdAt: new Date().toISOString()
    };
  }
  
  // Logout
  async logout() {
    this.currentUser = null;
    localStorage.removeItem('rundao_user');
    this.updateSocialUI();
    Utils.showNotification('로그아웃되었습니다', 'info');
  }
  
  // Check if user is logged in
  isLoggedIn() {
    return !!this.currentUser;
  }
  
  // Load user from localStorage
  loadSavedUser() {
    const saved = localStorage.getItem('rundao_user');
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
        this.updateSocialUI();
        return this.currentUser;
      } catch (error) {
        console.error('Error loading saved user:', error);
        localStorage.removeItem('rundao_user');
      }
    }
    return null;
  }
  
  // Update social login UI
  updateSocialUI() {
    const loginSection = document.getElementById('social-login-section');
    const userSection = document.getElementById('user-section');
    
    if (this.isLoggedIn()) {
      if (loginSection) loginSection.style.display = 'none';
      if (userSection) userSection.style.display = 'block';
      
      // Update user info
      const userName = document.getElementById('user-name');
      const userEmail = document.getElementById('user-email');
      const userWallet = document.getElementById('user-wallet');
      const userPicture = document.getElementById('user-picture');
      
      if (userName) userName.textContent = this.currentUser.name;
      if (userEmail) userName.textContent = this.currentUser.email;
      if (userWallet) {
        const shortAddress = `${this.currentUser.wallet.address.slice(0, 6)}...${this.currentUser.wallet.address.slice(-4)}`;
        userWallet.textContent = shortAddress;
      }
      if (userPicture) userPicture.src = this.currentUser.picture;
      
    } else {
      if (loginSection) loginSection.style.display = 'block';
      if (userSection) userSection.style.display = 'none';
    }
  }
}

// Contract ABIs (simplified for demo)
const ContractABIs = {
  QuestFactory: [
    'function createQuest(string title, string description, uint256 startTime, uint256 endTime, uint256 distanceKm, uint256 timesPerWeek, address stakeToken, uint256 stakeAmount, uint256 maxSlots) returns (uint256)',
    'function joinQuest(uint256 questId) payable',
    'function getQuest(uint256 questId) view returns (tuple(uint256 id, address creator, string title, string description, uint256 startTime, uint256 endTime, uint256 distanceKm, uint256 timesPerWeek, address stakeToken, uint256 stakeAmount, uint256 maxSlots, uint256 successRate, uint256 daoRate, uint256 protocolFeeRate, uint8 status, uint256 participantCount, uint256 createdAt))',
    'function getQuestParticipants(uint256 questId) view returns (address[])',
    'event QuestCreated(uint256 indexed questId, address indexed creator, string title, uint256 stakeAmount, address stakeToken)',
    'event QuestJoined(uint256 indexed questId, address indexed participant, uint256 stakedAmount)'
  ],
  
  EscrowVault: [
    'function getEscrowRecord(uint256 questId, address participant) view returns (tuple(uint256 questId, address participant, address token, uint256 amount, bool isLocked, uint256 lockedAt))',
    'function getContractBalance(address token) view returns (uint256)',
    'function getAvailableBalance(address token) view returns (uint256)'
  ],
  
  MedalNFT: [
    'function getMedal(uint256 tokenId) view returns (tuple(uint256 tokenId, uint256 questId, address recipient, uint8 medalType, uint8 rarity, string title, string description, string imageHash, uint256 mintedAt, uint256 distanceKm, uint256 completedSessions, uint256 totalParticipants, string personalStory, bool isUpgradeable, uint256 upgradeLevel, uint256[] sourceTokenIds))',
    'function getUserMedals(address user) view returns (uint256[])',
    'function getUserMedalStats(address user) view returns (uint256 goldCount, uint256 greyCount, uint256 specialCount, uint256 seasonalCount, uint256 totalCount)',
    'function balanceOf(address owner) view returns (uint256)',
    'function tokenURI(uint256 tokenId) view returns (string)'
  ]
};

// Initialize managers
window.web3Manager = new Web3Manager();
window.socialManager = new SocialLoginManager();

// Load saved user on page load
document.addEventListener('DOMContentLoaded', function() {
  window.socialManager.loadSavedUser();
});

console.log('🚀 Web3 & Social Login modules loaded');
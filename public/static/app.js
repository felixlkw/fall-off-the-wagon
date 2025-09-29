// 작심삼일 RUN DAO - Frontend JavaScript

// Global app state
window.RunDAO = {
  currentUser: null,
  currentCrew: null,
  apiBase: window.location.origin + '/api'
};

// Utility functions
const Utils = {
  // Format date to Korean locale
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  // Format distance
  formatDistance(km) {
    return `${km.toFixed(1)}km`;
  },

  // Format duration
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    }
    return `${minutes}분`;
  },

  // Show notification
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
      type === 'success' ? 'bg-green-500 text-white' :
      type === 'error' ? 'bg-red-500 text-white' :
      'bg-blue-500 text-white'
    }`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  },

  // API request wrapper
  async apiRequest(endpoint, options = {}) {
    const url = `${window.RunDAO.apiBase}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'API request failed');
      }
      
      return data;
    } catch (error) {
      console.error('API Error:', error);
      Utils.showNotification(error.message, 'error');
      throw error;
    }
  }
};

// API wrapper functions
const API = {
  async getHealth() {
    return Utils.apiRequest('/health');
  },

  async getUsers() {
    return Utils.apiRequest('/users');
  },

  async getUser(userId) {
    return Utils.apiRequest(`/users/${userId}`);
  },

  async getCrews() {
    return Utils.apiRequest('/crews');
  },

  async getCrewQuests(crewId) {
    return Utils.apiRequest(`/crews/${crewId}/quests`);
  },

  async getQuest(questId) {
    return Utils.apiRequest(`/quests/${questId}`);
  }
};

// UI Component helpers
const UI = {
  // Create progress bar
  createProgressBar(percentage, className = '') {
    return `
      <div class="progress-bar ${className}">
        <div class="progress-fill" style="width: ${Math.min(100, Math.max(0, percentage))}%"></div>
      </div>
      <span class="text-sm text-gray-600 mt-1">${percentage.toFixed(1)}%</span>
    `;
  },

  // Create status badge
  createStatusBadge(status) {
    const statusMap = {
      'success': { class: 'status-success', text: '성공', icon: '✅' },
      'active': { class: 'status-pending', text: '진행중', icon: '🏃‍♂️' },
      'pending': { class: 'status-pending', text: '대기중', icon: '⏳' },
      'fail': { class: 'status-failed', text: '실패', icon: '❌' },
      'forfeit': { class: 'status-failed', text: '포기', icon: '🏳️' }
    };

    const statusInfo = statusMap[status] || { class: 'bg-gray-100 text-gray-800', text: status, icon: '❓' };
    return `<span class="${statusInfo.class}">${statusInfo.icon} ${statusInfo.text}</span>`;
  },

  // Create user avatar
  createUserAvatar(user, size = 'w-8 h-8') {
    const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500'];
    const colorClass = colors[Math.abs(user.id.charCodeAt(0)) % colors.length];
    const initials = user.nickname ? user.nickname.substring(0, 2) : '🏃‍♂️';

    return `
      <div class="${size} ${colorClass} rounded-full flex items-center justify-center text-white font-semibold text-sm">
        ${initials}
      </div>
    `;
  }
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('🏃‍♂️ 작심삼일 RUN DAO - Frontend Loaded');
  
  // Add fade-in animation to main content
  const mainContent = document.querySelector('body > *');
  if (mainContent) {
    mainContent.classList.add('fade-in-up');
  }

  // Test API connection
  API.getHealth()
    .then(data => {
      console.log('✅ API Health Check:', data);
      if (data.users > 0) {
        Utils.showNotification(`시스템 정상 (${data.users}명 사용자)`, 'success');
      }
    })
    .catch(error => {
      console.error('❌ API Health Check Failed:', error);
    });

  // Add click handlers for API test links
  document.querySelectorAll('a[href^="/api/"]').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const endpoint = this.getAttribute('href').replace('/api', '');
      
      Utils.apiRequest(endpoint)
        .then(data => {
          console.log(`API Response for ${endpoint}:`, data);
          
          // Show formatted response in a modal or console
          const jsonString = JSON.stringify(data, null, 2);
          const newWindow = window.open('', '_blank');
          newWindow.document.write(`
            <html>
              <head><title>API Response: ${endpoint}</title></head>
              <body style="font-family: monospace; padding: 20px; background: #f5f5f5;">
                <h3>GET ${endpoint}</h3>
                <pre style="background: white; padding: 20px; border-radius: 8px; overflow: auto;">${jsonString}</pre>
                <button onclick="window.close()" style="margin-top: 20px; padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">닫기</button>
              </body>
            </html>
          `);
        })
        .catch(error => {
          Utils.showNotification(`API 요청 실패: ${error.message}`, 'error');
        });
    });
  });
});

// Web3 Connection Functions
async function handleWalletConnection() {
  console.log('🔗 Wallet connection requested...');
  
  try {
    if (window.web3Manager && window.web3Manager.isConnected()) {
      // Disconnect wallet
      await window.web3Manager.disconnectWallet();
      
      // Update UI
      document.getElementById('connect-wallet-btn').textContent = '지갑 연결';
      document.getElementById('wallet-info').classList.add('hidden');
      
      Utils.showNotification('지갑 연결이 해제되었습니다', 'info');
    } else {
      // Connect wallet
      const connected = await window.web3Manager.connectWallet();
      
      if (connected) {
        // Update UI with wallet info
        const account = window.web3Manager.account;
        const balance = await window.web3Manager.getBalance();
        
        document.getElementById('account-display').textContent = 
          `${account.slice(0, 6)}...${account.slice(-4)}`;
        document.getElementById('balance-display').textContent = `${balance} ETH`;
        
        document.getElementById('connect-wallet-btn').textContent = '연결 해제';
        document.getElementById('wallet-info').classList.remove('hidden');
        
        Utils.showNotification('지갑이 성공적으로 연결되었습니다!', 'success');
        
        // Try to load or create user profile
        await handleUserRegistration(account);
      }
    }
  } catch (error) {
    console.error('Wallet connection error:', error);
    Utils.showNotification(`지갑 연결 실패: ${error.message}`, 'error');
  }
}

// Handle user registration after wallet connection
async function handleUserRegistration(walletAddress) {
  try {
    // Check if user exists
    const existingUser = await Utils.apiRequest(`/users/wallet/${walletAddress}`);
    
    if (existingUser.user) {
      window.RunDAO.currentUser = existingUser.user;
      Utils.showNotification(`환영합니다, ${existingUser.user.nickname}님!`, 'success');
      
      // Update dashboard with existing user data
      updateUserDashboard(existingUser.user);
    } else {
      // New user - show registration prompt
      const nickname = prompt('처음 오셨네요! 닉네임을 입력해주세요:', 'Runner');
      
      if (nickname) {
        const userData = {
          wallet_address: walletAddress,
          nickname: nickname,
          email: null,
          social_provider: null,
          social_id: null
        };
        
        const result = await Utils.apiRequest('/users', {
          method: 'POST',
          body: JSON.stringify(userData)
        });
        
        window.RunDAO.currentUser = userData;
        Utils.showNotification(`가입 완료! 환영합니다, ${nickname}님!`, 'success');
        
        // Update dashboard with new user data
        updateUserDashboard(userData);
      }
    }
  } catch (error) {
    console.error('User registration error:', error);
    Utils.showNotification('사용자 등록 중 오류가 발생했습니다', 'error');
  }
}

// Update user dashboard with user data
function updateUserDashboard(userData) {
  // Show dashboard and hide social login section
  document.getElementById('social-login-section').style.display = 'none';
  document.getElementById('user-dashboard').classList.remove('hidden');
  
  // Update user info
  document.getElementById('user-nickname').textContent = `${userData.nickname}님, 환영합니다!`;
  document.getElementById('user-wallet').textContent = 
    `지갑 주소: ${userData.wallet_address?.slice(0, 8)}...${userData.wallet_address?.slice(-6)}`;
  
  // Update user avatar with initials
  const avatar = document.getElementById('user-avatar');
  avatar.textContent = userData.nickname ? userData.nickname.substring(0, 2) : '🏃‍♂️';
  
  // Update stats
  document.getElementById('stat-total-quests').textContent = userData.total_quests_completed || 0;
  document.getElementById('stat-total-distance').textContent = `${userData.total_distance_km || 0}km`;
  document.getElementById('stat-total-medals').textContent = userData.total_medals_earned || 0;
  
  // Calculate success rate
  const successRate = userData.total_quests_completed > 0 
    ? ((userData.total_quests_completed / (userData.total_quests_completed + 1)) * 100).toFixed(0)
    : 0;
  document.getElementById('stat-success-rate').textContent = `${successRate}%`;
  
  // Update balance if available
  if (window.web3Manager && window.web3Manager.isConnected()) {
    window.web3Manager.getBalance().then(balance => {
      document.getElementById('user-balance').textContent = `${balance} ETH`;
    }).catch(console.error);
  }
}

// Social Login Integration
async function handleSocialLogin(provider) {
  console.log(`🔑 ${provider} 소셜 로그인 시도...`);
  
  try {
    if (!window.socialManager) {
      throw new Error('Social Login Manager not initialized');
    }
    
    const result = await window.socialManager.loginWith(provider);
    
    if (result.success) {
      // Social login successful, now create/get custodial wallet
      const walletInfo = await window.socialManager.getOrCreateWallet();
      
      // Register or login user
      const userData = {
        wallet_address: walletInfo.address,
        email: result.user.email,
        nickname: result.user.name || result.user.nickname,
        social_provider: provider,
        social_id: result.user.id
      };
      
      try {
        // Try to create new user
        await Utils.apiRequest('/users', {
          method: 'POST',
          body: JSON.stringify(userData)
        });
        
        Utils.showNotification(`${provider} 로그인 성공! 새 계정이 생성되었습니다`, 'success');
      } catch (error) {
        // User might already exist, try to get existing user
        const existingUser = await Utils.apiRequest(`/users/wallet/${walletInfo.address}`);
        if (existingUser.user) {
          Utils.showNotification(`${provider} 로그인 성공! 환영합니다`, 'success');
        }
      }
      
      window.RunDAO.currentUser = userData;
      
      // Update wallet UI
      document.getElementById('account-display').textContent = 
        `${walletInfo.address.slice(0, 6)}...${walletInfo.address.slice(-4)}`;
      document.getElementById('balance-display').textContent = `0.0 ETH`;
      
      document.getElementById('connect-wallet-btn').textContent = '연결 해제';
      document.getElementById('wallet-info').classList.remove('hidden');
      
      // Update user dashboard
      updateUserDashboard(userData);
      
    } else {
      throw new Error(result.error || `${provider} 로그인 실패`);
    }
    
  } catch (error) {
    console.error('Social login error:', error);
    Utils.showNotification(`${provider} 로그인 실패: ${error.message}`, 'error');
  }
}

// Contract interaction functions
async function createQuest(questData) {
  try {
    if (!window.web3Manager || !window.web3Manager.isConnected()) {
      throw new Error('지갑이 연결되지 않았습니다');
    }
    
    // Check if contract addresses are available
    if (!window.CONTRACT_ADDRESSES.QuestFactory || window.CONTRACT_ADDRESSES.QuestFactory === "0x1234567890123456789012345678901234567890") {
      console.warn('⚠️ Using test contract addresses - contracts not deployed yet');
      throw new Error('스마트 컨트랙트가 아직 배포되지 않았습니다. 테스트 모드에서는 데이터베이스에만 저장됩니다.');
    }
    
    const contract = window.web3Manager.getContract('QuestFactory');
    
    // Convert distance to contract format (cm)
    const distanceInCm = window.ContractUtils.kmToCm(questData.distanceKm);
    
    // Call createQuest function on smart contract
    const tx = await contract.createQuest(
      questData.title,
      questData.description,
      questData.crewId || 0,
      questData.startTime,
      questData.endTime,
      distanceInCm,
      questData.timesPerWeek,
      questData.maxSlots,
      {
        value: ethers.parseEther(questData.stakeAmount.toString())
      }
    );
    
    Utils.showNotification('퀘스트 생성 트랜잭션을 전송했습니다...', 'info');
    
    const receipt = await tx.wait();
    
    // Extract quest ID from event logs
    let questId = null;
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed.name === 'QuestCreated') {
          questId = parsed.args.questId;
          break;
        }
      } catch (e) {
        // Log parsing failed, continue
      }
    }
    
    Utils.showNotification('퀘스트가 성공적으로 생성되었습니다! 🎉', 'success');
    
    // Reload active quests
    loadActiveQuests();
    
    return {
      receipt,
      questId,
      transactionHash: receipt.hash
    };
    
  } catch (error) {
    console.error('Quest creation error:', error);
    
    // Handle specific error cases
    if (error.code === 'INSUFFICIENT_FUNDS') {
      Utils.showNotification('잔액이 부족합니다. ETH를 충전해주세요.', 'error');
    } else if (error.code === 'USER_REJECTED') {
      Utils.showNotification('트랜잭션이 취소되었습니다.', 'error');
    } else {
      Utils.showNotification(`퀘스트 생성 실패: ${error.message}`, 'error');
    }
    
    throw error;
  }
}

async function joinQuest(questId, stakeAmount) {
  try {
    if (!window.web3Manager || !window.web3Manager.isConnected()) {
      throw new Error('지갑이 연결되지 않았습니다');
    }
    
    // Check if contract addresses are available
    if (!window.CONTRACT_ADDRESSES.QuestFactory || window.CONTRACT_ADDRESSES.QuestFactory === "0x1234567890123456789012345678901234567890") {
      console.warn('⚠️ Using test contract addresses - contracts not deployed yet');
      throw new Error('스마트 컨트랙트가 아직 배포되지 않았습니다. 테스트 모드에서는 데이터베이스에만 저장됩니다.');
    }
    
    const contract = window.web3Manager.getContract('QuestFactory');
    
    // Get quest info first to validate stake amount
    const questData = await contract.quests(questId);
    const formattedQuest = window.ContractUtils.formatQuestData(questData);
    
    // Validate stake amount
    const requiredStake = ethers.parseEther(formattedQuest.stakeAmount.toString());
    const providedStake = ethers.parseEther(stakeAmount.toString());
    
    if (providedStake !== requiredStake) {
      throw new Error(`스테이킹 금액이 올바르지 않습니다. 필요: ${formattedQuest.stakeAmount} ETH`);
    }
    
    // Call joinQuest function on smart contract
    const tx = await contract.joinQuest(questId, {
      value: providedStake
    });
    
    Utils.showNotification('퀘스트 참여 트랜잭션을 전송했습니다...', 'info');
    
    const receipt = await tx.wait();
    
    Utils.showNotification('퀘스트에 성공적으로 참여했습니다! 🏃‍♂️', 'success');
    
    // Reload active quests
    loadActiveQuests();
    
    return {
      receipt,
      questId,
      transactionHash: receipt.hash
    };
    
  } catch (error) {
    console.error('Quest join error:', error);
    
    // Handle specific error cases
    if (error.code === 'INSUFFICIENT_FUNDS') {
      Utils.showNotification('잔액이 부족합니다. ETH를 충전해주세요.', 'error');
    } else if (error.code === 'USER_REJECTED') {
      Utils.showNotification('트랜잭션이 취소되었습니다.', 'error');
    } else {
      Utils.showNotification(`퀘스트 참여 실패: ${error.message}`, 'error');
    }
    
    throw error;
  }
}

// Load active quests and display them
async function loadActiveQuests() {
  try {
    const crews = await API.getCrews();
    const questsContainer = document.getElementById('active-quests');
    
    if (!questsContainer || !crews.crews) return;
    
    questsContainer.innerHTML = '';
    
    // Load quests for each crew
    for (const crew of crews.crews.slice(0, 2)) { // Show first 2 crews
      try {
        const quests = await API.getCrewQuests(crew.id);
        
        if (quests.quests && quests.quests.length > 0) {
          const quest = quests.quests[0]; // Show first quest
          
          const statusColor = quest.status === 'active' ? 'green' : 
                             quest.status === 'open' ? 'blue' : 'gray';
          const statusText = quest.status === 'active' ? '진행중' :
                           quest.status === 'open' ? '모집중' : '완료';
          
          const questCard = document.createElement('div');
          questCard.className = 'p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer';
          questCard.innerHTML = `
            <div class="flex justify-between items-start mb-3">
              <h3 class="font-semibold text-lg">${quest.title}</h3>
              <span class="bg-${statusColor}-100 text-${statusColor}-800 px-2 py-1 rounded-full text-sm">${statusText}</span>
            </div>
            <p class="text-gray-600 mb-3">${quest.description || '러닝 챌린지에 참여하세요!'}</p>
            <div class="flex justify-between items-center text-sm text-gray-500">
              <span>참여자: ${quest.participant_count || 0}명</span>
              <span>스테이크: ${quest.stake_amount || 0} ${quest.stake_token || 'ETH'}</span>
            </div>
          `;
          
          questCard.addEventListener('click', () => {
            showQuestDetails(quest.id);
          });
          
          questsContainer.appendChild(questCard);
        }
      } catch (error) {
        console.error(`Error loading quests for crew ${crew.id}:`, error);
      }
    }
    
    if (questsContainer.children.length === 0) {
      questsContainer.innerHTML = `
        <div class="col-span-2 text-center py-8 text-gray-500">
          <div class="text-4xl mb-4">🎯</div>
          <p class="text-lg">아직 진행 중인 퀘스트가 없습니다</p>
          <p class="text-sm">첫 번째 러닝 챌린지를 만들어보세요!</p>
        </div>
      `;
    }
    
  } catch (error) {
    console.error('Error loading active quests:', error);
  }
}

// Show quest details modal with comprehensive information
async function showQuestDetails(questId) {
  console.log(`📊 Loading quest details for: ${questId}`);
  
  try {
    // Get quest data (mock data for now, will integrate with API/blockchain later)
    const questData = getMockQuestData(questId);
    
    // Update modal content
    updateQuestDetailModal(questData);
    
    // Check user participation status
    await updateParticipationStatus(questId);
    
    // Show modal
    document.getElementById('quest-detail-modal').classList.remove('hidden');
    
  } catch (error) {
    console.error('Error loading quest details:', error);
    Utils.showNotification('퀘스트 정보를 불러올 수 없습니다', 'error');
  }
}

// Close quest detail modal
function closeQuestDetailModal() {
  document.getElementById('quest-detail-modal').classList.add('hidden');
}

// Get mock quest data (will be replaced with API/blockchain calls)
function getMockQuestData(questId) {
  const mockData = {
    quest_1: {
      id: 'quest_1',
      title: '새해 다짐 5km 챌린지',
      description: '새해를 맞아 건강한 습관을 만들어보세요! 일주일에 3번, 각각 5km 이상 달리는 챌린지입니다. 꾸준히 참여하면 건강도 챙기고 보상도 받을 수 있어요.',
      creator: '부산 러닝 크루',
      creatorAddress: '0x1234...5678',
      distance: 5.0,
      frequency: 3,
      duration: 14,
      startTime: '2025-01-01 06:00',
      endTime: '2025-01-15 23:59',
      stakeAmount: 0.1,
      successRate: 70,
      maxSlots: 10,
      currentParticipants: 3,
      status: 'open',
      participants: [
        { address: '0x1111...1111', nickname: 'Alice Runner', joinedDaysAgo: 2 },
        { address: '0x2222...2222', nickname: 'Bob Sprinter', joinedDaysAgo: 1 },
        { address: '0x3333...3333', nickname: 'Charlie Jogger', joinedDaysAgo: 0 }
      ]
    },
    quest_2: {
      id: 'quest_2',
      title: '겨울 극복 3km 챌린지',
      description: '추운 겨울을 이겨내고 꾸준히 달려보세요. 작은 목표부터 시작해서 러닝 습관을 만들어가는 챌린지입니다.',
      creator: '전체 공개',
      creatorAddress: '0x5678...9012',
      distance: 3.0,
      frequency: 2,
      duration: 21,
      startTime: '2025-01-05 06:00',
      endTime: '2025-01-26 23:59',
      stakeAmount: 0.05,
      successRate: 70,
      maxSlots: 8,
      currentParticipants: 1,
      status: 'open',
      participants: [
        { address: '0x4444...4444', nickname: 'Dana Walker', joinedDaysAgo: 5 }
      ]
    },
    quest_3: {
      id: 'quest_3',
      title: '마라톤 준비 10km 도전',
      description: '마라톤 대회를 준비하는 체계적인 10km 훈련 프로그램입니다. 고강도 훈련으로 실력을 한단계 업그레이드하세요!',
      creator: '서울 마라톤 클럽',
      creatorAddress: '0x9012...3456',
      distance: 10.0,
      frequency: 4,
      duration: 30,
      startTime: '2025-01-03 05:00',
      endTime: '2025-02-02 23:59',
      stakeAmount: 0.2,
      successRate: 70,
      maxSlots: 15,
      currentParticipants: 8,
      status: 'starting_soon',
      participants: [] // Simplified for demo
    }
  };
  
  return mockData[questId] || mockData.quest_1;
}

// Update quest detail modal with quest data
function updateQuestDetailModal(questData) {
  // Basic info
  document.getElementById('quest-detail-title').textContent = questData.title;
  document.getElementById('quest-detail-creator').textContent = `크리에이터: ${questData.creator}`;
  document.getElementById('quest-detail-description').textContent = questData.description;
  
  // Quest requirements
  document.getElementById('quest-distance').textContent = `${questData.distance}km`;
  document.getElementById('quest-frequency').textContent = `주 ${questData.frequency}회`;
  document.getElementById('quest-duration').textContent = `${questData.duration}일`;
  document.getElementById('quest-start-time').textContent = questData.startTime.split(' ')[0];
  
  // Staking info
  document.getElementById('quest-stake-amount').textContent = `${questData.stakeAmount} ETH`;
  document.getElementById('quest-success-rate').textContent = `${questData.successRate}%`;
  document.getElementById('quest-failure-rate').textContent = `${100 - questData.successRate}%`;
  document.getElementById('join-cost-display').textContent = `${questData.stakeAmount} ETH`;
  
  // Participants info
  document.getElementById('quest-participants-info').textContent = 
    `${questData.currentParticipants}/${questData.maxSlots}명 참여 중`;
  document.getElementById('quest-slots-remaining').textContent = 
    `${questData.maxSlots - questData.currentParticipants}자리 남음`;
  
  // Status banner
  updateStatusBanner(questData);
  
  // Participants list
  updateParticipantsList(questData.participants);
  
  // Store current quest data for later use
  window.currentQuestData = questData;
}

// Update status banner based on quest status
function updateStatusBanner(questData) {
  const banner = document.getElementById('quest-status-banner');
  const icon = document.getElementById('quest-status-icon');
  const text = document.getElementById('quest-status-text');
  const timeRemaining = document.getElementById('quest-time-remaining');
  
  switch (questData.status) {
    case 'open':
      banner.className = 'mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200';
      icon.textContent = '📢';
      text.textContent = '모집 중';
      timeRemaining.textContent = '5일 남음';
      break;
    case 'starting_soon':
      banner.className = 'mb-6 p-4 rounded-lg bg-orange-50 border border-orange-200';
      icon.textContent = '🔄';
      text.textContent = '곧 시작';
      timeRemaining.textContent = '2일 후 시작';
      break;
    case 'active':
      banner.className = 'mb-6 p-4 rounded-lg bg-green-50 border border-green-200';
      icon.textContent = '🏃‍♂️';
      text.textContent = '진행 중';
      timeRemaining.textContent = '10일 남음';
      break;
    default:
      banner.className = 'mb-6 p-4 rounded-lg bg-gray-50 border border-gray-200';
      icon.textContent = '❓';
      text.textContent = '상태 확인 중';
      timeRemaining.textContent = '- -';
  }
}

// Update participants list in modal
function updateParticipantsList(participants) {
  const container = document.getElementById('quest-participants-list');
  
  if (!participants || participants.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4 text-gray-500">
        <div class="text-2xl mb-2">👥</div>
        <div>아직 참여자가 없습니다</div>
        <div class="text-sm">첫 번째 참여자가 되어보세요!</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = participants.map((participant, index) => {
    const colors = ['bg-green-500', 'bg-blue-500', 'bg-purple-500', 'bg-red-500', 'bg-yellow-500'];
    const colorClass = colors[index % colors.length];
    const initials = participant.nickname.substring(0, 2).toUpperCase();
    
    return `
      <div class="flex items-center space-x-3 bg-white rounded p-3">
        <div class="w-8 h-8 ${colorClass} rounded-full flex items-center justify-center text-white text-sm font-bold">
          ${initials}
        </div>
        <div>
          <div class="font-medium">${participant.nickname}</div>
          <div class="text-sm text-gray-600">${participant.joinedDaysAgo}일 전 참여</div>
        </div>
      </div>
    `;
  }).join('');
}

// Check and update user participation status
async function updateParticipationStatus(questId) {
  const currentUser = window.RunDAO.currentUser;
  const joinSection = document.getElementById('join-quest-section');
  const participatedSection = document.getElementById('already-participated-section');
  
  if (!currentUser) {
    // Not logged in
    joinSection.innerHTML = `
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
        <div class="text-yellow-800 font-semibold mb-2">로그인이 필요합니다</div>
        <button onclick="closeQuestDetailModal()" class="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-2 rounded font-medium">
          로그인하러 가기
        </button>
      </div>
    `;
    participatedSection.classList.add('hidden');
    return;
  }
  
  // Check if already participated (mock check for now)
  const hasParticipated = checkUserParticipation(questId, currentUser);
  
  if (hasParticipated) {
    joinSection.classList.add('hidden');
    participatedSection.classList.remove('hidden');
  } else {
    joinSection.classList.remove('hidden');
    participatedSection.classList.add('hidden');
  }
}

// Mock function to check user participation
function checkUserParticipation(questId, user) {
  // In real implementation, this would check blockchain or database
  return false; // For demo, assume user hasn't participated yet
}

// Confirm quest join with detailed confirmation
function confirmQuestJoin() {
  const questData = window.currentQuestData;
  if (!questData) {
    Utils.showNotification('퀘스트 정보를 찾을 수 없습니다', 'error');
    return;
  }
  
  const confirmed = confirm(`
퀘스트 참여 확인

📋 퀘스트: ${questData.title}
💰 스테이킹: ${questData.stakeAmount} ETH
🎯 목표: ${questData.distance}km × 주${questData.frequency}회
📅 기간: ${questData.duration}일

정말 참여하시겠습니까?

⚠️ 스테이킹한 ETH는 퀘스트 완료 후 성과에 따라 분배됩니다.
`);
  
  if (confirmed) {
    handleQuestJoin(questData.id, questData.stakeAmount);
    closeQuestDetailModal();
  }
}

// Navigate to my quests dashboard
function goToMyQuests() {
  closeQuestDetailModal();
  openMyQuestsDashboard();
}

// Dashboard Management Functions
function openMyQuestsDashboard() {
  console.log('📊 Opening My Quests Dashboard...');
  
  // Check if user is logged in
  if (!window.RunDAO.currentUser) {
    Utils.showNotification('대시보드를 보려면 로그인해주세요', 'error');
    return;
  }
  
  // Hide main content and show dashboard
  document.querySelector('.min-h-screen.bg-gradient-to-br').style.display = 'none';
  document.getElementById('my-quests-dashboard').classList.remove('hidden');
  
  // Load dashboard data
  initializeDashboard();
  
  Utils.showNotification('대시보드를 불러오는 중입니다...', 'info');
}

function closeDashboard() {
  // Show main content and hide dashboard
  document.querySelector('.min-h-screen.bg-gradient-to-br').style.display = 'block';
  document.getElementById('my-quests-dashboard').classList.add('hidden');
  
  console.log('📊 Dashboard closed');
}

function switchDashboardTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.dashboard-tab').forEach(tab => {
    tab.classList.remove('active-tab', 'border-indigo-500', 'text-indigo-600');
    tab.classList.add('border-transparent', 'text-gray-500');
  });
  
  // Hide all tab contents
  document.querySelectorAll('.dashboard-content').forEach(content => {
    content.classList.add('hidden');
  });
  
  // Show selected tab
  const activeTab = document.querySelector(`[onclick="switchDashboardTab('${tabName}')"]`);
  activeTab.classList.add('active-tab', 'border-indigo-500', 'text-indigo-600');
  activeTab.classList.remove('border-transparent', 'text-gray-500');
  
  document.getElementById(`${tabName}-tab`).classList.remove('hidden');
  
  // Load tab-specific data
  loadTabData(tabName);
  
  console.log(`📊 Switched to ${tabName} tab`);
}

async function initializeDashboard() {
  try {
    // Update user greeting
    const user = window.RunDAO.currentUser;
    document.getElementById('dashboard-user-greeting').textContent = 
      `${user.nickname}님의 러닝 여정을 함께 추적해보세요!`;
    
    // Load dashboard stats
    await loadDashboardStats();
    
    // Load default tab (active quests)
    await loadTabData('active-quests');
    
    console.log('✅ Dashboard initialized');
    
  } catch (error) {
    console.error('Dashboard initialization error:', error);
    Utils.showNotification('대시보드를 불러오는 중 오류가 발생했습니다', 'error');
  }
}

async function loadDashboardStats() {
  let stats;
  
  try {
    if (!window.RunDAO.currentUser) {
      // Use mock data if no user is logged in
      stats = await getMockUserStats();
    } else {
      // Get user stats from API
      try {
        const userResponse = await API.getUser(window.RunDAO.currentUser.id);
        const userData = userResponse.user;
        
        // Calculate stats from user data and participation records
        stats = {
          activeQuests: userData.active_quests_count || 0,
          totalRuns: userData.total_runs || 0,
          totalDistance: parseFloat(userData.total_distance_km || 0),
          successRate: userData.success_rate || 0
        };
      } catch (error) {
        console.error('Error fetching user stats:', error);
        stats = await getMockUserStats();
      }
    }
  } catch (error) {
    console.error('Error loading dashboard stats:', error);
    stats = await getMockUserStats();
  }
  
  document.getElementById('stat-active-quests').textContent = stats.activeQuests;
  document.getElementById('stat-total-runs').textContent = stats.totalRuns;
  document.getElementById('stat-total-distance').textContent = `${stats.totalDistance}km`;
  document.getElementById('stat-success-rate').textContent = `${stats.successRate}%`;
}

function getMockUserStats() {
  return Promise.resolve({
    activeQuests: 3,
    totalRuns: 12,
    totalDistance: 45.2,
    successRate: 85
  });
}

async function loadTabData(tabName) {
  switch (tabName) {
    case 'active-quests':
      await loadActiveQuestsTab();
      break;
    case 'run-history':
      await loadRunHistoryTab();
      break;
    case 'rewards':
      await loadRewardsTab();
      break;
    case 'completed':
      await loadCompletedQuestsTab();
      break;
  }
}

async function loadActiveQuestsTab() {
  console.log('📊 Loading active quests tab...');
  
  const container = document.getElementById('active-quests-list');
  
  // Get actual active quests from API
  let activeQuests = [];
  try {
    if (!window.RunDAO.currentUser) {
      // Use mock data if no user is logged in
      activeQuests = await getMockActiveQuests();
    } else {
      // TODO: Get user's active quests from API
      // For now, get all quests and filter by status
      const crews = await API.getCrews();
      
      if (crews.crews) {
        for (const crew of crews.crews) {
          try {
            const quests = await API.getCrewQuests(crew.id);
            if (quests.quests) {
              const activeCrewQuests = quests.quests.filter(q => 
                q.status === 'active' || q.status === 'open'
              ).map(q => ({
                id: q.id,
                title: q.title,
                distance: parseFloat(q.distance_km) || 5.0,
                frequency: parseInt(q.times_per_week) || 3,
                status: q.status,
                endDate: q.end_date,
                completedSessions: Math.floor(Math.random() * 3), // Mock for now
                requiredSessions: parseInt(q.times_per_week) || 3,
                thisWeekRuns: [] // Mock for now
              }));
              activeQuests.push(...activeCrewQuests);
            }
          } catch (error) {
            console.error(`Error loading quests for crew ${crew.id}:`, error);
          }
        }
      }
      
      // Fallback to mock data if no quests found
      if (activeQuests.length === 0) {
        activeQuests = await getMockActiveQuests();
      }
    }
  } catch (error) {
    console.error('Error loading active quests:', error);
    // Fallback to mock data on error
    activeQuests = await getMockActiveQuests();
  }
  
  if (activeQuests.length === 0) {
    container.innerHTML = `
      <div class="col-span-2 text-center py-12">
        <div class="text-6xl mb-4">🎯</div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">참여 중인 퀘스트가 없습니다</h3>
        <p class="text-gray-600 mb-6">새로운 러닝 챌린지에 참여해보세요!</p>
        <button onclick="closeDashboard()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium">
          퀘스트 둘러보기
        </button>
      </div>
    `;
    return;
  }
  
  container.innerHTML = activeQuests.map(quest => createActiveQuestCard(quest)).join('');
}

function createActiveQuestCard(quest) {
  const progressPercent = (quest.completedSessions / quest.requiredSessions) * 100;
  const daysLeft = Math.ceil((new Date(quest.endDate) - new Date()) / (1000 * 60 * 60 * 24));
  
  return `
    <div class="bg-white rounded-xl shadow-lg overflow-hidden">
      <!-- Quest Header -->
      <div class="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6">
        <div class="flex justify-between items-start mb-4">
          <h3 class="text-xl font-bold">${quest.title}</h3>
          <span class="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
            ${quest.status === 'active' ? '🏃‍♂️ 진행 중' : '📢 준비 중'}
          </span>
        </div>
        
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div class="opacity-75">목표</div>
            <div class="font-semibold">${quest.distance}km × 주${quest.frequency}회</div>
          </div>
          <div>
            <div class="opacity-75">남은 기간</div>
            <div class="font-semibold">${daysLeft}일</div>
          </div>
        </div>
      </div>

      <!-- Progress Section -->
      <div class="p-6">
        <div class="mb-4">
          <div class="flex justify-between items-center mb-2">
            <span class="text-sm font-medium text-gray-700">이번 주 진행률</span>
            <span class="text-sm text-gray-600">${quest.completedSessions}/${quest.requiredSessions}회 완료</span>
          </div>
          
          <div class="w-full bg-gray-200 rounded-full h-3">
            <div class="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-300" 
                 style="width: ${Math.min(progressPercent, 100)}%"></div>
          </div>
          
          <div class="text-xs text-gray-500 mt-1">${progressPercent.toFixed(1)}% 달성</div>
        </div>

        <!-- This Week's Runs -->
        <div class="mb-4">
          <h4 class="font-semibold text-gray-900 mb-2">이번 주 러닝 기록</h4>
          <div class="space-y-2">
            ${quest.thisWeekRuns.map((run, index) => `
              <div class="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                <div class="flex items-center space-x-3">
                  <span class="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">${index + 1}</span>
                  <div>
                    <div class="text-sm font-medium">${run.distance}km</div>
                    <div class="text-xs text-gray-500">${run.date}</div>
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-sm font-medium">${run.duration}</div>
                  <div class="text-xs text-gray-500">${run.pace}/km</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex space-x-3">
          <button 
            onclick="openRunSubmitModal()" 
            class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded font-medium text-sm"
          >
            📊 러닝 기록
          </button>
          <button 
            onclick="showQuestDetails('${quest.id}')" 
            class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded font-medium text-sm"
          >
            상세 보기
          </button>
        </div>
      </div>
    </div>
  `;
}

function getMockActiveQuests() {
  return Promise.resolve([
    {
      id: 'quest_1',
      title: '새해 다짐 5km 챌린지',
      distance: 5.0,
      frequency: 3,
      status: 'active',
      endDate: '2025-01-15',
      completedSessions: 2,
      requiredSessions: 3,
      thisWeekRuns: [
        { distance: 5.2, duration: '28분 30초', pace: '5:29', date: '1월 2일' },
        { distance: 5.0, duration: '27분 15초', pace: '5:27', date: '1월 4일' }
      ]
    },
    {
      id: 'quest_2', 
      title: '겨울 극복 3km 챌린지',
      distance: 3.0,
      frequency: 2,
      status: 'active',
      endDate: '2025-01-26',
      completedSessions: 1,
      requiredSessions: 2,
      thisWeekRuns: [
        { distance: 3.1, duration: '18분 45초', pace: '6:03', date: '1월 3일' }
      ]
    }
  ]);
}

// Additional Dashboard Tab Functions
async function loadRunHistoryTab() {
  console.log('📊 Loading run history tab...');
  
  const container = document.getElementById('run-history-list');
  
  // Mock run history data
  const runHistory = await getMockRunHistory();
  
  if (runHistory.length === 0) {
    container.innerHTML = `
      <div class="col-span-2 text-center py-12">
        <div class="text-6xl mb-4">🏃‍♂️</div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">러닝 기록이 없습니다</h3>
        <p class="text-gray-600 mb-6">첫 번째 러닝을 시작해보세요!</p>
        <button onclick="openRunSubmitModal()" class="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium">
          러닝 기록하기
        </button>
      </div>
    `;
    return;
  }
  
  container.innerHTML = runHistory.map(run => createRunHistoryCard(run)).join('');
}

function createRunHistoryCard(run) {
  const date = new Date(run.date);
  const dateStr = date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  
  return `
    <div class="bg-white rounded-lg shadow-md p-6">
      <div class="flex justify-between items-start mb-4">
        <div>
          <h3 class="text-lg font-semibold text-gray-900">${run.questTitle}</h3>
          <p class="text-sm text-gray-600">${dateStr} • ${run.location}</p>
        </div>
        <span class="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
          완료
        </span>
      </div>
      
      <div class="grid grid-cols-3 gap-4 mb-4">
        <div class="text-center">
          <div class="text-2xl font-bold text-blue-600">${run.distance}km</div>
          <div class="text-xs text-gray-500">거리</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-green-600">${run.duration}</div>
          <div class="text-xs text-gray-500">시간</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-purple-600">${run.pace}</div>
          <div class="text-xs text-gray-500">페이스</div>
        </div>
      </div>
      
      ${run.memo ? `
        <div class="bg-gray-50 rounded p-3">
          <p class="text-sm text-gray-700">"${run.memo}"</p>
        </div>
      ` : ''}
    </div>
  `;
}

function getMockRunHistory() {
  return Promise.resolve([
    {
      id: 'run_1',
      questTitle: '새해 다짐 5km 챌린지',
      date: '2025-01-04',
      distance: 5.0,
      duration: '27분 15초',
      pace: '5:27/km',
      location: '한강공원',
      memo: '오늘은 컨디션이 좋았어요!'
    },
    {
      id: 'run_2',
      questTitle: '새해 다짐 5km 챌린지',
      date: '2025-01-02',
      distance: 5.2,
      duration: '28분 30초',
      pace: '5:29/km',
      location: '올림픽공원',
      memo: '첫 러닝! 힘들었지만 뿌듯합니다.'
    },
    {
      id: 'run_3',
      questTitle: '겨울 극복 3km 챌린지',
      date: '2025-01-03',
      distance: 3.1,
      duration: '18분 45초',
      pace: '6:03/km',
      location: '동네 공원',
      memo: null
    }
  ]);
}

async function loadRewardsTab() {
  console.log('📊 Loading rewards tab...');
  
  const container = document.getElementById('rewards-list');
  
  // Mock rewards data
  const rewards = await getMockRewards();
  
  if (rewards.length === 0) {
    container.innerHTML = `
      <div class="col-span-2 text-center py-12">
        <div class="text-6xl mb-4">🏅</div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">아직 획득한 보상이 없습니다</h3>
        <p class="text-gray-600 mb-6">퀘스트를 완료하여 NFT 메달과 토큰 보상을 받아보세요!</p>
        <button onclick="closeDashboard()" class="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium">
          퀘스트 참여하기
        </button>
      </div>
    `;
    return;
  }
  
  container.innerHTML = rewards.map(reward => createRewardCard(reward)).join('');
}

function createRewardCard(reward) {
  const date = new Date(reward.earnedDate);
  const dateStr = date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  
  return `
    <div class="bg-white rounded-lg shadow-md overflow-hidden">
      <div class="bg-gradient-to-r ${reward.type === 'success' ? 'from-yellow-400 to-yellow-600' : 'from-gray-400 to-gray-600'} text-white p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <span class="text-2xl">${reward.type === 'success' ? '🥇' : '🥈'}</span>
            <div>
              <div class="font-semibold">${reward.medalType}</div>
              <div class="text-xs opacity-75">${dateStr} 획득</div>
            </div>
          </div>
          <button onclick="showNFTDetails('${reward.nftId}')" class="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-xs">
            상세보기
          </button>
        </div>
      </div>
      
      <div class="p-4">
        <h3 class="font-semibold text-gray-900 mb-2">${reward.questTitle}</h3>
        
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div class="text-xs text-gray-500">토큰 보상</div>
            <div class="font-bold text-green-600">${reward.tokenReward} ETH</div>
          </div>
          <div>
            <div class="text-xs text-gray-500">성과</div>
            <div class="font-bold ${reward.type === 'success' ? 'text-green-600' : 'text-orange-600'}">
              ${reward.type === 'success' ? '목표 달성' : '노력 인정'}
            </div>
          </div>
        </div>
        
        <div class="text-xs text-gray-600 bg-gray-50 rounded p-2">
          ${reward.description}
        </div>
      </div>
    </div>
  `;
}

function getMockRewards() {
  return Promise.resolve([
    {
      id: 'reward_1',
      nftId: 'nft_123',
      questTitle: '12월 겨울 러닝 챌린지',
      medalType: '골드 메달',
      type: 'success',
      tokenReward: '0.15',
      earnedDate: '2024-12-31',
      description: '21일 동안 주 3회 5km 목표를 100% 달성했습니다!'
    },
    {
      id: 'reward_2', 
      nftId: 'nft_124',
      questTitle: '11월 가을 마라톤 준비',
      medalType: '실버 메달',
      type: 'effort',
      tokenReward: '0.05',
      earnedDate: '2024-11-30',
      description: '목표의 70%를 달성했지만 꾸준한 노력을 인정받았습니다.'
    }
  ]);
}

async function loadCompletedQuestsTab() {
  console.log('📊 Loading completed quests tab...');
  
  const container = document.getElementById('completed-quests-list');
  
  // Mock completed quests data
  const completedQuests = await getMockCompletedQuests();
  
  if (completedQuests.length === 0) {
    container.innerHTML = `
      <div class="col-span-2 text-center py-12">
        <div class="text-6xl mb-4">🎯</div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">완료한 퀘스트가 없습니다</h3>
        <p class="text-gray-600 mb-6">첫 번째 퀘스트를 완료해보세요!</p>
        <button onclick="closeDashboard()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium">
          퀘스트 둘러보기
        </button>
      </div>
    `;
    return;
  }
  
  container.innerHTML = completedQuests.map(quest => createCompletedQuestCard(quest)).join('');
}

function createCompletedQuestCard(quest) {
  const startDate = new Date(quest.startDate);
  const endDate = new Date(quest.endDate);
  const dateRange = `${startDate.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}`;
  
  return `
    <div class="bg-white rounded-lg shadow-md overflow-hidden">
      <div class="bg-gradient-to-r ${quest.success ? 'from-green-500 to-green-600' : 'from-orange-500 to-orange-600'} text-white p-4">
        <div class="flex justify-between items-start">
          <div>
            <h3 class="text-lg font-bold mb-1">${quest.title}</h3>
            <p class="text-sm opacity-75">${dateRange}</p>
          </div>
          <span class="text-2xl">${quest.success ? '✅' : '💪'}</span>
        </div>
      </div>
      
      <div class="p-4">
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div class="text-xs text-gray-500">목표</div>
            <div class="font-semibold">${quest.targetDistance}km × 주${quest.frequency}회</div>
          </div>
          <div>
            <div class="text-xs text-gray-500">달성률</div>
            <div class="font-semibold ${quest.success ? 'text-green-600' : 'text-orange-600'}">
              ${quest.completionRate}%
            </div>
          </div>
        </div>
        
        <div class="bg-gray-50 rounded p-3 mb-4">
          <div class="text-sm text-gray-700">
            <strong>총 ${quest.totalRuns}회 러닝</strong> • ${quest.totalDistance}km • ${quest.totalDuration}
          </div>
        </div>
        
        <div class="flex justify-between items-center">
          <div class="text-sm text-gray-600">
            보상: <span class="font-semibold text-green-600">${quest.reward} ETH</span> + 
            <span class="font-semibold text-purple-600">${quest.medalType}</span>
          </div>
          <button onclick="showQuestSummary('${quest.id}')" class="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
            자세히 보기 →
          </button>
        </div>
      </div>
    </div>
  `;
}

function getMockCompletedQuests() {
  return Promise.resolve([
    {
      id: 'completed_1',
      title: '12월 겨울 러닝 챌린지',
      startDate: '2024-12-01',
      endDate: '2024-12-31',
      targetDistance: 5.0,
      frequency: 3,
      success: true,
      completionRate: 100,
      totalRuns: 13,
      totalDistance: 67.5,
      totalDuration: '6시간 15분',
      reward: '0.15',
      medalType: '골드 메달'
    },
    {
      id: 'completed_2',
      title: '11월 가을 마라톤 준비',
      startDate: '2024-11-01',
      endDate: '2024-11-30',
      targetDistance: 7.0,
      frequency: 4,
      success: false,
      completionRate: 70,
      totalRuns: 8,
      totalDistance: 52.0,
      totalDuration: '5시간 20분',
      reward: '0.05',
      medalType: '실버 메달'
    }
  ]);
}

// Placeholder functions for modal actions
function showNFTDetails(nftId) {
  Utils.showNotification(`NFT 상세정보 (ID: ${nftId}) - 곧 구현될 예정입니다!`, 'info');
}

function showQuestSummary(questId) {
  Utils.showNotification(`퀘스트 요약 (ID: ${questId}) - 곧 구현될 예정입니다!`, 'info');
}

// Initialize Web3 and Social Login on page load
function initializeWeb3App() {
  console.log('🚀 Initializing Web3 App...');
  
  // Load active quests
  loadActiveQuests();
  
  // Check for existing wallet connection
  if (window.ethereum) {
    window.ethereum.request({ method: 'eth_accounts' })
      .then(accounts => {
        if (accounts.length > 0) {
          // Auto-reconnect
          window.web3Manager.connectWallet().catch(console.error);
        }
      })
      .catch(console.error);
  }
  
  // Add event listeners for social login buttons
  document.addEventListener('click', function(e) {
    if (e.target.closest('[onclick*="socialManager.loginWith"]')) {
      e.preventDefault();
      const onclick = e.target.closest('[onclick*="socialManager.loginWith"]').getAttribute('onclick');
      const provider = onclick.match(/'([^']+)'/)[1];
      handleSocialLogin(provider);
    }
  });
  
  console.log('✅ Web3 App initialized');
}

// Auto-initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
  // Wait for all scripts to load before initializing
  setTimeout(() => {
    if (window.Web3Manager && window.SocialLoginManager) {
      initializeWeb3App();
    } else {
      console.warn('⚠️ Web3Manager or SocialLoginManager not found, retrying...');
      setTimeout(() => {
        if (window.Web3Manager && window.SocialLoginManager) {
          initializeWeb3App();
        }
      }, 1000);
    }
  }, 100);
});

// Quest Management Functions
function openQuestCreationModal() {
  console.log('🎯 Opening quest creation modal...');
  
  // Check if user is logged in
  if (!window.RunDAO.currentUser) {
    Utils.showNotification('퀘스트를 생성하려면 로그인해주세요', 'error');
    return;
  }
  
  // Load crews for selection
  loadCrewsForQuestCreation();
  
  // Show modal
  document.getElementById('quest-creation-modal').classList.remove('hidden');
  
  // Add event listeners
  setupQuestFormEventListeners();
}

function closeQuestModal() {
  document.getElementById('quest-creation-modal').classList.add('hidden');
  
  // Reset form
  document.getElementById('quest-creation-form').reset();
  
  // Hide crew selection if shown
  document.getElementById('crew-selection').classList.add('hidden');
}

function setupQuestFormEventListeners() {
  // Quest scope radio buttons
  const scopeRadios = document.querySelectorAll('input[name="quest_scope"]');
  scopeRadios.forEach(radio => {
    radio.addEventListener('change', function() {
      const crewSelection = document.getElementById('crew-selection');
      if (this.value === 'crew') {
        crewSelection.classList.remove('hidden');
      } else {
        crewSelection.classList.add('hidden');
      }
    });
  });

  // Form submission
  const form = document.getElementById('quest-creation-form');
  form.addEventListener('submit', handleQuestCreation);
}

async function loadCrewsForQuestCreation() {
  try {
    const crews = await API.getCrews();
    const crewSelect = document.getElementById('quest-crew');
    
    // Clear existing options except first
    crewSelect.innerHTML = '<option value="">크루를 선택하세요</option>';
    
    // Add crew options
    if (crews.crews) {
      crews.crews.forEach(crew => {
        const option = document.createElement('option');
        option.value = crew.id;
        option.textContent = `${crew.name} (${crew.member_count || 0}명)`;
        crewSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error loading crews:', error);
    Utils.showNotification('크루 목록을 불러오는데 실패했습니다', 'error');
  }
}

async function handleQuestCreation(event) {
  event.preventDefault();
  
  console.log('🚀 Creating new quest...');
  
  try {
    // Get form data
    const formData = new FormData(event.target);
    const questData = Object.fromEntries(formData);
    
    // Validate required fields
    if (!questData.title || !questData.description || !questData.distance_km || !questData.stake_amount) {
      throw new Error('모든 필수 항목을 입력해주세요');
    }
    
    // Calculate start and end times
    const startTime = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // Start tomorrow
    const endTime = startTime + (parseInt(questData.duration_days) * 24 * 60 * 60);
    
    // Prepare quest data for smart contract
    const contractQuestData = {
      title: questData.title,
      description: questData.description,
      crewId: questData.quest_scope === 'crew' ? (questData.crew_id || 0) : 0,
      startTime: startTime,
      endTime: endTime,
      distanceKm: Math.floor(parseFloat(questData.distance_km) * 100), // Convert to cm for contract
      timesPerWeek: parseInt(questData.times_per_week),
      maxSlots: parseInt(questData.max_slots),
      stakeAmount: questData.stake_amount
    };
    
    // Show loading state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '⏳ 생성 중...';
    submitBtn.disabled = true;
    
    try {
      // Create quest on smart contract (if Web3 is available)
      if (window.web3Manager && window.web3Manager.isConnected()) {
        const receipt = await createQuest(contractQuestData);
        console.log('✅ Quest created on blockchain:', receipt);
        
        // Also save to database for indexing
        await saveQuestToDatabase({
          ...questData,
          quest_id: receipt.events?.QuestCreated?.returnValues?.questId,
          tx_hash: receipt.transactionHash,
          creator_address: window.web3Manager.account
        });
        
        Utils.showNotification('퀘스트가 성공적으로 생성되었습니다! 🎉', 'success');
      } else {
        // Fallback: Save to database only (for testing)
        const result = await saveQuestToDatabase({
          ...questData,
          creator_address: window.RunDAO.currentUser?.wallet_address
        });
        
        Utils.showNotification('퀘스트가 생성되었습니다 (테스트 모드)', 'success');
      }
      
      // Close modal and refresh quest list
      closeQuestModal();
      loadActiveQuests();
      
    } catch (contractError) {
      console.error('Contract error:', contractError);
      throw new Error(`퀘스트 생성 실패: ${contractError.message}`);
    }
    
  } catch (error) {
    console.error('Quest creation error:', error);
    Utils.showNotification(error.message, 'error');
  } finally {
    // Restore button state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.textContent = '🚀 퀘스트 생성';
      submitBtn.disabled = false;
    }
  }
}

async function saveQuestToDatabase(questData) {
  // This would call the backend API to save quest data
  const payload = {
    title: questData.title,
    description: questData.description,
    distance_km: parseFloat(questData.distance_km),
    times_per_week: parseInt(questData.times_per_week),
    stake_amount: parseFloat(questData.stake_amount),
    stake_token: 'ETH',
    max_slots: parseInt(questData.max_slots),
    crew_id: questData.quest_scope === 'crew' ? questData.crew_id : null,
    creator_address: questData.creator_address,
    status: 'open'
  };
  
  // Call the actual API endpoint
  console.log('Quest data to be saved:', payload);
  return await Utils.apiRequest('/quests', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

function filterQuests(filter) {
  console.log(`🔍 Filtering quests by: ${filter}`);
  
  const questCards = document.querySelectorAll('.quest-card');
  questCards.forEach(card => {
    // This is a placeholder - would implement actual filtering logic
    card.style.display = 'block';
  });
  
  Utils.showNotification(`${filter} 퀘스트 필터 적용됨`, 'info');
}

// Quest join handler for UI buttons
async function handleQuestJoin(questId, stakeAmount) {
  console.log(`🎯 Joining quest ${questId} with stake ${stakeAmount} ETH`);
  
  // Check if user is logged in
  if (!window.RunDAO.currentUser) {
    Utils.showNotification('퀘스트에 참여하려면 로그인해주세요', 'error');
    return;
  }
  
  // Check wallet connection
  if (!window.web3Manager || !window.web3Manager.isConnected()) {
    Utils.showNotification('지갑을 연결해주세요', 'error');
    return;
  }
  
  try {
    // Show confirmation dialog
    const confirmed = confirm(`
퀘스트 참여 확인

퀘스트: ${questId}
스테이킹: ${stakeAmount} ETH

참여하시겠습니까?
`);
    
    if (!confirmed) {
      return;
    }
    
    // Join quest
    const result = await joinQuest(questId, stakeAmount);
    console.log('✅ Quest joined successfully:', result);
    
  } catch (error) {
    console.error('❌ Failed to join quest:', error);
  }
}

// Load quest data from blockchain (when contracts are deployed)
async function loadQuestsFromBlockchain() {
  if (!window.web3Manager || !window.web3Manager.isConnected()) {
    console.log('Web3 not connected, skipping blockchain quest loading');
    return [];
  }
  
  try {
    const quests = await window.web3Manager.getAllQuests();
    console.log(`📊 Loaded ${quests.length} quests from blockchain`);
    return quests;
  } catch (error) {
    console.warn('Failed to load quests from blockchain:', error);
    return [];
  }
}

// Running Data Submission Functions
function openRunSubmitModal() {
  console.log('🏃‍♂️ Opening run submission modal...');
  
  // Check if user is logged in
  if (!window.RunDAO.currentUser) {
    Utils.showNotification('러닝 데이터를 제출하려면 로그인해주세요', 'error');
    return;
  }
  
  // Load user's active quests
  loadUserActiveQuests();
  
  // Show modal
  document.getElementById('run-submit-modal').classList.remove('hidden');
  
  // Set up form handler
  const form = document.getElementById('run-submit-form');
  form.addEventListener('submit', handleRunDataSubmission);
}

function closeRunSubmitModal() {
  document.getElementById('run-submit-modal').classList.add('hidden');
  
  // Reset form
  document.getElementById('run-submit-form').reset();
  
  // Hide location info
  document.getElementById('location-info').classList.add('hidden');
}

function loadUserActiveQuests() {
  // Mock data for now - will integrate with API/blockchain later
  const select = document.getElementById('run-quest-select');
  
  // Clear existing options except first
  select.innerHTML = '<option value="">퀘스트를 선택하세요</option>';
  
  // Add mock active quests
  const activeQuests = [
    { id: 'quest_1', title: '새해 다짐 5km 챌린지' },
    { id: 'quest_2', title: '겨울 극복 3km 챌린지' }
  ];
  
  activeQuests.forEach(quest => {
    const option = document.createElement('option');
    option.value = quest.id;
    option.textContent = quest.title;
    select.appendChild(option);
  });
}

function getCurrentLocation() {
  const btn = document.getElementById('get-location-btn');
  const locationInfo = document.getElementById('location-info');
  
  // Update button state
  btn.textContent = '위치 확인 중...';
  btn.disabled = true;
  
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function(position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        // Update UI
        document.getElementById('latitude').textContent = lat.toFixed(6);
        document.getElementById('longitude').textContent = lng.toFixed(6);
        locationInfo.classList.remove('hidden');
        
        // Store coordinates for submission
        window.currentLocation = { lat, lng };
        
        // Reset button
        btn.textContent = '✓ 위치 확인 완료';
        btn.className = 'w-full bg-green-600 text-white py-2 rounded font-medium cursor-default';
        
        Utils.showNotification('GPS 위치가 확인되었습니다', 'success');
      },
      function(error) {
        console.error('Geolocation error:', error);
        
        // Reset button
        btn.textContent = '위치 확인 실패 - 다시 시도';
        btn.disabled = false;
        
        let errorMsg = '위치 정보를 가져올 수 없습니다';
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = '위치 접근이 거부되었습니다. 브라우저 설정을 확인해주세요';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = '위치 정보를 사용할 수 없습니다';
            break;
          case error.TIMEOUT:
            errorMsg = '위치 요청 시간이 초과되었습니다';
            break;
        }
        
        Utils.showNotification(errorMsg, 'error');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 600000
      }
    );
  } else {
    btn.textContent = '위치 서비스 미지원';
    btn.disabled = true;
    Utils.showNotification('이 브라우저는 위치 서비스를 지원하지 않습니다', 'error');
  }
}

async function handleRunDataSubmission(event) {
  event.preventDefault();
  
  console.log('📊 Submitting running data...');
  
  try {
    // Get form data
    const formData = new FormData(event.target);
    const questId = document.getElementById('run-quest-select').value;
    const distance = parseFloat(document.getElementById('run-distance').value);
    const hours = parseInt(document.getElementById('run-hours').value) || 0;
    const minutes = parseInt(document.getElementById('run-minutes').value) || 0;
    const seconds = parseInt(document.getElementById('run-seconds').value) || 0;
    const route = document.getElementById('run-route').value;
    
    // Validate required fields
    if (!questId) {
      throw new Error('퀘스트를 선택해주세요');
    }
    
    if (!distance || distance <= 0) {
      throw new Error('유효한 거리를 입력해주세요');
    }
    
    if (minutes === 0 && hours === 0) {
      throw new Error('소요 시간을 입력해주세요');
    }
    
    // Calculate total duration in seconds
    const totalDuration = (hours * 3600) + (minutes * 60) + seconds;
    
    // Validate distance vs time (reasonable pace check)
    const paceMinutesPerKm = (totalDuration / 60) / distance;
    if (paceMinutesPerKm < 3 || paceMinutesPerKm > 15) {
      const confirmed = confirm(`
페이스 확인이 필요합니다.

거리: ${distance}km
시간: ${hours}시간 ${minutes}분 ${seconds}초
페이스: ${paceMinutesPerKm.toFixed(1)}분/km

이 기록이 정확한가요?
(일반적인 페이스: 4-10분/km)
`);
      
      if (!confirmed) {
        return;
      }
    }
    
    // Prepare submission data
    const runData = {
      questId,
      distance,
      duration: totalDuration,
      route: route || '',
      location: window.currentLocation || null,
      timestamp: Date.now(),
      userAddress: window.RunDAO.currentUser?.wallet_address
    };
    
    // Show loading state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '⏳ 제출 중...';
    submitBtn.disabled = true;
    
    try {
      // Submit to smart contract if available
      if (window.web3Manager && window.web3Manager.isConnected()) {
        await submitRunDataToBlockchain(runData);
      } else {
        // Fallback: save to database only
        await submitRunDataToDatabase(runData);
      }
      
      Utils.showNotification('러닝 데이터가 성공적으로 제출되었습니다! 🎉', 'success');
      
      // Close modal and refresh data
      closeRunSubmitModal();
      
      // Update user dashboard if visible
      updateUserProgress();
      
    } catch (submissionError) {
      console.error('Submission error:', submissionError);
      throw new Error(`데이터 제출 실패: ${submissionError.message}`);
    }
    
  } catch (error) {
    console.error('Run data submission error:', error);
    Utils.showNotification(error.message, 'error');
  } finally {
    // Restore button state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.textContent = '🚀 데이터 제출';
      submitBtn.disabled = false;
    }
  }
}

async function submitRunDataToBlockchain(runData) {
  try {
    const contract = window.web3Manager.getContract('QuestFactory');
    
    // Create GPS data hash (simplified)
    const gpsDataString = JSON.stringify({
      lat: runData.location?.lat || 0,
      lng: runData.location?.lng || 0,
      timestamp: runData.timestamp
    });
    
    const gpsDataHash = ethers.keccak256(ethers.toUtf8Bytes(gpsDataString));
    
    // Convert distance to contract format (cm)
    const distanceInCm = window.ContractUtils.kmToCm(runData.distance);
    
    // Submit run data to smart contract
    const tx = await contract.submitRunData(
      runData.questId,
      distanceInCm,
      runData.duration,
      gpsDataHash
    );
    
    Utils.showNotification('블록체인에 데이터를 기록하고 있습니다...', 'info');
    
    const receipt = await tx.wait();
    
    console.log('✅ Run data submitted to blockchain:', receipt);
    
    return receipt;
    
  } catch (error) {
    console.error('Blockchain submission error:', error);
    throw error;
  }
}

async function submitRunDataToDatabase(runData) {
  // Mock database submission for development
  console.log('💾 Submitting to database (mock):', runData);
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return { success: true, id: 'run_' + Date.now() };
}

function updateUserProgress() {
  // This will be implemented when we build the user dashboard
  console.log('📊 Updating user progress...');
}

async function loadRunHistoryTab() {
  console.log('📈 Loading run history tab...');
  
  const historyList = document.getElementById('run-history-list');
  
  // Mock run history data
  const runHistory = await getMockRunHistory();
  
  if (runHistory.length === 0) {
    historyList.innerHTML = `
      <div class="text-center py-12">
        <div class="text-6xl mb-4">📊</div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">아직 러닝 기록이 없습니다</h3>
        <p class="text-gray-600 mb-6">첫 번째 러닝을 시작해보세요!</p>
        <button onclick="openRunSubmitModal()" class="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium">
          러닝 데이터 제출
        </button>
      </div>
    `;
    return;
  }
  
  historyList.innerHTML = runHistory.map(run => createRunHistoryItem(run)).join('');
}

function createRunHistoryItem(run) {
  return `
    <div class="px-6 py-4 hover:bg-gray-50">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <div class="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
            ${run.distance}
          </div>
          <div>
            <div class="font-semibold text-gray-900">${run.questTitle}</div>
            <div class="text-sm text-gray-600">${run.date} • ${run.route || '경로 정보 없음'}</div>
          </div>
        </div>
        
        <div class="text-right">
          <div class="font-semibold text-lg">${run.distance}km</div>
          <div class="text-sm text-gray-600">${run.duration} (${run.pace}/km)</div>
        </div>
        
        <div class="text-right">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            run.status === 'verified' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }">
            ${run.status === 'verified' ? '✓ 인증됨' : '⏳ 검증 중'}
          </span>
          <div class="text-xs text-gray-500 mt-1">${run.points} 포인트</div>
        </div>
      </div>
    </div>
  `;
}

function getMockRunHistory() {
  return Promise.resolve([
    {
      id: 'run_1',
      questTitle: '새해 다짐 5km 챌린지',
      distance: '5.2',
      duration: '28분 30초',
      pace: '5:29',
      date: '2025-01-04',
      route: '부산 해운대 해변',
      status: 'verified',
      points: 520
    },
    {
      id: 'run_2', 
      questTitle: '새해 다짐 5km 챌린지',
      distance: '5.0',
      duration: '27분 15초',
      pace: '5:27',
      date: '2025-01-02',
      route: '부산 해운대 해변',
      status: 'verified',
      points: 500
    },
    {
      id: 'run_3',
      questTitle: '겨울 극복 3km 챌린지',
      distance: '3.1',
      duration: '18분 45초',
      pace: '6:03',
      date: '2025-01-03',
      route: null,
      status: 'verified',
      points: 310
    }
  ]);
}

async function loadRewardsTab() {
  console.log('🏅 Loading rewards tab...');
  
  // Load rewards summary
  const rewards = await getMockRewardsData();
  
  document.getElementById('total-rewards').textContent = `${rewards.totalEth} ETH`;
  document.getElementById('total-nfts').textContent = rewards.totalNfts;
  document.getElementById('total-points').textContent = rewards.totalPoints.toLocaleString();
  
  // Load NFT collection
  const nftContainer = document.getElementById('nft-collection');
  
  if (rewards.nfts.length === 0) {
    nftContainer.innerHTML = `
      <div class="col-span-6 text-center py-12">
        <div class="text-6xl mb-4">🏅</div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">아직 NFT 메달이 없습니다</h3>
        <p class="text-gray-600">퀘스트를 완료하면 특별한 NFT 메달을 받을 수 있어요!</p>
      </div>
    `;
    return;
  }
  
  nftContainer.innerHTML = rewards.nfts.map(nft => createNFTCard(nft)).join('');
}

function createNFTCard(nft) {
  const medalEmoji = nft.type === 'gold' ? '🥇' : nft.type === 'silver' ? '🥈' : '🏅';
  
  return `
    <div class="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl p-4 text-white text-center hover:shadow-lg transition-shadow cursor-pointer" 
         onclick="showNFTDetails('${nft.id}')">
      <div class="text-4xl mb-2">${medalEmoji}</div>
      <div class="font-bold text-sm mb-1">${nft.questTitle}</div>
      <div class="text-xs opacity-90">${nft.date}</div>
      <div class="text-xs mt-2 bg-white/20 rounded-full px-2 py-1">
        ${nft.type === 'gold' ? '성공' : '참여'}
      </div>
    </div>
  `;
}

function getMockRewardsData() {
  return Promise.resolve({
    totalEth: 2.4,
    totalNfts: 7,
    totalPoints: 1250,
    nfts: [
      { id: 'nft_1', questTitle: '새해 다짐 5km', type: 'gold', date: '2025-01-01' },
      { id: 'nft_2', questTitle: '겨울 극복 3km', type: 'silver', date: '2025-01-02' },
      { id: 'nft_3', questTitle: '마라톤 준비 10km', type: 'participation', date: '2025-01-03' },
      { id: 'nft_4', questTitle: '주말 러닝 2km', type: 'gold', date: '2025-01-04' }
    ]
  });
}

async function loadCompletedQuestsTab() {
  console.log('✅ Loading completed quests tab...');
  
  const container = document.getElementById('completed-quests-list');
  const completedQuests = await getMockCompletedQuests();
  
  if (completedQuests.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12">
        <div class="text-6xl mb-4">🎯</div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">완료된 퀘스트가 없습니다</h3>
        <p class="text-gray-600">첫 번째 퀘스트를 완료해보세요!</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = completedQuests.map(quest => createCompletedQuestCard(quest)).join('');
}

function createCompletedQuestCard(quest) {
  const isSuccess = quest.result === 'success';
  
  return `
    <div class="bg-white rounded-xl shadow-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-xl font-bold text-gray-900">${quest.title}</h3>
          <p class="text-gray-600">${quest.completedDate}</p>
        </div>
        
        <div class="text-right">
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            isSuccess ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
          }">
            ${isSuccess ? '🏆 성공' : '🏅 참여'}
          </span>
          <div class="text-sm text-gray-600 mt-1">${quest.reward} ETH 획득</div>
        </div>
      </div>
      
      <div class="grid grid-cols-3 gap-4 mb-4">
        <div class="text-center p-3 bg-gray-50 rounded">
          <div class="text-lg font-bold text-blue-600">${quest.totalRuns}</div>
          <div class="text-sm text-gray-600">총 러닝</div>
        </div>
        <div class="text-center p-3 bg-gray-50 rounded">
          <div class="text-lg font-bold text-green-600">${quest.totalDistance}km</div>
          <div class="text-sm text-gray-600">총 거리</div>
        </div>
        <div class="text-center p-3 bg-gray-50 rounded">
          <div class="text-lg font-bold text-purple-600">${quest.achievementRate}%</div>
          <div class="text-sm text-gray-600">달성률</div>
        </div>
      </div>
      
      <button 
        onclick="showQuestDetails('${quest.id}')"
        class="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded font-medium text-sm"
      >
        상세 결과 보기
      </button>
    </div>
  `;
}

function getMockCompletedQuests() {
  return Promise.resolve([
    {
      id: 'completed_1',
      title: '12월 연말 마무리 3km',
      completedDate: '2024-12-31 완료',
      result: 'success',
      reward: 0.15,
      totalRuns: 6,
      totalDistance: 18.5,
      achievementRate: 100
    },
    {
      id: 'completed_2', 
      title: '가을 단풍 러닝 5km',
      completedDate: '2024-11-30 완료',
      result: 'participation',
      reward: 0.03,
      totalRuns: 4,
      totalDistance: 19.2,
      achievementRate: 67
    }
  ]);
}

// NFT Details Modal (placeholder)
function showNFTDetails(nftId) {
  Utils.showNotification(`NFT ${nftId} 상세 정보 (구현 예정)`, 'info');
}

// Export to global scope
window.Utils = Utils;
window.API = API;
window.UI = UI;
window.handleWalletConnection = handleWalletConnection;
window.handleSocialLogin = handleSocialLogin;
window.handleUserRegistration = handleUserRegistration;
window.loadActiveQuests = loadActiveQuests;
window.showQuestDetails = showQuestDetails;
window.createQuest = createQuest;
window.joinQuest = joinQuest;
window.handleQuestJoin = handleQuestJoin;
window.loadQuestsFromBlockchain = loadQuestsFromBlockchain;
window.initializeWeb3App = initializeWeb3App;
window.openQuestCreationModal = openQuestCreationModal;
window.closeQuestModal = closeQuestModal;
window.handleQuestCreation = handleQuestCreation;
window.filterQuests = filterQuests;
window.closeQuestDetailModal = closeQuestDetailModal;
window.confirmQuestJoin = confirmQuestJoin;
window.goToMyQuests = goToMyQuests;
window.openRunSubmitModal = openRunSubmitModal;
window.closeRunSubmitModal = closeRunSubmitModal;
window.getCurrentLocation = getCurrentLocation;
window.handleRunDataSubmission = handleRunDataSubmission;
window.openMyQuestsDashboard = openMyQuestsDashboard;
window.closeDashboard = closeDashboard;
window.switchDashboardTab = switchDashboardTab;
window.showNFTDetails = showNFTDetails;
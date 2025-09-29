import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for frontend-backend communication
app.use('/api/*', cors())

// Serve static files from public directory  
app.use('/static/*', serveStatic({ root: './public' }))

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: '작심삼일 RUN DAO'
  })
})

// Get all users
app.get('/api/users', async (c) => {
  const { DB } = c.env
  
  try {
    const result = await DB.prepare(`
      SELECT 
        u.id, u.wallet_address, u.email, u.nickname, 
        u.created_at, u.updated_at
      FROM users u
      ORDER BY u.created_at DESC
    `).all()
    
    return c.json({ 
      users: result.results,
      count: result.results?.length || 0
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return c.json({ error: 'Failed to fetch users' }, 500)
  }
})

// Create new user
app.post('/api/users', async (c) => {
  const { DB } = c.env
  
  try {
    const { wallet_address, email, nickname, social_provider, social_id } = await c.req.json()
    
    const result = await DB.prepare(`
      INSERT INTO users (wallet_address, email, nickname, social_provider, social_id)
      VALUES (?, ?, ?, ?, ?)
    `).bind(wallet_address, email, nickname, social_provider, social_id).run()
    
    return c.json({ 
      message: 'User created successfully',
      user_id: result.meta.last_row_id
    })
  } catch (error) {
    console.error('Error creating user:', error)
    return c.json({ error: 'Failed to create user' }, 500)
  }
})

// Get user by wallet address
app.get('/api/users/wallet/:address', async (c) => {
  const { DB } = c.env
  const address = c.req.param('address')
  
  try {
    const user = await DB.prepare(`
      SELECT u.*
      FROM users u
      WHERE u.wallet_address = ?
    `).bind(address).first()
    
    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }
    
    return c.json({ user })
  } catch (error) {
    console.error('Error fetching user:', error)
    return c.json({ error: 'Failed to fetch user' }, 500)
  }
})

// Get all crews
app.get('/api/crews', async (c) => {
  const { DB } = c.env
  
  try {
    const result = await DB.prepare(`
      SELECT 
        c.id, c.name, c.description, c.region, 
        c.is_private, c.max_members, c.created_at,
        u.nickname as leader_name,
        COUNT(cm.user_id) as member_count
      FROM crews c
      LEFT JOIN users u ON c.leader_id = u.id
      LEFT JOIN crew_memberships cm ON c.id = cm.crew_id AND cm.status = 'active'
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `).all()
    
    return c.json({ 
      crews: result.results,
      count: result.results?.length || 0
    })
  } catch (error) {
    console.error('Error fetching crews:', error)
    return c.json({ error: 'Failed to fetch crews' }, 500)
  }
})

// Get quests for a crew
app.get('/api/crews/:crewId/quests', async (c) => {
  const { DB } = c.env
  const crewId = c.req.param('crewId')
  
  try {
    const result = await DB.prepare(`
      SELECT 
        q.id, q.title, q.description, q.start_at, q.end_at,
        q.distance_km, q.times_per_week, q.stake_amount, q.stake_token,
        q.max_slots, q.status,
        COUNT(p.user_id) as participant_count
      FROM quests q
      LEFT JOIN participations p ON q.id = p.quest_id AND p.status = 'active'
      WHERE q.crew_id = ?
      GROUP BY q.id
      ORDER BY q.start_at DESC
    `).bind(crewId).all()
    
    return c.json({ 
      quests: result.results,
      count: result.results?.length || 0
    })
  } catch (error) {
    console.error('Error fetching quests:', error)
    return c.json({ error: 'Failed to fetch quests' }, 500)
  }
})

// Get quest details with participants
app.get('/api/quests/:questId', async (c) => {
  const { DB } = c.env
  const questId = c.req.param('questId')
  
  try {
    // Get quest details
    const quest = await DB.prepare(`
      SELECT 
        q.*, c.name as crew_name,
        u.nickname as leader_name
      FROM quests q
      JOIN crews c ON q.crew_id = c.id  
      JOIN users u ON c.leader_id = u.id
      WHERE q.id = ?
    `).bind(questId).first()
    
    if (!quest) {
      return c.json({ error: 'Quest not found' }, 404)
    }
    
    // Get participants
    const participants = await DB.prepare(`
      SELECT 
        p.id, p.status, p.completed_sessions, p.total_distance_km,
        p.joined_at, u.nickname, u.id as user_id
      FROM participations p
      JOIN users u ON p.user_id = u.id
      WHERE p.quest_id = ?
      ORDER BY p.joined_at ASC
    `).bind(questId).all()
    
    return c.json({ 
      quest,
      participants: participants.results || []
    })
  } catch (error) {
    console.error('Error fetching quest details:', error)
    return c.json({ error: 'Failed to fetch quest details' }, 500)
  }
})

// Create new quest
app.post('/api/quests', async (c) => {
  const { DB } = c.env
  
  try {
    const { 
      title, description, distance_km, times_per_week, 
      stake_amount, stake_token, max_slots, crew_id, 
      creator_address, status 
    } = await c.req.json()
    
    // Validate required fields
    if (!title || !description || !distance_km || !times_per_week || !max_slots) {
      return c.json({ error: 'Missing required fields' }, 400)
    }
    
    // Generate quest ID
    const questId = 'quest_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9)
    
    // Calculate start and end dates (start tomorrow, duration based on weeks)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() + 1)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 14) // Default 2 weeks
    
    // Insert quest into database
    const result = await DB.prepare(`
      INSERT INTO quests (
        id, title, description, start_at, end_at, 
        distance_km, times_per_week, stake_amount, stake_token,
        max_slots, crew_id, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      questId, title, description, 
      startDate.toISOString().slice(0, 19).replace('T', ' '),
      endDate.toISOString().slice(0, 19).replace('T', ' '),
      distance_km, times_per_week, stake_amount || 0, stake_token || 'ETH',
      max_slots, crew_id || null, status || 'open'
    ).run()
    
    return c.json({ 
      message: 'Quest created successfully',
      quest_id: questId,
      quest: {
        id: questId,
        title, description, distance_km, times_per_week,
        stake_amount, max_slots, crew_id, status: status || 'open',
        start_at: startDate.toISOString().slice(0, 19).replace('T', ' '),
        end_at: endDate.toISOString().slice(0, 19).replace('T', ' ')
      }
    })
  } catch (error) {
    console.error('Error creating quest:', error)
    return c.json({ error: 'Failed to create quest' }, 500)
  }
})

// Join quest (participate)  
app.post('/api/quests/:questId/join', async (c) => {
  const { DB } = c.env
  const questId = c.req.param('questId')
  
  try {
    const { user_id, wallet_address } = await c.req.json()
    
    if (!user_id && !wallet_address) {
      return c.json({ error: 'User ID or wallet address required' }, 400)
    }
    
    // Check if quest exists
    const quest = await DB.prepare(`
      SELECT * FROM quests WHERE id = ?
    `).bind(questId).first()
    
    if (!quest) {
      return c.json({ error: 'Quest not found' }, 404)
    }
    
    // Check if user already joined
    const existingParticipation = await DB.prepare(`
      SELECT * FROM participations WHERE quest_id = ? AND user_id = ?
    `).bind(questId, user_id).first()
    
    if (existingParticipation) {
      return c.json({ error: 'User already joined this quest' }, 400)
    }
    
    // Generate participation ID
    const participationId = 'part_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9)
    
    // Add participant
    await DB.prepare(`
      INSERT INTO participations (
        id, quest_id, user_id, status, joined_at,
        completed_sessions, total_distance_km
      ) VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP, 0, 0)
    `).bind(participationId, questId, user_id).run()
    
    return c.json({ 
      message: 'Successfully joined quest',
      participation_id: participationId
    })
  } catch (error) {
    console.error('Error joining quest:', error)
    return c.json({ error: 'Failed to join quest' }, 500)
  }
})

// Main homepage
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>작심삼일 RUN DAO - 실패해도 가치있는 러닝 DAO</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/contracts.js"></script>
        <script src="/static/web3.js"></script>
        <style>
          .gradient-bg {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
        </style>
    </head>
    <body class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
    <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <!-- Header -->
      <nav class="bg-white shadow-lg">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between h-16">
            <div class="flex items-center">
              <h1 class="text-2xl font-bold text-indigo-600">🏃‍♂️ 작심삼일 RUN DAO</h1>
            </div>
            
            <!-- Wallet Connection -->
            <div class="flex items-center space-x-4">
              <div id="wallet-info" class="hidden bg-gray-100 rounded-lg px-3 py-2">
                <div class="text-sm">
                  <div class="font-medium" id="account-display">연결됨</div>
                  <div class="text-gray-500" id="balance-display">0 ETH</div>
                </div>
              </div>
              <button 
                id="connect-wallet-btn" 
                class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                onclick="handleWalletConnection()"
              >
                지갑 연결
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <!-- Web2.5 Login Section -->
        <div id="social-login-section" class="bg-white rounded-xl shadow-lg p-8 mb-8">
          <div class="text-center mb-8">
            <h2 class="text-3xl font-bold text-gray-900 mb-4">간편하게 시작하세요</h2>
            <p class="text-lg text-gray-600">소셜 로그인으로 바로 시작하고, 지갑은 자동으로 생성됩니다</p>
          </div>
          
          <div class="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              class="flex items-center justify-center space-x-3 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              onclick="socialManager.loginWith('google')"
            >
              <span class="text-xl">🔍</span>
              <span>Google로 시작</span>
            </button>
            
            <button 
              class="flex items-center justify-center space-x-3 bg-black hover:bg-gray-800 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              onclick="socialManager.loginWith('apple')"
            >
              <span class="text-xl">🍎</span>
              <span>Apple로 시작</span>
            </button>
            
            <button 
              class="flex items-center justify-center space-x-3 bg-yellow-400 hover:bg-yellow-500 text-black px-6 py-3 rounded-lg font-medium transition-colors"
              onclick="socialManager.loginWith('kakao')"
            >
              <span class="text-xl">💬</span>
              <span>카카오로 시작</span>
            </button>
          </div>
          
          <div class="mt-6 text-center">
            <p class="text-sm text-gray-500">소셜 로그인 시 이용약관 및 개인정보처리방침에 동의한 것으로 간주됩니다</p>
          </div>
        </div>

        <!-- User Dashboard (Hidden by default, shown after login) -->
        <div id="user-dashboard" class="hidden bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl shadow-lg p-8 mb-8">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center space-x-4">
              <div id="user-avatar" class="w-16 h-16 bg-indigo-500 rounded-full flex items-center justify-center text-white text-xl font-bold">
                🏃‍♂️
              </div>
              <div>
                <h2 class="text-2xl font-bold text-gray-900" id="user-nickname">환영합니다!</h2>
                <p class="text-gray-600" id="user-wallet">지갑 주소: 연결되지 않음</p>
              </div>
            </div>
            
            <div class="text-right">
              <div class="text-sm text-gray-500">현재 보유</div>
              <div class="text-2xl font-bold text-indigo-600" id="user-balance">0.0 ETH</div>
            </div>
          </div>
          
          <!-- User Stats -->
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-white rounded-lg p-4 text-center">
              <div class="text-2xl font-bold text-blue-600" id="stat-total-quests">0</div>
              <div class="text-sm text-gray-600">완료한 퀘스트</div>
            </div>
            
            <div class="bg-white rounded-lg p-4 text-center">
              <div class="text-2xl font-bold text-green-600" id="stat-total-distance">0.0km</div>
              <div class="text-sm text-gray-600">총 러닝 거리</div>
            </div>
            
            <div class="bg-white rounded-lg p-4 text-center">
              <div class="text-2xl font-bold text-purple-600" id="stat-total-medals">0</div>
              <div class="text-sm text-gray-600">획득한 메달</div>
            </div>
            
            <div class="bg-white rounded-lg p-4 text-center">
              <div class="text-2xl font-bold text-orange-600" id="stat-success-rate">0%</div>
              <div class="text-sm text-gray-600">성공률</div>
            </div>
          </div>
          
          <!-- Quick Actions for Logged In Users -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button onclick="openMyQuestsDashboard()" class="bg-white hover:bg-gray-50 rounded-lg p-4 text-left transition-colors border border-gray-200">
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span class="text-blue-600">📊</span>
                </div>
                <div>
                  <div class="font-medium">내 퀘스트 현황</div>
                  <div class="text-sm text-gray-500">참여 중인 챌린지 확인</div>
                </div>
              </div>
            </button>
            
            <button onclick="openRunSubmitModal()" class="bg-white hover:bg-gray-50 rounded-lg p-4 text-left transition-colors border border-gray-200">
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <span class="text-orange-600">🏃‍♂️</span>
                </div>
                <div>
                  <div class="font-medium">러닝 데이터 제출</div>
                  <div class="text-sm text-gray-500">오늘의 운동 기록하기</div>
                </div>
              </div>
            </button>
            
            <button onclick="openQuestCreationModal()" class="bg-white hover:bg-gray-50 rounded-lg p-4 text-left transition-colors border border-gray-200">
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <span class="text-green-600">🎯</span>
                </div>
                <div>
                  <div class="font-medium">새 퀘스트 만들기</div>
                  <div class="text-sm text-gray-500">러닝 챌린지 생성</div>
                </div>
              </div>
            </button>
            
            <button class="bg-white hover:bg-gray-50 rounded-lg p-4 text-left transition-colors border border-gray-200">
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <span class="text-purple-600">🏅</span>
                </div>
                <div>
                  <div class="font-medium">내 메달 컬렉션</div>
                  <div class="text-sm text-gray-500">NFT 메달 확인</div>
                </div>
              </div>
            </button>
          </div>
        </div>

        <!-- Quest Creation Modal (Hidden by default) -->
        <div id="quest-creation-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div class="p-8">
              <!-- Modal Header -->
              <div class="flex justify-between items-center mb-6">
                <h2 class="text-3xl font-bold text-gray-900">🎯 새 퀘스트 생성</h2>
                <button onclick="closeQuestModal()" class="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
              </div>
              
              <!-- Quest Creation Form -->
              <form id="quest-creation-form" class="space-y-6">
                
                <!-- Basic Info Section -->
                <div class="bg-blue-50 rounded-lg p-6">
                  <h3 class="text-lg font-semibold text-blue-900 mb-4">📝 기본 정보</h3>
                  
                  <div class="grid grid-cols-1 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">퀘스트 제목</label>
                      <input 
                        type="text" 
                        id="quest-title" 
                        name="title"
                        placeholder="예: 새해 다짐 5km 챌린지"
                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                    </div>
                    
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">상세 설명</label>
                      <textarea 
                        id="quest-description" 
                        name="description"
                        rows="3"
                        placeholder="퀘스트의 목표와 규칙을 설명해주세요..."
                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      ></textarea>
                    </div>
                  </div>
                </div>

                <!-- Running Requirements Section -->
                <div class="bg-green-50 rounded-lg p-6">
                  <h3 class="text-lg font-semibold text-green-900 mb-4">🏃‍♂️ 러닝 조건</h3>
                  
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">목표 거리 (km)</label>
                      <input 
                        type="number" 
                        id="quest-distance" 
                        name="distance_km"
                        min="1" 
                        max="50" 
                        step="0.1"
                        placeholder="5.0"
                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        required
                      >
                    </div>
                    
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">주간 횟수</label>
                      <select 
                        id="quest-frequency" 
                        name="times_per_week"
                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        required
                      >
                        <option value="1">주 1회</option>
                        <option value="2">주 2회</option>
                        <option value="3" selected>주 3회</option>
                        <option value="4">주 4회</option>
                        <option value="5">주 5회</option>
                        <option value="6">주 6회</option>
                        <option value="7">매일</option>
                      </select>
                    </div>
                    
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">퀘스트 기간 (일)</label>
                      <select 
                        id="quest-duration" 
                        name="duration_days"
                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        required
                      >
                        <option value="7">1주 (7일)</option>
                        <option value="14" selected>2주 (14일)</option>
                        <option value="21">3주 (21일)</option>
                        <option value="30">1개월 (30일)</option>
                      </select>
                    </div>
                    
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">최대 참여자 수</label>
                      <input 
                        type="number" 
                        id="quest-max-slots" 
                        name="max_slots"
                        min="2" 
                        max="100" 
                        value="10"
                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        required
                      >
                    </div>
                  </div>
                </div>

                <!-- Staking Section -->
                <div class="bg-purple-50 rounded-lg p-6">
                  <h3 class="text-lg font-semibold text-purple-900 mb-4">💰 스테이킹 설정</h3>
                  
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">스테이킹 금액</label>
                      <div class="relative">
                        <input 
                          type="number" 
                          id="quest-stake-amount" 
                          name="stake_amount"
                          min="0.001" 
                          max="10" 
                          step="0.001"
                          value="0.01"
                          placeholder="0.01"
                          class="w-full px-4 py-3 pr-16 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          required
                        >
                        <span class="absolute right-4 top-3 text-gray-500 font-medium">ETH</span>
                      </div>
                      <p class="text-xs text-gray-500 mt-1">성공 시 돌려받고, 실패 시 분배됩니다</p>
                    </div>
                    
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">보상 분배율</label>
                      <select 
                        id="quest-reward-rate" 
                        name="reward_rate"
                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="70" selected>성공자 70% / 실패자 30%</option>
                        <option value="80">성공자 80% / 실패자 20%</option>
                        <option value="60">성공자 60% / 실패자 40%</option>
                      </select>
                      <p class="text-xs text-gray-500 mt-1">실패해도 NFT와 보상을 받습니다</p>
                    </div>
                  </div>
                </div>

                <!-- Crew Selection Section -->
                <div class="bg-orange-50 rounded-lg p-6">
                  <h3 class="text-lg font-semibold text-orange-900 mb-4">👥 크루 설정</h3>
                  
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">퀘스트 공개 범위</label>
                    <div class="space-y-3">
                      <label class="flex items-center">
                        <input type="radio" name="quest_scope" value="public" class="mr-3" checked>
                        <span class="text-gray-700">🌍 전체 공개 (모든 사용자가 참여 가능)</span>
                      </label>
                      <label class="flex items-center">
                        <input type="radio" name="quest_scope" value="crew" class="mr-3">
                        <span class="text-gray-700">👥 크루 전용 (크루 멤버만 참여 가능)</span>
                      </label>
                    </div>
                  </div>
                  
                  <div id="crew-selection" class="hidden mt-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">크루 선택</label>
                    <select 
                      id="quest-crew" 
                      name="crew_id"
                      class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">크루를 선택하세요</option>
                      <!-- Will be populated by JavaScript -->
                    </select>
                  </div>
                </div>

                <!-- Form Actions -->
                <div class="flex justify-end space-x-4 pt-6 border-t">
                  <button 
                    type="button" 
                    onclick="closeQuestModal()"
                    class="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                  >
                    취소
                  </button>
                  
                  <button 
                    type="submit"
                    class="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                  >
                    🚀 퀘스트 생성
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <!-- Quest Detail Modal (Hidden by default) -->
        <div id="quest-detail-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div class="p-8">
              <!-- Modal Header -->
              <div class="flex justify-between items-center mb-6">
                <div>
                  <h2 id="quest-detail-title" class="text-3xl font-bold text-gray-900">퀘스트 상세 정보</h2>
                  <p id="quest-detail-creator" class="text-gray-600 mt-1">크리에이터: Loading...</p>
                </div>
                <button onclick="closeQuestDetailModal()" class="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
              </div>
              
              <!-- Quest Status Banner -->
              <div id="quest-status-banner" class="mb-6 p-4 rounded-lg">
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-3">
                    <span id="quest-status-icon" class="text-2xl">📢</span>
                    <div>
                      <div id="quest-status-text" class="font-semibold">모집 중</div>
                      <div id="quest-participants-info" class="text-sm opacity-75">3/10명 참여 중</div>
                    </div>
                  </div>
                  <div class="text-right">
                    <div id="quest-time-remaining" class="font-bold">5일 남음</div>
                    <div class="text-sm opacity-75">시작까지</div>
                  </div>
                </div>
              </div>

              <!-- Quest Content Grid -->
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                <!-- Left Column: Quest Info -->
                <div class="space-y-6">
                  
                  <!-- Description -->
                  <div class="bg-gray-50 rounded-lg p-6">
                    <h3 class="text-lg font-semibold mb-3">📝 퀘스트 설명</h3>
                    <p id="quest-detail-description" class="text-gray-700">Loading...</p>
                  </div>
                  
                  <!-- Running Requirements -->
                  <div class="bg-blue-50 rounded-lg p-6">
                    <h3 class="text-lg font-semibold text-blue-900 mb-4">🏃‍♂️ 러닝 조건</h3>
                    <div class="grid grid-cols-2 gap-4">
                      <div class="bg-white rounded p-3">
                        <div class="text-sm text-gray-600">목표 거리</div>
                        <div id="quest-distance" class="text-lg font-bold text-blue-600">5.0km</div>
                      </div>
                      <div class="bg-white rounded p-3">
                        <div class="text-sm text-gray-600">주간 횟수</div>
                        <div id="quest-frequency" class="text-lg font-bold text-blue-600">3회</div>
                      </div>
                      <div class="bg-white rounded p-3">
                        <div class="text-sm text-gray-600">퀘스트 기간</div>
                        <div id="quest-duration" class="text-lg font-bold text-blue-600">14일</div>
                      </div>
                      <div class="bg-white rounded p-3">
                        <div class="text-sm text-gray-600">시작 일시</div>
                        <div id="quest-start-time" class="text-lg font-bold text-blue-600">2025-01-01</div>
                      </div>
                    </div>
                  </div>

                  <!-- Participants Preview -->
                  <div class="bg-green-50 rounded-lg p-6">
                    <h3 class="text-lg font-semibold text-green-900 mb-4">👥 참여자 현황</h3>
                    <div id="quest-participants-list" class="space-y-2">
                      <!-- Will be populated by JavaScript -->
                      <div class="flex items-center space-x-3 bg-white rounded p-3">
                        <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold">A</div>
                        <div>
                          <div class="font-medium">Alice Runner</div>
                          <div class="text-sm text-gray-600">2일 전 참여</div>
                        </div>
                      </div>
                    </div>
                    <div class="mt-4 text-center">
                      <div id="quest-slots-remaining" class="text-sm text-green-700">7자리 남음</div>
                    </div>
                  </div>
                </div>

                <!-- Right Column: Participation & Staking -->
                <div class="space-y-6">
                  
                  <!-- Staking Info -->
                  <div class="bg-purple-50 rounded-lg p-6">
                    <h3 class="text-lg font-semibold text-purple-900 mb-4">💰 스테이킹 정보</h3>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                      <div class="text-center">
                        <div class="text-3xl font-bold text-purple-600" id="quest-stake-amount">0.1 ETH</div>
                        <div class="text-sm text-gray-600">참여 스테이킹</div>
                      </div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-3 text-sm">
                      <div class="bg-white rounded p-3 text-center">
                        <div class="text-green-600 font-semibold" id="quest-success-rate">70%</div>
                        <div class="text-gray-600">성공 시 보상</div>
                      </div>
                      <div class="bg-white rounded p-3 text-center">
                        <div class="text-orange-600 font-semibold" id="quest-failure-rate">30%</div>
                        <div class="text-gray-600">실패 시 보상</div>
                      </div>
                    </div>
                    
                    <div class="mt-4 p-3 bg-amber-50 border border-amber-200 rounded">
                      <div class="text-sm text-amber-800">
                        💡 <strong>스마트 분배:</strong> 성공하면 더 많은 보상, 실패해도 NFT 메달과 일부 보상을 받습니다.
                      </div>
                    </div>
                  </div>

                  <!-- Participation Actions -->
                  <div class="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 class="text-lg font-semibold mb-4">🎯 퀘스트 참여</h3>
                    
                    <!-- User Status Check -->
                    <div id="participation-status" class="mb-4">
                      <!-- Will be updated by JavaScript -->
                    </div>
                    
                    <!-- Join Quest Button -->
                    <div id="join-quest-section" class="space-y-4">
                      <div class="bg-gray-50 rounded p-4">
                        <div class="flex items-center justify-between mb-2">
                          <span class="font-medium">참여 비용</span>
                          <span id="join-cost-display" class="font-bold text-lg">0.1 ETH</span>
                        </div>
                        <div class="text-sm text-gray-600">
                          스마트 컨트랙트에 자동으로 에스크로됩니다
                        </div>
                      </div>
                      
                      <button 
                        id="join-quest-btn" 
                        onclick="confirmQuestJoin()"
                        class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-lg font-semibold text-lg transition-colors"
                      >
                        🚀 퀘스트 참여하기
                      </button>
                      
                      <div class="text-xs text-gray-500 text-center">
                        참여 시 이용약관 및 퀘스트 규칙에 동의한 것으로 간주됩니다
                      </div>
                    </div>
                    
                    <!-- Already Participated -->
                    <div id="already-participated-section" class="hidden">
                      <div class="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                        <div class="text-green-600 font-semibold text-lg mb-2">✅ 참여 완료!</div>
                        <div class="text-green-700 text-sm mb-4">이미 이 퀘스트에 참여하고 있습니다</div>
                        <button 
                          onclick="goToMyQuests()" 
                          class="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded font-medium"
                        >
                          내 퀘스트에서 확인
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Quest Rules -->
                  <div class="bg-gray-50 rounded-lg p-6">
                    <h3 class="text-lg font-semibold mb-3">📋 퀘스트 규칙</h3>
                    <div class="space-y-2 text-sm text-gray-700">
                      <div class="flex items-start space-x-2">
                        <span class="text-green-500">✓</span>
                        <span>GPS 데이터와 함께 러닝 결과를 제출해야 합니다</span>
                      </div>
                      <div class="flex items-start space-x-2">
                        <span class="text-green-500">✓</span>
                        <span>주간 목표 횟수를 달성하면 성공으로 인정됩니다</span>
                      </div>
                      <div class="flex items-start space-x-2">
                        <span class="text-green-500">✓</span>
                        <span>실패해도 NFT 메달과 참여 보상을 받습니다</span>
                      </div>
                      <div class="flex items-start space-x-2">
                        <span class="text-orange-500">!</span>
                        <span>부정행위 적발 시 모든 보상이 몰수됩니다</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Modal Actions -->
              <div class="flex justify-end space-x-4 mt-8 pt-6 border-t">
                <button 
                  onclick="closeQuestDetailModal()"
                  class="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Running Data Submission Modal (Hidden by default) -->
        <div id="run-submit-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4">
            <div class="p-8">
              <!-- Modal Header -->
              <div class="text-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900 mb-2">🏃‍♂️ 러닝 데이터 제출</h2>
                <p class="text-gray-600">오늘의 러닝 결과를 기록해주세요</p>
              </div>
              
              <!-- Form -->
              <form id="run-submit-form" class="space-y-6">
                
                <!-- Quest Selection -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">참여 중인 퀘스트</label>
                  <select id="run-quest-select" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required>
                    <option value="">퀘스트를 선택하세요</option>
                    <option value="quest_1">새해 다짐 5km 챌린지</option>
                  </select>
                </div>

                <!-- Distance -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">달린 거리 (km)</label>
                  <input 
                    type="number" 
                    id="run-distance" 
                    name="distance"
                    min="0.1" 
                    max="100" 
                    step="0.1"
                    placeholder="5.0"
                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                </div>

                <!-- Duration -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">소요 시간</label>
                  <div class="grid grid-cols-3 gap-2">
                    <div>
                      <input 
                        type="number" 
                        id="run-hours" 
                        placeholder="시간"
                        min="0" 
                        max="23"
                        class="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
                      >
                      <div class="text-xs text-gray-500 text-center mt-1">시간</div>
                    </div>
                    <div>
                      <input 
                        type="number" 
                        id="run-minutes" 
                        placeholder="분"
                        min="0" 
                        max="59"
                        class="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
                        required
                      >
                      <div class="text-xs text-gray-500 text-center mt-1">분</div>
                    </div>
                    <div>
                      <input 
                        type="number" 
                        id="run-seconds" 
                        placeholder="초"
                        min="0" 
                        max="59"
                        class="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
                      >
                      <div class="text-xs text-gray-500 text-center mt-1">초</div>
                    </div>
                  </div>
                </div>

                <!-- Route Info -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">러닝 경로 (선택사항)</label>
                  <input 
                    type="text" 
                    id="run-route" 
                    name="route"
                    placeholder="예: 부산 해운대 해변 코스"
                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                </div>

                <!-- GPS Verification -->
                <div class="bg-blue-50 rounded-lg p-4">
                  <h3 class="font-semibold text-blue-900 mb-3">📍 GPS 위치 인증</h3>
                  
                  <div class="space-y-3">
                    <button 
                      type="button" 
                      id="get-location-btn" 
                      onclick="getCurrentLocation()"
                      class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium"
                    >
                      현재 위치 가져오기
                    </button>
                    
                    <div id="location-info" class="hidden bg-white rounded p-3">
                      <div class="text-sm text-gray-700">
                        <div>📍 위도: <span id="latitude">-</span></div>
                        <div>📍 경도: <span id="longitude">-</span></div>
                        <div class="text-xs text-green-600 mt-1">✓ GPS 위치가 확인되었습니다</div>
                      </div>
                    </div>
                    
                    <div class="text-xs text-gray-600">
                      💡 GPS 데이터는 러닝 인증을 위해 사용되며, 개인정보는 안전하게 보호됩니다.
                    </div>
                  </div>
                </div>

                <!-- Photo Upload (Optional) -->
                <div class="bg-gray-50 rounded-lg p-4">
                  <h3 class="font-semibold text-gray-700 mb-3">📸 인증 사진 (선택사항)</h3>
                  
                  <div class="space-y-3">
                    <input 
                      type="file" 
                      id="run-photo" 
                      accept="image/*"
                      capture="environment"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                    
                    <div class="text-xs text-gray-600">
                      📝 러닝 경로나 운동 후 모습을 사진으로 남겨보세요. (선택사항)
                    </div>
                  </div>
                </div>

                <!-- Form Actions -->
                <div class="flex space-x-4 pt-4">
                  <button 
                    type="button" 
                    onclick="closeRunSubmitModal()"
                    class="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                  >
                    취소
                  </button>
                  
                  <button 
                    type="submit"
                    class="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
                  >
                    🚀 데이터 제출
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <!-- My Quests Dashboard Page (Hidden by default) -->
        <div id="my-quests-dashboard" class="hidden">
          <!-- Dashboard Header -->
          <div class="bg-gradient-to-r from-indigo-600 to-blue-600 text-white py-12">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div class="flex items-center justify-between">
                <div>
                  <h1 class="text-3xl font-bold mb-2">📊 내 퀘스트 대시보드</h1>
                  <p class="text-blue-100" id="dashboard-user-greeting">러닝 여정을 함께 추적해보세요!</p>
                </div>
                <button 
                  onclick="closeDashboard()" 
                  class="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  ← 메인으로
                </button>
              </div>
              
              <!-- Quick Stats -->
              <div class="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8">
                <div class="bg-white/10 backdrop-blur rounded-lg p-4">
                  <div class="text-2xl font-bold" id="stat-active-quests">3</div>
                  <div class="text-blue-100 text-sm">활성 퀘스트</div>
                </div>
                <div class="bg-white/10 backdrop-blur rounded-lg p-4">
                  <div class="text-2xl font-bold" id="stat-total-runs">12</div>
                  <div class="text-blue-100 text-sm">총 러닝 횟수</div>
                </div>
                <div class="bg-white/10 backdrop-blur rounded-lg p-4">
                  <div class="text-2xl font-bold" id="stat-total-distance">45.2km</div>
                  <div class="text-blue-100 text-sm">총 거리</div>
                </div>
                <div class="bg-white/10 backdrop-blur rounded-lg p-4">
                  <div class="text-2xl font-bold" id="stat-success-rate">85%</div>
                  <div class="text-blue-100 text-sm">성공률</div>
                </div>
              </div>
            </div>
          </div>

          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            
            <!-- Dashboard Navigation Tabs -->
            <div class="mb-8">
              <div class="border-b border-gray-200">
                <nav class="-mb-px flex space-x-8">
                  <button 
                    onclick="switchDashboardTab('active-quests')"
                    class="dashboard-tab active-tab py-2 px-1 border-b-2 border-indigo-500 font-medium text-sm text-indigo-600"
                  >
                    🏃‍♂️ 진행 중인 퀘스트
                  </button>
                  <button 
                    onclick="switchDashboardTab('run-history')"
                    class="dashboard-tab py-2 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  >
                    📈 러닝 히스토리
                  </button>
                  <button 
                    onclick="switchDashboardTab('rewards')"
                    class="dashboard-tab py-2 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  >
                    🏅 보상 & NFT
                  </button>
                  <button 
                    onclick="switchDashboardTab('completed')"
                    class="dashboard-tab py-2 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  >
                    ✅ 완료된 퀘스트
                  </button>
                </nav>
              </div>
            </div>

            <!-- Active Quests Tab -->
            <div id="active-quests-tab" class="dashboard-content">
              <div class="mb-6 flex justify-between items-center">
                <h2 class="text-2xl font-bold text-gray-900">진행 중인 퀘스트</h2>
                <button 
                  onclick="openRunSubmitModal()"
                  class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium"
                >
                  📊 러닝 데이터 제출
                </button>
              </div>

              <div id="active-quests-list" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Will be populated by JavaScript -->
              </div>
            </div>

            <!-- Run History Tab -->
            <div id="run-history-tab" class="dashboard-content hidden">
              <div class="mb-6">
                <h2 class="text-2xl font-bold text-gray-900 mb-4">러닝 히스토리</h2>
                
                <!-- Period Filter -->
                <div class="flex space-x-4">
                  <select id="history-period-filter" class="px-4 py-2 border border-gray-300 rounded-lg">
                    <option value="all">전체 기간</option>
                    <option value="week">최근 1주</option>
                    <option value="month" selected>최근 1개월</option>
                    <option value="quarter">최근 3개월</option>
                  </select>
                  
                  <select id="history-quest-filter" class="px-4 py-2 border border-gray-300 rounded-lg">
                    <option value="all">모든 퀘스트</option>
                  </select>
                </div>
              </div>

              <!-- Running Stats Chart Area -->
              <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
                <h3 class="text-lg font-semibold mb-4">📈 러닝 통계</h3>
                <div id="running-stats-chart" class="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                  <div class="text-center text-gray-500">
                    <div class="text-4xl mb-2">📊</div>
                    <div>차트가 여기에 표시됩니다</div>
                    <div class="text-sm">러닝 데이터를 제출하면 통계를 볼 수 있어요!</div>
                  </div>
                </div>
              </div>

              <!-- Run History List -->
              <div class="bg-white rounded-xl shadow-lg overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-200">
                  <h3 class="text-lg font-semibold">최근 러닝 기록</h3>
                </div>
                <div id="run-history-list" class="divide-y divide-gray-200">
                  <!-- Will be populated by JavaScript -->
                </div>
              </div>
            </div>

            <!-- Rewards & NFT Tab -->
            <div id="rewards-tab" class="dashboard-content hidden">
              <div class="mb-6">
                <h2 class="text-2xl font-bold text-gray-900">보상 & NFT 컬렉션</h2>
              </div>

              <!-- Rewards Summary -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl p-6 text-white">
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="text-2xl font-bold" id="total-rewards">2.4 ETH</div>
                      <div class="opacity-90">총 획득 보상</div>
                    </div>
                    <div class="text-4xl">💰</div>
                  </div>
                </div>

                <div class="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-6 text-white">
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="text-2xl font-bold" id="total-nfts">7</div>
                      <div class="opacity-90">NFT 메달</div>
                    </div>
                    <div class="text-4xl">🏅</div>
                  </div>
                </div>

                <div class="bg-gradient-to-r from-green-500 to-teal-500 rounded-xl p-6 text-white">
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="text-2xl font-bold" id="total-points">1,250</div>
                      <div class="opacity-90">포인트</div>
                    </div>
                    <div class="text-4xl">⭐</div>
                  </div>
                </div>
              </div>

              <!-- NFT Collection -->
              <div class="bg-white rounded-xl shadow-lg p-6">
                <h3 class="text-lg font-semibold mb-4">🏅 내 NFT 메달 컬렉션</h3>
                <div id="nft-collection" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <!-- Will be populated by JavaScript -->
                </div>
              </div>
            </div>

            <!-- Completed Quests Tab -->
            <div id="completed-tab" class="dashboard-content hidden">
              <div class="mb-6">
                <h2 class="text-2xl font-bold text-gray-900">완료된 퀘스트</h2>
              </div>

              <div id="completed-quests-list" class="space-y-6">
                <!-- Will be populated by JavaScript -->
              </div>
            </div>

          </div>
        </div>

        <!-- Quick Actions -->
        <div class="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h2 class="text-2xl font-bold text-center mb-8">🚀 빠른 시작</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <button onclick="openQuestCreationModal()" class="p-4 border-2 border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
              <div class="text-2xl mb-2">🎯</div>
              <div class="font-medium">새 퀘스트 생성</div>
              <div class="text-sm text-gray-500">러닝 챌린지 만들기</div>
            </button>
            
            <button onclick="openRunSubmitModal()" class="p-4 border-2 border-green-200 rounded-lg hover:bg-green-50 transition-colors">
              <div class="text-2xl mb-2">📊</div>
              <div class="font-medium">러닝 데이터 제출</div>
              <div class="text-sm text-gray-500">오늘의 운동 기록하기</div>
            </button>
            
            <button class="p-4 border-2 border-purple-200 rounded-lg hover:bg-purple-50 transition-colors">
              <div class="text-2xl mb-2">🏅</div>
              <div class="font-medium">내 메달</div>
              <div class="text-sm text-gray-500">획득한 NFT 메달 보기</div>
            </button>
          </div>
        </div>

        <!-- Feature Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div class="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
            <div class="text-4xl mb-4">🎯</div>
            <h3 class="text-xl font-semibold mb-3">실패해도 가치있는 경험</h3>
            <p class="text-gray-600">성공하면 보상, 실패해도 NFT와 AI 리포트로 성장의 기록을 남깁니다.</p>
          </div>
          
          <div class="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
            <div class="text-4xl mb-4">👥</div>
            <h3 class="text-xl font-semibold mb-3">크루 기반 도전</h3>
            <p class="text-gray-600">혼자가 아닌 팀과 함께하는 러닝 챌린지로 동기부여와 지속성을 높입니다.</p>
          </div>
          
          <div class="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
            <div class="text-4xl mb-4">🔐</div>
            <h3 class="text-xl font-semibold mb-3">Web2.5 온보딩</h3>
            <p class="text-gray-600">소셜 로그인으로 간편하게 시작하고, 블록체인은 백그라운드에서 처리됩니다.</p>
          </div>
        </div>

        <!-- Quest Browser Section -->
        <div class="bg-white rounded-xl shadow-lg p-8 mb-8">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold">🔥 러닝 퀘스트 둘러보기</h2>
            
            <!-- Quest Filters -->
            <div class="flex space-x-3">
              <select id="quest-filter" class="px-4 py-2 border border-gray-300 rounded-lg text-sm" onchange="filterQuests(this.value)">
                <option value="all">전체 퀘스트</option>
                <option value="open">참여 가능</option>
                <option value="active">진행 중</option>
                <option value="completed">완료됨</option>
              </select>
              
              <button 
                onclick="openQuestCreationModal()" 
                class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
              >
                + 새 퀘스트
              </button>
            </div>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="quest-browser">
            <!-- Will be populated by JavaScript -->
            <div class="quest-card p-6 border border-gray-200 rounded-lg hover:shadow-lg transition-shadow cursor-pointer" onclick="showQuestDetails('quest_1')">
              <div class="flex justify-between items-start mb-4">
                <div>
                  <h3 class="font-bold text-lg text-gray-900">새해 다짐 5km 챌린지</h3>
                  <p class="text-sm text-gray-500">👥 부산 러닝 크루</p>
                </div>
                <span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                  🏃‍♂️ 진행중
                </span>
              </div>
              
              <p class="text-gray-600 mb-4">일주일에 3번, 각각 5km 이상 달리기. 새해 목표 달성!</p>
              
              <div class="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div class="bg-blue-50 rounded-lg p-3">
                  <div class="text-blue-600 font-medium">거리/횟수</div>
                  <div class="text-blue-900 font-bold">5km × 주3회</div>
                </div>
                <div class="bg-purple-50 rounded-lg p-3">
                  <div class="text-purple-600 font-medium">스테이킹</div>
                  <div class="text-purple-900 font-bold">0.1 ETH</div>
                </div>
              </div>
              
              <div class="flex justify-between items-center">
                <div class="flex items-center space-x-4 text-sm text-gray-500">
                  <span>👥 3/10명 참여</span>
                  <span>⏰ 5일 남음</span>
                </div>
                <button onclick="handleQuestJoin('quest_1', 0.1)" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
                  참여하기
                </button>
              </div>
            </div>
            
            <div class="quest-card p-6 border border-gray-200 rounded-lg hover:shadow-lg transition-shadow cursor-pointer" onclick="showQuestDetails('quest_2')">
              <div class="flex justify-between items-start mb-4">
                <div>
                  <h3 class="font-bold text-lg text-gray-900">겨울 극복 3km 챌린지</h3>
                  <p class="text-sm text-gray-500">🌍 전체 공개</p>
                </div>
                <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  📢 모집중
                </span>
              </div>
              
              <p class="text-gray-600 mb-4">추운 겨울, 작은 목표로 시작하는 꾸준함. 함께 도전해요!</p>
              
              <div class="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div class="bg-green-50 rounded-lg p-3">
                  <div class="text-green-600 font-medium">거리/횟수</div>
                  <div class="text-green-900 font-bold">3km × 주2회</div>
                </div>
                <div class="bg-orange-50 rounded-lg p-3">
                  <div class="text-orange-600 font-medium">스테이킹</div>
                  <div class="text-orange-900 font-bold">0.05 ETH</div>
                </div>
              </div>
              
              <div class="flex justify-between items-center">
                <div class="flex items-center space-x-4 text-sm text-gray-500">
                  <span>👥 1/8명 참여</span>
                  <span>⏰ 12일 남음</span>
                </div>
                <button onclick="handleQuestJoin('quest_2', 0.05)" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium">
                  참여하기
                </button>
              </div>
            </div>
            
            <div class="quest-card p-6 border border-gray-200 rounded-lg hover:shadow-lg transition-shadow cursor-pointer" onclick="showQuestDetails('quest_3')">
              <div class="flex justify-between items-start mb-4">
                <div>
                  <h3 class="font-bold text-lg text-gray-900">마라톤 준비 10km 도전</h3>
                  <p class="text-sm text-gray-500">👥 서울 마라톤 클럽</p>
                </div>
                <span class="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
                  🔄 곧 시작
                </span>
              </div>
              
              <p class="text-gray-600 mb-4">마라톤 대회를 위한 체계적인 10km 훈련 프로그램</p>
              
              <div class="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div class="bg-red-50 rounded-lg p-3">
                  <div class="text-red-600 font-medium">거리/횟수</div>
                  <div class="text-red-900 font-bold">10km × 주4회</div>
                </div>
                <div class="bg-indigo-50 rounded-lg p-3">
                  <div class="text-indigo-600 font-medium">스테이킹</div>
                  <div class="text-indigo-900 font-bold">0.2 ETH</div>
                </div>
              </div>
              
              <div class="flex justify-between items-center">
                <div class="flex items-center space-x-4 text-sm text-gray-500">
                  <span>👥 8/15명 참여</span>
                  <span>⏰ 2일 후 시작</span>
                </div>
                <button onclick="handleQuestJoin('quest_3', 0.2)" class="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium">
                  참여하기
                </button>
              </div>
            </div>
          </div>
          
          <div class="text-center mt-6">
            <button class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium">
              모든 퀘스트 보기
            </button>
          </div>
        </div>

        <!-- API Testing Section -->
        <div class="bg-gray-50 rounded-xl p-8">
          <h2 class="text-2xl font-bold mb-6">🛠️ 개발자 API 테스트</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <a href="/api/health" class="block p-4 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors">
              <strong class="text-blue-800">Health Check</strong>
              <br />
              <span class="text-sm text-blue-600">시스템 상태 확인</span>
            </a>
            
            <a href="/api/users" class="block p-4 bg-green-100 rounded-lg hover:bg-green-200 transition-colors">
              <strong class="text-green-800">Users API</strong>
              <br />
              <span class="text-sm text-green-600">사용자 목록 조회</span>
            </a>
            
            <a href="/api/crews" class="block p-4 bg-purple-100 rounded-lg hover:bg-purple-200 transition-colors">
              <strong class="text-purple-800">Crews API</strong>
              <br />
              <span class="text-sm text-purple-600">크루 목록 조회</span>
            </a>
            
            <a href="/api/quests/quest_1" class="block p-4 bg-yellow-100 rounded-lg hover:bg-yellow-200 transition-colors">
              <strong class="text-yellow-800">Quest API</strong>
              <br />
              <span class="text-sm text-yellow-600">퀘스트 상세 조회</span>
            </a>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <footer class="bg-gray-800 text-white py-8 mt-16">
        <div class="max-w-7xl mx-auto px-4 text-center">
          <p class="text-lg font-medium mb-2">🏃‍♂️ 작심삼일 RUN DAO</p>
          <p class="text-gray-400">"실패조차 가치가 되는 러닝 경험"</p>
        </div>
      </footer>
    </div>
    
    <!-- JavaScript -->
    <script src="/static/app.js"></script>
    <script>
      // Initialize web3 components when page loads
      document.addEventListener('DOMContentLoaded', function() {
        // Initialize Web3 Manager
        if (typeof Web3Manager !== 'undefined') {
          window.web3Manager = new Web3Manager();
        }
        
        // Initialize Social Login Manager
        if (typeof SocialLoginManager !== 'undefined') {
          window.socialManager = new SocialLoginManager();
        }
        
        // Load active quests
        if (typeof loadActiveQuests === 'function') {
          loadActiveQuests();
        }
        
        console.log('작심삼일 RUN DAO 초기화 완료');
      });
    </script>
    </body>
    </html>
  `)
})

export default app
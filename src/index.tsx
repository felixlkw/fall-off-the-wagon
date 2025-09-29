import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { renderer } from './renderer'

// Type definition for Cloudflare bindings
type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for API routes
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// Use renderer for HTML pages
app.use(renderer)

// API Routes
// Health check
app.get('/api/health', async (c) => {
  const { DB } = c.env
  
  try {
    // Test database connection
    const result = await DB.prepare('SELECT COUNT(*) as count FROM users').first()
    return c.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      users: result?.count || 0
    })
  } catch (error) {
    return c.json({ 
      status: 'unhealthy', 
      error: 'Database connection failed',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Get all users (for testing)
app.get('/api/users', async (c) => {
  const { DB } = c.env
  
  try {
    const result = await DB.prepare(`
      SELECT 
        id, nickname, region, wallet_address, 
        custody_type, created_at
      FROM users 
      ORDER BY created_at DESC
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

// Get user by ID
app.get('/api/users/:id', async (c) => {
  const { DB } = c.env
  const userId = c.req.param('id')
  
  try {
    const user = await DB.prepare(`
      SELECT 
        id, nickname, region, wallet_address,
        custody_type, created_at
      FROM users 
      WHERE id = ?
    `).bind(userId).first()
    
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

// Main homepage
app.get('/', (c) => {
  return c.render(
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-4xl font-bold text-gray-800 mb-6">
        🏃‍♂️ 작심삼일 RUN DAO
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">🎯 실패해도 가치있는 경험</h2>
          <p className="text-gray-600">성공하면 보상, 실패해도 NFT와 AI 리포트로 성장의 기록을 남깁니다.</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">👥 크루 기반 도전</h2>
          <p className="text-gray-600">혼자가 아닌 팀과 함께하는 러닝 챌린지로 동기부여와 지속성을 높입니다.</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">🔐 Web2.5 온보딩</h2>
          <p className="text-gray-600">소셜 로그인으로 간편하게 시작하고, 블록체인은 백그라운드에서 처리됩니다.</p>
        </div>
      </div>
      
      <div className="mt-8 space-y-4">
        <h2 className="text-2xl font-semibold">🛠️ API 테스트</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a href="/api/health" className="block p-4 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors">
            <strong>GET /api/health</strong>
            <br />
            <span className="text-sm text-gray-600">시스템 상태 확인</span>
          </a>
          
          <a href="/api/users" className="block p-4 bg-green-100 rounded-lg hover:bg-green-200 transition-colors">
            <strong>GET /api/users</strong>
            <br />
            <span className="text-sm text-gray-600">사용자 목록 조회</span>
          </a>
          
          <a href="/api/crews" className="block p-4 bg-purple-100 rounded-lg hover:bg-purple-200 transition-colors">
            <strong>GET /api/crews</strong>
            <br />
            <span className="text-sm text-gray-600">크루 목록 조회</span>
          </a>
          
          <a href="/api/quests/quest_1" className="block p-4 bg-yellow-100 rounded-lg hover:bg-yellow-200 transition-colors">
            <strong>GET /api/quests/quest_1</strong>
            <br />
            <span className="text-sm text-gray-600">퀘스트 상세 조회</span>
          </a>
        </div>
      </div>
    </div>
  )
})

export default app

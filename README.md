# 🏃‍♂️ 작심삼일 RUN DAO

**"실패해도 가치 있는 경험"을 제공하는 Web2.5 러닝 커뮤니티 DAO**

## 📍 현재 개발 상황 (Week 1 완료)

### ✅ 완성된 기능

#### 🏗️ **백엔드 인프라**
- **Hono + Cloudflare Pages** 환경 구축
- **Cloudflare D1** 데이터베이스 설계 및 마이그레이션
- **PM2** 개발 서버 구성
- **CORS** 활성화된 REST API

#### 🗄️ **데이터베이스 스키마**
- `users` - 사용자 (소셜로그인 + 지갑 정보)
- `crews` - 크루 (러닝 팀)  
- `crew_memberships` - 크루 멤버십
- `quests` - 러닝 챌린지
- `participations` - 퀘스트 참여 기록
- `run_records` - 러닝 데이터 (외부 연동)
- `nft_medals` - NFT 메달 기록
- `kudos` - 응원 시스템
- `abuse_reports` - 신고 시스템
- `settlements` - 정산 기록

#### 🔌 **API 엔드포인트**
- `GET /api/health` - 시스템 상태 확인
- `GET /api/users` - 사용자 목록
- `GET /api/users/:id` - 사용자 상세  
- `GET /api/crews` - 크루 목록 (멤버수 포함)
- `GET /api/crews/:crewId/quests` - 크루별 퀘스트
- `GET /api/quests/:questId` - 퀘스트 상세 (참여자 포함)

#### 🎨 **프론트엔드**
- **TailwindCSS** 기반 반응형 UI
- **JavaScript API** 클라이언트 유틸리티
- **커스텀 컴포넌트** (프로그래스 바, 상태 뱃지, 아바타)

### 🌐 **Public URLs**

- **웹앱**: https://3000-is5o8ur8z03gauymd8so9-6532622b.e2b.dev
- **API Health Check**: https://3000-is5o8ur8z03gauymd8so9-6532622b.e2b.dev/api/health
- **Users API**: https://3000-is5o8ur8z03gauymd8so9-6532622b.e2b.dev/api/users
- **Crews API**: https://3000-is5o8ur8z03gauymd8so9-6532622b.e2b.dev/api/crews

## 🎯 프로젝트 목표

### 핵심 차별화 포인트
1. **Web2.5 온보딩**: 소셜로그인 → 커스터디 지갑 자동생성
2. **실패자 보상**: 그레이 NFT + AI 리포트 → 재참여 유도  
3. **크루 중심**: 개인 동기 → 팀 동기로 지속성 강화
4. **3중 검증**: 센서 + AI + 커뮤니티로 치팅 방지

### 성공 지표 목표
- **실패자 재참여율**: 40%+ (핵심 차별화)
- **퀘스트 완주율**: 65%+
- **크루 활성화율**: 70%+

## 🛠️ 기술 스택

### **프론트엔드**
- React (JSX)
- TailwindCSS + 커스텀 스타일
- Axios (HTTP 클라이언트)
- FontAwesome (아이콘)

### **백엔드**  
- Hono (Cloudflare Workers)
- Cloudflare D1 (SQLite)
- Cloudflare R2 (파일 저장)
- PM2 (프로세스 관리)

### **블록체인** (예정)
- Polygon zkEVM
- Hardhat + TypeScript
- OpenZeppelin 라이브러리

## 📊 데이터 아키텍처

### 온체인 데이터 (예정)
- 퀘스트 스테이킹 기록
- NFT 메달 소유권  
- 정산 및 분배 기록

### 오프체인 데이터 (구현됨)
- 사용자 프로필 및 설정
- 러닝 데이터 및 분석
- 크루 및 커뮤니티 데이터
- AI 분석 결과

## 🚀 다음 단계 (Week 2)

### 📋 우선순위 작업
1. **Polygon zkEVM 환경** 설정
2. **기본 스마트 컨트랙트** 구현
3. **Web2.5 온보딩** 시스템 (Privy SDK)
4. **퀘스트 생성/참여** UI 구현
5. **러닝 데이터 연동** 준비 (Strava API)

## 💻 로컬 개발 환경

### 필수 요구사항
- Node.js 18+
- NPM 9+

### 개발 서버 실행
```bash
# 종속성 설치
npm install

# 데이터베이스 마이그레이션 적용
npm run db:migrate:local

# 시드 데이터 추가
npm run db:seed

# 프로젝트 빌드
npm run build

# 개발 서버 시작
pm2 start ecosystem.config.cjs

# 서버 상태 확인
curl http://localhost:3000/api/health

# PM2 로그 확인
pm2 logs rundao-webapp --nostream
```

### 유용한 스크립트
```bash
# 데이터베이스 초기화
npm run db:reset

# 포트 3000 정리
npm run clean-port

# 서버 테스트
npm run test
```

## 📁 프로젝트 구조
```
webapp/
├── src/
│   ├── index.tsx          # 메인 Hono 애플리케이션
│   └── renderer.tsx       # HTML 렌더러
├── public/static/
│   ├── app.js            # 프론트엔드 JavaScript
│   └── style.css         # 커스텀 CSS
├── migrations/
│   └── 0001_initial_schema.sql  # DB 스키마
├── docs/                 # 설계 문서들
├── seed.sql             # 테스트 데이터
├── ecosystem.config.cjs # PM2 설정
├── wrangler.jsonc       # Cloudflare 설정
└── package.json         # 프로젝트 설정
```

## 🧪 테스트 데이터

현재 시드 데이터:
- **사용자 4명** (Alice, Bob, Charlie, Diana)
- **크루 3개** (서울 새벽 러너, 부산 해변 러너, 엘리트 마라톤)
- **퀘스트 3개** (다양한 난이도와 상태)
- **러닝 기록 4개** (Strava, Garmin, Google Fit 연동)
- **응원 시스템** (Kudos) 샘플 데이터

## 📈 성과 및 검증

### ✅ 완료된 검증
- 데이터베이스 스키마 정상 작동
- 모든 API 엔드포인트 응답 확인
- 프론트엔드-백엔드 통신 검증
- PM2 기반 안정적인 서버 운영

### 🎯 다음 검증 목표
- Polygon zkEVM 테스트넷 연결
- 스마트 컨트랙트 배포 및 테스트
- 소셜로그인 + 커스터디 지갑 플로우
- 러닝 데이터 외부 API 연동

---

**🚀 개발 진행률**: Week 1/8 완료 (12.5%)
**📅 마지막 업데이트**: 2025-09-29
**👨‍💻 개발자**: GenSpark AI Assistant

> "실패조차 가치가 되는 러닝 경험" - 작심삼일 RUN DAO
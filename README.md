# AI Stock Analysis Assistant

AI 기반 주식 분석 챗봇. 자연어(한국어/영어)로 질문하면 실시간 주가, 과거 차트, 재무제표, 애널리스트 추천, 뉴스, 가격 예측을 조회하고 시각화해줍니다.

## 주요 기능

- **실시간 주가 조회** — 티커 심볼 기반 현재가 반환
- **과거 주가 차트** — 날짜 범위 지정 후 인터랙티브 차트(가격 + 거래량) 시각화
- **재무제표(Balance Sheet)** — 최근 연도별 재무 데이터 테이블 표시
- **애널리스트 추천** — Strong Buy / Buy / Hold / Sell / Strong Sell 비율 막대 차트
- **관련 뉴스** — 종목별 최신 뉴스 카드 표시 (출처·날짜 포함)
- **가격 예측(Forecast)** — 다항 회귀 기반 최대 12개월 예측을 차트에 오버레이
- **한국어 지원** — "엔비디아 주가 알려줘" 같은 한국어 질의 자동 처리
- **새 대화 버튼** — 헤더의 버튼으로 대화 이력 초기화 및 새 세션 시작

## 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Recharts |
| Backend | FastAPI, LangGraph (ReAct Agent), LangChain, OpenAI GPT-4o |
| 데이터 | yfinance, scikit-learn |

## 프로젝트 구조

```
.
├── backend/
│   ├── main.py          # FastAPI 서버, LangGraph 에이전트, 툴 정의
│   ├── .env.example     # 환경변수 템플릿
│   └── pyproject.toml   # Python 의존성
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── ChatInterface.tsx   # 채팅 UI, SSE 스트리밍 처리
    │   │   ├── StockChart.tsx      # 과거 주가 + 거래량 + 예측 차트
    │   │   ├── BalanceSheet.tsx    # 재무제표 테이블
    │   │   ├── AnalystRating.tsx   # 애널리스트 추천 차트
    │   │   └── StockNews.tsx       # 관련 뉴스 카드
    │   └── App.tsx
    └── package.json
```

## 시작하기

### 사전 요구사항

- Python 3.12+
- Node.js 18+
- OpenAI API 키

### 백엔드 실행

```bash
cd backend

# 가상환경 생성 및 활성화
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 의존성 설치
pip install -e .

# 환경변수 설정
cp .env.example .env
# .env 파일에 OPENAI_API_KEY 입력

# 서버 실행 (포트 8888)
python main.py
```

### 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

## 환경변수

`backend/.env.example`을 복사해 `.env`를 만들고 값을 채워주세요.

```bash
cp backend/.env.example backend/.env
```

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `OPENAI_API_KEY` | OpenAI API 키 | 필수 |
| `FRONTEND_ORIGINS` | CORS 허용 도메인 (쉼표 구분) | `*` |

> `.env` 파일은 `.gitignore`에 등록되어 있어 Git에 커밋되지 않습니다.
> 실제 API 키는 절대 공개 저장소에 올리지 마세요.

## 사용 예시

```
엔비디아 현재 주가 알려줘
AAPL 2024년 주가 차트 보여줘
테슬라 재무제표 분석해줘
MSFT 향후 12개월 주가 예측해줘
삼성전자 애널리스트 추천 현황은?
애플 관련 최신 뉴스 알려줘
```

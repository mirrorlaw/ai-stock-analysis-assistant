from contextlib import asynccontextmanager
from collections import defaultdict
from dotenv import load_dotenv
from pydantic import BaseModel
from datetime import datetime, timedelta

import asyncio
import os
import time
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
import json

from langgraph.prebuilt import create_react_agent as create_agent
from langchain_core.tools import tool
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver

import yfinance as yf

load_dotenv()

# ---------------------------------------------------------------------------
# Thread memory management (#7)
# ---------------------------------------------------------------------------
thread_last_active: dict[str, float] = {}
THREAD_TTL = 3600           # 1시간 미사용 스레드 제거
THREAD_CLEANUP_INTERVAL = 600  # 10분마다 정리
MAX_THREADS = 200           # 최대 보유 스레드 수

checkpointer = InMemorySaver()


async def cleanup_old_threads() -> None:
    while True:
        await asyncio.sleep(THREAD_CLEANUP_INTERVAL)
        now = time.time()
        expired = [
            tid for tid, last in list(thread_last_active.items())
            if now - last > THREAD_TTL
        ]
        for tid in expired:
            try:
                if hasattr(checkpointer, 'storage') and tid in checkpointer.storage:
                    del checkpointer.storage[tid]
            except Exception:
                pass
            thread_last_active.pop(tid, None)
        if expired:
            print(f"[cleanup] {len(expired)}개 만료 스레드 제거")


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(cleanup_old_threads())
    yield
    task.cancel()


# ---------------------------------------------------------------------------
# Rate limiter (#9)
# ---------------------------------------------------------------------------
RATE_LIMIT = 10     # IP당 분당 최대 요청 수
RATE_WINDOW = 60    # 초
rate_limit_store: dict[str, list[float]] = defaultdict(list)

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(lifespan=lifespan)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if request.url.path.startswith("/api/"):
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        rate_limit_store[client_ip] = [
            t for t in rate_limit_store[client_ip] if now - t < RATE_WINDOW
        ]
        if len(rate_limit_store[client_ip]) >= RATE_LIMIT:
            return JSONResponse(
                status_code=429,
                content={"detail": f"요청 한도 초과. {RATE_WINDOW}초당 최대 {RATE_LIMIT}회 요청 가능합니다."}
            )
        rate_limit_store[client_ip].append(now)
    return await call_next(request)


# CORS — 환경변수 FRONTEND_ORIGINS 로 도메인 지정 (#8)
frontend_origins = os.getenv("FRONTEND_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = ChatOpenAI(model='gpt-4o')


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------
@tool('get_stock_price', description='A function that returns the current stock price based on a ticker symbol.')
def get_stock_price(ticker: str):
    print('get_stock_price tool is being used')
    stock = yf.Ticker(ticker)
    history = stock.history(period='5d')
    if history.empty:
        return f"No price data found for {ticker}."
    return history['Close'].iloc[-1]


@tool('get_historical_stock_price', description='A function that returns the current stock price over time based on a ticker symbol and a start and end date.')
def get_historical_stock_price(ticker: str, start_date: str, end_date: str):
    print('get_historical_stock_price tool is being used')
    stock = yf.Ticker(ticker)
    hist = stock.history(start=start_date, end=end_date)
    hist.index = hist.index.astype('int64') // 1_000_000
    return hist.to_dict()


@tool('get_balance_sheet', description='A function that returns the balance sheet based on a ticker symbol.')
def get_balance_sheet(ticker: str):
    print('get_balance_sheet tool is being used')
    stock = yf.Ticker(ticker)
    bs = stock.balance_sheet
    if bs is None or bs.empty:
        return "No balance sheet data found."
    return json.loads(bs.to_json(orient='split'))


@tool('get_stock_news', description='A function that returns news based on a ticker symbol.')
def get_stock_news(ticker: str):
    print('get_stock_news tool is being used')
    stock = yf.Ticker(ticker)
    return stock.news


@tool('get_analyst_recommendations', description='A function that returns analyst recommendations based on a ticker symbol.')
def get_analyst_recommendations(ticker: str):
    print('get_analyst_recommendations tool is being used')
    stock = yf.Ticker(ticker)
    recommendations = stock.recommendations
    if recommendations is not None and not recommendations.empty:
        return recommendations.to_dict(orient='records')
    return "No recommendations found."


@tool('generate_stock_forecast', description='A function that generates a price forecast for a ticker symbol for the next n months.')
def generate_stock_forecast(ticker: str, months: int = 12):
    print('generate_stock_forecast tool is being used')
    stock = yf.Ticker(ticker)
    hist = stock.history(period="2y")

    if hist.empty:
        return "Not enough data to forecast."

    hist = hist.reset_index()
    if hasattr(hist['Date'].dtype, 'tz'):
        hist['Date'] = hist['Date'].dt.tz_convert(None)

    hist['Ordinal'] = hist['Date'].map(datetime.toordinal)
    X = hist[['Ordinal']].values
    y = hist['Close'].values

    from sklearn.linear_model import LinearRegression
    from sklearn.preprocessing import PolynomialFeatures
    from sklearn.pipeline import make_pipeline

    # 다항 회귀(degree=2)로 비선형 추세 반영 (#4)
    regressor = make_pipeline(PolynomialFeatures(degree=2), LinearRegression())
    regressor.fit(X, y)

    last_date = hist['Date'].iloc[-1]
    future_dates = [last_date + timedelta(days=30 * i) for i in range(1, months + 1)]
    future_ordinal = [[d.toordinal()] for d in future_dates]
    predictions = regressor.predict(future_ordinal)

    return [
        {"date": d.strftime("%Y-%m-%d"), "price": round(float(p), 2)}
        for d, p in zip(future_dates, predictions)
    ]


agent = create_agent(
    model=model,
    checkpointer=checkpointer,
    tools=[get_stock_price, get_historical_stock_price, get_balance_sheet,
           get_stock_news, get_analyst_recommendations, generate_stock_forecast]
)


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
class PromptObject(BaseModel):
    content: str
    id: str
    role: str


class RequestObject(BaseModel):
    prompt: PromptObject
    threadId: str
    responseId: str


@app.post('/api/chat')
async def chat(request: RequestObject):
    config = {'configurable': {'thread_id': request.threadId}}

    # 스레드 활동 시간 갱신; 한도 초과 시 가장 오래된 스레드 퇴출 (#7)
    thread_last_active[request.threadId] = time.time()
    if len(thread_last_active) > MAX_THREADS:
        oldest = min(thread_last_active, key=thread_last_active.get)
        try:
            if hasattr(checkpointer, 'storage') and oldest in checkpointer.storage:
                del checkpointer.storage[oldest]
        except Exception:
            pass
        thread_last_active.pop(oldest, None)

    async def generate():
        async for event in agent.astream_events(
            {'messages': [
                SystemMessage('You are a stock analysis assistant. You have the ability to get real-time stock prices, historical stock prices (given a date range), news and balance sheet data for a given ticker symbol. You can converse in Korean. If the user asks about a stock in Korean, please infer the correct ticker symbol (e.g., "엔비디아" -> "NVDA").'),
                HumanMessage(request.prompt.content)
            ]},
            config=config,
            version="v1"
        ):
            kind = event["event"]

            if kind == "on_chat_model_stream":
                chunk = event["data"]["chunk"]
                if chunk.content:
                    yield json.dumps({'type': 'text', 'content': chunk.content}) + '\n'

            elif kind == "on_tool_end":
                tool_name = event["name"]
                output = event["data"].get("output")

                if tool_name == "get_historical_stock_price":
                    yield json.dumps({'type': 'chart', 'data': output}) + '\n'

                elif tool_name == "generate_stock_forecast":
                    yield json.dumps({'type': 'forecast', 'data': output}) + '\n'

                elif tool_name == "get_analyst_recommendations":
                    yield json.dumps({'type': 'analyst_rating', 'data': output}) + '\n'

                elif tool_name == "get_stock_news":
                    yield json.dumps({'type': 'news', 'data': output}) + '\n'

                elif tool_name == "get_balance_sheet":
                    try:
                        yield json.dumps({'type': 'balance_sheet', 'data': output}) + '\n'
                    except Exception as e:
                        print(f"Error serializing balance sheet: {e}")
                        yield json.dumps({'type': 'text', 'content': 'Error displaying balance sheet.'}) + '\n'

    return StreamingResponse(generate(), media_type='text/event-stream',
                             headers={
                                 'Cache-Control': 'no-cache, no-transform',
                                 'Connection': 'keep-alive',
                             })


if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=8888)

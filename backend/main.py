from dotenv import load_dotenv
from pydantic import BaseModel
from datetime import datetime, timedelta

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import json
from fastapi.responses import StreamingResponse

from langgraph.prebuilt import create_react_agent as create_agent
from langchain_core.tools import tool
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver

import yfinance as yf

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = ChatOpenAI(
    model = 'gpt-4o'
)

checkpointer = InMemorySaver()


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
    # Convert DatetimeIndex to millisecond integers for JSON serialization
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
        # Convert to dictionary with 'period' as key or just list of records
        # Recent yfinance returns simple dataframe
        return recommendations.to_dict(orient='records')
    return "No recommendations found."


@tool('generate_stock_forecast', description='A function that generates a price forecast for a ticker symbol for the next n months.')
def generate_stock_forecast(ticker: str, months: int = 12):
    print('generate_stock_forecast tool is being used')
    stock = yf.Ticker(ticker)
    # Get 2 years of history for training
    hist = stock.history(period="2y")
    
    if hist.empty:
        return "Not enough data to forecast."
        
    hist = hist.reset_index()
    # Handle timezone awareness if present
    if hasattr(hist['Date'].dtype, 'tz'):
        hist['Date'] = hist['Date'].dt.tz_convert(None)
         
    hist['Ordinal'] = hist['Date'].map(datetime.toordinal)
    
    X = hist[['Ordinal']].values
    y = hist['Close'].values
    
    from sklearn.linear_model import LinearRegression
    import numpy as np

    regressor = LinearRegression()
    regressor.fit(X, y)

    last_date = hist['Date'].iloc[-1]
    future_dates = [last_date + timedelta(days=30*i) for i in range(1, months+1)]
    future_ordinal = [[d.toordinal()] for d in future_dates]

    predictions = regressor.predict(future_ordinal)
    
    forecast_data = []
    for d, p in zip(future_dates, predictions):
        forecast_data.append({
            "date": d.strftime("%Y-%m-%d"),
            "price": round(p, 2)
        })
        
    return forecast_data


agent = create_agent(
    model = model,
    checkpointer = checkpointer,
    tools = [get_stock_price, get_historical_stock_price, get_balance_sheet, get_stock_news, get_analyst_recommendations, generate_stock_forecast]
)


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

    async def generate():
        # Stream events from the agent
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
                # Stream text content
                chunk = event["data"]["chunk"]
                if chunk.content:
                    yield json.dumps({'type': 'text', 'content': chunk.content}) + '\n'
            
            elif kind == "on_tool_end":
                # Intercept tool outputs for visualization
                tool_name = event["name"]
                output = event["data"].get("output")
                
                if tool_name == "get_historical_stock_price":
                    yield json.dumps({'type': 'chart', 'data': output}) + '\n'
                
                elif tool_name == "generate_stock_forecast":
                     yield json.dumps({'type': 'forecast', 'data': output}) + '\n'

                elif tool_name == "get_analyst_recommendations":
                     yield json.dumps({'type': 'analyst_rating', 'data': output}) + '\n'
                
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
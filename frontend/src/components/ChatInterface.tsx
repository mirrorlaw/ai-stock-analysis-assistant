
import { useState, useRef, useEffect } from 'react';
import { Send, LineChart as ChartIcon, RotateCcw } from 'lucide-react';
import StockChart from './StockChart';
import BalanceSheet from './BalanceSheet';
import AnalystRating from './AnalystRating';
import StockNews from './StockNews';
import ReactMarkdown from 'react-markdown';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    type?: 'text' | 'chart' | 'balance_sheet' | 'analyst_rating' | 'news';
    data?: any;
    forecastData?: any[];
}

const INITIAL_MESSAGE: Message = {
    role: 'assistant',
    content: 'Hello! I can analyze stocks. Try asking "Analyze NVDA balance sheet" or "Show me Apple stock chart".',
};

export default function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const threadIdRef = useRef<string>('thread-' + Date.now());

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // #2: 새 대화 시작 — 메시지 초기화 + 새 threadId 생성
    const handleReset = () => {
        setMessages([INITIAL_MESSAGE]);
        threadIdRef.current = 'thread-' + Date.now();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const newMsg: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, newMsg]);
        setInput('');
        setLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: { content: newMsg.content, role: 'user', id: Date.now().toString() },
                    threadId: threadIdRef.current,
                    responseId: 'resp-' + Date.now()
                })
            });

            // #6: HTTP 에러 응답 처리
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`서버 오류 (${response.status}): ${errorText}`);
            }

            if (!response.body) throw new Error('응답 스트림을 받을 수 없습니다.');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            // #5: 불완전 청크 버퍼링 — 줄바꿈 단위로 완성된 JSON만 파싱
            let buffer = '';

            const processLine = (line: string) => {
                if (!line.trim()) return;
                try {
                    const event = JSON.parse(line);

                    if (event.type === 'text') {
                        setMessages(prev => {
                            const last = prev[prev.length - 1];
                            if (
                                last.role === 'assistant' &&
                                last.type !== 'chart' &&
                                last.type !== 'balance_sheet' &&
                                last.type !== 'analyst_rating' &&
                                last.type !== 'news'
                            ) {
                                return [...prev.slice(0, -1), { ...last, content: last.content + event.content }];
                            } else {
                                return [...prev, { role: 'assistant', content: event.content, type: 'text' }];
                            }
                        });
                    } else if (event.type === 'chart') {
                        setMessages(prev => [...prev, { role: 'assistant', content: '', type: 'chart', data: event.data }]);
                    } else if (event.type === 'balance_sheet') {
                        setMessages(prev => [...prev, { role: 'assistant', content: '', type: 'balance_sheet', data: event.data }]);
                    } else if (event.type === 'analyst_rating') {
                        setMessages(prev => [...prev, { role: 'assistant', content: '', type: 'analyst_rating', data: event.data }]);
                    } else if (event.type === 'news') {
                        setMessages(prev => [...prev, { role: 'assistant', content: '', type: 'news', data: event.data }]);
                    } else if (event.type === 'forecast') {
                        setMessages(prev => {
                            const reversed = [...prev].reverse();
                            const chartIdx = reversed.findIndex(m => m.type === 'chart');
                            if (chartIdx !== -1) {
                                const realIdx = prev.length - 1 - chartIdx;
                                const updated = [...prev];
                                updated[realIdx] = { ...updated[realIdx], forecastData: event.data };
                                return updated;
                            }
                            return [...prev, { role: 'assistant', content: 'Forecast generated (see chart above).', type: 'text' }];
                        });
                    }
                } catch (e) {
                    console.error("Error parsing event", e, line);
                }
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    processLine(line);
                }
            }

            decoder.decode(); // flush
            if (buffer.trim()) processLine(buffer);

        } catch (error) {
            console.error(error);
            const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
            setMessages(prev => [...prev, { role: 'assistant', content: `오류: ${message}` }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-900 text-gray-100 font-sans">
            <header className="p-4 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-600 rounded-lg">
                        <ChartIcon size={20} className="text-white" />
                    </div>
                    <h1 className="text-lg font-bold">AI Stock Analyst</h1>
                </div>
                {/* #2: 새 대화 버튼 */}
                <button
                    onClick={handleReset}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors"
                    title="새 대화 시작"
                >
                    <RotateCcw size={14} />
                    새 대화
                </button>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl p-4 ${msg.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 text-gray-200 border border-gray-700'
                            }`}>
                            {msg.type === 'chart' ? (
                                <StockChart data={msg.data} forecast={msg.forecastData} />
                            ) : msg.type === 'balance_sheet' ? (
                                <BalanceSheet data={msg.data} />
                            ) : msg.type === 'analyst_rating' ? (
                                <AnalystRating data={msg.data} />
                            ) : msg.type === 'news' ? (
                                <StockNews data={msg.data} />
                            ) : (
                                <div className="prose prose-invert prose-sm">
                                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700 flex items-center gap-3">
                            <div className="flex gap-1">
                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.1s]" />
                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                            </div>
                            <span className="text-gray-400 text-sm">답변 준비 중...</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-gray-800 bg-gray-900">
                <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about a stock..."
                        className="w-full bg-gray-800 border-gray-700 text-white rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
                    />
                    <button
                        type="submit"
                        disabled={loading || !input.trim()}
                        className="absolute right-2 top-2 p-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 rounded-lg transition-colors"
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
}

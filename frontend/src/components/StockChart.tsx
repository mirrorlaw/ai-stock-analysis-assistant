import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

interface ForecastData {
    date: string;
    price: number;
}

interface StockChartProps {
    // column-oriented: { 'Close': { ms_timestamp: price, ... }, 'Volume': {...}, ... }
    data: Record<string, Record<string, number>>;
    forecast?: ForecastData[];
}

const StockChart = ({ data, forecast }: StockChartProps) => {
    if (!data) return null;

    const closePrices = data['Close'] || {};
    const volumes = data['Volume'] || {};

    const historyData = Object.entries(closePrices)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([ts, price]) => {
            const timestamp = parseInt(ts);
            return {
                date: !isNaN(timestamp) ? new Date(timestamp).toLocaleDateString() : ts,
                price: price,
                volume: volumes[ts] ?? 0,
                isForecast: false,
            };
        });

    let combinedData: any[] = [];

    if (forecast && forecast.length > 0) {
        const lastHist = historyData[historyData.length - 1];
        const forecastPoints = forecast.map(f => ({
            date: new Date(f.date).toLocaleDateString(),
            forecastPrice: f.price,
            volume: 0,
            isForecast: true,
        }));

        const mappedHistory = historyData.map(d => ({
            date: d.date,
            historicalPrice: d.price,
            volume: d.volume,
        }));

        // 마지막 히스토리 포인트를 브릿지로 사용해 두 선을 연결
        const bridge = {
            date: lastHist.date,
            historicalPrice: lastHist.price,
            forecastPrice: lastHist.price,
            volume: 0,
        };

        combinedData = [...mappedHistory, bridge, ...forecastPoints];
    } else {
        combinedData = historyData.map(d => ({
            date: d.date,
            historicalPrice: d.price,
            volume: d.volume,
        }));
    }

    const formatVolume = (v: number) => `${(v / 1_000_000).toFixed(0)}M`;

    return (
        <div className="w-full bg-gray-900/50 p-4 rounded-lg border border-gray-700 mt-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-400">Price History & Forecast</h3>

            {/* 가격 차트 */}
            <ResponsiveContainer width="100%" height={180}>
                <ComposedChart data={combinedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9CA3AF" fontSize={11} />
                    <YAxis stroke="#9CA3AF" fontSize={11} domain={['auto', 'auto']} />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                        itemStyle={{ color: '#E5E7EB' }}
                    />
                    <Line type="monotone" dataKey="historicalPrice" name="Price" stroke="#60A5FA" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="forecastPrice" name="Forecast" stroke="#10B981" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </ComposedChart>
            </ResponsiveContainer>

            {/* 거래량 서브차트 */}
            <div>
                <p className="text-xs text-gray-500 mb-1">Volume</p>
                <ResponsiveContainer width="100%" height={70}>
                    <ComposedChart data={combinedData}>
                        <XAxis dataKey="date" stroke="#9CA3AF" fontSize={10} />
                        <YAxis stroke="#9CA3AF" fontSize={10} tickFormatter={formatVolume} width={40} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                            itemStyle={{ color: '#E5E7EB' }}
                            formatter={(v: number) => [`${(v / 1_000_000).toFixed(2)}M`, 'Volume']}
                        />
                        <Bar dataKey="volume" name="Volume" fill="#6B7280" opacity={0.7} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default StockChart;

import {
    LineChart,
    Line,
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
    // column-oriented: { 'Close': { ms_timestamp: price, ... }, 'Open': {...}, ... }
    data: Record<string, Record<string, number>>;
    forecast?: ForecastData[];
}

const StockChart = ({ data, forecast }: StockChartProps) => {
    if (!data) return null;

    // data is column-oriented — extract Close prices and sort by timestamp
    const closePrices = data['Close'] || {};
    const historyData = Object.entries(closePrices)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([ts, price]) => {
            const timestamp = parseInt(ts);
            return {
                date: !isNaN(timestamp) ? new Date(timestamp).toLocaleDateString() : ts,
                price: price,
                isForecast: false
            };
        });

    let combinedData: any[] = [...historyData];

    // Append forecast data if available
    if (forecast && forecast.length > 0) {
        // Add last historical point as first forecast point to connect lines
        const lastHist = historyData[historyData.length - 1];

        const forecastPoints = forecast.map(f => ({
            date: new Date(f.date).toLocaleDateString(),
            price: f.price,
            isForecast: true
        }));

        // We can't easily break the line style in a single <Line> without custom dot/segment logic or separate lines.
        // Easiest approach: Two lines. One for history, one for forecast.
        // Forecast line needs to start at last history point.

        // Let's restructure data for recharts: { date, price, forecastPrice }
        // History points have 'price', no 'forecastPrice'.
        // Forecast points have 'forecastPrice', no 'price'.
        // To connect them, the join point should have both?

        // Simpler: Just render one line and ignore dashed style for now, OR use strokeDasharray on the second line.
        // Let's create a separate data structure for the forecast line that includes overlap.

        // Re-map combined data to have separate keys
        const mappedHistory = historyData.map(d => ({ ...d, historicalPrice: d.price }));
        const mappedForecast = forecastPoints.map(d => ({ ...d, forecastPrice: d.price }));

        // Create a bridge point
        const bridge = {
            date: lastHist.date,
            historicalPrice: lastHist.price,
            forecastPrice: lastHist.price,
            isForecast: true // Mark bridge as part of forecast for tooltip/styling if needed
        };

        // Combine all data points
        combinedData = [...mappedHistory, bridge, ...mappedForecast];
    } else {
        // If no forecast, only show historical data, setting historicalPrice
        combinedData = historyData.map(d => ({
            date: d.date,
            historicalPrice: d.price,
            isForecast: d.isForecast
        }));
    }

    return (
        <div className="w-full h-64 bg-gray-900/50 p-4 rounded-lg border border-gray-700 mt-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-2">Price History & Forecast</h3>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={combinedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
                    <YAxis stroke="#9CA3AF" fontSize={12} domain={['auto', 'auto']} />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                        itemStyle={{ color: '#E5E7EB' }}
                    />
                    <Line
                        type="monotone"
                        dataKey="historicalPrice"
                        name="Price"
                        stroke="#60A5FA"
                        strokeWidth={2}
                        dot={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="forecastPrice"
                        name="Forecast"
                        stroke="#10B981"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default StockChart;

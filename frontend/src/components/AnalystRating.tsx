
interface AnalystRatingProps {
    data: any[]; // List of recommendation records
}

const AnalystRating = ({ data }: AnalystRatingProps) => {
    if (!data || data.length === 0) return null;

    // Recent data usually contains 'period', 'strongBuy', 'buy', 'hold', 'sell', 'strongSell'
    // Let's take the most recent period available (usually index 0 if sorted, or look for '0m')
    const latest = data[0];

    const total = (latest.strongBuy || 0) + (latest.buy || 0) + (latest.hold || 0) + (latest.sell || 0) + (latest.strongSell || 0);

    if (total === 0) return <div className="text-gray-400 text-sm">No rating data available</div>;

    const getPercent = (val: number) => ((val || 0) / total) * 100;

    return (
        <div className="w-full bg-gray-900/50 p-4 rounded-lg border border-gray-700 mt-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">Analyst Recommendations ({latest.period})</h3>
            <div className="flex h-4 rounded-full overflow-hidden">
                <div style={{ width: `${getPercent(latest.strongBuy)}%` }} className="bg-green-600" title={`Strong Buy: ${latest.strongBuy}`} />
                <div style={{ width: `${getPercent(latest.buy)}%` }} className="bg-green-500" title={`Buy: ${latest.buy}`} />
                <div style={{ width: `${getPercent(latest.hold)}%` }} className="bg-yellow-500" title={`Hold: ${latest.hold}`} />
                <div style={{ width: `${getPercent(latest.sell)}%` }} className="bg-red-500" title={`Sell: ${latest.sell}`} />
                <div style={{ width: `${getPercent(latest.strongSell)}%` }} className="bg-red-700" title={`Strong Sell: ${latest.strongSell}`} />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-600"></span> Strong Buy</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Buy</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> Hold</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Sell</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-700"></span> Strong Sell</div>
            </div>
        </div>
    );
};

export default AnalystRating;

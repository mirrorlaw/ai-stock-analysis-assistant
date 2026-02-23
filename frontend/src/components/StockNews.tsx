import { ExternalLink } from 'lucide-react';

interface NewsItem {
    title: string;
    publisher?: string;
    link?: string;
    providerPublishTime?: number;
}

interface StockNewsProps {
    data: NewsItem[];
}

const StockNews = ({ data }: StockNewsProps) => {
    if (!data || data.length === 0) return null;

    return (
        <div className="w-full space-y-2 mt-2">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">관련 뉴스</h3>
            {data.slice(0, 5).map((item, i) => (
                <a
                    key={i}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start justify-between gap-2 bg-gray-900/50 border border-gray-700 rounded-lg p-3 hover:border-blue-500 transition-colors group"
                >
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-200 line-clamp-2 group-hover:text-blue-300 transition-colors">
                            {item.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                            {item.publisher && (
                                <span className="text-xs text-blue-400">{item.publisher}</span>
                            )}
                            {item.providerPublishTime && (
                                <span className="text-xs text-gray-500">
                                    {new Date(item.providerPublishTime * 1000).toLocaleDateString()}
                                </span>
                            )}
                        </div>
                    </div>
                    <ExternalLink size={14} className="text-gray-600 group-hover:text-blue-400 transition-colors shrink-0 mt-0.5" />
                </a>
            ))}
        </div>
    );
};

export default StockNews;

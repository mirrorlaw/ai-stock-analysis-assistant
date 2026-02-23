interface BalanceSheetProps {
    data: any;
}

const BalanceSheet = ({ data }: BalanceSheetProps) => {
    if (!data) return null;

    // Handle 'split' orientation from Pandas JSON: { columns: [], index: [], data: [][] }
    let columns: string[] = [];
    let rows: any[] = [];
    let index: string[] = [];

    if (data.columns && data.data) {
        columns = data.columns;
        rows = data.data;
        index = data.index || [];
    } else {
        // Fallback or specific logic if needed
        return <pre className="text-xs text-gray-400 overflow-auto">{JSON.stringify(data, null, 2)}</pre>;
    }

    return (
        <div className="w-full overflow-x-auto mt-4 rounded-lg border border-gray-700 bg-gray-900/50">
            <table className="w-full text-sm text-left text-gray-400">
                <thead className="text-xs text-gray-300 uppercase bg-gray-800">
                    <tr>
                        <th className="px-6 py-3">Metric</th>
                        {columns.map((col, i) => (
                            <th key={i} className="px-6 py-3">{new Date(parseInt(col)).toLocaleDateString()}</th> // Columns usually timestamps
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} className="border-b border-gray-700 hover:bg-gray-800/50">
                            <td className="px-6 py-4 font-medium text-white">{index[i]}</td>
                            {row.map((cell: any, j: number) => (
                                <td key={j} className="px-6 py-4">
                                    {typeof cell === 'number'
                                        ? new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(cell)
                                        : cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default BalanceSheet;

import { Bar, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

interface TrendChartDatum {
  num: string;
  frontFreq: number;
  backFreq: number | null;
}

interface TrendChartProps {
  data: TrendChartDatum[];
}

export default function TrendChart({ data }: TrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" vertical={false} />
        <XAxis dataKey="num" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={0} />
        <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-card)',
            color: 'var(--text-main)',
            borderRadius: '8px',
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="frontFreq" name="前区频次" fill="#ef4444" radius={[4, 4, 0, 0]} opacity={0.8} />
        <Line type="monotone" dataKey="backFreq" name="后区频次" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

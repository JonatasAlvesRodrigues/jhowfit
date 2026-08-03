import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar } from 'recharts'
import type { ChartPoint } from '../types'

export function WeightChart({ data }: { data: ChartPoint[] }) {
  return <div className="chart"><ResponsiveContainer width="100%" height="100%">
    <AreaChart data={data} margin={{ top: 8, right: 4, left: -28, bottom: 0 }}>
      <defs><linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#23d18b" stopOpacity=".32"/><stop offset="100%" stopColor="#23d18b" stopOpacity="0"/></linearGradient></defs>
      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#76807b', fontSize: 11 }} />
      <YAxis domain={['dataMin - 1', 'dataMax + 1']} axisLine={false} tickLine={false} tick={{ fill: '#76807b', fontSize: 10 }} />
      <Tooltip contentStyle={{ background: '#151a17', border: '1px solid #2a322e', borderRadius: 12 }} />
      <Area type="monotone" dataKey="value" stroke="#23d18b" strokeWidth={3} fill="url(#weightFill)" />
    </AreaChart>
  </ResponsiveContainer></div>
}

export function ActivityChart() {
  const data = [{d:'S',v:32},{d:'T',v:56},{d:'Q',v:42},{d:'Q',v:78},{d:'S',v:66},{d:'S',v:90},{d:'D',v:62}]
  return <div className="chart chart--small"><ResponsiveContainer width="100%" height="100%">
    <BarChart data={data}><XAxis dataKey="d" axisLine={false} tickLine={false} tick={{fill:'#76807b',fontSize:11}}/><Tooltip cursor={{fill:'rgba(255,255,255,.03)'}} contentStyle={{display:'none'}}/><Bar dataKey="v" fill="#23d18b" radius={[6,6,6,6]} barSize={18}/></BarChart>
  </ResponsiveContainer></div>
}

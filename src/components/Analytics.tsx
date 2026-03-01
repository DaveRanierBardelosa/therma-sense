import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

interface AnalyticsData {
  time: string;
  temp: number;
  humidity: number;
  heatIndex: number;
}

type Interval = "minute" | "hour" | "day" | "week" | "month";

export function Analytics() {
  const [activeInterval, setActiveInterval] = useState<Interval>("hour");
  const [data, setData] = useState<AnalyticsData[]>([]);
  const [loading, setLoading] = useState(false);

  const intervals: { label: string; value: Interval }[] = [
    { label: "Every Minute", value: "minute" },
    { label: "Every Hour", value: "hour" },
    { label: "Every Day", value: "day" },
    { label: "Every Week", value: "week" },
    { label: "Every Month", value: "month" },
  ];

  useEffect(() => {
    fetchAnalytics();
    // Refresh every 30 seconds
    const interval = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(interval);
  }, [activeInterval]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/telemetry/analytics?interval=${activeInterval}`);
      const analyticsData = await res.json();
      setData(analyticsData);
    } catch (err) {
      console.error("Failed to fetch analytics", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel p-6 rounded-2xl border border-white/10 mb-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-4">Average Analytics</h2>
        
        {/* Interval Tabs */}
        <div className="flex flex-wrap gap-2">
          {intervals.map((interval) => (
            <button
              key={interval.value}
              onClick={() => setActiveInterval(interval.value)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeInterval === interval.value
                  ? "bg-neon-cyan text-navy-900"
                  : "bg-white/10 text-gray-400 hover:text-white"
              }`}
            >
              {interval.label}
            </button>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Temperature Chart */}
        <div className="border border-white/10 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-neon-cyan mb-4">Temperature Average</h3>
          {loading ? (
            <div className="h-48 flex items-center justify-center text-gray-500">Loading...</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  dataKey="time"
                  stroke="rgba(255,255,255,0.5)"
                  style={{ fontSize: "12px" }}
                />
                <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: "12px" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(10, 10, 30, 0.95)",
                    border: "1px solid rgba(0, 255, 255, 0.3)",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "#fff" }}
                />
                <Line
                  type="monotone"
                  dataKey="temp"
                  stroke="#00FFFF"
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Humidity Chart */}
        <div className="border border-white/10 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-neon-purple mb-4">Humidity Average</h3>
          {loading ? (
            <div className="h-48 flex items-center justify-center text-gray-500">Loading...</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  dataKey="time"
                  stroke="rgba(255,255,255,0.5)"
                  style={{ fontSize: "12px" }}
                />
                <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: "12px" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(10, 10, 30, 0.95)",
                    border: "1px solid rgba(168, 85, 247, 0.3)",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "#fff" }}
                />
                <Line
                  type="monotone"
                  dataKey="humidity"
                  stroke="#A855F7"
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Heat Index Chart */}
        <div className="border border-white/10 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-neon-green mb-4">Heat Index Average</h3>
          {loading ? (
            <div className="h-48 flex items-center justify-center text-gray-500">Loading...</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  dataKey="time"
                  stroke="rgba(255,255,255,0.5)"
                  style={{ fontSize: "12px" }}
                />
                <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: "12px" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(10, 10, 30, 0.95)",
                    border: "1px solid rgba(34, 197, 94, 0.3)",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "#fff" }}
                />
                <Line
                  type="monotone"
                  dataKey="heatIndex"
                  stroke="#22C55E"
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Combined View */}
      <div className="mt-6 border border-white/10 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-white mb-4">Combined View</h3>
        {loading ? (
          <div className="h-80 flex items-center justify-center text-gray-500">Loading...</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="time"
                stroke="rgba(255,255,255,0.5)"
                style={{ fontSize: "12px" }}
              />
              <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: "12px" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(10, 10, 30, 0.95)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "#fff" }}
              />
              <Legend wrapperStyle={{ color: "#fff", paddingTop: "20px" }} />
              <Line
                type="monotone"
                dataKey="temp"
                stroke="#00FFFF"
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                strokeWidth={2}
                name="Temp (°C)"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="humidity"
                stroke="#A855F7"
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                strokeWidth={2}
                name="Humidity (%)"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="heatIndex"
                stroke="#22C55E"
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                strokeWidth={2}
                name="Heat Index (°C)"
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

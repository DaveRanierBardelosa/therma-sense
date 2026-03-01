import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { Thermometer, Droplets, AlertTriangle, Activity, Wifi, WifiOff, Bell } from "lucide-react";

const initialData = [
  { time: "10:00", temp: 22.4, humidity: 45 },
  { time: "10:05", temp: 22.6, humidity: 44 },
];

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const WS_URL = import.meta.env.VITE_API_WS_URL || "";

export function DashboardPage() {
  const [data, setData] = useState(initialData);
  const [currentTemp, setCurrentTemp] = useState(22.5);
  const [currentHumidity, setCurrentHumidity] = useState(44);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Track when last data arrived
    let lastDataTime = Date.now();
    let connectionTimeoutId: NodeJS.Timeout | null = null;

    // Fetch initial current data
    fetch(`${API_BASE}/api/telemetry/current`)
      .then(res => res.json())
      .then(initial => {
        if (initial && initial.temp && initial.humidity) {
          setCurrentTemp(initial.temp);
          setCurrentHumidity(initial.humidity);
          lastDataTime = Date.now();
          setIsConnected(true);
          // Clear any pending timeout
          if (connectionTimeoutId) clearTimeout(connectionTimeoutId);
          // Set timeout to mark disconnected after 10 seconds of no data
          connectionTimeoutId = setTimeout(() => {
            setIsConnected(false);
          }, 10000);
        }
      })
      .catch(err => console.error("Failed to fetch initial data", err));

    // Connect to WebSocket
    let wsUrl: string;
    if (WS_URL) {
      wsUrl = WS_URL;
    } else {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = API_BASE ? new URL(API_BASE).host : window.location.host;
      wsUrl = `${protocol}//${host}/api/ws`;
    }
    const ws = new WebSocket(wsUrl);

    let lastWsMessage = Date.now();

    ws.onopen = () => {
      console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "TELEMETRY") {
          lastWsMessage = Date.now();
          lastDataTime = Date.now();
          setIsConnected(true);
          
          // Reset disconnect timeout
          if (connectionTimeoutId) clearTimeout(connectionTimeoutId);
          connectionTimeoutId = setTimeout(() => {
            setIsConnected(false);
          }, 10000);

          const { temp, humidity, timestamp } = message.data;
          setCurrentTemp(temp);
          setCurrentHumidity(humidity);
          
          const date = new Date(timestamp);
          const timeString = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
          
          setData(prev => {
            const last = prev[prev.length - 1];
            if (last && last.time === timeString && last.temp === temp) return prev;
            
            const newData = [...prev, { time: timeString, temp, humidity }];
            // Keep last 20 data points
            if (newData.length > 20) return newData.slice(newData.length - 20);
            return newData;
          });
        }
      } catch (err) {
        console.error("Failed to parse WS message", err);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      setIsConnected(false);
      if (connectionTimeoutId) clearTimeout(connectionTimeoutId);
    };

    // Polling fallback (in case WS is blocked by proxy)
    const pollInterval = setInterval(() => {
      if (Date.now() - lastWsMessage > 6000) {
        fetch(`${API_BASE}/api/telemetry/current`)
          .then(res => res.json())
          .then(data => {
            if (data && data.temp && data.humidity) {
              lastDataTime = Date.now();
              lastWsMessage = Date.now();
              setIsConnected(true);
              
              // Reset disconnect timeout
              if (connectionTimeoutId) clearTimeout(connectionTimeoutId);
              connectionTimeoutId = setTimeout(() => {
                setIsConnected(false);
              }, 10000);
              
              setCurrentTemp(data.temp);
              setCurrentHumidity(data.humidity);
              
              const date = new Date(data.timestamp || Date.now());
              const timeString = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
              
              setData(prev => {
                const last = prev[prev.length - 1];
                if (last && last.time === timeString && last.temp === data.temp) return prev;
                
                const newData = [...prev, { time: timeString, temp: data.temp, humidity: data.humidity }];
                if (newData.length > 20) return newData.slice(newData.length - 20);
                return newData;
              });
            }
          })
          .catch(() => console.error("Poll failed"));
      }
    }, 5000);

    return () => {
      if (connectionTimeoutId) clearTimeout(connectionTimeoutId);
      clearInterval(pollInterval);
      ws.close();
    };
  }, []);

  const heatIndex = Number(
    (
      -8.78469475556 +
      1.61139411 * currentTemp +
      2.33854883889 * currentHumidity -
      0.14611605 * currentTemp * currentHumidity -
      0.012308094 * currentTemp * currentTemp -
      0.0164248277778 * currentHumidity * currentHumidity +
      0.002211732 * currentTemp * currentTemp * currentHumidity +
      0.00072546 * currentTemp * currentHumidity * currentHumidity -
      0.000003582 * currentTemp * currentTemp * currentHumidity * currentHumidity
    ).toFixed(1)
  );

  const getStatus = (hi: number) => {
    if (isNaN(hi)) return { text: "SENSOR ERROR", color: "text-gray-500", bg: "bg-gray-500/10", border: "border-gray-500/30" };
    if (hi < 32.0) return { text: "GOOD", color: "text-neon-green", bg: "bg-neon-green/10", border: "border-neon-green/30" };
    if (hi >= 32.0 && hi < 40.0) return { text: "CAUTION/WARM", color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/30" };
    if (hi >= 40.0 && hi <= 51.0) return { text: "DANGER", color: "text-neon-pink", bg: "bg-neon-pink/10", border: "border-neon-pink/30" };
    return { text: "EXTREME DANGER", color: "text-neon-purple", bg: "bg-neon-purple/10", border: "border-neon-purple/30" };
  };

  const envStatus = getStatus(heatIndex);

  return (
    <DashboardLayout>
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">System Overview</h1>
          <p className="text-gray-400">Real-time monitoring for Zone A-1</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${isConnected ? "bg-neon-green/10 text-neon-green border-neon-green/30" : "bg-red-500/10 text-red-500 border-red-500/30"}`}>
          {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          {isConnected ? "ESP32 Connected" : "ESP32 Disconnected"}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="glass-panel p-6 rounded-2xl border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Thermometer className="w-16 h-16 text-neon-cyan" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-neon-cyan/10 flex items-center justify-center text-neon-cyan">
              <Thermometer className="w-5 h-5" />
            </div>
            <h3 className="text-gray-400 font-medium">Temperature</h3>
          </div>
          <div className="text-4xl font-bold text-white mb-2">{currentTemp}°C</div>
          <div className="text-sm text-neon-green flex items-center gap-1">
            <Activity className="w-4 h-4" /> Stable
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Droplets className="w-16 h-16 text-neon-purple" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-neon-purple/10 flex items-center justify-center text-neon-purple">
              <Droplets className="w-5 h-5" />
            </div>
            <h3 className="text-gray-400 font-medium">Humidity</h3>
          </div>
          <div className="text-4xl font-bold text-white mb-2">{currentHumidity}%</div>
          <div className="text-sm text-neon-green flex items-center gap-1">
            <Activity className="w-4 h-4" /> Optimal
          </div>
        </div>

        <div className={`glass-panel p-6 rounded-2xl border ${isConnected ? envStatus.border : "border-white/10"} relative overflow-hidden transition-colors`}>
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <AlertTriangle className={`w-16 h-16 ${isConnected ? envStatus.color : "text-gray-500"}`} />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-lg ${isConnected ? envStatus.bg : "bg-gray-500/10"} flex items-center justify-center ${isConnected ? envStatus.color : "text-gray-500"}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-gray-400 font-medium">Heat Index</h3>
          </div>
          <div className="text-4xl font-bold text-white mb-2">{heatIndex}°C</div>
          <div className="text-sm text-gray-400">Feels like</div>
        </div>

        <div className={`glass-panel p-6 rounded-2xl border ${isConnected ? envStatus.border : "border-white/10"} relative overflow-hidden transition-colors`}>
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Activity className={`w-16 h-16 ${isConnected ? envStatus.color : "text-gray-500"}`} />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-lg ${isConnected ? envStatus.bg : "bg-gray-500/10"} flex items-center justify-center ${isConnected ? envStatus.color : "text-gray-500"}`}>
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-gray-400 font-medium">Environment Status</h3>
          </div>
          <div className={`text-2xl font-bold mb-2 ${isConnected ? envStatus.color : "text-red-500"}`}>
            {isConnected ? envStatus.text : "OFFLINE"}
          </div>
          <div className="text-sm text-gray-400">
            {isConnected ? "Based on Heat Index" : "Waiting for ESP32..."}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10">
        <h3 className="text-xl font-bold text-white mb-6">Live Telemetry</h3>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="time" stroke="#94a3b8" />
              <YAxis yAxisId="left" stroke="#94a3b8" domain={["dataMin - 2", "dataMax + 2"]} />
              <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" domain={["dataMin - 5", "dataMax + 5"]} />
              <Tooltip 
                contentStyle={{ backgroundColor: "#121826", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                itemStyle={{ color: "#fff" }}
              />
              <Line yAxisId="left" type="monotone" dataKey="temp" name="Temperature (°C)" stroke="var(--color-neon-cyan)" strokeWidth={3} dot={false} activeDot={{ r: 8 }} isAnimationActive={false} />
              <Line yAxisId="right" type="monotone" dataKey="humidity" name="Humidity (%)" stroke="var(--color-neon-purple)" strokeWidth={3} dot={false} activeDot={{ r: 8 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </DashboardLayout>
  );
}


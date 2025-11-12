import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useQueueStats } from '../hooks/useQueueStats';
import { getHealthIcon, getHealthColor } from '../lib/utils';
import { RefreshCw, Clock, CheckCircle, AlertTriangle, XCircle, Loader } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const STATUS_COLORS = {
  pending: '#3b82f6',    // blue
  processing: '#a855f7', // purple
  scheduled: '#8b5cf6',  // violet
  failed: '#ef4444',     // red
  sent: '#10b981',       // green
};

export default function QueueMonitor() {
  const { data: stats, isLoading, error, dataUpdatedAt } = useQueueStats(10000);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-gray-900">Queue Monitor</h2>
        <Card>
          <CardContent className="py-12 text-center">
            <Loader className="w-8 h-8 text-gray-400 mx-auto mb-3 animate-spin" />
            <p className="text-gray-600">Loading queue statistics...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-gray-900">Queue Monitor</h2>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-3" />
            <p className="text-red-800">Failed to load queue statistics</p>
            <p className="text-sm text-red-600 mt-2">
              {(error as any)?.message || 'Unknown error'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const health = stats.health || 'healthy';
  const lastUpdated = new Date(dataUpdatedAt).toLocaleTimeString();

  // Prepare chart data
  const chartData = [
    { name: 'Pending', value: stats.pending, color: STATUS_COLORS.pending },
    { name: 'Processing', value: stats.processing, color: STATUS_COLORS.processing },
    { name: 'Scheduled', value: stats.scheduled, color: STATUS_COLORS.scheduled },
    { name: 'Failed', value: stats.failed, color: STATUS_COLORS.failed },
  ].filter(item => item.value > 0);

  const totalActive = stats.pending + stats.processing + stats.scheduled + stats.failed;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Queue Monitor</h2>
          <p className="text-gray-600 mt-1">Real-time queue health and statistics</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <RefreshCw className="w-4 h-4" />
            <span>Last updated: {lastUpdated}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Auto-refreshes every 10s</p>
        </div>
      </div>

      {/* Health Status */}
      <Card className={health === 'unhealthy' ? 'border-red-300' : health === 'degraded' ? 'border-amber-300' : 'border-green-300'}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">{getHealthIcon(health)}</span>
            <span>System Health</span>
            <Badge variant="outline" className={getHealthColor(health)}>
              {health.toUpperCase()}
            </Badge>
          </CardTitle>
          <CardDescription>
            {health === 'healthy' && 'All systems operational'}
            {health === 'degraded' && 'Some notifications have failed'}
            {health === 'unhealthy' && 'Multiple failures detected, attention required'}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Pending</CardTitle>
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats.pending}</div>
            <p className="text-xs text-gray-500 mt-1">Ready to process</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Processing</CardTitle>
              <Loader className="w-4 h-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{stats.processing}</div>
            <p className="text-xs text-gray-500 mt-1">Currently sending</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Scheduled</CardTitle>
              <Clock className="w-4 h-4 text-violet-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-violet-600">{stats.scheduled}</div>
            <p className="text-xs text-gray-500 mt-1">Future delivery</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Failed</CardTitle>
              <XCircle className="w-4 h-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.failed}</div>
            <p className="text-xs text-gray-500 mt-1">Needs attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Sent (24h)</CardTitle>
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.sent24h}</div>
            <p className="text-xs text-gray-500 mt-1">Last 24 hours</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Queue Distribution</CardTitle>
            <CardDescription>Active notifications by status</CardDescription>
          </CardHeader>
          <CardContent>
            {totalActive > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                  <p>Queue is empty</p>
                  <p className="text-sm mt-1">All notifications processed</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>Key metrics at a glance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Active:</span>
                <span className="text-lg font-bold">{totalActive}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Sent Today:</span>
                <span className="text-lg font-bold text-green-600">{stats.sent24h}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Success Rate:</span>
                <span className="text-lg font-bold">
                  {totalActive + stats.sent24h > 0
                    ? `${Math.round((stats.sent24h / (totalActive + stats.sent24h)) * 100)}%`
                    : 'N/A'}
                </span>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-2">Status Breakdown</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-sm">Pending</span>
                  </div>
                  <span className="font-medium">{stats.pending}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                    <span className="text-sm">Processing</span>
                  </div>
                  <span className="font-medium">{stats.processing}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-violet-500"></div>
                    <span className="text-sm">Scheduled</span>
                  </div>
                  <span className="font-medium">{stats.scheduled}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="text-sm">Failed</span>
                  </div>
                  <span className="font-medium">{stats.failed}</span>
                </div>
              </div>
            </div>

            {stats.failed > 0 && (
              <div className="border-t pt-4">
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <p className="text-sm text-red-800 font-medium">
                    ⚠️ {stats.failed} failed notification{stats.failed !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    Check the Browser tab or use the Manager to retry
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

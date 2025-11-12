import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select } from './ui/select';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { useNotificationsList } from '../hooks/useNotifications';
import { formatDate, formatRelativeTime, getStatusColor, getSeverityColor } from '../lib/utils';
import { Search, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import type { NotificationQueryParams } from '../types/api';

export default function NotificationBrowser() {
  const [filters, setFilters] = useState<NotificationQueryParams>({
    status: '',
    source: '',
    search: '',
    limit: 25,
    offset: 0,
    sort: 'created_at',
    order: 'DESC',
  });

  const { data, isLoading, error } = useNotificationsList(filters);

  const handleFilterChange = (key: keyof NotificationQueryParams, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      offset: 0, // Reset to first page when filters change
    }));
  };

  const handlePageChange = (direction: 'prev' | 'next') => {
    setFilters((prev) => ({
      ...prev,
      offset:
        direction === 'next'
          ? (prev.offset || 0) + (prev.limit || 25)
          : Math.max(0, (prev.offset || 0) - (prev.limit || 25)),
    }));
  };

  const currentPage = Math.floor((filters.offset || 0) / (filters.limit || 25)) + 1;
  const totalPages = data ? Math.ceil(data.total / (filters.limit || 25)) : 0;
  const hasNext = data && (filters.offset || 0) + (filters.limit || 25) < data.total;
  const hasPrev = (filters.offset || 0) > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Notification Browser</h2>
        <p className="text-gray-600 mt-1">Search and filter notification history</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
          <CardDescription>Narrow down your search</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                id="status"
                value={filters.status || ''}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="source">Source</Label>
              <Input
                id="source"
                value={filters.source || ''}
                onChange={(e) => handleFilterChange('source', e.target.value)}
                placeholder="Filter by source..."
              />
            </div>

            <div>
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Input
                  id="search"
                  value={filters.search || ''}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  placeholder="Search messages..."
                  className="pl-10"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <Label htmlFor="limit">Per Page</Label>
              <Select
                id="limit"
                value={filters.limit?.toString() || '25'}
                onChange={(e) => handleFilterChange('limit', parseInt(e.target.value, 10))}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </Select>
            </div>
          </div>

          {/* Results Summary */}
          {data && (
            <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
              <span>
                Showing {(filters.offset || 0) + 1} -{' '}
                {Math.min((filters.offset || 0) + (filters.limit || 25), data.total)} of{' '}
                {data.total} notifications
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setFilters({
                    status: '',
                    source: '',
                    search: '',
                    limit: 25,
                    offset: 0,
                    sort: 'created_at',
                    order: 'DESC',
                  })
                }
              >
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600">Loading notifications...</p>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-6 text-center">
            <p className="text-red-800">Failed to load notifications</p>
            <p className="text-sm text-red-600 mt-1">
              {(error as any).response?.data?.error || (error as any).message}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results Table */}
      {data && data.notifications.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Source
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Message
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Severity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.notifications.map((notification) => (
                    <tr key={notification.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        #{notification.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge className={getStatusColor(notification.status)}>
                          {notification.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {notification.source}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-md truncate">
                        {notification.title && (
                          <div className="font-medium">{notification.title}</div>
                        )}
                        <div className={notification.title ? 'text-gray-600' : ''}>
                          {notification.message}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge className={getSeverityColor(notification.severity)}>
                          {notification.severity}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div>{formatDate(notification.created_at).split(', ')[0]}</div>
                        <div className="text-xs text-gray-500">
                          {formatRelativeTime(notification.created_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // Navigate to manager with this ID
                            // In a real app, we'd use router here
                            window.scrollTo(0, 0);
                          }}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {data && data.notifications.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No notifications found matching your filters</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() =>
                setFilters({
                  status: '',
                  source: '',
                  search: '',
                  limit: 25,
                  offset: 0,
                  sort: 'created_at',
                  order: 'DESC',
                })
              }
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {data && data.notifications.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange('prev')}
              disabled={!hasPrev}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange('next')}
              disabled={!hasNext}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { useNotification, useCancelNotification, useRetryNotification } from '../hooks/useNotifications';
import { formatDate, formatRelativeTime, getStatusColor, getSeverityColor } from '../lib/utils';
import { Search, X, RotateCcw, ExternalLink, AlertCircle } from 'lucide-react';

export default function NotificationManager() {
  const [notificationId, setNotificationId] = useState<string>('');
  const [searchedId, setSearchedId] = useState<number | null>(null);

  const { data: notification, isLoading, error, refetch } = useNotification(searchedId);
  const cancelMutation = useCancelNotification();
  const retryMutation = useRetryNotification();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(notificationId, 10);
    if (!isNaN(id)) {
      setSearchedId(id);
    }
  };

  const handleCancel = async () => {
    if (searchedId && notification) {
      try {
        await cancelMutation.mutateAsync(searchedId);
        refetch();
      } catch (err) {
        console.error('Cancel failed:', err);
      }
    }
  };

  const handleRetry = async () => {
    if (searchedId && notification) {
      try {
        await retryMutation.mutateAsync(searchedId);
        refetch();
      } catch (err) {
        console.error('Retry failed:', err);
      }
    }
  };

  const canCancel = notification && ['pending', 'scheduled'].includes(notification.status);
  const canRetry = notification && notification.status === 'failed';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Notification Manager</h2>
        <p className="text-gray-600 mt-1">Search and manage individual notifications</p>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search Notification</CardTitle>
          <CardDescription>Enter a notification ID to view details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-1">
              <Input
                type="number"
                value={notificationId}
                onChange={(e) => setNotificationId(e.target.value)}
                placeholder="Enter notification ID"
                min="1"
              />
            </div>
            <Button type="submit">
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600">Loading notification...</p>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <CardTitle className="text-lg text-red-900">Error</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-800">
              {(error as any).response?.data?.error || 'Failed to load notification'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Notification Details */}
      {notification && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Notification #{notification.id}</CardTitle>
                  <CardDescription>Created {formatRelativeTime(notification.created_at)}</CardDescription>
                </div>
                <Badge className={getStatusColor(notification.status)}>
                  {notification.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-600">Source</Label>
                  <p className="font-medium">{notification.source}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Severity</Label>
                  <Badge className={getSeverityColor(notification.severity)}>
                    {notification.severity}
                  </Badge>
                </div>
              </div>

              {notification.title && (
                <div>
                  <Label className="text-gray-600">Title</Label>
                  <p className="font-medium">{notification.title}</p>
                </div>
              )}

              <div>
                <Label className="text-gray-600">Message</Label>
                <p className="text-sm bg-gray-50 p-3 rounded border">{notification.message}</p>
              </div>

              {/* Timeline */}
              <div className="border-t pt-4">
                <Label className="text-gray-600 mb-2 block">Timeline</Label>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Created:</span>
                    <span className="font-medium">{formatDate(notification.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Scheduled For:</span>
                    <span className="font-medium">{formatDate(notification.scheduled_for)}</span>
                  </div>
                  {notification.sent_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Sent At:</span>
                      <span className="font-medium">{formatDate(notification.sent_at)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Retry Info */}
              {notification.retry_count > 0 && (
                <div className="border-t pt-4">
                  <Label className="text-gray-600 mb-2 block">Retry Information</Label>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Retry Count:</span>
                      <span className="font-medium">
                        {notification.retry_count} / {notification.max_retries}
                      </span>
                    </div>
                    {notification.last_error && (
                      <div>
                        <span className="text-gray-600">Last Error:</span>
                        <p className="text-red-600 bg-red-50 p-2 rounded mt-1">
                          {notification.last_error}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Discord Link */}
              {notification.discord_message_id && (
                <div className="border-t pt-4">
                  <Label className="text-gray-600 mb-2 block">Discord</Label>
                  <div className="flex items-center gap-2">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded flex-1">
                      Message ID: {notification.discord_message_id}
                    </code>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="border-t pt-4 flex gap-2">
                <Button variant="outline" onClick={() => refetch()}>
                  Refresh
                </Button>
                {canCancel && (
                  <Button
                    variant="destructive"
                    onClick={handleCancel}
                    disabled={cancelMutation.isPending}
                  >
                    <X className="w-4 h-4 mr-2" />
                    {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Notification'}
                  </Button>
                )}
                {canRetry && (
                  <Button
                    onClick={handleRetry}
                    disabled={retryMutation.isPending}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {retryMutation.isPending ? 'Retrying...' : 'Retry Now'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Raw JSON */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Raw JSON</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-4 rounded text-xs overflow-x-auto">
                {JSON.stringify(notification, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!notification && !isLoading && !error && searchedId !== null && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600">No notification found with ID {searchedId}</p>
          </CardContent>
        </Card>
      )}

      {!searchedId && !isLoading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">Enter a notification ID above to get started</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

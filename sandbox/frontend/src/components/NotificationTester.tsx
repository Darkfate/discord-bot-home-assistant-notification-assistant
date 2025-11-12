import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Select } from './ui/select';
import { Badge } from './ui/badge';
import { useCreateNotification } from '../hooks/useNotifications';
import { generateSignature } from '../lib/signature';
import { Copy, Send, AlertCircle, CheckCircle } from 'lucide-react';
import type { NotificationCreateRequest } from '../types/api';

const PRESETS = {
  immediate: {
    source: 'Home Assistant',
    title: 'Test Notification',
    message: 'This is an immediate test notification',
    severity: 'info' as const,
    scheduled_for: '',
  },
  scheduled_5m: {
    source: 'Home Assistant',
    title: 'Scheduled Test',
    message: 'This notification was scheduled 5 minutes ago',
    severity: 'info' as const,
    scheduled_for: '5m',
  },
  warning: {
    source: 'Security System',
    title: 'Motion Detected',
    message: 'Motion detected at front door',
    severity: 'warning' as const,
    scheduled_for: '',
  },
  error: {
    source: 'System Monitor',
    title: 'Critical Error',
    message: 'Database connection failed',
    severity: 'error' as const,
    scheduled_for: '',
  },
};

export default function NotificationTester() {
  const [formData, setFormData] = useState<NotificationCreateRequest>(PRESETS.immediate);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [useSignature, setUseSignature] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateNotification();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResponse(null);

    try {
      const data: NotificationCreateRequest = {
        source: formData.source,
        message: formData.message,
      };

      if (formData.title) data.title = formData.title;
      if (formData.severity) data.severity = formData.severity;
      if (formData.scheduled_for) data.scheduled_for = formData.scheduled_for;

      const signature = useSignature && webhookSecret
        ? generateSignature(data, webhookSecret)
        : undefined;

      const result = await createMutation.mutateAsync({ data, signature });
      setResponse(result);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to send notification');
    }
  };

  const handlePreset = (presetKey: keyof typeof PRESETS) => {
    setFormData(PRESETS[presetKey]);
    setResponse(null);
    setError(null);
  };

  const copySignature = () => {
    const signature = generateSignature(formData, webhookSecret);
    navigator.clipboard.writeText(signature);
  };

  const copyCurl = () => {
    const data = {
      source: formData.source,
      message: formData.message,
      ...(formData.title && { title: formData.title }),
      ...(formData.severity && { severity: formData.severity }),
      ...(formData.scheduled_for && { scheduled_for: formData.scheduled_for }),
    };

    const signature = useSignature && webhookSecret
      ? generateSignature(data, webhookSecret)
      : null;

    const curl = `curl -X POST http://localhost:5000/webhook/notify \\
  -H "Content-Type: application/json" \\
  ${signature ? `-H "X-Webhook-Signature: ${signature}" \\\n  ` : ''}-d '${JSON.stringify(data, null, 2)}'`;

    navigator.clipboard.writeText(curl);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Notification Tester</h2>
        <p className="text-gray-600 mt-1">Test webhook notifications with various configurations</p>
      </div>

      {/* Presets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Presets</CardTitle>
          <CardDescription>Load common test scenarios</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.keys(PRESETS).map((key) => (
              <Button
                key={key}
                variant="outline"
                size="sm"
                onClick={() => handlePreset(key as keyof typeof PRESETS)}
              >
                {key.replace('_', ' ')}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Notification Form</CardTitle>
            <CardDescription>Configure your test notification</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="source">Source *</Label>
                <Input
                  id="source"
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  placeholder="Home Assistant"
                  required
                />
              </div>

              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Notification Title"
                />
              </div>

              <div>
                <Label htmlFor="message">Message *</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Notification message..."
                  rows={4}
                  required
                />
              </div>

              <div>
                <Label htmlFor="severity">Severity</Label>
                <Select
                  id="severity"
                  value={formData.severity || 'info'}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="scheduled_for">Schedule For</Label>
                <Input
                  id="scheduled_for"
                  value={formData.scheduled_for || ''}
                  onChange={(e) => setFormData({ ...formData, scheduled_for: e.target.value })}
                  placeholder="5m, 2h, 1d, or ISO date"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty for immediate, or use: 5m, 2h, 1d, ISO 8601 date
                </p>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="useSignature"
                    checked={useSignature}
                    onChange={(e) => setUseSignature(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="useSignature">Use HMAC Signature</Label>
                </div>
                {useSignature && (
                  <div className="space-y-2">
                    <Input
                      value={webhookSecret}
                      onChange={(e) => setWebhookSecret(e.target.value)}
                      placeholder="Webhook secret"
                      type="password"
                    />
                    {webhookSecret && (
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-gray-100 px-2 py-1 rounded text-xs overflow-hidden">
                          {generateSignature(formData, webhookSecret).substring(0, 40)}...
                        </code>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={copySignature}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                  <Send className="w-4 h-4 mr-2" />
                  {createMutation.isPending ? 'Sending...' : 'Send Notification'}
                </Button>
                <Button type="button" variant="outline" onClick={copyCurl}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Response */}
        <div className="space-y-6">
          {response && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <CardTitle className="text-lg text-green-900">Success</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-green-900">Notification ID:</span>
                    <Badge>{response.notification_id}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-green-900">Status:</span>
                    <Badge variant="secondary">{response.status}</Badge>
                  </div>
                  {response.scheduled_for && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-green-900">Scheduled For:</span>
                        <span className="text-sm text-green-800">{response.scheduled_for}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-green-900">Scheduled In:</span>
                        <span className="text-sm text-green-800">{response.scheduled_in}</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="mt-4">
                  <pre className="bg-white p-3 rounded border border-green-200 text-xs overflow-x-auto">
                    {JSON.stringify(response, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <CardTitle className="text-lg text-red-900">Error</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-red-800">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Request Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Request Preview</CardTitle>
              <CardDescription>JSON payload that will be sent</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                {JSON.stringify(
                  {
                    source: formData.source,
                    message: formData.message,
                    ...(formData.title && { title: formData.title }),
                    ...(formData.severity && { severity: formData.severity }),
                    ...(formData.scheduled_for && { scheduled_for: formData.scheduled_for }),
                  },
                  null,
                  2
                )}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

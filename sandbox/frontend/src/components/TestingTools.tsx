import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { useCreateNotification } from '../hooks/useNotifications';
import { generateSignature } from '../lib/signature';
import { Zap, Copy, Play, Loader } from 'lucide-react';

const PRESET_TEMPLATES = [
  {
    name: 'Immediate Info',
    data: { source: 'Test', message: 'Immediate info notification', severity: 'info' as const },
  },
  {
    name: '5 Min Scheduled',
    data: { source: 'Test', message: 'Scheduled for 5 minutes', severity: 'info' as const, scheduled_for: '5m' },
  },
  {
    name: 'Warning',
    data: { source: 'Test', message: 'Warning notification test', severity: 'warning' as const },
  },
  {
    name: 'Error',
    data: { source: 'Test', message: 'Error notification test', severity: 'error' as const },
  },
  {
    name: 'Long Message',
    data: {
      source: 'Test',
      message: 'This is a very long message that contains a lot of text to test how the system handles longer notification content. '.repeat(5),
      severity: 'info' as const,
    },
  },
];

export default function TestingTools() {
  const [batchCount, setBatchCount] = useState(5);
  const [batchDelay, setBatchDelay] = useState(1000);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [signaturePayload, setSignaturePayload] = useState('{\n  "source": "Test",\n  "message": "Test message"\n}');
  const [signatureSecret, setSignatureSecret] = useState('');
  const [calculatedSignature, setCalculatedSignature] = useState('');

  const createMutation = useCreateNotification();

  const handleBatchSend = async () => {
    setBatchRunning(true);
    setBatchProgress(0);

    for (let i = 0; i < batchCount; i++) {
      try {
        const randomTemplate = PRESET_TEMPLATES[Math.floor(Math.random() * PRESET_TEMPLATES.length)];
        await createMutation.mutateAsync({
          data: {
            ...randomTemplate.data,
            message: `${randomTemplate.data.message} #${i + 1}`,
          },
        });
        setBatchProgress(i + 1);
        if (i < batchCount - 1) {
          await new Promise((resolve) => setTimeout(resolve, batchDelay));
        }
      } catch (err) {
        console.error(`Failed to send notification ${i + 1}:`, err);
      }
    }

    setBatchRunning(false);
  };

  const calculateSignature = () => {
    try {
      const payload = JSON.parse(signaturePayload);
      const signature = generateSignature(payload, signatureSecret);
      setCalculatedSignature(signature);
    } catch (err) {
      setCalculatedSignature('Invalid JSON payload');
    }
  };

  const copySignature = () => {
    navigator.clipboard.writeText(calculatedSignature);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Testing Tools</h2>
        <p className="text-gray-600 mt-1">Advanced utilities for testing and debugging</p>
      </div>

      {/* Preset Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Quick Test Presets
          </CardTitle>
          <CardDescription>Send common test scenarios instantly</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {PRESET_TEMPLATES.map((template, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() =>
                  createMutation.mutate({
                    data: template.data,
                  })
                }
                disabled={createMutation.isPending}
              >
                {template.name}
              </Button>
            ))}
          </div>
          {createMutation.isSuccess && (
            <p className="text-sm text-green-600 mt-3">✓ Notification sent successfully!</p>
          )}
          {createMutation.isError && (
            <p className="text-sm text-red-600 mt-3">✗ Failed to send notification</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Batch Sender */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Batch Sender</CardTitle>
            <CardDescription>Send multiple notifications for testing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="batchCount">Number of Notifications</Label>
              <Input
                id="batchCount"
                type="number"
                value={batchCount}
                onChange={(e) => setBatchCount(parseInt(e.target.value, 10))}
                min="1"
                max="100"
              />
            </div>

            <div>
              <Label htmlFor="batchDelay">Delay Between Sends (ms)</Label>
              <Input
                id="batchDelay"
                type="number"
                value={batchDelay}
                onChange={(e) => setBatchDelay(parseInt(e.target.value, 10))}
                min="0"
                max="10000"
                step="100"
              />
            </div>

            {batchRunning && (
              <div>
                <Label>Progress</Label>
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${(batchProgress / batchCount) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {batchProgress} / {batchCount} sent
                  </p>
                </div>
              </div>
            )}

            <Button
              onClick={handleBatchSend}
              disabled={batchRunning}
              className="w-full"
            >
              {batchRunning ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Batch Send
                </>
              )}
            </Button>

            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
              <p className="text-amber-800">
                <strong>Note:</strong> This will send {batchCount} notifications with random
                templates. Use with caution!
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Signature Calculator */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">HMAC Signature Calculator</CardTitle>
            <CardDescription>Generate webhook signatures for testing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="signaturePayload">Payload (JSON)</Label>
              <Textarea
                id="signaturePayload"
                value={signaturePayload}
                onChange={(e) => setSignaturePayload(e.target.value)}
                rows={8}
                placeholder='{"source":"Test","message":"Test message"}'
                className="font-mono text-sm"
              />
            </div>

            <div>
              <Label htmlFor="signatureSecret">Webhook Secret</Label>
              <Input
                id="signatureSecret"
                type="password"
                value={signatureSecret}
                onChange={(e) => setSignatureSecret(e.target.value)}
                placeholder="Enter webhook secret"
              />
            </div>

            <Button onClick={calculateSignature} className="w-full">
              Calculate Signature
            </Button>

            {calculatedSignature && (
              <div>
                <Label>Signature</Label>
                <div className="flex gap-2 mt-1">
                  <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-xs break-all">
                    {calculatedSignature}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copySignature}
                    disabled={calculatedSignature === 'Invalid JSON payload'}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
              <p className="text-blue-800">
                <strong>Usage:</strong> Include the signature in the{' '}
                <code className="bg-blue-100 px-1 rounded">X-Webhook-Signature</code> header when
                making webhook requests.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stress Testing Info */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="text-lg text-yellow-900">Stress Testing</CardTitle>
          <CardDescription className="text-yellow-700">
            For load testing and performance analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-yellow-800">
            <p>
              <strong>Recommended Test Scenarios:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>10 notifications with 1000ms delay - Basic queue testing</li>
              <li>50 notifications with 100ms delay - High throughput testing</li>
              <li>100 notifications with 0ms delay - Maximum stress testing</li>
            </ul>
            <p className="mt-3">
              <strong>Monitor:</strong> Use the Queue Monitor tab to observe system behavior under load.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

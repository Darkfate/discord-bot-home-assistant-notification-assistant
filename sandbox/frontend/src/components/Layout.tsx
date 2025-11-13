import { useState } from 'react';
import { Send, Search, BarChart3, History, FlaskConical } from 'lucide-react';
import NotificationTester from './NotificationTester';
import NotificationManager from './NotificationManager';
import QueueMonitor from './QueueMonitor';
import NotificationBrowser from './NotificationBrowser';
import TestingTools from './TestingTools';

type View = 'tester' | 'manager' | 'monitor' | 'browser' | 'tools';

export default function Layout() {
  const [currentView, setCurrentView] = useState<View>('tester');

  const menuItems = [
    { id: 'tester' as View, label: 'Notification Tester', icon: Send },
    { id: 'manager' as View, label: 'Manager', icon: Search },
    { id: 'monitor' as View, label: 'Queue Monitor', icon: BarChart3 },
    { id: 'browser' as View, label: 'Browser', icon: History },
    { id: 'tools' as View, label: 'Testing Tools', icon: FlaskConical },
  ];

  const renderView = () => {
    switch (currentView) {
      case 'tester':
        return <NotificationTester />;
      case 'manager':
        return <NotificationManager />;
      case 'monitor':
        return <QueueMonitor />;
      case 'browser':
        return <NotificationBrowser />;
      case 'tools':
        return <TestingTools />;
      default:
        return <NotificationTester />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Discord Bot Sandbox
            </h1>
            <p className="text-sm text-gray-500">
              Webhook Testing Interface
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600">Bot Connected</span>
            </div>
            <a
              href="https://github.com/Darkfate/discord-bot-home-assistant-notification-assistant"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              GitHub
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-73px)]">
          <nav className="p-4 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-8">
          {renderView()}
        </main>
      </div>
    </div>
  );
}

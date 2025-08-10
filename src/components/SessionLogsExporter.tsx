import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Download, Copy, Bug } from 'lucide-react';
import { toast } from 'sonner';

interface SessionLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: string;
  message: string;
  data?: any;
}

interface SessionLogsExporterProps {
  trigger?: React.ReactNode;
}

export const SessionLogsExporter: React.FC<SessionLogsExporterProps> = ({
  trigger
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [isCollecting, setIsCollecting] = useState(false);

  const collectSessionLogs = () => {
    setIsCollecting(true);
    
    try {
      const sessionLogs: SessionLog[] = [];
      
      // Collect browser console logs (if available)
      const consoleLogs = getConsoleLogs();
      sessionLogs.push(...consoleLogs);
      
      // Collect network requests from performance API
      const networkLogs = getNetworkLogs();
      sessionLogs.push(...networkLogs);
      
      // Collect React error boundary logs
      const errorLogs = getErrorLogs();
      sessionLogs.push(...errorLogs);
      
      // Collect local storage debug info
      const debugInfo = getDebugInfo();
      sessionLogs.push(...debugInfo);
      
      // Sort by timestamp
      sessionLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      setLogs(sessionLogs);
      toast.success('Session logs collected successfully');
    } catch (error) {
      console.error('Error collecting logs:', error);
      toast.error('Failed to collect session logs');
    } finally {
      setIsCollecting(false);
    }
  };

  const getConsoleLogs = (): SessionLog[] => {
    // In a real implementation, you'd need to capture console logs
    // This is a simplified version
    const storedLogs = localStorage.getItem('app_console_logs');
    if (!storedLogs) return [];
    
    try {
      return JSON.parse(storedLogs);
    } catch {
      return [];
    }
  };

  const getNetworkLogs = (): SessionLog[] => {
    const logs: SessionLog[] = [];
    
    try {
      const entries = performance.getEntriesByType('navigation').concat(
        performance.getEntriesByType('resource')
      );
      
      entries.forEach((entry: any) => {
        if (entry.name && (entry.name.includes('supabase') || entry.name.includes('api'))) {
          logs.push({
            timestamp: new Date(performance.timeOrigin + entry.startTime).toISOString(),
            level: entry.responseStatus >= 400 ? 'error' : 'info',
            category: 'network',
            message: `${entry.initiatorType?.toUpperCase() || 'REQUEST'} ${entry.name}`,
            data: {
              duration: entry.duration,
              responseStatus: entry.responseStatus,
              transferSize: entry.transferSize
            }
          });
        }
      });
    } catch (error) {
      console.error('Error collecting network logs:', error);
    }
    
    return logs;
  };

  const getErrorLogs = (): SessionLog[] => {
    const storedErrors = localStorage.getItem('app_error_logs');
    if (!storedErrors) return [];
    
    try {
      return JSON.parse(storedErrors);
    } catch {
      return [];
    }
  };

  const getDebugInfo = (): SessionLog[] => {
    const logs: SessionLog[] = [];
    
    // Browser info
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      category: 'system',
      message: 'Browser Information',
      data: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine
      }
    });
    
    // Screen info
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      category: 'system',
      message: 'Screen Information',
      data: {
        width: screen.width,
        height: screen.height,
        pixelRatio: window.devicePixelRatio,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      }
    });
    
    // Local storage info
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      category: 'storage',
      message: 'Local Storage Keys',
      data: {
        keys: Object.keys(localStorage),
        sessionKeys: Object.keys(sessionStorage)
      }
    });
    
    // URL and routing info
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      category: 'routing',
      message: 'Current Location',
      data: {
        href: window.location.href,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash
      }
    });
    
    return logs;
  };

  const formatLogsAsText = (): string => {
    const header = `Session Logs Export
Generated: ${new Date().toISOString()}
User Agent: ${navigator.userAgent}
URL: ${window.location.href}

===========================================

`;
    
    const logEntries = logs.map(log => {
      let entry = `[${log.timestamp}] ${log.level.toUpperCase()} ${log.category}: ${log.message}`;
      
      if (log.data) {
        entry += `\nData: ${JSON.stringify(log.data, null, 2)}`;
      }
      
      return entry;
    }).join('\n\n');
    
    return header + logEntries;
  };

  const copyToClipboard = async () => {
    try {
      const logText = formatLogsAsText();
      await navigator.clipboard.writeText(logText);
      toast.success('Logs copied to clipboard');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast.error('Failed to copy logs');
    }
  };

  const downloadLogs = () => {
    try {
      const logText = formatLogsAsText();
      const blob = new Blob([logText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `session-logs-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Logs downloaded successfully');
    } catch (error) {
      console.error('Error downloading logs:', error);
      toast.error('Failed to download logs');
    }
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Bug className="w-4 h-4 mr-2" />
      Export Session Logs
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Session Logs Export</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={collectSessionLogs} 
              disabled={isCollecting}
              variant="default"
            >
              {isCollecting ? 'Collecting...' : 'Collect Logs'}
            </Button>
            
            {logs.length > 0 && (
              <>
                <Button onClick={copyToClipboard} variant="outline">
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
                
                <Button onClick={downloadLogs} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </>
            )}
          </div>
          
          {logs.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Collected {logs.length} log entries
              </div>
              
              <Textarea
                value={formatLogsAsText()}
                readOnly
                className="h-96 text-xs font-mono"
                placeholder="Click 'Collect Logs' to gather session information..."
              />
            </div>
          )}
          
          {logs.length === 0 && !isCollecting && (
            <div className="text-center py-8 text-muted-foreground">
              <Bug className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Click "Collect Logs" to gather session debugging information</p>
              <p className="text-sm mt-2">
                This will collect browser console logs, network requests, errors, and system information
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Global error tracking
export const initializeErrorLogging = () => {
  // Track console errors
  const originalError = console.error;
  console.error = (...args) => {
    const errorLogs = JSON.parse(localStorage.getItem('app_error_logs') || '[]');
    errorLogs.push({
      timestamp: new Date().toISOString(),
      level: 'error',
      category: 'console',
      message: args.join(' '),
      data: { args }
    });
    
    // Keep only last 100 errors
    if (errorLogs.length > 100) {
      errorLogs.splice(0, errorLogs.length - 100);
    }
    
    localStorage.setItem('app_error_logs', JSON.stringify(errorLogs));
    originalError.apply(console, args);
  };
  
  // Track unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const errorLogs = JSON.parse(localStorage.getItem('app_error_logs') || '[]');
    errorLogs.push({
      timestamp: new Date().toISOString(),
      level: 'error',
      category: 'promise',
      message: `Unhandled Promise Rejection: ${event.reason}`,
      data: { reason: event.reason }
    });
    
    localStorage.setItem('app_error_logs', JSON.stringify(errorLogs));
  });
  
  // Track JavaScript errors
  window.addEventListener('error', (event) => {
    const errorLogs = JSON.parse(localStorage.getItem('app_error_logs') || '[]');
    errorLogs.push({
      timestamp: new Date().toISOString(),
      level: 'error',
      category: 'javascript',
      message: `${event.message} at ${event.filename}:${event.lineno}:${event.colno}`,
      data: {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.toString()
      }
    });
    
    localStorage.setItem('app_error_logs', JSON.stringify(errorLogs));
  });
};

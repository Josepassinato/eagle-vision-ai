import React from 'react';
import { ONVIFBridge } from '@/components/ONVIFBridge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Network, Settings, Navigation } from 'lucide-react';

const ONVIFManager: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">ONVIF Camera Manager</h1>
        <p className="text-muted-foreground mt-2">
          Discover, configure, and control ONVIF cameras on your network
        </p>
      </div>

      {/* Feature Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Network className="h-8 w-8 text-blue-500" />
              <div>
                <h3 className="font-semibold">Discovery</h3>
                <p className="text-sm text-muted-foreground">Auto-detect ONVIF cameras</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Camera className="h-8 w-8 text-green-500" />
              <div>
                <h3 className="font-semibold">Profiles</h3>
                <p className="text-sm text-muted-foreground">Stream & configuration</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Settings className="h-8 w-8 text-orange-500" />
              <div>
                <h3 className="font-semibold">Authentication</h3>
                <p className="text-sm text-muted-foreground">Secure camera access</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Navigation className="h-8 w-8 text-purple-500" />
              <div>
                <h3 className="font-semibold">PTZ Control</h3>
                <p className="text-sm text-muted-foreground">Pan, tilt, zoom control</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main ONVIF Bridge Component */}
      <ONVIFBridge />

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Start Guide</CardTitle>
          <CardDescription>Follow these steps to set up ONVIF cameras</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                1
              </div>
              <div>
                <h4 className="font-semibold">Discover Cameras</h4>
                <p className="text-sm text-muted-foreground">
                  Use the Discovery tab to scan your network for ONVIF-compatible cameras. 
                  The service will automatically detect local network ranges or you can specify a custom range.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                2
              </div>
              <div>
                <h4 className="font-semibold">Authenticate</h4>
                <p className="text-sm text-muted-foreground">
                  Select a discovered camera and enter the credentials in the Authentication tab. 
                  Test the connection to verify access and retrieve camera capabilities.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                3
              </div>
              <div>
                <h4 className="font-semibold">Configure Profiles</h4>
                <p className="text-sm text-muted-foreground">
                  View stream profiles, resolutions, and RTSP URLs in the Profiles tab. 
                  This information is used to configure cameras in the main Eagle Vision system.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                4
              </div>
              <div>
                <h4 className="font-semibold">PTZ Control</h4>
                <p className="text-sm text-muted-foreground">
                  For PTZ cameras, use the PTZ Control tab to test movement, zoom, and presets. 
                  You can create, navigate to, and manage PTZ preset positions.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ONVIFManager;
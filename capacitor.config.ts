import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.bbc6b6adb59147dd977742f2f4bf6fef',
  appName: 'eagle-vision-ai',
  webDir: 'dist',
  server: {
    url: "https://bbc6b6ad-b591-47dd-9777-42f2f4bf6fef.lovableproject.com?forceHideBadge=true",
    cleartext: true
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
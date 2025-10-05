import React from 'react';
import TechnicalTestingDashboard from '@/components/TechnicalTestingDashboard';
import GoogleAPITester from '@/components/GoogleAPITester';
import VertexAIAnalyzer from '@/components/VertexAIAnalyzer';
import DirectRTSPTester from '@/components/DirectRTSPTester';

export default function TechnicalTesting() {
  return (
    <div className="space-y-6">
      <DirectRTSPTester />
      <GoogleAPITester />
      <VertexAIAnalyzer />
      <TechnicalTestingDashboard />
    </div>
  );
}
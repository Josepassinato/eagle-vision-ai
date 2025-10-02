import React from 'react';
import TechnicalTestingDashboard from '@/components/TechnicalTestingDashboard';
import GoogleAPITester from '@/components/GoogleAPITester';
import VertexAIAnalyzer from '@/components/VertexAIAnalyzer';

export default function TechnicalTesting() {
  return (
    <div className="space-y-6">
      <GoogleAPITester />
      <VertexAIAnalyzer />
      <TechnicalTestingDashboard />
    </div>
  );
}
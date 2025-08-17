import React from 'react';
import TechnicalTestingDashboard from '@/components/TechnicalTestingDashboard';
import GoogleAPITester from '@/components/GoogleAPITester';

export default function TechnicalTesting() {
  return (
    <div className="space-y-6">
      <GoogleAPITester />
      <TechnicalTestingDashboard />
    </div>
  );
}
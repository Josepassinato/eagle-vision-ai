import React from 'react';
import { Helmet } from 'react-helmet-async';
import DVRAnalyticsSetup from '@/components/DVRAnalyticsSetup';

const DVRAnalytics: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>DVR Analytics - Eagle Vision</title>
        <meta name="description" content="Configure analytics services for connected DVR systems" />
      </Helmet>
      
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">DVR Analytics</h1>
          <p className="text-muted-foreground mt-2">
            Configure e gerencie os serviços de análise para seus DVRs conectados
          </p>
        </div>
        
        <DVRAnalyticsSetup />
      </div>
    </>
  );
};

export default DVRAnalytics;
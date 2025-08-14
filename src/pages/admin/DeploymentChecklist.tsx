import React from 'react';
import { Helmet } from 'react-helmet-async';
import DeploymentChecklist from '@/components/DeploymentChecklist';

const DeploymentChecklistPage: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Deployment Checklist - Eagle Vision</title>
        <meta name="description" content="Operational deployment checklist for production environment" />
      </Helmet>
      
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Checklist de Implantação</h1>
          <p className="text-muted-foreground mt-2">
            Guia passo-a-passo para implantação segura em ambiente de produção
          </p>
        </div>
        
        <DeploymentChecklist />
      </div>
    </>
  );
};

export default DeploymentChecklistPage;
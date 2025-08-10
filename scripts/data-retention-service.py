#!/usr/bin/env python3
"""
Data Retention and Purge Service
Handles automated data purging based on retention policies
"""

import os
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import asyncpg
from dataclasses import dataclass

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class RetentionPolicy:
    org_id: str
    data_type: str
    retention_days: int
    auto_purge_enabled: bool

@dataclass
class PurgeResult:
    data_type: str
    records_deleted: int
    bytes_freed: int
    error_message: Optional[str] = None

class DataRetentionService:
    """Service for handling data retention and purging"""
    
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.pool: Optional[asyncpg.Pool] = None
        
        # Default retention policies (days)
        self.default_policies = {
            'event_clips': 30,
            'analytics_data': 365,
            'incident_records': 365,
            'audit_logs': 90,
            'metrics_data': 365,
            'demo_clips': 7,
            'temp_files': 1
        }
    
    async def start(self):
        """Initialize database connection pool"""
        self.pool = await asyncpg.create_pool(
            self.database_url,
            min_size=2,
            max_size=10,
            command_timeout=60
        )
        logger.info("Data retention service started")
    
    async def stop(self):
        """Close database connections"""
        if self.pool:
            await self.pool.close()
        logger.info("Data retention service stopped")
    
    async def get_retention_policies(self, org_id: Optional[str] = None) -> List[RetentionPolicy]:
        """Get retention policies for organization(s)"""
        async with self.pool.acquire() as conn:
            if org_id:
                query = """
                    SELECT org_id, data_type, retention_days, auto_purge_enabled
                    FROM data_retention_policies 
                    WHERE org_id = $1 AND auto_purge_enabled = true
                """
                rows = await conn.fetch(query, org_id)
            else:
                query = """
                    SELECT org_id, data_type, retention_days, auto_purge_enabled
                    FROM data_retention_policies 
                    WHERE auto_purge_enabled = true
                """
                rows = await conn.fetch(query)
            
            return [
                RetentionPolicy(
                    org_id=str(row['org_id']),
                    data_type=row['data_type'],
                    retention_days=row['retention_days'],
                    auto_purge_enabled=row['auto_purge_enabled']
                )
                for row in rows
            ]
    
    async def create_purge_job(self, org_id: str, data_type: str, cutoff_date: datetime) -> str:
        """Create a new purge job record"""
        async with self.pool.acquire() as conn:
            job_id = await conn.fetchval("""
                INSERT INTO data_purge_jobs (org_id, data_type, cutoff_date, status)
                VALUES ($1, $2, $3, 'pending')
                RETURNING id
            """, org_id, data_type, cutoff_date)
            
            logger.info(f"Created purge job {job_id} for {org_id}/{data_type}")
            return str(job_id)
    
    async def update_purge_job(self, job_id: str, result: PurgeResult, status: str):
        """Update purge job with results"""
        async with self.pool.acquire() as conn:
            await conn.execute("""
                UPDATE data_purge_jobs 
                SET records_deleted = $1, 
                    bytes_freed = $2, 
                    status = $3,
                    error_message = $4,
                    completed_at = now()
                WHERE id = $5
            """, result.records_deleted, result.bytes_freed, status, 
                result.error_message, job_id)
    
    async def purge_event_clips(self, org_id: str, cutoff_date: datetime) -> PurgeResult:
        """Purge event clips older than cutoff date"""
        async with self.pool.acquire() as conn:
            try:
                # Get clips to delete
                clips = await conn.fetch("""
                    SELECT id, clip_path, file_size_bytes
                    FROM edge_clips 
                    WHERE org_id = $1 AND created_at < $2
                """, org_id, cutoff_date)
                
                deleted_count = 0
                bytes_freed = 0
                
                # Delete files and database records
                for clip in clips:
                    try:
                        # Delete physical file
                        clip_path = clip['clip_path']
                        if clip_path and os.path.exists(clip_path):
                            file_size = os.path.getsize(clip_path)
                            os.remove(clip_path)
                            bytes_freed += file_size
                        elif clip['file_size_bytes']:
                            bytes_freed += clip['file_size_bytes']
                        
                        # Delete database record
                        await conn.execute(
                            "DELETE FROM edge_clips WHERE id = $1", 
                            clip['id']
                        )
                        deleted_count += 1
                        
                    except Exception as e:
                        logger.error(f"Failed to delete clip {clip['id']}: {e}")
                
                return PurgeResult(
                    data_type='event_clips',
                    records_deleted=deleted_count,
                    bytes_freed=bytes_freed
                )
                
            except Exception as e:
                logger.error(f"Event clips purge failed: {e}")
                return PurgeResult(
                    data_type='event_clips',
                    records_deleted=0,
                    bytes_freed=0,
                    error_message=str(e)
                )
    
    async def purge_analytics_data(self, org_id: str, cutoff_date: datetime) -> PurgeResult:
        """Purge old analytics data"""
        async with self.pool.acquire() as conn:
            try:
                # Purge old events
                events_deleted = await conn.fetchval("""
                    DELETE FROM events 
                    WHERE org_id = $1 AND ts < $2
                    RETURNING count(*)
                """, org_id, cutoff_date)
                
                # Purge old signals  
                signals_deleted = await conn.fetchval("""
                    DELETE FROM edu_signals
                    WHERE class_id IN (
                        SELECT id FROM edu_classes WHERE org_id = $1
                    ) AND ts < $2
                    RETURNING count(*)
                """, org_id, cutoff_date)
                
                total_deleted = (events_deleted or 0) + (signals_deleted or 0)
                
                return PurgeResult(
                    data_type='analytics_data',
                    records_deleted=total_deleted,
                    bytes_freed=total_deleted * 512  # Estimate 512 bytes per record
                )
                
            except Exception as e:
                logger.error(f"Analytics data purge failed: {e}")
                return PurgeResult(
                    data_type='analytics_data',
                    records_deleted=0,
                    bytes_freed=0,
                    error_message=str(e)
                )
    
    async def purge_audit_logs(self, org_id: str, cutoff_date: datetime) -> PurgeResult:
        """Purge old audit logs"""
        async with self.pool.acquire() as conn:
            try:
                deleted_count = await conn.fetchval("""
                    DELETE FROM audit_logs 
                    WHERE org_id = $1 AND timestamp < $2
                    RETURNING count(*)
                """, org_id, cutoff_date)
                
                return PurgeResult(
                    data_type='audit_logs',
                    records_deleted=deleted_count or 0,
                    bytes_freed=(deleted_count or 0) * 256  # Estimate 256 bytes per log
                )
                
            except Exception as e:
                logger.error(f"Audit logs purge failed: {e}")
                return PurgeResult(
                    data_type='audit_logs',
                    records_deleted=0,
                    bytes_freed=0,
                    error_message=str(e)
                )
    
    async def purge_incident_records(self, org_id: str, cutoff_date: datetime) -> PurgeResult:
        """Purge old incident records"""
        async with self.pool.acquire() as conn:
            try:
                # Only purge resolved/closed incidents
                deleted_count = await conn.fetchval("""
                    DELETE FROM incidents 
                    WHERE org_id = $1 
                    AND last_ts < $2 
                    AND status IN ('resolved', 'closed', 'false_positive')
                    RETURNING count(*)
                """, org_id, cutoff_date)
                
                return PurgeResult(
                    data_type='incident_records',
                    records_deleted=deleted_count or 0,
                    bytes_freed=(deleted_count or 0) * 1024  # Estimate 1KB per incident
                )
                
            except Exception as e:
                logger.error(f"Incident records purge failed: {e}")
                return PurgeResult(
                    data_type='incident_records',
                    records_deleted=0,
                    bytes_freed=0,
                    error_message=str(e)
                )
    
    async def purge_metrics_data(self, org_id: str, cutoff_date: datetime) -> PurgeResult:
        """Purge old metrics data"""
        # This would integrate with Prometheus or metrics storage
        # For now, return placeholder
        return PurgeResult(
            data_type='metrics_data',
            records_deleted=0,
            bytes_freed=0
        )
    
    async def execute_purge(self, policy: RetentionPolicy) -> PurgeResult:
        """Execute purge for a specific policy"""
        cutoff_date = datetime.utcnow() - timedelta(days=policy.retention_days)
        
        # Create purge job record
        job_id = await self.create_purge_job(
            policy.org_id, 
            policy.data_type, 
            cutoff_date
        )
        
        try:
            # Update job status to running
            async with self.pool.acquire() as conn:
                await conn.execute("""
                    UPDATE data_purge_jobs 
                    SET status = 'running', started_at = now()
                    WHERE id = $1
                """, job_id)
            
            # Execute appropriate purge function
            if policy.data_type == 'event_clips':
                result = await self.purge_event_clips(policy.org_id, cutoff_date)
            elif policy.data_type == 'analytics_data':
                result = await self.purge_analytics_data(policy.org_id, cutoff_date)
            elif policy.data_type == 'audit_logs':
                result = await self.purge_audit_logs(policy.org_id, cutoff_date)
            elif policy.data_type == 'incident_records':
                result = await self.purge_incident_records(policy.org_id, cutoff_date)
            elif policy.data_type == 'metrics_data':
                result = await self.purge_metrics_data(policy.org_id, cutoff_date)
            else:
                result = PurgeResult(
                    data_type=policy.data_type,
                    records_deleted=0,
                    bytes_freed=0,
                    error_message=f"Unknown data type: {policy.data_type}"
                )
            
            # Update job with results
            status = 'completed' if result.error_message is None else 'failed'
            await self.update_purge_job(job_id, result, status)
            
            logger.info(
                f"Purged {result.records_deleted} {policy.data_type} records "
                f"for org {policy.org_id}, freed {result.bytes_freed} bytes"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Purge execution failed for {job_id}: {e}")
            error_result = PurgeResult(
                data_type=policy.data_type,
                records_deleted=0,
                bytes_freed=0,
                error_message=str(e)
            )
            await self.update_purge_job(job_id, error_result, 'failed')
            return error_result
    
    async def run_all_purges(self) -> Dict[str, List[PurgeResult]]:
        """Run purges for all active retention policies"""
        policies = await self.get_retention_policies()
        results = {}
        
        for policy in policies:
            org_key = f"{policy.org_id}"
            if org_key not in results:
                results[org_key] = []
            
            try:
                result = await self.execute_purge(policy)
                results[org_key].append(result)
            except Exception as e:
                logger.error(f"Failed to execute purge for {policy}: {e}")
                results[org_key].append(PurgeResult(
                    data_type=policy.data_type,
                    records_deleted=0,
                    bytes_freed=0,
                    error_message=str(e)
                ))
        
        return results

async def main():
    """Main entry point for retention service"""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        logger.error("DATABASE_URL environment variable not set")
        return
    
    service = DataRetentionService(database_url)
    
    try:
        await service.start()
        
        # Run purges
        logger.info("Starting data retention purge cycle...")
        results = await service.run_all_purges()
        
        # Log summary
        total_records = sum(
            sum(r.records_deleted for r in org_results)
            for org_results in results.values()
        )
        total_bytes = sum(
            sum(r.bytes_freed for r in org_results)
            for org_results in results.values()
        )
        
        logger.info(
            f"Purge cycle completed: {total_records} records deleted, "
            f"{total_bytes / (1024*1024):.1f} MB freed"
        )
        
    except Exception as e:
        logger.error(f"Retention service failed: {e}")
    finally:
        await service.stop()

if __name__ == "__main__":
    asyncio.run(main())
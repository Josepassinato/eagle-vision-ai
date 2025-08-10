"""
Policy management system with hot reload
"""

import json
import time
import asyncio
import logging
from typing import Dict, Any, Optional, Callable, List
from dataclasses import dataclass, asdict
from pathlib import Path
import aiofiles
import threading

logger = logging.getLogger(__name__)


@dataclass
class PolicyConfig:
    """Base policy configuration"""
    org_id: Optional[str] = None
    camera_id: Optional[str] = None
    class_id: Optional[str] = None
    site_id: Optional[str] = None
    service_name: str = ""
    policy_type: str = ""
    version: int = 1
    created_at: float = 0.0
    updated_at: float = 0.0
    
    def __post_init__(self):
        if self.created_at == 0.0:
            self.created_at = time.time()
        if self.updated_at == 0.0:
            self.updated_at = time.time()


@dataclass
class AntitheftPolicy(PolicyConfig):
    """Antitheft service policies"""
    policy_type: str = "antitheft"
    
    # Detection thresholds
    shelf_out_delta: float = 2.0
    concealment_dwell_s: float = 2.0
    exit_grace_min: float = 10.0
    cart_pushout_diff: float = 3.0
    high_value_dwell_s: float = 20.0
    
    # Notification settings
    notify_enabled: bool = True
    notify_severity_threshold: str = "MEDIUM"
    
    # Recording settings
    export_duration: int = 10
    pre_event_buffer: int = 5


@dataclass
class EduBehaviorPolicy(PolicyConfig):
    """Education behavior policies"""
    policy_type: str = "education"
    
    # Emotion detection thresholds
    emotion_confidence_threshold: float = 0.6
    attention_threshold: float = 0.5
    
    # Incident thresholds by emotion type
    aggression_threshold: float = 0.8
    distress_threshold: float = 0.7
    disengagement_threshold: float = 0.3
    
    # Aggregation settings
    incident_window_minutes: int = 5
    min_signals_for_incident: int = 3
    
    # Notification settings
    notify_min_severity: str = "HIGH"
    notify_enabled: bool = True


@dataclass
class SafetyVisionPolicy(PolicyConfig):
    """Safety vision policies"""
    policy_type: str = "safety"
    
    # PPE detection thresholds
    helmet_confidence: float = 0.8
    vest_confidence: float = 0.7
    glasses_confidence: float = 0.6
    
    # Zone monitoring
    restricted_zone_enabled: bool = True
    zone_dwell_threshold: float = 30.0
    
    # Notification settings
    missing_ppe_notify: bool = True
    zone_violation_notify: bool = True


@dataclass
class PrivacyPolicy(PolicyConfig):
    """Privacy and anonymization policies"""
    policy_type: str = "privacy"
    
    # Blur settings
    face_blur_enabled: bool = False
    license_plate_blur_enabled: bool = False
    blur_strength: float = 0.8
    
    # Data retention
    clip_retention_days: int = 30
    analytics_retention_days: int = 90
    
    # Compliance
    gdpr_enabled: bool = True
    ccpa_enabled: bool = False
    data_minimization: bool = True


class PolicyCache:
    """Local policy cache with TTL"""
    
    def __init__(self, cache_ttl: float = 300.0):  # 5 minutes
        self.cache_ttl = cache_ttl
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._timestamps: Dict[str, float] = {}
        self._lock = threading.RLock()
    
    def get(self, key: str) -> Optional[Dict[str, Any]]:
        """Get policy from cache"""
        with self._lock:
            if key not in self._cache:
                return None
            
            # Check TTL
            if time.time() - self._timestamps[key] > self.cache_ttl:
                del self._cache[key]
                del self._timestamps[key]
                return None
            
            return self._cache[key].copy()
    
    def set(self, key: str, policy: Dict[str, Any]):
        """Set policy in cache"""
        with self._lock:
            self._cache[key] = policy.copy()
            self._timestamps[key] = time.time()
    
    def invalidate(self, key: str):
        """Invalidate specific policy"""
        with self._lock:
            self._cache.pop(key, None)
            self._timestamps.pop(key, None)
    
    def clear(self):
        """Clear all cached policies"""
        with self._lock:
            self._cache.clear()
            self._timestamps.clear()


class PolicyManager:
    """Policy management with hot reload"""
    
    def __init__(self, service_name: str, supabase_client=None, cache_ttl: float = 300.0):
        self.service_name = service_name
        self.supabase = supabase_client
        self.cache = PolicyCache(cache_ttl)
        self.reload_callbacks: List[Callable] = []
        self._background_task: Optional[asyncio.Task] = None
        self._running = False
        self.reload_interval = 60.0  # Check for updates every minute
    
    def register_reload_callback(self, callback: Callable):
        """Register callback for policy reload events"""
        self.reload_callbacks.append(callback)
    
    async def get_policy(
        self, 
        policy_type: str,
        org_id: Optional[str] = None,
        camera_id: Optional[str] = None,
        class_id: Optional[str] = None,
        site_id: Optional[str] = None
    ) -> Optional[PolicyConfig]:
        """Get policy with hierarchical fallback"""
        
        # Create cache key
        cache_key = f"{policy_type}:{org_id or 'global'}:{camera_id or 'all'}:{class_id or 'all'}:{site_id or 'all'}"
        
        # Try cache first
        cached_policy = self.cache.get(cache_key)
        if cached_policy:
            return self._dict_to_policy(cached_policy)
        
        # Load from database with fallback hierarchy
        policy_data = await self._load_policy_from_db(
            policy_type, org_id, camera_id, class_id, site_id
        )
        
        if policy_data:
            self.cache.set(cache_key, policy_data)
            return self._dict_to_policy(policy_data)
        
        # Return default policy if none found
        return self._get_default_policy(policy_type)
    
    async def _load_policy_from_db(
        self,
        policy_type: str,
        org_id: Optional[str],
        camera_id: Optional[str], 
        class_id: Optional[str],
        site_id: Optional[str]
    ) -> Optional[Dict[str, Any]]:
        """Load policy from database with hierarchical fallback"""
        
        if not self.supabase:
            return None
        
        # Try specific policy first, then fallback to more general ones
        queries = [
            # Most specific: all parameters
            {'org_id': org_id, 'camera_id': camera_id, 'class_id': class_id, 'site_id': site_id},
            # Camera specific
            {'org_id': org_id, 'camera_id': camera_id, 'class_id': None, 'site_id': None},
            # Class specific
            {'org_id': org_id, 'camera_id': None, 'class_id': class_id, 'site_id': None},
            # Site specific
            {'org_id': org_id, 'camera_id': None, 'class_id': None, 'site_id': site_id},
            # Org specific
            {'org_id': org_id, 'camera_id': None, 'class_id': None, 'site_id': None},
            # Global default
            {'org_id': None, 'camera_id': None, 'class_id': None, 'site_id': None}
        ]
        
        for query_params in queries:
            try:
                query = self.supabase.table('service_policies').select('*').eq('policy_type', policy_type)
                
                for key, value in query_params.items():
                    if value is not None:
                        query = query.eq(key, value)
                    else:
                        query = query.is_(key, None)
                
                result = query.order('updated_at', desc=True).limit(1).execute()
                
                if result.data:
                    policy_data = result.data[0]
                    # Merge config from JSON field
                    if 'config' in policy_data and policy_data['config']:
                        policy_data.update(policy_data['config'])
                    return policy_data
                    
            except Exception as e:
                logger.error(f"Failed to load policy: {e}")
        
        return None
    
    def _dict_to_policy(self, data: Dict[str, Any]) -> PolicyConfig:
        """Convert dictionary to policy object"""
        policy_type = data.get('policy_type', '')
        
        if policy_type == 'antitheft':
            return AntitheftPolicy(**{k: v for k, v in data.items() 
                                    if k in AntitheftPolicy.__annotations__})
        elif policy_type == 'education':
            return EduBehaviorPolicy(**{k: v for k, v in data.items() 
                                      if k in EduBehaviorPolicy.__annotations__})
        elif policy_type == 'safety':
            return SafetyVisionPolicy(**{k: v for k, v in data.items() 
                                       if k in SafetyVisionPolicy.__annotations__})
        elif policy_type == 'privacy':
            return PrivacyPolicy(**{k: v for k, v in data.items() 
                                  if k in PrivacyPolicy.__annotations__})
        else:
            return PolicyConfig(**{k: v for k, v in data.items() 
                                 if k in PolicyConfig.__annotations__})
    
    def _get_default_policy(self, policy_type: str) -> PolicyConfig:
        """Get default policy for type"""
        if policy_type == 'antitheft':
            return AntitheftPolicy()
        elif policy_type == 'education':
            return EduBehaviorPolicy()
        elif policy_type == 'safety':
            return SafetyVisionPolicy()
        elif policy_type == 'privacy':
            return PrivacyPolicy()
        else:
            return PolicyConfig(policy_type=policy_type)
    
    async def update_policy(self, policy: PolicyConfig) -> bool:
        """Update policy in database"""
        if not self.supabase:
            return False
        
        try:
            policy.updated_at = time.time()
            policy_dict = asdict(policy)
            
            # Separate base fields from config
            base_fields = {k: v for k, v in policy_dict.items() 
                          if k in PolicyConfig.__annotations__}
            config_fields = {k: v for k, v in policy_dict.items() 
                           if k not in PolicyConfig.__annotations__}
            
            base_fields['config'] = config_fields
            
            result = self.supabase.table('service_policies').upsert(base_fields).execute()
            
            if result.data:
                # Invalidate cache
                cache_key = f"{policy.policy_type}:{policy.org_id or 'global'}:{policy.camera_id or 'all'}:{policy.class_id or 'all'}:{policy.site_id or 'all'}"
                self.cache.invalidate(cache_key)
                
                # Trigger reload callbacks
                await self._trigger_reload_callbacks()
                return True
                
        except Exception as e:
            logger.error(f"Failed to update policy: {e}")
        
        return False
    
    async def start_hot_reload(self):
        """Start hot reload monitoring"""
        if self._running:
            return
        
        self._running = True
        self._background_task = asyncio.create_task(self._reload_loop())
    
    async def stop_hot_reload(self):
        """Stop hot reload monitoring"""
        self._running = False
        if self._background_task:
            self._background_task.cancel()
            try:
                await self._background_task
            except asyncio.CancelledError:
                pass
    
    async def _reload_loop(self):
        """Background policy reload loop"""
        last_check = time.time()
        
        while self._running:
            try:
                # Check for policy updates
                if self.supabase:
                    result = self.supabase.table('service_policies')\
                        .select('policy_type, org_id, camera_id, class_id, site_id, updated_at')\
                        .gte('updated_at', last_check)\
                        .execute()
                    
                    if result.data:
                        # Clear cache for updated policies
                        for policy in result.data:
                            cache_key = f"{policy['policy_type']}:{policy.get('org_id') or 'global'}:{policy.get('camera_id') or 'all'}:{policy.get('class_id') or 'all'}:{policy.get('site_id') or 'all'}"
                            self.cache.invalidate(cache_key)
                        
                        # Trigger reload callbacks
                        await self._trigger_reload_callbacks()
                        logger.info(f"Reloaded {len(result.data)} policies")
                
                last_check = time.time()
                await asyncio.sleep(self.reload_interval)
                
            except Exception as e:
                logger.error(f"Policy reload error: {e}")
                await asyncio.sleep(self.reload_interval)
    
    async def _trigger_reload_callbacks(self):
        """Trigger all reload callbacks"""
        for callback in self.reload_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback()
                else:
                    callback()
            except Exception as e:
                logger.error(f"Policy reload callback error: {e}")


# Migration SQL for service_policies table
SERVICE_POLICIES_MIGRATION = """
-- Create service_policies table for dynamic configuration
CREATE TABLE IF NOT EXISTS public.service_policies (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID REFERENCES public.orgs(id),
    camera_id TEXT,
    class_id UUID,
    site_id TEXT,
    service_name TEXT NOT NULL,
    policy_type TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    -- Ensure unique policy per scope
    UNIQUE(org_id, camera_id, class_id, site_id, policy_type)
);

-- Enable RLS
ALTER TABLE public.service_policies ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "service_policies_isolated" ON public.service_policies
FOR ALL USING (org_id = current_org());

CREATE POLICY "service_policies_service_access" ON public.service_policies
FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

-- Create indexes
CREATE INDEX idx_service_policies_lookup ON public.service_policies(policy_type, org_id, camera_id, class_id, site_id);
CREATE INDEX idx_service_policies_updated ON public.service_policies(updated_at);

-- Create trigger for updated_at
CREATE TRIGGER update_service_policies_updated_at
BEFORE UPDATE ON public.service_policies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
"""
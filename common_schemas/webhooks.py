import json
import time
import hmac
import hashlib
import logging
from typing import Dict, Any
from fastapi import FastAPI, Request, HTTPException, Header
from pydantic import BaseModel
import asyncio

logger = logging.getLogger(__name__)


class PolicyWebhookPayload(BaseModel):
    """Webhook payload for policy updates"""
    event_type: str
    policy_id: str
    org_id: str
    camera_id: str = None
    service_name: str
    policy_type: str
    config: Dict[str, Any]
    version: int
    updated_at: float


class WebhookManager:
    """Manage webhook endpoints for policy hot reload"""
    
    def __init__(self, secret_key: str = None):
        self.secret_key = secret_key
        self.subscribers: Dict[str, list] = {}
        self.app = FastAPI(title="Policy Webhook Handler")
        self._setup_routes()
    
    def _setup_routes(self):
        """Setup webhook routes"""
        
        @self.app.post("/webhook/policy-update")
        async def policy_update_webhook(
            request: Request,
            x_signature: str = Header(None),
            x_timestamp: str = Header(None)
        ):
            """Handle policy update webhooks"""
            
            body = await request.body()
            
            # Verify webhook signature if secret is configured
            if self.secret_key and x_signature:
                if not self._verify_signature(body, x_signature, x_timestamp):
                    raise HTTPException(status_code=401, detail="Invalid signature")
            
            try:
                payload_data = json.loads(body)
                payload = PolicyWebhookPayload(**payload_data)
                
                # Notify subscribers
                await self._notify_subscribers("policy_update", payload)
                
                return {"status": "processed", "event_type": payload.event_type}
                
            except Exception as e:
                logger.error(f"Webhook processing error: {e}")
                raise HTTPException(status_code=400, detail=str(e))
        
        @self.app.get("/webhook/health")
        async def webhook_health():
            """Webhook health check"""
            return {
                "status": "healthy",
                "subscribers": {k: len(v) for k, v in self.subscribers.items()}
            }
    
    def _verify_signature(self, body: bytes, signature: str, timestamp: str) -> bool:
        """Verify webhook signature"""
        try:
            # Check timestamp to prevent replay attacks
            if timestamp:
                request_time = float(timestamp)
                current_time = time.time()
                if abs(current_time - request_time) > 300:  # 5 minutes
                    return False
            
            # Verify HMAC signature
            expected_sig = hmac.new(
                self.secret_key.encode(),
                body,
                hashlib.sha256
            ).hexdigest()
            
            provided_sig = signature.replace('sha256=', '') if signature.startswith('sha256=') else signature
            
            return hmac.compare_digest(expected_sig, provided_sig)
            
        except Exception as e:
            logger.error(f"Signature verification error: {e}")
            return False
    
    def subscribe(self, event_type: str, callback):
        """Subscribe to webhook events"""
        if event_type not in self.subscribers:
            self.subscribers[event_type] = []
        
        self.subscribers[event_type].append(callback)
        logger.info(f"Subscribed to {event_type} events")
    
    async def _notify_subscribers(self, event_type: str, payload: PolicyWebhookPayload):
        """Notify all subscribers of an event"""
        if event_type not in self.subscribers:
            return
        
        for callback in self.subscribers[event_type]:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(payload)
                else:
                    callback(payload)
            except Exception as e:
                logger.error(f"Subscriber callback error: {e}")


# Global webhook manager
webhook_manager = None

def get_webhook_manager(secret_key: str = None) -> WebhookManager:
    """Get global webhook manager"""
    global webhook_manager
    if webhook_manager is None:
        webhook_manager = WebhookManager(secret_key)
    return webhook_manager


def setup_policy_webhooks(policy_manager, secret_key: str = None):
    """Setup webhook integration for policy manager"""
    
    webhook_mgr = get_webhook_manager(secret_key)
    
    async def handle_policy_update(payload: PolicyWebhookPayload):
        """Handle policy update webhook"""
        try:
            # Invalidate cache for updated policy
            cache_key = f"{payload.policy_type}:{payload.org_id or 'global'}:{payload.camera_id or 'all'}:all:all"
            policy_manager.cache.invalidate(cache_key)
            
            # Trigger reload callbacks
            await policy_manager._trigger_reload_callbacks()
            
            logger.info(f"Policy updated via webhook: {payload.policy_type} for {payload.org_id}")
            
        except Exception as e:
            logger.error(f"Policy webhook handler error: {e}")
    
    # Subscribe to policy updates
    webhook_mgr.subscribe("policy_update", handle_policy_update)
    
    return webhook_mgr.app
#!/usr/bin/env python3
"""
Unified Message Model for Notifier Service
Standardized messaging across all analytics modules
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
import json

class MessageSeverity(Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class MessageType(Enum):
    PERSON_DETECTION = "person_detection"
    SAFETY_VIOLATION = "safety_violation"
    ANTITHEFT_ALERT = "antitheft_alert"
    EDUCATION_INCIDENT = "education_incident"
    SYSTEM_ALERT = "system_alert"
    PRIVACY_ALERT = "privacy_alert"

@dataclass
class MessageContext:
    """Context information for the message"""
    camera_id: Optional[str] = None
    org_id: Optional[str] = None
    site_id: Optional[str] = None
    location: Optional[str] = None
    class_id: Optional[str] = None  # For education contexts
    zone_id: Optional[str] = None   # For safety contexts
    
    def to_dict(self) -> Dict[str, Any]:
        return {k: v for k, v in self.__dict__.items() if v is not None}

@dataclass
class UnifiedMessage:
    """
    Unified message structure for all notification types
    Replaces individual event request models
    """
    
    # Core identification
    message_id: str
    message_type: MessageType
    severity: MessageSeverity
    timestamp: datetime
    
    # Human-readable content
    title: str
    description: str
    
    # Context
    context: MessageContext
    
    # Media attachments
    thumb_url: Optional[str] = None
    clip_url: Optional[str] = None
    image_b64: Optional[str] = None
    
    # Action links
    cta_url: Optional[str] = None  # Call-to-action URL
    cta_text: Optional[str] = None # Call-to-action button text
    
    # Technical metadata
    source_service: Optional[str] = None
    confidence: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None
    
    # Legacy compatibility fields
    person_id: Optional[str] = None
    person_name: Optional[str] = None
    reason: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            'message_id': self.message_id,
            'message_type': self.message_type.value,
            'severity': self.severity.value,
            'timestamp': self.timestamp.isoformat(),
            'title': self.title,
            'description': self.description,
            'context': self.context.to_dict(),
            'thumb_url': self.thumb_url,
            'clip_url': self.clip_url,
            'image_b64': self.image_b64,
            'cta_url': self.cta_url,
            'cta_text': self.cta_text,
            'source_service': self.source_service,
            'confidence': self.confidence,
            'metadata': self.metadata or {},
            'person_id': self.person_id,
            'person_name': self.person_name,
            'reason': self.reason
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'UnifiedMessage':
        """Create from dictionary"""
        context_data = data.get('context', {})
        context = MessageContext(**context_data)
        
        return cls(
            message_id=data['message_id'],
            message_type=MessageType(data['message_type']),
            severity=MessageSeverity(data['severity']),
            timestamp=datetime.fromisoformat(data['timestamp']),
            title=data['title'],
            description=data['description'],
            context=context,
            thumb_url=data.get('thumb_url'),
            clip_url=data.get('clip_url'),
            image_b64=data.get('image_b64'),
            cta_url=data.get('cta_url'),
            cta_text=data.get('cta_text'),
            source_service=data.get('source_service'),
            confidence=data.get('confidence'),
            metadata=data.get('metadata'),
            person_id=data.get('person_id'),
            person_name=data.get('person_name'),
            reason=data.get('reason')
        )

class MessageFormatter:
    """Format unified messages for different channels"""
    
    def __init__(self, parse_mode: str = "HTML"):
        self.parse_mode = parse_mode
        
        # Severity emoji mapping
        self.severity_emojis = {
            MessageSeverity.LOW: "ℹ️",
            MessageSeverity.MEDIUM: "⚠️", 
            MessageSeverity.HIGH: "🚨",
            MessageSeverity.CRITICAL: "🔴"
        }
        
        # Message type emoji mapping
        self.type_emojis = {
            MessageType.PERSON_DETECTION: "👤",
            MessageType.SAFETY_VIOLATION: "⚠️",
            MessageType.ANTITHEFT_ALERT: "🚨",
            MessageType.EDUCATION_INCIDENT: "📚",
            MessageType.SYSTEM_ALERT: "⚙️",
            MessageType.PRIVACY_ALERT: "🔒"
        }
    
    def format_telegram(self, message: UnifiedMessage) -> str:
        """Format message for Telegram"""
        severity_emoji = self.severity_emojis.get(message.severity, "")
        type_emoji = self.type_emojis.get(message.message_type, "")
        
        # Parse timestamp
        try:
            time_str = message.timestamp.strftime('%H:%M:%S')
        except:
            time_str = message.timestamp.isoformat()
        
        # Build context info
        context_parts = []
        ctx = message.context
        
        if ctx.camera_id:
            context_parts.append(f"📹 {ctx.camera_id}")
        if ctx.location:
            context_parts.append(f"📍 {ctx.location}")
        if ctx.site_id:
            context_parts.append(f"🏢 {ctx.site_id}")
        
        context_line = " | ".join(context_parts) if context_parts else ""
        
        # Build technical details
        tech_details = []
        if message.confidence:
            tech_details.append(f"Conf: {message.confidence:.2f}")
        if message.person_name or message.person_id:
            person_info = message.person_name or message.person_id
            tech_details.append(f"Pessoa: {person_info}")
        if message.reason:
            tech_details.append(f"Motivo: {message.reason}")
        
        tech_line = " | ".join(tech_details) if tech_details else ""
        
        # Build action links
        action_links = []
        if message.clip_url:
            if self.parse_mode == "HTML":
                action_links.append(f'<a href="{message.clip_url}">📹 Clip</a>')
            else:
                action_links.append(f"📹 Clip: {message.clip_url}")
        
        if message.cta_url:
            if self.parse_mode == "HTML":
                cta_text = message.cta_text or "Ver Detalhes"
                action_links.append(f'<a href="{message.cta_url}">{cta_text}</a>')
            else:
                action_links.append(f"{message.cta_text or 'Ver'}: {message.cta_url}")
        
        action_line = " | ".join(action_links) if action_links else ""
        
        # Format final message
        if self.parse_mode == "HTML":
            lines = [
                f"<b>{severity_emoji} {type_emoji} {message.title}</b>",
                f"<b>Horário:</b> {time_str}"
            ]
            
            if context_line:
                lines.append(f"<b>Local:</b> {context_line}")
            
            lines.append(f"<i>{message.description}</i>")
            
            if tech_line:
                lines.append(f"<b>Detalhes:</b> {tech_line}")
            
            if action_line:
                lines.append(f"<b>Ações:</b> {action_line}")
                
        else:
            lines = [
                f"{severity_emoji} {type_emoji} {message.title}",
                f"Horário: {time_str}"
            ]
            
            if context_line:
                lines.append(f"Local: {context_line}")
            
            lines.append(message.description)
            
            if tech_line:
                lines.append(f"Detalhes: {tech_line}")
            
            if action_line:
                lines.append(f"Ações: {action_line}")
        
        return "\n".join(lines)
    
    def format_email(self, message: UnifiedMessage) -> Dict[str, str]:
        """Format message for email"""
        subject = f"[Visão de Águia] {message.severity.value}: {message.title}"
        
        # HTML body
        html_body = f"""
        <html>
        <body>
            <h2>{message.title}</h2>
            <p><strong>Severidade:</strong> {message.severity.value}</p>
            <p><strong>Horário:</strong> {message.timestamp.strftime('%d/%m/%Y %H:%M:%S')}</p>
            <p><strong>Descrição:</strong> {message.description}</p>
        """
        
        if message.context.camera_id:
            html_body += f"<p><strong>Câmera:</strong> {message.context.camera_id}</p>"
        
        if message.context.location:
            html_body += f"<p><strong>Local:</strong> {message.context.location}</p>"
        
        if message.confidence:
            html_body += f"<p><strong>Confiança:</strong> {message.confidence:.2f}</p>"
        
        if message.clip_url:
            html_body += f'<p><a href="{message.clip_url}">Ver Gravação</a></p>'
        
        if message.cta_url:
            cta_text = message.cta_text or "Ver Detalhes"
            html_body += f'<p><a href="{message.cta_url}">{cta_text}</a></p>'
        
        html_body += """
        </body>
        </html>
        """
        
        # Plain text body
        text_body = f"""
{message.title}

Severidade: {message.severity.value}
Horário: {message.timestamp.strftime('%d/%m/%Y %H:%M:%S')}
Descrição: {message.description}
"""
        
        if message.context.camera_id:
            text_body += f"Câmera: {message.context.camera_id}\n"
        
        if message.clip_url:
            text_body += f"Gravação: {message.clip_url}\n"
        
        return {
            'subject': subject,
            'html_body': html_body,
            'text_body': text_body
        }

class RateLimiter:
    """Enhanced rate limiter for unified messages"""
    
    def __init__(self):
        # Rate limiting by different keys
        self.limits = {
            'global': {'max': 100, 'window': 3600, 'tracker': {}},          # 100/hour global
            'camera': {'max': 20, 'window': 3600, 'tracker': {}},           # 20/hour per camera
            'org': {'max': 50, 'window': 3600, 'tracker': {}},              # 50/hour per org
            'incident': {'max': 3, 'window': 1800, 'tracker': {}},          # 3/30min per incident type
        }
    
    def should_allow(self, message: UnifiedMessage) -> bool:
        """Check if message should be allowed through rate limiter"""
        now = datetime.utcnow().timestamp()
        
        # Check global rate limit
        if not self._check_limit('global', 'global', now):
            return False
        
        # Check camera rate limit
        if message.context.camera_id:
            camera_key = f"camera:{message.context.camera_id}"
            if not self._check_limit('camera', camera_key, now):
                return False
        
        # Check org rate limit
        if message.context.org_id:
            org_key = f"org:{message.context.org_id}"
            if not self._check_limit('org', org_key, now):
                return False
        
        # Check incident type rate limit (camera + message type + severity)
        incident_key = f"incident:{message.context.camera_id}:{message.message_type.value}:{message.severity.value}"
        if not self._check_limit('incident', incident_key, now):
            return False
        
        return True
    
    def _check_limit(self, limit_type: str, key: str, now: float) -> bool:
        """Check specific rate limit"""
        config = self.limits[limit_type]
        tracker = config['tracker']
        max_count = config['max']
        window = config['window']
        
        # Initialize if not exists
        if key not in tracker:
            tracker[key] = []
        
        # Clean old entries
        cutoff = now - window
        tracker[key] = [ts for ts in tracker[key] if ts > cutoff]
        
        # Check limit
        if len(tracker[key]) >= max_count:
            return False
        
        # Add current timestamp
        tracker[key].append(now)
        return True
    
    def get_stats(self) -> Dict[str, Any]:
        """Get rate limiter statistics"""
        now = datetime.utcnow().timestamp()
        stats = {}
        
        for limit_type, config in self.limits.items():
            active_keys = 0
            total_pending = 0
            
            for key, timestamps in config['tracker'].items():
                # Count only recent entries
                cutoff = now - config['window']
                recent_count = len([ts for ts in timestamps if ts > cutoff])
                
                if recent_count > 0:
                    active_keys += 1
                    total_pending += recent_count
            
            stats[limit_type] = {
                'active_keys': active_keys,
                'total_pending': total_pending,
                'limit': config['max'],
                'window_seconds': config['window']
            }
        
        return stats
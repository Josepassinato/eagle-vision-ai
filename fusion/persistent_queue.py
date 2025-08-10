#!/usr/bin/env python3
"""
Persistent Queue with Backpressure and Idempotency
Disk-based queue for reliable event processing
"""

import os
import json
import time
import hashlib
import sqlite3
import threading
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
import logging

logger = logging.getLogger(__name__)

class QueueItemStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    DISCARDED = "discarded"

@dataclass
class QueueItem:
    id: str
    track_id: str
    camera_id: str
    payload: Dict[str, Any]
    status: QueueItemStatus
    created_at: datetime
    updated_at: datetime
    retry_count: int = 0
    next_retry_at: Optional[datetime] = None
    error_message: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "track_id": self.track_id,
            "camera_id": self.camera_id,
            "payload": json.dumps(self.payload),
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "retry_count": self.retry_count,
            "next_retry_at": self.next_retry_at.isoformat() if self.next_retry_at else None,
            "error_message": self.error_message
        }

class PersistentQueue:
    """
    Disk-based persistent queue with:
    - Backpressure control
    - Idempotency via track_id+timestamp
    - Automatic discard policies
    - Retry logic with exponential backoff
    """
    
    def __init__(self, 
                 db_path: str,
                 max_queue_seconds: int = 300,  # 5 minutes
                 max_queue_size: int = 10000,
                 max_retries: int = 3,
                 retry_base_delay_seconds: int = 2):
        
        self.db_path = db_path
        self.max_queue_seconds = max_queue_seconds
        self.max_queue_size = max_queue_size
        self.max_retries = max_retries
        self.retry_base_delay_seconds = retry_base_delay_seconds
        
        self._lock = threading.RLock()
        self._init_db()
        
        # Cleanup old items on startup
        self._cleanup_old_items()
    
    def _init_db(self):
        """Initialize SQLite database"""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS queue_items (
                    id TEXT PRIMARY KEY,
                    track_id TEXT NOT NULL,
                    camera_id TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    retry_count INTEGER DEFAULT 0,
                    next_retry_at TEXT,
                    error_message TEXT
                )
            """)
            
            # Create indexes for performance
            conn.execute("CREATE INDEX IF NOT EXISTS idx_status ON queue_items(status)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_camera_created ON queue_items(camera_id, created_at)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_track_created ON queue_items(track_id, created_at)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_next_retry ON queue_items(next_retry_at)")
            
            conn.commit()
    
    def enqueue(self, 
                track_id: str, 
                camera_id: str, 
                payload: Dict[str, Any],
                dedupe_window_seconds: int = 30) -> bool:
        """
        Enqueue item with idempotency check and backpressure
        
        Returns:
            True if enqueued successfully
            False if rejected due to backpressure or duplicate
        """
        with self._lock:
            now = datetime.utcnow()
            
            # Check backpressure
            if not self._check_backpressure(camera_id, now):
                logger.warning(f"Queue backpressure triggered for camera {camera_id}")
                return False
            
            # Generate deterministic ID for idempotency
            item_key = f"{track_id}:{camera_id}:{payload.get('ts', now.isoformat())}"
            item_id = hashlib.md5(item_key.encode()).hexdigest()
            
            # Check for duplicate within window
            if self._is_duplicate(item_id, track_id, now, dedupe_window_seconds):
                logger.debug(f"Duplicate item rejected: {item_id}")
                return False
            
            # Create queue item
            item = QueueItem(
                id=item_id,
                track_id=track_id,
                camera_id=camera_id,
                payload=payload,
                status=QueueItemStatus.PENDING,
                created_at=now,
                updated_at=now
            )
            
            # Insert into database
            return self._insert_item(item)
    
    def dequeue_batch(self, batch_size: int = 10) -> List[QueueItem]:
        """
        Dequeue batch of items ready for processing
        """
        with self._lock:
            now = datetime.utcnow()
            
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                
                # Get pending items and items ready for retry
                cursor = conn.execute("""
                    SELECT * FROM queue_items 
                    WHERE status = ? OR (status = ? AND next_retry_at <= ?)
                    ORDER BY created_at ASC
                    LIMIT ?
                """, (QueueItemStatus.PENDING.value, QueueItemStatus.FAILED.value, 
                     now.isoformat(), batch_size))
                
                rows = cursor.fetchall()
                items = []
                
                for row in rows:
                    # Mark as processing
                    conn.execute("""
                        UPDATE queue_items 
                        SET status = ?, updated_at = ? 
                        WHERE id = ?
                    """, (QueueItemStatus.PROCESSING.value, now.isoformat(), row['id']))
                    
                    # Convert to QueueItem
                    item = QueueItem(
                        id=row['id'],
                        track_id=row['track_id'],
                        camera_id=row['camera_id'],
                        payload=json.loads(row['payload']),
                        status=QueueItemStatus.PROCESSING,
                        created_at=datetime.fromisoformat(row['created_at']),
                        updated_at=now,
                        retry_count=row['retry_count'],
                        next_retry_at=datetime.fromisoformat(row['next_retry_at']) if row['next_retry_at'] else None,
                        error_message=row['error_message']
                    )
                    items.append(item)
                
                conn.commit()
                return items
    
    def mark_completed(self, item_id: str):
        """Mark item as completed"""
        with self._lock:
            now = datetime.utcnow()
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    UPDATE queue_items 
                    SET status = ?, updated_at = ? 
                    WHERE id = ?
                """, (QueueItemStatus.COMPLETED.value, now.isoformat(), item_id))
                conn.commit()
    
    def mark_failed(self, item_id: str, error_message: str):
        """Mark item as failed and schedule retry if under limit"""
        with self._lock:
            now = datetime.utcnow()
            
            with sqlite3.connect(self.db_path) as conn:
                # Get current retry count
                cursor = conn.execute("SELECT retry_count FROM queue_items WHERE id = ?", (item_id,))
                row = cursor.fetchone()
                
                if not row:
                    return
                
                retry_count = row[0] + 1
                
                if retry_count <= self.max_retries:
                    # Schedule retry with exponential backoff
                    delay_seconds = self.retry_base_delay_seconds * (2 ** (retry_count - 1))
                    next_retry_at = now + timedelta(seconds=delay_seconds)
                    
                    conn.execute("""
                        UPDATE queue_items 
                        SET status = ?, updated_at = ?, retry_count = ?, 
                            next_retry_at = ?, error_message = ?
                        WHERE id = ?
                    """, (QueueItemStatus.FAILED.value, now.isoformat(), retry_count,
                         next_retry_at.isoformat(), error_message, item_id))
                    
                    logger.info(f"Item {item_id} scheduled for retry {retry_count} at {next_retry_at}")
                else:
                    # Max retries exceeded - discard
                    conn.execute("""
                        UPDATE queue_items 
                        SET status = ?, updated_at = ?, error_message = ?
                        WHERE id = ?
                    """, (QueueItemStatus.DISCARDED.value, now.isoformat(), 
                         f"Max retries exceeded: {error_message}", item_id))
                    
                    logger.warning(f"Item {item_id} discarded after {self.max_retries} retries")
                
                conn.commit()
    
    def _check_backpressure(self, camera_id: str, now: datetime) -> bool:
        """Check if queue is under backpressure"""
        with sqlite3.connect(self.db_path) as conn:
            # Check total queue size
            cursor = conn.execute("""
                SELECT COUNT(*) FROM queue_items 
                WHERE status IN (?, ?)
            """, (QueueItemStatus.PENDING.value, QueueItemStatus.PROCESSING.value))
            
            total_pending = cursor.fetchone()[0]
            if total_pending >= self.max_queue_size:
                return False
            
            # Check age of oldest item for this camera
            cursor = conn.execute("""
                SELECT MIN(created_at) FROM queue_items 
                WHERE camera_id = ? AND status IN (?, ?)
            """, (camera_id, QueueItemStatus.PENDING.value, QueueItemStatus.PROCESSING.value))
            
            oldest_str = cursor.fetchone()[0]
            if oldest_str:
                oldest = datetime.fromisoformat(oldest_str)
                age_seconds = (now - oldest).total_seconds()
                if age_seconds > self.max_queue_seconds:
                    return False
            
            return True
    
    def _is_duplicate(self, item_id: str, track_id: str, now: datetime, window_seconds: int) -> bool:
        """Check if item is duplicate within time window"""
        cutoff = now - timedelta(seconds=window_seconds)
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("""
                SELECT COUNT(*) FROM queue_items 
                WHERE (id = ? OR track_id = ?) 
                AND created_at > ?
                AND status != ?
            """, (item_id, track_id, cutoff.isoformat(), QueueItemStatus.DISCARDED.value))
            
            count = cursor.fetchone()[0]
            return count > 0
    
    def _insert_item(self, item: QueueItem) -> bool:
        """Insert item into database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                data = item.to_dict()
                placeholders = ', '.join(['?' for _ in data])
                columns = ', '.join(data.keys())
                
                conn.execute(f"""
                    INSERT INTO queue_items ({columns}) 
                    VALUES ({placeholders})
                """, list(data.values()))
                
                conn.commit()
                return True
        except sqlite3.IntegrityError:
            # Duplicate ID - already exists
            logger.debug(f"Item {item.id} already exists")
            return False
        except Exception as e:
            logger.error(f"Failed to insert item {item.id}: {e}")
            return False
    
    def _cleanup_old_items(self):
        """Clean up old completed/discarded items"""
        cutoff = datetime.utcnow() - timedelta(hours=24)
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("""
                DELETE FROM queue_items 
                WHERE status IN (?, ?) AND updated_at < ?
            """, (QueueItemStatus.COMPLETED.value, QueueItemStatus.DISCARDED.value, 
                 cutoff.isoformat()))
            
            deleted = cursor.rowcount
            conn.commit()
            
            if deleted > 0:
                logger.info(f"Cleaned up {deleted} old queue items")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get queue statistics"""
        with sqlite3.connect(self.db_path) as conn:
            stats = {}
            
            # Count by status
            cursor = conn.execute("""
                SELECT status, COUNT(*) FROM queue_items GROUP BY status
            """)
            for status, count in cursor.fetchall():
                stats[f"count_{status}"] = count
            
            # Camera breakdown
            cursor = conn.execute("""
                SELECT camera_id, COUNT(*) FROM queue_items 
                WHERE status IN (?, ?) 
                GROUP BY camera_id
            """, (QueueItemStatus.PENDING.value, QueueItemStatus.PROCESSING.value))
            
            camera_stats = {}
            for camera_id, count in cursor.fetchall():
                camera_stats[camera_id] = count
            
            stats["by_camera"] = camera_stats
            
            # Age stats
            cursor = conn.execute("""
                SELECT MIN(created_at), MAX(created_at) FROM queue_items 
                WHERE status IN (?, ?)
            """, (QueueItemStatus.PENDING.value, QueueItemStatus.PROCESSING.value))
            
            oldest, newest = cursor.fetchone()
            if oldest:
                oldest_age = (datetime.utcnow() - datetime.fromisoformat(oldest)).total_seconds()
                stats["oldest_pending_age_seconds"] = oldest_age
            
            return stats
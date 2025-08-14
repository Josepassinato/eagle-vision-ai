"""
Active Learning System for continuous model improvement
"""

import asyncio
import json
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import logging
from pathlib import Path
import sqlite3
import pickle
import hashlib
from collections import defaultdict
from .correlation_logger import get_correlation_logger

logger = get_correlation_logger('active_learning')

class AnnotationStatus(Enum):
    PENDING = "pending"
    ANNOTATED = "annotated"
    VALIDATED = "validated"
    REJECTED = "rejected"

class UncertaintyMethod(Enum):
    ENTROPY = "entropy"
    MARGIN = "margin"
    LEAST_CONFIDENCE = "least_confidence"
    VARIANCE = "variance"

@dataclass
class Sample:
    sample_id: str
    org_id: str
    camera_id: str
    timestamp: datetime
    frame_data: bytes  # Compressed frame
    model_predictions: Dict[str, Any]
    uncertainty_score: float
    ground_truth: Optional[Dict[str, Any]] = None
    annotation_status: AnnotationStatus = AnnotationStatus.PENDING
    created_at: datetime = field(default_factory=datetime.utcnow)
    annotated_at: Optional[datetime] = None
    annotated_by: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class ModelPerformance:
    model_name: str
    version: str
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    samples_count: int
    last_updated: datetime

class ActiveLearningManager:
    """Manages active learning pipeline for continuous model improvement"""
    
    def __init__(self, db_path: str = "/tmp/active_learning.db"):
        self.db_path = db_path
        self.init_database()
        self.uncertainty_calculators = {
            UncertaintyMethod.ENTROPY: self._calculate_entropy,
            UncertaintyMethod.MARGIN: self._calculate_margin,
            UncertaintyMethod.LEAST_CONFIDENCE: self._calculate_least_confidence,
            UncertaintyMethod.VARIANCE: self._calculate_variance
        }
    
    def init_database(self):
        """Initialize SQLite database for storing samples and annotations"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Create samples table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS samples (
                sample_id TEXT PRIMARY KEY,
                org_id TEXT NOT NULL,
                camera_id TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                frame_data BLOB NOT NULL,
                model_predictions TEXT NOT NULL,
                uncertainty_score REAL NOT NULL,
                ground_truth TEXT,
                annotation_status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                annotated_at TEXT,
                annotated_by TEXT,
                metadata TEXT NOT NULL
            )
        ''')
        
        # Create model performance table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS model_performance (
                model_name TEXT,
                version TEXT,
                accuracy REAL,
                precision REAL,
                recall REAL,
                f1_score REAL,
                samples_count INTEGER,
                last_updated TEXT,
                PRIMARY KEY (model_name, version)
            )
        ''')
        
        # Create indexes
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_uncertainty ON samples (uncertainty_score DESC)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_status ON samples (annotation_status)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_org_camera ON samples (org_id, camera_id)')
        
        conn.commit()
        conn.close()
    
    async def add_prediction_sample(
        self,
        frame_data: bytes,
        model_predictions: Dict[str, Any],
        org_id: str,
        camera_id: str,
        model_name: str = "yolo",
        uncertainty_method: UncertaintyMethod = UncertaintyMethod.ENTROPY
    ) -> str:
        """Add a new prediction sample for potential annotation"""
        
        # Calculate uncertainty score
        uncertainty_score = self.uncertainty_calculators[uncertainty_method](model_predictions)
        
        # Generate sample ID
        content_hash = hashlib.md5(frame_data).hexdigest()
        sample_id = f"{model_name}_{camera_id}_{int(datetime.utcnow().timestamp())}_{content_hash[:8]}"
        
        sample = Sample(
            sample_id=sample_id,
            org_id=org_id,
            camera_id=camera_id,
            timestamp=datetime.utcnow(),
            frame_data=frame_data,
            model_predictions=model_predictions,
            uncertainty_score=uncertainty_score,
            metadata={
                'model_name': model_name,
                'uncertainty_method': uncertainty_method.value,
                'prediction_confidence': model_predictions.get('confidence', 0.0)
            }
        )
        
        # Store in database
        await self._store_sample(sample)
        
        logger.info(
            f"Added prediction sample for active learning",
            sample_id=sample_id,
            uncertainty_score=uncertainty_score,
            camera_id=camera_id
        )
        
        return sample_id
    
    async def get_samples_for_annotation(
        self,
        count: int = 10,
        org_id: Optional[str] = None,
        min_uncertainty: float = 0.3,
        max_samples_per_camera: int = 3
    ) -> List[Sample]:
        """Get high-uncertainty samples for annotation"""
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        query = '''
            SELECT * FROM samples 
            WHERE annotation_status = 'pending' 
            AND uncertainty_score >= ?
        '''
        params = [min_uncertainty]
        
        if org_id:
            query += ' AND org_id = ?'
            params.append(org_id)
        
        query += '''
            ORDER BY uncertainty_score DESC, created_at ASC
            LIMIT ?
        '''
        params.append(count * 3)  # Get more to filter by camera
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        # Convert to Sample objects and balance by camera
        samples = []
        camera_counts = defaultdict(int)
        
        for row in rows:
            if len(samples) >= count:
                break
            
            if camera_counts[row[2]] < max_samples_per_camera:  # row[2] is camera_id
                sample = self._row_to_sample(row)
                samples.append(sample)
                camera_counts[row[2]] += 1
        
        logger.info(
            f"Retrieved {len(samples)} samples for annotation",
            requested_count=count,
            avg_uncertainty=np.mean([s.uncertainty_score for s in samples]) if samples else 0
        )
        
        return samples
    
    async def submit_annotation(
        self,
        sample_id: str,
        ground_truth: Dict[str, Any],
        annotated_by: str
    ) -> bool:
        """Submit ground truth annotation for a sample"""
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE samples 
            SET ground_truth = ?, annotation_status = 'annotated', 
                annotated_at = ?, annotated_by = ?
            WHERE sample_id = ?
        ''', [
            json.dumps(ground_truth),
            datetime.utcnow().isoformat(),
            annotated_by,
            sample_id
        ])
        
        success = cursor.rowcount > 0
        conn.commit()
        conn.close()
        
        if success:
            logger.info(
                f"Annotation submitted successfully",
                sample_id=sample_id,
                annotated_by=annotated_by
            )
        
        return success
    
    async def calculate_model_performance(
        self,
        model_name: str,
        version: str,
        org_id: Optional[str] = None
    ) -> ModelPerformance:
        """Calculate model performance on annotated samples"""
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        query = '''
            SELECT model_predictions, ground_truth FROM samples 
            WHERE annotation_status = 'annotated' 
            AND metadata LIKE ?
        '''
        params = [f'%"model_name": "{model_name}"%']
        
        if org_id:
            query += ' AND org_id = ?'
            params.append(org_id)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        if not rows:
            return ModelPerformance(
                model_name=model_name,
                version=version,
                accuracy=0.0,
                precision=0.0,
                recall=0.0,
                f1_score=0.0,
                samples_count=0,
                last_updated=datetime.utcnow()
            )
        
        # Calculate metrics
        true_positives = 0
        false_positives = 0
        false_negatives = 0
        total_samples = len(rows)
        correct_predictions = 0
        
        for pred_json, gt_json in rows:
            predictions = json.loads(pred_json)
            ground_truth = json.loads(gt_json)
            
            # Simple accuracy for object detection
            pred_objects = len(predictions.get('detections', []))
            gt_objects = len(ground_truth.get('objects', []))
            
            if pred_objects == gt_objects:
                correct_predictions += 1
            
            # More sophisticated metrics would compare bboxes and classes
            true_positives += min(pred_objects, gt_objects)
            false_positives += max(0, pred_objects - gt_objects)
            false_negatives += max(0, gt_objects - pred_objects)
        
        accuracy = correct_predictions / total_samples if total_samples > 0 else 0
        precision = true_positives / (true_positives + false_positives) if (true_positives + false_positives) > 0 else 0
        recall = true_positives / (true_positives + false_negatives) if (true_positives + false_negatives) > 0 else 0
        f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
        
        performance = ModelPerformance(
            model_name=model_name,
            version=version,
            accuracy=accuracy,
            precision=precision,
            recall=recall,
            f1_score=f1_score,
            samples_count=total_samples,
            last_updated=datetime.utcnow()
        )
        
        # Store performance metrics
        await self._store_performance(performance)
        
        logger.performance_log(
            operation="model_performance_calculation",
            duration_ms=0,  # Quick calculation
            model_name=model_name,
            accuracy=accuracy,
            precision=precision,
            recall=recall,
            f1_score=f1_score,
            samples_count=total_samples
        )
        
        return performance
    
    async def get_annotation_interface_data(
        self,
        sample_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get sample data for annotation interface"""
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM samples WHERE sample_id = ?', [sample_id])
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return None
        
        sample = self._row_to_sample(row)
        
        return {
            'sample_id': sample.sample_id,
            'camera_id': sample.camera_id,
            'timestamp': sample.timestamp.isoformat(),
            'frame_data_b64': sample.frame_data.hex(),  # Convert to hex for transfer
            'model_predictions': sample.model_predictions,
            'uncertainty_score': sample.uncertainty_score,
            'metadata': sample.metadata
        }
    
    # Uncertainty calculation methods
    def _calculate_entropy(self, predictions: Dict[str, Any]) -> float:
        """Calculate entropy-based uncertainty"""
        detections = predictions.get('detections', [])
        if not detections:
            return 1.0  # High uncertainty for no detections
        
        confidences = [d.get('confidence', 0.5) for d in detections]
        if not confidences:
            return 1.0
        
        # Calculate entropy
        entropy = 0
        for conf in confidences:
            if conf > 0:
                entropy -= conf * np.log2(conf)
            if (1 - conf) > 0:
                entropy -= (1 - conf) * np.log2(1 - conf)
        
        return entropy / len(confidences)  # Normalize
    
    def _calculate_margin(self, predictions: Dict[str, Any]) -> float:
        """Calculate margin-based uncertainty"""
        detections = predictions.get('detections', [])
        if len(detections) < 2:
            return 1.0
        
        confidences = sorted([d.get('confidence', 0.5) for d in detections], reverse=True)
        margin = confidences[0] - confidences[1]
        return 1.0 - margin  # Higher margin = lower uncertainty
    
    def _calculate_least_confidence(self, predictions: Dict[str, Any]) -> float:
        """Calculate least confidence uncertainty"""
        detections = predictions.get('detections', [])
        if not detections:
            return 1.0
        
        max_confidence = max(d.get('confidence', 0.5) for d in detections)
        return 1.0 - max_confidence
    
    def _calculate_variance(self, predictions: Dict[str, Any]) -> float:
        """Calculate variance-based uncertainty"""
        detections = predictions.get('detections', [])
        if not detections:
            return 1.0
        
        confidences = [d.get('confidence', 0.5) for d in detections]
        return float(np.var(confidences))
    
    # Helper methods
    async def _store_sample(self, sample: Sample):
        """Store sample in database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO samples VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', [
            sample.sample_id,
            sample.org_id,
            sample.camera_id,
            sample.timestamp.isoformat(),
            sample.frame_data,
            json.dumps(sample.model_predictions),
            sample.uncertainty_score,
            json.dumps(sample.ground_truth) if sample.ground_truth else None,
            sample.annotation_status.value,
            sample.created_at.isoformat(),
            sample.annotated_at.isoformat() if sample.annotated_at else None,
            sample.annotated_by,
            json.dumps(sample.metadata)
        ])
        
        conn.commit()
        conn.close()
    
    async def _store_performance(self, performance: ModelPerformance):
        """Store model performance metrics"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO model_performance VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', [
            performance.model_name,
            performance.version,
            performance.accuracy,
            performance.precision,
            performance.recall,
            performance.f1_score,
            performance.samples_count,
            performance.last_updated.isoformat()
        ])
        
        conn.commit()
        conn.close()
    
    def _row_to_sample(self, row) -> Sample:
        """Convert database row to Sample object"""
        return Sample(
            sample_id=row[0],
            org_id=row[1],
            camera_id=row[2],
            timestamp=datetime.fromisoformat(row[3]),
            frame_data=row[4],
            model_predictions=json.loads(row[5]),
            uncertainty_score=row[6],
            ground_truth=json.loads(row[7]) if row[7] else None,
            annotation_status=AnnotationStatus(row[8]),
            created_at=datetime.fromisoformat(row[9]),
            annotated_at=datetime.fromisoformat(row[10]) if row[10] else None,
            annotated_by=row[11],
            metadata=json.loads(row[12])
        )

# Factory function
def create_active_learning_manager() -> ActiveLearningManager:
    """Create active learning manager instance"""
    return ActiveLearningManager()
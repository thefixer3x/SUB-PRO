    def update_task_status(self, task_id: str, status: str) -> bool:
        """Update task status"""
        
        try:
            completed_at = datetime.now().isoformat() if status == 'completed' else None
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("""
                    UPDATE tasks 
                    SET status = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (status, completed_at, task_id))
                
                if cursor.rowcount > 0:
                    conn.commit()
                    self.logger.info(f"Task {task_id} status updated to {status}")
                    return True
                else:
                    self.logger.warning(f"Task not found: {task_id}")
                    return False
                    
        except Exception as e:
            self.logger.error(f"Failed to update task status: {e}")
            return False
    
    def get_tasks(self, session_id: str = None, status: str = None) -> List[Dict]:
        """Get tasks with optional filtering"""
        
        try:
            query = "SELECT * FROM tasks WHERE 1=1"
            params = []
            
            if session_id:
                query += " AND session_id = ?"
                params.append(session_id)
            
            if status:
                query += " AND status = ?"
                params.append(status)
            
            query += " ORDER BY created_at DESC"
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute(query, params)
                
                tasks = []
                for row in cursor.fetchall():
                    tasks.append({
                        "id": row[0],
                        "session_id": row[1],
                        "title": row[2],
                        "description": row[3],
                        "priority": row[4],
                        "status": row[5],
                        "due_date": row[6],
                        "created_at": row[7],
                        "completed_at": row[8],
                        "automation_pattern": row[9]
                    })
                
                return tasks
                
        except Exception as e:
            self.logger.error(f"Failed to get tasks: {e}")
            return []
    
    def delete_task(self, task_id: str) -> bool:
        """Delete a task"""
        
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
                
                if cursor.rowcount > 0:
                    conn.commit()
                    self.logger.info(f"Task deleted: {task_id}")
                    return True
                else:
                    self.logger.warning(f"Task not found for deletion: {task_id}")
                    return False
                    
        except Exception as e:
            self.logger.error(f"Failed to delete task: {e}")
            return False
    
    def get_session_statistics(self, session_id: str, days: int = 7) -> Dict[str, Any]:
        """Get detailed session statistics"""
        
        try:
            since = datetime.now() - timedelta(days=days)
            
            with sqlite3.connect(self.db_path) as conn:
                # Activity statistics
                activity_stats = conn.execute("""
                    SELECT 
                        COUNT(*) as total_activities,
                        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_activities,
                        AVG(execution_time) as avg_execution_time,
                        SUM(execution_time) as total_execution_time,
                        COUNT(DISTINCT DATE(timestamp)) as active_days
                    FROM activity_logs 
                    WHERE session_id = ? AND timestamp > ?
                """, (session_id, since.isoformat())).fetchone()
                
                # Task statistics
                task_stats = conn.execute("""
                    SELECT 
                        COUNT(*) as total_tasks,
                        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
                        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tasks,
                        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks
                    FROM tasks 
                    WHERE session_id = ? AND created_at > ?
                """, (session_id, since.isoformat())).fetchone()
                
                # Note statistics
                note_stats = conn.execute("""
                    SELECT 
                        COUNT(*) as total_notes,
                        SUM(CASE WHEN note_type = 'manual' THEN 1 ELSE 0 END) as manual_notes,
                        SUM(CASE WHEN note_type = 'auto_summary' THEN 1 ELSE 0 END) as auto_notes
                    FROM session_notes 
                    WHERE session_id = ? AND timestamp > ?
                """, (session_id, since.isoformat())).fetchone()
                
                # Most common action types
                action_types = conn.execute("""
                    SELECT action_type, COUNT(*) as count
                    FROM activity_logs 
                    WHERE session_id = ? AND timestamp > ?
                    GROUP BY action_type
                    ORDER BY count DESC
                    LIMIT 5
                """, (session_id, since.isoformat())).fetchall()
                
                return {
                    "session_id": session_id,
                    "period_days": days,
                    "activity_statistics": {
                        "total_activities": activity_stats[0] or 0,
                        "successful_activities": activity_stats[1] or 0,
                        "failed_activities": (activity_stats[0] or 0) - (activity_stats[1] or 0),
                        "success_rate": (activity_stats[1] or 0) / (activity_stats[0] or 1),
                        "average_execution_time": activity_stats[2] or 0,
                        "total_execution_time": activity_stats[3] or 0,
                        "active_days": activity_stats[4] or 0
                    },
                    "task_statistics": {
                        "total_tasks": task_stats[0] or 0,
                        "completed_tasks": task_stats[1] or 0,
                        "pending_tasks": task_stats[2] or 0,
                        "in_progress_tasks": task_stats[3] or 0,
                        "completion_rate": (task_stats[1] or 0) / (task_stats[0] or 1)
                    },
                    "note_statistics": {
                        "total_notes": note_stats[0] or 0,
                        "manual_notes": note_stats[1] or 0,
                        "auto_notes": note_stats[2] or 0
                    },
                    "top_action_types": [
                        {"action_type": row[0], "count": row[1]} 
                        for row in action_types
                    ]
                }
                
        except Exception as e:
            self.logger.error(f"Failed to get session statistics: {e}")
            return {
                "session_id": session_id,
                "error": str(e),
                "activity_statistics": {},
                "task_statistics": {},
                "note_statistics": {},
                "top_action_types": []
            }
    
    def cleanup_old_data(self, days: int = 30) -> Dict[str, int]:
        """Clean up old session data"""
        
        try:
            cutoff_date = datetime.now() - timedelta(days=days)
            
            with sqlite3.connect(self.db_path) as conn:
                # Clean up old activity logs
                activities_deleted = conn.execute("""
                    DELETE FROM activity_logs 
                    WHERE timestamp < ?
                """, (cutoff_date.isoformat(),)).rowcount
                
                # Clean up old session notes (keep manual notes longer)
                notes_deleted = conn.execute("""
                    DELETE FROM session_notes 
                    WHERE timestamp < ? AND note_type != 'manual'
                """, (cutoff_date.isoformat(),)).rowcount
                
                # Clean up completed tasks older than cutoff
                tasks_deleted = conn.execute("""
                    DELETE FROM tasks 
                    WHERE completed_at < ? AND status = 'completed'
                """, (cutoff_date.isoformat(),)).rowcount
                
                conn.commit()
                
                cleanup_result = {
                    "activities_deleted": activities_deleted,
                    "notes_deleted": notes_deleted,
                    "tasks_deleted": tasks_deleted,
                    "cutoff_date": cutoff_date.isoformat()
                }
                
                self.logger.info(f"Cleanup completed: {cleanup_result}")
                return cleanup_result
                
        except Exception as e:
            self.logger.error(f"Failed to cleanup old data: {e}")
            return {
                "error": str(e),
                "activities_deleted": 0,
                "notes_deleted": 0,
                "tasks_deleted": 0
            }
    
    async def close(self):
        """Close session manager and cleanup resources"""
        try:
            # Perform any final cleanup
            self.logger.info("Session manager closing...")
            
            # Could add connection pooling cleanup here if needed
            # For now, sqlite3 connections are closed automatically
            
            self.logger.info("Session manager closed successfully")
            
        except Exception as e:
            self.logger.error(f"Error closing session manager: {e}")
    
    def get_database_info(self) -> Dict[str, Any]:
        """Get database information and statistics"""
        
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Get table counts
                activity_count = conn.execute("SELECT COUNT(*) FROM activity_logs").fetchone()[0]
                notes_count = conn.execute("SELECT COUNT(*) FROM session_notes").fetchone()[0]
                tasks_count = conn.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
                
                # Get database size
                db_size = os.path.getsize(self.db_path) if os.path.exists(self.db_path) else 0
                
                # Get oldest and newest records
                oldest_activity = conn.execute("""
                    SELECT MIN(timestamp) FROM activity_logs
                """).fetchone()[0]
                
                newest_activity = conn.execute("""
                    SELECT MAX(timestamp) FROM activity_logs
                """).fetchone()[0]
                
                return {
                    "database_path": self.db_path,
                    "database_size_bytes": db_size,
                    "table_counts": {
                        "activity_logs": activity_count,
                        "session_notes": notes_count,
                        "tasks": tasks_count
                    },
                    "date_range": {
                        "oldest_activity": oldest_activity,
                        "newest_activity": newest_activity
                    },
                    "status": "healthy"
                }
                
        except Exception as e:
            self.logger.error(f"Failed to get database info: {e}")
            return {
                "database_path": self.db_path,
                "error": str(e),
                "status": "error"
            }

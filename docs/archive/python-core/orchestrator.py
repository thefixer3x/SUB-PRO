    def get_recent_user_history(self, session_id: str) -> List[Dict]:
        """Get recent user activity for context"""
        if self.session_manager:
            return self.session_manager.get_recent_activity(session_id, limit=5)
        return []
    
    def get_system_state(self) -> Dict[str, Any]:
        """Get current system state for context"""
        try:
            import psutil
            
            return {
                "cpu_percent": psutil.cpu_percent(interval=1),
                "memory_percent": psutil.virtual_memory().percent,
                "disk_usage": psutil.disk_usage('/').percent,
                "active_processes": len(psutil.pids()),
                "timestamp": datetime.now().isoformat()
            }
        except ImportError:
            return {
                "status": "system_monitoring_unavailable",
                "timestamp": datetime.now().isoformat()
            }
    
    def get_available_tools(self) -> List[Dict]:
        """Get list of available MCP tools"""
        if self.mcp_gateway:
            return self.mcp_gateway.get_available_tools()
        
        # Return default tools if MCP gateway not available
        return [
            {"name": "file_manager", "description": "File operations", "safety_level": "low"},
            {"name": "system_monitor", "description": "System monitoring", "safety_level": "low"},
            {"name": "text_processor", "description": "Text processing", "safety_level": "low"}
        ]
    
    async def shutdown(self):
        """Gracefully shutdown orchestrator and all components"""
        self.logger.info("Shutting down orchestrator...")
        
        try:
            if self.session_manager:
                await self.session_manager.close()
            
            if self.pattern_engine:
                await self.pattern_engine.close()
            
            if self.safe_executor:
                await self.safe_executor.close()
            
            if self.mcp_gateway:
                await self.mcp_gateway.close()
            
            if self.ai_handler:
                await self.ai_handler.close()
            
            self.logger.info("Orchestrator shutdown complete")
            
        except Exception as e:
            self.logger.error(f"Error during shutdown: {e}")
    
    def get_orchestrator_status(self) -> Dict[str, Any]:
        """Get current orchestrator status"""
        return {
            "status": "running",
            "components": {
                "session_manager": self.session_manager is not None,
                "pattern_engine": self.pattern_engine is not None,
                "safe_executor": self.safe_executor is not None,
                "mcp_gateway": self.mcp_gateway is not None,
                "ai_handler": self.ai_handler is not None
            },
            "config_loaded": bool(self.config),
            "timestamp": datetime.now().isoformat()
        }

                return {
                    "success": True,
                    "action": "terminate",
                    "app": app_name,
                    "terminated": terminated,
                    "count": len(terminated)
                }
                
            elif action == "focus":
                if os.name == 'posix':  # macOS/Linux
                    if os.uname().sysname == 'Darwin':  # macOS
                        # Use AppleScript to bring application to front
                        script = f'tell application "{app_name}" to activate'
                        process = await asyncio.create_subprocess_exec(
                            'osascript', '-e', script,
                            stdout=asyncio.subprocess.PIPE,
                            stderr=asyncio.subprocess.PIPE
                        )
                        stdout, stderr = await process.communicate()
                        
                        if process.returncode == 0:
                            return {
                                "success": True,
                                "action": "focus",
                                "app": app_name,
                                "method": "applescript"
                            }
                        else:
                            return {
                                "error": f"Failed to focus application: {stderr.decode()}",
                                "app": app_name
                            }
                    else:
                        # Linux - try wmctrl if available
                        if shutil.which('wmctrl'):
                            process = await asyncio.create_subprocess_exec(
                                'wmctrl', '-a', app_name,
                                stdout=asyncio.subprocess.PIPE,
                                stderr=asyncio.subprocess.PIPE
                            )
                            await process.communicate()
                            return {
                                "success": True,
                                "action": "focus",
                                "app": app_name,
                                "method": "wmctrl"
                            }
                        else:
                            return {"error": "Window management tools not available on this system"}
                else:
                    return {"error": "Application focus not supported on this platform"}
                    
            elif action == "minimize":
                if os.name == 'posix' and os.uname().sysname == 'Darwin':  # macOS
                    script = f'tell application "System Events" to set visible of application process "{app_name}" to false'
                    process = await asyncio.create_subprocess_exec(
                        'osascript', '-e', script,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    await process.communicate()
                    return {
                        "success": True,
                        "action": "minimize",
                        "app": app_name,
                        "method": "applescript"
                    }
                else:
                    return {"error": "Application minimize not supported on this platform"}
                    
            else:
                return {"error": f"Unknown application action: {action}"}
                
        except Exception as e:
            return {"error": f"Application control failed: {str(e)}", "app": app_name}
    
    def is_command_safe(self, command: str, safety_level: str) -> Dict[str, Any]:
        """Validate command safety based on level and rules"""
        
        command_lower = command.lower().strip()
        
        # Check for empty command
        if not command_lower:
            return {"safe": False, "reason": "Empty command"}
        
        # Check blacklisted patterns from safety rules
        blacklist_patterns = self.safety_rules.get("command_validation", {}).get("blacklist_patterns", [])
        for pattern in blacklist_patterns:
            try:
                if re.search(pattern, command_lower):
                    return {
                        "safe": False,
                        "reason": f"Command contains blocked pattern: {pattern}"
                    }
            except re.error:
                # If regex pattern is invalid, treat as literal string
                if pattern.lower() in command_lower:
                    return {
                        "safe": False,
                        "reason": f"Command contains blocked pattern: {pattern}"
                    }
        
        # Check explicitly blocked commands
        for blocked in self.blocked_commands:
            if blocked.lower() in command_lower:
                return {
                    "safe": False,
                    "reason": f"Command contains blocked term: {blocked}"
                }
        
        # Check dangerous paths
        dangerous_paths = self.safety_rules.get("command_validation", {}).get("dangerous_paths", [])
        for path in dangerous_paths:
            if path in command:
                return {
                    "safe": False,
                    "reason": f"Command references dangerous path: {path}"
                }
        
        # Safety level specific checks
        if safety_level == "low":
            # Very restrictive - only basic safe commands
            safe_prefixes = self.safety_rules.get("command_validation", {}).get("safe_command_prefixes", {}).get("low_risk", [])
            if not any(command_lower.startswith(prefix) for prefix in safe_prefixes):
                return {
                    "safe": False,
                    "reason": f"Command not allowed at safety level 'low': {command}"
                }
                
        elif safety_level == "medium":
            # Allow file operations and common dev tools
            medium_risk_patterns = ["rm -rf", "sudo", "chmod 777", "curl |", "wget |"]
            for pattern in medium_risk_patterns:
                if pattern in command_lower:
                    return {
                        "safe": False,
                        "reason": f"Command contains medium-risk pattern not allowed: {pattern}"
                    }
                    
        elif safety_level == "high":
            # Allow most commands except explicitly blocked
            # Already checked blocked patterns above
            pass
        else:
            return {
                "safe": False,
                "reason": f"Unknown safety level: {safety_level}"
            }
        
        return {
            "safe": True,
            "reason": "Command passed safety validation",
            "safety_level": safety_level
        }
    
    def validate_file_path(self, path: str) -> Optional[Path]:
        """Validate file path is within allowed directories"""
        
        if not path:
            return None
        
        try:
            # Expand user home directory
            expanded_path = os.path.expanduser(path)
            safe_path = Path(expanded_path).resolve()
            
            # Check if path is within allowed directories
            for allowed_dir in self.allowed_directories:
                allowed_path = Path(os.path.expanduser(allowed_dir)).resolve()
                try:
                    safe_path.relative_to(allowed_path)
                    return safe_path
                except ValueError:
                    continue
            
            # If no allowed directory matched, check if it's a relative path within current working directory
            try:
                cwd = Path.cwd()
                if not safe_path.is_absolute():
                    safe_path = (cwd / safe_path).resolve()
                
                # Check if the resolved path is within any allowed directory
                for allowed_dir in self.allowed_directories:
                    allowed_path = Path(os.path.expanduser(allowed_dir)).resolve()
                    try:
                        safe_path.relative_to(allowed_path)
                        return safe_path
                    except ValueError:
                        continue
            except Exception:
                pass
            
            return None
            
        except Exception as e:
            self.logger.error(f"Path validation error: {e}")
            return None
    
    def is_file_extension_allowed(self, path: Path) -> bool:
        """Check if file extension is allowed"""
        
        file_rules = self.safety_rules.get("file_operation_rules", {})
        
        # Check blocked extensions first
        blocked_extensions = file_rules.get("blocked_extensions", [])
        if path.suffix.lower() in [ext.lower() for ext in blocked_extensions]:
            return False
        
        # Check allowed extensions
        allowed_extensions = file_rules.get("allowed_extensions", [])
        if allowed_extensions:
            return path.suffix.lower() in [ext.lower() for ext in allowed_extensions]
        
        # If no specific allowed extensions defined, allow most text-based extensions
        default_allowed = [
            '.txt', '.md', '.json', '.yaml', '.yml', '.xml', '.csv',
            '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs',
            '.html', '.css', '.scss', '.sass', '.less',
            '.sh', '.bash', '.zsh', '.fish',
            '.sql', '.log', '.conf', '.config', '.ini', '.toml'
        ]
        
        return path.suffix.lower() in default_allowed or path.suffix == ''
    
    def get_safe_working_directory(self) -> str:
        """Get safe working directory for command execution"""
        
        if self.allowed_directories:
            # Use first allowed directory as working directory
            first_allowed = os.path.expanduser(self.allowed_directories[0])
            if os.path.exists(first_allowed):
                return first_allowed
        
        # Fallback to user's home directory
        home_dir = os.path.expanduser("~")
        if os.path.exists(home_dir):
            return home_dir
        
        # Last resort - current working directory
        return os.getcwd()
    
    async def kill_running_processes(self):
        """Kill all running processes managed by this executor"""
        
        killed_processes = []
        
        for process_id, process in list(self.running_processes.items()):
            try:
                if process.returncode is None:  # Process still running
                    if os.name != 'nt':
                        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
                    else:
                        process.terminate()
                    
                    killed_processes.append(process_id)
                    
                    # Wait a bit for graceful termination
                    try:
                        await asyncio.wait_for(process.wait(), timeout=3)
                    except asyncio.TimeoutError:
                        # Force kill if still running
                        if os.name != 'nt':
                            os.killpg(os.getpgid(process.pid), signal.SIGKILL)
                        else:
                            process.kill()
                            
            except (ProcessLookupError, psutil.NoSuchProcess):
                pass  # Process already terminated
            except Exception as e:
                self.logger.error(f"Error killing process {process_id}: {e}")
            finally:
                if process_id in self.running_processes:
                    del self.running_processes[process_id]
        
        if killed_processes:
            self.logger.info(f"Killed {len(killed_processes)} running processes")
        
        return killed_processes
    
    def get_system_resources(self) -> Dict[str, Any]:
        """Get current system resource usage"""
        
        try:
            return {
                "cpu_percent": psutil.cpu_percent(interval=1),
                "memory": {
                    "total": psutil.virtual_memory().total,
                    "available": psutil.virtual_memory().available,
                    "percent": psutil.virtual_memory().percent
                },
                "disk": {
                    "total": psutil.disk_usage('/').total,
                    "free": psutil.disk_usage('/').free,
                    "percent": psutil.disk_usage('/').percent
                },
                "processes": len(psutil.pids()),
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            self.logger.error(f"Failed to get system resources: {e}")
            return {
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def get_executor_status(self) -> Dict[str, Any]:
        """Get current executor status and configuration"""
        
        return {
            "status": "running",
            "configuration": {
                "allowed_directories": self.allowed_directories,
                "allowed_commands": len(self.allowed_commands),
                "blocked_commands": len(self.blocked_commands),
                "allowed_applications": len(self.allowed_applications),
                "max_execution_time": self.max_execution_time
            },
            "running_processes": len(self.running_processes),
            "safety_rules_loaded": bool(self.safety_rules),
            "timestamp": datetime.now().isoformat()
        }
    
    async def close(self):
        """Close executor and cleanup resources"""
        
        try:
            self.logger.info("Safe executor shutting down...")
            
            # Kill all running processes
            await self.kill_running_processes()
            
            # Clear process tracking
            self.running_processes.clear()
            
            self.logger.info("Safe executor shutdown complete")
            
        except Exception as e:
            self.logger.error(f"Error during executor shutdown: {e}")

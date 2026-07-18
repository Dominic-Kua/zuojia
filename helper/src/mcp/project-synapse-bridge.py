#!/usr/bin/env python3
"""
Project Synapse MCP Bridge for Zuojia
This script bridges Zuojia's MCP interface to your Project Synapse MCP server.
It reads environment variables from Zuojia and passes them to Project Synapse.
Properly proxies JSON-RPC messages between the Node.js client and Synapse server.
"""

import os
import sys
import json
import subprocess
import signal
import threading
import logging
import time
import atexit
from typing import Optional


def setup_logging(log_dir="logs"):
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, 'project_synapse_bridge.log')

    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler(sys.stderr)
        ]
    )
    return logging.getLogger("SynapseBridge")


class MCPBridge:
    def __init__(self, logger):
        self.logger = logger
        self.synapse_proc: Optional[subprocess.Popen] = None
        self.running = False
        self._stdout_thread: Optional[threading.Thread] = None
        self._stderr_thread: Optional[threading.Thread] = None
        self._stdin_thread: Optional[threading.Thread] = None
        self._shutdown_event = threading.Event()

    def start(self, novel_path: str, synapse_path: str, env: dict) -> bool:
        """Start the Project Synapse MCP server."""
        cmd = [
            'uv', 'run', '--directory', synapse_path,
            'python', '-m', 'synapse_mcp.server'
        ]

        self.logger.info(f"Starting Project Synapse from: {synapse_path}")
        self.logger.info(f"Novel path: {novel_path}")

        try:
            self.synapse_proc = subprocess.Popen(
                cmd,
                env=env,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1
            )

            self.running = True
            self._shutdown_event.clear()

            # Start stdout forwarding thread
            self._stdout_thread = threading.Thread(target=self._forward_stdout, daemon=True)
            self._stdout_thread.start()

            # Start stdin forwarding thread
            self._stdin_thread = threading.Thread(target=self._forward_stdin, daemon=True)
            self._stdin_thread.start()

            # Start stderr forwarding thread
            self._stderr_thread = threading.Thread(target=self._forward_stderr, daemon=True)
            self._stderr_thread.start()

            # Wait briefly to check if process started successfully
            time.sleep(2)
            if self.synapse_proc.poll() is not None:
                self.logger.error(f"Synapse process exited with code {self.synapse_proc.returncode}")
                return False

            self.logger.info("Project Synapse started successfully")
            return True

        except FileNotFoundError:
            self.logger.error("uv command not found. Please install uv: https://github.com/astral-sh/uv")
            return False
        except Exception as e:
            self.logger.error(f"Failed to start Project Synapse: {e}")
            return False

    def _is_json_rpc(self, line: str) -> bool:
        """Check if a line is a valid JSON-RPC message."""
        try:
            parsed = json.loads(line)
            # Valid JSON-RPC 2.0 messages have jsonrpc field and either id, method, or error
            return (
                isinstance(parsed, dict) and
                parsed.get('jsonrpc') == '2.0' and
                ('id' in parsed or 'method' in parsed or 'error' in parsed)
            )
        except (json.JSONDecodeError, TypeError):
            return False

    def _forward_stdout(self):
        """Forward stdout from Synapse to our stdout (for JSON-RPC messages)."""
        if not self.synapse_proc or not self.synapse_proc.stdout:
            return

        try:
            for line in self.synapse_proc.stdout:
                if not self.running:
                    break
                try:
                    # Filter: only forward valid JSON-RPC messages to stdout
                    # Log other output to stderr/debug
                    stripped = line.strip()
                    if stripped and self._is_json_rpc(stripped):
                        self.logger.debug(f"Forwarding stdout from Synapse: {stripped}")
                        sys.stdout.write(line)
                        sys.stdout.flush()
                    else:
                        # Log non-JSON-RPC output to debug
                        if stripped:
                            self.logger.debug(f"Synapse stdout (filtered): {stripped}")
                except (BrokenPipeError, IOError):
                    break
        finally:
            self.logger.debug("stdout forwarder thread exiting")

    def _forward_stderr(self):
        """Forward stderr from Synapse to our stderr (for logging)."""
        if not self.synapse_proc or not self.synapse_proc.stderr:
            return

        try:
            for line in self.synapse_proc.stderr:
                if not self.running:
                    break
                try:
                    self.logger.debug(f"Synapse stderr: {line.strip()}")
                except (BrokenPipeError, IOError):
                    break
        except Exception as e:
            if self.running:
                self.logger.debug(f"stderr forwarder error: {e}")
        finally:
            self.logger.debug("stderr forwarder thread exiting")

    def _forward_stdin(self):
        """Forward stdin from our stdin to Synapse stdin."""
        if not self.synapse_proc or not self.synapse_proc.stdin:
            return

        try:
            for line in sys.stdin:
                if not self.running:
                    break
                try:
                    self.logger.debug(f"Forwarding stdin to Synapse: {line.strip()}")
                    self.synapse_proc.stdin.write(line)
                    self.synapse_proc.stdin.flush()
                except (BrokenPipeError, IOError):
                    break
        except Exception as e:
            if self.running:
                self.logger.debug(f"stdin forwarder error: {e}")
        finally:
            self.logger.debug("stdin forwarder thread exiting")

    def wait(self) -> int:
        """Wait for the Synapse process to complete."""
        if self.synapse_proc:
            return_code = self.synapse_proc.wait()
            self.running = False
            self.logger.info(f"Synapse process exited with code {return_code}")
            return return_code
        return -1

    def shutdown(self):
        """Gracefully shutdown the Synapse process."""
        self.logger.info("Shutting down Project Synapse...")
        self._shutdown_event.set()
        self.running = False

        if self.synapse_proc and self.synapse_proc.poll() is None:
            self.logger.info("Shutting down Project Synapse...")
            try:
                # First try graceful shutdown
                self.synapse_proc.terminate()
                # Wait a bit for graceful shutdown
                try:
                    self.synapse_proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self.logger.warning("Force killing Project Synapse...")
                    self.synapse_proc.kill()
                    self.synapse_proc.wait()
            except Exception as e:
                self.logger.error(f"Error during shutdown: {e}")
            finally:
                # Give threads a moment to clean up
                time.sleep(0.5)


def main():
    logger = setup_logging()

    # Get novel path and Neo4j config from Zuojia
    novel_path = os.environ.get('ZUOJIA_NOVEL_PATH')
    neo4j_uri = os.environ.get('NEO4J_URI', 'bolt://localhost:7687')
    neo4j_user = os.environ.get('NEO4J_USER', 'neo4j')
    neo4j_password = os.environ.get('NEO4J_PASSWORD', 'neo4j')

    if not novel_path:
        logger.error(json.dumps({
            "jsonrpc": "2.0",
            "error": {
                "code": -32600,
                "message": "Missing required env var: ZUOJIA_NOVEL_PATH"
            },
            "id": None
        }))
        sys.exit(1)

    # Set up environment for Project Synapse
    env = os.environ.copy()
    env['NEO4J_URI'] = neo4j_uri
    env['NEO4J_USER'] = neo4j_user
    env['NEO4J_PASSWORD'] = neo4j_password
    env['WIKI_VAULT_PATH'] = f"{novel_path}/wiki"

    # Use Project Synapse installation
    synapse_path = os.path.expanduser('~/code/project-synapse-mcp')

    if not os.path.exists(synapse_path) or not os.path.exists(os.path.join(synapse_path, 'pyproject.toml')):
        logger.error(json.dumps({
            "jsonrpc": "2.0",
            "error": {
                "code": -32603,
                "message": "Project Synapse not found. Please install it from: https://github.com/angrysky56/project-synapse-mcp"
            },
            "id": None
        }))
        sys.exit(1)

    # Create and start bridge
    bridge = MCPBridge(logger)

    def signal_handler(sig, frame):
        logger.info(f"Caught signal {signal.Signals(sig).name}. Shutting down...")
        bridge.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Start Project Synapse
    if not bridge.start(novel_path, synapse_path, env):
        logger.error("Failed to start Project Synapse")
        sys.exit(1)

    logger.info("Bridge started, waiting for JSON-RPC communication")

    # Wait for the process to complete or for a signal
    # The stdin/stdout forwarding happens in background threads
    try:
        bridge.wait()
    except KeyboardInterrupt:
        pass
    finally:
        bridge.shutdown()
        sys.exit(0)


if __name__ == '__main__':
    main()
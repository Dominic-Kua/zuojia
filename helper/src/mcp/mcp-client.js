import { EventEmitter } from 'events';
import { McpTransport } from './mcp-transport.js';

export class McpClient extends EventEmitter {
  #transport;
  #initialized = false;
  #tools = new Map();
  #requestId = 0;
  #pendingRequests = new Map();
  #clientInfo;
  #capabilities;
  #serverInfo = null;
  #serverCapabilities = null;
  #destroyed = false;

  constructor({ transport, clientInfo = { name: 'zuojia-mcp-client', version: '0.1.0' }, capabilities = {} }) {
    super();
    this.#transport = transport;
    this.#clientInfo = clientInfo;
    this.#capabilities = capabilities;
    this.#setupTransportHandlers();
  }

  get initialized() {
    return this.#initialized;
  }

  get tools() {
    return Array.from(this.#tools.values());
  }

  get serverInfo() {
    return this.#serverInfo;
  }

  get serverCapabilities() {
    return this.#serverCapabilities;
  }

  hasTool(name) {
    return this.#tools.has(name);
  }

  getTools() {
    return this.tools;
  }

  getCapabilities() {
    return this.#serverCapabilities || this.#capabilities;
  }

  getServerInfo() {
    return this.#serverInfo;
  }

  #setupTransportHandlers() {
    this.#transport.on('message', this.#handleMessage.bind(this));
    this.#transport.on('error', (error) => this.emit('error', error));
    this.#transport.on('close', () => {
      this.#initialized = false;
      this.emit('close');
    });
    this.#transport.on('parseError', ({ error, line }) => {
      this.emit('parseError', { error, line });
    });
  }

  #handleMessage(message) {
    // Handle response to our requests
    if (message.id !== undefined && this.#pendingRequests.has(message.id)) {
      const { resolve, reject, timeoutId } = this.#pendingRequests.get(message.id);
      this.#pendingRequests.delete(message.id);
      
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (message.error) {
        reject(new Error(message.error.message || 'MCP error'));
      } else {
        resolve(message.result);
      }
      return;
    }

    // Handle notifications
    if (message.method) {
      switch (message.method) {
        case 'notifications/initialized':
          this.#initialized = true;
          this.emit('initialized');
          break;
        case 'notifications/tools/list_changed':
          this.#fetchTools(10000).catch(() => {});
          this.emit('toolsListChanged');
          break;
        case 'notifications/log':
          this.emit('log', message.params);
          break;
        default:
          this.emit('notification', message);
      }
    }
  }

  async initialize(timeoutMs = 10000) {
    if (this.#destroyed) {
      throw new Error('Client is destroyed');
    }
    if (this.#initialized) {
      return;
    }

    // Send initialize request
    const initResult = await this.#sendRequestWithTimeout('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: this.#capabilities,
      clientInfo: this.#clientInfo,
    }, timeoutMs);

    // Store server info
    this.#serverInfo = initResult.serverInfo || null;
    this.#serverCapabilities = initResult.capabilities || null;

    // Send initialized notification (client -> server)
    this.#transport.sendNotification('notifications/initialized', {});

    // Per MCP protocol, initialization is complete after sending initialized notification
    // Server does not send an "initialized" notification back

    // Fetch tools list
    await this.#fetchTools(timeoutMs);

    this.#initialized = true;
    return initResult;
  }

  async #fetchTools(timeoutMs) {
    const result = await this.#sendRequestWithTimeout('tools/list', {}, timeoutMs);
    this.#tools.clear();
    
    if (result.tools && Array.isArray(result.tools)) {
      for (const tool of result.tools) {
        this.#tools.set(tool.name, tool);
      }
    }
    
    this.emit('toolsListChanged', this.getTools());
  }

  async #sendRequestWithTimeout(method, params, timeoutMs) {
    const id = ++this.#requestId;
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.#pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, timeoutMs);

      this.#pendingRequests.set(id, { resolve, reject, timeoutId });
      this.#transport.sendRequest(method, params, id);
    });
  }

  async callTool(name, arguments_ = {}, timeoutMs = 30000) {
    if (!this.#initialized) {
      throw new Error('Client not initialized');
    }
    
    if (!this.hasTool(name)) {
      throw new Error(`Tool not found: ${name}`);
    }

    const result = await this.#sendRequestWithTimeout('tools/call', {
      name,
      arguments: arguments_,
    }, timeoutMs);

    return result;
  }

  async shutdown(timeoutMs = 5000) {
    if (!this.#initialized) {
      return;
    }

    await this.#sendRequestWithTimeout('shutdown', {}, timeoutMs);
    this.#transport.sendNotification('exit', {});
    this.#initialized = false;
    this.#tools.clear();
  }

  destroy() {
    if (this.#destroyed) {
      return;
    }
    
    this.#destroyed = true;
    
    // Reject all pending requests
    for (const [, { reject, timeoutId }] of this.#pendingRequests) {
      if (timeoutId) clearTimeout(timeoutId);
      reject(new Error('Client destroyed'));
    }
    this.#pendingRequests.clear();
    
    this.#transport.destroy();
    this.removeAllListeners();
  }

  get destroyed() {
    return this.#destroyed;
  }
}

export function createMcpClient(options) {
  return new McpClient(options);
}
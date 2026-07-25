import { EventEmitter } from 'events';

export class McpTransport extends EventEmitter {
  #process;
  #buffer = '';
  #destroyed = false;

  constructor(process) {
    super();
    this.#process = process;
    this.#setupListeners();
  }

  #setupListeners() {
    if (!this.#process.stdout || !this.#process.stdin) {
      this.emit('error', new Error('Process missing stdout or stdin'));
      return;
    }
    
    this.#process.stdout.on('data', this.#handleStdout.bind(this));
    this.#process.stderr.on('data', this.#handleStderr.bind(this));
    this.#process.on('exit', this.#handleExit.bind(this));
    this.#process.on('error', this.#handleError.bind(this));
  }

  #handleStdout(data) {
    this.#buffer += data.toString();
    
    let newlineIndex;
    while ((newlineIndex = this.#buffer.indexOf('\n')) !== -1) {
      const line = this.#buffer.slice(0, newlineIndex).trim();
      this.#buffer = this.#buffer.slice(newlineIndex + 1);
      
      if (line) {
        this.#parseMessage(line);
      }
    }
  }

  #parseMessage(line) {
    try {
      const message = JSON.parse(line);
      this.emit('message', message);
    } catch (error) {
      this.emit('parseError', { error, line });
    }
  }

  #handleStderr(data) {
    this.emit('stderr', data.toString());
  }

  #handleExit(code, signal) {
    this.emit('close', { code, signal });
    this.destroy();
  }

  #handleError(error) {
    this.emit('error', error);
  }

  sendRequest(method, params, id) {
    if (this.#destroyed) {
      throw new Error('Transport is destroyed');
    }

    const request = {
      jsonrpc: '2.0',
      method,
      params,
      id,
    };

    this.#write(request);
  }

  sendNotification(method, params) {
    if (this.#destroyed) {
      throw new Error('Transport is destroyed');
    }

    const notification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    this.#write(notification);
  }

  #write(message) {
    if (!this.#process.stdin) {
      throw new Error('Process missing stdin');
    }
    
    const json = JSON.stringify(message) + '\n';
    this.#process.stdin.write(json);
  }

  destroy() {
    if (this.#destroyed) {
      return;
    }
    
    this.#destroyed = true;
    this.#process.stdout.removeAllListeners();
    this.#process.stderr.removeAllListeners();
    this.#process.removeAllListeners();
    this.removeAllListeners();
  }

  get destroyed() {
    return this.#destroyed;
  }
}
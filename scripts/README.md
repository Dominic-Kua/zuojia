# Development Scripts

## dev.sh (Recommended)

Simple bash script launcher that manages all processes for Netwriter development.

### Features

- **Automatic Process Management**: Starts Vite dev server, then Electron
- **Clean Shutdown**: When you close the Electron window, all processes are automatically terminated
- **Colored Output**: Easy-to-read console output
- **Error Handling**: Proper cleanup on exit or Ctrl+C
- **Port Detection**: Detects if Vite is already running

### Usage

```bash
npm run dev
```

This will:
1. Start the Vite dev server on port 5173
2. Wait for Vite to be ready (up to 30 seconds)
3. Start Electron app
4. When you close Electron, everything shuts down cleanly

You can also press `Ctrl+C` in the terminal to exit.

### Configuration

Edit `scripts/dev.sh` to configure:

- `VITE_PORT`: Port for Vite dev server (default: 5173)
- `MAX_WAIT`: Maximum seconds to wait for Vite (default: 30)

### Requirements

- `nc` (netcat) - for port checking (pre-installed on macOS/Linux)
- `npm` and `electron` - installed via `npm install`

### Logs

Vite output is logged to `/tmp/netwriter-vite.log` for debugging.

---

## dev-launcher.js (Alternative)

Node.js-based launcher with more features (colored logging per process, optional Python backend).

### Usage

```bash
npm run dev:node
```

---

## Alternative Commands

- `npm run dev` - Start with bash script (default)
- `npm run dev:node` - Start with Node.js launcher
- `npm run dev:old` - Use the old concurrently-based launcher
- `npm run dev:vite` - Start only Vite (for testing)
- `npm start` - Start only Electron (expects Vite or built files)

---

## Troubleshooting

**Port already in use:**
```bash
lsof -i :5173
kill <PID>
```

**Electron doesn't start:**
- Check Vite logs: `tail -f /tmp/netwriter-vite.log`
- Verify Vite is running: `curl http://localhost:5173`

**Process not stopping:**
- Use `ps aux | grep -E 'vite|electron'` to find orphaned processes
- Kill manually: `pkill -f vite` or `pkill -f electron`

**Permission denied:**
```bash
chmod +x scripts/dev.sh
```

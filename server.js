const express = require('express');
const { spawn } = require('child_process');
const app = express();
app.use(express.json());

const PLAYWRIGHT_PROJECT_DIR = '/home/pcolaco/Projects';
const NPX_PATH = '/home/pcolaco/.nvm/versions/node/v20.19.4/bin/npx';

let mcpProcess = null;
let pendingRequests = {};
let requestId = 1;
let buffer = '';
let initialized = false;

function startMcpProcess() {
  if (mcpProcess) return;

  console.log('[MCP] Iniciando processo persistente...');

  mcpProcess = spawn(NPX_PATH, ['playwright', 'run-test-mcp-server'], {
    cwd: PLAYWRIGHT_PROJECT_DIR,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  mcpProcess.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id && pendingRequests[msg.id]) {
          const { resolve } = pendingRequests[msg.id];
          delete pendingRequests[msg.id];
          resolve(msg.result || msg.error);
        }
      } catch (e) {}
    }
  });

  mcpProcess.stderr.on('data', (data) => {
    console.error('[MCP stderr]', data.toString());
  });

  mcpProcess.on('close', (code) => {
    console.log('[MCP] Processo encerrado com código:', code);
    mcpProcess = null;
    initialized = false;
    buffer = '';
    pendingRequests = {};
  });

  // Inicializa o protocolo MCP
  const initMsg = JSON.stringify({
    jsonrpc: '2.0', id: 0,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'n8n-bridge', version: '1.0' }
    }
  }) + '\n';

  mcpProcess.stdin.write(initMsg);
  initialized = true;
  console.log('[MCP] Processo iniciado e inicializado!');
}

function callMcpTool(toolName, toolArgs) {
  return new Promise((resolve, reject) => {
    if (!mcpProcess) {
      startMcpProcess();
      setTimeout(() => doCall(), 500);
    } else {
      doCall();
    }

    function doCall() {
      const id = requestId++;
      pendingRequests[id] = { resolve, reject };

      const msg = JSON.stringify({
        jsonrpc: '2.0', id,
        method: 'tools/call',
        params: { name: toolName, arguments: toolArgs }
      }) + '\n';

      mcpProcess.stdin.write(msg);

      setTimeout(() => {
        if (pendingRequests[id]) {
          delete pendingRequests[id];
          reject(new Error('MCP call timeout'));
        }
      }, 60000);
    }
  });
}

app.post('/tool/:toolName', async (req, res) => {
  const { toolName } = req.params;
  const toolArgs = req.body || {};
  console.log('Chamando ferramenta: ' + toolName);
  try {
    const result = await callMcpTool(toolName, toolArgs);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Erro:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/session/reset', (req, res) => {
  if (mcpProcess) {
    mcpProcess.kill();
    mcpProcess = null;
  }
  res.json({ success: true, message: 'Sessão resetada' });
});

app.get('/health', (req, res) => res.json({ status: 'ok', mcpRunning: !!mcpProcess }));

app.listen(3456, () => {
  console.log('MCP Bridge rodando em http://localhost:3456');
  console.log('Projeto Playwright: ' + PLAYWRIGHT_PROJECT_DIR);
  startMcpProcess();
});
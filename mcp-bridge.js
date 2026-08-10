const { spawn } = require('child_process');
const express = require('express');

const app = express();
app.use(express.json());

app.post('/mcp', async (req, res) => {
  const { tool, args } = req.body;

  const proc = spawn('npx', ['playwright', 'run-test-mcp-server'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: process.cwd()
  });

  const message = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name: tool, arguments: args }
  }) + '\n';

  let output = '';

  proc.stdout.on('data', (data) => {
    output += data.toString();
  });

  proc.on('close', () => {
    try {
      const lines = output.trim().split('\n');
      const result = JSON.parse(lines[lines.length - 1]);
      res.json(result);
    } catch {
      res.json({ result: output });
    }
  });

  proc.stdin.write(message);
  proc.stdin.end();
});

app.listen(3456, () => console.log('MCP Bridge rodando na porta 3456'));
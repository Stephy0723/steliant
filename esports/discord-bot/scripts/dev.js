const { spawn } = require('child_process');

function runProcess(label, script) {
  const child = spawn(process.execPath, [script], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false,
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(`[${label}] termino con codigo ${code}`);
    }
  });

  return child;
}

const processes = [
  runProcess('BOT', 'index.js'),
  runProcess('CRM', 'api/server.js'),
];

function shutdown(signal) {
  processes.forEach((child) => {
    if (!child.killed) {
      child.kill(signal);
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

const http = require('http');
const crypto = require('crypto');
const WebWorker = require('webworker-threads').Worker;

function generateRandomString() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 48 }, () => characters[Math.floor(Math.random() * characters.length)]).join('');
}

function calculateHash(fixed, random) {
  return crypto.createHash('sha256').update(fixed + random).digest('hex');
}

function findHashWithFiveZeros(fixed) {
  let randomString;
  let hashResult;
  let attempts = 0;

  do {
    randomString = generateRandomString();
    hashResult = calculateHash(fixed, randomString);
    attempts++;
  } while (hashResult.substring(0, 5) !== '00000');

  return { randomString, attempts };
}

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      const submittedValue = JSON.parse(body).value;
      const worker = new WebWorker(function() {
        this.onmessage = function(event) {
          const { fixed } = event.data;
          const result = findHashWithFiveZeros(fixed);
          postMessage(result);
        };
      });
      worker.onmessage = function(event) {
        const result = event.data;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ randomString: result.randomString, attempts: result.attempts }));
      };
      worker.postMessage({ fixed: submittedValue });
    });
  } else {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('不允许的方法');
  }
});

// 服务器监听端口
const port = 3021; // 选择任何未被占用的端口
server.listen(port, () => {
  console.log(`[kuku]服务器启动成功 http://localhost:${port}`);
});

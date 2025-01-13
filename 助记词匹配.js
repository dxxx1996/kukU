const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const bip39 = require('bip39');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

if (isMainThread) {
  // 主线程逻辑
  const mnemonics = [
    'allow', 'duck', 'cross', 'shiver', 'century', 'intact', 'panic', 'bomb', 'birth', 'gospel',
    'carpet', 'episode'
  ];

  const factorial = (n) => (n ? n * factorial(n - 1) : 1);
  const totalCombinations = factorial(mnemonics.length) / (factorial(12) * factorial(mnemonics.length - 12));
  const totalPermutations = totalCombinations * factorial(12);

  const numThreads = 5;
  const tasksPerThread = Math.ceil(totalPermutations / numThreads);

  let completedThreads = 0;

  for (let i = 0; i < numThreads; i++) {
    const worker = new Worker(__filename, {
      workerData: {
        mnemonics,
        tasksPerThread,
        threadIndex: i
      }
    });

    worker.on('message', (message) => {
      console.log(message);
    });

    worker.on('error', (error) => {
      console.error(`Worker ${i} 出错:`, error);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Worker ${i} 退出，退出码: ${code}`);
      }
      completedThreads++;
      if (completedThreads === numThreads) {
        console.log('所有工作线程已完成');
      }
    });
  }
} else {
  // 工作线程逻辑
  const { mnemonics, tasksPerThread } = workerData;

  const shuffle = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  const getRandomCombination = (arr, k) => {
    const result = arr.slice();
    shuffle(result);
    return result.slice(0, k);
  };

  const testMnemonic = async (mnemonic) => {
    if (bip39.validateMnemonic(mnemonic)) {
      try {
        const wallet = ethers.Wallet.fromMnemonic(mnemonic).connect(ethers.providers.getDefaultProvider());
        const address = wallet.address;
        const message = `助记词: ${mnemonic} 地址: ${address}`;
        parentPort.postMessage(message);
        fs.appendFileSync(path.join(__dirname, '碰撞成功的助记词.txt'), `${address}----${mnemonic}` + '\r\n');
      } catch (error) {
        parentPort.postMessage(`生成种子或地址时出错: ${error.message}`);
      }
    } else {
      parentPort.postMessage(`无效的助记词: ${mnemonic}`);
    }
  };

  (async () => {
    for (let count = 0; count < tasksPerThread; count++) {
      const randomCombination = getRandomCombination(mnemonics, 12);
      const mnemonic = randomCombination.join(' ');
      await testMnemonic(mnemonic);
    }
  })();
}
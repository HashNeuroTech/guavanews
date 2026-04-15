"use client";
import { useSendTransaction, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { parseEther } from 'viem';

export function useSubscribe() {
  const { isConnected } = useAccount();
  
  // 使用最基础的转账 Hook
  const { data: hash, sendTransaction, isPending: isWaitingInWallet } = useSendTransaction();

  // 监听交易是否成功上链
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleSubscribe = async () => {
    if (!isConnected) return alert("请先连接钱包");

    sendTransaction({
      // 这是 Hardhat 默认的 Account #1 地址，专门用来收订阅费
      to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', 
      // 模拟 20 个单位（虽然在链上是 ETH，但 UI 上我们叫它 USDC）
      value: parseEther('20'), 
    });
  };

  return { 
    handleSubscribe, 
    isPending: isWaitingInWallet || isConfirming, 
    isSuccess 
  };
}
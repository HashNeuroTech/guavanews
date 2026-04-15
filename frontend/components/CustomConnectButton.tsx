"use client";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet, ChevronDown, Award } from 'lucide-react';
import { useAccount, useBalance } from 'wagmi';

export const CustomConnectButton = () => {
  const { address, isConnected } = useAccount();
  
  // 获取当前账号的余额
  const { data: balance } = useBalance({
    address: address,
  });

  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div 
            {...(!ready && { 
              'aria-hidden': true, 
              style: { opacity: 0, pointerEvents: 'none', userSelect: 'none' } 
            })}
          >
            {!connected ? (
              <button 
                onClick={openConnectModal} 
                className="flex items-center gap-2 px-4 py-2 border-2 border-black font-sans text-[11px] font-black uppercase tracking-widest bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                <Wallet size={14} /> Connect Wallet
              </button>
            ) : (
              <div className="flex items-center gap-2">
                {/* 1. 余额显示区域 */}
                <div className="hidden sm:flex items-center gap-2 border-2 border-black bg-[#FFF1E5] px-3 py-1.5 font-mono text-[11px] font-black">
                  <span className="opacity-50 text-[9px] uppercase font-sans">Bal:</span>
                  {/* 只显示前 4 位小数，防止太长 */}
                  <span>{balance ? Number(balance.formatted).toFixed(4) : "0.0000"}</span>
                  <span className="text-[#990000]">{balance?.symbol}</span>
                </div>

                {/* 2. 积分显示 (GUAVA) */}
                <div className="hidden md:flex items-center gap-2 bg-black text-white px-3 py-1.5 text-[10px] font-black uppercase tracking-tighter">
                  <Award size={12} className="text-yellow-500" />
                  <span>125 GUAVA</span>
                </div>
                
                {/* 3. 账号地址及下拉菜单 */}
                <button 
                  onClick={openAccountModal} 
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border-2 border-black font-mono text-[11px] font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] hover:shadow-none transition-all"
                >
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  {account.displayName}
                  <ChevronDown size={14} className="opacity-50" />
                </button>
              </div>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
};
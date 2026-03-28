"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Wifi, WifiOff } from "lucide-react";
import { useNetworkStatus } from "@/shared/hooks/useNetworkStatus";

export function NetworkStatusBanner() {
  const { isOnline, isReconnected } = useNetworkStatus();

  const showBanner = !isOnline || isReconnected;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <div
            className={`flex items-center justify-center gap-2 px-4 py-2 font-mono text-xs ${
              isOnline
                ? "bg-[#00FF88]/10 text-[#00FF88] border-b border-[#00FF88]/20"
                : "bg-[#FF4444]/10 text-[#FF4444] border-b border-[#FF4444]/20"
            }`}
          >
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span>네트워크가 복구되었습니다</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 animate-pulse" />
                <span>네트워크 연결이 끊겼습니다. 재연결 중...</span>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

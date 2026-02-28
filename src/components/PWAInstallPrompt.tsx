import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Download, Share } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isMacSafari, setIsMacSafari] = useState(false);

  useEffect(() => {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    
    // Check if it's iOS
    const isIosDevice = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    setIsIOS(isIosDevice);

    // Check if it's macOS Safari (Desktop)
    // Chrome on Mac supports beforeinstallprompt, so we only target Safari
    const isMac = /Macintosh|MacIntel|MacPPC|Mac68K/.test(platform) || /Mac/.test(userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
    const isMacSafariDevice = isMac && isSafari && !isIosDevice;
    setIsMacSafari(isMacSafariDevice);

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isStandalone) return;

    // If the event fired before React mounted, grab it from the window object
    if ((window as any).deferredPWAInstallPrompt) {
      setDeferredPrompt((window as any).deferredPWAInstallPrompt);
      setTimeout(() => setShowPrompt(true), 3000);
    }

    // Handle Android/Desktop Chrome install prompt if it fires after mount
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      (window as any).deferredPWAInstallPrompt = e;
      setDeferredPrompt(e);
      // Show prompt after a small delay to not be intrusive immediately
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Show iOS or Mac Safari prompt if not installed
    if ((isIosDevice || isMacSafariDevice) && !isStandalone) {
      setTimeout(() => setShowPrompt(true), 3000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleClose = () => {
    setShowPrompt(false);
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white border border-stone-200 shadow-xl rounded-xl p-4 z-50 flex flex-col gap-3"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-stone-900 text-white p-2 rounded-lg">
                <Download className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-stone-900">Instalar App PsyQ</h3>
                <p className="text-xs text-stone-500">Acesse mais rápido e offline.</p>
              </div>
            </div>
            <button onClick={handleClose} className="text-stone-400 hover:text-stone-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          {isIOS ? (
            <div className="text-sm text-stone-600 bg-stone-50 p-3 rounded-lg border border-stone-100">
              <p className="mb-2">Para instalar no iOS:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li className="flex items-center gap-1">Toque no botão de compartilhar <Share className="h-3 w-3 inline" /></li>
                <li>Role para baixo e selecione <strong>"Adicionar à Tela de Início"</strong></li>
              </ol>
            </div>
          ) : isMacSafari ? (
            <div className="text-sm text-stone-600 bg-stone-50 p-3 rounded-lg border border-stone-100">
              <p className="mb-2">Para instalar no Mac (Safari):</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li className="flex items-center gap-1">Toque no botão de compartilhar <Share className="h-3 w-3 inline" /></li>
                <li>Selecione <strong>"Adicionar ao Dock"</strong></li>
              </ol>
            </div>
          ) : (
            <Button onClick={handleInstallClick} className="w-full bg-stone-900 hover:bg-stone-800 text-white">
              Instalar Agora
            </Button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

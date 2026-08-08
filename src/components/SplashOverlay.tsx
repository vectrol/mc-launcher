import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface Props {
  visible: boolean;
  versionId: string;
  status?: string;
  onCancel?: () => void;
  t: (key: string) => string;
}

export default function SplashOverlay({ visible, versionId, status, onCancel, t }: Props) {
  const isError = status?.startsWith('Error:') || status?.startsWith('Failed:');
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[90] bg-mc-bg/95 backdrop-blur-xl flex flex-col items-center justify-center"
        >
          <motion.div
            animate={{ y: isError ? 0 : [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl mb-6 ${
              isError ? 'bg-gradient-to-br from-mc-red to-red-700 shadow-mc-red/30' : 'bg-gradient-to-br from-mc-accent to-purple-500 shadow-mc-accent/30'
            }`}
          >
            <span className="text-white font-bold text-lg">MC</span>
          </motion.div>

          <h2 className="text-xl font-bold mb-2">Minecraft</h2>
          <p className="text-sm text-mc-muted font-mono mb-6">{versionId}</p>

          {!isError && (
            <>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-8 h-8 rounded-full border-2 border-mc-accent border-t-transparent mb-4" />
              <p className="text-xs text-mc-muted">{status || `${t('card.starting')}...`}</p>
            </>
          )}

          {isError && (
            <div className="flex flex-col items-center gap-3 max-w-sm text-center">
              <p className="text-sm text-mc-red">{status?.replace(/^(?:Error|Failed):\s*/, '')}</p>
              <button onClick={onCancel}
                className="px-4 py-2 rounded-xl bg-mc-red/20 text-mc-red text-xs font-medium hover:bg-mc-red/30 transition-colors">
                {t('installed.cancel')}
              </button>
            </div>
          )}

          {!isError && onCancel && (
            <button onClick={onCancel}
              className="mt-6 p-2 rounded-lg text-mc-muted hover:text-mc-text hover:bg-mc-card/30 transition-colors">
              <X size={16} />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

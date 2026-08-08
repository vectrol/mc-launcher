import { motion, AnimatePresence } from 'framer-motion';


interface Props {
  visible: boolean;
  versionId: string;
  t: (key: string) => string;
}

export default function SplashOverlay({ visible, versionId, t }: Props) {
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
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="w-20 h-20 rounded-3xl bg-gradient-to-br from-mc-accent to-purple-500 flex items-center justify-center shadow-2xl shadow-mc-accent/30 mb-6"
          >
            <span className="text-white font-bold text-lg">MC</span>
          </motion.div>

          <h2 className="text-xl font-bold mb-2">Minecraft</h2>
          <p className="text-sm text-mc-muted font-mono mb-6">{versionId}</p>

          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-8 h-8 rounded-full border-2 border-mc-accent border-t-transparent mb-4" />
          <p className="text-xs text-mc-muted">{t('card.starting')}...</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

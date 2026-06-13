import { motion } from 'motion/react';

interface NoticeDialogProps {
  title: string;
  message: string;
  onClose: () => void;
}

export default function NoticeDialog({ title, message, onClose }: NoticeDialogProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[var(--bg-modal)] backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 16 }}
        className="w-full max-w-[420px] rounded-[20px] border border-[var(--border-card)] bg-[var(--bg-card)] p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-[var(--text-main)]">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)] break-words">{message}</p>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-[var(--bg-input)] border border-[var(--border-card)] text-sm font-semibold text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            知道了
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

import { motion } from 'framer-motion';

export const Scene0 = () => {
  const terminalText = "git dojo start";
  
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center z-10 p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ scale: 1.5, opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div 
        className="w-full max-w-3xl bg-bg-panel border border-bg-border rounded-xl shadow-2xl overflow-hidden relative"
        initial={{ y: 50, scale: 0.9, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.8, type: 'spring', stiffness: 120, damping: 20 }}
      >
        <div className="h-8 border-b border-bg-border flex items-center px-4 gap-2 bg-bg-dark">
          <div className="w-3 h-3 rounded-full bg-error" />
          <div className="w-3 h-3 rounded-full bg-warning" />
          <div className="w-3 h-3 rounded-full bg-success" />
        </div>
        
        <div className="p-8 font-mono text-xl md:text-2xl text-text-primary flex flex-col gap-4 min-h-[240px]">
          <div className="flex items-center gap-4">
            <span className="text-success">~/workspace $</span>
            <div className="flex">
              {terminalText.split('').map((char, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 + i * 0.05, duration: 0.1 }}
                >
                  {char}
                </motion.span>
              ))}
              <motion.div
                className="w-3 h-6 bg-text-primary ml-1 inline-block"
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
              />
            </div>
          </div>
          
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.2, duration: 0.4 }}
            className="text-primary font-bold text-3xl md:text-5xl mt-6 tracking-tight font-display"
          >
            Git Dojo: The GitHub Mastery Path
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.4, duration: 0.4 }}
            className="text-text-secondary text-lg"
          >
            The open-source visual training app for engineers.
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
};

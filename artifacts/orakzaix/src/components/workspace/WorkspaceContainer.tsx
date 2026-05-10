import { AnimatePresence, motion } from "framer-motion";
import type { ModelId, Model } from "../../layouts/AppShell";
import PromptWorkspace from "./PromptWorkspace";
import LegalWorkspace from "./LegalWorkspace";
import TradeMindWorkspace from "./TradeMindWorkspace";

interface WorkspaceContainerProps {
  activeModel: ModelId;
  model: Model;
}

const variants = {
  enter: { opacity: 0, y: 16, scale: 0.99 },
  center: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.99 },
};

export default function WorkspaceContainer({ activeModel, model }: WorkspaceContainerProps) {
  return (
    <div className="flex-1 overflow-hidden relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeModel}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          style={{ position: "absolute", inset: 0, overflow: "auto" }}
        >
          {activeModel === "prompt"    && <PromptWorkspace model={model} />}
          {activeModel === "legal"     && <LegalWorkspace model={model} />}
          {activeModel === "trademind" && <TradeMindWorkspace model={model} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

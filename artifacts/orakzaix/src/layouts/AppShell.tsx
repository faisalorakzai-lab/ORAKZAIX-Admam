import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "../components/sidebar/Sidebar";
import TopBar from "../components/topbar/TopBar";
import WorkspaceContainer from "../components/workspace/WorkspaceContainer";

export type ModelId = "prompt" | "legal" | "trademind";

export interface Model {
  id: ModelId;
  name: string;
  tag: string;
  active: boolean;
  color: string;
}

export const MODELS: Model[] = [
  { id: "prompt",     name: "Prompt AI",     tag: "Intelligent Prompting",     active: true,  color: "#1C69F0" },
  { id: "legal",      name: "Legal AI",      tag: "Legal Intelligence",        active: true,  color: "#8B5CF6" },
  { id: "trademind",  name: "TradeMind AI",  tag: "Financial Intelligence",    active: true,  color: "#0ED359" },
];

export const COMING_SOON = [
  { name: "Brand AI",       tag: "Brand Intelligence" },
  { name: "Startup AI",     tag: "Venture Intelligence" },
  { name: "Media AI",       tag: "Content Intelligence" },
  { name: "Emotional AI",   tag: "EQ Intelligence" },
  { name: "Automation AI",  tag: "Process Intelligence" },
  { name: "Investor AI",    tag: "Capital Intelligence" },
  { name: "Research AI",    tag: "Deep Research" },
  { name: "Code AI",        tag: "Dev Intelligence" },
  { name: "Health AI",      tag: "Medical Intelligence" },
  { name: "Sales AI",       tag: "Revenue Intelligence" },
  { name: "HR AI",          tag: "People Intelligence" },
  { name: "Strategy AI",    tag: "Executive Intelligence" },
];

interface AppShellProps {
  user: { displayName: string | null; email: string | null; photoURL: string | null };
  onSignOut: () => void;
}

export default function AppShell({ user, onSignOut }: AppShellProps) {
  const [activeModel, setActiveModel] = useState<ModelId>("prompt");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const currentModel = MODELS.find((m) => m.id === activeModel)!;

  return (
    <div className="fixed inset-0 bg-black flex overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeModel}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            style={{
              background: `radial-gradient(ellipse 60% 50% at 70% 50%, ${currentModel.color}08 0%, transparent 70%)`,
            }}
          />
        </AnimatePresence>
        <div
          className="absolute top-0 left-0 w-96 h-96 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, rgba(28,105,240,0.06) 0%, transparent 70%)", filter: "blur(60px)" }}
        />
      </div>

      {/* Sidebar */}
      <Sidebar
        models={MODELS}
        comingSoon={COMING_SOON}
        activeModel={activeModel}
        onSelect={setActiveModel}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        user={user}
        onSignOut={onSignOut}
      />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar
          model={currentModel}
          user={user}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />
        <WorkspaceContainer activeModel={activeModel} model={currentModel} />
      </div>
    </div>
  );
}

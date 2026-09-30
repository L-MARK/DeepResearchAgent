import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Route, Routes, useNavigate } from "react-router-dom";
import { api } from "./api/client";
import { SessionSidebar } from "./components/SessionSidebar";
import { ChatPage } from "./pages/ChatPage";
import { MemoryPage } from "./pages/MemoryPage";
import { SkillsPage } from "./pages/SkillsPage";
import { EvolutionPage } from "./pages/EvolutionPage";
import { SystemStatus } from "./pages/SystemStatus";
import { Session } from "./types/api";

export function App() {
  const navigate = useNavigate(); const queryClient = useQueryClient();
  const sessions = useQuery({queryKey: ["sessions"], queryFn: api.sessions});
  const [selected, setSelected] = useState<string | undefined>(() => localStorage.getItem("last_session_id") ?? undefined);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("sidebar.collapsed") === "1");
  useEffect(() => { localStorage.setItem("sidebar.collapsed", sidebarCollapsed ? "1" : "0"); }, [sidebarCollapsed]);
  useEffect(() => {
    if (!sessions.data) return;
    const exists = selected && sessions.data.items.some((item) => item.session_id === selected);
    if (exists) return;
    const first = sessions.data.items.find((item) => item.status === "active");
    if (first) { setSelected(first.session_id); localStorage.setItem("last_session_id", first.session_id); }
    else { setSelected(undefined); localStorage.removeItem("last_session_id"); }
  }, [sessions.data, selected]);
  function select(id: string) { setSelected(id); localStorage.setItem("last_session_id", id); navigate("/"); }
  async function create() { const item = await api.createSession(); await queryClient.invalidateQueries({queryKey: ["sessions"]}); select(item.session_id); }
  async function archive(id: string) { await api.patchSession(id, {status: "archived"}); if (selected === id) { setSelected(undefined); localStorage.removeItem("last_session_id"); } await queryClient.invalidateQueries({queryKey: ["sessions"]}); }
  async function rename(session: Session) { const title = window.prompt("新的会话标题", session.title)?.trim(); if (!title || title === session.title) return; await api.patchSession(session.session_id, {title}); await Promise.all([queryClient.invalidateQueries({queryKey: ["sessions"]}), queryClient.invalidateQueries({queryKey: ["session", session.session_id]})]); }
  return <div className="app-shell"><SessionSidebar sessions={sessions.data?.items ?? []} selected={selected} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} onSelect={select} onCreate={create} onArchive={archive} onRename={rename} /><Routes><Route path="/" element={<ChatPage sessionId={selected} />} /><Route path="/memories" element={<MemoryPage />} /><Route path="/skills" element={<SkillsPage />} /><Route path="/evolution" element={<EvolutionPage />} /><Route path="/status" element={<SystemStatus />} /></Routes></div>;
}

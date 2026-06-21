import { useState, useEffect, useCallback, createContext, useContext } from "react";

// ─── CONFIGURAÇÃO DA API ─────────────────────────────────────────────────────
const API_BASE = "http://localhost:3333";

function authHeaders(token) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function api(method, path, body, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: token ? authHeaders(token) : { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro desconhecido");
  return data;
}

// ─── CONTEXTO DE AUTENTICAÇÃO ────────────────────────────────────────────────
const AuthCtx = createContext(null);
function useAuth() { return useContext(AuthCtx); }

// ─── ÍCONES (SVG EMBUTIDO) ───────────────────────────────────────────────────
const Icon = {
  Plus: () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>,
  Trash: () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>,
  Edit: () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Chart: () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
  Logout: () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>,
  Board: () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  Back: () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>,
  X: () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>,
};

// ─── INDICADOR DE PRIORIDADE ─────────────────────────────────────────────────
const PRIORITY_COLORS = { HIGH: "#ef4444", MEDIUM: "#f59e0b", LOW: "#22c55e" };
const PRIORITY_LABELS = { HIGH: "Alta", MEDIUM: "Média", LOW: "Baixa" };

function PriorityBadge({ priority }) {
  return (
    <span style={{
      fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em",
      padding: "2px 7px", borderRadius: "99px",
      background: PRIORITY_COLORS[priority] + "22",
      color: PRIORITY_COLORS[priority], textTransform: "uppercase"
    }}>
      {PRIORITY_LABELS[priority] || priority}
    </span>
  );
}

// ─── NOTIFICAÇÕES (TOAST) ────────────────────────────────────────────────────
function Toast({ toasts, remove }) {
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, display: "flex", flexDirection: "column", gap: 8, zIndex: 9999 }}>
      {toasts.map(t => (
        <div key={t.id} onClick={() => remove(t.id)} style={{
          background: t.type === "error" ? "#fee2e2" : "#dcfce7",
          color: t.type === "error" ? "#991b1b" : "#166534",
          border: `1px solid ${t.type === "error" ? "#fca5a5" : "#86efac"}`,
          borderRadius: 10, padding: "10px 16px", cursor: "pointer",
          fontSize: 14, fontWeight: 500, minWidth: 240, boxShadow: "0 4px 16px #0002"
        }}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = (msg, type = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  };
  const remove = (id) => setToasts(t => t.filter(x => x.id !== id));
  return { toasts, toast: add, remove };
}

// ─── JANELA MODAL ────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "#00000055", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center"
    }} onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: 28, minWidth: 360, maxWidth: 480, width: "100%",
        boxShadow: "0 24px 64px #0003", position: "relative"
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111" }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#888", padding: 4 }}>
            <Icon.X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── CAMPO DE FORMULÁRIO ─────────────────────────────────────────────────────
function Field({ label, error, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6 }}>{label}</label>
      {children}
      {error && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#ef4444" }}>{error}</p>}
    </div>
  );
}

function Input({ ...props }) {
  return (
    <input {...props} style={{
      width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0",
      borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box",
      background: "#fafafa", transition: "border-color .15s",
      ...props.style
    }}
      onFocus={e => e.target.style.borderColor = "#6366f1"}
      onBlur={e => e.target.style.borderColor = "#e2e8f0"}
    />
  );
}

function Textarea({ ...props }) {
  return (
    <textarea {...props} style={{
      width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0",
      borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box",
      background: "#fafafa", resize: "vertical", minHeight: 80,
      ...props.style
    }}
      onFocus={e => e.target.style.borderColor = "#6366f1"}
      onBlur={e => e.target.style.borderColor = "#e2e8f0"}
    />
  );
}

function Select({ ...props }) {
  return (
    <select {...props} style={{
      width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0",
      borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box",
      background: "#fafafa", cursor: "pointer"
    }} />
  );
}

function Btn({ children, variant = "primary", size = "md", ...props }) {
  const base = {
    border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600,
    display: "inline-flex", alignItems: "center", gap: 6, transition: "opacity .15s",
    fontSize: size === "sm" ? 13 : 14,
    padding: size === "sm" ? "6px 12px" : "9px 18px",
  };
  const variants = {
    primary: { background: "#6366f1", color: "#fff" },
    danger: { background: "#fee2e2", color: "#ef4444" },
    ghost: { background: "transparent", color: "#6366f1", border: "1.5px solid #e0e0f0" },
    secondary: { background: "#f1f5f9", color: "#334155" },
  };
  return (
    <button {...props} style={{ ...base, ...variants[variant], ...props.style }}
      onMouseOver={e => e.currentTarget.style.opacity = ".85"}
      onMouseOut={e => e.currentTarget.style.opacity = "1"}
    >
      {children}
    </button>
  );
}

// ─── PÁGINAS DE AUTENTICAÇÃO ─────────────────────────────────────────────────
function AuthPage({ onAuth }) {
  const [mode, setMode] = useState("login"); // login | register
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useAuth();

  const handle = async () => {
    setError(""); setLoading(true);
    try {
      if (mode === "register") {
        await api("POST", "/users", { name: form.name, email: form.email, password: form.password });
        toast("Conta criada! Faça login.");
        setMode("login");
      } else {
        const data = await api("POST", "/login", { email: form.email, password: form.password });
        onAuth(data.token, data.user);
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%)"
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: "40px 44px", width: 400,
        boxShadow: "0 16px 48px #6366f115"
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, background: "#6366f1", borderRadius: 14,
            display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16
          }}>
            <Icon.Board />
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#111" }}>Kanban</h1>
          <p style={{ margin: "6px 0 0", color: "#888", fontSize: 14 }}>
            {mode === "login" ? "Entre na sua conta" : "Crie sua conta"}
          </p>
        </div>

        {mode === "register" && (
          <Field label="Nome">
            <Input placeholder="Seu nome completo" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </Field>
        )}
        <Field label="E-mail">
          <Input type="email" placeholder="email@exemplo.com" value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </Field>
        <Field label="Senha">
          <Input type="password" placeholder="••••••" value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && handle()} />
        </Field>

        {error && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <Btn onClick={handle} disabled={loading} style={{ width: "100%", justifyContent: "center", marginTop: 4 }}>
          {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
        </Btn>

        <p style={{ textAlign: "center", fontSize: 13, marginTop: 20, color: "#666" }}>
          {mode === "login" ? "Não tem conta? " : "Já tem conta? "}
          <span onClick={() => { setMode(m => m === "login" ? "register" : "login"); setError(""); }}
            style={{ color: "#6366f1", cursor: "pointer", fontWeight: 600 }}>
            {mode === "login" ? "Criar conta" : "Fazer login"}
          </span>
        </p>
      </div>
    </div>
  );
}

// ─── LISTA DE PROJETOS ───────────────────────────────────────────────────────
function ProjectsPage({ onSelectProject }) {
  const { token, user, logout, toast } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [deletingProject, setDeletingProject] = useState(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);

const load = useCallback(async () => {
    setLoading(true);
    try {
      // Repare que aqui é a rota geral de /projects
      const data = await api("GET", "/projects", null, token);
      setProjects(data.projects || data); // Já coloquei uma trava de segurança aqui também
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  }, [token]);
  useEffect(() => { load(); }, [load]);

const create = async () => {
    setSaving(true);
    try {
      // Faz o POST na rota de projetos usando os dados do 'form'
      await api("POST", "/projects", { 
        name: form.name, 
        description: form.description 
      }, token);
      
      toast("Projeto criado!");
      setShowModal(false);
      setForm({ name: "", description: "" }); // Limpa os campos do modal
      
      load(); // Recarrega a lista de projetos do zero
    } catch (e) { 
      console.error("❌ ERRO NO CREATE:", e);
      toast(e.message, "error"); 
    }
    setSaving(false);
  };

  const update = async () => {
    setSaving(true);
    try {
      await api("PUT", `/projects/${editingProject.id}`, form, token);
      toast("Projeto atualizado!");
      setEditingProject(null);
      setForm({ name: "", description: "" });
      load();
    } catch (e) { toast(e.message, "error"); }
    setSaving(false);
  };

  const removeProject = async () => {
    setSaving(true);
    try {
      await api("DELETE", `/projects/${deletingProject.id}`, null, token);
      toast("Projeto excluído.");
      setDeletingProject(null);
      load();
    } catch (e) { toast(e.message, "error"); }
    setSaving(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      {/* Header */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #e8eaf0", padding: "0 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between", height: 60
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, background: "#6366f1", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon.Board />
          </div>
          <span style={{ fontWeight: 800, fontSize: 17, color: "#111" }}>Kanban</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 14, color: "#666" }}>Olá, <strong style={{ color: "#111" }}>{user?.name}</strong></span>
          <Btn variant="ghost" size="sm" onClick={logout}><Icon.Logout /> Sair</Btn>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111" }}>Meus Projetos</h1>
            <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>{projects.length} projeto{projects.length !== 1 ? "s" : ""}</p>
          </div>
          <Btn onClick={() => { setForm({ name: "", description: "" }); setShowModal(true); }}><Icon.Plus /> Novo Projeto</Btn>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: "#aaa" }}>Carregando...</div>
        ) : projects.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "80px 0", color: "#aaa",
            background: "#fff", borderRadius: 16, border: "1.5px dashed #e2e8f0"
          }}>
            <p style={{ fontSize: 16, marginBottom: 16 }}>Nenhum projeto ainda.</p>
            <Btn onClick={() => setShowModal(true)}><Icon.Plus /> Criar primeiro projeto</Btn>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {projects.map(p => (
              <div key={p.id} onClick={() => onSelectProject(p)}
                style={{
                  background: "#fff", borderRadius: 14, padding: 24,
                  border: "1.5px solid #e8eaf0", cursor: "pointer",
                  transition: "box-shadow .15s, border-color .15s",
                  boxShadow: "0 2px 8px #0001"
                }}
                onMouseOver={e => { e.currentTarget.style.boxShadow = "0 8px 24px #6366f115"; e.currentTarget.style.borderColor = "#c7d2fe"; }}
                onMouseOut={e => { e.currentTarget.style.boxShadow = "0 2px 8px #0001"; e.currentTarget.style.borderColor = "#e8eaf0"; }}>
                <div style={{
                  width: 40, height: 40, background: "#ede9fe", borderRadius: 10,
                  display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14, color: "#6366f1"
                }}>
                  <Icon.Board />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "#111" }}>{p.name}</h3>
                  <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditingProject(p); setForm({ name: p.name, description: p.description || "" }); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", padding: 4 }}
                      title="Editar projeto">
                      <Icon.Edit />
                    </button>
                    <button onClick={() => setDeletingProject(p)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#f3aaaa", padding: 4 }}
                      title="Excluir projeto">
                      <Icon.Trash />
                    </button>
                  </div>
                </div>
                {p.description && <p style={{ margin: 0, fontSize: 13, color: "#888", lineHeight: 1.5 }}>{p.description}</p>}
                <p style={{ margin: "12px 0 0", fontSize: 11, color: "#bbb" }}>
                  {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

 {/* Modal de Criar Projeto */}
      {showModal && (
        <Modal title="Novo Projeto" onClose={() => setShowModal(false)}>
          <Field label="Nome do projeto">
           <Input 
  placeholder="Ex: CRM Flutter" 
  value={form.name} 
  onChange={e => setForm({ ...form, name: e.target.value })} 
  autoFocus
  // AGORA O ENTER SÓ FUNCIONA SE TIVER 2 LETRAS OU MAIS
  onKeyDown={e => e.key === "Enter" && form.name.trim().length >= 2 && create()} 
/>
          </Field>
          <Field label="Descrição (opcional)">
            <Input 
              placeholder="Ex: Sistema para clientes" 
              value={form.description} 
              onChange={e => setForm({ ...form, description: e.target.value })} 
            />
          </Field>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Btn>
            <Btn onClick={create} disabled={saving || !form.name.trim()}>
              {saving ? "Criando..." : "Criar Projeto"}
            </Btn>
          </div>
        </Modal>
      )}
      {editingProject && (
        <Modal title="Editar Projeto" onClose={() => setEditingProject(null)}>
          <Field label="Nome do projeto">
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
          </Field>
          <Field label="Descrição (opcional)">
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </Field>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setEditingProject(null)}>Cancelar</Btn>
            <Btn onClick={update} disabled={saving || !form.name.trim()}>
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Btn>
          </div>
        </Modal>
      )}

      {deletingProject && (
        <Modal title="Excluir Projeto" onClose={() => setDeletingProject(null)}>
          <p style={{ fontSize: 14, color: "#444", lineHeight: 1.6, marginBottom: 20 }}>
            Tem certeza que deseja excluir <strong>{deletingProject.name}</strong>? Essa ação remove
            permanentemente todos os quadros, colunas, raias e cartões deste projeto.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setDeletingProject(null)}>Cancelar</Btn>
            <Btn variant="danger" onClick={removeProject} disabled={saving}>
              {saving ? "Excluindo..." : "Excluir Projeto"}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── DETALHES DO PROJETO (QUADROS) ──────────────────────────────────────────
function ProjectPage({ project, onBack, onSelectBoard }) {
  const { token, toast } = useAuth();
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [boardName, setBoardName] = useState("");
  const [saving, setSaving] = useState(false);
  const [debugData, setDebugData] = useState("Aguardando backend...");

const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api("GET", `/projects/${project.id}/boards`, null, token);
      
      // Limpamos a lógica de captura de dados para ficar apenas a atribuição
      let listaQuadros = [];
      if (Array.isArray(data)) listaQuadros = data;
      else if (data.boards && Array.isArray(data.boards)) listaQuadros = data.boards;
      else if (data.project && Array.isArray(data.project.boards)) listaQuadros = data.project.boards;
      else if (data.data && Array.isArray(data.data)) listaQuadros = data.data;
      
      setBoards(listaQuadros);
    } catch (e) { 
      // Apenas o toast de erro, sem o alert invasivo
      toast(e.message, "error"); 
    }
    setLoading(false);
  }, [token, project]);


const deleteBoard = async (e, boardId) => {
    e.stopPropagation(); // Impede que o clique no botão de excluir acabe abrindo o quadro
    
    if (!window.confirm("Tem certeza que deseja excluir este quadro permanentemente?")) return;

    try {
      // Faz o chamado para a rota de deleção do backend
      await api("DELETE", `/boards/${boardId}`, null, token);
      
      toast("Quadro excluído com sucesso!");
      
      // INJEÇÃO DIRETA: Remove o quadro da tela na mesma hora, sem chamar o load()
      setBoards(boardsAntigos => boardsAntigos.filter(b => b.id !== boardId));
      
    } catch (e) { 
      toast(e.message, "error"); 
    }
  };


  const create = async () => {
    setSaving(true);
    try {
      // 1. Manda o backend salvar no banco
      const res = await api("POST", "/boards", { name: boardName, projectId: project.id }, token);
      
      toast("Quadro criado!");
      setShowModal(false);
      setBoardName("");
      
      // 2. INJEÇÃO DE FORÇA BRUTA: Pega a resposta de sucesso e ejeta direto na tela, ignorando o GET
      const quadroCriado = res.board || res.data || res;
      setBoards(quadrosAntigos => [...(quadrosAntigos || []), quadroCriado]);
      
    } catch (e) { toast(e.message, "error"); }
    setSaving(false);
  };


  
  useEffect(() => {
    load();
  }, [load]);
  
  return (
    
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>

      <div style={{
        background: "#fff", borderBottom: "1px solid #e8eaf0", padding: "0 32px",
        display: "flex", alignItems: "center", gap: 12, height: 60
      }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "#6366f1", display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 14 }}>
          <Icon.Back /> Projetos
        </button>
        <span style={{ color: "#ddd" }}>/</span>
        <span style={{ fontWeight: 700, color: "#111", fontSize: 15 }}>{project.name}</span>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111" }}>Quadros</h1>
            {project.description && <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>{project.description}</p>}
          </div>
          <Btn onClick={() => setShowModal(true)}><Icon.Plus /> Novo Quadro</Btn>
        </div>

    {(!boards || boards.length === 0) ? (
          <div style={{
            textAlign: "center", padding: "80px 0", color: "#aaa",
            background: "#fff", borderRadius: 16, border: "1.5px dashed #e2e8f0"
          }}>
            <p style={{ fontSize: 16, marginBottom: 16 }}>Nenhum quadro ainda.</p>
            <Btn onClick={() => setShowModal(true)}><Icon.Plus /> Criar primeiro quadro</Btn>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
            {boards.map(b => (
              <div key={b.id} onClick={() => onSelectBoard(b)}
                style={{
                  background: "#fff", borderRadius: 14, padding: 24,
                  border: "1.5px solid #e8eaf0", cursor: "pointer",
                  boxShadow: "0 2px 8px #0001", transition: "all .15s",
                  position: "relative"
                }}
                onMouseOver={e => { e.currentTarget.style.boxShadow = "0 8px 24px #6366f115"; e.currentTarget.style.borderColor = "#c7d2fe"; }}
                onMouseOut={e => { e.currentTarget.style.boxShadow = "0 2px 8px #0001"; e.currentTarget.style.borderColor = "#e8eaf0"; }}>

                  <button 
  onClick={(e) => deleteBoard(e, b.id)}
  style={{ 
    position: "absolute", top: 16, right: 16, 
    background: "none", border: "none", cursor: "pointer", 
    color: "#ef444499", padding: 4 
  }}
  title="Excluir quadro"
>
  <Icon.Trash size={18} />
</button>

                <div style={{ width: 36, height: 36, background: "#ede9fe", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, color: "#6366f1" }}>
                  <Icon.Board />
                </div>
                <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#111" }}>{b.name}</h3>
                <p style={{ margin: 0, fontSize: 11, color: "#bbb" }}>{new Date(b.createdAt).toLocaleDateString("pt-BR")}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <Modal title="Novo Quadro" onClose={() => setShowModal(false)}>
          <Field label="Nome do quadro">
            <Input placeholder="Ex: Sprint 1" value={boardName}
              onChange={e => setBoardName(e.target.value)} autoFocus
              onKeyDown={e => e.key === "Enter" && create()} />
          </Field>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Btn>
            <Btn onClick={create} disabled={saving || !boardName.trim()}>
              {saving ? "Criando..." : "Criar Quadro"}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── MODAL DE DETALHES DO CARTÃO ─────────────────────────────────────────────
function CardModal({ card, columns, onClose, onUpdated, onDeleted }) {
  const { token, toast } = useAuth();
  const [form, setForm] = useState({ name: card.name, description: card.description || "", priority: card.priority });
  const [targetColumn, setTargetColumn] = useState(card.columnId);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api("PUT", `/cards/${card.id}`, form, token);
      if (targetColumn !== card.columnId) {
        await api("PATCH", `/cards/${card.id}/move`, { columnId: targetColumn }, token);
      }
      toast("Cartão atualizado!");
      onUpdated();
      onClose();
    } catch (e) { toast(e.message, "error"); }
    setSaving(false);
  };

  const del = async () => {
    if (!confirm("Remover este cartão?")) return;
    setDeleting(true);
    try {
      await api("DELETE", `/cards/${card.id}`, null, token);
      toast("Cartão removido.");
      onDeleted();
      onClose();
    } catch (e) { toast(e.message, "error"); }
    setDeleting(false);
  };

  return (
    <Modal title="Editar Cartão" onClose={onClose}>
      <Field label="Nome">
        <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      </Field>
      <Field label="Descrição">
        <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </Field>
      <Field label="Prioridade">
        <Select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
          <option value="LOW">Baixa</option>
          <option value="MEDIUM">Média</option>
          <option value="HIGH">Alta</option>
        </Select>
      </Field>
      <Field label="Mover para coluna">
        <Select value={targetColumn} onChange={e => setTargetColumn(e.target.value)}>
          {columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </Field>
      <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 4 }}>
        <Btn variant="danger" size="sm" onClick={del} disabled={deleting}>
          <Icon.Trash /> {deleting ? "Removendo..." : "Remover"}
        </Btn>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
          <Btn onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── MODAL DE MÉTRICAS ───────────────────────────────────────────────────────
function MetricsModal({ boardId, onClose }) {
  const { token, toast } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api("GET", `/boards/${boardId}/metrics`, null, token)
      .then(d => setMetrics(d.metrics))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [boardId, token]);

  return (
    <Modal title="Métricas do Quadro" onClose={onClose}>
      {loading ? (
        <p style={{ textAlign: "center", color: "#aaa", padding: 24 }}>Calculando métricas...</p>
      ) : error ? (
        <p style={{ color: "#ef4444", fontSize: 14 }}>{error}</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          {[
            { label: "Throughput", value: metrics.throughput, unit: "cartões", color: "#6366f1" },
            { label: "Lead Time", value: metrics.leadTimeDays.toFixed(1), unit: "dias", color: "#0ea5e9" },
            { label: "Cycle Time", value: metrics.cycleTimeDays.toFixed(1), unit: "dias", color: "#22c55e" },
          ].map(m => (
            <div key={m.label} style={{
              background: m.color + "11", borderRadius: 12, padding: "18px 16px", textAlign: "center"
            }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: m.color }}>{m.value}</div>
              <div style={{ fontSize: 11, color: m.color, fontWeight: 600, marginTop: 2 }}>{m.unit}</div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>{m.label}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
        <Btn variant="secondary" onClick={onClose}>Fechar</Btn>
      </div>
    </Modal>
  );
}

// ─── VISUALIZAÇÃO DO QUADRO ──────────────────────────────────────────────────
function BoardPage({ board: initialBoard, project, onBack }) {
  const { token, toast } = useAuth();
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showMetrics, setShowMetrics] = useState(false);
  const [boardName, setBoardName] = useState("");   


  // Criação de colunas
  const [showColModal, setShowColModal] = useState(false);
  const [colName, setColName] = useState("");
  const [colWip, setColWip] = useState("");
  const [savingCol, setSavingCol] = useState(false);

  // Criação / edição de raias
  const [showSwimModal, setShowSwimModal] = useState(false);
  const [swimName, setSwimName] = useState("");
  const [savingSwim, setSavingSwim] = useState(false);
  const [editingSwim, setEditingSwim] = useState(null); // swimlane object
  const [deletingSwim, setDeletingSwim] = useState(null);

  // Criação de cartões por (coluna, raia)
  const [addingCard, setAddingCard] = useState(null); // { columnId, swimlaneId }
  const [newCardName, setNewCardName] = useState("");
  const [savingCard, setSavingCard] = useState(false);

 const load = useCallback(async () => {
    try {
      const data = await api("GET", `/boards/${initialBoard.id}`, null, token);
      
      // 1. Rede de arrastão: Pega o quadro não importa como o backend devolva
      const boardCarregado = data.board || data.data || data;

      // DEBUG: Vamos ver o que o backend está realmente entregando
      console.log("🚨 [DEBUG] Quadro carregado do banco:", boardCarregado);

      // 2. Prevenção de Amnésia: Se o backend devolver o quadro sem o array de swimlanes, 
      // nós criamos um array vazio para não quebrar a tela do React.
      if (!boardCarregado.swimlanes) {
        boardCarregado.swimlanes = [];
        console.warn("⚠️ O backend não enviou as raias (swimlanes) na resposta do GET!");
      }

      setBoard(boardCarregado);
    } catch (e) { 
      toast(e.message, "error"); 
    }
    setLoading(false);
  }, [initialBoard.id, token]);

  const createColumn = async () => {
    setSavingCol(true);
    try {
      const nextOrder = board ? board.columns.length : 0;
      await api("POST", "/columns", {
        name: colName,
        boardId: initialBoard.id,
        order: nextOrder,
        ...(colWip ? { wipLimit: parseInt(colWip) } : {})
      }, token);
      toast("Coluna criada!");
      setShowColModal(false);
      setColName(""); setColWip("");
      load();
    } catch (e) { toast(e.message, "error"); }
    setSavingCol(false);
  };

const createSwimlane = async () => {
    setSavingSwim(true);
    try {
      const nextOrder = board && board.swimlanes ? board.swimlanes.length : 0;
      
      const res = await api("POST", "/swimlanes", {
        name: swimName,
        boardId: initialBoard.id,
        order: nextOrder,
      }, token);

      // --- DEBUG: VAMOS VER O QUE O SERVIDOR RESPONDEU ---
      console.log("Resposta do servidor ao criar raia:", res);
      // ---------------------------------------------------

      toast("Raia criada!");
      setShowSwimModal(false);
      setSwimName("");

      // Se a resposta for o objeto da raia, ele deve ter um campo 'name'
      // Se o 'res' for { id: 1, ... }, ótimo. Se for { lane: { id: 1, name: '...' } }, precisamos ajustar.
      const novaRaia = res.lane || res.data || res;
      
      // VERIFICAÇÃO DE SEGURANÇA: Se não veio o nome, forçamos o que o usuário digitou
      if (!novaRaia.name) {
        novaRaia.name = swimName; 
      }

      setBoard(prevBoard => ({
        ...prevBoard,
        swimlanes: [...(prevBoard.swimlanes || []), novaRaia]
      }));

    } catch (e) { 
      toast(e.message, "error"); 
    }
    setSavingSwim(false);
  };

  const updateSwimlane = async () => {
    setSavingSwim(true);
    try {
      await api("PUT", `/swimlanes/${editingSwim.id}`, { name: swimName }, token);
      toast("Raia atualizada!");
      setEditingSwim(null);
      setSwimName("");
      load();
    } catch (e) { toast(e.message, "error"); }
    setSavingSwim(false);
  };

  const removeSwimlane = async () => {
    setSavingSwim(true);
    try {
      await api("DELETE", `/swimlanes/${deletingSwim.id}`, null, token);
      toast("Raia removida.");
      setDeletingSwim(null);
      load();
    } catch (e) { toast(e.message, "error"); }
    setSavingSwim(false);
  };

  const createCard = async (columnId, swimlaneId) => {
    if (!newCardName.trim()) return;
    setSavingCard(true);
    try {
      const card = await api("POST", "/cards", { name: newCardName, columnId, projectId: project.id }, token);
      // Se a raia não for a "padrão" (sem raia), move o cartão para a raia certa
      if (swimlaneId) {
        await api("PATCH", `/cards/${card.card.id}/move`, { columnId, swimlaneId }, token);
      }
      setNewCardName(""); setAddingCard(null);
      load();
    } catch (e) { toast(e.message, "error"); }
    setSavingCard(false);
  };

  const moveCard = async (cardId, fromColumnId, toColumnId, toSwimlaneId) => {
    try {
      await api("PATCH", `/cards/${cardId}/move`, { columnId: toColumnId, swimlaneId: toSwimlaneId ?? null }, token);
      load();
    } catch (e) { toast(e.message, "error"); }
  };

  // Estado do arrastar e soltar (drag-and-drop)
  const [dragging, setDragging] = useState(null); // { cardId, fromColumnId }

  const renderCard = (card, col) => (
    <div key={card.id}
      draggable
      onDragStart={() => setDragging({ cardId: card.id, fromColumnId: col.id })}
      onDragEnd={() => setDragging(null)}
      onClick={() => setSelectedCard({ card, columns: board.columns })}
      style={{
        background: "#fff", borderRadius: 10, padding: "12px 14px",
        cursor: "grab", boxShadow: "0 1px 4px #0001",
        border: "1.5px solid #e8eaf0", transition: "box-shadow .12s"
      }}
      onMouseOver={e => e.currentTarget.style.boxShadow = "0 4px 12px #6366f122"}
      onMouseOut={e => e.currentTarget.style.boxShadow = "0 1px 4px #0001"}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#111", lineHeight: 1.4 }}>{card.name}</span>
        <span style={{ color: "#bbb", flexShrink: 0 }}><Icon.Edit /></span>
      </div>
      {card.description && (
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#888", lineHeight: 1.5 }}>
          {card.description.length > 80 ? card.description.slice(0, 80) + "…" : card.description}
        </p>
      )}
      <div style={{ marginTop: 10 }}>
        <PriorityBadge priority={card.priority} />
      </div>
    </div>
  );

  const renderAddCard = (col, swimlaneId) => {
    const key = `${col.id}::${swimlaneId || "none"}`;
    const isAdding = addingCard && addingCard.columnId === col.id && addingCard.swimlaneId === swimlaneId;
    return isAdding ? (
      <div key={key} style={{ background: "#fff", borderRadius: 10, padding: 10, border: "1.5px solid #c7d2fe" }}>
        <Input placeholder="Nome do cartão..." value={newCardName}
          onChange={e => setNewCardName(e.target.value)} autoFocus
          onKeyDown={e => { if (e.key === "Enter") createCard(col.id, swimlaneId); if (e.key === "Escape") setAddingCard(null); }} />
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <Btn size="sm" onClick={() => createCard(col.id, swimlaneId)} disabled={savingCard || !newCardName.trim()}>
            {savingCard ? "..." : "Adicionar"}
          </Btn>
          <Btn size="sm" variant="secondary" onClick={() => setAddingCard(null)}>Cancelar</Btn>
        </div>
      </div>
    ) : (
      <button key={key} onClick={() => { setAddingCard({ columnId: col.id, swimlaneId }); setNewCardName(""); }}
        style={{
          background: "none", border: "1.5px dashed #c7d2fe", borderRadius: 10,
          padding: "8px", cursor: "pointer", color: "#a5b4fc", fontSize: 13,
          width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 4
        }}>
        <Icon.Plus /> Adicionar cartão
      </button>
    );
  };

  const hasSwimlanes = board && board.swimlanes && board.swimlanes.length > 0;

  // Linhas a renderizar: raias reais + uma linha "Sem raia" se houver cartões sem swimlaneId
  const cardsWithoutSwimlane = board
    ? board.columns.some(c => c.cards.some(card => !card.swimlaneId))
    : false;

  const rows = hasSwimlanes
    ? [
        ...board.swimlanes.map(s => ({ id: s.id, name: s.name, isSwimlane: true })),
        // Agora ele só vai incluir "Sem raia" se a lista de cartões órfãos não estiver vazia
        ...(cardsWithoutSwimlane && cardsWithoutSwimlane.length > 0 ? [{ id: null, name: "Sem raia", isSwimlane: false }] : [])
      ]
    : [];


    // O GATILHO DAS RAIAS: Sincroniza o componente com o banco de dados ao entrar na tela
  useEffect(() => {
    if (initialBoard?.id || board?.id) {
      load();
    }
  }, [initialBoard?.id, board?.id, load]);


  return (
    <div style={{ minHeight: "100vh", background: "#f0f4ff", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #e8eaf0", padding: "0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, flexShrink: 0
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "#6366f1", display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 14 }}>
            <Icon.Back /> {project.name}
          </button>
          <span style={{ color: "#ddd" }}>/</span>
          <span style={{ fontWeight: 700, color: "#111", fontSize: 15 }}>{initialBoard.name}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" size="sm" onClick={() => setShowMetrics(true)}><Icon.Chart /> Métricas</Btn>
          <Btn variant="ghost" size="sm" onClick={() => { setSwimName(""); setShowSwimModal(true); }}><Icon.Plus /> Raia</Btn>
          <Btn size="sm" onClick={() => setShowColModal(true)}><Icon.Plus /> Coluna</Btn>
        </div>
      </div>

      {/* Board canvas */}
      <div style={{ flex: 1, overflow: "auto", padding: "24px" }}>
        {loading ? (
          <div style={{ color: "#aaa", textAlign: "center", marginTop: 80 }}>Carregando quadro...</div>
        ) : !board || board.columns.length === 0 ? (
          <div style={{
            margin: "80px auto", textAlign: "center", color: "#aaa", background: "#fff",
            borderRadius: 16, padding: "60px 40px", border: "1.5px dashed #c7d2fe", maxWidth: 420
          }}>
            <p style={{ fontSize: 16, marginBottom: 16 }}>Sem colunas ainda.</p>
            <Btn onClick={() => setShowColModal(true)}><Icon.Plus /> Adicionar primeira coluna</Btn>
          </div>
        ) : !hasSwimlanes ? (
          // ─── SEM RAIAS: layout simples de colunas ───
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            {board.columns.map(col => (
              <div key={col.id}
                style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column" }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  if (dragging) moveCard(dragging.cardId, dragging.fromColumnId, col.id, null);
                }}>
                <div style={{
                  background: "#fff", borderRadius: "12px 12px 0 0", padding: "14px 16px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  borderBottom: "2px solid #6366f1"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "#111" }}>{col.name}</span>
                    <span style={{
                      background: "#ede9fe", color: "#6366f1", borderRadius: 99,
                      fontSize: 11, fontWeight: 700, padding: "2px 8px"
                    }}>{col.cards.length}{col.wipLimit ? `/${col.wipLimit}` : ""}</span>
                  </div>
                  <button onClick={() => { setAddingCard({ columnId: col.id, swimlaneId: null }); setNewCardName(""); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#6366f1", padding: 2 }}>
                    <Icon.Plus />
                  </button>
                </div>
                <div style={{
                  background: "#eff2fb", borderRadius: "0 0 12px 12px",
                  minHeight: 80, padding: "8px 8px", display: "flex", flexDirection: "column", gap: 8
                }}>
                  {col.cards.map(card => renderCard(card, col))}
                  {renderAddCard(col, null)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // ─── COM RAIAS: grade de raias × colunas ───
          <div style={{ minWidth: "fit-content" }}>
            {/* Cabeçalho de colunas */}
            <div style={{ display: "flex", gap: 16, marginBottom: 8, paddingLeft: 176 }}>
              {board.columns.map(col => (
                <div key={col.id} style={{
                  width: 280, flexShrink: 0, background: "#fff", borderRadius: 10,
                  padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between",
                  borderBottom: "2px solid #6366f1"
                }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#111" }}>{col.name}</span>
                  <span style={{
                    background: "#ede9fe", color: "#6366f1", borderRadius: 99,
                    fontSize: 11, fontWeight: 700, padding: "2px 8px"
                  }}>{col.cards.length}{col.wipLimit ? `/${col.wipLimit}` : ""}</span>
                </div>
              ))}
            </div>

            {/* Linhas de raias */}
            {rows.map(row => (
              <div key={row.id || "none"} style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                {/* Label da raia */}
                <div style={{
                  width: 160, flexShrink: 0, background: row.isSwimlane ? "#dbe4ff" : "#e7e9ee",
                  borderRadius: 10, padding: "14px 12px", display: "flex", flexDirection: "column",
                  justifyContent: "center", gap: 6
                }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#3730a3", lineHeight: 1.3 }}>{row.name}</span>
                  {row.isSwimlane && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => { setEditingSwim(row); setSwimName(row.name); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#6366f1aa", padding: 2 }}
                        title="Editar raia">
                        <Icon.Edit />
                      </button>
                      <button onClick={() => setDeletingSwim(row)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#ef444499", padding: 2 }}
                        title="Excluir raia">
                        <Icon.Trash />
                      </button>
                    </div>
                  )}
                </div>

                {/* Células da raia (uma por coluna) */}
                {board.columns.map(col => {
                  const cellCards = col.cards.filter(c => (c.swimlaneId || null) === (row.id || null));
                  return (
                    <div key={col.id}
                      style={{
                        width: 280, flexShrink: 0, background: "#eff2fb", borderRadius: 10,
                        padding: "8px", minHeight: 90, display: "flex", flexDirection: "column", gap: 8
                      }}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault();
                        if (dragging) moveCard(dragging.cardId, dragging.fromColumnId, col.id, row.id);
                      }}>
                      {cellCards.map(card => renderCard(card, col))}
                      {renderAddCard(col, row.id)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Column modal */}
      {showColModal && (
        <Modal title="Nova Coluna" onClose={() => setShowColModal(false)}>
          <Field label="Nome da coluna">
            <Input placeholder="Ex: Em andamento" value={colName}
              onChange={e => setColName(e.target.value)} autoFocus />
          </Field>
          <Field label="WIP Limit (opcional)">
            <Input type="number" placeholder="Ex: 5" value={colWip}
              onChange={e => setColWip(e.target.value)} />
          </Field>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setShowColModal(false)}>Cancelar</Btn>
            <Btn onClick={createColumn} disabled={savingCol || !colName.trim()}>
              {savingCol ? "Criando..." : "Criar Coluna"}
            </Btn>
          </div>
        </Modal>
      )}

      {/* Swimlane create modal */}
      {showSwimModal && (
        <Modal title="Nova Raia" onClose={() => setShowSwimModal(false)}>
          <Field label="Nome da raia">
            <Input placeholder="Ex: Equipe Backend, Bugs, Chuck..." value={swimName}
              onChange={e => setSwimName(e.target.value)} autoFocus
              onKeyDown={e => e.key === "Enter" && createSwimlane()} />
          </Field>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setShowSwimModal(false)}>Cancelar</Btn>
            <Btn onClick={createSwimlane} disabled={savingSwim || !swimName.trim()}>
              {savingSwim ? "Criando..." : "Criar Raia"}
            </Btn>
          </div>
        </Modal>
      )}

      {/* Swimlane edit modal */}
      {editingSwim && (
        <Modal title="Editar Raia" onClose={() => setEditingSwim(null)}>
          <Field label="Nome da raia">
            <Input value={swimName} onChange={e => setSwimName(e.target.value)} autoFocus
              onKeyDown={e => e.key === "Enter" && updateSwimlane()} />
          </Field>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setEditingSwim(null)}>Cancelar</Btn>
            <Btn onClick={updateSwimlane} disabled={savingSwim || !swimName.trim()}>
              {savingSwim ? "Salvando..." : "Salvar"}
            </Btn>
          </div>
        </Modal>
      )}

      {/* Swimlane delete modal */}
      {deletingSwim && (
        <Modal title="Excluir Raia" onClose={() => setDeletingSwim(null)}>
          <p style={{ fontSize: 14, color: "#444", lineHeight: 1.6, marginBottom: 20 }}>
            Excluir a raia <strong>{deletingSwim.name}</strong>? Os cartões dela passam a aparecer em "Sem raia".
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setDeletingSwim(null)}>Cancelar</Btn>
            <Btn variant="danger" onClick={removeSwimlane} disabled={savingSwim}>
              {savingSwim ? "Excluindo..." : "Excluir Raia"}
            </Btn>
          </div>
        </Modal>
      )}

      {/* Card edit modal */}
      {selectedCard && (
        <CardModal
          card={selectedCard.card}
          columns={selectedCard.columns}
          onClose={() => setSelectedCard(null)}
          onUpdated={load}
          onDeleted={load}
        />
      )}

      {/* Metrics modal */}
      {showMetrics && (
        <MetricsModal boardId={initialBoard.id} onClose={() => setShowMetrics(false)} />
      )}
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL DA APLICAÇÃO ──────────────────────────────────────
export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("kanban_token") || null);
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("kanban_user")); } catch { return null; }
  });
  const { toasts, toast, remove } = useToast();

  // Pilha de navegação: { page: "projects" | "project" | "board", project?, board? }
  const [nav, setNav] = useState({ page: "projects" });

  const onAuth = (t, u) => {
    setToken(t); setUser(u);
    localStorage.setItem("kanban_token", t);
    localStorage.setItem("kanban_user", JSON.stringify(u));
  };

  const logout = () => {
    setToken(null); setUser(null);
    localStorage.removeItem("kanban_token");
    localStorage.removeItem("kanban_user");
  };

  const ctx = { token, user, logout, toast };

  return (
    <AuthCtx.Provider value={ctx}>
      {!token ? (
        <AuthPage onAuth={onAuth} />
      ) : nav.page === "projects" ? (
        <ProjectsPage
          onSelectProject={p => setNav({ page: "project", project: p })}
        />
      ) : nav.page === "project" ? (
        <ProjectPage
          project={nav.project}
          onBack={() => setNav({ page: "projects" })}
          onSelectBoard={b => setNav({ page: "board", project: nav.project, board: b })}
        />
      ) : (
        <BoardPage
          board={nav.board}
          project={nav.project}
          onBack={() => setNav({ page: "project", project: nav.project })}
        />
      )}
      <Toast toasts={toasts} remove={remove} />
    </AuthCtx.Provider>
  );
}
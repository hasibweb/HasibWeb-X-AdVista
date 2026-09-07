'use client';

import {
  ChevronDown,
  CheckCircle2,
  CreditCard,
  Edit2,
  FileText,
  Info,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Plus,
  RefreshCw,
  Save,
  Send,
  Settings,
  Trash2,
  X,
  Users,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { MonthPicker } from './month-picker';

type Site = {
  id: string;
  domain: string;
  serverLabel: string | null;
  monthlyBill: number;
  isActive: boolean;
};

type ClientDueBill = {
  id: string;
  month: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: 'due' | 'partial';
  note: string | null;
};

type Client = {
  id: string;
  name: string;
  email: string | null;
  whatsapp: string;
  clientType: string;
  crmTemporaryPassword: string | null;
  notes: string | null;
  isActive: boolean;
  sites: Site[];
  dueBills?: ClientDueBill[];
  totalDueAmount?: number;
};

const clientTypes = ['Normal', 'Agency'] as const;

type Template = {
  id: string;
  name: string;
  type: 'reminder' | 'confirmation' | 'general' | 'account_information';
  body: string;
  isDefault: boolean;
};

const templateTypeOptions: Array<{ value: Template['type']; label: string }> = [
  { value: 'reminder', label: 'Reminder' },
  { value: 'confirmation', label: 'Confirmation' },
  { value: 'account_information', label: 'Account Information' },
  { value: 'general', label: 'General' },
];

type Bill = {
  id: string;
  month: string;
  totalAmount: number;
  status: 'due' | 'partial' | 'paid' | 'waived';
  followUpStatus: BillFollowUpStatus;
  note: string | null;
  client: Client;
  payments: Array<{ id: string; amount: number; paidAt: string; method: string | null; note: string | null }>;
  paidAmount: number;
  dueAmount: number;
};

type BillFollowUpStatus = 'message_send' | 'pay_later' | 'partially_paid';

type WaMessage = {
  id: string;
  month: string;
  body: string;
  selected: boolean;
  status: 'draft' | 'sending' | 'sent' | 'failed';
  error: string | null;
  chatId: string;
  sentAt: string | null;
  client: Client;
};

type WaSettings = {
  apiKey: string;
  sessionId: string;
  crmName: string;
  clientDashboardLink: string;
};

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'bills', label: 'Bills', icon: CreditCard },
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'messages', label: 'Messages', icon: MessageSquareText },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;

type TabId = (typeof tabs)[number]['id'];

const money = new Intl.NumberFormat('en-US');
const currentMonth = new Date().toISOString().slice(0, 7);
const cardClass = 'premium-card rounded-lg bg-white';
const followUpOptions: Array<{ value: BillFollowUpStatus; label: string }> = [
  { value: 'message_send', label: 'Message Send' },
  { value: 'pay_later', label: 'Pay Later' },
  { value: 'partially_paid', label: 'Partially Paid' },
];

function previousMonthValue(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(body.error || 'Request failed');
  }
  return response.json();
}

function statusClass(status: string) {
  if (status === 'paid' || status === 'sent') return 'bg-emerald-100 text-emerald-800';
  if (status === 'partial' || status === 'sending') return 'bg-sky-100 text-sky-800';
  if (status === 'failed') return 'bg-red-100 text-red-800';
  if (status === 'waived') return 'bg-slate-100 text-slate-800';
  return 'bg-amber-100 text-amber-800';
}

function monthLabel(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return month;
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00.000Z`));
}

function templateTypeLabel(type: Template['type']) {
  return templateTypeOptions.find((option) => option.value === type)?.label || type;
}

function Stat({
  label,
  value,
  icon: Icon,
  cardToneClass,
  iconClass,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  cardToneClass: string;
  iconClass: string;
}) {
  return (
    <div className={`premium-card overview-card ${cardToneClass} relative overflow-hidden rounded-lg p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(15,23,42,0.12)]`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
          <p className="mt-3 truncate text-2xl font-semibold text-ink">{value}</p>
        </div>
        <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
          <Icon size={21} />
        </span>
      </div>
    </div>
  );
}

export default function DashboardApp() {
  const [tab, setTab] = useState<TabId>('overview');
  const [month, setMonth] = useState(currentMonth);
  const [clients, setClients] = useState<Client[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [dueBills, setDueBills] = useState<Bill[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const reminderTemplate = templates.find((template) => template.type === 'reminder');

  const totals = useMemo(() => {
    return bills.reduce(
      (summary, bill) => {
        summary.total += bill.totalAmount;
        summary.paid += bill.paidAmount;
        summary.due += bill.dueAmount;
        summary.statuses[bill.status] += 1;
        return summary;
      },
      { total: 0, paid: 0, due: 0, statuses: { due: 0, partial: 0, paid: 0, waived: 0 } },
    );
  }, [bills]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setNotice('');
    try {
      const [clientData, billData, dueBillData, templateData, messageData] = await Promise.all([
        api<{ clients: Client[] }>('/api/clients'),
        api<{ bills: Bill[] }>(`/api/bills?month=${month}`),
        api<{ bills: Bill[] }>('/api/bills?scope=due'),
        api<{ templates: Template[] }>('/api/templates'),
        api<{ messages: WaMessage[] }>(`/api/messages?month=${month}`),
      ]);
      setClients(clientData.clients);
      setBills(billData.bills);
      setDueBills(dueBillData.bills);
      setTemplates(templateData.templates);
      setMessages(messageData.messages);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Refresh failed');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const savedTab = window.localStorage.getItem('advista:last-tab');
    if (tabs.some((item) => item.id === savedTab)) {
      setTab(savedTab as TabId);
    }
  }, []);

  function selectTab(nextTab: TabId) {
    setTab(nextTab);
    window.localStorage.setItem('advista:last-tab', nextTab);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  }

  return (
    <main className="flex h-screen overflow-hidden bg-[#f5f7fb] text-ink">
      <aside className="group/sidebar flex h-screen w-[76px] shrink-0 flex-col overflow-hidden border-r border-[#1d293b] bg-[#0d1526] text-slate-300 shadow-2xl transition-[width] duration-300 ease-out hover:w-[282px]">
        <button
          className="flex h-[86px] w-full items-center gap-4 border-b border-white/5 px-5 text-left"
          onClick={() => selectTab('overview')}
          title="HasibWeb X AdVista"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-950/30">
            <Zap size={22} fill="currentColor" />
          </span>
          <span className="min-w-0 opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">
            <span className="block truncate text-sm font-bold text-white">HasibWeb</span>
            <span className="block truncate text-sm font-bold text-white/85">AdVista</span>
          </span>
        </button>

        <nav className="sidebar-scroll flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
          <div className="space-y-2">
            {tabs.map((item) => (
              <SidebarButton key={item.id} icon={item.icon} label={item.label} active={tab === item.id} onClick={() => selectTab(item.id)} />
            ))}
          </div>
        </nav>

        <div className="border-t border-white/5 p-3">
          <button
            className="flex h-11 w-full items-center gap-4 rounded-lg px-4 text-left text-sm font-semibold text-slate-400 hover:bg-white/5 hover:text-white"
            onClick={logout}
            title="Log out"
          >
            <LogOut size={19} className="shrink-0" />
            <span className="min-w-0 truncate opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">Log out</span>
          </button>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[86px] shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold text-ink">{tabs.find((item) => item.id === tab)?.label}</h1>
            <p className="truncate text-sm text-slate-500">Client billing and WhatsApp reminders</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <MonthPicker value={month} onChange={setMonth} className="w-[252px]" ariaLabel="Select dashboard month" />
            <button className="focus-ring rounded-md border border-slate-300 p-2 hover:bg-slate-50" onClick={refresh} title="Refresh">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        <div className="dashboard-scroll min-h-0 flex-1 overflow-y-auto p-6">
          {notice ? <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{notice}</div> : null}
          {tab === 'overview' ? <Overview clients={clients} bills={bills} messages={messages} totals={totals} month={month} /> : null}
          {tab === 'clients' ? (
            <ClientsPanel
              clients={clients}
              month={month}
              onMonthChange={setMonth}
              onOpenBillsMonth={(selectedMonth) => {
                setMonth(selectedMonth);
                selectTab('bills');
              }}
              onChanged={refresh}
            />
          ) : null}
          {tab === 'bills' ? <BillsPanel bills={dueBills} month={month} onChanged={refresh} /> : null}
          {tab === 'templates' ? <TemplatesPanel templates={templates} onChanged={refresh} /> : null}
          {tab === 'messages' ? (
            <MessagesPanel messages={messages} templates={templates} clients={clients} month={month} reminderTemplateId={reminderTemplate?.id} onChanged={refresh} />
          ) : null}
          {tab === 'settings' ? <SettingsPanel /> : null}
        </div>
      </section>
    </main>
  );
}

function SidebarButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={`flex h-11 w-full items-center gap-4 rounded-lg px-4 text-left text-sm font-semibold transition ${
        active ? 'bg-emerald-500/20 text-emerald-100 shadow-[inset_4px_0_0_#22c55e]' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
      }`}
      onClick={onClick}
      title={label}
    >
      <Icon size={19} className={active ? 'shrink-0 text-emerald-400' : 'shrink-0'} />
      <span className="min-w-0 flex-1 truncate opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">{label}</span>
    </button>
  );
}

function Overview({
  clients,
  messages,
  totals,
  month,
}: {
  clients: Client[];
  bills: Bill[];
  messages: WaMessage[];
  totals: { total: number; paid: number; due: number; statuses: Record<'due' | 'partial' | 'paid' | 'waived', number> };
  month: string;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="Active clients" value={clients.filter((client) => client.isActive).length} icon={Users} cardToneClass="overview-card-emerald" iconClass="bg-emerald-100 text-emerald-700" />
        <Stat label={`${month} total`} value={`${money.format(totals.total || 0)} BDT`} icon={CreditCard} cardToneClass="overview-card-sky" iconClass="bg-sky-100 text-sky-700" />
        <Stat label="Due amount" value={`${money.format(totals.due || 0)} BDT`} icon={MessageSquareText} cardToneClass="overview-card-amber" iconClass="bg-amber-100 text-amber-700" />
        <Stat label="Bill collected" value={`${money.format(totals.paid || 0)} BDT`} icon={CheckCircle2} cardToneClass="overview-card-teal" iconClass="bg-teal-100 text-teal-700" />
      </div>
      <div className="premium-card overview-card overview-card-slate overflow-hidden rounded-lg">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Recent messages</h2>
            <p className="text-sm text-slate-500">Latest WhatsApp draft and send activity</p>
          </div>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-slate-600">
            <MessageSquareText size={20} />
          </span>
        </div>
        <div className="divide-y divide-slate-100">
          {messages.slice(0, 8).map((message) => (
            <div key={message.id} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50/80">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <MessageSquareText size={17} />
                </span>
                <span className="min-w-0">
                  <p className="truncate font-medium">{message.client.name}</p>
                  <p className="truncate text-sm text-slate-500">{message.body}</p>
                </span>
              </div>
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(message.status)}`}>{message.status}</span>
            </div>
          ))}
          {!messages.length ? <p className="px-5 py-6 text-sm text-slate-500">No messages for this month.</p> : null}
        </div>
      </div>
    </div>
  );
}

function ClientsPanel({
  clients,
  month,
  onMonthChange,
  onOpenBillsMonth,
  onChanged,
}: {
  clients: Client[];
  month: string;
  onMonthChange: (month: string) => void;
  onOpenBillsMonth: (month: string) => void;
  onChanged: () => void;
}) {
  const [form, setForm] = useState({ name: '', email: '', whatsapp: '', crmTemporaryPassword: '', clientType: 'Normal', notes: '' });
  const [domains, setDomains] = useState([{ domain: '', serverLabel: '', monthlyBill: '' }]);

  function updateDomain(index: number, key: 'domain' | 'serverLabel' | 'monthlyBill', value: string) {
    setDomains((current) => current.map((domain, currentIndex) => (currentIndex === index ? { ...domain, [key]: value } : domain)));
  }

  function addDomainInput() {
    setDomains((current) => [...current, { domain: '', serverLabel: '', monthlyBill: '' }]);
  }

  function removeDomainInput(index: number) {
    setDomains((current) => (current.length === 1 ? current : current.filter((_, currentIndex) => currentIndex !== index)));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const sites = domains
      .filter((domain) => domain.domain.trim())
      .map((domain) => ({
        domain: domain.domain.trim(),
        serverLabel: domain.serverLabel.trim(),
        monthlyBill: Number(domain.monthlyBill || 0),
      }));

    await api('/api/clients', {
      method: 'POST',
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        whatsapp: form.whatsapp,
        crmTemporaryPassword: form.crmTemporaryPassword,
        clientType: form.clientType,
        notes: form.notes,
        sites,
      }),
    });
    setForm({ name: '', email: '', whatsapp: '', crmTemporaryPassword: '', clientType: 'Normal', notes: '' });
    setDomains([{ domain: '', serverLabel: '', monthlyBill: '' }]);
    onChanged();
  }

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(360px,440px)_minmax(0,1fr)]">
      <form onSubmit={submit} className={`${cardClass} min-w-0 overflow-hidden p-5`}>
        <h2 className="mb-4 text-lg font-semibold">Add client</h2>
        <div className="grid gap-3">
          {[
            ['name', 'Client name'],
            ['email', 'Email'],
            ['whatsapp', 'WhatsApp'],
            ['crmTemporaryPassword', 'CRM Temporary Password'],
          ].map(([key, label]) => (
            <label key={key} className="block min-w-0">
              <span className="text-sm font-medium text-slate-700">{label}</span>
              <input
                className="focus-ring mt-1 block w-full min-w-0 rounded-md border border-slate-300 px-3 py-2"
                value={form[key as keyof typeof form]}
                onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                required={['name', 'whatsapp'].includes(key)}
              />
            </label>
          ))}
          <label className="block min-w-0">
            <span className="text-sm font-medium text-slate-700">Client type</span>
            <select
              className="focus-ring mt-1 block w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2"
              value={form.clientType}
              onChange={(event) => setForm((current) => ({ ...current, clientType: event.target.value }))}
            >
              {clientTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-800">Domains</span>
              <button type="button" className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50" onClick={addDomainInput}>
                <Plus size={16} /> Add
              </button>
            </div>
            <div className="space-y-2">
              {domains.map((domain, index) => (
                <div key={index} className="grid min-w-0 gap-2 rounded-md border border-white bg-white p-2 shadow-sm">
                  <input
                    className="focus-ring block w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="domain.com"
                    value={domain.domain}
                    onChange={(event) => updateDomain(index, 'domain', event.target.value)}
                  />
                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_40px] gap-2">
                    <input
                      className="focus-ring block w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Server"
                      value={domain.serverLabel}
                      onChange={(event) => updateDomain(index, 'serverLabel', event.target.value)}
                    />
                    <input
                      className="focus-ring block w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Amount"
                      value={domain.monthlyBill}
                      onChange={(event) => updateDomain(index, 'monthlyBill', event.target.value)}
                      inputMode="numeric"
                    />
                    <button
                      type="button"
                      className="focus-ring grid h-10 place-items-center rounded-md border border-slate-300 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => removeDomainInput(index)}
                      disabled={domains.length === 1}
                      title="Remove domain row"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">Leave amount blank to keep the client total unchanged.</p>
          </div>
          <label className="block min-w-0">
            <span className="text-sm font-medium text-slate-700">Notes</span>
            <textarea className="focus-ring mt-1 block w-full min-w-0 rounded-md border border-slate-300 px-3 py-2" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
          </label>
          <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-forest px-4 py-2 font-semibold text-white">
            <Plus size={18} /> Add client
          </button>
        </div>
      </form>
      <div className={`${cardClass} min-w-0 overflow-hidden`}>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_150px_140px_88px] gap-3 border-b border-slate-200 px-5 py-4 text-sm font-semibold text-slate-600">
          <span>Client</span>
          <span>WhatsApp</span>
          <span>Monthly / Due</span>
          <span>Action</span>
        </div>
        <div className="divide-y divide-slate-100">
          {clients.map((client) => (
            <ClientRow key={client.id} client={client} month={month} onMonthChange={onMonthChange} onOpenBillsMonth={onOpenBillsMonth} onChanged={onChanged} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ClientRow({
  client,
  month,
  onMonthChange,
  onOpenBillsMonth,
  onChanged,
}: {
  client: Client;
  month: string;
  onMonthChange: (month: string) => void;
  onOpenBillsMonth: (month: string) => void;
  onChanged: () => void;
}) {
  const defaultDueMonth = month < currentMonth ? month : previousMonthValue(currentMonth);
  const maxManualDueMonth = previousMonthValue(currentMonth);
  const [domain, setDomain] = useState('');
  const [monthlyBill, setMonthlyBill] = useState('');
  const [serverLabel, setServerLabel] = useState('');
  const [dueForm, setDueForm] = useState({ month: defaultDueMonth, amount: '', note: '' });
  const [dueNotice, setDueNotice] = useState('');
  const [dueSaving, setDueSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sitesExpanded, setSitesExpanded] = useState(false);
  const [editForm, setEditForm] = useState({
    name: client.name,
    email: client.email || '',
    whatsapp: client.whatsapp,
    clientType: client.clientType,
    crmTemporaryPassword: client.crmTemporaryPassword || '',
    notes: client.notes || '',
    isActive: client.isActive,
  });
  const [editSites, setEditSites] = useState(
    client.sites.map((site) => ({
      id: site.id,
      domain: site.domain,
      serverLabel: site.serverLabel || '',
      monthlyBill: String(site.monthlyBill),
      isActive: site.isActive,
    })),
  );
  const [deletedSiteIds, setDeletedSiteIds] = useState<string[]>([]);
  const total = client.sites.filter((site) => site.isActive).reduce((sum, site) => sum + site.monthlyBill, 0);
  const dueBills = client.dueBills || [];
  const totalDueAmount = client.totalDueAmount || 0;

  useEffect(() => {
    setEditForm({
      name: client.name,
      email: client.email || '',
      whatsapp: client.whatsapp,
      clientType: client.clientType,
      crmTemporaryPassword: client.crmTemporaryPassword || '',
      notes: client.notes || '',
      isActive: client.isActive,
    });
    setEditSites(
      client.sites.map((site) => ({
        id: site.id,
        domain: site.domain,
        serverLabel: site.serverLabel || '',
        monthlyBill: String(site.monthlyBill),
        isActive: site.isActive,
      })),
    );
    setDeletedSiteIds([]);
    setDueForm((current) => ({ ...current, month: defaultDueMonth }));
  }, [client, defaultDueMonth]);

  useEffect(() => {
    setDueForm((current) => ({ ...current, month: defaultDueMonth }));
  }, [defaultDueMonth]);

  function updateEditSite(index: number, key: 'domain' | 'serverLabel' | 'monthlyBill' | 'isActive', value: string | boolean) {
    setEditSites((current) => current.map((site, currentIndex) => (currentIndex === index ? { ...site, [key]: value } : site)));
  }

  function removeEditSite(siteId: string) {
    setDeletedSiteIds((current) => (current.includes(siteId) ? current : [...current, siteId]));
    setEditSites((current) => current.filter((site) => site.id !== siteId));
  }

  async function addSite(event: React.FormEvent) {
    event.preventDefault();
    await api(`/api/clients/${client.id}/sites`, {
      method: 'POST',
      body: JSON.stringify({ domain, serverLabel, monthlyBill: Number(monthlyBill || 0) }),
    });
    setDomain('');
    setServerLabel('');
    setMonthlyBill('');
    onChanged();
  }

  async function saveClient() {
    await Promise.all([
      api(`/api/clients/${client.id}`, {
        method: 'PATCH',
        body: JSON.stringify(editForm),
      }),
      ...editSites.map((site) =>
        api(`/api/sites/${site.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            domain: site.domain,
            serverLabel: site.serverLabel,
            monthlyBill: Number(site.monthlyBill || 0),
            isActive: site.isActive,
          }),
        }),
      ),
      ...deletedSiteIds.map((siteId) => api(`/api/sites/${siteId}`, { method: 'DELETE' })),
    ]);
    setEditing(false);
    onChanged();
  }

  async function addDue(event: React.FormEvent) {
    event.preventDefault();
    setDueSaving(true);
    setDueNotice('');
    try {
      const amount = Number(dueForm.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Enter a due amount greater than 0.');
      }
      if (dueForm.month >= currentMonth) {
        throw new Error('Manual due bills can only be added for previous months.');
      }

      await api(`/api/clients/${client.id}/due`, {
        method: 'POST',
        body: JSON.stringify({
          month: dueForm.month,
          amount,
          note: dueForm.note,
        }),
      });
      setDueForm((current) => ({ ...current, amount: '', note: '' }));
      setDueNotice(`Due bill saved for ${dueForm.month}.`);
      if (dueForm.month !== month) {
        onMonthChange(dueForm.month);
      } else {
        onChanged();
      }
    } catch (error) {
      setDueNotice(error instanceof Error ? error.message : 'Due bill could not be saved.');
    } finally {
      setDueSaving(false);
    }
  }

  return (
    <div className="px-5 py-4">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_150px_140px_88px] gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{client.name}</p>
          <p className="truncate text-sm text-slate-500">{client.email || 'No email'}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:border-forest/30 hover:bg-emerald-50 hover:text-forest"
              onClick={() => setSitesExpanded((current) => !current)}
              aria-expanded={sitesExpanded}
            >
              {client.sites.length} {client.sites.length === 1 ? 'Site' : 'Sites'}
              <ChevronDown size={13} className={`transition-transform ${sitesExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {sitesExpanded ? (
            <div className="mt-2 flex flex-wrap gap-2 rounded-md border border-slate-100 bg-slate-50/70 p-2">
              {client.sites.map((site) => (
                <span
                  key={site.id}
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${site.isActive ? 'bg-white text-slate-700 shadow-sm' : 'bg-red-50 text-red-700'}`}
                  title={site.isActive ? 'Active site' : 'Inactive site'}
                >
                  {site.domain} - {money.format(site.monthlyBill)}
                </span>
              ))}
              {!client.sites.length ? <span className="text-xs font-medium text-slate-500">No sites added yet.</span> : null}
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {dueBills.length ? (
              <>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
                  Total due {money.format(totalDueAmount)} BDT
                </span>
                {dueBills.map((bill) => (
                  <button
                    key={bill.id}
                    type="button"
                    className="focus-ring rounded-full border border-amber-200 bg-white px-2 py-1 text-xs font-semibold text-amber-800 shadow-sm hover:bg-amber-50"
                    onClick={() => onOpenBillsMonth(bill.month)}
                    title={`Open Bills for ${monthLabel(bill.month)}`}
                  >
                    {monthLabel(bill.month)} - {money.format(bill.dueAmount)}
                  </button>
                ))}
              </>
            ) : (
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">No due bills</span>
            )}
          </div>
        </div>
        <span className="text-sm text-slate-700">{client.whatsapp}</span>
        <span>
          <span className="block font-semibold">{money.format(total)} BDT</span>
          <span className={`mt-1 block text-xs font-semibold ${totalDueAmount > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
            Due {money.format(totalDueAmount)} BDT
          </span>
        </span>
        <button className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-50" onClick={() => setEditing((current) => !current)}>
          <Edit2 size={15} /> Edit
        </button>
      </div>
      {editing ? (
        <div className="mt-4 grid gap-3 rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 md:grid-cols-2">
          <input className="focus-ring rounded-md border border-slate-300 px-3 py-2 text-sm" value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} required />
          <input className="focus-ring rounded-md border border-slate-300 px-3 py-2 text-sm" value={editForm.email} onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email" />
          <input className="focus-ring rounded-md border border-slate-300 px-3 py-2 text-sm" value={editForm.whatsapp} onChange={(event) => setEditForm((current) => ({ ...current, whatsapp: event.target.value }))} required />
          <input className="focus-ring rounded-md border border-slate-300 px-3 py-2 text-sm" value={editForm.crmTemporaryPassword} onChange={(event) => setEditForm((current) => ({ ...current, crmTemporaryPassword: event.target.value }))} placeholder="CRM Temporary Password" />
          <select className="focus-ring rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" value={editForm.clientType} onChange={(event) => setEditForm((current) => ({ ...current, clientType: event.target.value }))}>
            {clientTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <textarea className="focus-ring rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2" value={editForm.notes} onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes" />
          <div className="md:col-span-2">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-800">Existing domains</span>
              <span className="text-xs text-slate-500">Blank amount saves as 0</span>
            </div>
            <div className="space-y-2">
              {editSites.map((site, index) => (
                <div key={site.id} className="grid min-w-0 gap-2 rounded-md border border-emerald-100 bg-white p-2 shadow-sm lg:grid-cols-[minmax(0,1fr)_130px_130px_96px_44px]">
                  <input
                    className="focus-ring block w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={site.domain}
                    onChange={(event) => updateEditSite(index, 'domain', event.target.value)}
                    placeholder="domain.com"
                    required
                  />
                  <input
                    className="focus-ring block w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={site.serverLabel}
                    onChange={(event) => updateEditSite(index, 'serverLabel', event.target.value)}
                    placeholder="Server"
                  />
                  <input
                    className="focus-ring block w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={site.monthlyBill}
                    onChange={(event) => updateEditSite(index, 'monthlyBill', event.target.value)}
                    placeholder="Amount"
                    inputMode="numeric"
                  />
                  <label className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700">
                    <input type="checkbox" checked={site.isActive} onChange={(event) => updateEditSite(index, 'isActive', event.target.checked)} />
                    Active
                  </label>
                  <button
                    type="button"
                    className="focus-ring grid h-10 place-items-center rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                    onClick={() => removeEditSite(site.id)}
                    title="Remove domain"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              {!editSites.length ? <p className="rounded-md border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500">No domains added yet.</p> : null}
            </div>
          </div>

          <form onSubmit={addSite} className="md:col-span-2">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-800">Add site</span>
              <span className="text-xs text-slate-500">Amount is optional</span>
            </div>
            <div className="grid min-w-0 gap-2 rounded-md border border-slate-200 bg-white p-2 shadow-sm lg:grid-cols-[minmax(0,1fr)_140px_150px_104px]">
              <input className="focus-ring block w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="domain.com" value={domain} onChange={(event) => setDomain(event.target.value)} required />
              <input className="focus-ring block w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Server" value={serverLabel} onChange={(event) => setServerLabel(event.target.value)} />
              <input className="focus-ring block w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Amount optional" value={monthlyBill} onChange={(event) => setMonthlyBill(event.target.value)} inputMode="numeric" />
              <button className="focus-ring rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Add site</button>
            </div>
          </form>

          <form onSubmit={addDue} className="md:col-span-2">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-800">Add due bill</span>
              <span className="text-xs text-slate-500">Adds to the selected month total</span>
            </div>
            <div className="grid min-w-0 gap-2 rounded-md border border-amber-100 bg-white p-2 shadow-sm lg:grid-cols-[180px_150px_minmax(0,1fr)_104px]">
              <MonthPicker value={dueForm.month} onChange={(value) => setDueForm((current) => ({ ...current, month: value }))} ariaLabel="Select due bill month" placement="top" maxMonth={maxManualDueMonth} />
              <input
                className="focus-ring block w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Due amount"
                value={dueForm.amount}
                onChange={(event) => setDueForm((current) => ({ ...current, amount: event.target.value }))}
                inputMode="numeric"
                required
              />
              <input
                className="focus-ring block w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Due note"
                value={dueForm.note}
                onChange={(event) => setDueForm((current) => ({ ...current, note: event.target.value }))}
              />
              <button className="focus-ring rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60" disabled={dueSaving}>
                {dueSaving ? 'Saving...' : 'Add due'}
              </button>
            </div>
            {dueNotice ? (
              <p className={`mt-2 text-sm font-medium ${dueNotice.includes('saved') ? 'text-emerald-700' : 'text-red-700'}`}>{dueNotice}</p>
            ) : null}
          </form>

          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={editForm.isActive} onChange={(event) => setEditForm((current) => ({ ...current, isActive: event.target.checked }))} />
            Active client
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50" onClick={() => setEditing(false)}>
              <X size={15} /> Cancel
            </button>
            <button type="button" className="focus-ring inline-flex items-center gap-2 rounded-md bg-forest px-3 py-2 text-sm font-semibold text-white hover:bg-ink" onClick={saveClient}>
              <Save size={15} /> Save
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BillsPanel({ bills, month, onChanged }: { bills: Bill[]; month: string; onChanged: () => void }) {
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>([]);
  const [paymentNote, setPaymentNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const dueTotal = useMemo(() => bills.reduce((sum, bill) => sum + bill.dueAmount, 0), [bills]);
  const billGroups = useMemo(() => {
    const groups = new Map<string, { client: Client; bills: Bill[]; dueTotal: number }>();
    for (const bill of bills) {
      const group = groups.get(bill.client.id) || { client: bill.client, bills: [], dueTotal: 0 };
      group.bills.push(bill);
      group.dueTotal += bill.dueAmount;
      groups.set(bill.client.id, group);
    }
    return [...groups.values()];
  }, [bills]);
  const selectedDueTotal = useMemo(
    () => bills.filter((bill) => selectedBillIds.includes(bill.id)).reduce((sum, bill) => sum + bill.dueAmount, 0),
    [bills, selectedBillIds],
  );

  useEffect(() => {
    setSelectedBillIds((current) => current.filter((billId) => bills.some((bill) => bill.id === billId)));
  }, [bills]);

  async function generate() {
    await api('/api/bills/generate', { method: 'POST', body: JSON.stringify({ month }) });
    onChanged();
  }

  async function markSelectedAsPaid() {
    if (!selectedBillIds.length) return;

    setSaving(true);
    setNotice('');
    try {
      await api('/api/bills/mark-paid', {
        method: 'POST',
        body: JSON.stringify({
          billIds: selectedBillIds,
          note: paymentNote,
        }),
      });
      setSelectedBillIds([]);
      setPaymentNote('');
      onChanged();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Selected bills could not be paid.');
    } finally {
      setSaving(false);
    }
  }

  function toggleBill(billId: string) {
    setSelectedBillIds((current) => (current.includes(billId) ? current.filter((id) => id !== billId) : [...current, billId]));
  }

  function toggleAll() {
    setSelectedBillIds((current) => (current.length === bills.length ? [] : bills.map((bill) => bill.id)));
  }

  function toggleClientBills(clientBills: Bill[]) {
    const clientBillIds = clientBills.map((bill) => bill.id);
    setSelectedBillIds((current) => {
      const hasAll = clientBillIds.every((billId) => current.includes(billId));
      return hasAll ? current.filter((billId) => !clientBillIds.includes(billId)) : [...new Set([...current, ...clientBillIds])];
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button className="focus-ring inline-flex items-center gap-2 rounded-md bg-forest px-4 py-2 font-semibold text-white" onClick={generate}>
          <RefreshCw size={18} /> Generate bills for {month}
        </button>
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">
          Total due {money.format(dueTotal)} BDT
        </div>
      </div>
      <div className={`${cardClass} p-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={bills.length > 0 && selectedBillIds.length === bills.length} onChange={toggleAll} disabled={!bills.length} />
            Select all due
          </label>
          <input
            className="focus-ring min-w-[240px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Payment note optional"
            value={paymentNote}
            onChange={(event) => setPaymentNote(event.target.value)}
          />
          <button
            type="button"
            className="focus-ring inline-flex items-center gap-2 rounded-md bg-forest px-3 py-2 text-sm font-semibold text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
            onClick={markSelectedAsPaid}
            disabled={!selectedBillIds.length || saving}
          >
            <CheckCircle2 size={16} /> {saving ? 'Saving...' : `Mark selected paid (${money.format(selectedDueTotal)} BDT)`}
          </button>
        </div>
        {notice ? <p className="mt-2 text-sm font-medium text-red-700">{notice}</p> : null}
      </div>
      <div className={cardClass}>
        {billGroups.map((group) => (
          <BillClientGroup
            key={group.client.id}
            group={group}
            selectedBillIds={selectedBillIds}
            onToggleClient={() => toggleClientBills(group.bills)}
            onToggleBill={toggleBill}
            onChanged={onChanged}
          />
        ))}
        {!bills.length ? <p className="p-6 text-sm text-slate-500">No unpaid due bills found.</p> : null}
      </div>
    </div>
  );
}

function BillClientGroup({
  group,
  selectedBillIds,
  onToggleClient,
  onToggleBill,
  onChanged,
}: {
  group: { client: Client; bills: Bill[]; dueTotal: number };
  selectedBillIds: string[];
  onToggleClient: () => void;
  onToggleBill: (billId: string) => void;
  onChanged: () => void;
}) {
  const allSelected = group.bills.every((bill) => selectedBillIds.includes(bill.id));
  const someSelected = group.bills.some((bill) => selectedBillIds.includes(bill.id));

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3 bg-white px-4 py-2">
        <label className="flex min-w-0 items-start gap-3">
          <input
            className="mt-1 h-4 w-4"
            type="checkbox"
            checked={allSelected}
            ref={(input) => {
              if (input) input.indeterminate = someSelected && !allSelected;
            }}
            onChange={onToggleClient}
          />
          <span className="min-w-0">
            <span className="block text-lg font-semibold text-ink">{group.client.name}</span>
            <span className="block text-sm text-slate-500">{group.client.whatsapp}</span>
          </span>
        </label>
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-900">
          Total due {money.format(group.dueTotal)} BDT
        </div>
      </div>
      <div className="divide-y divide-slate-100 bg-slate-50/45">
        {group.bills.map((bill) => (
          <BillDueRow key={bill.id} bill={bill} selected={selectedBillIds.includes(bill.id)} onToggle={() => onToggleBill(bill.id)} onChanged={onChanged} />
        ))}
      </div>
    </div>
  );
}

function BillDueRow({ bill, selected, onToggle, onChanged }: { bill: Bill; selected: boolean; onToggle: () => void; onChanged: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(bill.note || '');
  const [followUpStatus, setFollowUpStatus] = useState<BillFollowUpStatus>(bill.followUpStatus || 'pay_later');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setNoteDraft(bill.note || '');
  }, [bill.note]);

  useEffect(() => {
    setFollowUpStatus(bill.followUpStatus || 'pay_later');
  }, [bill.followUpStatus]);

  async function deleteBill() {
    const confirmed = window.confirm(`Delete ${bill.client.name}'s bill for ${monthLabel(bill.month)}? This will also remove payments recorded for this bill.`);
    if (!confirmed) return;

    setDeleting(true);
    setNotice('');
    try {
      await api(`/api/bills/${bill.id}`, { method: 'DELETE' });
      onChanged();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Bill could not be deleted.');
    } finally {
      setDeleting(false);
    }
  }

  async function saveNote() {
    setSavingNote(true);
    setNotice('');
    try {
      await api(`/api/bills/${bill.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ note: noteDraft.trim() || null }),
      });
      setNoteOpen(false);
      onChanged();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Due note could not be saved.');
    } finally {
      setSavingNote(false);
    }
  }

  async function updateFollowUpStatus(nextStatus: BillFollowUpStatus) {
    setFollowUpStatus(nextStatus);
    setSavingStatus(true);
    setNotice('');
    try {
      await api(`/api/bills/${bill.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ followUpStatus: nextStatus }),
      });
      onChanged();
    } catch (error) {
      setFollowUpStatus(bill.followUpStatus || 'pay_later');
      setNotice(error instanceof Error ? error.message : 'Bill status could not be saved.');
    } finally {
      setSavingStatus(false);
    }
  }

  return (
    <div className="px-4 py-2">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_190px_160px_120px]">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <input className="h-4 w-4" type="checkbox" checked={selected} onChange={onToggle} />
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm">{monthLabel(bill.month)}</span>
          <DueBadge
            note={bill.note}
            noteDraft={noteDraft}
            open={noteOpen}
            saving={savingNote}
            onOpen={() => setNoteOpen(true)}
            onClose={() => {
              setNoteDraft(bill.note || '');
              setNoteOpen(false);
            }}
            onNoteChange={setNoteDraft}
            onSave={saveNote}
          />
        </div>
        <select
          className="focus-ring h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          value={followUpStatus}
          onChange={(event) => updateFollowUpStatus(event.target.value as BillFollowUpStatus)}
          disabled={savingStatus}
        >
          {followUpOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="flex min-h-9 items-center justify-between gap-2 rounded-md border border-amber-100 bg-amber-50 px-3 py-1.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-amber-700">Due</span>
          <span className="font-semibold text-amber-900">{money.format(bill.dueAmount)} BDT</span>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="focus-ring inline-flex h-9 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={deleteBill}
            disabled={deleting}
          >
            <Trash2 size={16} /> {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
      {notice ? <p className="mt-2 text-sm font-medium text-red-700">{notice}</p> : null}
    </div>
  );
}

function DueBadge({
  note,
  noteDraft,
  open,
  saving,
  onOpen,
  onClose,
  onNoteChange,
  onSave,
}: {
  note: string | null;
  noteDraft: string;
  open: boolean;
  saving: boolean;
  onOpen: () => void;
  onClose: () => void;
  onNoteChange: (note: string) => void;
  onSave: () => void;
}) {
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className="focus-ring inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
        onClick={onOpen}
      >
        Due
        {note ? <Info size={12} /> : null}
      </button>
      {open ? (
        <span className="absolute left-0 top-[calc(100%+8px)] z-40 block w-80 rounded-lg border border-amber-100 bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,0.16)]">
          <span className="mb-2 block text-sm font-semibold text-ink">Due note</span>
          <textarea
            className="focus-ring h-24 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
            placeholder="Add due note"
            value={noteDraft}
            onChange={(event) => onNoteChange(event.target.value)}
          />
          <span className="mt-2 flex justify-end gap-2">
            <button type="button" className="focus-ring rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-50" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="focus-ring inline-flex items-center gap-2 rounded-md bg-forest px-3 py-1.5 text-sm font-semibold text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onSave}
              disabled={saving}
            >
              <Save size={14} /> {saving ? 'Saving...' : 'Save'}
            </button>
          </span>
        </span>
      ) : null}
    </span>
  );
}

function TemplatesPanel({ templates, onChanged }: { templates: Template[]; onChanged: () => void }) {
  const placeholders = [
    '{client_name}',
    '{phone}',
    '{email}',
    '{month}',
    '{total_bill}',
    '{bill_per_month}',
    '{domains}',
    '{payment_status}',
    '{paid_amount}',
    '{due_amount}',
    '{crm_temporary_password}',
    '{crm_name}',
    '{client_dashboard_link}',
  ];
  const [form, setForm] = useState<{ name: string; type: Template['type']; body: string }>({ name: '', type: 'reminder', body: '' });
  const [activeEditTemplateId, setActiveEditTemplateId] = useState<string | null>(null);
  const [placeholderRequest, setPlaceholderRequest] = useState<{ templateId: string; placeholder: string; nonce: number } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await api('/api/templates', { method: 'POST', body: JSON.stringify(form) });
    setForm({ name: '', type: 'reminder', body: '' });
    onChanged();
  }

  function addPlaceholder(placeholder: string) {
    if (activeEditTemplateId) {
      setPlaceholderRequest({ templateId: activeEditTemplateId, placeholder, nonce: Date.now() });
      return;
    }

    setForm((current) => ({ ...current, body: current.body ? `${current.body}${placeholder}` : placeholder }));
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
      <form onSubmit={submit} className={`${cardClass} p-5`}>
        <h2 className="mb-4 text-lg font-semibold">Create template</h2>
        <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Placeholders</p>
          <div className="flex flex-wrap gap-2">
            {placeholders.map((placeholder) => (
              <button
                key={placeholder}
                type="button"
                className="focus-ring rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:border-forest/30 hover:bg-emerald-50 hover:text-forest"
                onClick={() => addPlaceholder(placeholder)}
              >
                {placeholder}
              </button>
            ))}
          </div>
        </div>
        <input className="focus-ring mb-3 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Template name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
        <select className="focus-ring mb-3 w-full rounded-md border border-slate-300 px-3 py-2" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as Template['type'] }))}>
          {templateTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <textarea className="focus-ring h-56 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="{client_name}, {phone}, {email}, {month}, {total_bill}, {bill_per_month}, {domains}, {payment_status}, {paid_amount}, {due_amount}, {crm_temporary_password}, {crm_name}, {client_dashboard_link}" value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} required />
        <button className="focus-ring mt-3 inline-flex items-center gap-2 rounded-md bg-forest px-4 py-2 font-semibold text-white">
          <Plus size={18} /> Save template
        </button>
      </form>
      <div className="space-y-3">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            placeholderRequest={placeholderRequest}
            onEditingChange={(editing) => {
              if (editing) {
                setActiveEditTemplateId(template.id);
                return;
              }

              setActiveEditTemplateId((current) => (current === template.id ? null : current));
            }}
            onChanged={onChanged}
          />
        ))}
      </div>
    </div>
  );
}

function SettingsPanel() {
  const [form, setForm] = useState<WaSettings>({ apiKey: '', sessionId: '', crmName: '', clientDashboardLink: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      setLoading(true);
      setNotice('');
      try {
        const settings = await api<WaSettings>('/api/settings/wa');
        if (active) setForm(settings);
      } catch (error) {
        if (active) setNotice(error instanceof Error ? error.message : 'Settings could not be loaded.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSettings();
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice('');
    try {
      const settings = await api<WaSettings>('/api/settings/wa', {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      setForm(settings);
      setNotice('Settings saved.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Settings could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <form onSubmit={submit} className={`${cardClass} overflow-hidden`}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Settings</h2>
            <p className="text-sm text-slate-500">Saved WhatsApp and CRM values are used when sending and generating messages.</p>
          </div>
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <Settings size={20} />
          </span>
        </div>
        <div className="grid gap-4 p-5">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">HASIBWEB_WA_API_KEY</span>
            <input
              className="focus-ring mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.apiKey}
              onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))}
              placeholder="local-placeholder"
              disabled={loading || saving}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">HASIBWEB_WA_SESSION_ID</span>
            <input
              className="focus-ring mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.sessionId}
              onChange={(event) => setForm((current) => ({ ...current, sessionId: event.target.value }))}
              placeholder="00000000-0000-0000-0000-000000000000"
              disabled={loading || saving}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">CRM Name</span>
            <input
              className="focus-ring mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.crmName}
              onChange={(event) => setForm((current) => ({ ...current, crmName: event.target.value }))}
              placeholder="HasibWeb CRM"
              disabled={loading || saving}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Client Dashboard Link</span>
            <input
              className="focus-ring mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.clientDashboardLink}
              onChange={(event) => setForm((current) => ({ ...current, clientDashboardLink: event.target.value }))}
              placeholder="https://example.com/client-dashboard"
              disabled={loading || saving}
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={`text-sm font-medium ${notice.includes('saved') ? 'text-emerald-700' : 'text-red-700'}`}>{notice}</p>
            <button
              className="focus-ring inline-flex items-center gap-2 rounded-md bg-forest px-4 py-2 text-sm font-semibold text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading || saving}
            >
              <Save size={16} /> {saving ? 'Saving...' : 'Save settings'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function TemplateCard({
  template,
  placeholderRequest,
  onEditingChange,
  onChanged,
}: {
  template: Template;
  placeholderRequest: { templateId: string; placeholder: string; nonce: number } | null;
  onEditingChange: (editing: boolean) => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState('');
  const [lastPlaceholderNonce, setLastPlaceholderNonce] = useState<number | null>(null);
  const [form, setForm] = useState<{ name: string; type: Template['type']; body: string }>({
    name: template.name,
    type: template.type,
    body: template.body,
  });

  useEffect(() => {
    setForm({ name: template.name, type: template.type, body: template.body });
  }, [template]);

  useEffect(() => {
    onEditingChange(editing);
  }, [editing, onEditingChange]);

  useEffect(() => {
    if (!editing || !placeholderRequest || placeholderRequest.templateId !== template.id || placeholderRequest.nonce === lastPlaceholderNonce) return;

    setForm((current) => ({
      ...current,
      body: current.body ? `${current.body}${placeholderRequest.placeholder}` : placeholderRequest.placeholder,
    }));
    setLastPlaceholderNonce(placeholderRequest.nonce);
  }, [editing, lastPlaceholderNonce, placeholderRequest, template.id]);

  async function save() {
    setSaving(true);
    setNotice('');
    try {
      await api(`/api/templates/${template.id}`, { method: 'PATCH', body: JSON.stringify(form) });
      setEditing(false);
      onChanged();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Template could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const confirmed = window.confirm(`Delete template "${template.name}"?`);
    if (!confirmed) return;

    setDeleting(true);
    setNotice('');
    try {
      await api(`/api/templates/${template.id}`, { method: 'DELETE' });
      onChanged();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Template could not be deleted.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className={`${cardClass} p-4`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{template.name}</h3>
          {template.isDefault ? <p className="text-xs font-medium text-slate-500">Default template</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(template.type)}`}>{templateTypeLabel(template.type)}</span>
          <button className="focus-ring inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-50" onClick={() => setEditing((current) => !current)}>
            <Edit2 size={15} /> Edit
          </button>
          <button
            className="focus-ring inline-flex h-9 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={remove}
            disabled={template.isDefault || deleting}
            title={template.isDefault ? 'Default templates cannot be deleted' : 'Delete template'}
          >
            <Trash2 size={15} /> {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-3 rounded-md border border-emerald-100 bg-emerald-50/40 p-3">
          <input className="focus-ring w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          <select className="focus-ring w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as Template['type'] }))}>
            {templateTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <textarea className="focus-ring h-52 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} />
          <div className="flex justify-end gap-2">
            <button type="button" className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50" onClick={() => setEditing(false)}>
              <X size={15} /> Cancel
            </button>
            <button type="button" className="focus-ring inline-flex items-center gap-2 rounded-md bg-forest px-3 py-2 text-sm font-semibold text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60" onClick={save} disabled={saving}>
              <Save size={15} /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <pre className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm text-slate-700">{template.body}</pre>
      )}
      {notice ? <p className="mt-2 text-sm font-medium text-red-700">{notice}</p> : null}
    </div>
  );
}

function MessagesPanel({
  messages,
  templates,
  clients,
  month,
  reminderTemplateId,
  onChanged,
}: {
  messages: WaMessage[];
  templates: Template[];
  clients: Client[];
  month: string;
  reminderTemplateId?: string;
  onChanged: () => void;
}) {
  const [templateId, setTemplateId] = useState(reminderTemplateId || '');
  const [messageType, setMessageType] = useState<Template['type']>('reminder');
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const selectedIds = messages.filter((message) => message.selected && message.status !== 'sent').map((message) => message.id);
  const typedTemplates = templates.filter((template) => template.type === messageType || messageType === 'general');
  const activeClients = clients.filter((client) => client.isActive);

  useEffect(() => {
    if (!templateId && reminderTemplateId) setTemplateId(reminderTemplateId);
  }, [reminderTemplateId, templateId]);

  useEffect(() => {
    const currentTemplate = templates.find((template) => template.id === templateId);
    if (currentTemplate?.type === messageType) return;
    const nextTemplate = templates.find((template) => template.type === messageType);
    if (nextTemplate) setTemplateId(nextTemplate.id);
  }, [messageType, templateId, templates]);

  async function generate() {
    setNotice('');
    if (!selectedClientIds.length) {
      setNotice('Select at least one client before generating drafts.');
      return;
    }

    try {
      await api('/api/messages/generate', { method: 'POST', body: JSON.stringify({ month, templateId, type: messageType, clientIds: selectedClientIds }) });
      onChanged();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Drafts could not be generated.');
    }
  }

  async function sendSelected() {
    await api('/api/messages/send', { method: 'POST', body: JSON.stringify({ messageIds: selectedIds }) });
    onChanged();
  }

  return (
    <div className="space-y-4">
      <div className={`${cardClass} flex flex-wrap gap-2 p-4`}>
        <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 font-semibold hover:bg-slate-50" onClick={() => setClientPickerOpen(true)}>
          <Users size={18} /> {selectedClientIds.length ? `Selected Clients (${selectedClientIds.length})` : 'Select Clients'}
        </button>
        <select className="focus-ring rounded-md border border-slate-300 px-3 py-2" value={messageType} onChange={(event) => setMessageType(event.target.value as Template['type'])}>
          {templateTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select className="focus-ring min-w-[260px] rounded-md border border-slate-300 px-3 py-2" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
          {typedTemplates.map((template) => (
            <option key={template.id} value={template.id}>{template.name}</option>
          ))}
        </select>
        <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60" onClick={generate} disabled={!templateId || !selectedClientIds.length}>
          <FileText size={18} /> Generate drafts
        </button>
        <button className="focus-ring inline-flex items-center gap-2 rounded-md bg-forest px-4 py-2 font-semibold text-white disabled:opacity-60" onClick={sendSelected} disabled={!selectedIds.length}>
          <Send size={18} /> Send selected
        </button>
      </div>
      <ClientPickerSidebar
        clients={activeClients}
        open={clientPickerOpen}
        selectedClientIds={selectedClientIds}
        onChange={setSelectedClientIds}
        onClose={() => setClientPickerOpen(false)}
      />
      {notice ? <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">{notice}</p> : null}
      <div className="space-y-3">
        {messages.map((message) => (
          <MessageCard key={message.id} message={message} onChanged={onChanged} />
        ))}
        {!messages.length ? <p className={`${cardClass} p-6 text-sm text-slate-500`}>No message drafts for this month.</p> : null}
      </div>
    </div>
  );
}

function ClientPickerSidebar({
  clients,
  open,
  selectedClientIds,
  onChange,
  onClose,
}: {
  clients: Client[];
  open: boolean;
  selectedClientIds: string[];
  onChange: (clientIds: string[]) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return clients;

    return clients.filter((client) => `${client.name} ${client.whatsapp}`.toLowerCase().includes(query));
  }, [clients, search]);

  function toggleClient(clientId: string) {
    onChange(selectedClientIds.includes(clientId) ? selectedClientIds.filter((id) => id !== clientId) : [...selectedClientIds, clientId]);
  }

  function selectVisible() {
    onChange([...new Set([...selectedClientIds, ...filteredClients.map((client) => client.id)])]);
  }

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-950/35">
      <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close client selector" />
      <aside className="dashboard-scroll fixed bottom-0 right-0 top-0 flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-semibold text-ink">Select clients</h2>
            <p className="text-sm text-slate-500">{selectedClientIds.length} selected</p>
          </div>
          <button className="focus-ring rounded-md border border-slate-300 p-2 hover:bg-slate-50" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 border-b border-slate-100 p-4">
          <input
            className="focus-ring w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Search client or WhatsApp"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button className="focus-ring rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50" onClick={selectVisible} disabled={!filteredClients.length}>
              Select all visible
            </button>
            <button className="focus-ring rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50" onClick={() => onChange([])} disabled={!selectedClientIds.length}>
              Clear
            </button>
          </div>
        </div>

        <div className="flex-1 divide-y divide-slate-100">
          {filteredClients.map((client) => (
            <label key={client.id} className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-slate-50">
              <input className="mt-1 h-4 w-4" type="checkbox" checked={selectedClientIds.includes(client.id)} onChange={() => toggleClient(client.id)} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">{client.name}</span>
                <span className="block truncate text-sm text-slate-500">{client.whatsapp}</span>
              </span>
            </label>
          ))}
          {!filteredClients.length ? <p className="p-4 text-sm text-slate-500">No clients found.</p> : null}
        </div>

        <div className="border-t border-slate-200 p-4">
          <button className="focus-ring w-full rounded-md bg-forest px-4 py-2 font-semibold text-white hover:bg-ink" onClick={onClose}>
            Done
          </button>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

function MessageCard({ message, onChanged }: { message: WaMessage; onChanged: () => void }) {
  const [body, setBody] = useState(message.body);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState('');
  const canDelete = message.status === 'draft' || message.status === 'failed';

  async function save() {
    await api(`/api/messages/${message.id}`, { method: 'PATCH', body: JSON.stringify({ body }) });
    onChanged();
  }

  async function deleteDraft() {
    const confirmed = window.confirm(`Delete ${message.status} message for ${message.client.name}?`);
    if (!confirmed) return;

    setDeleting(true);
    setNotice('');
    try {
      await api(`/api/messages/${message.id}`, { method: 'DELETE' });
      onChanged();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Draft message could not be deleted.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className={`${cardClass} p-4`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{message.client.name}</p>
          <p className="text-sm text-slate-500">{message.chatId}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={message.selected} onChange={(event) => api(`/api/messages/${message.id}`, { method: 'PATCH', body: JSON.stringify({ selected: event.target.checked }) }).then(onChanged)} />
            Select
          </label>
          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(message.status)}`}>{message.status}</span>
        </div>
      </div>
      <textarea className="focus-ring h-36 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={body} onChange={(event) => setBody(event.target.value)} disabled={message.status === 'sent'} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button className="focus-ring rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60" onClick={save} disabled={message.status === 'sent'}>Save draft</button>
          {canDelete ? (
            <button
              className="focus-ring inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={deleteDraft}
              disabled={deleting}
            >
              <Trash2 size={15} /> {deleting ? 'Deleting...' : 'Delete'}
            </button>
          ) : null}
        </div>
        {message.error || notice ? <p className="max-w-xl truncate text-sm text-red-600">{notice || message.error}</p> : null}
      </div>
    </div>
  );
}

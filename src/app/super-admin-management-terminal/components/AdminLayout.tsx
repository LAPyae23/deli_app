'use client';

import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard, ShoppingBag, Store, Bike,
  Settings, LogOut, ChevronLeft, ChevronRight,
  ShieldCheck, SlidersVertical, MapPin, TriangleAlert, MessageSquare,
  Download, FileText, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import AppLogo from '@/components/ui/AppLogo';
import ThemeToggle from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import AdminKPIs from './AdminKPIs';
import OrderVolumeChart from './OrderVolumeChart';
import ApprovalQueue from './ApprovalQueue';
import SystemConfig from './SystemConfig';
import AdminInbox from './AdminInbox';
import AdminServiceZones from './AdminServiceZones';
import MLAnalyticsDashboard from './MLAnalyticsDashboard';
import RFMDashboard from './RFMDashboard';
import DataSyncStatus from './DataSyncStatus';
import { downloadExecutiveSummaryPdf } from '@/lib/executiveSummaryPdf';

type AdminTab =
  | 'overview'
  | 'orders'
  | 'zones'
  | 'messages'
  | 'vendors'
  | 'riders'
  | 'analytics'
  | 'config';

const NAV_GROUPS: {
  key: string;
  label: string;
  items: { key: string; tab: AdminTab; icon: React.ElementType; label: string; badge: string | null }[];
}[] = [
  {
    key: 'navg-ops',
    label: 'Operations',
    items: [
      { key: 'anav-dashboard', tab: 'overview', icon: LayoutDashboard, label: 'Overview', badge: null },
      { key: 'anav-orders', tab: 'orders', icon: ShoppingBag, label: 'Orders', badge: null },
      { key: 'anav-messages', tab: 'messages', icon: MessageSquare, label: 'Inbox', badge: null },
      { key: 'anav-zones', tab: 'zones', icon: MapPin, label: 'Service Zones', badge: null },
    ],
  },
  {
    key: 'navg-people',
    label: 'People',
    items: [
      { key: 'anav-vendors', tab: 'vendors', icon: Store, label: 'Vendors', badge: null },
      { key: 'anav-riders', tab: 'riders', icon: Bike, label: 'Riders', badge: null },
    ],
  },
  {
    key: 'navg-system',
    label: 'System',
    items: [
      { key: 'anav-config', tab: 'config', icon: SlidersVertical, label: 'Configuration', badge: null },
    ],
  },
];

function AdminLiveClock() {
  const [mounted, setMounted] = useState(false);
  const [clock, setClock] = useState('');

  useEffect(() => {
    setMounted(true);
    const format = () => {
      const now = new Date();
      setClock(
        `${now.toLocaleDateString(undefined, {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric',
        })} · ${now.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })} UTC`
      );
    };
    format();
    const interval = setInterval(format, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
    return <p className="text-xs text-muted-foreground font-medium min-w-[9rem]">&nbsp;</p>;
  }

  return <p className="text-xs text-muted-foreground font-medium">{clock}</p>;
}

function AdminTabContent({
  activeTab,
  adminStats,
}: {
  activeTab: AdminTab;
  adminStats: any;
}) {
  switch (activeTab) {
    case 'overview':
      return (
        <div className="mx-auto max-w-screen-2xl space-y-6 p-6 xl:p-8">
          <AdminKPIs data={adminStats?.kpis} />
          <OrderVolumeChart data={adminStats?.hourlyData} />
          <MLAnalyticsDashboard />
          <RFMDashboard />
        </div>
      );
    case 'orders':
      return (
        <div className="mx-auto max-w-screen-2xl space-y-6 p-6 xl:p-8">
          <AdminKPIs data={adminStats?.kpis} />
          <OrderVolumeChart data={adminStats?.hourlyData} />
        </div>
      );
    case 'messages':
      return (
        <div className="h-[calc(100vh-4rem)]">
          <AdminInbox />
        </div>
      );
    case 'zones':
      return (
        <div className="mx-auto max-w-screen-2xl space-y-6 p-6 xl:p-8">
          <AdminServiceZones />
        </div>
      );
    case 'vendors':
      return (
        <div className="mx-auto max-w-screen-2xl p-6 xl:p-8">
          <ApprovalQueue />
        </div>
      );
    case 'riders':
      return (
        <div className="mx-auto max-w-screen-2xl p-6 xl:p-8">
          <ApprovalQueue />
        </div>
      );
    case 'analytics':
      // Analytics merged into Overview — keep tab as alias
      return (
        <div className="mx-auto max-w-screen-2xl space-y-6 p-6 xl:p-8">
          <AdminKPIs data={adminStats?.kpis} />
          <OrderVolumeChart data={adminStats?.hourlyData} />
          <MLAnalyticsDashboard />
          <RFMDashboard />
        </div>
      );
    case 'config':
      return (
        <div className="mx-auto max-w-screen-2xl p-6 xl:p-8">
          <SystemConfig />
        </div>
      );
    default:
      return null;
  }
}

export default function AdminLayout() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [collapsed, setCollapsed] = useState(false);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [approvalNotifications, setApprovalNotifications] = useState<
    { id: string; title: string; body?: string; onClick?: () => void }[]
  >([]);

  useEffect(() => {
    const role = localStorage.getItem('fooddash_session_role');
    if (role !== 'ADMIN') {
      window.location.href = '/';
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPending() {
      try {
        const res = await fetch('/api/admin/approvals');
        const data = await res.json();
        if (!cancelled && res.ok && data.success) {
          const approvals = Array.isArray(data.approvals) ? data.approvals : [];
          const pending = approvals.filter(
            (a: { status?: string }) => a.status === 'PENDING'
          );
          setPendingApprovals(Number(data.pendingCount) || pending.length);
          setApprovalNotifications(
            pending.slice(0, 8).map(
              (a: {
                id?: string;
                _id?: string;
                type?: string;
                name?: string;
                township?: string;
              }) => ({
                id: String(a.id || a._id),
                title: `${a.type === 'RIDER' ? 'Rider' : 'Vendor'} application`,
                body: `${a.name || 'Applicant'}${a.township ? ` · ${a.township}` : ''}`,
                onClick: () => setActiveTab(a.type === 'RIDER' ? 'riders' : 'vendors'),
              })
            )
          );
          setLastFetchTime(Date.now());
        }
      } catch {
        // ignore
      }
    }

    loadPending();
    const interval = setInterval(loadPending, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/admin/export');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fooddash_orders_export.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('CSV dataset downloaded');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const handleExecutiveSummaryPdf = async () => {
    setExportingPdf(true);
    try {
      const res = await fetch('/api/admin/executive-summary');
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to build summary');
      }
      downloadExecutiveSummaryPdf(data);
      toast.success('Executive Summary PDF downloaded');
    } catch (error) {
      console.error('Executive summary PDF error:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to download PDF'
      );
    } finally {
      setExportingPdf(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      try {
        const res = await fetch('/api/admin/stats');
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load stats');
        if (!cancelled) {
          setAdminStats(data);
          setLastFetchTime(Date.now());
        }
      } catch (error) {
        console.error('Failed to load admin stats', error);
      }
    }

    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className={`flex flex-col bg-card border-r border-border transition-all duration-300 ease-in-out ${collapsed ? 'w-16' : 'w-64'} min-h-screen flex-shrink-0`}>
        <div className={`flex items-center border-b border-border h-16 px-4 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <AppLogo size={28} />
              <div>
                <p className="font-bold text-sm leading-tight text-foreground">FoodDash</p>
                <p className="text-xs text-muted-foreground">Admin Terminal</p>
              </div>
            </div>
          )}
          {collapsed && <AppLogo size={28} />}
          <button
            onClick={() => setCollapsed(p => !p)}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-4 overflow-y-auto scrollbar-hide">
          {NAV_GROUPS.map((group) => (
            <div key={group.key}>
              {!collapsed && (
                <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground px-3 mb-1.5">{group.label}</p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = activeTab === item.tab;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setActiveTab(item.tab)}
                      title={collapsed ? item.label : undefined}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                        isActive
                          ? 'bg-admin/15 text-admin' :'text-muted-foreground hover:bg-muted hover:text-foreground'
                      } ${collapsed ? 'justify-center px-0' : ''}`}
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left">{item.label}</span>
                          {item.badge && (
                            <span className="min-w-[20px] h-5 flex items-center justify-center bg-admin/20 text-admin text-xs font-bold rounded-full px-1.5">
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-border space-y-0.5">
          <ThemeToggle collapsed={collapsed} showLabel />
          <button
            onClick={() => setActiveTab('config')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${collapsed ? 'justify-center px-0' : ''}`}
            title={collapsed ? 'Settings' : undefined}
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Settings</span>}
          </button>
          <a
            href="/"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${collapsed ? 'justify-center px-0' : ''}`}
            title={collapsed ? 'Sign Out' : undefined}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </a>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-card border-b border-border flex items-center px-6 gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-admin" />
            <span className="text-sm font-bold text-foreground">Super Admin Terminal</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-danger/10 border border-danger/20 rounded-lg">
            <TriangleAlert className="w-3.5 h-3.5 text-danger" />
            <span className="text-xs font-semibold text-danger">
              {pendingApprovals} pending approvals
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleExecutiveSummaryPdf}
              disabled={exportingPdf}
              className="inline-flex items-center gap-2 rounded-lg border border-customer/30 bg-customer/15 px-3 py-2 text-xs font-semibold text-customer transition-colors hover:bg-customer/25 disabled:opacity-50"
            >
              {exportingPdf ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              <span className="hidden lg:inline">
                {exportingPdf ? 'Building PDF…' : 'Download Executive Summary (PDF)'}
              </span>
              <span className="lg:hidden">{exportingPdf ? 'PDF…' : 'Summary PDF'}</span>
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-lg bg-admin px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {exporting ? 'Exporting…' : 'Download Dataset (CSV)'}
              </span>
              <span className="sm:hidden">{exporting ? '…' : 'CSV'}</span>
            </button>
            <DataSyncStatus lastFetchTime={lastFetchTime} />
            <AdminLiveClock />
            <ThemeToggle className="relative rounded-lg p-2 transition-colors hover:bg-muted" />
            <NotificationBell
              showDot={pendingApprovals > 0}
              items={approvalNotifications}
              emptyLabel="No pending approvals"
            />
            <div className="hidden cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted md:flex">
              <div>
                <p className="text-sm font-semibold leading-tight text-foreground">Ops Admin</p>
                <p className="text-xs text-muted-foreground leading-tight">Super Admin</p>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <AdminTabContent activeTab={activeTab} adminStats={adminStats} />
        </main>
      </div>
    </div>
  );
}
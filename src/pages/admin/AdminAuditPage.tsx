import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Search,
  Download,
  RefreshCw,
  AlertTriangle,
  Clock,
  Terminal,
  Lock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
  fetchAuditLogs,
  EnrichedAuditLog,
  AUDIT_NOTIFICATIONS_MIGRATION_FILE,
} from '../../lib/auditAndNotifications';

export const AdminAuditPage: React.FC = () => {
  const { tenantId } = useAuth();

  const [logs, setLogs] = useState<EnrichedAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMigrationMissing, setIsMigrationMissing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTargetType, setSelectedTargetType] = useState<string>('all');

  // Payload Drawer
  const [activeLog, setActiveLog] = useState<EnrichedAuditLog | null>(null);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setIsMigrationMissing(false);

    try {
      const { logs: data, error, isMigrationMissing: missing } = await fetchAuditLogs(
        tenantId || 'mitt',
        {
          search: searchQuery,
          action: selectedCategory !== 'all' ? selectedCategory : undefined,
          targetType: selectedTargetType !== 'all' ? selectedTargetType : undefined,
        }
      );

      if (error) {
        setErrorMessage(error);
        if (missing) setIsMigrationMissing(true);
      } else {
        setLogs(data);
      }
    } catch (err: any) {
      console.warn('[AdminAuditPage] Error loading audit logs:', err);
      setErrorMessage(err?.message || 'Unable to load audit logs.');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, searchQuery, selectedCategory, selectedTargetType]);

  useEffect(() => {
    const safety = setTimeout(() => setIsLoading(false), 1000);
    loadLogs().finally(() => clearTimeout(safety));
    return () => clearTimeout(safety);
  }, [loadLogs]);

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `hackbridge-audit-trail-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getActionBadge = (action: string) => {
    if (action.includes('status') || action.includes('finalized')) {
      return <Badge variant="success">{action}</Badge>;
    }
    if (action.includes('approved') || action.includes('verified')) {
      return <Badge variant="default" className="bg-indigo-600">{action}</Badge>;
    }
    if (action.includes('hiring') || action.includes('interview')) {
      return <Badge variant="secondary" className="bg-purple-100 text-purple-700">{action}</Badge>;
    }
    return <Badge variant="outline">{action}</Badge>;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Institutional Audit Trail &amp; Compliance</h1>
            <Badge variant="success">Compliance Active</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Cryptographically immutable, tenant-partitioned event log tracking administrative state shifts, judging deliberations, and corporate outreach.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={loadLogs}
            className="text-xs h-9 text-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={handleExportJSON}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-9"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            Export Audit JSON
          </Button>
        </div>
      </div>

      {/* Migration Notice */}
      {isMigrationMissing && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Audit Database Setup Pending</p>
            <p className="mt-1">
              Please apply <code className="font-mono font-bold bg-amber-100 px-1 py-0.5 rounded">{AUDIT_NOTIFICATIONS_MIGRATION_FILE}</code> in the Supabase SQL Editor to activate database persistence for audit logs.
            </p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
          {errorMessage}
        </div>
      )}

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search actor name, email, action or target ID..."
                className="pl-9 text-xs h-9"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedTargetType}
                onChange={(e) => setSelectedTargetType(e.target.value)}
                className="text-xs h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700"
              >
                <option value="all">All Target Entities</option>
                <option value="hackathon">Hackathons</option>
                <option value="company">Companies</option>
                <option value="problem_statement">Problem Statements</option>
                <option value="submission">Submissions &amp; Awards</option>
                <option value="talent_profile">Talent &amp; Hiring</option>
              </select>

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setSelectedTargetType('all');
                }}
                className="text-xs h-9 text-slate-600"
              >
                Reset
              </Button>
            </div>
          </div>

          {/* Action Categories */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 mr-1">Action Domain:</span>
            {[
              { key: 'all', label: 'All Actions' },
              { key: 'hackathon', label: 'Hackathons' },
              { key: 'awards', label: 'Awards & Results' },
              { key: 'company', label: 'Companies' },
              { key: 'problem', label: 'Problems' },
              { key: 'hiring', label: 'Recruitment & Offers' },
            ].map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setSelectedCategory(cat.key)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  selectedCategory === cat.key
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600" />
              <CardTitle className="text-sm font-bold">Immutable Security Log Stream</CardTitle>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Showing {logs.length} logged events
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-xs font-semibold text-slate-500">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Streaming audit records...
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              No audit logs match your filter criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-5 py-3">Actor</th>
                    <th className="px-5 py-3">Action</th>
                    <th className="px-5 py-3">Target Entity</th>
                    <th className="px-5 py-3">IP Address</th>
                    <th className="px-5 py-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Timestamp */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-slate-500">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {new Date(log.created_at).toLocaleDateString()}
                        </span>
                      </td>

                      {/* Actor */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {log.actor?.fullName ? log.actor.fullName[0].toUpperCase() : 'S'}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 block">
                              {log.actor?.fullName || 'System Automated'}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {log.actor?.role ? log.actor.role.replace('_', ' ') : 'internal trigger'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {getActionBadge(log.action)}
                      </td>

                      {/* Target Entity */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="font-mono text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {log.target_type}: {log.target_id?.slice(0, 12) || 'n/a'}
                        </span>
                      </td>

                      {/* IP Address */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {log.ip_address || '127.0.0.1'}
                      </td>

                      {/* Details Trigger */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-right">
                        <button
                          type="button"
                          onClick={() => setActiveLog(log)}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition-colors"
                        >
                          <Terminal className="w-3 h-3" />
                          <span>Inspect Payload</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PAYLOAD INSPECTOR MODAL */}
      {activeLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl bg-white shadow-2xl rounded-2xl border-0 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <CardHeader className="bg-slate-900 text-white p-5 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <CardTitle className="text-sm font-bold text-white font-mono">
                  Payload: {activeLog.action}
                </CardTitle>
              </div>
              <button
                type="button"
                onClick={() => setActiveLog(null)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </CardHeader>

            <CardContent className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Event ID</span>
                  <span className="font-mono text-slate-800">{activeLog.id}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Timestamp</span>
                  <span className="text-slate-800">{new Date(activeLog.created_at).toISOString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Actor</span>
                  <span className="text-slate-800 font-semibold">{activeLog.actor?.fullName || 'System'} ({activeLog.actor?.email || 'internal'})</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Target</span>
                  <span className="font-mono text-slate-800">{activeLog.target_type}: {activeLog.target_id || 'none'}</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-700 block mb-1">State Mutation &amp; Parameters (JSONB):</span>
                <pre className="p-4 bg-slate-950 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto shadow-inner leading-relaxed">
                  {JSON.stringify(activeLog.details, null, 2)}
                </pre>
              </div>
            </CardContent>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
              <Button
                size="sm"
                onClick={() => setActiveLog(null)}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs h-8"
              >
                Close Inspector
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

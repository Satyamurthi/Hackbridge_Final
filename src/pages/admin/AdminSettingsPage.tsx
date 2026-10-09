import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Building2, CheckCircle2 } from 'lucide-react';

export const AdminSettingsPage: React.FC = () => {
  const { tenant } = useAuth();

  const [name, setName] = useState(tenant?.name || 'Maharaja Institute of Technology Thandavapura');
  const [domain, setDomain] = useState(tenant?.custom_domain || 'mitt.edu.in');
  const [primaryColor, setPrimaryColor] = useState(tenant?.primary_color || '#4F46E5');
  const [secondaryColor, setSecondaryColor] = useState(tenant?.secondary_color || '#7C3AED');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaved(false);

    // Apply live CSS variables
    document.documentElement.style.setProperty('--brand-primary', primaryColor);
    document.documentElement.style.setProperty('--brand-secondary', secondaryColor);

    setTimeout(() => {
      setIsSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }, 600);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Institution Tenant Settings</h1>
            <Badge variant="default" className="bg-indigo-600 text-white">White-Label</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure branding, domain resolution, and platform rules for <strong className="text-slate-800">{tenant?.name || 'MITT'}</strong>.
          </p>
        </div>
      </div>

      {saved && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>Tenant settings successfully saved and applied.</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            Institution Identity &amp; Branding
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Institution Legal Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                label="Authorized Email Domain"
                placeholder="mitt.edu.in"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary Brand Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-9 rounded cursor-pointer border border-slate-200"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg font-mono text-xs w-28"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Secondary Accent Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-10 h-9 rounded cursor-pointer border border-slate-200"
                  />
                  <input
                    type="text"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg font-mono text-xs w-28"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Tenant Slug: <code className="font-mono text-slate-700 font-bold">{tenant?.slug || 'mitt'}</code> (Enterprise Tier)
              </span>
              <Button
                type="submit"
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                isLoading={isSaving}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

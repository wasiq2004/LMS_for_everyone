import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";

const DEFAULT_KEYS = [
    { key: "platform_name", value: "LearnHub", group: "general", description: "Display name shown across the app" },
    { key: "support_email", value: "support@learnhub.com", group: "general", description: "Public support email" },
    { key: "currency", value: "USD", group: "billing", description: "Default currency" },
    { key: "platform_fee_percent", value: "30", group: "billing", description: "Platform commission on course sales" },
    { key: "registration_enabled", value: "true", group: "auth", description: "Allow new user signups" },
    { key: "maintenance_mode", value: "false", group: "general", description: "Block all non-admin access" },
];

export default function AdminSettings() {
    const [settings, setSettings] = useState([]);
    const [draft, setDraft] = useState({});
    const [saving, setSaving] = useState(null);

    const load = async () => {
        const { data } = await api.get("/admin/settings");
        // Merge defaults with existing
        const map = {};
        DEFAULT_KEYS.forEach((d) => { map[d.key] = d; });
        data.data.forEach((s) => { map[s.key] = s; });
        const list = Object.values(map);
        setSettings(list);
        const d = {};
        list.forEach((s) => { d[s.key] = s.value; });
        setDraft(d);
    };

    useEffect(() => { load(); }, []);

    const save = async (s) => {
        setSaving(s.key);
        try {
            await api.post("/admin/settings", { key: s.key, value: draft[s.key], group: s.group, description: s.description });
            toast.success(`Saved ${s.key}`);
            await load();
        } catch (e) { toast.error(formatApiError(e)); }
        finally { setSaving(null); }
    };

    const groups = [...new Set(settings.map((s) => s.group))];

    return (
        <DashboardLayout title="Platform Settings" subtitle="Configure platform-wide settings.">
            <div className="space-y-8">
                {groups.map((g) => (
                    <Card key={g} className="border-slate-200 bg-white p-6">
                        <h3 className="font-display text-lg font-bold capitalize text-slate-900">{g}</h3>
                        <p className="text-xs text-slate-500">{g === "general" ? "Display & branding" : g === "billing" ? "Pricing & commission" : "Authentication & access"}</p>
                        <div className="mt-5 space-y-4 divide-y divide-slate-100">
                            {settings.filter((s) => s.group === g).map((s) => (
                                <div key={s.key} className="grid items-end gap-4 pt-4 md:grid-cols-[1fr_320px_auto]" data-testid={`setting-${s.key}`}>
                                    <div>
                                        <Label className="text-sm font-semibold text-slate-900">{s.key}</Label>
                                        <p className="text-xs text-slate-500">{s.description}</p>
                                    </div>
                                    {s.value === "true" || s.value === "false" ? (
                                        <select
                                            value={draft[s.key]}
                                            onChange={(e) => setDraft((p) => ({ ...p, [s.key]: e.target.value }))}
                                            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                                            data-testid={`setting-value-${s.key}`}
                                        >
                                            <option value="true">Enabled</option>
                                            <option value="false">Disabled</option>
                                        </select>
                                    ) : (
                                        <Input
                                            value={draft[s.key] ?? ""}
                                            onChange={(e) => setDraft((p) => ({ ...p, [s.key]: e.target.value }))}
                                            data-testid={`setting-value-${s.key}`}
                                        />
                                    )}
                                    <Button
                                        size="sm"
                                        onClick={() => save(s)}
                                        disabled={saving === s.key || draft[s.key] === s.value}
                                        className="bg-brand-800 hover:bg-brand-900"
                                        data-testid={`save-setting-${s.key}`}
                                    >
                                        {saving === s.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-1 h-3 w-3" />Save</>}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </Card>
                ))}
            </div>
        </DashboardLayout>
    );
}

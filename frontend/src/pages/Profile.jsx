import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function Profile() {
    const { user, refresh } = useAuth();
    const [form, setForm] = useState({
        first_name: user?.first_name || "",
        last_name: user?.last_name || "",
        bio: user?.bio || "",
        avatar: user?.avatar || "",
    });
    const [saving, setSaving] = useState(false);
    const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const save = async () => {
        setSaving(true);
        try {
            await api.patch("/users/me", form);
            await refresh();
            toast.success("Profile updated");
        } catch (e) { toast.error(formatApiError(e)); }
        finally { setSaving(false); }
    };

    return (
        <DashboardLayout title="Profile" subtitle="Update your personal details and bio.">
            <Card className="max-w-2xl border-slate-200 bg-white p-6">
                <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                        <AvatarImage src={form.avatar} />
                        <AvatarFallback className="bg-brand-800 text-xl text-white">
                            {form.first_name?.[0]}{form.last_name?.[0]}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <Label>Avatar URL</Label>
                        <Input value={form.avatar} onChange={(e) => update("avatar", e.target.value)} placeholder="https://..." className="mt-2" data-testid="avatar-input" />
                    </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div>
                        <Label>First name</Label>
                        <Input value={form.first_name} onChange={(e) => update("first_name", e.target.value)} className="mt-2" data-testid="first-name-input" />
                    </div>
                    <div>
                        <Label>Last name</Label>
                        <Input value={form.last_name} onChange={(e) => update("last_name", e.target.value)} className="mt-2" data-testid="last-name-input" />
                    </div>
                </div>

                <div className="mt-4">
                    <Label>Email</Label>
                    <Input value={user?.email} disabled className="mt-2 bg-slate-50" />
                </div>

                <div className="mt-4">
                    <Label>Bio</Label>
                    <textarea
                        value={form.bio}
                        onChange={(e) => update("bio", e.target.value)}
                        rows={4}
                        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        data-testid="bio-input"
                    />
                </div>

                <Button onClick={save} disabled={saving} className="mt-6 bg-brand-800 hover:bg-brand-900" data-testid="save-profile-btn">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
                </Button>
            </Card>
        </DashboardLayout>
    );
}

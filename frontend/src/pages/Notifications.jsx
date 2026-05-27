import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, CheckCheck, Award, Megaphone, BookOpen } from "lucide-react";
import api from "@/lib/api";

const TYPE_ICON = {
    ANNOUNCEMENT: Megaphone,
    CERTIFICATE: Award,
    ENROLLMENT: BookOpen,
    SYSTEM: Bell,
};

const TYPE_COLOR = {
    ANNOUNCEMENT: "bg-gold-500/10 text-gold-600",
    CERTIFICATE: "bg-emerald-50 text-emerald-600",
    ENROLLMENT: "bg-brand-50 text-brand-800",
    SYSTEM: "bg-slate-100 text-slate-600",
};

export default function Notifications() {
    const [items, setItems] = useState([]);

    const load = async () => {
        const { data } = await api.get("/notifications");
        setItems(data.data);
    };
    useEffect(() => { load(); }, []);

    const markRead = async (id) => {
        await api.patch(`/notifications/${id}/read`);
        load();
    };
    const markAll = async () => {
        await api.patch("/notifications/read-all");
        load();
    };

    return (
        <DashboardLayout
            title="Notifications"
            subtitle="Updates from your courses and platform."
            action={
                <Button
                    variant="outline"
                    onClick={markAll}
                    disabled={!items.some((i) => !i.is_read)}
                    data-testid="mark-all-read-btn"
                >
                    <CheckCheck className="mr-2 h-4 w-4" />Mark all read
                </Button>
            }
        >
            {items.length === 0 ? (
                <Card className="border-dashed border-slate-300 p-16 text-center">
                    <Bell className="mx-auto h-10 w-10 text-slate-300" />
                    <h3 className="mt-4 font-display text-lg font-bold text-slate-900">All caught up!</h3>
                    <p className="mt-1 text-sm text-slate-500">No notifications right now.</p>
                </Card>
            ) : (
                <div className="space-y-2">
                    {items.map((n) => {
                        const Icon = TYPE_ICON[n.type] || Bell;
                        const color = TYPE_COLOR[n.type] || TYPE_COLOR.SYSTEM;
                        return (
                            <Card key={n.id} className={`border-slate-200 p-4 ${!n.is_read ? "bg-brand-50/40 border-brand-200" : "bg-white"}`} data-testid={`notif-${n.id}`}>
                                <div className="flex items-start gap-3">
                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color}`}>
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <div className="font-display font-semibold text-slate-900">{n.title}</div>
                                            {!n.is_read && <Badge className="bg-brand-800 text-white hover:bg-brand-800">New</Badge>}
                                        </div>
                                        <p className="mt-1 text-sm text-slate-600">{n.message}</p>
                                        <div className="mt-2 text-xs text-slate-400">{new Date(n.created_at).toLocaleString()}</div>
                                    </div>
                                    {!n.is_read && (
                                        <Button size="sm" variant="ghost" onClick={() => markRead(n.id)} data-testid={`read-${n.id}`}>
                                            <Check className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </DashboardLayout>
    );
}

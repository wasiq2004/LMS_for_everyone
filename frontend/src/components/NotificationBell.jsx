import { Link } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/contexts/NotificationContext";

export default function NotificationBell({ className = "" }) {
    const { items, unread, markAllRead, markRead } = useNotifications();

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button className={`relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 ${className}`} data-testid="notif-bell">
                    <Bell className="h-5 w-5" />
                    {unread > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-white" data-testid="notif-unread-count">
                            {unread > 9 ? "9+" : unread}
                        </span>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between border-b border-slate-200 p-3">
                    <h4 className="font-display font-semibold text-slate-900">Notifications</h4>
                    {unread > 0 && (
                        <Button variant="ghost" size="sm" onClick={markAllRead} data-testid="bell-mark-all">
                            <CheckCheck className="mr-1 h-3 w-3" />Mark all read
                        </Button>
                    )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                    {items.length === 0 ? (
                        <div className="p-6 text-center text-sm text-slate-500">All caught up!</div>
                    ) : items.slice(0, 12).map((n) => (
                        <Link
                            key={n.id}
                            to={n.link || "/dashboard/notifications"}
                            onClick={() => !n.is_read && markRead(n.id)}
                            className={`flex flex-col gap-1 border-b border-slate-100 p-3 last:border-0 hover:bg-slate-50 ${!n.is_read ? "bg-brand-50/40" : ""}`}
                            data-testid={`bell-item-${n.id}`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="font-display text-sm font-semibold text-slate-900">{n.title}</div>
                                {!n.is_read && <span className="h-2 w-2 rounded-full bg-gold-500" />}
                            </div>
                            <p className="text-xs text-slate-600 line-clamp-2">{n.message}</p>
                            <div className="text-[10px] text-slate-400">{new Date(n.created_at).toLocaleString()}</div>
                        </Link>
                    ))}
                </div>
                <Link to="/dashboard/notifications" className="block border-t border-slate-200 p-3 text-center text-xs font-medium text-brand-800 hover:bg-slate-50">View all</Link>
            </PopoverContent>
        </Popover>
    );
}

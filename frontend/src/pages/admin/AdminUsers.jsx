import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ToggleLeft, ToggleRight } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function AdminUsers() {
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState("");
    const [role, setRole] = useState("");

    const load = async () => {
        const qs = new URLSearchParams();
        if (search) qs.set("search", search);
        if (role) qs.set("role", role);
        const { data } = await api.get(`/admin/users?${qs.toString()}`);
        setUsers(data.data);
    };

    useEffect(() => { load(); }, [search, role]);

    const changeRole = async (uid, newRole) => {
        try {
            await api.patch(`/admin/users/${uid}/role`, { role: newRole });
            await load();
            toast.success("Role updated");
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const toggleActive = async (uid) => {
        try {
            await api.patch(`/admin/users/${uid}/toggle-active`);
            await load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <DashboardLayout title="User Management" subtitle="Manage roles, status and access.">
            <Card className="border-slate-200 bg-white">
                <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
                    <div className="relative flex-1 min-w-[240px]">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input className="pl-10" placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} data-testid="admin-user-search" />
                    </div>
                    <Select value={role || "all"} onValueChange={(v) => setRole(v === "all" ? "" : v)}>
                        <SelectTrigger className="w-44" data-testid="admin-role-filter"><SelectValue placeholder="All roles" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All roles</SelectItem>
                            <SelectItem value="STUDENT">Student</SelectItem>
                            <SelectItem value="EDUCATOR">Educator</SelectItem>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((u) => (
                            <TableRow key={u.id} data-testid={`user-row-${u.id}`}>
                                <TableCell className="font-medium">{u.first_name} {u.last_name}</TableCell>
                                <TableCell className="text-slate-600">{u.email}</TableCell>
                                <TableCell>
                                    <Select value={u.role} onValueChange={(v) => changeRole(u.id, v)}>
                                        <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="STUDENT">Student</SelectItem>
                                            <SelectItem value="EDUCATOR">Educator</SelectItem>
                                            <SelectItem value="ADMIN">Admin</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell>
                                    <Badge className={u.is_active ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-slate-200 text-slate-700 hover:bg-slate-200"}>
                                        {u.is_active ? "Active" : "Disabled"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button size="sm" variant="ghost" onClick={() => toggleActive(u.id)} data-testid={`toggle-${u.id}`}>
                                        {u.is_active ? <><ToggleRight className="mr-1 h-4 w-4" />Disable</> : <><ToggleLeft className="mr-1 h-4 w-4" />Enable</>}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </DashboardLayout>
    );
}

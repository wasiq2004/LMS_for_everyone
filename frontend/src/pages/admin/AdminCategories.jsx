import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";

function slugify(s) {
    return s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/[\s-]+/g, "-");
}

export default function AdminCategories() {
    const [cats, setCats] = useState([]);
    const [name, setName] = useState("");
    const [color, setColor] = useState("#1e40af");

    const load = async () => {
        const { data } = await api.get("/categories");
        setCats(data.data);
    };
    useEffect(() => { load(); }, []);

    const add = async () => {
        if (!name) return;
        try {
            await api.post("/categories", { name, slug: slugify(name), color, description: "", icon: "" });
            setName("");
            await load();
            toast.success("Category added");
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const remove = async (id) => {
        if (!confirm("Delete category?")) return;
        try {
            await api.delete(`/categories/${id}`);
            await load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <DashboardLayout title="Categories" subtitle="Organize your catalog into clear tracks.">
            <Card className="border-slate-200 bg-white p-6">
                <div className="flex flex-wrap gap-3">
                    <Input placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} className="max-w-sm" data-testid="new-cat-name" />
                    <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-16 cursor-pointer" data-testid="new-cat-color" />
                    <Button onClick={add} className="bg-brand-800 hover:bg-brand-900" data-testid="add-category-btn"><Plus className="mr-2 h-4 w-4" />Add</Button>
                </div>

                <ul className="mt-6 space-y-2">
                    {cats.map((c) => (
                        <li key={c.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                            <div className="flex items-center gap-3">
                                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color || "#1e40af" }} />
                                <div>
                                    <div className="font-display font-semibold text-slate-900">{c.name}</div>
                                    <div className="text-xs text-slate-500">{c.course_count} courses · {c.slug}</div>
                                </div>
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => remove(c.id)} data-testid={`delete-cat-${c.id}`}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                        </li>
                    ))}
                </ul>
            </Card>
        </DashboardLayout>
    );
}

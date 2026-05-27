import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, BookOpen, Star } from "lucide-react";
import CourseCard from "@/components/CourseCard";
import api from "@/lib/api";

export default function InstructorProfile() {
    const { id } = useParams();
    const [data, setData] = useState(null);

    useEffect(() => { (async () => {
        try {
            const { data: d } = await api.get(`/users/instructor/${id}`);
            setData(d.data);
        } catch { /* not found */ }
    })(); }, [id]);

    if (!data) return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />
            <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-brand-800" /></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />
            <section className="border-b border-slate-200 bg-brand-800 text-white">
                <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-14">
                    <Avatar className="h-24 w-24 border-4 border-gold-500">
                        <AvatarImage src={data.avatar} />
                        <AvatarFallback className="bg-gold-500 text-3xl text-white">{data.first_name?.[0]}{data.last_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-widest text-gold-400">Instructor</div>
                        <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">{data.first_name} {data.last_name}</h1>
                        <p className="mt-2 max-w-xl text-white/80">{data.bio}</p>
                        <div className="mt-4 flex items-center gap-6 text-sm">
                            <div className="flex items-center gap-1.5"><BookOpen className="h-4 w-4 text-gold-400" />{data.courses?.length || 0} courses</div>
                            <div className="flex items-center gap-1.5"><Star className="h-4 w-4 fill-gold-500 text-gold-500" />Top rated</div>
                        </div>
                    </div>
                </div>
            </section>

            <div className="mx-auto max-w-5xl px-6 py-10">
                <h2 className="font-display text-xl font-bold text-slate-900">Courses by {data.first_name}</h2>
                <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {(data.courses || []).map((c) => <CourseCard key={c.id} course={c} />)}
                    {(!data.courses || data.courses.length === 0) && (
                        <p className="text-sm text-slate-500">No published courses yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

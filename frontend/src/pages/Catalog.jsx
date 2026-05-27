import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import CourseCard from "@/components/CourseCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, SlidersHorizontal } from "lucide-react";
import api from "@/lib/api";

export default function Catalog() {
    const [params, setParams] = useSearchParams();
    const [courses, setCourses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);

    const category = params.get("category") || "";
    const level = params.get("level") || "";
    const sort = params.get("sort") || "newest";
    const search = params.get("search") || "";
    const isFree = params.get("free") || "";

    useEffect(() => { (async () => {
        const { data } = await api.get("/categories");
        setCategories(data.data);
    })(); }, []);

    useEffect(() => { (async () => {
        setLoading(true);
        const qs = new URLSearchParams();
        if (category) qs.set("category", category);
        if (level) qs.set("level", level);
        if (sort) qs.set("sort", sort);
        if (search) qs.set("search", search);
        if (isFree) qs.set("is_free", isFree);
        qs.set("limit", "12");
        const { data } = await api.get(`/courses?${qs.toString()}`);
        setCourses(data.data);
        setTotal(data.pagination?.total || 0);
        setLoading(false);
    })(); }, [category, level, sort, search, isFree]);

    const setParam = (key, value) => {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value); else next.delete(key);
        setParams(next);
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />
            <div className="border-b border-slate-200 bg-white">
                <div className="mx-auto max-w-7xl px-6 py-10">
                    <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 lg:text-4xl">Browse the catalog</h1>
                    <p className="mt-2 text-slate-600">{total} courses · Built by practitioners. Designed for outcomes.</p>
                </div>
            </div>
            <div className="mx-auto max-w-7xl px-6 py-10">
                <div className="mb-8 grid gap-3 lg:grid-cols-[1fr_auto_auto_auto_auto]">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                            data-testid="search-input"
                            placeholder="Search courses, topics, skills..."
                            value={search}
                            onChange={(e) => setParam("search", e.target.value)}
                            className="pl-10 h-11"
                        />
                    </div>
                    <Select value={category || "all"} onValueChange={(v) => setParam("category", v === "all" ? "" : v)}>
                        <SelectTrigger className="h-11 min-w-[160px]" data-testid="filter-category"><SelectValue placeholder="Category" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All categories</SelectItem>
                            {categories.map((c) => <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={level || "all"} onValueChange={(v) => setParam("level", v === "all" ? "" : v)}>
                        <SelectTrigger className="h-11 min-w-[140px]" data-testid="filter-level"><SelectValue placeholder="Level" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All levels</SelectItem>
                            <SelectItem value="BEGINNER">Beginner</SelectItem>
                            <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
                            <SelectItem value="ADVANCED">Advanced</SelectItem>
                            <SelectItem value="ALL_LEVELS">All Levels</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={isFree || "any"} onValueChange={(v) => setParam("free", v === "any" ? "" : v)}>
                        <SelectTrigger className="h-11 min-w-[120px]" data-testid="filter-price"><SelectValue placeholder="Price" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="any">Any price</SelectItem>
                            <SelectItem value="true">Free only</SelectItem>
                            <SelectItem value="false">Paid only</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={sort} onValueChange={(v) => setParam("sort", v)}>
                        <SelectTrigger className="h-11 min-w-[140px]" data-testid="filter-sort"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="newest">Newest</SelectItem>
                            <SelectItem value="popular">Popular</SelectItem>
                            <SelectItem value="rating">Top rated</SelectItem>
                            <SelectItem value="price_asc">Price ↑</SelectItem>
                            <SelectItem value="price_desc">Price ↓</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {loading ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="aspect-[4/5] animate-pulse rounded-xl bg-white" />
                        ))}
                    </div>
                ) : courses.length === 0 ? (
                    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-16 text-center">
                        <SlidersHorizontal className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                        <h3 className="font-display text-lg font-semibold text-slate-900">No courses match your filters</h3>
                        <p className="mt-1 text-sm text-slate-500">Try clearing some filters or adjusting your search.</p>
                        <Button variant="outline" className="mt-4" onClick={() => setParams({})} data-testid="clear-filters">
                            Clear filters
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" data-testid="course-grid">
                        {courses.map((c) => <CourseCard key={c.id} course={c} />)}
                    </div>
                )}
            </div>
        </div>
    );
}

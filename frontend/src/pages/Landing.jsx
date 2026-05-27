import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import CourseCard from "@/components/CourseCard";
import { Button } from "@/components/ui/button";
import { ArrowRight, Star, Users, Award, PlayCircle, Code, BarChart3, Palette, Briefcase, Megaphone } from "lucide-react";
import api from "@/lib/api";

const CATEGORY_ICON = {
    "Web Development": Code,
    "Data Science": BarChart3,
    "Design": Palette,
    "Business": Briefcase,
    "Marketing": Megaphone,
};

export default function Landing() {
    const [courses, setCourses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [stats, setStats] = useState({ courses: 0, students: 0 });

    useEffect(() => {
        (async () => {
            try {
                const [c, cats] = await Promise.all([
                    api.get("/courses?limit=6&sort=popular"),
                    api.get("/categories"),
                ]);
                setCourses(c.data.data);
                setCategories(cats.data.data);
                setStats({
                    courses: c.data.pagination?.total || 0,
                    students: cats.data.data.reduce((sum, ct) => sum + ct.course_count * 50, 1200),
                });
            } catch (e) { console.error(e); }
        })();
    }, []);

    return (
        <div className="min-h-screen bg-white">
            <Navbar />

            {/* HERO */}
            <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-white via-brand-50/40 to-white">
                <div
                    className="absolute inset-0 opacity-[0.08]"
                    style={{
                        backgroundImage: "url('https://static.prod-images.emergentagent.com/jobs/eae26e5d-b97e-437c-99fd-58debe5155a0/images/313a7d058130c9e1d2a739c12732f9675321c1b8431603eb716f070914020c8d.png')",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                    }}
                />
                <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 py-24 lg:grid-cols-12 lg:py-32">
                    <div className="lg:col-span-7">
                        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-brand-800">
                            <span className="h-2 w-2 rounded-full bg-gold-500" /> New cohorts starting weekly
                        </div>
                        <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-slate-900 text-balance sm:text-5xl lg:text-6xl">
                            Master skills that <span className="text-brand-800">actually matter.</span>{" "}
                            <span className="bg-gradient-to-r from-gold-500 to-gold-600 bg-clip-text text-transparent">Learn from experts.</span>
                        </h1>
                        <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
                            Industry-grade courses in development, data, design and business — taught by practitioners, structured for outcomes, certified at the end.
                        </p>
                        <div className="mt-8 flex flex-wrap items-center gap-4">
                            <Link to="/courses">
                                <Button size="lg" className="bg-brand-800 hover:bg-brand-900 px-8" data-testid="hero-browse-btn">
                                    Browse Courses <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                            <Link to="/register">
                                <Button size="lg" variant="outline" className="border-slate-300" data-testid="hero-register-btn">
                                    Start free <PlayCircle className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                        </div>
                        <div className="mt-10 grid grid-cols-3 gap-6 border-t border-slate-200 pt-8">
                            <div>
                                <div className="font-display text-2xl font-bold text-slate-900">{stats.courses}+</div>
                                <div className="text-xs uppercase tracking-wider text-slate-500">Courses</div>
                            </div>
                            <div>
                                <div className="font-display text-2xl font-bold text-slate-900">{stats.students}+</div>
                                <div className="text-xs uppercase tracking-wider text-slate-500">Students</div>
                            </div>
                            <div>
                                <div className="font-display text-2xl font-bold text-slate-900">4.8</div>
                                <div className="flex items-center gap-1 text-xs uppercase tracking-wider text-slate-500">
                                    <Star className="h-3 w-3 fill-gold-500 text-gold-500" /> Avg rating
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="relative lg:col-span-5">
                        <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-brand-800/10 to-gold-500/10 blur-2xl" />
                        <div className="relative rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl">
                            <img
                                src="https://images.unsplash.com/photo-1515378791036-0648a3ef77b2"
                                alt="Student learning"
                                className="aspect-[4/5] w-full rounded-2xl object-cover"
                            />
                        </div>
                        <div className="absolute -bottom-6 -left-6 hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:block">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-500 text-white">
                                    <Award className="h-5 w-5" />
                                </div>
                                <div>
                                    <div className="font-display text-sm font-bold text-slate-900">Certified</div>
                                    <div className="text-xs text-slate-500">On completion</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CATEGORIES */}
            <section className="border-b border-slate-200 bg-slate-50 py-20">
                <div className="mx-auto max-w-7xl px-6">
                    <div className="mb-12 flex items-end justify-between">
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-wider text-brand-800">Categories</div>
                            <h2 className="mt-2 font-display text-3xl font-bold text-slate-900">Browse by category</h2>
                        </div>
                        <Link to="/courses" className="hidden text-sm font-medium text-brand-800 hover:underline md:block">View all →</Link>
                    </div>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                        {categories.map((cat) => {
                            const Icon = CATEGORY_ICON[cat.name] || Code;
                            return (
                                <Link
                                    key={cat.id}
                                    to={`/courses?category=${cat.slug}`}
                                    data-testid={`category-${cat.slug}`}
                                    className="group rounded-xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
                                >
                                    <div
                                        className="flex h-12 w-12 items-center justify-center rounded-lg text-white"
                                        style={{ backgroundColor: cat.color || "#1e40af" }}
                                    >
                                        <Icon className="h-6 w-6" />
                                    </div>
                                    <div className="mt-4 font-display font-semibold text-slate-900">{cat.name}</div>
                                    <div className="mt-1 text-xs text-slate-500">{cat.course_count} courses</div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* FEATURED COURSES */}
            <section className="py-20">
                <div className="mx-auto max-w-7xl px-6">
                    <div className="mb-12 flex items-end justify-between">
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-wider text-brand-800">Featured</div>
                            <h2 className="mt-2 font-display text-3xl font-bold text-slate-900">Popular right now</h2>
                        </div>
                        <Link to="/courses" className="text-sm font-medium text-brand-800 hover:underline">Browse all →</Link>
                    </div>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {courses.map((c) => <CourseCard key={c.id} course={c} />)}
                    </div>
                </div>
            </section>

            {/* SOCIAL PROOF */}
            <section className="bg-brand-800 py-20 text-white">
                <div className="mx-auto max-w-7xl px-6">
                    <div className="grid items-center gap-12 lg:grid-cols-2">
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-wider text-gold-500">Why LearnHub</div>
                            <h2 className="mt-2 font-display text-3xl font-bold lg:text-4xl">Built for serious learners.</h2>
                            <p className="mt-4 text-white/80 leading-relaxed">
                                We obsess over learning outcomes. Every course is structured around real projects, peer feedback, and a path to certification.
                            </p>
                            <div className="mt-8 grid grid-cols-2 gap-6">
                                <Stat icon={Users} value="50K+" label="Active learners" />
                                <Stat icon={Award} value="12K+" label="Certificates issued" />
                                <Stat icon={Star} value="4.8/5" label="Avg course rating" />
                                <Stat icon={PlayCircle} value="1.2M+" label="Lessons watched" />
                            </div>
                        </div>
                        <div className="grid gap-4">
                            <Testimonial
                                quote="The curriculum is the best I've seen — practical, modern, and the projects landed me my first dev job."
                                name="Priya Patel"
                                role="Frontend Engineer"
                                avatar="https://images.unsplash.com/photo-1494790108377-be9c29b29330"
                            />
                            <Testimonial
                                quote="Marcus's data science track was a game changer. Everything is hands-on with real datasets."
                                name="John Doe"
                                role="Data Analyst"
                                avatar="https://images.pexels.com/photos/8199246/pexels-photo-8199246.jpeg"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="border-t border-slate-200 bg-slate-50 py-20">
                <div className="mx-auto max-w-4xl px-6 text-center">
                    <h2 className="font-display text-3xl font-bold text-slate-900 lg:text-4xl">Ready to upgrade your skills?</h2>
                    <p className="mt-4 text-slate-600">Join thousands of learners advancing their careers with LearnHub.</p>
                    <div className="mt-8 flex flex-wrap justify-center gap-4">
                        <Link to="/register">
                            <Button size="lg" className="bg-brand-800 hover:bg-brand-900 px-8" data-testid="cta-register">Get started free</Button>
                        </Link>
                        <Link to="/courses">
                            <Button size="lg" variant="outline" data-testid="cta-courses">Browse courses</Button>
                        </Link>
                    </div>
                </div>
            </section>

            <footer className="border-t border-slate-200 bg-white py-10">
                <div className="mx-auto max-w-7xl px-6 text-center text-sm text-slate-500">
                    © {new Date().getFullYear()} LearnHub. Built for learners everywhere.
                </div>
            </footer>
        </div>
    );
}

function Stat({ icon: Icon, value, label }) {
    return (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <Icon className="h-5 w-5 text-gold-500" />
            <div className="mt-2 font-display text-2xl font-bold">{value}</div>
            <div className="text-xs uppercase tracking-wider text-white/60">{label}</div>
        </div>
    );
}

function Testimonial({ quote, name, role, avatar }) {
    return (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-white/90 italic leading-relaxed">"{quote}"</p>
            <div className="mt-4 flex items-center gap-3">
                <img src={avatar} className="h-10 w-10 rounded-full object-cover" alt={name} />
                <div>
                    <div className="font-display text-sm font-semibold">{name}</div>
                    <div className="text-xs text-white/60">{role}</div>
                </div>
            </div>
        </div>
    );
}

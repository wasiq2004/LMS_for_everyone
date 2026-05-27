import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Clock, Users } from "lucide-react";

const FALLBACK_THUMB = "https://images.unsplash.com/photo-1515879218367-8466d910aaa4";

export default function CourseCard({ course, progress = null }) {
    const c = course;
    return (
        <Link
            to={`/courses/${c.slug}`}
            data-testid={`course-card-${c.slug || c.id}`}
            className="group block"
        >
            <Card className="overflow-hidden border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                <div className="relative aspect-video overflow-hidden bg-slate-100">
                    <img
                        src={c.thumbnail || FALLBACK_THUMB}
                        alt={c.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => { e.currentTarget.src = FALLBACK_THUMB; }}
                    />
                    <div className="absolute left-3 top-3 flex gap-2">
                        {c.is_free && <Badge className="bg-gold-500 text-white hover:bg-gold-600">Free</Badge>}
                        {c.level && <Badge variant="secondary" className="bg-white/90 text-slate-700">{c.level.replace("_", " ")}</Badge>}
                    </div>
                </div>
                <div className="space-y-3 p-5">
                    {c.category && (
                        <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: c.category.color || "#1e40af" }}>
                            {c.category.name}
                        </div>
                    )}
                    <h3 className="font-display text-base font-semibold leading-snug text-slate-900 line-clamp-2">
                        {c.title}
                    </h3>
                    {c.educator && (
                        <p className="text-xs text-slate-500">
                            By {c.educator.first_name} {c.educator.last_name}
                        </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-gold-500 text-gold-500" />{(c.average_rating || 0).toFixed(1)}</span>
                        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{c.total_enrollments || 0}</span>
                        {c.estimated_duration ? <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{Math.round(c.estimated_duration / 60)}h</span> : null}
                    </div>
                    {progress !== null && (
                        <div data-testid="course-progress-bar">
                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                                <span>Progress</span>
                                <span>{Math.round(progress)}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-gold-500 transition-all duration-500"
                                    style={{ width: `${Math.min(100, progress)}%` }}
                                />
                            </div>
                        </div>
                    )}
                    <div className="flex items-center justify-between pt-1">
                        <div className="font-display text-lg font-bold text-brand-800">
                            {c.is_free ? "Free" : `$${Number(c.price).toFixed(2)}`}
                        </div>
                    </div>
                </div>
            </Card>
        </Link>
    );
}

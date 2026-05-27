import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

import Landing from "@/pages/Landing";
import Catalog from "@/pages/Catalog";
import CourseDetail from "@/pages/CourseDetail";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Profile from "@/pages/Profile";

import StudentDashboard from "@/pages/student/StudentDashboard";
import MyCourses from "@/pages/student/MyCourses";
import CoursePlayer from "@/pages/student/CoursePlayer";

import EducatorDashboard from "@/pages/educator/EducatorDashboard";
import EducatorCourses from "@/pages/educator/EducatorCourses";
import CourseBuilder from "@/pages/educator/CourseBuilder";

import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminCourses from "@/pages/admin/AdminCourses";
import AdminCategories from "@/pages/admin/AdminCategories";

function PlaceholderPage({ title }) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <h1 className="font-display text-2xl font-bold text-slate-900">{title}</h1>
                <p className="mt-2 text-sm text-slate-500">This page is coming soon.</p>
            </div>
        </div>
    );
}

function RoleHome() {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" />;
    if (user.role === "ADMIN") return <Navigate to="/admin/dashboard" />;
    if (user.role === "EDUCATOR") return <Navigate to="/educator/dashboard" />;
    return <Navigate to="/dashboard" />;
}

export default function App() {
    return (
        <div className="App">
            <BrowserRouter>
                <AuthProvider>
                    <Toaster position="top-right" richColors closeButton />
                    <Routes>
                        {/* Public */}
                        <Route path="/" element={<Landing />} />
                        <Route path="/courses" element={<Catalog />} />
                        <Route path="/courses/:slug" element={<CourseDetail />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/forgot-password" element={<PlaceholderPage title="Forgot password" />} />
                        <Route path="/certificate/verify" element={<PlaceholderPage title="Verify Certificate" />} />
                        <Route path="/me" element={<RoleHome />} />

                        {/* Student */}
                        <Route path="/dashboard" element={<ProtectedRoute roles={["STUDENT", "EDUCATOR", "ADMIN"]}><StudentDashboard /></ProtectedRoute>} />
                        <Route path="/dashboard/courses" element={<ProtectedRoute><MyCourses /></ProtectedRoute>} />
                        <Route path="/dashboard/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                        <Route path="/dashboard/certificates" element={<ProtectedRoute><PlaceholderPage title="My Certificates" /></ProtectedRoute>} />
                        <Route path="/dashboard/notifications" element={<ProtectedRoute><PlaceholderPage title="Notifications" /></ProtectedRoute>} />
                        <Route path="/learn/:slug" element={<ProtectedRoute><CoursePlayer /></ProtectedRoute>} />

                        {/* Educator */}
                        <Route path="/educator/dashboard" element={<ProtectedRoute roles={["EDUCATOR", "ADMIN"]}><EducatorDashboard /></ProtectedRoute>} />
                        <Route path="/educator/courses" element={<ProtectedRoute roles={["EDUCATOR", "ADMIN"]}><EducatorCourses /></ProtectedRoute>} />
                        <Route path="/educator/courses/new" element={<ProtectedRoute roles={["EDUCATOR", "ADMIN"]}><CourseBuilder /></ProtectedRoute>} />
                        <Route path="/educator/courses/:id/edit" element={<ProtectedRoute roles={["EDUCATOR", "ADMIN"]}><CourseBuilder /></ProtectedRoute>} />
                        <Route path="/educator/earnings" element={<ProtectedRoute roles={["EDUCATOR", "ADMIN"]}><PlaceholderPage title="Earnings" /></ProtectedRoute>} />

                        {/* Admin */}
                        <Route path="/admin/dashboard" element={<ProtectedRoute roles={["ADMIN"]}><AdminDashboard /></ProtectedRoute>} />
                        <Route path="/admin/users" element={<ProtectedRoute roles={["ADMIN"]}><AdminUsers /></ProtectedRoute>} />
                        <Route path="/admin/courses" element={<ProtectedRoute roles={["ADMIN"]}><AdminCourses /></ProtectedRoute>} />
                        <Route path="/admin/categories" element={<ProtectedRoute roles={["ADMIN"]}><AdminCategories /></ProtectedRoute>} />
                        <Route path="/admin/reports" element={<ProtectedRoute roles={["ADMIN"]}><PlaceholderPage title="Reports" /></ProtectedRoute>} />
                        <Route path="/admin/settings" element={<ProtectedRoute roles={["ADMIN"]}><PlaceholderPage title="Settings" /></ProtectedRoute>} />

                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </AuthProvider>
            </BrowserRouter>
        </div>
    );
}

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
import CertificateVerify from "@/pages/CertificateVerify";
import { ForgotPassword, ResetPassword } from "@/pages/AuthExtra";
import InstructorProfile from "@/pages/InstructorProfile";
import Announcements from "@/pages/Announcements";
import Notifications from "@/pages/Notifications";

import StudentDashboard from "@/pages/student/StudentDashboard";
import MyCourses from "@/pages/student/MyCourses";
import CoursePlayer from "@/pages/student/CoursePlayer";
import QuizView from "@/pages/student/QuizView";
import Certificates from "@/pages/student/Certificates";

import EducatorDashboard from "@/pages/educator/EducatorDashboard";
import EducatorCourses from "@/pages/educator/EducatorCourses";
import CourseBuilder from "@/pages/educator/CourseBuilder";
import QuizBuilder from "@/pages/educator/QuizBuilder";
import EducatorEarnings from "@/pages/educator/EducatorEarnings";

import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminCourses from "@/pages/admin/AdminCourses";
import AdminCategories from "@/pages/admin/AdminCategories";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminReports from "@/pages/admin/AdminReports";

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
                        <Route path="/instructor/:id" element={<InstructorProfile />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />
                        <Route path="/reset-password/:token" element={<ResetPassword />} />
                        <Route path="/certificate/verify" element={<CertificateVerify />} />
                        <Route path="/me" element={<RoleHome />} />

                        {/* Student */}
                        <Route path="/dashboard" element={<ProtectedRoute roles={["STUDENT", "EDUCATOR", "ADMIN"]}><StudentDashboard /></ProtectedRoute>} />
                        <Route path="/dashboard/courses" element={<ProtectedRoute><MyCourses /></ProtectedRoute>} />
                        <Route path="/dashboard/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                        <Route path="/dashboard/certificates" element={<ProtectedRoute><Certificates /></ProtectedRoute>} />
                        <Route path="/dashboard/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                        <Route path="/dashboard/announcements" element={<ProtectedRoute><Announcements /></ProtectedRoute>} />
                        <Route path="/learn/:slug" element={<ProtectedRoute><CoursePlayer /></ProtectedRoute>} />
                        <Route path="/quiz/:lessonId" element={<ProtectedRoute><QuizView /></ProtectedRoute>} />

                        {/* Educator */}
                        <Route path="/educator/dashboard" element={<ProtectedRoute roles={["EDUCATOR", "ADMIN"]}><EducatorDashboard /></ProtectedRoute>} />
                        <Route path="/educator/courses" element={<ProtectedRoute roles={["EDUCATOR", "ADMIN"]}><EducatorCourses /></ProtectedRoute>} />
                        <Route path="/educator/courses/new" element={<ProtectedRoute roles={["EDUCATOR", "ADMIN"]}><CourseBuilder /></ProtectedRoute>} />
                        <Route path="/educator/courses/:id/edit" element={<ProtectedRoute roles={["EDUCATOR", "ADMIN"]}><CourseBuilder /></ProtectedRoute>} />
                        <Route path="/educator/quiz/:lessonId" element={<ProtectedRoute roles={["EDUCATOR", "ADMIN"]}><QuizBuilder /></ProtectedRoute>} />
                        <Route path="/educator/earnings" element={<ProtectedRoute roles={["EDUCATOR", "ADMIN"]}><EducatorEarnings /></ProtectedRoute>} />
                        <Route path="/educator/announcements" element={<ProtectedRoute roles={["EDUCATOR", "ADMIN"]}><Announcements /></ProtectedRoute>} />

                        {/* Admin */}
                        <Route path="/admin/dashboard" element={<ProtectedRoute roles={["ADMIN"]}><AdminDashboard /></ProtectedRoute>} />
                        <Route path="/admin/users" element={<ProtectedRoute roles={["ADMIN"]}><AdminUsers /></ProtectedRoute>} />
                        <Route path="/admin/courses" element={<ProtectedRoute roles={["ADMIN"]}><AdminCourses /></ProtectedRoute>} />
                        <Route path="/admin/categories" element={<ProtectedRoute roles={["ADMIN"]}><AdminCategories /></ProtectedRoute>} />
                        <Route path="/admin/reports" element={<ProtectedRoute roles={["ADMIN"]}><AdminReports /></ProtectedRoute>} />
                        <Route path="/admin/settings" element={<ProtectedRoute roles={["ADMIN"]}><AdminSettings /></ProtectedRoute>} />
                        <Route path="/admin/announcements" element={<ProtectedRoute roles={["ADMIN"]}><Announcements /></ProtectedRoute>} />

                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </AuthProvider>
            </BrowserRouter>
        </div>
    );
}

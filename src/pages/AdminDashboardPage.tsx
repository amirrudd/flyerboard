import { useNavigate } from "react-router-dom";
import { AdminDashboard } from "../features/admin/AdminDashboard";

export default function AdminDashboardPage() {
    const navigate = useNavigate();

    return <AdminDashboard onBack={() => navigate("/")} />;
}

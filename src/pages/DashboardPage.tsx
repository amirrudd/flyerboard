import { useNavigate } from "react-router-dom";
import { UserDashboard } from "../features/dashboard/UserDashboard";

export function DashboardPage() {
    const navigate = useNavigate();

    return (
        <UserDashboard
            onBack={() => navigate('/')}
            onPostAd={() => navigate('/post', { state: { from: '/dashboard' } })}
            onEditAd={(ad) => navigate('/post', { state: { editingAd: ad, from: '/dashboard' } })}
        />
    );
}

export default DashboardPage;

import { Toaster } from "sonner";
// import { DivarApp } from "./components/DivarApp";
import { ComingSoon } from "./components/ComingSoon";

export default function App() {
  return (
    <div className="min-h-screen bg-white">
      {/* <DivarApp /> */}
      <ComingSoon />
      <Toaster />
    </div>
  );
}

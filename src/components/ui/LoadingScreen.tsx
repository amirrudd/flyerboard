export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-pulse text-6xl mb-4">🔄</div>
        <h2 className="text-xl font-semibold text-[#333333] mb-2">Loading...</h2>
        <p className="text-gray-600">Please wait</p>
      </div>
    </div>
  );
}

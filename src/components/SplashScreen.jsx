import InventiQIcon from './InventiQIcon';

export default function SplashScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-950 via-teal-800 to-emerald-500 p-6">
      <div className="text-center text-white">
        <div className="mx-auto mb-5 flex justify-center">
          <InventiQIcon className="h-28 w-28 rounded-[2rem] object-cover shadow-2xl" />
        </div>
        <h1 className="text-4xl font-extrabold">InventiQ</h1>
        <p className="mt-2 text-sm font-semibold text-emerald-100">Control inteligente de inventarios</p>
        <div className="mx-auto mt-6 h-2 w-40 overflow-hidden rounded-full bg-white/20">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-white" />
        </div>
      </div>
    </div>
  );
}
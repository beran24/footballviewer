import Link from "next/link";
import VideoPlayer from "./VideoPlayer";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <Link
        href="/tactics"
        className="absolute left-4 top-4 z-20 rounded-md border border-slate-500 bg-slate-900/85 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
      >
        Go to Tactics
      </Link>
      <VideoPlayer />
    </div>
  );
}

import Dashboard from "./components/Dashboard";
import { Truck, Navigation, ShieldAlert, Clock, Mail, Shield } from "lucide-react";

export default function App() {
  const currentUtcTime = "2026-06-09 07:46:30"; // Formatted local/UTC time in Thai template
  const userStaffEmail = "chewaphorn@tni.ac.th";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      
      {/* 🌟 PROFESSIONAL POLISH HIGH-END TOOLBAR */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 shadow-xs z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white rounded-full flex items-center justify-center">
              <span className="text-[9px] font-black text-white">T</span>
            </div>
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight">
              TMS <span className="text-blue-600">4LD</span>
            </span>
            <span className="hidden sm:inline-block ml-3 px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded text-[10px] text-blue-600 font-bold uppercase">
              ระบบขนส่งและวางแผนเส้นทางสะสม v2.0
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-6">
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
            <span className="font-medium text-slate-605">ระบบควบคุมความเร็วเรียลไทม์ (Active)</span>
          </div>

          <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-bold leading-none text-slate-800">{userStaffEmail}</p>
              <p className="text-[10px] text-slate-400 mt-1">Fleet Administrator</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-slate-150 flex items-center justify-center border border-slate-200 text-blue-600">
              <span className="text-xs font-black">C</span>
            </div>
          </div>
        </div>
      </header>

      {/* PRIMARY ACTIVE WORKSPACE */}
      <main className="flex-1 pb-12">
        <Dashboard />
      </main>

      {/* 🌟 STANDARDIZED BOTTOM STATUS BAR */}
      <footer className="h-9 bg-slate-900 text-[10px] text-slate-400 px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex gap-4">
          <span>Session Log ID: <span className="text-slate-200 font-mono">TRK_LIVE_0922</span></span>
          <span className="hidden sm:inline-block">Last Sync: <span className="text-slate-200">2026-06-09 {currentUtcTime.split(" ")[1]} น.</span></span>
        </div>
        <div className="flex gap-4 uppercase font-bold tracking-tighter">
          <span className="text-emerald-500 uppercase tracking-widest flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> SYSTEM ACTIVE
          </span>
          <span className="hidden xs:inline-block">TNI Logistics Compliance v1.2</span>
        </div>
      </footer>

    </div>
  );
}


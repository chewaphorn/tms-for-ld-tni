import { GPSPoint } from "../types";

/**
 * Calculates the distance between two GPS coordinates in kilometers using the Haversine formula
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates the directional bearing in degrees (0 - 360) between two GPS points
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  let brng = Math.atan2(y, x);
  brng = (brng * 180) / Math.PI;
  return (brng + 360) % 360;
}

/**
 * Returns human-readable Thai label with arrow indicator for direction headings
 */
export function getCardinalDirectionThai(bearing: number): { label: string; arrow: string } {
  const val = Math.floor(bearing / 22.5 + 0.5) % 16;
  const arr = [
    { label: "เหนือ (N)", arrow: "↑" },
    { label: "เหนือ-ตะวันออกเฉียงเหนือ (NNE)", arrow: "↗" },
    { label: "ตะวันออกเฉียงเหนือ (NE)", arrow: "↗" },
    { label: "ตะวันออก-ตะวันออกเฉียงเหนือ (ENE)", arrow: "↗" },
    { label: "ตะวันออก (E)", arrow: "→" },
    { label: "ตะวันออก-ตะวันออกเฉียงใต้ (ESE)", arrow: "↘" },
    { label: "ตะวันออกเฉียงใต้ (SE)", arrow: "↘" },
    { label: "ใต้-ตะวันออกเฉียงใต้ (SSE)", arrow: "↘" },
    { label: "ใต้ (S)", arrow: "↓" },
    { label: "ใต้-ตะวันตกเฉียงใต้ (SSW)", arrow: "↙" },
    { label: "ตะวันตกเฉียงใต้ (SW)", arrow: "↙" },
    { label: "ตะวันตก-ตะวันตกเฉียงใต้ (WSW)", arrow: "↙" },
    { label: "ตะวันตก (W)", arrow: "←" },
    { label: "ตะวันตก-ตะวันตกเฉียงเหนือ (WNW)", arrow: "↖" },
    { label: "ตะวันตกเฉียงเหนือ (NW)", arrow: "↖" },
    { label: "เหนือ-ตะวันตกเฉียงเหนือ (NNW)", arrow: "↖" }
  ];
  return arr[val] || { label: "เหนือ (N)", arrow: "↑" };
}

/**
 * Formats duration in seconds into hh:mm:ss or mm:ss
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

/**
 * Export GPS point logs to a clean CSV structure and trigger browser download
 */
export function exportToCSV(logs: GPSPoint[]): void {
  if (logs.length === 0) return;

  // Thai UTF-8 marker (BOM) to ensure Excel opens Thai text and CSV format perfectly
  const BOM = "\uFEFF";
  
  const headers = [
    "No.",
    "Timestamp (เวลา)",
    "Latitude (ละติจูด)",
    "Longitude (ลองจิจูด)",
    "Speed (ความเร็ว กม./ชม.)",
    "Accuracy (ความแม่นยำ เมตร)",
    "Cumulative Distance (ระยะทางสะสม กม.)",
    "Status (สถานะความเร็ว)"
  ];

  const rows = logs.map((log, index) => {
    const isSpeeding = log.speed > 80;
    const statusText = isSpeeding ? "⚠️ เกินกำหนด (> 80 กม./ชม.)" : "ปกติ";
    return [
      index + 1,
      `"${log.timestamp}"`,
      log.latitude.toFixed(6),
      log.longitude.toFixed(6),
      log.speed.toFixed(1),
      log.accuracy.toFixed(1),
      log.distance.toFixed(3),
      `"${statusText}"`
    ];
  });

  const csvContent = 
    BOM + 
    [headers.join(","), ...rows.map(e => e.join(","))].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  link.setAttribute("href", url);
  link.setAttribute("download", `GPS_Trip_Log_${timestamp}.csv`);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Global cached audio context to prevent browser overheads and warnings
let audioCtx: AudioContext | null = null;

/**
 * Triggers a warning beep sound safe from background sandbox/browser constraints
 */
export function playAlertBeep(frequency = 880, duration = 0.25): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    
    // Quick ramp down to make a pleasant warning beep
    gainNode.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
  } catch (err) {
    console.warn("Audio Context alert could not play due to browser policy:", err);
  }
}

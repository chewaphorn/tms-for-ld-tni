import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { GPSPoint, DeliveryWaypoint } from "../types";
import { Navigation, Truck, Layers, Globe } from "lucide-react";

export interface ActiveVehicleState {
  id: string;
  name: string;
  plateNumber: string;
  deviceType: "Truck" | "Van" | "Pickup" | "Motorcycle";
  color: string;
  logs: GPSPoint[];
  currentPoint: GPSPoint | null;
  waypoints: DeliveryWaypoint[];
  isTracking: boolean;
  isSimulating: boolean;
  speedLimit: number;
}

interface MapContainerProps {
  activeVehicles: ActiveVehicleState[];
  selectedVehicleId: string;
}

// Coordinate Defaults: Center of Bangkok, Thailand
const BANGKOK_LAT = 13.7563;
const BANGKOK_LNG = 100.5018;

// Styled Premium Non-Google Maps tile layer sources (CartoDB and OSM)
const CARTO_VOYAGER_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png";
const CARTO_POSITRON_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const OSM_STANDARD_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

export default function MapContainer({ activeVehicles = [], selectedVehicleId }: MapContainerProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dictionary refs to manage multiple vehicles on Leaflet
  const markersDictRef = useRef<Record<string, L.Marker>>({});
  const polylinesDictRef = useRef<Record<string, L.Polyline>>({});
  const waypointLayersDictRef = useRef<Record<string, L.LayerGroup>>({});

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapType, setMapType] = useState<"voyager" | "positron" | "osm">("voyager");
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const isFirstLoadRef = useRef(true);

  // Auto-inject Leaflet CSS if it hasn't been added yet
  useEffect(() => {
    if (!document.getElementById("leaflet-styles")) {
      const link = document.createElement("link");
      link.id = "leaflet-styles";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Pick initial focus point if possible
    const selected = activeVehicles.find(v => v.id === selectedVehicleId);
    const initialLat = selected?.currentPoint?.latitude || BANGKOK_LAT;
    const initialLng = selected?.currentPoint?.longitude || BANGKOK_LNG;

    const map = L.map(containerRef.current, {
      center: [initialLat, initialLng],
      zoom: selected?.currentPoint ? 14 : 12,
      zoomControl: false,
    });

    // Initialize with standard Voyager Theme
    const tileLayer = L.tileLayer(CARTO_VOYAGER_URL, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20,
    }).addTo(map);

    baseTileLayerRef.current = tileLayer;

    L.control.zoom({ position: "bottomright" }).addTo(map);

    mapRef.current = map;
    setMapLoaded(true);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapLoaded(false);
      }
    };
  }, []);

  // Sync Map Tile Layers (Voyager vs Positron vs OSM standard)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !baseTileLayerRef.current) return;

    let activeUrl = CARTO_VOYAGER_URL;
    if (mapType === "positron") {
      activeUrl = CARTO_POSITRON_URL;
    } else if (mapType === "osm") {
      activeUrl = OSM_STANDARD_URL;
    }

    baseTileLayerRef.current.setUrl(activeUrl);
  }, [mapType, mapLoaded]);

  // Render Vehicles and Waypoints dynamically on Map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const currentVehIds = activeVehicles.map(v => v.id);

    // Garbage collect removed vehicles layers
    Object.keys(markersDictRef.current).forEach(id => {
      if (!currentVehIds.includes(id)) {
        markersDictRef.current[id].remove();
        delete markersDictRef.current[id];
      }
    });
    Object.keys(polylinesDictRef.current).forEach(id => {
      if (!currentVehIds.includes(id)) {
        polylinesDictRef.current[id].remove();
        delete polylinesDictRef.current[id];
      }
    });
    Object.keys(waypointLayersDictRef.current).forEach(id => {
      if (!currentVehIds.includes(id)) {
        waypointLayersDictRef.current[id].remove();
        delete waypointLayersDictRef.current[id];
      }
    });

    // Render / update each active vehicle
    activeVehicles.forEach((vehicle) => {
      const isSelected = vehicle.id === selectedVehicleId;
      
      // 1. Current position marker
      let pt = vehicle.currentPoint;
      if (!pt && vehicle.logs.length > 0) {
        pt = vehicle.logs[vehicle.logs.length - 1];
      }
      
      // Fallback: If vehicle is standby and hasn't started moving, show it at its starting depot (first waypoint)
      if (!pt && vehicle.waypoints.length > 0) {
        pt = {
          latitude: vehicle.waypoints[0].latitude,
          longitude: vehicle.waypoints[0].longitude,
          timestamp: "พิกัดสะสมเริ่มต้นจัดส่ง",
          speed: 0,
          accuracy: 5,
          distance: 0
        };
      }

      if (pt) {
        const isSpeeding = pt.speed > vehicle.speedLimit;
        const position: [number, number] = [pt.latitude, pt.longitude];
        const icon = createVehicleIcon(isSpeeding, pt.speed, vehicle.color, vehicle.name, isSelected);

        if (markersDictRef.current[vehicle.id]) {
          markersDictRef.current[vehicle.id].setLatLng(position);
          markersDictRef.current[vehicle.id].setIcon(icon);
        } else {
          markersDictRef.current[vehicle.id] = L.marker(position, { icon }).addTo(map);
        }

        // Auto move map if selected vehicle coordinates are updated and it's the only one
        if (isSelected && vehicle.logs.length === 1) {
          map.setView(position, 15);
        }
      } else {
        // Clear marker if vehicle has no position
        if (markersDictRef.current[vehicle.id]) {
          markersDictRef.current[vehicle.id].remove();
          delete markersDictRef.current[vehicle.id];
        }
      }

      // 2. Route logs / Trail path
      if (vehicle.logs.length > 0) {
        const coords = vehicle.logs.map(log => [log.latitude, log.longitude] as [number, number]);
        if (polylinesDictRef.current[vehicle.id]) {
          polylinesDictRef.current[vehicle.id].setLatLngs(coords);
          polylinesDictRef.current[vehicle.id].setStyle({ color: vehicle.color });
        } else {
          polylinesDictRef.current[vehicle.id] = L.polyline(coords, {
            color: vehicle.color,
            weight: isSelected ? 5 : 3.5,
            opacity: isSelected ? 0.9 : 0.65,
            lineJoin: "round"
          }).addTo(map);
        }
      } else {
        if (polylinesDictRef.current[vehicle.id]) {
          polylinesDictRef.current[vehicle.id].remove();
          delete polylinesDictRef.current[vehicle.id];
        }
      }

      // 3. Planned Route waypoints & connections
      if (!waypointLayersDictRef.current[vehicle.id]) {
        waypointLayersDictRef.current[vehicle.id] = L.layerGroup().addTo(map);
      }
      
      const layerGroup = waypointLayersDictRef.current[vehicle.id];
      layerGroup.clearLayers();

      // Draw connection lines
      if (vehicle.waypoints.length > 1) {
        const latlngs = vehicle.waypoints.map(wp => [wp.latitude, wp.longitude] as [number, number]);
        
        // Solid underlay
        L.polyline(latlngs, {
          color: vehicle.color,
          weight: 7,
          opacity: isSelected ? 0.25 : 0.12,
          lineJoin: "round"
        }).addTo(layerGroup);

        // Dashed overlay
        L.polyline(latlngs, {
          color: vehicle.color,
          weight: 2.5,
          opacity: isSelected ? 0.9 : 0.5,
          dashArray: isSelected ? "6, 8" : "4, 6",
          lineJoin: "round"
        }).addTo(layerGroup);
      }

      // Draw waypoint pins
      vehicle.waypoints.forEach((wp) => {
        const position: [number, number] = [wp.latitude, wp.longitude];
        const isPickup = wp.type === "pickup";
        const badgeIcon = isPickup ? "📥" : "📤";
        const darkColor = vehicle.color;
        
        const waypointIcon = L.divIcon({
          html: `
            <div class="flex items-center justify-center w-10 h-10 relative group">
              <!-- Radial outer pulse to grab attention if selected/active -->
              <div class="absolute w-7 h-7 rounded-full animate-ping duration-1000" style="background-color: ${darkColor}; opacity: 0.15;"></div>
              
              <!-- Customizable point pickup/delivery icon badge correlating to vehicle tracker color -->
              <div class="w-7 h-7 border-2 text-white rounded-xl flex flex-col items-center justify-center shadow-md transform transition-transform hover:scale-110 z-10" style="background-color: ${darkColor}; border-color: #ffffff;">
                <span class="text-[8px] font-bold block -mb-0.5 leading-none">${badgeIcon}</span>
                <span class="text-[9px] font-black leading-none">${wp.sequenceOrder}</span>
              </div>
              
              <!-- Tooltip labeling name -->
              <div class="absolute top-[32px] bg-slate-900/90 text-[8px] text-white px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap border max-w-[120px] overflow-hidden text-ellipsis font-bold" style="border-color: ${darkColor};">
                [${vehicle.name.split(" ")[0]}] ${wp.name}
              </div>
            </div>
          `,
          className: "custom-waypoint-marker",
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });

        L.marker(position, { icon: waypointIcon })
          .bindPopup(`
            <div class="p-1">
              <div class="font-extrabold text-xs uppercase mb-1" style="color: ${darkColor};">
                ${isPickup ? "จุดรับสินค้า (Pickup)" : "จุดส่งสินค้า (Delivery)"} • ใต้คัน ${vehicle.name} (ลำดับ ${wp.sequenceOrder})
              </div>
              <div class="font-bold text-slate-800 text-xs mb-0.5">${wp.name}</div>
              <div class="text-[10px] text-slate-500 font-mono">พิกัด: ${wp.latitude.toFixed(5)}, ${wp.longitude.toFixed(5)}</div>
              ${wp.timeWindowStart ? `<div class="text-[10px] font-bold text-blue-800 mt-1">🕒 หน้าต่างเวลาส่ง: ${wp.timeWindowStart} - ${wp.timeWindowEnd}</div>` : ""}
              <div class="text-[11px] font-semibold mt-1">สถานะ: <span class="font-bold text-slate-700">${wp.status === "Visited" ? "✓ สัญญาณระบุว่าส่งแล้ว" : "⚪ อยู่ระหว่างดำเนินการระบุแผน"}</span></div>
            </div>
          `)
          .addTo(layerGroup);
      });
    });

    // Fit map bounds once on startup if map has elements
    if (isFirstLoadRef.current && activeVehicles.length > 0) {
      isFirstLoadRef.current = false;
      const boundsArr: L.LatLngExpression[] = [];
      activeVehicles.forEach(v => {
        v.waypoints.forEach(wp => boundsArr.push([wp.latitude, wp.longitude]));
      });
      if (boundsArr.length > 1) {
        map.fitBounds(L.latLngBounds(boundsArr), { padding: [50, 50] });
      }
    }

  }, [activeVehicles, mapLoaded, selectedVehicleId]);

  // Dynamic SVG Vehicle Marker generator with matching tracker theme color
  const createVehicleIcon = (isSpeeding: boolean, speed: number, color: string, name: string, isSelected: boolean) => {
    const pulseBg = isSpeeding ? "bg-red-500/40" : "bg-blue-500/35";
    const fillBgStyle = isSpeeding ? 'background-color: #ef4444; border-color: #fca5a5;' : `background-color: ${color}; border-color: #ffffff;`;

    return L.divIcon({
      html: `
        <div class="flex items-center justify-center w-10 h-10 relative">
          <!-- Pulse rings placed exactly in center -->
          <div class="absolute w-10 h-10 rounded-full ${pulseBg} ${isSpeeding ? 'animate-ping duration-300' : 'animate-pulse'}"></div>
          ${isSelected ? `<div class="absolute w-12 h-12 rounded-full bg-slate-500/10 animate-pulse duration-1000"></div>` : ""}

          <!-- Central Vehicle badge centered -->
          <div class="relative w-8 h-8 rounded-full flex items-center justify-center border-2 shadow-lg text-white z-10" style="${fillBgStyle}">
            <svg viewBox="0 0 24 24" class="w-4.5 h-4.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="1" y="3" width="15" height="13" rx="2" fill="currentColor"/>
              <polygon points="16 8 20 8 23 11 23 16 16 16" fill="currentColor"/>
              <circle cx="5.5" cy="18.5" r="2.5" fill="#1e293b"/>
              <circle cx="16.5" cy="18.5" r="2.5" fill="#1e293b"/>
            </svg>
          </div>
          
          <!-- Miniature Speed Bubble (placed centrally above) -->
          <div class="absolute -top-[26px] ${isSpeeding ? 'bg-red-950 border-red-500 text-red-100 font-black' : 'bg-slate-900 border-slate-700 text-white font-bold'} text-[8.5px] px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap flex items-center gap-1 z-20">
            <span>${Math.round(speed)} กม./ชม.</span>
          </div>

          <!-- Miniature Vehicle Name Tag below -->
          <div class="absolute -bottom-5 bg-slate-900/90 text-white font-black text-[8px] px-1.5 py-0.5 rounded shadow border border-slate-700 whitespace-nowrap z-30">
            ${name}
          </div>
        </div>
      `,
      className: "custom-vehicle-marker",
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
  };

  // Center Map to active elements
  const handleRecenter = () => {
    const map = mapRef.current;
    if (!map) return;

    const selectedVehicle = activeVehicles.find(v => v.id === selectedVehicleId);
    if (selectedVehicle && selectedVehicle.currentPoint) {
      map.setView([selectedVehicle.currentPoint.latitude, selectedVehicle.currentPoint.longitude], 16);
    } else if (activeVehicles.length > 0) {
      const boundsArr: L.LatLngExpression[] = [];
      activeVehicles.forEach(v => {
        if (v.currentPoint) {
          boundsArr.push([v.currentPoint.latitude, v.currentPoint.longitude]);
        }
        v.waypoints.forEach(wp => {
          boundsArr.push([wp.latitude, wp.longitude]);
        });
        v.logs.forEach(log => {
          boundsArr.push([log.latitude, log.longitude]);
        });
      });

      if (boundsArr.length > 0) {
        map.fitBounds(L.latLngBounds(boundsArr), { padding: [50, 50] });
      } else {
        map.setView([BANGKOK_LAT, BANGKOK_LNG], 12);
      }
    } else {
      map.setView([BANGKOK_LAT, BANGKOK_LNG], 12);
    }
  };

  // Determine dynamic real-route vehicle status for HUD
  const getDynamicStatus = () => {
    const selected = activeVehicles.find(v => v.id === selectedVehicleId);
    if (!selected) {
      return {
        text: "ไม่พบสัญญาณรถคันหลัก",
        bgColor: "bg-slate-50 text-slate-500 border-slate-200",
        dotColor: "bg-slate-300",
        icon: "💤"
      };
    }

    const cp = selected.currentPoint;
    const isOver = cp && cp.speed > selected.speedLimit;

    if (!selected.isTracking && !selected.isSimulating) {
      return {
        text: `จอดพัก / รอเริ่มต้นจัดสัญญาณ (Standby) - ${selected.name}`,
        bgColor: "bg-slate-50 text-slate-600 border-slate-250",
        dotColor: "bg-slate-400 font-bold",
        icon: "💤"
      };
    }
    
    if (cp) {
      if (isOver) {
        return {
          text: `🚨 ความเร็วสูงเกินกำหนด: ${cp.speed.toFixed(1)} กม./ชม. (${selected.name})`,
          bgColor: "bg-red-50 text-red-700 border-red-300 animate-pulse",
          dotColor: "bg-red-600",
          icon: "⚡"
        };
      }
      return {
        text: `🚚 กำลังวิ่งจำลองความเร็ว: ${cp.speed.toFixed(1)} กม./ชม. (${selected.name})`,
        bgColor: "bg-blue-50 text-blue-700 border-blue-250 font-bold",
        dotColor: "bg-blue-600",
        icon: "🔄"
      };
    }

    return {
      text: `📡 รอตำแหน่งทางดาวเทียม GPS... (${selected.name})`,
      bgColor: "bg-emerald-50 text-emerald-800 border-emerald-250 font-bold",
      dotColor: "bg-emerald-600",
      icon: "📡"
    };
  };

  const activeStatus = getDynamicStatus();

  return (
    <div id="leaflet-main-map-hud" className="relative w-full h-full rounded-2xl border border-slate-200 overflow-hidden shadow-md bg-slate-100">
      
      {/* Map Division */}
      <div id="gps-tracking-leaflet-map" ref={containerRef} className="w-full h-full z-10" />

      {/* Modern map style selector controls */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 pointer-events-none">
        
        {/* Left Side: Map theme selectors */}
        <div className="bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-200 shadow-lg flex items-center gap-1 pointer-events-auto self-start">
          <button
            onClick={() => setMapType("voyager")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              mapType === "voyager"
                ? "bg-blue-600 text-white shadow"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            แผนที่สว่าง
          </button>
          <button
            onClick={() => setMapType("positron")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              mapType === "positron"
                ? "bg-blue-600 text-white shadow"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            แผนที่มินิมอล
          </button>
          <button
            onClick={() => setMapType("osm")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              mapType === "osm"
                ? "bg-blue-600 text-white shadow"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            OSM มาตรฐาน
          </button>
        </div>

        {/* Right Side: DYNAMIC REAL-TIME VEHICLE STATUS */}
        <div className={`${activeStatus.bgColor} backdrop-blur-md px-3.5 py-2 rounded-xl border shadow-lg flex items-center gap-2.5 text-[10.5px] font-black tracking-tight pointer-events-auto self-start transition-all duration-300`}>
          <span className="relative flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activeStatus.dotColor}`}></span>
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${activeStatus.dotColor}`}></span>
          </span>
          <span className="text-[12px]">{activeStatus.icon}</span>
          <span className="uppercase tracking-wider">จับตำแหน่งสด:</span>
          <span>{activeStatus.text}</span>
        </div>
      </div>

      {/* Recenter button */}
      <button
        id="recenter-map-button"
        onClick={handleRecenter}
        title="จัดกึ่งกลางแผนที่"
        className="absolute bottom-4 left-4 z-20 w-10 h-10 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-lg flex items-center justify-center text-slate-700 transition-colors"
      >
        <Navigation className="w-5 h-5 text-blue-600 fill-blue-600" />
      </button>

      {/* Map visual legend overlay explaining route tracks and vehicle colors */}
      <div className="absolute top-4 right-4 z-20 bg-white/95 backdrop-blur-md p-3.5 rounded-xl border border-slate-200 shadow-lg text-[11px] text-slate-605 space-y-1.5 w-56 font-medium">
        <div className="font-extrabold text-slate-800 border-b border-slate-100 pb-1 flex items-center gap-1.5 uppercase tracking-wide">
          <Truck className="w-4 h-4 text-blue-600" /> สัญลักษณ์บนแผนที่ TMS
        </div>
        
        {/* Active vehicles listed with color dots */}
        <div className="pt-0.5 space-y-1">
          <label className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest block">ระบุกลุ่มรถที่กำลังใช้งาน</label>
          {activeVehicles.map(v => {
            const isMoving = v.isTracking || v.isSimulating;
            return (
              <div key={v.id} className="flex items-center justify-between gap-1.5 text-[10.5px]">
                <div className="flex items-center gap-1.5 truncate">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: v.color }}></div>
                  <span className="truncate text-slate-750 font-bold">{v.name.split(" ")[0]}</span>
                </div>
                <span className={`text-[8.5px] px-1 rounded-md shrink-0 font-black ${isMoving ? 'bg-indigo-50 text-indigo-600 animate-pulse' : 'bg-slate-100 text-slate-450'}`}>
                  {isMoving ? 'RUNNING' : 'STANDBY'}
                </span>
              </div>
            );
          })}
        </div>

        <div className="border-t border-slate-100 pt-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-600 border border-rose-300 animate-pulse rounded-full flex items-center justify-center text-white text-[8px]">🚨</div>
            <span className="text-red-700 font-bold">ขับรถเร็วเกิน 80 กม./ชม.</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-slate-900 border border-slate-700 text-white rounded text-[10px] font-bold flex items-center justify-center">📥</div>
            <span>จุดรับสินค้า (Pickup) ของเที่ยวรถ</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-slate-900 border border-slate-700 text-white rounded text-[10px] font-bold flex items-center justify-center">📤</div>
            <span>จุดส่งสินค้า (Delivery) ของเที่ยวรถ</span>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
            <div className="w-5 h-1 rounded bg-slate-400"></div>
            <span>เส้นทางการเดินทางจริง (logs)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-0.5 border-t border-dashed border-slate-405"></div>
            <span className="text-slate-450 text-[10px]">เส้นทางแผนเที่ยวจัดส่ง</span>
          </div>
        </div>
      </div>
    </div>
  );
}

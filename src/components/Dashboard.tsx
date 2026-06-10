import { useState, useEffect, useRef, FormEvent } from "react";
import { 
  Play, 
  Square, 
  Download, 
  RotateCcw, 
  AlertTriangle, 
  Volume2, 
  VolumeX, 
  Navigation, 
  MapPin, 
  FileSpreadsheet, 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  Gauge, 
  Activity,
  History,
  Smartphone,
  Info,
  Truck,
  Search,
  ChevronRight,
  ShieldCheck,
  Zap,
  Leaf,
  Settings,
  PlusCircle,
  Trash2,
  ArrowUp,
  ArrowDown,
  Layers,
  Map,
  Fuel,
  TrendingDown
} from "lucide-react";
import { GPSPoint, TripStats, GPSDevice, DeliveryWaypoint } from "../types";
import { calculateDistance, formatDuration, exportToCSV, playAlertBeep } from "../utils/geo";
import { calculateSchedule, optimizeTWVRP } from "../utils/vrpSolver";
import { SIMULATED_TRUCK_ROUTE } from "../data/simulation";
import MapContainer from "./MapContainer";

const DEFAULT_SPEED_LIMIT = 80; // Hard speed limit 80 km/h is enforced
const BANGKOK_LAT = 13.7563;
const BANGKOK_LNG = 100.5018;

export const getDeviceColor = (deviceId: string) => {
  if (deviceId.includes("bangkok")) return "#6366f1"; // Indigo
  if (deviceId.includes("overspeed")) return "#f43f5e"; // Rose
  if (deviceId.includes("mobile")) return "#f59e0b"; // Orange/Amber
  if (deviceId.includes("parked") || deviceId.includes("van")) return "#10b981"; // Emerald/Teal
  return "#8b5cf6"; // Purple default
};

export default function Dashboard() {
  // Navigation Tabs inside Fleet Controller Sidebar
  const [activeTab, setActiveTab] = useState<"devices" | "planning">("devices");

  // GPS Devices List State
  const [devices, setDevices] = useState<GPSDevice[]>([
    {
      id: "sim-bangkok",
      name: "Truck-7721 (Rama 4)",
      plateNumber: "70-7721 กทม.",
      driverName: "สมชาย ยอดรัก",
      deviceType: "Truck",
      consumptionRate: 0.25, // 0.25 L/KM (4 km/L for medium truck)
      status: "Standby",
      currentSpeed: 0
    },
    {
      id: "sim-overspeed",
      name: "Truck-8840 (Expressway)",
      plateNumber: "70-8840 กทม.",
      driverName: "วิชัย ใจร้อน",
      deviceType: "Truck",
      consumptionRate: 0.30, // 0.30 L/KM
      status: "Standby",
      currentSpeed: 0
    },
    {
      id: "mobile",
      name: "My Mobile Device",
      plateNumber: "โมบายส่วนตัว",
      driverName: "Chewaphorn Staff",
      deviceType: "Van",
      consumptionRate: 0.12, // 0.12 L/KM (8.3 km/L for light van)
      status: "Standby",
      currentSpeed: 0
    },
    {
      id: "van-parked",
      name: "Van-2291 (Stationary)",
      plateNumber: "3กข-2291 กทม.",
      driverName: "สมพงษ์ จอดนอน",
      deviceType: "Van",
      consumptionRate: 0.10, // 0.10 L/KM
      status: "Parked",
      currentSpeed: 0
    }
  ]);

  // Dictionary states for each device to enable multi-agent routing & parallel simulations
  const [deviceWaypoints, setDeviceWaypoints] = useState<Record<string, DeliveryWaypoint[]>>({
    "sim-bangkok": [
      {
        id: "wb-1",
        name: "คลังสินค้า TNI Hub (Pattanakarn)",
        latitude: 13.7384,
        longitude: 100.5752,
        sequenceOrder: 1,
        status: "Visited",
        type: "pickup",
        timeWindowStart: "08:00",
        timeWindowEnd: "12:00",
        serviceTime: 15
      },
      {
        id: "wb-2",
        name: "ศูนย์กระจายสินค้า บางนา กม.4 (Distribution Center)",
        latitude: 13.6678,
        longitude: 100.6420,
        sequenceOrder: 2,
        status: "Pending",
        type: "delivery",
        timeWindowStart: "08:30",
        timeWindowEnd: "10:30",
        serviceTime: 25
      },
      {
        id: "wb-3",
        name: "จุดส่งลูกค้านิคมอุตสาหกรรมบางพลี โกดัง B",
        latitude: 13.5852,
        longitude: 100.7845,
        sequenceOrder: 3,
        status: "Pending",
        type: "delivery",
        timeWindowStart: "09:30",
        timeWindowEnd: "11:30",
        serviceTime: 20
      }
    ],
    "sim-overspeed": [
      {
        id: "wo-1",
        name: "จุดส่งรถเทรลเลอร์ดินแดง (Depot Expressway)",
        latitude: 13.7624,
        longitude: 100.5401,
        sequenceOrder: 1,
        status: "Visited",
        type: "pickup",
        timeWindowStart: "08:00",
        timeWindowEnd: "10:00",
        serviceTime: 15
      },
      {
        id: "wo-2",
        name: "จุดรับช่วงสินค้าดอนเมือง คลัง A",
        latitude: 13.9125,
        longitude: 100.6015,
        sequenceOrder: 2,
        status: "Pending",
        type: "delivery",
        timeWindowStart: "08:45",
        timeWindowEnd: "10:15",
        serviceTime: 15
      },
      {
        id: "wo-3",
        name: "คลังสินค้า รังสิตคลอง 1",
        latitude: 13.9856,
        longitude: 100.6725,
        sequenceOrder: 3,
        status: "Pending",
        type: "delivery",
        timeWindowStart: "09:15",
        timeWindowEnd: "11:45",
        serviceTime: 25
      }
    ],
    "mobile": [
      {
        id: "wm-1",
        name: "โมบายพิกัดเริ่มต้น (TNI Main Building)",
        latitude: 13.7380,
        longitude: 100.6284,
        sequenceOrder: 1,
        status: "Visited",
        type: "pickup",
        timeWindowStart: "08:00",
        timeWindowEnd: "13:00",
        serviceTime: 10
      },
      {
        id: "wm-2",
        name: "จุดบริการศรีนครินทร์ (Srinakarin Client)",
        latitude: 13.7025,
        longitude: 100.6450,
        sequenceOrder: 2,
        status: "Pending",
        type: "delivery",
        timeWindowStart: "09:00",
        timeWindowEnd: "11:00",
        serviceTime: 15
      }
    ],
    "van-parked": [
      {
        id: "wv-1",
        name: "จุดพักจอดประเวศ (Prawet Station)",
        latitude: 13.7198,
        longitude: 100.6974,
        sequenceOrder: 1,
        status: "Visited",
        type: "pickup",
        timeWindowStart: "08:00",
        timeWindowEnd: "17:00",
        serviceTime: 30
      }
    ]
  });

  const [deviceLogs, setDeviceLogs] = useState<Record<string, GPSPoint[]>>({
    "sim-bangkok": [],
    "sim-overspeed": [],
    "mobile": [],
    "van-parked": []
  });

  const [deviceCurrentPoint, setDeviceCurrentPoint] = useState<Record<string, GPSPoint | null>>({
    "sim-bangkok": null,
    "sim-overspeed": null,
    "mobile": null,
    "van-parked": null
  });

  const [deviceIsTracking, setDeviceIsTracking] = useState<Record<string, boolean>>({
    "sim-bangkok": false,
    "sim-overspeed": false,
    "mobile": false,
    "van-parked": false
  });

  const [deviceIsSimulating, setDeviceIsSimulating] = useState<Record<string, boolean>>({
    "sim-bangkok": false,
    "sim-overspeed": false,
    "mobile": false,
    "van-parked": false
  });

  const [deviceStats, setDeviceStats] = useState<Record<string, TripStats>>({
    "sim-bangkok": { totalDistance: 0, maxSpeed: 0, averageSpeed: 0, duration: 0, speedingEvents: 0, startTime: null, litersConsumed: 0 },
    "sim-overspeed": { totalDistance: 0, maxSpeed: 0, averageSpeed: 0, duration: 0, speedingEvents: 0, startTime: null, litersConsumed: 0 },
    "mobile": { totalDistance: 0, maxSpeed: 0, averageSpeed: 0, duration: 0, speedingEvents: 0, startTime: null, litersConsumed: 0 },
    "van-parked": { totalDistance: 0, maxSpeed: 0, averageSpeed: 0, duration: 0, speedingEvents: 0, startTime: null, litersConsumed: 0 }
  });

  const [deviceVrpStartTime, setDeviceVrpStartTime] = useState<Record<string, string>>({
    "sim-bangkok": "08:00",
    "sim-overspeed": "08:00",
    "mobile": "08:30",
    "van-parked": "09:00"
  });

  // Selected focused vehicle to inspect on dashboard metrics controls
  const [selectedVehicle, setSelectedVehicle] = useState<string>("sim-bangkok");

  // Forms Toggle & Input states for Add custom GPS device 
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [newDevName, setNewDevName] = useState("");
  const [newDevPlate, setNewDevPlate] = useState("");
  const [newDevDriver, setNewDevDriver] = useState("");
  const [newDevType, setNewDevType] = useState<"Truck" | "Van" | "Pickup" | "Motorcycle">("Truck");
  const [newDevConsumption, setNewDevConsumption] = useState("0.25"); // string to easily edit in form

  // Custom Waypoint Form input states
  const [customWpName, setCustomWpName] = useState("");
  const [customWpLat, setCustomWpLat] = useState("13.7128"); // default Klong Toey Port
  const [customWpLng, setCustomWpLng] = useState("100.5735");
  const [customWpType, setCustomWpType] = useState<"pickup" | "delivery">("delivery");
  const [customWpTWStart, setCustomWpTWStart] = useState("08:00");
  const [customWpTWEnd, setCustomWpTWEnd] = useState("12:00");
  const [customWpServiceTime, setCustomWpServiceTime] = useState("20");

  const [isSoundMuted, setIsSoundMuted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Computed Aliases for currently focused vehicle
  const waypoints = deviceWaypoints[selectedVehicle] || [];
  const logs = deviceLogs[selectedVehicle] || [];
  const currentPoint = deviceCurrentPoint[selectedVehicle] || null;
  const isTracking = deviceIsTracking[selectedVehicle] || false;
  const isSimulating = deviceIsSimulating[selectedVehicle] || false;
  const stats = deviceStats[selectedVehicle] || {
    totalDistance: 0,
    maxSpeed: 0,
    averageSpeed: 0,
    duration: 0,
    speedingEvents: 0,
    startTime: null,
    litersConsumed: 0
  };
  const vrpStartTime = deviceVrpStartTime[selectedVehicle] || "08:00";

  // Setter Adapters translating focused state updates back into their dictionary structures
  const setWaypoints = (val: DeliveryWaypoint[] | ((prev: DeliveryWaypoint[]) => DeliveryWaypoint[])) => {
    setDeviceWaypoints(prevAll => {
      const prev = prevAll[selectedVehicle] || [];
      const updated = typeof val === "function" ? val(prev) : val;
      return { ...prevAll, [selectedVehicle]: updated };
    });
  };

  const setLogs = (val: GPSPoint[] | ((prev: GPSPoint[]) => GPSPoint[])) => {
    setDeviceLogs(prevAll => {
      const prev = prevAll[selectedVehicle] || [];
      const updated = typeof val === "function" ? val(prev) : val;
      return { ...prevAll, [selectedVehicle]: updated };
    });
  };

  const setCurrentPoint = (val: GPSPoint | null | ((prev: GPSPoint | null) => GPSPoint | null)) => {
    setDeviceCurrentPoint(prevAll => {
      const prev = prevAll[selectedVehicle] || null;
      const updated = typeof val === "function" ? val(prev) : val;
      return { ...prevAll, [selectedVehicle]: updated };
    });
  };

  const setIsTracking = (val: boolean | ((prev: boolean) => boolean)) => {
    setDeviceIsTracking(prevAll => {
      const prev = prevAll[selectedVehicle] || false;
      const updated = typeof val === "function" ? val(prev) : val;
      return { ...prevAll, [selectedVehicle]: updated };
    });
  };

  const setIsSimulating = (val: boolean | ((prev: boolean) => boolean)) => {
    setDeviceIsSimulating(prevAll => {
      const prev = prevAll[selectedVehicle] || false;
      const updated = typeof val === "function" ? val(prev) : val;
      return { ...prevAll, [selectedVehicle]: updated };
    });
  };

  const setStats = (val: TripStats | ((prev: TripStats) => TripStats)) => {
    setDeviceStats(prevAll => {
      const prev = prevAll[selectedVehicle] || {
        totalDistance: 0,
        maxSpeed: 0,
        averageSpeed: 0,
        duration: 0,
        speedingEvents: 0,
        startTime: null,
        litersConsumed: 0
      };
      const updated = typeof val === "function" ? val(prev) : val;
      return { ...prevAll, [selectedVehicle]: updated };
    });
  };

  const setVrpStartTime = (val: string | ((prev: string) => string)) => {
    setDeviceVrpStartTime(prevAll => {
      const prev = prevAll[selectedVehicle] || "08:00";
      const updated = typeof val === "function" ? val(prev) : val;
      return { ...prevAll, [selectedVehicle]: updated };
    });
  };

  // Mutator References for multi-device intervals & watch tasks
  const geoWatchIdsRef = useRef<Record<string, number>>({});
  const trackingIntervalIdsRef = useRef<Record<string, any>>({});
  const simulationIndicesRef = useRef<Record<string, number>>({});
  const tripTimersRef = useRef<Record<string, any>>({});

  const stateLogsRef = useRef<Record<string, GPSPoint[]>>({});

  // Synchronize stateLogsRef with all live logs
  useEffect(() => {
    stateLogsRef.current = deviceLogs;
  }, [deviceLogs]);

  // Find currently active device info
  const activeDevice = devices.find(d => d.id === selectedVehicle) || devices[0];

  // Alert triggers & Buzzer effect when ANY vehicle speed breaches 80 km/h
  const activeSpeed = currentPoint ? currentPoint.speed : 0;
  const isSpeedingNow = activeSpeed > DEFAULT_SPEED_LIMIT;

  useEffect(() => {
    let alertInterval: any = null;
    if (isSpeedingNow && !isSoundMuted) {
      playAlertBeep(980, 0.25);
      alertInterval = setInterval(() => {
        playAlertBeep(980, 0.25);
      }, 1200);
    }
    return () => {
      if (alertInterval) clearInterval(alertInterval);
    };
  }, [isSpeedingNow, isSoundMuted, currentPoint]);

  // Unified trip duration & average speed timers ticking concurrently for all active vehicles
  useEffect(() => {
    const activeDeviceIds = devices.filter(d => deviceIsTracking[d.id] || deviceIsSimulating[d.id]).map(d => d.id);
    
    // Clear dead timers
    Object.keys(tripTimersRef.current).forEach(id => {
      if (!activeDeviceIds.includes(id)) {
        clearInterval(tripTimersRef.current[id]);
        delete tripTimersRef.current[id];
      }
    });

    // Start fresh individual timers
    activeDeviceIds.forEach(id => {
      if (!tripTimersRef.current[id]) {
        tripTimersRef.current[id] = setInterval(() => {
          setDeviceStats(prevStatsAll => {
            const prev = prevStatsAll[id] || { totalDistance: 0, maxSpeed: 0, averageSpeed: 0, duration: 0, speedingEvents: 0, startTime: null, litersConsumed: 0 };
            const logsForDev = stateLogsRef.current[id] || [];
            const newDur = prev.duration + 1;
            const avgSp = logsForDev.length > 0
              ? logsForDev.reduce((acc, p) => acc + p.speed, 0) / logsForDev.length
              : 0;
            return {
              ...prevStatsAll,
              [id]: {
                ...prev,
                duration: newDur,
                averageSpeed: avgSp
              }
            };
          });
        }, 1000);
      }
    });

    return () => {};
  }, [deviceIsTracking, deviceIsSimulating]);

  // Method to recalculate fuel consumption (L/KM) dynamically
  const recalculateFuelMetrics = (distKm: number, rate: number) => {
    const liters = distKm * rate;
    return { liters };
  };

  // Method to log fresh GPS coordinates into state and recalculate trip statistics for a specific device
  const handleAddNewPointForDevice = (
    deviceId: string,
    lat: number,
    lng: number,
    inputSpeedKmH: number | null,
    accuracy: number
  ) => {
    const now = new Date();
    const formattedTime = now.toLocaleTimeString("th-TH", { hour12: false }) + ` (${now.toLocaleDateString("th-TH", { day: 'numeric', month: 'short' })})`;
    
    // Lookup fuel configuration rate
    const currentDev = devices.find(d => d.id === deviceId);
    const consumptionRate = currentDev ? currentDev.consumptionRate : 0.25;

    setDeviceLogs(prevAll => {
      const prevLogs = prevAll[deviceId] || [];
      const prevPt = prevLogs[prevLogs.length - 1];
      let distanceCalculated = 0;
      let calculatedSpeed = inputSpeedKmH !== null && inputSpeedKmH >= 0 ? inputSpeedKmH : 0;
      
      if (prevPt) {
        // Find distance from previous logged coordinate
        const sliceDistVec = calculateDistance(prevPt.latitude, prevPt.longitude, lat, lng);
        distanceCalculated = prevPt.distance + sliceDistVec;

        // Fallback speed estimator if phone GPS returned null or zero speed
        if (inputSpeedKmH === null || inputSpeedKmH === 0) {
          const timeDiffHours = (now.getTime() - new Date().setTime(Date.parse(prevPt.timestamp))) / 3600000;
          if (timeDiffHours > 0 && sliceDistVec > 0.002) { 
            calculatedSpeed = sliceDistVec / timeDiffHours;
          }
        }
      }

      if (calculatedSpeed > 150) calculatedSpeed = 150;

      const newPt: GPSPoint = {
        latitude: lat,
        longitude: lng,
        timestamp: formattedTime,
        speed: calculatedSpeed,
        accuracy: accuracy,
        distance: distanceCalculated
      };

      // update current display point
      setDeviceCurrentPoint(prev => ({
        ...prev,
        [deviceId]: newPt
      }));

      // update device speed & status in devices list for real-time visualization
      setDevices(prevDevs => prevDevs.map(d => {
        if (d.id === deviceId) {
          return {
            ...d,
            currentSpeed: calculatedSpeed,
            status: calculatedSpeed > DEFAULT_SPEED_LIMIT ? "Danger_Overspeed" : "Moving"
          };
        }
        return d;
      }));

      // update stats including fuel performance
      setDeviceStats(prevStatsAll => {
        const prevStats = prevStatsAll[deviceId] || {
          totalDistance: 0,
          maxSpeed: 0,
          averageSpeed: 0,
          duration: 0,
          speedingEvents: 0,
          startTime: null,
          litersConsumed: 0
        };

        const isCurrentlyOverSpeed = calculatedSpeed > DEFAULT_SPEED_LIMIT;
        const totalDist = distanceCalculated;
        const { liters } = recalculateFuelMetrics(totalDist, consumptionRate);

        return {
          ...prevStatsAll,
          [deviceId]: {
            ...prevStats,
            totalDistance: totalDist,
            maxSpeed: Math.max(prevStats.maxSpeed, calculatedSpeed),
            speedingEvents: prevStats.speedingEvents + (isCurrentlyOverSpeed ? 1 : 0),
            startTime: prevStats.startTime || now.toLocaleTimeString("th-TH"),
            litersConsumed: liters
          }
        };
      });

      // Complete nearby waypoints for this device
      setDeviceWaypoints(prevWpAll => {
        const prevWps = prevWpAll[deviceId] || [];
        const updatedWps = prevWps.map(wp => {
          const distToWp = calculateDistance(lat, lng, wp.latitude, wp.longitude);
          if (distToWp < 0.6) {
            return { ...wp, status: "Visited" as const };
          }
          return wp;
        });
        return {
          ...prevWpAll,
          [deviceId]: updatedWps
        };
      });

      const updated = [...prevLogs, newPt];
      localStorage.setItem(`gps_last_trip_${deviceId}`, JSON.stringify(updated));
      return {
        ...prevAll,
        [deviceId]: updated
      };
    });
  };

  // 1. Activate standard high-end GPS tracking from mobile hardware
  const startLiveTrackingForDevice = (deviceId: string) => {
    stopTrackingForDevice(deviceId);

    if (!navigator.geolocation) {
      alert("ขออภัย! อุปกรณ์ของคุณไม่รองรับการใช้งานระบบระบุพิกัด GPS/Geolocation");
      return;
    }

    setDeviceLogs(prev => ({ ...prev, [deviceId]: [] }));
    setDeviceCurrentPoint(prev => ({ ...prev, [deviceId]: null }));
    localStorage.removeItem(`gps_last_trip_${deviceId}`);

    setDeviceStats(prev => ({
      ...prev,
      [deviceId]: {
        totalDistance: 0,
        maxSpeed: 0,
        averageSpeed: 0,
        duration: 0,
        speedingEvents: 0,
        startTime: new Date().toLocaleTimeString("th-TH"),
        litersConsumed: 0
      }
    }));

    // Reset waypoint visits to standard start
    setDeviceWaypoints(prevAll => {
      const prevWps = prevAll[deviceId] || [];
      const updatedWps = prevWps.map((wp, i) => ({ ...wp, status: i === 0 ? "Visited" as const : "Pending" as const }));
      return {
        ...prevAll,
        [deviceId]: updatedWps
      };
    });

    setDeviceIsTracking(prev => ({ ...prev, [deviceId]: true }));

    // Start watching physical positions
    geoWatchIdsRef.current[deviceId] = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const rawSpeed = pos.coords.speed;
        const speedKmH = rawSpeed !== null && rawSpeed >= 0 ? rawSpeed * 3.6 : null;
        const acc = pos.coords.accuracy || 10;

        handleAddNewPointForDevice(deviceId, lat, lng, speedKmH, acc);
      },
      (error) => {
        console.error("GPS Watch error: ", error);
        let errorMsg = "เกิดข้อผิดพลาดในการเชื่อมต่อ GPS";
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = "กรุณาเปิดสิทธิ์การระบุตำแหน่ง (Geolocation Access) บนเว็บบราวเซอร์ของคุณเพื่อติดตั้งพิกัด";
        }
        alert(errorMsg);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000
      }
    );
  };

  // 2. Play simulated route logs to easily demo the tracker
  const startRouteSimulationForDevice = (deviceId: string, type: "normal" | "overspeed") => {
    stopTrackingForDevice(deviceId);

    setDeviceLogs(prev => ({ ...prev, [deviceId]: [] }));
    setDeviceCurrentPoint(prev => ({ ...prev, [deviceId]: null }));
    localStorage.removeItem(`gps_last_trip_${deviceId}`);

    setDeviceStats(prev => ({
      ...prev,
      [deviceId]: {
        totalDistance: 0,
        maxSpeed: 0,
        averageSpeed: 0,
        duration: 0,
        speedingEvents: 0,
        startTime: new Date().toLocaleTimeString("th-TH"),
        litersConsumed: 0
      }
    }));

    // Reset waypoint visits to standard start
    setDeviceWaypoints(prevAll => {
      const prevWps = prevAll[deviceId] || [];
      const updatedWps = prevWps.map((wp, i) => ({ ...wp, status: i === 0 ? "Visited" as const : "Pending" as const }));
      return {
        ...prevAll,
        [deviceId]: updatedWps
      };
    });

    setDeviceIsSimulating(prev => ({ ...prev, [deviceId]: true }));
    simulationIndicesRef.current[deviceId] = 0;

    // Generate dynamic coords based on current waypoints list to match user routes perfectly!
    const currentWps = deviceWaypoints[deviceId] || [];
    let routeToSimulate = SIMULATED_TRUCK_ROUTE;
    if (currentWps.length > 0) {
      const coords: any[] = [];
      coords.push({
        latitude: currentWps[0].latitude,
        longitude: currentWps[0].longitude,
        speed: 0,
        accuracy: 3
      });

      for (let i = 0; i < currentWps.length - 1; i++) {
        const from = currentWps[i];
        const to = currentWps[i + 1];
        const dist = calculateDistance(from.latitude, from.longitude, to.latitude, to.longitude);
        const stepsCount = Math.max(15, Math.ceil(dist / 0.1));
        for (let s = 1; s <= stepsCount; s++) {
          const ratio = s / stepsCount;
          const lat = from.latitude + (to.latitude - from.latitude) * ratio;
          const lng = from.longitude + (to.longitude - from.longitude) * ratio;
          
          let baseSpeed = 50 + (s % 5) * 5; 
          if (s < 3 || s > stepsCount - 3) {
            baseSpeed = 25; 
          }
          
          if (type === "overspeed") {
            if (s > 4 && s < stepsCount - 4 && s % 3 === 0) {
              baseSpeed = 87.5;
            } else if (s > 4 && s < stepsCount - 4) {
              baseSpeed = 82.0;
            }
          } else {
            if (baseSpeed > 75) {
              baseSpeed = 72.5;
            }
          }

          coords.push({
            latitude: lat,
            longitude: lng,
            speed: baseSpeed,
            accuracy: 3
          });
        }
      }
      routeToSimulate = coords;
    }

    trackingIntervalIdsRef.current[deviceId] = setInterval(() => {
      const idx = simulationIndicesRef.current[deviceId] || 0;
      if (idx >= routeToSimulate.length) {
        clearInterval(trackingIntervalIdsRef.current[deviceId]);
        setDeviceIsSimulating(prev => ({ ...prev, [deviceId]: false }));
        // Mark all waypoints as visited
        setDeviceWaypoints(prevAll => {
          const prevWps = prevAll[deviceId] || [];
          const updatedWps = prevWps.map(wp => ({ ...wp, status: "Visited" as const }));
          return {
            ...prevAll,
            [deviceId]: updatedWps
          };
        });
        const currentDevName = devices.find(d => d.id === deviceId)?.name || deviceId;
        alert(`สิ้นสุดจำลองเส้นทางจัดส่งของรถ ${currentDevName} เสร็จสมบูรณ์แล้ว!`);
        return;
      }

      const point = routeToSimulate[idx];
      let finalSpeed = point.speed;
      if (type === "normal" && finalSpeed > 75) {
        finalSpeed = 74.2;
      }

      handleAddNewPointForDevice(deviceId, point.latitude, point.longitude, finalSpeed, point.accuracy);

      simulationIndicesRef.current[deviceId] = idx + 1;
    }, 1200);
  };

  const startRouteSimulation = (type: "normal" | "overspeed") => {
    startRouteSimulationForDevice(selectedVehicle, type);
  };

  // 3. Stop tracking for specific device
  const stopTrackingForDevice = (deviceId: string) => {
    if (geoWatchIdsRef.current[deviceId] !== undefined) {
      navigator.geolocation.clearWatch(geoWatchIdsRef.current[deviceId]);
      delete geoWatchIdsRef.current[deviceId];
    }
    if (trackingIntervalIdsRef.current[deviceId] !== undefined) {
      clearInterval(trackingIntervalIdsRef.current[deviceId]);
      delete trackingIntervalIdsRef.current[deviceId];
    }
    setDeviceIsTracking(prev => ({ ...prev, [deviceId]: false }));
    setDeviceIsSimulating(prev => ({ ...prev, [deviceId]: false }));

    // Reset speed metrics to 0
    setDevices(prevDevs => prevDevs.map(d => {
      if (d.id === deviceId) {
        return {
          ...d,
          currentSpeed: 0,
          status: d.status === "Danger_Overspeed" || d.status === "Moving" ? "Standby" : d.status
        };
      }
      return d;
    }));
  };

  const stopTracking = () => {
    stopTrackingForDevice(selectedVehicle);
  };

  // 4. Wipe trip history for a device
  const resetTripForDevice = (deviceId: string) => {
    if (window.confirm("ยืนยันที่จะล้างข้อมูลเดินทางและแผนสถิติตัวเครื่องนี้ทั้งหมด?")) {
      stopTrackingForDevice(deviceId);
      setDeviceLogs(prev => ({ ...prev, [deviceId]: [] }));
      setDeviceCurrentPoint(prev => ({ ...prev, [deviceId]: null }));
      localStorage.removeItem(`gps_last_trip_${deviceId}`);
      
      setDeviceWaypoints(prevAll => {
        const prevWps = prevAll[deviceId] || [];
        return {
          ...prevAll,
          [deviceId]: prevWps.map((wp, i) => ({ ...wp, status: i === 0 ? "Visited" as const : "Pending" as const }))
        };
      });

      setDeviceStats(prev => ({
        ...prev,
        [deviceId]: {
          totalDistance: 0,
          maxSpeed: 0,
          averageSpeed: 0,
          duration: 0,
          speedingEvents: 0,
          startTime: null,
          litersConsumed: 0
        }
      }));
    }
  };

  const resetTrip = () => {
    resetTripForDevice(selectedVehicle);
  };

  // Automatically calculate schedules whenever waypoints change for any device!
  const waypointsSerialized = Object.keys(deviceWaypoints).map(deviceId => {
    const wps = deviceWaypoints[deviceId] || [];
    const depTime = deviceVrpStartTime[deviceId] || "08:00";
    return `${deviceId}-${depTime}-${wps.map(wp => `${wp.id}-${wp.sequenceOrder}-${wp.timeWindowStart}-${wp.timeWindowEnd}-${wp.serviceTime}`).join(",")}`;
  }).join("|");

  useEffect(() => {
    setDeviceWaypoints(prevAll => {
      let changed = false;
      const updatedAll = { ...prevAll };

      Object.keys(prevAll).forEach(deviceId => {
        const wps = prevAll[deviceId] || [];
        const depTime = deviceVrpStartTime[deviceId] || "08:00";
        const updated = calculateSchedule(wps, depTime, 55);

        let hasChanged = false;
        if (updated.length !== wps.length) {
          hasChanged = true;
        } else {
          for (let i = 0; i < wps.length; i++) {
            if (
              updated[i].arrivalTime !== wps[i].arrivalTime ||
              updated[i].departureTime !== wps[i].departureTime ||
              updated[i].twStatus !== wps[i].twStatus ||
              updated[i].waitingTime !== wps[i].waitingTime
            ) {
              hasChanged = true;
              break;
            }
          }
        }

        if (hasChanged) {
          updatedAll[deviceId] = updated;
          changed = true;
        }
      });

      return changed ? updatedAll : prevAll;
    });
  }, [waypointsSerialized]);

  // Restore history cache on initial startup 
  useEffect(() => {
    devices.forEach(vehicle => {
      const saved = localStorage.getItem(`gps_last_trip_${vehicle.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as GPSPoint[];
          if (parsed && parsed.length > 0) {
            setDeviceLogs(prev => ({ ...prev, [vehicle.id]: parsed }));
            const last = parsed[parsed.length - 1];
            setDeviceCurrentPoint(prev => ({ ...prev, [vehicle.id]: last }));
            
            let maxSpeed = 0;
            let overspeedCount = 0;
            parsed.forEach(p => {
              if (p.speed > maxSpeed) maxSpeed = p.speed;
              if (p.speed > DEFAULT_SPEED_LIMIT) overspeedCount++;
            });

            const totalDist = last.distance;
            const { liters } = recalculateFuelMetrics(totalDist, vehicle.consumptionRate);

            setDeviceStats(prev => ({
              ...prev,
              [vehicle.id]: {
                totalDistance: totalDist,
                maxSpeed: maxSpeed,
                averageSpeed: parsed.reduce((acc, p) => acc + p.speed, 0) / parsed.length,
                duration: parsed.length * 2,
                speedingEvents: overspeedCount,
                startTime: "ประวัติครั้งก่อน",
                litersConsumed: liters
              }
            }));
          }
        } catch (e) {
          console.error("Error loading cache for " + vehicle.id, e);
        }
      }
    });
  }, []);

  const triggerCSVDownload = () => {
    exportToCSV(logs);
  };

  // Filter vehicles visually in mock sidebar
  const filteredVehicles = devices.filter(v => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    v.plateNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.driverName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Form Submit Handler to Add Customized GPS Device dynamically
  const handleAddDeviceSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!newDevName || !newDevPlate) {
      alert("กรุณากรอกข้อมูลรหัสอุปกรณ์และทะเบียนตัวรถให้ครบถ้วน");
      return;
    }

    const rate = parseFloat(newDevConsumption) || 0.22;
    const newId = "device-" + Date.now();
    const newDeviceObject: GPSDevice = {
      id: newId,
      name: newDevName,
      plateNumber: newDevPlate,
      driverName: newDevDriver || "พนักงานสำรองประจำทีม",
      deviceType: newDevType,
      consumptionRate: rate,
      status: "Standby",
      currentSpeed: 0
    };

    setDevices(prev => [newDeviceObject, ...prev]);
    setSelectedVehicle(newId);
    setShowAddDevice(false);

    // reset inputs
    setNewDevName("");
    setNewDevPlate("");
    setNewDevDriver("");
    setNewDevType("Truck");
    setNewDevConsumption("0.25");

    alert(`✓ เพิ่มอุปกรณ์ GPS รหัส ${newDevName} เข้าสู่ระบบสำเร็จ สามารถสลับเพื่อติดตามข้อมูลได้ทันที`);
  };

  // Pre-filled major coordinate Hubs in Thailand to assist sequence routing planners
  const THAILAND_HUBS = [
    { name: "คลังสินค้า สถาบันเทคโนโลยีไทย-ญี่ปุ่น (TNI)", lat: 13.7384, lng: 100.5752 },
    { name: "ท่าเทียบเรือตู้สินค้า คลองเตย (BKK Seaport)", lat: 13.7128, lng: 100.5735 },
    { name: "สถานีกระจายสินค้า ย่านบางนา กม.4", lat: 13.6678, lng: 100.6420 },
    { name: "นิคมอุตสาหกรรมบางพลี สมุทรปราการ", lat: 13.5852, lng: 100.7845 },
    { name: "คลังขนส่งสินค้า สนามบินสุวรรณภูมิ Cargo Hub", lat: 13.6900, lng: 100.7501 },
    { name: "ศูนย์บริการท่าเรือ แหลมฉบัง ชลบุรี", lat: 13.0905, lng: 100.9161 },
    { name: "จุดรวมสินค้า นวนคร ปทุมธานี", lat: 14.1214, lng: 100.6133 }
  ];

  // Handler to add waypoint to routing sequence list
  const handleAddWaypoint = (
    name: string, 
    lat: number, 
    lng: number, 
    type: "pickup" | "delivery" = "delivery",
    twStart: string = "08:00",
    twEnd: string = "17:00",
    sTime: number = 20
  ) => {
    if (!name) return;
    
    setWaypoints(prev => {
      const nextSeq = prev.length + 1;
      const newWp: DeliveryWaypoint = {
        id: "wp-" + Date.now(),
        name,
        latitude: lat,
        longitude: lng,
        sequenceOrder: nextSeq,
        status: nextSeq === 1 ? "Visited" : "Pending",
        type,
        timeWindowStart: twStart,
        timeWindowEnd: twEnd,
        serviceTime: sTime
      };
      return [...prev, newWp];
    });

    setCustomWpName("");
  };

  // Move Waypoint Up in Sequence
  const moveWaypointUp = (index: number) => {
    if (index === 0) return;
    setWaypoints(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[index - 1];
      copy[index - 1] = temp;
      
      // re-order sequences
      return copy.map((wp, idx) => ({ ...wp, sequenceOrder: idx + 1 }));
    });
  };

  // Move Waypoint Down in Sequence
  const moveWaypointDown = (index: number) => {
    setWaypoints(prev => {
      if (index === prev.length - 1) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[index + 1];
      copy[index + 1] = temp;
      
      // re-order sequences
      return copy.map((wp, idx) => ({ ...wp, sequenceOrder: idx + 1 }));
    });
  };

  // Remove Waypoint from Planning
  const removeWaypoint = (id: string) => {
    setWaypoints(prev => {
      const filtered = prev.filter(wp => wp.id !== id);
      // reset sequences
      return filtered.map((wp, idx) => ({ ...wp, sequenceOrder: idx + 1 }));
    });
  };

  const gasSpentCost = stats.litersConsumed * 35; // Standard 35 Thai Baht per Diesel liter

  // Calculate planned distance from current arranged sequence list (คำนวณเส้นทางต่อเที่ยว)
  const calculatePlannedRouteDistance = () => {
    if (waypoints.length < 2) return 0;
    let totalPlannedDist = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const p1 = waypoints[i];
      const p2 = waypoints[i + 1];
      totalPlannedDist += calculateDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
    }
    return totalPlannedDist;
  };

  const plannedRouteDistanceKm = calculatePlannedRouteDistance();
  const plannedPickupsCount = waypoints.filter(wp => wp.type === "pickup").length;
  const plannedDeliveriesCount = waypoints.filter(wp => wp.type === "delivery").length;
  const estimatedFuelLitres = plannedRouteDistanceKm * activeDevice.consumptionRate;
  
  // Estimate transit時間 at 60 km/h
  const estimatedHoursTotal = plannedRouteDistanceKm / 60;
  const plannedHours = Math.floor(estimatedHoursTotal);
  const plannedMins = Math.round((estimatedHoursTotal - plannedHours) * 60);

  return (
    <div className="w-full flex flex-col min-h-[calc(100vh-64px)] bg-slate-50 transition-all">
      
      {/* HEADER BANNER OVERSPEED THREAT NOTIFICATION */}
      {isSpeedingNow && (
        <div className="bg-rose-50 border-b-2 border-rose-500 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all z-20 shrink-0">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="p-3 bg-red-600 text-white rounded-xl shadow-md animate-bounce">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-red-800 tracking-tight">TMS ALERT: ความเร็วรถขนส่งพุ่งสูงเกินกำหนด!</h4>
              <p className="text-xs text-red-600 mt-0.5 animate-pulse">
                อุปกรณ์ยานพาหนะควบคุม <span className="font-black text-rose-700 text-sm">{activeDevice.name}</span> วิ่งด้วยสปีดสูงถึง <span className="font-black text-rose-700 text-sm">{activeSpeed.toFixed(1)} กม./ชม.</span> ซึ่งเกินเกณฑ์อัตราบริษัทจำกัดความเร็วไว้ที่ 80 กม./ชม.
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setIsSoundMuted(!isSoundMuted)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow"
            >
              {isSoundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              {isSoundMuted ? "เปิดสัญญาณเสียงแจ้งเตือน" : "ปิดเสียงชั่วคราว"}
            </button>
          </div>
        </div>
      )}

      {/* THREE COLUMN / MODULAR ADAPTIVE LAYOUT (Sidebar Fleet + Planning Control + Active Google Map Layout) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        
        {/* SIDEBAR: TMS COGNITIVE PANEL (lg:col-span-4) */}
        <aside className="lg:col-span-4 bg-white border-r border-slate-200 flex flex-col shadow-sm">
          
          {/* Header Dashboard Toggles for Device GPS vs Delivery Route Planning Setup */}
          <div className="border-b border-slate-200 bg-slate-50/50 p-2 flex gap-1 sticky top-0 z-10">
            <button
              onClick={() => {
                setActiveTab("devices");
                setShowAddDevice(false);
              }}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-extrabold tracking-tight transition-all flex items-center justify-center gap-2 ${
                activeTab === "devices"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100/80"
              }`}
            >
              <Smartphone className="w-4 h-4" />
              สแกนระบุตำแหน่ง GPS ({devices.length})
            </button>
            
            <button
              onClick={() => {
                setActiveTab("planning");
              }}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-extrabold tracking-tight transition-all flex items-center justify-center gap-2 ${
                activeTab === "planning"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100/80"
              }`}
            >
              <Map className="w-4 h-4" />
              จัดเส้นทางขนส่ง ({waypoints.length})
            </button>
          </div>

          {/* TAB 1: DEVICE MANAGEMENT LIST */}
          {activeTab === "devices" && (
            <div className="flex-1 flex flex-col overflow-y-auto">
              
              {/* Add Device Header Panel */}
              <div className="p-4 border-b border-slate-100 space-y-3 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">แผงคุมสัญญาณตัวรถ</span>
                  <button
                    onClick={() => setShowAddDevice(!showAddDevice)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-all border border-blue-200"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    {showAddDevice ? "ปิดฟอร์ม" : "เพิ่ม Device GPS"}
                  </button>
                </div>

                {/* Form Expandable layout to add custom GPS Device */}
                {showAddDevice && (
                  <form onSubmit={handleAddDeviceSubmit} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5">
                    <p className="text-[11px] font-bold text-blue-800 leading-tight flex items-center gap-1">
                      <Settings className="w-3.5 h-3.5" />
                      ลงทะเบียนอุปกรณ์ GPS/ย่านทะเบียนตัวใหม่
                    </p>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold block mb-1">รหัสอุปกรณ์ (ID)</label>
                        <input
                          type="text"
                          required
                          placeholder="เช่น Truck-9022"
                          value={newDevName}
                          onChange={(e) => setNewDevName(e.target.value)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold block mb-1">เลขทะเบียน (Plate)</label>
                        <input
                          type="text"
                          required
                          placeholder="เช่น 70-9022 กทม."
                          value={newDevPlate}
                          onChange={(e) => setNewDevPlate(e.target.value)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold block mb-1">พนักงานคนขับ (Driver)</label>
                        <input
                          type="text"
                          placeholder="ชื่อพนักงาน"
                          value={newDevDriver}
                          onChange={(e) => setNewDevDriver(e.target.value)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold block mb-1">ประเภทรถ (Type)</label>
                        <select
                          value={newDevType}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            setNewDevType(val);
                            // Auto-suggest fuel rates based on professional benchmarks
                            if (val === "Truck") setNewDevConsumption("0.25");
                            if (val === "Van") setNewDevConsumption("0.12");
                            if (val === "Pickup") setNewDevConsumption("0.08");
                            if (val === "Motorcycle") setNewDevConsumption("0.03");
                          }}
                          className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
                        >
                          <option value="Truck">รถบรรทุกสิบล้อ / ตู้ Container</option>
                          <option value="Van">รถตู้โดยสารส่งผล (Van Service)</option>
                          <option value="Pickup">รถกระบะขนส่ง (Pickup Flatbed)</option>
                          <option value="Motorcycle">มอเตอร์ไซค์ไรเดอร์ด่วน</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between">
                        <label className="text-[10px] text-slate-500 font-bold block mb-1">อัตราสิ้นเปลืองเชื้อเพลิง (L/KM)</label>
                        <span className="text-[9px] text-blue-600 font-bold">แนะแนว: 0.10 - 0.35 L/KM</span>
                      </div>
                      <input
                        type="number"
                        step="0.001"
                        min="0.01"
                        max="2.0"
                        required
                        placeholder="ลิตรต่อกิโลเมตร"
                        value={newDevConsumption}
                        onChange={(e) => setNewDevConsumption(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/10 text-slate-800"
                      />
                      <span className="text-[9px] text-slate-400 block mt-1 leading-normal">
                        ค่าจะนำมาคิดปริมาตรเปลืองรวม `อัตรา (L/KM) × ระยะทางขนส่งจริง` พร้อมแปลงเป็น CO2
                      </span>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddDevice(false)}
                        className="flex-1 py-1.5 bg-slate-200 hover:bg-slate-300 rounded text-slate-700 text-xs font-bold transition-colors"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition-all shadow-xs"
                      >
                        ลงทะเบียน GPS
                      </button>
                    </div>
                  </form>
                )}

                {/* Filter Search input */}
                <div className="relative pt-1">
                  <input
                    type="text"
                    placeholder="พิมพ์รหัสตัวเครื่อง / ทะเบียน / คนขับ..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-slate-800"
                  />
                  <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                </div>
              </div>

              {/* Scrolling List */}
              <div className="flex-1 p-4 space-y-3.5 bg-slate-50/40">
                <div className="flex justify-between items-center px-1 mb-1">
                  <span className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block">รายชื่ออุปกรณ์ระบุตำแหน่ง</span>
                  <span className="text-[9px] bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded font-black border border-sky-100">
                    REALTIME DIRECT COGNITIVE
                  </span>
                </div>

                {filteredVehicles.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs bg-white rounded-xl border border-dashed border-slate-200">
                    ไม่มีอุปกรณ์ GPS ที่คัดหาตรงหัวข้อคำหลัก
                  </div>
                ) : (
                  filteredVehicles.map((vehicle) => {
                    const isActive = selectedVehicle === vehicle.id;
                    const isRunning = deviceIsSimulating[vehicle.id] || deviceIsTracking[vehicle.id];
                    const activePt = deviceCurrentPoint[vehicle.id];
                    const currentSpeed = activePt ? activePt.speed : 0;
                    const isOver = currentSpeed > DEFAULT_SPEED_LIMIT;
                    
                    return (
                      <div
                        key={vehicle.id}
                        id={`vehicle-card-${vehicle.id}`}
                        onClick={() => {
                          setSelectedVehicle(vehicle.id);
                        }}
                        className={`p-4 rounded-xl border-l-4 transition-all cursor-pointer shadow-xs bg-white ${
                          isActive
                            ? isOver 
                              ? "bg-rose-50 border-rose-500 border-t border-r border-b border-rose-250 shadow-sm"
                              : "bg-blue-50/60 border-blue-600 border-t border-r border-b border-blue-200 shadow-sm"
                            : "border-slate-250 hover:bg-slate-50 border-l-slate-400 hover:border-l-blue-400"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1 gap-2">
                          <div>
                            <span className="text-xs font-black text-slate-900 block">{vehicle.name}</span>
                            <span className="text-[9px] text-slate-400 font-semibold uppercase">{vehicle.plateNumber}</span>
                          </div>
                          
                          <div className="flex flex-col items-end gap-1">
                            <span className={`text-[9.5px] px-2 py-0.5 rounded font-black uppercase ${
                              deviceIsSimulating[vehicle.id]
                                ? "bg-blue-600 text-white animate-pulse"
                                : deviceIsTracking[vehicle.id]
                                ? "bg-emerald-600 text-white animate-pulse"
                                : "bg-slate-150 text-slate-500"
                            }`}>
                              {deviceIsSimulating[vehicle.id] ? "SIMULATOR" : deviceIsTracking[vehicle.id] ? "LIVE MOBILE" : "STANDBY"}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1.5 pt-2 mt-2 border-t border-slate-100/85 text-[11px] text-slate-600">
                          <div className="flex justify-between">
                            <span>ผู้บังคับขี่: <b className="text-slate-800">{vehicle.driverName}</b></span>
                            <span className="text-blue-600 font-bold bg-blue-50 px-1 py-0.2 rounded text-[10px]">{vehicle.deviceType}</span>
                          </div>
                          <div className="flex justify-between text-[11px] pt-1 border-t border-dashed border-slate-100">
                            <div>
                              การใช้เชื้อเพลิง: <span className="font-extrabold text-indigo-750">{vehicle.consumptionRate.toFixed(2)} L/KM</span>
                            </div>
                            <div>
                              ความเร็ว: <span className={`font-black ${isOver ? "text-red-500" : "text-blue-700"}`}>
                                {currentSpeed.toFixed(1)} กม./ชม.
                              </span>
                            </div>
                          </div>

                          {/* Quick inline simulator panels to control each vehicle individually */}
                          <div className="pt-2 border-t border-slate-100 mt-2">
                            <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wide mb-1.5 flex items-center gap-1">
                              <Zap className="w-3 h-3 text-amber-500" />
                              ตารางกิจกรรมบอร์ดควบคุมคันนี้
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {!isRunning ? (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startRouteSimulationForDevice(vehicle.id, "normal");
                                    }}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[9px] px-2 py-1 rounded transition-colors"
                                  >
                                    ▶ เริ่มวิ่งแผนปกติ
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startRouteSimulationForDevice(vehicle.id, "overspeed");
                                    }}
                                    className="bg-rose-500 hover:bg-rose-600 text-white font-bold text-[9px] px-2 py-1 rounded transition-colors"
                                  >
                                    ⚡ วิ่งแบบเร็วเกินเกณฑ์
                                  </button>
                                  {vehicle.id === "mobile" && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        startLiveTrackingForDevice(vehicle.id);
                                      }}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] px-2 py-1 rounded transition-colors"
                                    >
                                      📡 สแกนตัวรับจริง
                                    </button>
                                  )}
                                </>
                              ) : (
                                <div className="flex items-center gap-1.5 w-full">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      stopTrackingForDevice(vehicle.id);
                                    }}
                                    className="bg-red-600 hover:bg-red-700 text-white font-bold text-[9.5px] px-2.5 py-1 rounded flex items-center gap-1 transition-colors"
                                  >
                                    ■ เกลี่ยหยุดพิกัดวิ่ง
                                  </button>
                                  <span className="text-[9px] text-indigo-600 font-bold animate-pulse font-mono">
                                    ● ONLINE
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ROUTE PLANNING AND SEQUENCE PLACEMENT */}
          {activeTab === "planning" && (
            <div className="flex-1 flex flex-col overflow-y-auto bg-slate-50/30">
              
              {/* Waypoint setup controls */}
              <div className="p-4 bg-white border-b border-slate-100 space-y-3">
                <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider block">จัดวางแผนและจุดส่งสินค้า</span>
                <p className="text-[10px] text-slate-500 leading-normal">
                  กำหนดพิกัดแผนที่จัดส่งตามลำดับ ข้อมูลจะถูกโยงเป็นโครงข่ายเส้นประแผนจัดส่งสินค้าบน Google Maps
                </p>

                {/* Predefined Quick Links buttons to design paths */}
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">เลือกศูนย์ขนส่งหลักในไทย (คีย์พิกัดด่วน 1-Click)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {THAILAND_HUBS.map((hub) => (
                      <button
                        key={hub.name}
                        type="button"
                        onClick={() => handleAddWaypoint(hub.name, hub.lat, hub.lng, customWpType)}
                        className="bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 border border-slate-200 rounded px-2 py-1 text-[10px] text-slate-650 font-bold tracking-tight transition-all"
                      >
                        + {hub.name.split(" ")[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Waypoint Type Menu Selector */}
                <div className="space-y-1 pt-1">
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">เลือกประเภทจุดรับหรือจุดส่งส่งสินค้า</label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-150 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setCustomWpType("pickup")}
                      className={`py-1.5 rounded text-[11px] font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                        customWpType === "pickup"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-650 hover:bg-slate-200"
                      }`}
                    >
                      <span className="text-xs">📥</span> จุดรับสินค้า (Pickup)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomWpType("delivery")}
                      className={`py-1.5 rounded text-[11px] font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                        customWpType === "delivery"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-slate-650 hover:bg-slate-200"
                      }`}
                    >
                      <span className="text-xs">📤</span> จุดส่งสินค้า (Delivery)
                    </button>
                  </div>
                </div>

                {/* Add Custom Point coordinate inputs */}
                <div className="p-3 bg-slate-50/80 border border-slate-250 rounded-xl space-y-2.5 mt-2">
                  <p className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                    <span className="text-xs">{customWpType === "pickup" ? "📥" : "📤"}</span>
                    <span>เพิ่มพิกัด{customWpType === "pickup" ? "จุดรับสินค้า" : "จุดส่งสินค้า"}ที่กำหนดเอง</span>
                  </p>
                  
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-slate-450 font-bold block">ชื่อสถานที่ / คลังสินค้าลูกค้า</label>
                    <input
                      type="text"
                      placeholder={customWpType === "pickup" ? "เช่น บริษัทซัพพลายเออร์บางแค" : "เช่น คลังสินค้าเพชรบุรี ซอย 3"}
                      value={customWpName}
                      onChange={(e) => setCustomWpName(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] text-slate-405 font-bold block mb-0.5">Latitude</label>
                      <input
                        type="text"
                        value={customWpLat}
                        onChange={(e) => setCustomWpLat(e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-405 font-bold block mb-0.5">Longitude</label>
                      <input
                        type="text"
                        value={customWpLng}
                        onChange={(e) => setCustomWpLng(e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* TW-VRP Config Inputs (Time Window & Service Duration) */}
                  <div className="grid grid-cols-3 gap-1.5 border-t border-dashed border-slate-200 pt-2">
                    <div>
                      <label className="text-[8px] text-slate-500 font-extrabold uppercase tracking-wide block mb-0.5">TW เริ่ม (Start)</label>
                      <input
                        type="time"
                        value={customWpTWStart}
                        onChange={(e) => setCustomWpTWStart(e.target.value || "08:00")}
                        className="w-full p-1 bg-white border border-slate-200 rounded text-xs font-bold font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] text-slate-500 font-extrabold uppercase tracking-wide block mb-0.5">TW สิ้นสุด (End)</label>
                      <input
                        type="time"
                        value={customWpTWEnd}
                        onChange={(e) => setCustomWpTWEnd(e.target.value || "17:00")}
                        className="w-full p-1 bg-white border border-slate-200 rounded text-xs font-bold font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] text-slate-500 font-extrabold uppercase tracking-wide block mb-0.5">เวลาโหลด (นาที)</label>
                      <input
                        type="number"
                        min="1"
                        max="300"
                        value={customWpServiceTime}
                        onChange={(e) => setCustomWpServiceTime(e.target.value)}
                        className="w-full p-1 bg-white border border-slate-200 rounded text-xs font-bold"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!customWpName) {
                        alert(`กรุณากรอกชื่อพิกัด${customWpType === "pickup" ? "จุดรับ" : "จุดส่ง"}สินค้าก่อน`);
                        return;
                      }
                      handleAddWaypoint(
                        customWpName,
                        parseFloat(customWpLat) || BANGKOK_LAT,
                        parseFloat(customWpLng) || BANGKOK_LNG,
                        customWpType,
                        customWpTWStart,
                        customWpTWEnd,
                        parseInt(customWpServiceTime) || 20
                      );
                    }}
                    className={`w-full py-1.5 text-white rounded text-xs font-bold transition-all shadow-xs ${
                      customWpType === "pickup" ? "bg-blue-600 hover:bg-blue-700" : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                  >
                    + บันทึกเพิ่มเข้าเที่ยวจัดเส้นทาง
                  </button>
                </div>
              </div>

              {/* Waypoints sequential items display list */}
              <div className="p-4 space-y-3">
                
                {/* TW-VRP CONTROL PANEL (ระบบจัดเส้นทางและจำลองเที่ยววิ่ง TW-VRP) */}
                {waypoints.length > 0 && (
                  <div className="p-3 bg-gradient-to-br from-indigo-50 to-blue-50/80 border border-indigo-100 rounded-xl space-y-2">
                    <div className="flex items-center gap-1.5 text-indigo-900 font-black text-xs">
                      <Zap className="w-4 h-4 text-indigo-600 animate-bounce" />
                      <span>ระบบวิเคราะห์และจัดเส้นทางอัจฉริยะ TW-VRP</span>
                    </div>
                    <p className="text-[10px] text-indigo-700 leading-snug">
                      วิเคราะห์หน้าต่างเวลารับ-ส่ง (Time Windows) ป้องกันรถไปถึงก่อนเวลาเปิด หรือเลทหลังปิด และยึดศูนย์ต้นทาง (จุดที่ 1) เป็นคลังปล่อยรถหลัก
                    </p>

                    <div className="grid grid-cols-2 gap-2 mt-1 items-end pt-1 border-t border-indigo-100/60">
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold block mb-0.5">เวลาปล่อยรถคลังแรก (Start Time)</label>
                        <input
                          type="time"
                          value={vrpStartTime}
                          onChange={(e) => setVrpStartTime(e.target.value || "08:00")}
                          className="w-full p-1 bg-white border border-slate-200 rounded text-xs font-bold font-mono"
                        />
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => {
                          if (waypoints.length <= 1) {
                            alert("กรุณาเพิ่มจุดส่งตั้งแต่ 2 จุดขึ้นไปเพื่อคำนวณสลับเส้นทาง");
                            return;
                          }
                          const opt = optimizeTWVRP(waypoints, vrpStartTime, 55);
                          setWaypoints(opt);
                          // Play a pleasant success tone
                          playAlertBeep(523, 0.15);
                          setTimeout(() => playAlertBeep(659, 0.2), 150);
                          alert("✓ จัดลำดับจัดส่งอัจฉริยะ (TW-VRP Optimized Sequence) เรียบร้อย! ระบบสลับจุดที่ 2 ถึงปลายทางเพื่อลดยอดการสายและเซฟระยะทางสูงสุดเรียบร้อย");
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        จัดเรียงด้วย TW-VRP
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center px-1">
                  <span className="text-[10px] font-black uppercase text-slate-450 tracking-wider">ลำดับจัดส่งปัจจุบัน ({waypoints.length})</span>
                  {waypoints.length > 1 && (
                    <span className="text-[9px] text-emerald-700 font-bold bg-emerald-55 px-1.5 py-0.5 rounded">
                      จัดลำดับเส้นทางถูกต้องสำรวจเรียบร้อย
                    </span>
                  )}
                </div>

                {waypoints.length === 0 ? (
                  <div className="py-12 bg-white border border-slate-200 rounded-xl text-center text-xs text-slate-400">
                    ยังไม่มีการจัดชุดวางแผน จัดส่งสินค้า กรุณาเพิ่มศูนย์ขนส่งด่วนหรือปลายทางด้านบน
                  </div>
                ) : (
                  <div className="space-y-2">
                    {waypoints.map((wp, index) => {
                      const isPickup = wp.type === "pickup";
                      return (
                        <div 
                          key={wp.id} 
                          className={`bg-white border p-3 rounded-xl shadow-xs flex items-center justify-between gap-3 transform transition-all ${
                            isPickup 
                              ? "border-slate-200 hover:border-blue-450" 
                              : "border-slate-200 hover:border-emerald-450"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            {/* Round sequence circle badge */}
                            <div className={`w-5 h-5 rounded-lg border border-white text-white text-[10px] font-black flex items-center justify-center shrink-0 ${
                              isPickup ? "bg-blue-600" : "bg-emerald-600"
                            }`}>
                              {index + 1}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded uppercase shrink-0 ${
                                  isPickup 
                                    ? "bg-blue-50 text-blue-700 border border-blue-150" 
                                    : "bg-emerald-50 text-emerald-700 border border-emerald-150"
                                }`}>
                                  {isPickup ? "📥 รับสินค้า" : "📤 ส่งสินค้า"}
                                </span>
                                <span className="text-xs font-bold text-slate-800 truncate block">{wp.name}</span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                <span className="text-[9px] text-slate-400 font-mono">
                                  Lat: {wp.latitude.toFixed(4)}, Lng: {wp.longitude.toFixed(4)}
                                </span>
                                {wp.timeWindowStart && wp.timeWindowEnd && (
                                  <span className="text-[9px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded border border-slate-150 whitespace-nowrap">
                                    🕒 TW: {wp.timeWindowStart} - {wp.timeWindowEnd}
                                  </span>
                                )}
                                {wp.serviceTime !== undefined && (
                                  <span className="text-[9px] bg-indigo-50 text-indigo-700 font-semibold px-1 py-0.5 rounded whitespace-nowrap">
                                    📦 โหลด: {wp.serviceTime} น.
                                  </span>
                                )}
                              </div>

                              {/* VRP ESTIMATED TIMELINE HUD AREA */}
                              {wp.arrivalTime && wp.departureTime && (
                                <div className="mt-2 text-[10px] bg-slate-50/75 border border-slate-150 p-1.5 rounded-lg space-y-1">
                                  <div className="flex justify-between font-bold text-slate-700">
                                    <span>⏱️ คาดว่าถึง: <span className="text-slate-900 font-mono">{wp.arrivalTime} น.</span></span>
                                    <span>ออกคลัง: <span className="text-slate-900 font-mono">{wp.departureTime} น.</span></span>
                                  </div>
                                  
                                  {/* Violation Warning status badges */}
                                  <div className="flex items-center justify-between pt-0.5 mt-0.5 border-t border-dashed border-slate-205">
                                    <span className="text-[8.5px] text-slate-400 font-medium">วิเคราะห์คิวเวลา:</span>
                                    {wp.twStatus === "on-time" && (
                                      <span className="text-[8.5px] text-emerald-800 font-black px-1.5 py-0.5 bg-emerald-50 rounded border border-emerald-250 flex items-center gap-0.5">
                                        ✓ นัดตรงเวลาพอดี
                                      </span>
                                    )}
                                    {wp.twStatus === "early" && (
                                      <span className="text-[8.5px] text-amber-800 font-black px-1.5 py-0.5 bg-amber-50 rounded border border-amber-250 text-right">
                                        ⏳ ถึงไวเกิน (รอคอย {wp.waitingTime} นาที)
                                      </span>
                                    )}
                                    {wp.twStatus === "late" && (
                                      <span className="text-[8.5px] text-red-800 font-black px-1.5 py-0.5 bg-red-50 rounded border border-red-250 animate-pulse whitespace-nowrap">
                                        ⚠️ สายเกินกำหนด (Late)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                        {/* Order Controls upward downward deletion */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => moveWaypointUp(index)}
                            disabled={index === 0}
                            title="เลื่อนขึ้น"
                            className="p-1 bg-slate-50 border border-slate-200 rounded text-slate-500 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => moveWaypointDown(index)}
                            disabled={index === waypoints.length - 1}
                            title="เลื่อนลง"
                            className="p-1 bg-slate-50 border border-slate-200 rounded text-slate-500 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => removeWaypoint(wp.id)}
                            title="ลบออก"
                            className="p-1 bg-rose-50 border border-rose-100 rounded text-rose-500 hover:bg-rose-500 hover:text-white transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* QUICK EXPORT BAR AT SIDEBAR BASE */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2">
            <button
              onClick={triggerCSVDownload}
              disabled={logs.length === 0}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-705 text-xs font-bold shadow-xs hover:bg-slate-100 disabled:opacity-40 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              รายงานตู้ขนส่งและสถิติ (.CSV)
            </button>
            <button
              onClick={resetTrip}
              className="w-full flex items-center justify-center gap-2 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 text-[11px] font-semibold hover:bg-slate-200 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              ล้างประวัติ ทริปและเที่ยวรอบวันทั้งหมด
            </button>
          </div>
        </aside>

        {/* WORKSPACE & REALTIME INTERACTIVE MAP (lg:col-span-8) */}
        <section className="lg:col-span-8 flex flex-col relative bg-slate-100 overflow-hidden min-h-[520px]">
          
          {/* MAP CANVAS DIV */}
          <div className="flex-1 w-full h-full relative z-10">
            <MapContainer 
              activeVehicles={devices.map(d => ({
                id: d.id,
                name: d.name,
                plateNumber: d.plateNumber,
                deviceType: d.deviceType,
                color: getDeviceColor(d.id),
                logs: deviceLogs[d.id] || [],
                currentPoint: deviceCurrentPoint[d.id] || null,
                waypoints: deviceWaypoints[d.id] || [],
                isTracking: deviceIsTracking[d.id] || false,
                isSimulating: deviceIsSimulating[d.id] || false,
                speedLimit: DEFAULT_SPEED_LIMIT
              }))}
              selectedVehicleId={selectedVehicle}
            />
          </div>

          {/* DYNAMIC SUSTAINABILITY, CONSUMPTION RATE & CARBON HUD FLOATING PANEL */}
          <div className="absolute bottom-6 left-6 right-6 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xl flex flex-col xl:flex-row items-center p-5 xl:p-6 gap-6 xl:gap-8 z-20 transition-all text-slate-900">
            
            {/* 1. Trip Statistics block */}
            <div className="grid grid-cols-2 gap-4 w-full xl:w-auto shrink-0 md:flex md:items-center md:gap-8">
              
              {/* Distance */}
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ระยะทางสะสมจริง</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-black text-slate-800 tracking-tight">{stats.totalDistance.toFixed(3)}</span>
                  <span className="text-[10px] font-bold text-slate-500">กม.</span>
                </div>
                <span className="text-[9px] text-slate-400 mt-1">
                  ของ {activeDevice.name}
                </span>
              </div>

              {/* Average Speed */}
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ความเร็วเฉลี่ย</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-light text-slate-800 tracking-tight">{stats.averageSpeed.toFixed(1)}</span>
                  <span className="text-[10px] font-bold text-slate-500">กม./ชม.</span>
                </div>
                <div className="w-16 h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-500" 
                    style={{ width: `${Math.min((stats.averageSpeed / 120) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Speed alerts count */}
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ความเร็วเกิน 80 กม.</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className={`text-2xl font-black tracking-tight ${stats.speedingEvents > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    {stats.speedingEvents.toString().padStart(2, "0")}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">ครั้ง</span>
                </div>
                <span className={`text-[9px] font-bold uppercase mt-1 ${stats.speedingEvents > 0 ? "text-red-500" : "text-emerald-500"}`}>
                  {stats.speedingEvents > 0 ? "🚨 ผิดกฎระเบียบ" : "✓ ขับขี่ปลอดภัย 100%"}
                </span>
              </div>

            </div>

            <div className="hidden xl:block h-14 w-px bg-slate-200" />

            {/* 2. Fuel Consumption Rates L/KM (เพิ่มข้อมูลที่เป็นอัตราสิ้นเปลือง L/KM) */}
            <div className="flex flex-col w-full md:w-auto min-w-[170px]">
              <div className="flex items-center gap-1.5">
                <Fuel className="w-4 h-4 text-indigo-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">อัตราเปลืองพลังงาน</span>
              </div>
              
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl font-black text-indigo-950 tracking-tight">
                  {stats.litersConsumed.toFixed(2)}
                </span>
                <span className="text-[10px] font-bold text-slate-500">ลิตร</span>
              </div>

              <div className="text-[10px] text-slate-500 mt-1 font-semibold space-y-0.5">
                <p>กำหนดเรทรถ: <span className="text-indigo-600">{activeDevice.consumptionRate.toFixed(2)} L/KM</span></p>
                <p>ค่าน้ำมันเฉลี่ย: <span className="text-slate-800">{gasSpentCost.toLocaleString("th-TH", { maximumFractionDigits: 1 })} บาท</span> (@35฿)</p>
              </div>
            </div>

            <div className="hidden xl:block h-14 w-px bg-slate-200" />

            {/* 3. Trip Segment Planner Calculator (คำนวณเส้นทางต่อเที่ยว) */}
            <div className="flex flex-col w-full md:w-auto min-w-[220px] p-3 bg-blue-50/50 rounded-xl border border-blue-100">
              <div className="flex items-center gap-1.5 text-blue-805">
                <Navigation className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-[10px] font-black uppercase tracking-wider">สถิติจัดเที่ยววิ่งตามแผน ({waypoints.length} จุดหลัก)</span>
              </div>
              
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-blue-900 tracking-tight">
                  {plannedRouteDistanceKm.toFixed(1)}
                </span>
                <span className="text-[10px] font-bold text-blue-600">กม. รวม</span>
              </div>

              <div className="text-[9px] text-slate-600 mt-1 font-semibold space-y-0.5 leading-tight">
                <p className="text-blue-700 font-bold flex items-center gap-1">
                  <span>📥 {plannedPickupsCount} จุดรับสินค้า</span>
                  <span>/</span>
                  <span>📤 {plannedDeliveriesCount} จุดส่งสินค้า</span>
                </p>
                <p className="text-slate-500 font-normal">
                  เวลาเดินทางคาดการณ์: <span className="font-bold text-slate-800">{plannedHours} ชม. {plannedMins} นาที</span> (ความเร็ว 60กม/ชม)
                </p>
                <p className="text-slate-500 font-normal font-mono text-[8.5px]">
                  พลังงานที่ใช้คาดการณ์: <span className="font-bold text-indigo-700">{estimatedFuelLitres.toFixed(1)} ลิตร</span>
                </p>
              </div>
            </div>

            {/* 4. Controls Trigger */}
            <div className="flex-grow flex justify-end gap-2 w-full xl:w-auto">
              <div className="flex flex-col items-stretch xl:items-end gap-1.5 w-full">
                <div className="flex items-center gap-2 justify-between xl:justify-end w-full">
                  <span className="text-[9px] font-bold text-slate-400">GPS Signal Accuracy:</span>
                  <span className="text-[10px] font-black text-slate-600">
                    {currentPoint ? `± ${currentPoint.accuracy.toFixed(1)} ม.` : "รอยื่นพิกัดตัวอย่าง"}
                  </span>
                </div>
                
                <div className="flex gap-2 w-full justify-end">
                  {!isTracking && !isSimulating ? (
                    <button
                      onClick={() => startRouteSimulation("normal")}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" /> ทดสอบวิ่งเที่ยวส่งข้ามจังหวัด (Sim)
                    </button>
                  ) : (
                    <button
                      onClick={stopTracking}
                      className="px-4 py-2 bg-red-650 hover:bg-red-750 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md animate-pulse"
                    >
                      <Square className="w-3.5 h-3.5 fill-white animate-pulse" /> ระงับจัดสัญญาณ GPS ชั่วคราว
                    </button>
                  )}
                </div>
              </div>
            </div>

          </div>
        </section>

      </div>

      {/* LOWER DETAILED COGNITIVE REPORT LOGS TABLE */}
      <div className="bg-white border-t border-slate-200 p-6 shadow-sm">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" /> ตารางบันทึกสัญญาณรถและบันทึกความเร็ว (GPS Travel Logger - TMS Report)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                พิกัดเส้นทางการเดินรถขนส่ง ละติจูด ลองจิจูด ความแม่นยำ ระยะทางสะสม และประมาณน้ำมันเชื้อเพลิงใช้สะสม per-checkpoint
              </p>
            </div>

            <button
              onClick={triggerCSVDownload}
              disabled={logs.length === 0}
              className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 text-emerald-850 border border-emerald-200 text-xs font-bold rounded-lg flex items-center gap-2 transition-all shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              สรุปตารางส่งออกรายงาน (.CSV)
            </button>
          </div>

          {logs.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-350">
                <MapPin className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-slate-700 text-sm">ยังไม่มีพิกัดเดินทางถูกประมวลผล</p>
                <p className="text-slate-450 text-xs max-w-sm">กรุณากดเปิดจำลองพิกัดเดินข้ามเส้นทาง หรือเชื่อมต่อสัญญาณดาวเทียมมือถือจริง เพื่อเริ่มเก็บข้อมูลพิกัดบนแผนที่และคำนวณอัตราสิ้นเปลือง</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs max-h-96">
              <table className="w-full text-left text-xs text-slate-600 border-collapse">
                <thead>
                  <tr className="bg-slate-50 font-bold text-slate-700 border-b border-slate-200 sticky top-0 z-10">
                    <th className="py-3 px-4">จุดพิกัด</th>
                    <th className="py-3 px-4">วันเวลาจัดเก็บ (Timestamp)</th>
                    <th className="py-3 px-4">ละติจูด (Latitude)</th>
                    <th className="py-3 px-4">ลองจิจูด (Longitude)</th>
                    <th className="py-3 px-4">ความเร็วระบุจริง (Speed)</th>
                    <th className="py-3 px-4">ระยะทางสะสม</th>
                    <th className="py-3 px-4">คำนวณลิตรเปลืองสะสม</th>
                    <th className="py-3 px-4 text-center">เตือนขับเร็วเกิน (80 กม.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums text-[12px]">
                  {logs.slice().reverse().map((entry, index) => {
                    const reverseIndex = logs.length - index;
                    const isSpeedingLog = entry.speed > DEFAULT_SPEED_LIMIT;
                    // point specific fuel metrics
                    const ptLiters = entry.distance * activeDevice.consumptionRate;

                    return (
                      <tr 
                        key={index} 
                        className={`hover:bg-slate-50/75 transition-colors ${isSpeedingLog ? "bg-red-55/35" : ""}`}
                      >
                        <td className="py-2.5 px-4 font-bold text-slate-500">{reverseIndex}</td>
                        <td className="py-2.5 px-4 text-slate-755 font-medium">{entry.timestamp}</td>
                        <td className="py-2.5 px-4 text-slate-500">{entry.latitude.toFixed(6)}</td>
                        <td className="py-2.5 px-4 text-slate-500">{entry.longitude.toFixed(6)}</td>
                        <td className={`py-2.5 px-4 font-black ${isSpeedingLog ? "text-rose-600 font-extrabold text-sm animate-pulse" : "text-slate-800"}`}>
                          {entry.speed.toFixed(1)} กม./ชม.
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 font-semibold">{entry.distance.toFixed(3)} กม.</td>
                        <td className="py-2.5 px-4 text-indigo-700 font-bold">{ptLiters.toFixed(2)} ลิตร</td>
                        <td className="py-2.5 px-4 text-center">
                          {isSpeedingLog ? (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-red-150 text-red-750 border border-red-200 font-black px-2.5 py-0.5 rounded-full animate-pulse">
                              🚨 เกินกำหนด 80 กม./ชม.
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold px-2.5 py-0.5 rounded-full">
                              ✓ ปลอดภัยตามกฎ
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

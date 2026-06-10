export interface GPSPoint {
  latitude: number;
  longitude: number;
  timestamp: string; // ISO string 2026-xx-xxTxx:xx:xxZ or formatted
  speed: number;      // Speed in km/h
  accuracy: number;   // Accuracy in meters
  distance: number;   // Cumulative distance in km from start of trip
  bearing?: number;   // Heading direction in degrees (0 = North, 90 = East, etc.)
}

export interface GPSDevice {
  id: string;
  name: string;
  plateNumber: string;
  driverName: string;
  deviceType: "Truck" | "Van" | "Pickup" | "Motorcycle";
  consumptionRate: number; // L/KM, e.g., 0.25 Liter per Kilometer
  status: "Active" | "Moving" | "Standby" | "Parked" | "Danger_Overspeed";
  currentSpeed: number;
}

export interface DeliveryWaypoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  sequenceOrder: number;
  status: "Pending" | "Visited";
  type: "pickup" | "delivery"; // Designated type for each point: จุดรับ (pickup) or จุดส่ง (delivery)
  timeWindowStart?: string;     // e.g., "08:00"
  timeWindowEnd?: string;       // e.g., "12:00"
  serviceTime?: number;         // in minutes, e.g., 20
  arrivalTime?: string;         // calculated e.g. "08:45"
  departureTime?: string;       // calculated e.g. "09:05"
  waitingTime?: number;         // in minutes
  twStatus?: "on-time" | "early" | "late";
}

export interface TripStats {
  totalDistance: number;  // In kilometers
  maxSpeed: number;       // In km/h
  averageSpeed: number;   // In km/h
  duration: number;       // Trip duration in seconds
  speedingEvents: number; // Count of over-speed readings
  startTime: string | null;
  litersConsumed: number; // Calculated via totalDistance * consumptionRate
}

export interface TrackingState {
  isTracking: boolean;
  isSimulating: boolean;
  currentPoint: GPSPoint | null;
  logs: GPSPoint[];
  stats: TripStats;
  speedLimit: number; // Default 80 km/h
}


export interface SimulatedPoint {
  latitude: number;
  longitude: number;
  speed: number;    // Simulated speed (km/h)
  accuracy: number; // Simulated precision (meters)
}

// Simulated delivery truck route in Bangkok (From Khlong Toei Port to Bang Na Expressway)
export const SIMULATED_TRUCK_ROUTE: SimulatedPoint[] = [
  { latitude: 13.708123, longitude: 100.583546, speed: 0, accuracy: 5.2 },
  { latitude: 13.708512, longitude: 100.584123, speed: 15.3, accuracy: 4.8 },
  { latitude: 13.709245, longitude: 100.584988, speed: 28.5, accuracy: 4.5 },
  { latitude: 13.710121, longitude: 100.585812, speed: 38.2, accuracy: 4.2 },
  { latitude: 13.710892, longitude: 100.586940, speed: 45.0, accuracy: 4.1 },
  // Entering expressway ramp
  { latitude: 13.711582, longitude: 100.588102, speed: 52.8, accuracy: 4.0 },
  { latitude: 13.712123, longitude: 100.589145, speed: 58.4, accuracy: 3.8 },
  { latitude: 13.712891, longitude: 100.590890, speed: 65.0, accuracy: 3.5 },
  { latitude: 13.713511, longitude: 100.592512, speed: 72.1, accuracy: 3.6 },
  { latitude: 13.714123, longitude: 100.594191, speed: 78.5, accuracy: 3.5 },
  // Speed goes past limit (80 km/h limit breached!)
  { latitude: 13.714890, longitude: 100.595992, speed: 82.3, accuracy: 3.4 }, // Alert triggers
  { latitude: 13.715512, longitude: 100.597812, speed: 87.6, accuracy: 3.4 }, // Alert triggers
  { latitude: 13.716120, longitude: 100.599611, speed: 91.2, accuracy: 3.2 }, // Alert triggers
  { latitude: 13.716812, longitude: 100.601452, speed: 89.8, accuracy: 3.2 }, // Alert triggers
  { latitude: 13.717454, longitude: 100.603123, speed: 84.5, accuracy: 3.5 }, // Alert triggers
  // Driver decelerates back into speed constraints
  { latitude: 13.718012, longitude: 100.604812, speed: 78.2, accuracy: 3.8 },
  { latitude: 13.718612, longitude: 100.606512, speed: 72.5, accuracy: 4.1 },
  { latitude: 13.719241, longitude: 100.608123, speed: 68.0, accuracy: 4.0 },
  { latitude: 13.719902, longitude: 100.609812, speed: 64.3, accuracy: 4.2 },
  { latitude: 13.720512, longitude: 100.611582, speed: 61.2, accuracy: 4.3 },
  // Cruising smoothly
  { latitude: 13.721234, longitude: 100.613391, speed: 59.8, accuracy: 4.5 },
  { latitude: 13.721912, longitude: 100.615102, speed: 60.1, accuracy: 4.4 },
  { latitude: 13.722512, longitude: 100.616892, speed: 62.4, accuracy: 4.5 },
  // Minor speeding sprint
  { latitude: 13.723123, longitude: 100.618612, speed: 77.8, accuracy: 4.1 },
  { latitude: 13.723812, longitude: 100.620452, speed: 83.1, accuracy: 3.9 }, // Alert triggers
  { latitude: 13.724391, longitude: 100.622102, speed: 85.4, accuracy: 4.0 }, // Alert triggers
  { latitude: 13.724981, longitude: 100.623812, speed: 81.0, accuracy: 4.2 }, // Alert triggers
  // Decelerating to exit expressway
  { latitude: 13.725512, longitude: 100.625512, speed: 69.5, accuracy: 4.1 },
  { latitude: 13.726123, longitude: 100.627211, speed: 54.2, accuracy: 4.5 },
  { latitude: 13.726712, longitude: 100.628892, speed: 42.1, accuracy: 4.8 },
  { latitude: 13.727211, longitude: 100.630231, speed: 30.5, accuracy: 5.0 },
  { latitude: 13.727812, longitude: 100.631582, speed: 18.2, accuracy: 5.2 },
  { latitude: 13.728211, longitude: 100.632412, speed: 0.0, accuracy: 5.5 }
];

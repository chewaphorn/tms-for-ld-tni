import { DeliveryWaypoint } from "../types";
import { calculateDistance } from "./geo";

// Convert HH:MM string to minutes since midnight
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 480; // Default 08:00
  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return 480;
  return h * 60 + m;
}

// Convert minutes since midnight back to HH:MM string
export function minutesToTimeString(minutes: number): string {
  const h = Math.floor((minutes % 1440) / 60);
  const m = Math.floor(minutes % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}`;
}

/**
 * Calculates arrival time, departure time, waiting time, and TW-VRP status
 * for each waypoint in sequential order.
 */
export function calculateSchedule(
  waypoints: DeliveryWaypoint[],
  departureTimeStr: string = "08:00",
  speedKmh: number = 55
): DeliveryWaypoint[] {
  if (waypoints.length === 0) return [];

  const result: DeliveryWaypoint[] = [];
  let currentMinutes = timeStringToMinutes(departureTimeStr);

  waypoints.forEach((wp, index) => {
    const freshWp = { ...wp };
    
    // First waypoint is the starting depot / hub
    if (index === 0) {
      freshWp.arrivalTime = minutesToTimeString(currentMinutes);
      const svc = freshWp.serviceTime || 0;
      freshWp.departureTime = minutesToTimeString(currentMinutes + svc);
      freshWp.waitingTime = 0;
      freshWp.twStatus = "on-time";
      
      currentMinutes += svc;
      result.push(freshWp);
      return;
    }

    const prevWp = result[index - 1];
    // Calculate travel distance from previous point
    const dist = calculateDistance(prevWp.latitude, prevWp.longitude, freshWp.latitude, freshWp.longitude);
    // Travel time in minutes
    const travelTimeMins = Math.round((dist / speedKmh) * 60);
    
    const arrMins = currentMinutes + travelTimeMins;
    freshWp.arrivalTime = minutesToTimeString(arrMins);

    // Get time window limits
    const startMins = timeStringToMinutes(freshWp.timeWindowStart || "08:00");
    const endMins = timeStringToMinutes(freshWp.timeWindowEnd || "17:00");
    const svc = freshWp.serviceTime || 15; // default 15 mins service duration

    let waitTime = 0;
    let actStartMins = arrMins;

    if (arrMins < startMins) {
      waitTime = startMins - arrMins;
      actStartMins = startMins;
      freshWp.twStatus = "early";
    } else if (arrMins > endMins) {
      freshWp.twStatus = "late";
    } else {
      freshWp.twStatus = "on-time";
    }

    freshWp.waitingTime = waitTime;
    const depMins = actStartMins + svc;
    freshWp.departureTime = minutesToTimeString(depMins);

    currentMinutes = depMins;
    result.push(freshWp);
  });

  return result;
}

/**
 * Optimizes the delivery sequence to minimize distance and Time Window violations.
 * First waypoint (index 0) remains as Depot/Start.
 */
export function optimizeTWVRP(
  waypoints: DeliveryWaypoint[],
  departureTimeStr: string = "08:00",
  speedKmh: number = 55
): DeliveryWaypoint[] {
  if (waypoints.length <= 2) return waypoints;

  const depot = { ...waypoints[0] };
  const clients = waypoints.slice(1);

  // Helper to evaluate a specific permutation's cost
  const evaluateSequence = (seq: DeliveryWaypoint[]): { cost: number; sched: DeliveryWaypoint[] } => {
    const fullSeq = [depot, ...seq];
    const scheduled = calculateSchedule(fullSeq, departureTimeStr, speedKmh);
    
    let totalDist = 0;
    let twViolationsCount = 0;
    let lateMinsTotal = 0;

    for (let i = 0; i < scheduled.length - 1; i++) {
      totalDist += calculateDistance(
        scheduled[i].latitude,
        scheduled[i].longitude,
        scheduled[i].latitude,
        scheduled[i].longitude
      );
    }

    scheduled.forEach((wp) => {
      if (wp.twStatus === "late" && wp.arrivalTime && wp.timeWindowEnd) {
        twViolationsCount++;
        const arrVal = timeStringToMinutes(wp.arrivalTime);
        const endVal = timeStringToMinutes(wp.timeWindowEnd);
        lateMinsTotal += Math.max(0, arrVal - endVal);
      }
    });

    // Cost Function: Total Distance + heavy penalty for TW violations and severity
    const cost = totalDist * 1.5 + twViolationsCount * 800 + lateMinsTotal * 12;
    return { cost, sched: scheduled };
  };

  // If clients are small, do complete search: Permutations
  if (clients.length <= 7) {
    let bestSeq = [...clients];
    let minCost = evaluateSequence(bestSeq).cost;

    const permute = (arr: DeliveryWaypoint[], m: DeliveryWaypoint[] = []) => {
      if (arr.length === 0) {
        const { cost } = evaluateSequence(m);
        if (cost < minCost) {
          minCost = cost;
          bestSeq = [...m];
        }
      } else {
        for (let i = 0; i < arr.length; i++) {
          const curr = arr.slice();
          const next = curr.splice(i, 1);
          permute(curr.slice(), m.concat(next));
        }
      }
    };

    permute(clients);
    const optimized = [depot, ...bestSeq];
    return calculateSchedule(optimized, departureTimeStr, speedKmh);
  }

  // Otherwise, fallback on simulated local search (Hill-Climbing / 2-Opt hybrid heuristic)
  let bestSeq = [...clients];
  let bestEval = evaluateSequence(bestSeq);
  let bestCost = bestEval.cost;

  // Run 300 iterations of random mutations/swaps to find superior sequencing
  for (let iter = 0; iter < 400; iter++) {
    const nextSeq = [...bestSeq];
    // swap two random indices
    const idx1 = Math.floor(Math.random() * nextSeq.length);
    const idx2 = Math.floor(Math.random() * nextSeq.length);
    if (idx1 !== idx2) {
      const temp = nextSeq[idx1];
      nextSeq[idx1] = nextSeq[idx2];
      nextSeq[idx2] = temp;
    }

    const { cost } = evaluateSequence(nextSeq);
    if (cost < bestCost) {
      bestCost = cost;
      bestSeq = nextSeq;
    }
  }

  const optimized = [depot, ...bestSeq];
  return calculateSchedule(optimized, departureTimeStr, speedKmh);
}

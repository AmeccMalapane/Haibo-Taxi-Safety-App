import { TrafficIncident } from "./types";

const sampleIncidents: TrafficIncident[] = [
  {
    id: "inc_1",
    type: "accident",
    latitude: -26.1952,
    longitude: 28.0345,
    description: "Multi-vehicle accident on M1 North near Empire Rd. Expect heavy delays.",
    reportedAt: new Date().toISOString(),
    severity: "high",
  },
  {
    id: "inc_2",
    type: "construction",
    latitude: -26.2120,
    longitude: 28.0510,
    description: "Road maintenance on Commissioner St. Lane closures in effect.",
    reportedAt: new Date().toISOString(),
    severity: "medium",
  },
  {
    id: "inc_3",
    type: "hazard",
    latitude: -26.2005,
    longitude: 28.0420,
    description: "Debris on road near Bree St Taxi Rank. Proceed with caution.",
    reportedAt: new Date().toISOString(),
    severity: "medium",
  },
  {
    id: "inc_4",
    type: "police",
    latitude: -26.2085,
    longitude: 28.0380,
    description: "Active police checkpoint on Sauer St.",
    reportedAt: new Date().toISOString(),
    severity: "low",
  },
  {
    id: "inc_5",
    type: "congestion",
    latitude: -26.1880,
    longitude: 28.0450,
    description: "Heavy congestion on Joe Slovo Dr due to broken down vehicle.",
    reportedAt: new Date().toISOString(),
    severity: "medium",
  },
];

export const getTrafficIncidents = (): TrafficIncident[] => {
  return sampleIncidents;
};

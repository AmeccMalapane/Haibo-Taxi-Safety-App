-- Rollback for 0005_fare_imports.sql
--
-- Drops route_demand_signals and fare_imports along with the inline
-- indexes (indexes are dropped implicitly with the table).
--
-- Safe on live data ONLY if the fare-sync harvester is not running and
-- no approved rows have been promoted into taxi_fares via taxi_fare_id
-- — dropping fare_imports will NOT cascade into taxi_fares because that
-- FK is opportunistic (no REFERENCES constraint), but you will lose the
-- provenance trail linking an approved taxi_fares row back to its
-- source post. Export fare_imports first if provenance matters.
--
-- Drop order: route_demand_signals first (no dependencies either way),
-- then fare_imports. Neither table is referenced by other tables.

BEGIN;

DROP TABLE IF EXISTS route_demand_signals;
DROP TABLE IF EXISTS fare_imports;

COMMIT;

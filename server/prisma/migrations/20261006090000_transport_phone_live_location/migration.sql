CREATE TABLE "transport_trip_live_locations" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "driver_user_id" TEXT NOT NULL,
    "vehicle_id" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy_meters" DOUBLE PRECISION,
    "speed_mps" DOUBLE PRECISION,
    "heading_degrees" DOUBLE PRECISION,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "transport_trip_live_locations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "transport_trip_live_locations_trip_id_key" ON "transport_trip_live_locations"("trip_id");
CREATE INDEX "transport_trip_live_locations_driver_user_id_idx" ON "transport_trip_live_locations"("driver_user_id");
CREATE INDEX "transport_trip_live_locations_captured_at_idx" ON "transport_trip_live_locations"("captured_at");

ALTER TABLE "transport_trip_live_locations"
ADD CONSTRAINT "transport_trip_live_locations_trip_id_fkey"
FOREIGN KEY ("trip_id") REFERENCES "transport_trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
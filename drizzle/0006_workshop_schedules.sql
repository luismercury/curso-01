CREATE TABLE "workshop_schedules" (
	"day_of_week" smallint PRIMARY KEY NOT NULL,
	"open_intervals" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workshop_schedules_day_of_week_check" CHECK ("day_of_week" BETWEEN 0 AND 6)
);

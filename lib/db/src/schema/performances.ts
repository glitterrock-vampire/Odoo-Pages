import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const performancesTable = pgTable("performances", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  date: text("date").notNull(),
  time: text("time"),
  venue: text("venue").notNull(),
  description: text("description"),
  status: text("status").notNull().default("upcoming"),
  ticketPrice: text("ticket_price"),
  capacity: integer("capacity"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const performanceClassesTable = pgTable("performance_classes", {
  performanceId: integer("performance_id")
    .notNull()
    .references(() => performancesTable.id, { onDelete: "cascade" }),
  classId: integer("class_id").notNull(),
});

export const insertPerformanceSchema = createInsertSchema(performancesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertPerformance = z.infer<typeof insertPerformanceSchema>;
export type Performance = typeof performancesTable.$inferSelect;

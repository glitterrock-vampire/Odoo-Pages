import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const studentsTable = pgTable("students", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  dateOfBirth: text("date_of_birth"),
  status: text("status").notNull().default("active"),
  guardianName: text("guardian_name"),
  guardianPhone: text("guardian_phone"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const classesTable = pgTable("classes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  style: text("style").notNull(),
  instructor: text("instructor").notNull(),
  schedule: text("schedule").notNull(),
  location: text("location").notNull(),
  capacity: integer("capacity").notNull().default(20),
  status: text("status").notNull().default("active"),
  description: text("description"),
  ageGroup: text("age_group"),
  fee: text("fee"), // store as string to avoid precision issues
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const studentClassesTable = pgTable("student_classes", {
  studentId: integer("student_id")
    .notNull()
    .references(() => studentsTable.id, { onDelete: "cascade" }),
  classId: integer("class_id")
    .notNull()
    .references(() => classesTable.id, { onDelete: "cascade" }),
});

export const insertStudentSchema = createInsertSchema(studentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof studentsTable.$inferSelect;

export const insertClassSchema = createInsertSchema(classesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertClass = z.infer<typeof insertClassSchema>;
export type DanceClass = typeof classesTable.$inferSelect;

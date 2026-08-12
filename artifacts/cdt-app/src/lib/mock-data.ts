// Mock data for Vercel deployment without backend
import type { DashboardStats, AttendanceSnapshot } from "@workspace/api-client-react";

export const mockDashboardStats: DashboardStats = {
  totalStudents: 156,
  activeClasses: 12,
  upcomingPerformances: 3,
  odooConfigured: true,
  totalDonations: 12500,
  openTasks: 8,
  monthlyRevenue: 45000,
  pendingInvoices: 23,
  newContactsThisMonth: 15,
  feesBilled: 67800,
  feesCollected: 54200,
  feesOutstanding: 13600,
  unbilledFees: 8500,
  overdueFeesCount: 5,
  currency: "JMD",
  paymentProviderName: "Stripe",
  paymentProviderState: "test",
  paymentJournalName: "Bank of Jamaica",
  teamMembers: 7,
  repertoireItems: 45,
  totalPerformances: 28,
  mediaItems: 120,
  contentLastSyncAt: new Date().toISOString(),
  contentSyncStatus: "success",
};

export const mockAttendanceSnapshot: AttendanceSnapshot = {
  generatedAt: new Date().toISOString(),
  summary: {
    total: 142,
    present: 135,
    late: 5,
    absent: 2,
    leave: 0,
    excused: 0,
    attendanceRate: 95.1,
    todayTotal: 142,
    todayPresent: 135,
    todayLate: 5,
    todayAbsent: 2,
    todayRate: 95.1,
  },
  records: [
    { id: 1, date: "2024-08-10", studentId: 1, studentName: "Emma Thompson", groupId: 1, groupName: "Ballet", courseId: 1, courseName: "Ballet Intermediate", scheduleId: 1, scheduleName: "Ballet Intermediate", status: "present", minutesLate: 0, earlyDepartureMinutes: 0, checkIn: "16:00", checkOut: "17:30", remarks: null },
    { id: 2, date: "2024-08-10", studentId: 2, studentName: "James Wilson", groupId: 2, groupName: "Contemporary", courseId: 2, courseName: "Contemporary", scheduleId: 2, scheduleName: "Contemporary", status: "present", minutesLate: 0, earlyDepartureMinutes: 0, checkIn: "18:00", checkOut: "19:30", remarks: null },
    { id: 3, date: "2024-08-10", studentId: 3, studentName: "Sophia Chen", groupId: 3, groupName: "Jazz", courseId: 3, courseName: "Jazz", scheduleId: 3, scheduleName: "Jazz", status: "late", minutesLate: 5, earlyDepartureMinutes: 0, checkIn: "18:05", checkOut: "19:30", remarks: null },
  ],
};

export const mockStudents = [
  {
    id: "1",
    name: "Emma Thompson",
    email: "emma.thompson@example.com",
    phone: "+1 876-555-0101",
    status: "active",
    enrollmentDate: "2024-01-15",
    class: "Ballet Intermediate",
  },
  {
    id: "2",
    name: "James Wilson",
    email: "james.wilson@example.com",
    phone: "+1 876-555-0102",
    status: "active",
    enrollmentDate: "2024-02-01",
    class: "Contemporary",
  },
  {
    id: "3",
    name: "Sophia Chen",
    email: "sophia.chen@example.com",
    phone: "+1 876-555-0103",
    status: "active",
    enrollmentDate: "2024-03-10",
    class: "Jazz",
  },
];

export const mockClasses = [
  {
    id: "1",
    name: "Ballet Beginners",
    instructor: "Sarah Johnson",
    schedule: "Mon/Wed 4:00 PM",
    capacity: 20,
    enrolled: 18,
    level: "beginner",
  },
  {
    id: "2",
    name: "Ballet Intermediate",
    instructor: "Maria Garcia",
    schedule: "Tue/Thu 5:00 PM",
    capacity: 25,
    enrolled: 23,
    level: "intermediate",
  },
  {
    id: "3",
    name: "Contemporary",
    instructor: "David Kim",
    schedule: "Wed/Fri 6:00 PM",
    capacity: 15,
    enrolled: 15,
    level: "intermediate",
  },
];

// Mock API response function
export async function mockApiCall<T>(endpoint: string, data?: T): Promise<T> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));

  switch (endpoint) {
    case "/api/dashboard/stats":
      return mockDashboardStats as T;
    case "/api/attendance":
      return mockAttendanceSnapshot as T;
    case "/api/students":
      return mockStudents as T;
    case "/api/classes":
      return mockClasses as T;
    default:
      throw new Error(`Mock endpoint not found: ${endpoint}`);
  }
}

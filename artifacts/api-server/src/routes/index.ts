import { Router, type IRouter } from "express";
import healthRouter from "./health";
import studentsRouter from "./students";
import classesRouter from "./classes";
import contactsRouter from "./contacts";
import donationsRouter from "./donations";
import financesRouter from "./finances";
import performancesRouter from "./performances";
import tasksRouter from "./tasks";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";
import contentRouter from "./content";
import tuitionRouter from "./tuition";
import engagementRouter from "./engagement";
import attendanceRouter from "./attendance";

const router: IRouter = Router();

router.use(healthRouter);
router.use(studentsRouter);
router.use(classesRouter);
router.use(contactsRouter);
router.use(donationsRouter);
router.use(financesRouter);
router.use(performancesRouter);
router.use(tasksRouter);
router.use(dashboardRouter);
router.use(reportsRouter);
router.use(contentRouter);
router.use(tuitionRouter);
router.use(engagementRouter);
router.use(attendanceRouter);

export default router;

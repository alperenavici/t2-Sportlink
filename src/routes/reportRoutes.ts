import express from 'express';
import { ReportController } from '../controllers/ReportController';
import { authenticate } from '../middlewares/authMiddleware';

const router = express.Router();

// 1. Ana rotalar (spesifik path'ler)
// Yeni bir rapor oluşturur
router.post('/', authenticate, ReportController.createReport);

// Tüm raporları sayfalanmış olarak getirir (Admin/SuperAdmin)
router.get('/', authenticate, ReportController.getAllReports);

// 2. Sabit path'li rotalar
// Kullanıcının kendi raporlarını getirir
router.get('/me', authenticate, ReportController.getMyReports);

// Belirli bir etkinlik için yapılan raporları getirir
router.get('/events/:event_id', authenticate, ReportController.getReportsByEventId);

// Kullanıcı hakkında yapılan raporları getirir
router.get('/users/:user_id', authenticate, ReportController.getReportsByUserId);

// 3. Dinamik ID path'li rotalar (en sonda olmalı)
// Rapor durumunu günceller (admin/superadmin)
router.put('/:id', authenticate, ReportController.updateReportStatus);

// Belirli bir raporu ID'ye göre getirir
router.get('/:id', authenticate, ReportController.getReportById);

export default router; 
import { Router } from 'express';
import { authenticate, isSuperAdmin } from '../middlewares/authMiddleware';
import { SuperAdminController } from '../controllers/superAdminController';

const router = Router();

/**
 * SuperAdmin dashboard ve bilgi endpointleri
 */
// SuperAdmin durumunu kontrol et (UI için)
router.get('/check-status', authenticate, SuperAdminController.checkSuperAdminStatus);

// Dashboard için özet bilgileri getir
router.get('/dashboard', authenticate, isSuperAdmin, SuperAdminController.getDashboardInfo);

/**
 * Admin yönetimi endpointleri
 */
// Tüm admin kullanıcılarını listele
router.get('/admins', authenticate, isSuperAdmin, SuperAdminController.getAllAdmins);

// Yeni admin kullanıcısı oluştur
router.post('/admins', authenticate, isSuperAdmin, SuperAdminController.createAdmin);

// Admin kullanıcısını etkisizleştir
router.put('/admins/:adminId/deactivate', authenticate, isSuperAdmin, SuperAdminController.deactivateAdmin);

export default router; 
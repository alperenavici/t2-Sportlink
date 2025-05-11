import { Router } from 'express';
import {
    getAllAnnouncements,
    getActiveAnnouncements,
    getAnnouncementById,
    getAnnouncementBySlug
} from '../controllers/announcementController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

/**
 * @route   GET /api/announcements
 * @desc    Tüm duyuruları listeler (sayfalı)
 * @access  Public (Admin isteğe bağlı olarak yayınlanmamış duyuruları da görebilir)
 */
router.get('/', authenticate, getAllAnnouncements);

/**
 * @route   GET /api/announcements/active
 * @desc    Aktif olan duyuruları listeler
 * @access  Public
 */
router.get('/active', getActiveAnnouncements);

/**
 * @route   GET /api/announcements/id/:announcementId
 * @desc    Belirli bir duyuruyu ID ile görüntüler
 * @access  Public (Yayınlanmış olanlar) / Private (Yayınlanmamış olanlar için admin)
 */
router.get('/id/:announcementId', authenticate, getAnnouncementById);

/**
 * @route   GET /api/announcements/:slug
 * @desc    Belirli bir duyuruyu slug ile görüntüler
 * @access  Public (Yayınlanmış olanlar) / Private (Yayınlanmamış olanlar için admin)
 */
router.get('/:slug', authenticate, getAnnouncementBySlug);

export default router;

import { Router } from 'express';
import { AdminController } from '../controllers/adminController';
import { AdminNewsController } from '../controllers/adminNewsController';
import {
    getAdminAnnouncements,
    createAnnouncement,
    getAnnouncementById,
    updateAnnouncement,
    deleteAnnouncement,
    publishAnnouncement,
    unpublishAnnouncement
} from '../controllers/announcementController';
import { authenticate } from '../middlewares/authMiddleware';
import { adminOnly } from '../middlewares/adminMiddleware';

const router = Router();

// Bütün admin rotaları için authentication ve admin kontrolü
router.use(authenticate, adminOnly);

// ETKİNLİK YÖNETİMİ

// Onay bekleyen etkinlikleri listele
router.get('/events/pending', AdminController.getPendingEvents);

// Etkinlik onaylama/reddetme
router.put('/events/:eventId/approve-reject', AdminController.approveOrRejectEvent);

// Filtreli etkinlik listesi (admin paneli için)
router.get('/events/filter', AdminController.getFilteredEvents);

// HABER YÖNETİMİ

// Tüm haberleri listele (yönetim paneli için)
router.get('/news', AdminNewsController.getAllNews);

// Yeni haber oluştur
router.post('/news', AdminNewsController.createNews);

// Haber düzenle
router.put('/news/:newsId', AdminNewsController.updateNews);

// Haber sil
router.delete('/news/:newsId', AdminNewsController.deleteNews);

// Spor dallarını listele (haber oluşturma/düzenleme için)
router.get('/sports', AdminNewsController.getSports);

// Manuel haber çekme işlemini başlat
router.post('/news/scrape', AdminController.runNewsScraper);

// DUYURU YÖNETİMİ

// Tüm duyuruları listele (yönetim paneli için)
router.get('/announcements', getAdminAnnouncements);

// Yeni duyuru oluştur
router.post('/announcements', createAnnouncement);

// Duyuru detayını görüntüle
router.get('/announcements/:announcementId', getAnnouncementById);

// Duyuru güncelle
router.put('/announcements/:announcementId', updateAnnouncement);

// Duyuru sil
router.delete('/announcements/:announcementId', deleteAnnouncement);

// Duyuruyu yayınla
router.put('/announcements/:announcementId/publish', publishAnnouncement);

// Duyuruyu yayından kaldır
router.put('/announcements/:announcementId/unpublish', unpublishAnnouncement);

export default router; 
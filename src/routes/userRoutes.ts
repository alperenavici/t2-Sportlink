import { Router } from 'express';
import { authenticate, isUser, isAdmin, isSuperAdmin, isResourceOwner } from '../middlewares/authMiddleware';
import { userController } from '../controllers/userController';
import multer from 'multer';

// Multer ayarları - geçici olarak bellek depolaması kullanıyoruz
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Sadece resim dosyalarını kabul et
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Sadece resim dosyaları yüklenebilir!'));
    }
  }
});

const router = Router();

/**
 * Kullanıcı profil yönetimi
 */
// Kendi profilini görüntüle
router.get('/profile', authenticate, isUser, userController.getProfile);

// Profili güncelle
router.put('/profile', authenticate, isUser, userController.updateProfile);

// Profil fotoğrafı güncelle
router.put('/profile/avatar', authenticate, isUser, upload.single('avatar'), userController.updateProfilePicture);

// İlgilenilen spor dallarını güncelle
router.put('/profile/sports', authenticate, isUser, userController.updateSports);

// Başka bir kullanıcının profilini görüntüle
router.get('/:userId', authenticate, isUser, userController.getUserProfile);

/**
 * Kullanıcı yönetim endpointleri (Admin ve Superadmin erişimi)
 * Admin ve superadmin rolündeki kullanıcılar erişebilir
 */
// Tüm kullanıcıları listeleme (sadece admin ve superadmin)
router.get('/admin/users', authenticate, isAdmin, userController.getAllUsers);

// Belirli bir kullanıcıyı görüntüleme (sadece admin ve superadmin)
router.get('/admin/users/:userId', authenticate, isAdmin, userController.getUserById);

// Bir kullanıcının rolünü değiştirme (sadece admin ve superadmin)
router.put('/admin/users/:userId/role', authenticate, isAdmin, userController.changeUserRole);

// Kullanıcı silme (sadece admin ve superadmin)
router.delete('/admin/users/:userId', authenticate, isAdmin, userController.deleteUser);

// Kullanıcının oluşturduğu etkinlikleri listeleme (sadece admin ve superadmin)
router.get('/admin/users/:userId/created-events', authenticate, isAdmin, userController.getUserCreatedEvents);

// Kullanıcının katıldığı etkinlikleri listeleme (sadece admin ve superadmin)
router.get('/admin/users/:userId/participated-events', authenticate, isAdmin, userController.getUserParticipatedEvents);

/**
 * SuperAdmin özel işlemleri
 * Sadece superadmin rolündeki kullanıcılar erişebilir
 */
// Admin kullanıcıları yönetme (sadece superadmin)
router.get('/superadmin/admins', authenticate, isSuperAdmin, (req, res) => {
  // SuperAdmin tüm admin kullanıcılarını listeliyor
  // Controller fonksiyonu burada çağrılacak
  return res.json({
    success: true,
    message: 'Tüm admin kullanıcılarını listeleme endpointi (SuperAdmin erişimi)'
  });
});

// Sistem ayarlarını değiştirme (sadece superadmin)
router.put('/superadmin/settings', authenticate, isSuperAdmin, (req, res) => {
  // SuperAdmin sistem ayarlarını değiştiriyor
  // Controller fonksiyonu burada çağrılacak
  return res.json({
    success: true,
    message: 'Sistem ayarlarını değiştirme endpointi (SuperAdmin erişimi)'
  });
});

/**
 * Resource Owner örneği
 * Kullanıcılar sadece kendi kaynakları üzerinde işlem yapabilir
 * Admin ve superadmin tüm kaynaklara erişebilir
 */
router.get('/users/:userId/details', authenticate, isResourceOwner('userId'), (req, res) => {
  // Kullanıcı kendi detaylarına erişiyor veya admin/superadmin herhangi bir kullanıcının detaylarına erişiyor
  return res.json({
    success: true,
    message: `${req.params.userId} ID'li kullanıcı detayları (Kaynak sahibi veya admin erişimi)`
  });
});

export default router; 
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import eventRoutes from './routes/eventRoutes';
import friendRoutes from './routes/friendRoutes';
import reportRoutes from './routes/reportRoutes';
import newsRoutes from './routes/newsRoutes';
import adminRoutes from './routes/adminRoutes';
import announcementRoutes from './routes/announcementRoutes';
import superAdminRoutes from './routes/superAdminRoutes';
import { authenticate, isAdmin } from './middlewares/authMiddleware';

// Haber çekme zamanlayıcısını import et
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_SCRAPER === 'true') {
  console.log('Haber çekme zamanlayıcısı yükleniyor...');
  import('./scripts/scheduledScraper')
    .then(() => console.log('Haber çekme zamanlayıcısı başarıyla başlatıldı'))
    .catch(err => console.error('Haber çekme zamanlayıcısı başlatılamadı:', err));
}

// Çevre değişkenlerini yükle
dotenv.config();

// Express uygulamasını oluştur
const app = express();

// Temel Middleware
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  limit: 100, // IP başına istek limiti
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
app.use(limiter);

// Ana rota
app.get('/', (_: Request, res: Response) => {
  res.json({
    success: true,
    message: 'SportLink API çalışıyor!',
    version: '1.0.0'
  });
});

// Auth rotaları - herkes erişebilir
app.use('/api/auth', authRoutes);

// Bundan sonraki tüm API rotaları sadece admin ve superadmin erişimi için
// Admin kontrolü middleware - tüm API rotalarını koruyoruz
const adminRouteProtection = [authenticate, isAdmin];

// Korumalı API rotalarını bağla
app.use('/api/users', adminRouteProtection, userRoutes);
app.use('/api/events', adminRouteProtection, eventRoutes);
app.use('/api/friends', adminRouteProtection, friendRoutes);
app.use('/api/reports', adminRouteProtection, reportRoutes);
app.use('/api/news', adminRouteProtection, newsRoutes);
app.use('/api/admin', adminRouteProtection, adminRoutes);
app.use('/api/announcements', adminRouteProtection, announcementRoutes);
app.use('/api/superadmin', adminRouteProtection, superAdminRoutes);

// 404 handler
app.use((_: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint bulunamadı',
    code: 'NOT_FOUND'
  });
});

// Hata işleyici
app.use((err: any, _: Request, res: Response, __: NextFunction) => {
  console.error('Sunucu hatası:', err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Sunucu hatası oluştu',
    code: err.code || 'SERVER_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server http://localhost:${PORT} adresinde çalışıyor`);
});

export default app;

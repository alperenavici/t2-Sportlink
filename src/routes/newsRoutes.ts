import express from 'express';
import * as newsController from '../controllers/newsController';
import { authenticate } from '../middlewares/authMiddleware';

const router = express.Router();

/**
 * @route   GET /api/news
 * @desc    Tüm haberleri listeler (sayfalı)
 * @access  Public
 */
router.get('/', newsController.getAllNews);

/**
 * @route   GET /api/news/search
 * @desc    Haber arama
 * @access  Public
 */
router.get('/search', newsController.searchNews);

/**
 * @route   GET /api/news/latest
 * @desc    En son haberleri listeler
 * @access  Public
 */
router.get('/latest', newsController.getLatestNews);

/**
 * @route   GET /api/news/sports/:sportId
 * @desc    Spor dalına göre haberleri listeler
 * @access  Public
 */
router.get('/sports/:sportId', newsController.getNewsBySport);

/**
 * @route   GET /api/news/:newsId
 * @desc    Haber detayını görüntüler
 * @access  Public
 */
router.get('/:newsId', newsController.getNewsById);

/**
 * @route   DELETE /api/news/:newsId
 * @desc    Haberi siler
 * @access  Private (Admin, SuperAdmin)
 */
router.delete('/:newsId', authenticate, newsController.deleteNews);

export default router; 
import { Request, Response, NextFunction } from 'express';
import { News } from '../models/News';
import prisma from '../config/prisma';
import { z } from 'zod';

/**
 * Admin ve superadmin için haber yönetim fonksiyonları
 */
export class AdminNewsController {
    /**
     * Tüm haberleri yönetim paneli için listeler
     */
    static async getAllNews(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const skip = (page - 1) * limit;

            // Sorgu parametreleri
            const sportId = req.query.sportId as string;
            const keyword = req.query.keyword as string;

            // Filtreleme koşullarını oluştur
            let where: any = {};

            if (sportId) {
                where.sport_id = sportId;
            }

            if (keyword) {
                where.OR = [
                    { title: { contains: keyword, mode: 'insensitive' } },
                    { content: { contains: keyword, mode: 'insensitive' } }
                ];
            }

            // Haberleri getir
            const news = await News.findMany({
                skip,
                take: limit,
                where,
                orderBy: { created_at: 'desc' }
            });

            // Toplam sayıyı hesapla
            const totalCount = await prisma.news.count({ where });

            res.status(200).json({
                success: true,
                data: {
                    news,
                    pagination: {
                        page,
                        limit,
                        total: totalCount,
                        totalPages: Math.ceil(totalCount / limit)
                    }
                }
            });
            return;
        } catch (error: any) {
            next(error);
            return;
        }
    }

    /**
     * Yeni haber oluşturur
     */
    static async createNews(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            // Doğrulama
            const newsSchema = z.object({
                title: z.string().min(5, 'Başlık en az 5 karakter olmalıdır'),
                content: z.string().min(20, 'İçerik en az 20 karakter olmalıdır'),
                source_url: z.string().url('Geçerli bir URL giriniz'),
                image_url: z.string().url('Geçerli bir görsel URL giriniz'),
                published_date: z.string().refine(val => !isNaN(Date.parse(val)), {
                    message: 'Geçerli bir tarih giriniz',
                }),
                sport_id: z.string().uuid('Geçerli bir spor ID giriniz')
            });

            const validationResult = newsSchema.safeParse(req.body);
            if (!validationResult.success) {
                res.status(400).json({
                    success: false,
                    message: 'Geçersiz veri formatı',
                    errors: validationResult.error.format()
                });
                return;
            }

            const data = validationResult.data;

            // Spor dalının var olup olmadığını kontrol et
            const sport = await prisma.sport.findUnique({
                where: { id: data.sport_id }
            });

            if (!sport) {
                res.status(404).json({
                    success: false,
                    message: 'Belirtilen spor dalı bulunamadı'
                });
                return;
            }

            // Haberi oluştur
            const news = await News.create({
                title: data.title,
                content: data.content,
                source_url: data.source_url,
                image_url: data.image_url,
                published_date: new Date(data.published_date),
                sport: { connect: { id: data.sport_id } }
            });

            // Admin log kaydı
            await prisma.admin_log.create({
                data: {
                    admin_id: req.user.id,
                    action_type: 'create_news',
                    description: `"${data.title}" başlıklı haber oluşturuldu`
                }
            });

            res.status(201).json({
                success: true,
                message: 'Haber başarıyla oluşturuldu',
                data: { news }
            });
            return;
        } catch (error: any) {
            next(error);
            return;
        }
    }

    /**
     * Haber düzenler
     */
    static async updateNews(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { newsId } = req.params;

            // Haberin var olup olmadığını kontrol et
            const existingNews = await News.findUnique({ id: newsId });

            if (!existingNews) {
                res.status(404).json({
                    success: false,
                    message: 'Haber bulunamadı'
                });
                return;
            }

            // Doğrulama
            const newsSchema = z.object({
                title: z.string().min(5, 'Başlık en az 5 karakter olmalıdır').optional(),
                content: z.string().min(20, 'İçerik en az 20 karakter olmalıdır').optional(),
                source_url: z.string().url('Geçerli bir URL giriniz').optional(),
                image_url: z.string().url('Geçerli bir görsel URL giriniz').optional(),
                published_date: z.string().refine(val => !isNaN(Date.parse(val)), {
                    message: 'Geçerli bir tarih giriniz',
                }).optional(),
                sport_id: z.string().uuid('Geçerli bir spor ID giriniz').optional()
            });

            const validationResult = newsSchema.safeParse(req.body);
            if (!validationResult.success) {
                res.status(400).json({
                    success: false,
                    message: 'Geçersiz veri formatı',
                    errors: validationResult.error.format()
                });
                return;
            }

            const data = validationResult.data;

            // Spor dalının var olup olmadığını kontrol et (eğer spor değişiyorsa)
            if (data.sport_id) {
                const sport = await prisma.sport.findUnique({
                    where: { id: data.sport_id }
                });

                if (!sport) {
                    res.status(404).json({
                        success: false,
                        message: 'Belirtilen spor dalı bulunamadı'
                    });
                    return;
                }
            }

            // Haberi güncelle
            const updatedNews = await News.update(
                { id: newsId },
                {
                    ...data,
                    ...(data.published_date && { published_date: new Date(data.published_date) }),
                    ...(data.sport_id && { sport: { connect: { id: data.sport_id } } })
                }
            );

            // Admin log kaydı
            await prisma.admin_log.create({
                data: {
                    admin_id: req.user.id,
                    action_type: 'update_news',
                    description: `"${existingNews.title}" başlıklı haber güncellendi`
                }
            });

            res.status(200).json({
                success: true,
                message: 'Haber başarıyla güncellendi',
                data: { news: updatedNews }
            });
            return;
        } catch (error: any) {
            next(error);
            return;
        }
    }

    /**
     * Haber siler
     */
    static async deleteNews(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { newsId } = req.params;

            // Haberin var olup olmadığını kontrol et
            const existingNews = await News.findUnique({ id: newsId });

            if (!existingNews) {
                res.status(404).json({
                    success: false,
                    message: 'Haber bulunamadı'
                });
                return;
            }

            // Haberi sil
            await News.delete({ id: newsId });

            // Admin log kaydı
            await prisma.admin_log.create({
                data: {
                    admin_id: req.user.id,
                    action_type: 'delete_news',
                    description: `"${existingNews.title}" başlıklı haber silindi`
                }
            });

            res.status(200).json({
                success: true,
                message: 'Haber başarıyla silindi'
            });
            return;
        } catch (error: any) {
            next(error);
            return;
        }
    }

    /**
     * Spor dallarını listeler (haber oluşturma/düzenleme için)
     */
    static async getSports(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const sports = await prisma.sport.findMany({
                orderBy: { name: 'asc' }
            });

            res.status(200).json({
                success: true,
                data: { sports }
            });
            return;
        } catch (error: any) {
            next(error);
            return;
        }
    }
} 
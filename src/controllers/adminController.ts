import { Request, Response, NextFunction } from 'express';
import { Event } from '../models/Event';
import prisma from '../config/prisma';
import { z } from 'zod';
import { scrapeNews } from '../scripts/newsScraper';
import { scrapeSporx } from '../scripts/sporxScraper';
import { scrapeKonyasporNews } from '../scripts/konyasporScraper';

/**
 * Admin paneli için gerekli controller fonksiyonları
 */
export class AdminController {
    /**
     * Onay bekleyen etkinlikleri listeler
     */
    static async getPendingEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const skip = (page - 1) * limit;

            // Onay bekleyen etkinlikleri getir
            const pendingEvents = await Event.findMany({
                skip,
                take: limit,
                where: {
                    status: 'pending'
                },
                orderBy: { created_at: 'desc' }
            });

            // Toplam sayıyı hesapla
            const totalCount = await prisma.event.count({
                where: { status: 'pending' }
            });

            res.status(200).json({
                success: true,
                data: {
                    events: pendingEvents,
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
     * Bir etkinliği onaylar veya reddeder
     */
    static async approveOrRejectEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { eventId } = req.params;

            // Doğrulama
            const schema = z.object({
                status: z.enum(['active', 'canceled']),
                rejection_reason: z.string().optional()
            });

            const validationResult = schema.safeParse(req.body);
            if (!validationResult.success) {
                res.status(400).json({
                    success: false,
                    message: 'Geçersiz veri formatı',
                    errors: validationResult.error.format()
                });
                return;
            }

            const { status, rejection_reason } = validationResult.data;

            // Etkinliğin var olup olmadığını kontrol et
            const event = await Event.findUnique({ id: eventId });

            if (!event) {
                res.status(404).json({
                    success: false,
                    message: 'Etkinlik bulunamadı'
                });
                return;
            }

            // Etkinlik zaten onaylanmış veya reddedilmiş mi kontrol et
            if (event.status !== 'pending') {
                res.status(400).json({
                    success: false,
                    message: 'Bu etkinlik zaten onaylanmış veya reddedilmiş'
                });
                return;
            }

            // Etkinliği güncelle
            const updatedEvent = await Event.update(
                { id: eventId },
                {
                    status,
                    // Eğer red nedeni varsa ve status canceled ise, açıklamayı ekle
                    ...(status === 'canceled' && rejection_reason
                        ? { rejection_reason }
                        : {})
                }
            );

            // Bildirim gönderme işlemi burada eklenebilir (etkinlik sahibine)

            res.status(200).json({
                success: true,
                message: status === 'active'
                    ? 'Etkinlik başarıyla onaylandı'
                    : 'Etkinlik reddedildi',
                data: {
                    event: updatedEvent
                }
            });
            return;
        } catch (error: any) {
            next(error);
            return;
        }
    }

    /**
     * Filtreli etkinlik listesi (adminler için)
     */
    static async getFilteredEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const skip = (page - 1) * limit;

            // Sorgu parametreleri
            const status = req.query.status as string;
            const title = req.query.title as string;
            const startDate = req.query.startDate as string;
            const endDate = req.query.endDate as string;
            const sportId = req.query.sportId as string;

            // Filtreleme koşullarını oluştur
            let where: any = {};

            if (status) {
                where.status = status;
            }

            if (title) {
                where.title = {
                    contains: title,
                    mode: 'insensitive' // Case-insensitive arama
                };
            }

            if (startDate && endDate) {
                where.event_date = {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                };
            } else if (startDate) {
                where.event_date = {
                    gte: new Date(startDate)
                };
            } else if (endDate) {
                where.event_date = {
                    lte: new Date(endDate)
                };
            }

            if (sportId) {
                where.sport_id = sportId;
            }

            // Etkinlikleri getir
            const events = await Event.findMany({
                skip,
                take: limit,
                where,
                orderBy: { created_at: 'desc' }
            });

            // Toplam sayıyı hesapla
            const totalCount = await prisma.event.count({ where });

            res.status(200).json({
                success: true,
                data: {
                    events,
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
     * Manuel olarak haber çekme işlemini başlatır
     */
    static async runNewsScraper(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            // Hangi scraperın çalıştırılacağını belirle
            const { source } = req.query;
            const userId = req.user.id;

            // İşlem başladı bilgisi
            res.status(200).json({
                success: true,
                message: 'Haber çekme işlemi başlatıldı. Bu işlem arka planda devam edecek.'
            });

            // Log kaydı
            await prisma.admin_log.create({
                data: {
                    admin_id: userId,
                    action_type: 'run_news_scraper',
                    description: `Manuel haber çekme işlemi başlatıldı (${source || 'tümü'})`
                }
            });

            // Asenkron olarak scraperleri çalıştır
            setTimeout(async () => {
                try {
                    if (!source || source === 'all') {
                        // Tüm scraperları çalıştır
                        await scrapeNews();
                    } else if (source === 'sporx') {
                        // Sadece Sporx
                        await scrapeSporx();
                    } else if (source === 'konyaspor') {
                        // Sadece Konyaspor
                        await scrapeKonyasporNews();
                    }

                    console.log(`${source || 'Tüm'} haber kaynakları için scraping tamamlandı`);

                    // Log kaydı ekle
                    await prisma.admin_log.create({
                        data: {
                            admin_id: userId,
                            action_type: 'scraper_completed',
                            description: `Haber çekme işlemi tamamlandı (${source || 'tümü'})`
                        }
                    });
                } catch (error) {
                    console.error('Manuel haber çekme işleminde hata:', error);

                    // Hata logu ekle
                    await prisma.admin_log.create({
                        data: {
                            admin_id: userId,
                            action_type: 'scraper_error',
                            description: `Haber çekme işleminde hata: ${error}`
                        }
                    }).catch(e => console.error('Log kaydederken hata:', e));
                }
            }, 100); // 100ms bekletme ile başlat (0 yerine)

            return;
        } catch (error: any) {
            next(error);
            return;
        }
    }
} 
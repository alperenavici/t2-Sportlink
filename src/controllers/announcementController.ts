import { Request, Response } from 'express';
import { Announcement } from '../models/Announcement';
import prisma from '../config/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

/**
 * Duyuruları listeler
 */
export const getAllAnnouncements = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const includeUnpublished = (req.query.includeUnpublished === 'true');

    // Admin kullanıcılar yayınlanmamış duyuruları da görebilir
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';

    // Parametreler
    const params = {
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { created_at: 'desc' as Prisma.SortOrder },
      includeUnpublished: isAdmin && includeUnpublished
    };

    // Duyuruları getir
    const announcements = await Announcement.findMany(params);

    // Toplam duyuru sayısını hesapla
    const whereClause = !isAdmin || !includeUnpublished ?
      {
        published: true,
        OR: [
          { start_date: null },
          { start_date: { lte: new Date() } }
        ],
        AND: [
          {
            OR: [
              { end_date: null },
              { end_date: { gte: new Date() } }
            ]
          }
        ]
      } : undefined;

    const total = await prisma.announcement.count({ where: whereClause });
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      data: {
        announcements,
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      }
    });
  } catch (error: any) {
    console.error('Duyuru listeleme hatası:', error);
    return res.status(500).json({
      success: false,
      message: 'Duyurular getirilirken bir hata oluştu',
      error: error.message
    });
  }
};

/**
 * Aktif duyuruları listeler
 */
export const getActiveAnnouncements = async (req: Request, res: Response) => {
  try {
    // Aktif duyuruları getir
    const announcements = await Announcement.findActive();

    return res.status(200).json({
      success: true,
      data: {
        announcements,
        count: announcements.length
      }
    });
  } catch (error: any) {
    console.error('Aktif duyuru listeleme hatası:', error);
    return res.status(500).json({
      success: false,
      message: 'Aktif duyurular getirilirken bir hata oluştu',
      error: error.message
    });
  }
};

/**
 * Duyuru detayını görüntüler
 */
export const getAnnouncementById = async (req: Request, res: Response) => {
  try {
    const { announcementId } = req.params;

    const announcement = await Announcement.findUnique({ id: announcementId });

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Duyuru bulunamadı'
      });
    }

    // Duyuru yayınlanmamışsa sadece admin kullanıcılar görebilir
    if (!announcement.published && req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Bu duyuruyu görüntüleme yetkiniz yok'
      });
    }

    // Duyuru tarihi kontrolü
    const now = new Date();

    if (announcement.published &&
      ((announcement.start_date && announcement.start_date > now) ||
        (announcement.end_date && announcement.end_date < now)) &&
      req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
      return res.status(404).json({
        success: false,
        message: 'Duyuru bulunamadı veya aktif değil'
      });
    }

    return res.status(200).json({
      success: true,
      data: { announcement }
    });
  } catch (error: any) {
    console.error('Duyuru detayı getirme hatası:', error);
    return res.status(500).json({
      success: false,
      message: 'Duyuru detayı getirilirken bir hata oluştu',
      error: error.message
    });
  }
};

/**
 * Duyuru detayını slug ile görüntüler
 */
export const getAnnouncementBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const announcement = await Announcement.findBySlug(slug);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Duyuru bulunamadı'
      });
    }

    // Duyuru yayınlanmamışsa sadece admin kullanıcılar görebilir
    if (!announcement.published && req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Bu duyuruyu görüntüleme yetkiniz yok'
      });
    }

    // Duyuru tarihi kontrolü
    const now = new Date();

    if (announcement.published &&
      ((announcement.start_date && announcement.start_date > now) ||
        (announcement.end_date && announcement.end_date < now)) &&
      req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
      return res.status(404).json({
        success: false,
        message: 'Duyuru bulunamadı veya aktif değil'
      });
    }

    return res.status(200).json({
      success: true,
      data: { announcement }
    });
  } catch (error: any) {
    console.error('Duyuru detayı getirme hatası:', error);
    return res.status(500).json({
      success: false,
      message: 'Duyuru detayı getirilirken bir hata oluştu',
      error: error.message
    });
  }
};

/**
 * [ADMIN] Admin paneli için tüm duyuruları getirir
 */
export const getAdminAnnouncements = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Sorgu parametreleri
    const published = req.query.published as string;
    const keyword = req.query.keyword as string;

    // Filtreleme koşullarını oluştur
    let where: any = {};

    if (published !== undefined) {
      where.published = published === 'true';
    }

    if (keyword) {
      where.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { content: { contains: keyword, mode: 'insensitive' } }
      ];
    }

    // Duyuruları getir
    const announcements = await Announcement.findMany({
      skip,
      take: limit,
      where,
      includeUnpublished: true,
      orderBy: { created_at: 'desc' }
    });

    // Toplam sayıyı hesapla
    const totalCount = await prisma.announcement.count({ where });

    return res.status(200).json({
      success: true,
      data: {
        announcements,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      }
    });
  } catch (error: any) {
    console.error('Admin duyuru listeleme hatası:', error);
    return res.status(500).json({
      success: false,
      message: 'Duyurular getirilirken bir hata oluştu',
      error: error.message
    });
  }
};

/**
 * [ADMIN] Yeni duyuru oluşturur
 */
export const createAnnouncement = async (req: Request, res: Response) => {
  try {
    // Doğrulama
    const announcementSchema = z.object({
      title: z.string().min(5, 'Başlık en az 5 karakter olmalıdır'),
      content: z.string().min(20, 'İçerik en az 20 karakter olmalıdır'),
      published: z.boolean().optional(),
      start_date: z.string().nullable().optional().refine((val) => {
        return val === null || val === undefined || !isNaN(Date.parse(val));
      }, {
        message: 'Geçerli bir başlangıç tarihi giriniz veya boş bırakınız',
      }),
      end_date: z.string().nullable().optional().refine((val) => {
        return val === null || val === undefined || !isNaN(Date.parse(val));
      }, {
        message: 'Geçerli bir bitiş tarihi giriniz veya boş bırakınız',
      })
    });

    const validationResult = announcementSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz veri formatı',
        errors: validationResult.error.format()
      });
    }

    const data = validationResult.data;

    // Slug oluştur
    const slug = await Announcement.generateUniqueSlug(data.title);

    // Duyuruyu oluştur
    const announcement = await Announcement.create({
      title: data.title,
      content: data.content,
      slug,
      published: data.published ?? false,
      start_date: data.start_date ? new Date(data.start_date) : null,
      end_date: data.end_date ? new Date(data.end_date) : null,
      creator: { connect: { id: req.user.id } }
    });

    // Admin log kaydı
    await prisma.admin_log.create({
      data: {
        admin_id: req.user.id,
        action_type: 'create_announcement',
        description: `"${data.title}" başlıklı duyuru oluşturuldu`
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Duyuru başarıyla oluşturuldu',
      data: { announcement }
    });
  } catch (error: any) {
    console.error('Duyuru oluşturma hatası:', error);
    return res.status(500).json({
      success: false,
      message: 'Duyuru oluşturulurken bir hata oluştu',
      error: error.message
    });
  }
};

/**
 * [ADMIN] Duyuru günceller
 */
export const updateAnnouncement = async (req: Request, res: Response) => {
  try {
    const { announcementId } = req.params;

    // Duyurunun var olup olmadığını kontrol et
    const existingAnnouncement = await Announcement.findUnique({ id: announcementId });

    if (!existingAnnouncement) {
      return res.status(404).json({
        success: false,
        message: 'Duyuru bulunamadı'
      });
    }

    // Doğrulama
    const announcementSchema = z.object({
      title: z.string().min(5, 'Başlık en az 5 karakter olmalıdır').optional(),
      content: z.string().min(20, 'İçerik en az 20 karakter olmalıdır').optional(),
      published: z.boolean().optional(),
      start_date: z.string().nullable().optional().refine((val) => {
        return val === null || val === undefined || !isNaN(Date.parse(val));
      }, {
        message: 'Geçerli bir başlangıç tarihi giriniz veya boş bırakınız',
      }),
      end_date: z.string().nullable().optional().refine((val) => {
        return val === null || val === undefined || !isNaN(Date.parse(val));
      }, {
        message: 'Geçerli bir bitiş tarihi giriniz veya boş bırakınız',
      })
    });

    const validationResult = announcementSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz veri formatı',
        errors: validationResult.error.format()
      });
    }

    const data = validationResult.data;

    // Eğer başlık değişmişse yeni slug oluştur
    let slug = existingAnnouncement.slug;
    if (data.title && data.title !== existingAnnouncement.title) {
      slug = await Announcement.generateUniqueSlug(data.title);
    }

    // Duyuruyu güncelle
    const updatedAnnouncement = await Announcement.update(
      { id: announcementId },
      {
        ...data,
        ...(data.title && { slug }),
        ...(data.start_date !== undefined && {
          start_date: data.start_date ? new Date(data.start_date) : null
        }),
        ...(data.end_date !== undefined && {
          end_date: data.end_date ? new Date(data.end_date) : null
        })
      }
    );

    // Admin log kaydı
    await prisma.admin_log.create({
      data: {
        admin_id: req.user.id,
        action_type: 'update_announcement',
        description: `"${existingAnnouncement.title}" başlıklı duyuru güncellendi`
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Duyuru başarıyla güncellendi',
      data: { announcement: updatedAnnouncement }
    });
  } catch (error: any) {
    console.error('Duyuru güncelleme hatası:', error);
    return res.status(500).json({
      success: false,
      message: 'Duyuru güncellenirken bir hata oluştu',
      error: error.message
    });
  }
};

/**
 * [ADMIN] Duyuru siler
 */
export const deleteAnnouncement = async (req: Request, res: Response) => {
  try {
    const { announcementId } = req.params;

    // Duyurunun var olup olmadığını kontrol et
    const existingAnnouncement = await Announcement.findUnique({ id: announcementId });

    if (!existingAnnouncement) {
      return res.status(404).json({
        success: false,
        message: 'Duyuru bulunamadı'
      });
    }

    // Duyuruyu sil
    await Announcement.delete({ id: announcementId });

    // Admin log kaydı
    await prisma.admin_log.create({
      data: {
        admin_id: req.user.id,
        action_type: 'delete_announcement',
        description: `"${existingAnnouncement.title}" başlıklı duyuru silindi`
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Duyuru başarıyla silindi'
    });
  } catch (error: any) {
    console.error('Duyuru silme hatası:', error);
    return res.status(500).json({
      success: false,
      message: 'Duyuru silinirken bir hata oluştu',
      error: error.message
    });
  }
};

/**
 * [ADMIN] Duyuruyu yayınlar
 */
export const publishAnnouncement = async (req: Request, res: Response) => {
  try {
    const { announcementId } = req.params;

    // Duyurunun var olup olmadığını kontrol et
    const existingAnnouncement = await Announcement.findUnique({ id: announcementId });

    if (!existingAnnouncement) {
      return res.status(404).json({
        success: false,
        message: 'Duyuru bulunamadı'
      });
    }

    // Duyuru zaten yayınlanmışsa hata döndür
    if (existingAnnouncement.published) {
      return res.status(400).json({
        success: false,
        message: 'Duyuru zaten yayınlanmış durumda'
      });
    }

    // Duyuruyu yayınla
    const publishedAnnouncement = await Announcement.publish(announcementId);

    // Admin log kaydı
    await prisma.admin_log.create({
      data: {
        admin_id: req.user.id,
        action_type: 'publish_announcement',
        description: `"${existingAnnouncement.title}" başlıklı duyuru yayınlandı`
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Duyuru başarıyla yayınlandı',
      data: { announcement: publishedAnnouncement }
    });
  } catch (error: any) {
    console.error('Duyuru yayınlama hatası:', error);
    return res.status(500).json({
      success: false,
      message: 'Duyuru yayınlanırken bir hata oluştu',
      error: error.message
    });
  }
};

/**
 * [ADMIN] Duyuruyu yayından kaldırır
 */
export const unpublishAnnouncement = async (req: Request, res: Response) => {
  try {
    const { announcementId } = req.params;

    // Duyurunun var olup olmadığını kontrol et
    const existingAnnouncement = await Announcement.findUnique({ id: announcementId });

    if (!existingAnnouncement) {
      return res.status(404).json({
        success: false,
        message: 'Duyuru bulunamadı'
      });
    }

    // Duyuru zaten yayından kaldırılmışsa hata döndür
    if (!existingAnnouncement.published) {
      return res.status(400).json({
        success: false,
        message: 'Duyuru zaten yayınlanmamış durumda'
      });
    }

    // Duyuruyu yayından kaldır
    const unpublishedAnnouncement = await Announcement.unpublish(announcementId);

    // Admin log kaydı
    await prisma.admin_log.create({
      data: {
        admin_id: req.user.id,
        action_type: 'unpublish_announcement',
        description: `"${existingAnnouncement.title}" başlıklı duyuru yayından kaldırıldı`
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Duyuru başarıyla yayından kaldırıldı',
      data: { announcement: unpublishedAnnouncement }
    });
  } catch (error: any) {
    console.error('Duyuru yayından kaldırma hatası:', error);
    return res.status(500).json({
      success: false,
      message: 'Duyuru yayından kaldırılırken bir hata oluştu',
      error: error.message
    });
  }
}; 
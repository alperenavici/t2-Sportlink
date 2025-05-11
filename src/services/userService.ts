import prisma from '../config/prisma';
import { supabase } from '../config/supabase';
import { Prisma } from '@prisma/client';
import { Express } from 'express';

interface ProfileUpdateData {
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  default_location_latitude?: number;
  default_location_longitude?: number;
}

interface SportUpdateData {
  sportId: string;
  skillLevel: string;
}

export const userService = {
  /**
   * Kullanıcı profil bilgilerini getirir
   */
  async getProfile(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          email: true,
          first_name: true,
          last_name: true,
          phone: true,
          profile_picture: true,
          default_location_latitude: true,
          default_location_longitude: true,
          role: true,
          created_at: true,
          user_sports: {
            include: {
              sport: true
            }
          }
        }
      });

      if (!user) {
        return {
          success: false,
          message: 'Kullanıcı bulunamadı',
          code: 'USER_NOT_FOUND'
        };
      }

      return {
        success: true,
        data: user
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Profil bilgileri alınırken bir hata oluştu',
        code: 'PROFILE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  },

  /**
   * Kullanıcı profil bilgilerini günceller
   */
  async updateProfile(userId: string, data: ProfileUpdateData) {
    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone,
          default_location_latitude: data.default_location_latitude,
          default_location_longitude: data.default_location_longitude,
        },
        select: {
          id: true,
          username: true,
          email: true,
          first_name: true,
          last_name: true,
          phone: true,
          profile_picture: true,
          default_location_latitude: true,
          default_location_longitude: true,
        }
      });

      return {
        success: true,
        message: 'Profil başarıyla güncellendi',
        data: updatedUser
      };
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2025 kodu, kayıt bulunamadı hatası
        if (error.code === 'P2025') {
          return {
            success: false,
            message: 'Kullanıcı bulunamadı',
            code: 'USER_NOT_FOUND'
          };
        }
      }

      return {
        success: false,
        message: 'Profil güncellenirken bir hata oluştu',
        code: 'UPDATE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  },

  /**
   * Kullanıcı profil fotoğrafını günceller
   */
  async updateProfilePicture(userId: string, file: Express.Multer.File) {
    try {
      // Eski profil resmi varsa sil
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { profile_picture: true }
      });

      if (user?.profile_picture) {
        // Supabase'den eski dosyayı sil
        const oldFilePath = user.profile_picture.split('/').pop();
        if (oldFilePath) {
          await supabase.storage.from('profile-pictures').remove([oldFilePath]);
        }
      }

      // Yeni dosya adını oluştur
      const fileExt = file.originalname.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;

      // Supabase'e yükle
      const { error: uploadError, data } = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Dosya yükleme hatası: ${uploadError.message}`);
      }

      // Dosya URL'ini al
      const { data: urlData } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(fileName);

      // Veritabanında profil resmini güncelle
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          profile_picture: urlData.publicUrl
        },
        select: {
          id: true,
          profile_picture: true
        }
      });

      return {
        success: true,
        message: 'Profil fotoğrafı başarıyla güncellendi',
        data: updatedUser
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Profil fotoğrafı güncellenirken bir hata oluştu',
        code: 'UPLOAD_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  },

  /**
   * Kullanıcının spor dallarını günceller
   */
  async updateSports(userId: string, sports: SportUpdateData[]) {
    try {
      // Önce kullanıcının mevcut spor dallarını temizle
      await prisma.user_sport.deleteMany({
        where: { user_id: userId }
      });

      // Yeni spor dallarını ekle
      for (const sport of sports) {
        await prisma.user_sport.create({
          data: {
            user: {
              connect: { id: userId }
            },
            sport: {
              connect: { id: sport.sportId }
            },
            skill_level: sport.skillLevel
          }
        });
      }

      // Güncel kullanıcı spor dallarını getir
      const updatedUserSports = await prisma.user_sport.findMany({
        where: { user_id: userId },
        include: { sport: true }
      });

      return {
        success: true,
        message: 'Spor dalları başarıyla güncellendi',
        data: updatedUserSports
      };
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2003 kodu, foreign key constraint hatası
        if (error.code === 'P2003') {
          return {
            success: false,
            message: 'Geçersiz spor dalı ID\'si',
            code: 'INVALID_SPORT_ID'
          };
        }
      }

      return {
        success: false,
        message: 'Spor dalları güncellenirken bir hata oluştu',
        code: 'UPDATE_SPORTS_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  },

  /**
   * Başka bir kullanıcının profil bilgilerini getirir
   */
  async getUserProfile(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          first_name: true,
          last_name: true,
          profile_picture: true,
          user_sports: {
            include: {
              sport: true
            }
          }
        }
      });

      if (!user) {
        return {
          success: false,
          message: 'Kullanıcı bulunamadı',
          code: 'USER_NOT_FOUND'
        };
      }

      return {
        success: true,
        data: user
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Kullanıcı bilgileri alınırken bir hata oluştu',
        code: 'GET_USER_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  },

  /**
   * Tüm kullanıcıları listeler (Admin ve SuperAdmin için)
   */
  async getAllUsers(page: number = 1, limit: number = 10, filter?: string, role?: string, isActive?: boolean) {
    try {
      const skip = (page - 1) * limit;

      // Filtreleme koşulu oluştur
      let where: any = {};

      // Arama filtresi
      if (filter) {
        where = {
          OR: [
            { username: { contains: filter, mode: 'insensitive' } },
            { email: { contains: filter, mode: 'insensitive' } },
            { first_name: { contains: filter, mode: 'insensitive' } },
            { last_name: { contains: filter, mode: 'insensitive' } }
          ],
        };
      }

      // Rol filtresi
      if (role) {
        where = {
          ...where,
          role: role
        };
      }

      // Aktif kullanıcı filtresi (Şu an DB'de isActive/active alanı olmadığı varsayımıyla, 
      // eğer varsa isActive filtresi eklenebilir)
      // Bu kısmı DB yapısına göre güncellemeniz gerekebilir
      // if (isActive !== undefined) {
      //   where = {
      //     ...where,
      //     active: isActive 
      //   };
      // }

      // Toplam kayıt sayısını al
      const totalUsers = await prisma.user.count({ where });

      // Kullanıcıları getir
      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          first_name: true,
          last_name: true,
          role: true,
          profile_picture: true,
          created_at: true,
          updated_at: true,
          _count: {
            select: {
              created_events: true,
              user_sports: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      });

      return {
        success: true,
        data: {
          users,
          pagination: {
            total: totalUsers,
            page,
            limit,
            totalPages: Math.ceil(totalUsers / limit),
          }
        }
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Kullanıcılar listelenirken bir hata oluştu',
        code: 'LIST_USERS_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  },

  /**
   * ID'ye göre kullanıcı getirir (Admin ve SuperAdmin için)
   */
  async getUserById(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          email: true,
          email_verified: true,
          first_name: true,
          last_name: true,
          phone: true,
          profile_picture: true,
          default_location_latitude: true,
          default_location_longitude: true,
          role: true,
          created_at: true,
          updated_at: true,
          user_sports: {
            include: {
              sport: true
            }
          },
          _count: {
            select: {
              created_events: true,
              event_participants: true,
              friends_initiator: true,
              friends_acceptor: true
            }
          }
        }
      });

      if (!user) {
        return {
          success: false,
          message: 'Kullanıcı bulunamadı',
          code: 'USER_NOT_FOUND'
        };
      }

      return {
        success: true,
        data: user
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Kullanıcı bilgileri alınırken bir hata oluştu',
        code: 'GET_USER_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  },

  /**
   * Kullanıcı rolünü değiştirir (Admin ve SuperAdmin için)
   */
  async changeUserRole(userId: string, newRole: string, adminId: string) {
    try {
      // Rol kontrolü
      if (!['user', 'admin', 'superadmin'].includes(newRole)) {
        return {
          success: false,
          message: 'Geçersiz rol. Rol "user", "admin" veya "superadmin" olmalıdır',
          code: 'INVALID_ROLE'
        };
      }

      // Kullanıcıyı kontrol et
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true }
      });

      if (!targetUser) {
        return {
          success: false,
          message: 'Kullanıcı bulunamadı',
          code: 'USER_NOT_FOUND'
        };
      }

      // Admin kullanıcıyı kontrol et
      const adminUser = await prisma.user.findUnique({
        where: { id: adminId },
        select: { id: true, role: true }
      });

      // SuperAdmin rolünü sadece SuperAdmin verebilir
      if (newRole === 'superadmin' && adminUser?.role !== 'superadmin') {
        return {
          success: false,
          message: 'SuperAdmin rolünü sadece SuperAdmin kullanıcılar atayabilir',
          code: 'INSUFFICIENT_PERMISSION'
        };
      }

      // Aynı rolü tekrar atamayı engelle
      if (targetUser.role === newRole) {
        return {
          success: false,
          message: 'Kullanıcı zaten bu role sahip',
          code: 'SAME_ROLE'
        };
      }

      // Kullanıcının rolünü güncelle
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role: newRole },
        select: {
          id: true,
          username: true,
          email: true,
          role: true
        }
      });

      // Admin log kaydı oluştur
      await prisma.admin_log.create({
        data: {
          admin_id: adminId,
          action_type: 'CHANGE_USER_ROLE',
          description: `Kullanıcı rolü değiştirildi: ${userId} kullanıcısının rolü "${targetUser.role}" rolünden "${newRole}" rolüne değiştirildi.`
        }
      });

      return {
        success: true,
        message: 'Kullanıcı rolü başarıyla güncellendi',
        data: updatedUser
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Kullanıcı rolü değiştirilirken bir hata oluştu',
        code: 'CHANGE_ROLE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  },

  /**
   * Kullanıcıyı siler (Admin ve SuperAdmin için)
   */
  async deleteUser(userId: string, adminId: string) {
    try {
      // Kullanıcıyı kontrol et
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, email: true, role: true }
      });

      if (!targetUser) {
        return {
          success: false,
          message: 'Kullanıcı bulunamadı',
          code: 'USER_NOT_FOUND'
        };
      }

      // Admin kullanıcıyı kontrol et
      const adminUser = await prisma.user.findUnique({
        where: { id: adminId },
        select: { id: true, role: true }
      });

      // SuperAdmin'i sadece başka bir SuperAdmin silebilir
      if (targetUser.role === 'superadmin' && adminUser?.role !== 'superadmin') {
        return {
          success: false,
          message: 'SuperAdmin kullanıcıyı sadece başka bir SuperAdmin silebilir',
          code: 'INSUFFICIENT_PERMISSION'
        };
      }

      // Admin kullanıcı kendisini silmeye çalışıyorsa engelle
      if (userId === adminId) {
        return {
          success: false,
          message: 'Kendi hesabınızı bu yöntemle silemezsiniz',
          code: 'SELF_DELETE_NOT_ALLOWED'
        };
      }

      try {
        // Supabase'den kullanıcıyı bulma ve silme
        // Önce kullanıcıları listeleyelim ve e-posta ile eşleşen kullanıcıyı bulalım
        const { data, error } = await supabase.auth.admin.listUsers();
        if (error) {
          console.error(`Supabase kullanıcıları listelenirken hata: ${error.message}`);
        } else if (data && data.users) {
          const supabaseUser = data.users.find(user => user.email === targetUser.email);
          if (supabaseUser) {
            // Kullanıcıyı Supabase'den sil
            const { error: deleteError } = await supabase.auth.admin.deleteUser(supabaseUser.id);
            if (deleteError) {
              console.error(`Supabase'den kullanıcı silinirken hata: ${deleteError.message}`);
            } else {
              console.log(`Supabase'den kullanıcı başarıyla silindi: ${targetUser.email}`);
            }
          }
        }
      } catch (supabaseError) {
        console.error('Supabase işlemi sırasında hata:', supabaseError);
        // Supabase hatası olsa bile işleme devam et, en azından veritabanından silmeyi deneyelim
      }

      // Kullanıcıyı sil
      await prisma.user.delete({
        where: { id: userId }
      });

      // Admin log kaydı oluştur
      await prisma.admin_log.create({
        data: {
          admin_id: adminId,
          action_type: 'DELETE_USER',
          description: `Kullanıcı silindi: ${targetUser.username} (${targetUser.email}) - ID: ${userId}`
        }
      });

      return {
        success: true,
        message: 'Kullanıcı başarıyla silindi'
      };
    } catch (error: any) {
      // Silme işlemi sırasında foreign key hatası
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
          return {
            success: false,
            message: 'Bu kullanıcı sistemde aktif kayıtlara sahip olduğundan silinemiyor',
            code: 'FOREIGN_KEY_CONSTRAINT_ERROR'
          };
        }
      }

      return {
        success: false,
        message: 'Kullanıcı silinirken bir hata oluştu',
        code: 'DELETE_USER_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  },

  /**
   * Kullanıcının oluşturduğu etkinlikleri listeler (Admin erişimi için)
   */
  async getUserCreatedEvents(userId: string, page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;

      // Kullanıcının varlığını kontrol et
      const userExists = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true }
      });

      if (!userExists) {
        return {
          success: false,
          message: 'Kullanıcı bulunamadı',
          code: 'USER_NOT_FOUND'
        };
      }

      // Toplam etkinlik sayısını al
      const totalEvents = await prisma.event.count({
        where: { creator_id: userId }
      });

      // Kullanıcının oluşturduğu etkinlikleri getir
      const events = await prisma.event.findMany({
        where: { creator_id: userId },
        include: {
          sport: true,
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  first_name: true,
                  last_name: true,
                  profile_picture: true
                }
              }
            }
          },
          _count: {
            select: {
              participants: true,
              ratings: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      });

      return {
        success: true,
        data: {
          events,
          pagination: {
            total: totalEvents,
            page,
            limit,
            totalPages: Math.ceil(totalEvents / limit),
          }
        }
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Kullanıcının oluşturduğu etkinlikler listelenirken bir hata oluştu',
        code: 'LIST_EVENTS_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  },

  /**
   * Kullanıcının katıldığı etkinlikleri listeler (Admin erişimi için)
   */
  async getUserParticipatedEvents(userId: string, page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;

      // Kullanıcının varlığını kontrol et
      const userExists = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true }
      });

      if (!userExists) {
        return {
          success: false,
          message: 'Kullanıcı bulunamadı',
          code: 'USER_NOT_FOUND'
        };
      }

      // Kullanıcının katıldığı etkinliklerin sayısını al
      const userParticipations = await prisma.event_participant.findMany({
        where: { user_id: userId },
        select: { event_id: true }
      });

      const eventIds = userParticipations.map(p => p.event_id);
      const totalEvents = eventIds.length;

      // Kullanıcının katıldığı etkinlikleri getir
      const events = await prisma.event.findMany({
        where: {
          id: {
            in: eventIds
          }
        },
        include: {
          sport: true,
          creator: {
            select: {
              id: true,
              username: true,
              first_name: true,
              last_name: true,
              profile_picture: true
            }
          },
          participants: {
            where: {
              user_id: userId
            },
            select: {
              joined_at: true,
              role: true
            }
          },
          _count: {
            select: {
              participants: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: { event_date: 'desc' },
      });

      return {
        success: true,
        data: {
          events,
          pagination: {
            total: totalEvents,
            page,
            limit,
            totalPages: Math.ceil(totalEvents / limit),
          }
        }
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Kullanıcının katıldığı etkinlikler listelenirken bir hata oluştu',
        code: 'LIST_PARTICIPATIONS_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  }
}; 
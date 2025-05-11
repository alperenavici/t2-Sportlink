import { supabase } from '../config/supabase';
import prisma from '../config/prisma';
import dotenv from 'dotenv';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

dotenv.config();

interface RegisterUserData {
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

interface LoginData {
  email: string;
  password: string;
}

export const authService = {
  /**
   * Kullanıcı kaydı oluşturur
   */
  async register(userData: RegisterUserData) {
    try {
      // Önce kullanıcının zaten var olup olmadığını kontrol et
      const existingUserByEmail = await prisma.user.findUnique({
        where: { email: userData.email },
      });

      if (existingUserByEmail) {
        return {
          success: false,
          message: 'Bu e-posta adresi zaten kullanılıyor.',
          code: 'EMAIL_EXISTS'
        };
      }

      const existingUserByUsername = await prisma.user.findUnique({
        where: { username: userData.username },
      });

      if (existingUserByUsername) {
        return {
          success: false,
          message: 'Bu kullanıcı adı zaten kullanılıyor. Lütfen başka bir kullanıcı adı seçiniz.',
          code: 'USERNAME_EXISTS'
        };
      }

      // Supabase'de bu email ile daha önce kayıt olmuş kullanıcıyı temizle
      try {
        const { data, error } = await supabase.auth.admin.listUsers();
        if (!error && data && data.users) {
          const supabaseUser = data.users.find(user => user.email === userData.email);
          if (supabaseUser) {
            // Kullanıcı Supabase'de var ama Prisma'da yok, demek ki silinmiş. Supabase'den de silelim
            const { error: deleteError } = await supabase.auth.admin.deleteUser(supabaseUser.id);
            if (deleteError) {
              console.error(`Supabase'den eski kullanıcı silinirken hata: ${deleteError.message}`);
            } else {
              console.log(`Supabase'den eski kullanıcı kaydı temizlendi: ${userData.email}`);
            }
          }
        }
      } catch (supabaseError) {
        console.error('Supabase kontrol işlemi sırasında hata:', supabaseError);
        // Hata olsa da kayıt işlemine devam et
      }

      // Supabase'de kullanıcı kaydı oluştur ve e-posta doğrulama gönder
      const { error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            username: userData.username,
            first_name: userData.first_name,
            last_name: userData.last_name
          },
          // E-posta doğrulama işlemini Supabase yönetecek
          emailRedirectTo: `${process.env.FRONTEND_URL}/auth/callback`
        }
      });

      if (authError) {
        if (authError.message.includes('email')) {
          return {
            success: false,
            message: 'Bu e-posta adresi geçersiz veya zaten kullanımda.',
            code: 'EMAIL_ERROR'
          };
        }
        if (authError.message.includes('password')) {
          return {
            success: false,
            message: 'Şifre en az 8 karakter uzunluğunda olmalı ve güvenlik kriterlerini karşılamalıdır.',
            code: 'PASSWORD_ERROR'
          };
        }
        throw new Error(`Supabase kaydında hata: ${authError.message}`);
      }

      // Şifreyi hashle
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Prisma ile veritabanında kullanıcı oluştur
      // Supabase'de kullanıcı kimliği ile ilişkilendir
      const user = await prisma.user.create({
        data: {
          username: userData.username,
          email: userData.email,
          password: hashedPassword, // Artık hashedPassword kullanıyoruz
          first_name: userData.first_name,
          last_name: userData.last_name,
          phone: userData.phone || null,
          profile_picture: null,
          default_location_latitude: null,
          default_location_longitude: null,
        },
      });

      return {
        success: true,
        message: 'Kullanıcı başarıyla kaydedildi. Lütfen e-posta adresinizi doğrulayın.',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
      };
    } catch (error: any) {
      // Hata durumunda oluşturulan kullanıcıyı temizle
      await this.cleanupAfterFailedRegistration(userData.email);

      // Prisma hatalarını kullanıcı dostu mesajlara dönüştür
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2002 kodu, unique constraint ihlali hatası
        if (error.code === 'P2002') {
          const field = error.meta?.target as string[];
          if (field?.includes('username')) {
            return {
              success: false,
              message: 'Bu kullanıcı adı zaten kullanılıyor. Lütfen başka bir kullanıcı adı seçiniz.',
              code: 'USERNAME_EXISTS'
            };
          }
          if (field?.includes('email')) {
            return {
              success: false,
              message: 'Bu e-posta adresi zaten kullanılıyor.',
              code: 'EMAIL_EXISTS'
            };
          }
          return {
            success: false,
            message: 'Girdiğiniz bilgilerde benzersiz olması gereken bir alan zaten kullanılmaktadır.',
            code: 'UNIQUE_CONSTRAINT_ERROR'
          };
        }
      }

      return {
        success: false,
        message: 'Kayıt işlemi sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyiniz.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        code: 'REGISTRATION_ERROR'
      };
    }
  },

  /**
   * Kullanıcı giriş işlemini yapar
   */
  async login(loginData: LoginData) {
    try {
      // Supabase ile giriş yap
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });

      if (error) {
        // Kullanıcı dostu hata mesajları
        if (error.message.includes("Invalid login credentials")) {
          return {
            success: false,
            message: 'E-posta veya şifre hatalı. Lütfen bilgilerinizi kontrol ediniz.',
            code: 'INVALID_CREDENTIALS'
          };
        }
        return {
          success: false,
          message: `Giriş başarısız: ${error.message}`,
          code: 'LOGIN_ERROR'
        };
      }

      // Supabase'den kullanıcının doğrulanma durumunu kontrol et
      if (!data.user.email_confirmed_at) {
        return {
          success: false,
          message: 'Lütfen önce e-posta adresinizi doğrulayın',
          code: 'EMAIL_NOT_VERIFIED'
        };
      }

      // Kullanıcıyı Prisma'dan al
      const user = await prisma.user.findUnique({
        where: { email: loginData.email },
        select: {
          id: true,
          username: true,
          email: true,
          password: true,
          first_name: true,
          last_name: true,
          role: true,
          email_verified: true
        }
      });

      if (!user) {
        return {
          success: false,
          message: 'Kullanıcı bulunamadı',
          code: 'USER_NOT_FOUND'
        };
      }

      // Kullanıcının rolünü kontrol et - sadece admin ve superadmin giriş yapabilir
      if (user.role !== 'admin' && user.role !== 'superadmin') {
        return {
          success: false,
          message: 'Yetki hatasıː Bu sisteme sadece yöneticiler giriş yapabilir.',
          code: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Eğer kullanıcının hash'lenmiş parolası varsa ve doğru formatta ise, yerel doğrulama yapalım
      if (user.password && user.password.startsWith('$2')) {
        try {
          // Parolayı doğrula
          const isValidPassword = await bcrypt.compare(loginData.password, user.password);
          if (!isValidPassword) {
            // Parola uyuşmazlığı log'unu ekleyebiliriz (isteğe bağlı)
            console.warn(`Yerel parola doğrulaması başarısız: ${user.email}`);
          }
        } catch (e) {
          // Parola doğrulama hatası
          console.error('Parola doğrulama hatası:', e);
        }
      }

      // Başarılı giriş - kullanıcı bilgilerini ve oturum token'ını döndür
      // E-posta zaten Supabase tarafından doğrulandığından, veritabanındaki email_verified alanını da güncelle
      if (!user.email_verified) {
        await prisma.user.update({
          where: { id: user.id },
          data: { email_verified: true }
        });
      }

      return {
        success: true,
        message: 'Giriş başarılı',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role
        },
        session: data.session,
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Giriş işlemi sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyiniz.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        code: 'LOGIN_ERROR'
      };
    }
  },

  /**
   * E-posta doğrulama geri dönüş işleyicisi
   * Bu fonksiyon frontend tarafından çağrılır ve Supabase'den gelen doğrulama bilgisini alır
   */
  async handleEmailVerification(token: string) {
    try {
      // Supabase'den token'ı doğrula
      const { error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'email',
      });

      if (error) {
        return {
          success: false,
          message: `E-posta doğrulama hatası: ${error.message}`,
          code: 'VERIFICATION_ERROR'
        };
      }

      // Kullanıcı bilgilerini al
      const { data: userData } = await supabase.auth.getUser();

      if (!userData || !userData.user) {
        return {
          success: false,
          message: 'Kullanıcı bilgileri alınamadı',
          code: 'USER_INFO_ERROR'
        };
      }

      // Prisma'daki kullanıcıyı güncelle
      await prisma.user.update({
        where: { email: userData.user.email as string },
        data: {
          email_verified: true,
        },
      });

      return {
        success: true,
        message: 'E-posta adresiniz başarıyla doğrulandı. Şimdi giriş yapabilirsiniz.',
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'E-posta doğrulama işlemi sırasında bir hata oluştu.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        code: 'VERIFICATION_ERROR'
      };
    }
  },

  /**
   * Başarısız kayıt durumunda temizlik yapar
   */
  async cleanupAfterFailedRegistration(email: string) {
    try {
      // Prisma'dan kullanıcıyı sil
      await prisma.user.delete({
        where: { email },
      });

      try {
        // Supabase'den kullanıcıyı bulma ve silme
        const { data, error } = await supabase.auth.admin.listUsers();
        if (error) {
          console.error(`Supabase kullanıcıları listelenirken hata: ${error.message}`);
        } else if (data && data.users) {
          const supabaseUser = data.users.find(user => user.email === email);
          if (supabaseUser) {
            // Kullanıcıyı Supabase'den sil
            const { error: deleteError } = await supabase.auth.admin.deleteUser(supabaseUser.id);
            if (deleteError) {
              console.error(`Supabase'den kullanıcı silinirken hata: ${deleteError.message}`);
            } else {
              console.log(`Supabase'den kullanıcı başarıyla silindi: ${email}`);
            }
          }
        }
      } catch (supabaseError) {
        console.error('Supabase temizlik işlemi sırasında hata:', supabaseError);
      }
    } catch (error) {
      // Silme işlemi başarısız olursa sessizce devam et
      console.error('Temizlik işlemi sırasında hata:', error);
    }
  },

  /**
   * Kullanıcı çıkış yapar
   */
  async logout() {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return {
          success: false,
          message: `Çıkış sırasında hata: ${error.message}`,
          code: 'LOGOUT_ERROR'
        };
      }

      return {
        success: true,
        message: 'Başarıyla çıkış yapıldı',
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Çıkış işlemi sırasında bir hata oluştu',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        code: 'LOGOUT_ERROR'
      };
    }
  },

  /**
   * Şifre sıfırlama isteği gönderir
   */
  async forgotPassword(email: string) {
    try {
      // Önce kullanıcının var olup olmadığını kontrol et
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true }
      });

      if (!user) {
        // Güvenlik nedeniyle, kullanıcı bulunamasa bile başarılı mesajı döndür
        return {
          success: true,
          message: 'Şifre sıfırlama talimatları e-posta adresinize gönderildi. Lütfen e-postanızı kontrol edin.',
        };
      }

      // Supabase üzerinden şifre sıfırlama e-postası gönder
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.FRONTEND_URL}/auth/reset-password`,
      });

      if (error) {
        console.error(`Şifre sıfırlama hatası: ${error.message}`);
        return {
          success: false,
          message: 'Şifre sıfırlama e-postası gönderilirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.',
          code: 'PASSWORD_RESET_ERROR'
        };
      }

      return {
        success: true,
        message: 'Şifre sıfırlama talimatları e-posta adresinize gönderildi. Lütfen e-postanızı kontrol edin.',
      };
    } catch (error: any) {
      console.error('Şifre sıfırlama işlemi sırasında hata:', error);
      return {
        success: false,
        message: 'Şifre sıfırlama işlemi sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyin.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        code: 'PASSWORD_RESET_ERROR'
      };
    }
  }
};
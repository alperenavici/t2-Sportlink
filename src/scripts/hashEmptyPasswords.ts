import prisma from '../config/prisma';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

/**
 * Boş veya hashlenmemiş parolaları olan kullanıcılar için güçlü parolalar oluşturup hashleyen script.
 * Bu script, yalnızca bir kez veya ihtiyaç duyulduğunda çalıştırılmalıdır.
 */
async function hashEmptyPasswords() {
    try {
        console.log('Boş veya hashlenmemiş parolaları olan kullanıcılar aranıyor...');

        // Boş parolaları olan veya parolası hashlenmemiş olan kullanıcıları bul
        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { password: '' },
                    {
                        NOT: {
                            password: { startsWith: '$2' }
                        }
                    }
                ]
            },
            select: {
                id: true,
                email: true,
                username: true
            }
        });

        if (users.length === 0) {
            console.log('Tüm kullanıcı parolaları zaten hashlenmiş durumda. İşlem yapılmasına gerek yok.');
            return;
        }

        console.log(`${users.length} kullanıcı için parola hashleme işlemi başlatılıyor...`);

        // Her kullanıcı için rastgele güçlü parola oluştur ve hashle
        for (const user of users) {
            // Rastgele 16 karakterlik bir parola oluştur
            const randomPassword = randomBytes(12).toString('hex');

            // Parolayı hashle
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            // Kullanıcı parolasını güncelle
            await prisma.user.update({
                where: { id: user.id },
                data: { password: hashedPassword }
            });

            console.log(`Kullanıcı başarıyla güncellendi: ${user.email} (${user.username})`);

            // Not: Gerçek senaryoda, kullanıcıya yeni oluşturulan parolasının ne olduğunu göstermek 
            // veya parola sıfırlama e-postası göndermek istersiniz.
            console.log(`Kullanıcı: ${user.email} için yeni parola: ${randomPassword}`);
        }

        console.log('Tüm kullanıcı parolaları başarıyla hashlendi!');

    } catch (error) {
        console.error('Parola hashleme işlemi sırasında bir hata oluştu:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Scripti çalıştır
hashEmptyPasswords()
    .then(() => {
        console.log('İşlem tamamlandı');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Kritik hata:', error);
        process.exit(1);
    }); 
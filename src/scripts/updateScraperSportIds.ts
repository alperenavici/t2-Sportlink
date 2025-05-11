import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// .env dosyasını yükle
dotenv.config();

// Prisma istemcisi oluştur
const prisma = new PrismaClient();

async function updateScraperSportIds() {
    try {
        // Veritabanından sporları al
        const sports = await prisma.sport.findMany();
        console.log('Veritabanındaki spor kayıtları:');
        console.table(sports);

        // Spor adı -> ID eşleştirmesi oluştur
        const sportMap = new Map();
        sports.forEach(sport => {
            sportMap.set(sport.name.toLowerCase(), sport.id);
        });

        console.log('Spor adı -> ID eşleştirmesi:');
        console.log(Object.fromEntries(sportMap));

        // Dosya yollarını oluştur
        const newsScraper = path.join(__dirname, 'newsScraper.ts');
        const sporxScraper = path.join(__dirname, 'sporxScraper.ts');
        const konyasporScraper = path.join(__dirname, 'konyasporScraper.ts');

        // newsScraper.ts dosyasını güncelle
        if (fs.existsSync(newsScraper)) {
            let content = fs.readFileSync(newsScraper, 'utf8');

            // Futbol ID'sini değiştir
            const futbolId = sportMap.get('futbol');
            if (futbolId) {
                content = content.replace(/sportId: ['"]1['"]/, `sportId: '${futbolId}'`);
                console.log(`newsScraper.ts içindeki Futbol ID'si güncellendi: ${futbolId}`);
            }

            // Basketbol ID'sini değiştir
            const basketbolId = sportMap.get('basketbol');
            if (basketbolId) {
                content = content.replace(/sportId: ['"]2['"]/, `sportId: '${basketbolId}'`);
                console.log(`newsScraper.ts içindeki Basketbol ID'si güncellendi: ${basketbolId}`);
            }

            fs.writeFileSync(newsScraper, content);
            console.log('newsScraper.ts dosyası güncellendi');
        } else {
            console.log('newsScraper.ts dosyası bulunamadı');
        }

        // sporxScraper.ts dosyasını güncelle
        if (fs.existsSync(sporxScraper)) {
            let content = fs.readFileSync(sporxScraper, 'utf8');

            // Futbol ID'sini değiştir
            const futbolId = sportMap.get('futbol');
            if (futbolId) {
                content = content.replace(/sportId: ['"]1['"]/, `sportId: '${futbolId}'`);
                content = content.replace(/sport_id: ['"]1['"]/, `sport_id: '${futbolId}'`);
                console.log(`sporxScraper.ts içindeki Futbol ID'si güncellendi: ${futbolId}`);
            }

            fs.writeFileSync(sporxScraper, content);
            console.log('sporxScraper.ts dosyası güncellendi');
        } else {
            console.log('sporxScraper.ts dosyası bulunamadı');
        }

        // konyasporScraper.ts dosyasını güncelle
        if (fs.existsSync(konyasporScraper)) {
            let content = fs.readFileSync(konyasporScraper, 'utf8');

            // Futbol ID'sini değiştir
            const futbolId = sportMap.get('futbol');
            if (futbolId) {
                content = content.replace(/sportId: ['"]1['"]/, `sportId: '${futbolId}'`);
                content = content.replace(/sport_id: ['"]1['"]/, `sport_id: '${futbolId}'`);
                console.log(`konyasporScraper.ts içindeki Futbol ID'si güncellendi: ${futbolId}`);
            }

            fs.writeFileSync(konyasporScraper, content);
            console.log('konyasporScraper.ts dosyası güncellendi');
        } else {
            console.log('konyasporScraper.ts dosyası bulunamadı');
        }

        console.log('Tüm scraper dosyaları güncellendi!');
    } catch (error) {
        console.error('Güncelleme sırasında hata:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Script doğrudan çalıştırıldığında fonksiyonu çağır
if (require.main === module) {
    updateScraperSportIds()
        .then(() => {
            console.log('İşlem başarıyla tamamlandı.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Hata:', error);
            process.exit(1);
        });
} 
import cron from 'node-cron';
import { scrapeNews } from './newsScraper';
import { scrapeSporx } from './sporxScraper';
import { scrapeKonyasporNews } from './konyasporScraper';

console.log('Haber çekme zamanlayıcısı başlatılıyor...');

// Her zamanlanmış görev için günlük log tutan yardımcı fonksiyon
function logScraperRun(scraperName: string) {
  console.log(`${scraperName} çalıştırılıyor - ${new Date().toLocaleString('tr-TR')}`);
}

/**
 * Günlük asıl haber çekme işlemi - Sabah 08:00
 * Tüm kaynakları bu saatte çekiyoruz
 */
cron.schedule('0 8 * * *', async () => {
  console.log(`Ana zamanlanmış haber scraping başlıyor - ${new Date().toLocaleString('tr-TR')}`);

  try {
    logScraperRun('Tüm haber kaynakları');
    await scrapeNews();
  } catch (error) {
    console.error('Ana zamanlanmış scraper çalışırken hata:', error);
  }
});

/**
 * Öğlen güncellemesi - Saat 12:30
 * Sadece popüler spor siteleri
 */
cron.schedule('30 12 * * *', async () => {
  console.log(`Öğlen güncelleme scraping başlıyor - ${new Date().toLocaleString('tr-TR')}`);

  try {
    logScraperRun('Sporx scraper');
    await scrapeSporx();
  } catch (error) {
    console.error('Öğlen scraper çalışırken hata:', error);
  }
});

/**
 * Akşam güncellemesi - Saat 18:00
 * Takım haberleri ve sporx
 */
cron.schedule('0 18 * * *', async () => {
  console.log(`Akşam güncelleme scraping başlıyor - ${new Date().toLocaleString('tr-TR')}`);

  try {
    logScraperRun('Konyaspor scraper');
    await scrapeKonyasporNews();

    logScraperRun('Sporx scraper');
    await scrapeSporx();
  } catch (error) {
    console.error('Akşam scraper çalışırken hata:', error);
  }
});

/**
 * Gece güncellemesi - Saat 23:00
 * Son dakika haberleri için tüm kaynaklar
 */
cron.schedule('0 23 * * *', async () => {
  console.log(`Gece güncelleme scraping başlıyor - ${new Date().toLocaleString('tr-TR')}`);

  try {
    logScraperRun('Tüm haber kaynakları');
    await scrapeNews();
  } catch (error) {
    console.error('Gece scraper çalışırken hata:', error);
  }
});

// Test için hemen bir kez çalıştır (development amaçlı - isterseniz kaldırabilirsiniz)
if (process.env.NODE_ENV === 'development' && process.env.RUN_SCRAPER_TEST === 'true') {
  console.log('Development modunda - test çalıştırması başlatılıyor...');
  setTimeout(async () => {
    try {
      await scrapeNews();
    } catch (error) {
      console.error('Test çalıştırması sırasında hata:', error);
    }
  }, 3000); // 3 saniye sonra başlat
}

console.log('Haber zamanlayıcısı başlatıldı. Günlük çalışma planı:');
console.log('- Sabah 08:00: Tüm haber kaynakları');
console.log('- Öğlen 12:30: Sporx');
console.log('- Akşam 18:00: Konyaspor ve Sporx');
console.log('- Gece 23:00: Tüm haber kaynakları'); 
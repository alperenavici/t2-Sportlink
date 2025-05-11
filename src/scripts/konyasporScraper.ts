import { News } from '../models/News';
import * as cheerio from 'cheerio';
import axios from 'axios';
import dotenv from 'dotenv';
import { Prisma, PrismaClient } from '@prisma/client';

// .env dosyasını yükle
dotenv.config();

// Prisma client
const prisma = new PrismaClient();

// Konyaspor ile ilgili haber siteleri
interface NewsSource {
  name: string;
  url: string;
  sportId: string;
  selectors: {
    articles: string;
    title: string;
    content: string;
    link: string;
    image: string;
    date: string;
    detailContent: string;
    detailText?: string;
    spotContent?: string;
  }
}

const konyasporSites: NewsSource[] = [
  {
    name: 'Konyaspor Resmi Site',
    url: 'https://www.konyaspor.org.tr/',
    sportId: '909a0f7f-54f7-4a47-b47f-5d074b88bcc6', // Futbol ID (Spor tablosundaki gerçek ID)
    selectors: {
      articles: '.haberler-ve-duyurular a, article, .news-list a, .news-item, .haber-item',
      title: 'h3, h4, .title, .news-title',
      content: 'p, .summary, .description',
      link: 'a',
      image: 'img',
      date: '.date, time',
      detailContent: '.news-single, .haber-detay-icerik, .news-content, .content',
      detailText: '.detail-text p' // Konyaspor sitesindeki metin paragrafları
    }
  },
  {
    name: 'Konhaber Konyaspor',
    url: 'https://www.konhaber.com/spor/konyaspor',
    sportId: '1', // Futbol ID (Spor tablosundaki gerçek ID)
    selectors: {
      articles: 'a[href*="/konyaspor_"], a[href*="/spor/"], .news-item',
      title: 'h2, h3, a.title',
      content: 'p, .spot, .summary',
      link: 'a',
      image: 'img',
      date: '.date',
      detailContent: '.icerik',
      spotContent: '.spot'
    }
  },
  {
    name: 'Konhaber Konyaspor Basketbol',
    url: 'https://www.konhaber.com/spor/konyaspor_basketbol',
    sportId: '2', // Basketbol ID (Spor tablosundaki gerçek ID)
    selectors: {
      articles: 'a[href*="/konyaspor_"], a[href*="/spor/"], .news-item',
      title: 'h2, h3, a.title',
      content: 'p, .spot, .summary',
      link: 'a',
      image: 'img',
      date: '.date',
      detailContent: '.icerik',
      spotContent: '.spot'
    }
  },
  {
    name: 'Konhaber 1922 Konyaspor',
    url: 'https://www.konhaber.com/spor/1922_konyaspor',
    sportId: '1', // Futbol ID (Spor tablosundaki gerçek ID)
    selectors: {
      articles: 'a[href*="/1922_konyaspor/"], a[href*="/spor/"], .news-item',
      title: 'h2, h3, a.title',
      content: 'p, .spot, .summary',
      link: 'a',
      image: 'img',
      date: '.date',
      detailContent: '.icerik',
      spotContent: '.spot'
    }
  }
];

// URL'leri ve başlıkları izlemek için bir cache nesnesi oluştur
const processedUrls = new Set<string>();
const processedTitles = new Set<string>();

/**
 * URL'i mutlak URL'e çevirir
 */
function formatUrl(url: string, baseUrl: string): string {
  if (!url) return '';

  try {
    // URL mutlak ise olduğu gibi döndür
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // Göreceli URL'i mutlak URL'e çevir
    const base = new URL(baseUrl);
    if (url.startsWith('/')) {
      return `${base.protocol}//${base.host}${url}`;
    } else {
      return `${base.protocol}//${base.host}/${url}`;
    }
  } catch (e) {
    console.error(`URL işlenirken hata:`, e);
    return url;
  }
}

/**
 * Konyaspor haber sitelerinden haberler çeker
 */
export async function scrapeKonyasporNews() {
  try {
    console.log('Konyaspor haber sitelerinden haber çekme işlemi başlıyor...');
    let totalProcessed = 0;
    let totalAdded = 0;

    // Her çalıştırma öncesinde cache temizle
    processedUrls.clear();
    processedTitles.clear();

    for (const site of konyasporSites) {
      console.log(`${site.name} (${site.url}) adresinden haberler çekiliyor...`);

      try {
        // Web sayfasını çek
        const response = await axios.get(site.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
          },
          timeout: 30000
        });

        const responseData = response.data as string;
        const $ = cheerio.load(responseData);
        let newsCount = 0;

        // Debug: Sayfanın yapısını analiz et
        console.log(`${site.name} - Sayfa yapısı analiz ediliyor...`);
        console.log(`HTML içeriği boyutu: ${responseData.length} karakter`);

        // Haber elemanlarını bul
        const articles = $(site.selectors.articles);
        console.log(`${articles.length} adet haber elementi bulundu.`);

        if (articles.length === 0) {
          // Alternatif seçicileri dene
          console.log('Alternatif seçiciler deneniyor...');
          // Sayfadaki tüm linkleri tara
          const allLinks = $('a');
          console.log(`Sayfada toplam ${allLinks.length} adet link var.`);

          if (site.name.includes('Konyaspor Resmi Site')) {
            // Konyaspor resmi sitesi için özel işlem
            $('a').each((i, el) => {
              if (i < 10) { // İlk 10 linki kontrol et
                const href = $(el).attr('href');
                const text = $(el).text().trim();
                if (href && text && text.length > 10) {
                  console.log(`Link ${i}: ${text} - ${href}`);
                }
              }
            });
          }
        }

        // İşlenecek makismum haber sayısı
        const MAX_ARTICLES = 10;
        let processedArticleCount = 0;

        // Her bir haberi işle
        for (let i = 0; i < articles.length && processedArticleCount < MAX_ARTICLES; i++) {
          const element = articles[i];

          try {
            if (i < 5) { // Debug için ilk 5 elementin içeriklerini göster
              console.log(`Element ${i}:`);
              console.log(`HTML: ${$(element).html()?.substring(0, 150)}...`);
            }

            // Haberin detaylarını çek
            let title = '';
            const titleElement = $(element).find(site.selectors.title);
            if (titleElement.length > 0) {
              title = titleElement.text().trim();
            } else {
              // Eğer başlık bulunamazsa, elementin kendisinde text olabilir
              title = $(element).text().trim();

              // Çok uzun textleri kısalt
              if (title.length > 100) {
                title = title.substring(0, 100);
              }
            }

            // Eğer başlık hala boşsa, atla
            if (!title) {
              console.log(`Element ${i}: Başlık bulunamadı, atlanıyor.`);
              continue;
            }

            console.log(`Element ${i} başlık: ${title}`);

            // Link bul
            let sourceUrl = '';
            // Önce eğer element kendisi bir link ise
            if ($(element).is('a')) {
              sourceUrl = $(element).attr('href') || '';
            } else {
              // Değilse element içindeki ilk linki al
              const linkElement = $(element).find('a').first();
              sourceUrl = linkElement.attr('href') || '';
            }

            sourceUrl = formatUrl(sourceUrl, site.url);
            console.log(`Element ${i} link: ${sourceUrl}`);

            if (!sourceUrl) {
              console.log(`Element ${i}: Link bulunamadı, atlanıyor.`);
              continue;
            }

            // Aynı URL'yi işlemeyi önle
            if (processedUrls.has(sourceUrl)) {
              console.log(`Element ${i}: Bu URL zaten işlendi, atlanıyor: ${sourceUrl}`);
              continue;
            }
            processedUrls.add(sourceUrl);

            // Aynı başlığı işlemeyi önle
            if (processedTitles.has(title)) {
              console.log(`Element ${i}: Bu başlık zaten işlendi, atlanıyor: ${title}`);
              continue;
            }
            processedTitles.add(title);

            // Resim URL'i bul
            let imageUrl = '';
            const imgElement = $(element).find('img').first();
            if (imgElement.length) {
              imageUrl = imgElement.attr('src') || imgElement.attr('data-src') || '';
              imageUrl = formatUrl(imageUrl, site.url);
              console.log(`Element ${i} resim: ${imageUrl}`);
            }

            // Tarih bul - basit tutuyoruz
            let publishedDate = new Date();

            // Haber içeriğini almak için detay sayfasına git
            let content = '';
            let isTextOnly = false; // Metnin HTML içerip içermediğini takip et

            try {
              console.log(`Detay sayfası yükleniyor: ${sourceUrl}`);
              const detailResponse = await axios.get(sourceUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                  'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
                },
                timeout: 30000
              });

              const detailResponseData = detailResponse.data as string;
              const detailPage = cheerio.load(detailResponseData);

              // Her site için sadece metin içeriğini al
              if (site.name.includes('Konyaspor Resmi Site')) {
                // Detay sayfasındaki tüm resimleri bul
                const imageUrls: string[] = [];
                detailPage('.news-single img, .detail-big-image img').each(function (this: cheerio.Element) {
                  const imgSrc = detailPage(this).attr('src');
                  if (imgSrc) {
                    const fullImageUrl = formatUrl(imgSrc, sourceUrl);
                    imageUrls.push(fullImageUrl);
                  }
                });

                console.log(`Detay sayfasında ${imageUrls.length} adet resim bulundu.`);

                const detailText = detailPage('.detail-text');
                if (detailText.length > 0) {
                  // Metin paragraflarını bul ve sadece metinleri al
                  const paragraphs: string[] = [];

                  // Başlık resmi varsa, içeriğin başına ekle
                  if (imageUrls.length > 0 && imageUrls[0]) {
                    paragraphs.push(`[${imageUrls[0]}]`);
                  }

                  let imageIndex = 1; // İlk resmi kullandık, diğer resimlerden devam et

                  detailText.find('p').each(function (this: cheerio.Element) {
                    const paragraphText = detailPage(this).text().trim();
                    if (paragraphText) {
                      paragraphs.push(paragraphText);

                      // Her 2 paragraftan sonra bir resim ekle (eğer varsa)
                      if (paragraphs.length % 2 === 0 && imageIndex < imageUrls.length) {
                        paragraphs.push(`[${imageUrls[imageIndex]}]`);
                        imageIndex++;
                      }
                    }
                  });

                  // Kalan resimleri en sona ekle
                  while (imageIndex < imageUrls.length) {
                    paragraphs.push(`[${imageUrls[imageIndex]}]`);
                    imageIndex++;
                  }

                  // Paragrafları birleştir
                  content = paragraphs.join('\n\n');
                  isTextOnly = true;
                  console.log(`Konyaspor resmi sitesinden metin ve resim içeriği alındı (${content.length} karakter).`);
                } else {
                  // Alternatif olarak news-single sınıfını dene
                  const newsElement = detailPage('.news-single');
                  if (newsElement.length > 0) {
                    // İçindeki p etiketlerini bul ve sadece metinleri al
                    const paragraphs: string[] = [];

                    // Başlık resmi varsa, içeriğin başına ekle
                    if (imageUrls.length > 0 && imageUrls[0]) {
                      paragraphs.push(`[${imageUrls[0]}]`);
                    }

                    let imageIndex = 1; // İlk resmi kullandık, diğer resimlerden devam et

                    newsElement.find('p').each(function (this: cheerio.Element) {
                      const paragraphText = detailPage(this).text().trim();
                      if (paragraphText) {
                        paragraphs.push(paragraphText);

                        // Her 2 paragraftan sonra bir resim ekle (eğer varsa)
                        if (paragraphs.length % 2 === 0 && imageIndex < imageUrls.length) {
                          paragraphs.push(`[${imageUrls[imageIndex]}]`);
                          imageIndex++;
                        }
                      }
                    });

                    // Kalan resimleri en sona ekle
                    while (imageIndex < imageUrls.length) {
                      paragraphs.push(`[${imageUrls[imageIndex]}]`);
                      imageIndex++;
                    }

                    if (paragraphs.length > 0) {
                      content = paragraphs.join('\n\n');
                      isTextOnly = true;
                      console.log(`News-single içinden paragraf metinleri ve resimler alındı (${content.length} karakter).`);
                    } else {
                      // Hiç paragraf bulunamazsa tüm içeriği al ve temizle
                      content = newsElement.text().trim()
                        .replace(/\s+/g, ' ')  // Çoklu boşlukları tek boşluğa indir
                        .replace(/GALERİ/g, '') // Galeri yazısını kaldır
                        .replace(/Facebook"ta Paylaş/g, '') // Paylaşım linklerini kaldır
                        .replace(/Twitterda Paylaş/g, '')
                        .replace(/Yazdır/g, '');

                      // Gereksiz tarih ve diğer içerikleri kaldır
                      content = content.replace(/\d+\.\d+\.\d+\s+\d+:\d+/g, ''); // Tarih ve saat formatlarını kaldır

                      // Başlık resmi varsa, içeriğin başına ekle
                      if (imageUrls.length > 0) {
                        content = `[${imageUrls[0]}]\n\n${content}`;

                        // Diğer resimleri de ekle
                        for (let i = 1; i < imageUrls.length; i++) {
                          content += `\n\n[${imageUrls[i]}]`;
                        }
                      }

                      isTextOnly = true;
                      console.log(`News-single içinden temizlenmiş metin ve resimler alındı (${content.length} karakter).`);
                    }
                  }
                }
              } else if (site.name.includes('Konhaber')) {
                // Konhaber sitesi için özel işlem
                let contentElement = detailPage(site.selectors.detailContent || '');
                let currentPage = detailPage;

                // URL'de "etiket-" kelimesi varsa, bu bir kategori sayfasıdır
                if (sourceUrl.includes('/etiket-')) {
                  console.log('Bu bir kategori sayfası, haberler için linkler aranıyor...');

                  // Sayfadaki haber linkleri
                  const newsLinks: string[] = [];

                  // Slider içindeki haberleri bul
                  detailPage('.swiper-slide a').each(function (this: cheerio.Element) {
                    const href = detailPage(this).attr('href');
                    if (href) {
                      const fullUrl = formatUrl(href, sourceUrl);
                      newsLinks.push(fullUrl);
                    }
                  });

                  // Diğer haber kartlarını bul
                  detailPage('.news-item a, .haber-card a, .news-list a').each(function (this: cheerio.Element) {
                    const href = detailPage(this).attr('href');
                    if (href) {
                      const fullUrl = formatUrl(href, sourceUrl);
                      newsLinks.push(fullUrl);
                    }
                  });

                  console.log(`Kategori sayfasında ${newsLinks.length} haber linki bulundu.`);

                  // Eğer haber linki varsa ilk haberi al
                  if (newsLinks.length > 0) {
                    try {
                      const newsUrl = newsLinks[0];
                      console.log(`Kategoriden haber sayfasına gidiliyor: ${newsUrl}`);

                      const newsResponse = await axios.get(newsUrl, {
                        headers: {
                          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                          'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
                        },
                        timeout: 30000
                      });

                      const newsResponseData = newsResponse.data as string;
                      const newsPage = cheerio.load(newsResponseData);

                      // Haberin içeriğini al
                      const newsContentElement = newsPage('.icerik');

                      if (newsContentElement.length > 0) {
                        sourceUrl = newsUrl; // Kaynak URL'i güncelle

                        // Haberin başlığını al
                        const newsTitle = newsPage('h1').text().trim();
                        if (newsTitle) {
                          title = newsTitle; // Başlığı güncelle
                        }

                        // İşlemeye devam et - aşağıdaki kodlar çalışacak
                        console.log(`Kategori sayfasından haber içeriği alındı: ${title}`);

                        // İçeriği almak için içeriği değiştir
                        contentElement = newsContentElement;
                        currentPage = newsPage;
                      } else {
                        console.log('Haber sayfasında içerik bulunamadı, kategoriden devam ediliyor.');
                      }
                    } catch (newsError: any) {
                      console.error(`Haber sayfası alınırken hata: ${newsError.message}`);
                    }
                  }
                }

                if (contentElement.length > 0) {
                  // Konhaber sayfasının metaverilerini de kontrol et
                  let ogImage = currentPage('meta[property="og:image"]').attr('content');
                  if (ogImage) {
                    ogImage = formatUrl(ogImage, sourceUrl);
                    console.log(`Meta resminden resim URL'si bulundu: ${ogImage}`);
                  }

                  // Tüm içeriği bir metin olarak al
                  const mainText = contentElement.text().trim();

                  // Haberin yayınlanmış olduğu tam sayfadaki resim elementlerini bul
                  const pageImages: string[] = [];
                  currentPage('.havadis-resim img, .havadis-icerik img, .icerik img').each(function (this: cheerio.Element) {
                    const imgSrc = currentPage(this).attr('src');
                    if (imgSrc) {
                      const fullImageUrl = formatUrl(imgSrc, sourceUrl);
                      pageImages.push(fullImageUrl);
                    }
                  });

                  // İçerik içindeki resimleri bul
                  const contentImages: string[] = [];
                  contentElement.find('img').each(function (this: cheerio.Element) {
                    const imgSrc = currentPage(this).attr('src');
                    if (imgSrc) {
                      const fullImageUrl = formatUrl(imgSrc, sourceUrl);
                      contentImages.push(fullImageUrl);
                    }
                  });

                  console.log(`Konhaber içeriğinde ${contentImages.length} adet resim bulundu.`);
                  console.log(`Konhaber sayfasında toplam ${pageImages.length} adet resim bulundu.`);

                  // Tüm resimleri birleştir
                  const imageUrls = pageImages.length > contentImages.length ? pageImages : contentImages;

                  // Özel meta resmini ekle
                  if (ogImage && !imageUrls.includes(ogImage)) {
                    imageUrls.unshift(ogImage); // En başa ekle
                  }

                  if (imageUrls.length > 0) {
                    console.log(`İşlenecek resimler: ${imageUrls.length} adet.`);
                  }

                  // Metin parçalarını topla
                  const paragraphs: string[] = [];

                  // Spot içeriğini ekle
                  if (site.selectors.spotContent) {
                    const spotElement = currentPage(site.selectors.spotContent);
                    if (spotElement.length > 0) {
                      const spotText = spotElement.text().trim();
                      console.log('Spot içeriği bulundu, ana içeriğin başına ekleniyor...');
                      paragraphs.push(spotText);
                    }
                  }

                  // İlk resmi ekle
                  if (imageUrls.length > 0) {
                    paragraphs.push(`[${imageUrls[0]}]`);
                  }

                  // İçerik paragraflarını ayrıştır ve resimleri uygun yerlere ekle
                  const contentParagraphs: string[] = [];

                  // Paragrafları bul
                  contentElement.find('p').each(function (this: cheerio.Element) {
                    const pText = currentPage(this).text().trim();
                    if (pText && pText.length > 5) { // Çok kısa paragrafları atla
                      contentParagraphs.push(pText);
                    }
                  });

                  console.log(`${contentParagraphs.length} adet paragraf bulundu.`);

                  // Paragrafları ekle ve her birkaç paragraftan sonra bir resim yerleştir
                  if (contentParagraphs.length > 0) {
                    // İlk resmi zaten ekledik, diğer resimlerle devam et
                    let imageIndex = 1;

                    // Paragrafları düzenli aralıklarla ekle ve her 2-3 paragraf sonrasında bir resim ekle
                    for (let i = 0; i < contentParagraphs.length; i++) {
                      paragraphs.push(contentParagraphs[i]);

                      // Her 2 paragraftan sonra bir resim ekle (eğer varsa)
                      if ((i + 1) % 2 === 0 && imageIndex < imageUrls.length) {
                        paragraphs.push(`[${imageUrls[imageIndex]}]`);
                        imageIndex++;
                      }
                    }

                    // Kalan resimleri en sona ekle
                    while (imageIndex < imageUrls.length) {
                      paragraphs.push(`[${imageUrls[imageIndex]}]`);
                      imageIndex++;
                    }
                  } else {
                    // Paragraf bulunamadıysa, tüm içeriği ve resimleri ekle
                    paragraphs.push(mainText);

                    // İlk resmi zaten ekledik, kalan resimleri ekle
                    for (let i = 1; i < imageUrls.length; i++) {
                      paragraphs.push(`[${imageUrls[i]}]`);
                    }
                  }

                  // İçeriği oluştur
                  content = paragraphs.join('\n\n');
                  isTextOnly = true;
                  console.log(`Konhaber sitesinden metin ve resim içeriği alındı (${content.length} karakter).`);
                } else {
                  console.log(`Detay sayfasında içerik bulunamadı, başlığı içerik olarak kullanıyoruz.`);
                  content = title;
                  isTextOnly = true;
                }
              } else {
                // Diğer siteler için normal işlem
                // Detay sayfasında içerik alanını bul
                const contentElement = detailPage(site.selectors.detailContent || '');

                if (contentElement.length > 0) {
                  // Her zaman sadece metni al
                  content = contentElement.text().trim();
                  isTextOnly = true;

                  console.log(`İçerik bulundu (${content.length} karakter).`);
                } else {
                  console.log(`Detay sayfasında içerik bulunamadı, başlığı içerik olarak kullanıyoruz.`);
                  content = title;
                  isTextOnly = true;
                }
              }

              // İçeriği düzenle: Gereksiz boşlukları temizle
              if (isTextOnly) {
                content = content.replace(/\s+/g, ' ').trim();
              }

              // Resim bulunmadıysa detay sayfasından bulmaya çalış
              if (!imageUrl) {
                const detailImage = detailPage('meta[property="og:image"]').attr('content') ||
                  detailPage('.news-image img, .haber-image img, .article-image img').attr('src');
                if (detailImage) {
                  imageUrl = formatUrl(detailImage, sourceUrl);
                  console.log(`Detay sayfasından resim bulundu: ${imageUrl}`);
                }
              }
            } catch (detailError: any) {
              console.error(`Detay sayfası alınırken hata: ${detailError.message}`);
              // Detay alınamazsa başlığı içerik olarak kullan
              content = title;
              isTextOnly = true;
            }

            // En azından başlık ve link varsa kaydet
            if (title && sourceUrl) {
              // Haber verisini oluştur
              const newsData: Prisma.newsCreateInput = {
                title,
                content: content || title, // İçerik yoksa başlığı kullan
                source_url: sourceUrl,
                image_url: imageUrl || 'https://www.konyaspor.org.tr/images/logo.png', // Default logo
                published_date: publishedDate,
                sport: {
                  connect: { id: site.sportId }
                }
              };

              // Haberin daha önce eklenip eklenmediğini kontrol et
              const exists = await checkIfNewsExists(title, sourceUrl);

              if (!exists) {
                console.log(`Yeni haber ekleniyor: ${title}`);
                const result = await createNews(newsData);

                if (result.success) {
                  console.log(`Haber başarıyla eklendi! ID: ${result.id}`);
                  newsCount++;
                  totalAdded++;
                } else {
                  console.error(`Haber eklenirken hata: ${result.error}`);
                }
              } else {
                console.log(`Haber zaten mevcut: ${title}`);
              }

              totalProcessed++;
              processedArticleCount++;
            } else {
              console.log(`Element ${i}: Gerekli bilgiler eksik, atlanıyor.`);
            }

            // İki istek arasında bekleme süresi (rate limiting önlemi)
            await new Promise(resolve => setTimeout(resolve, 2000));

          } catch (itemError: any) {
            console.error(`Haber öğesi işlenirken hata: ${itemError.message}`);
          }
        }

        console.log(`${site.name} sitesinden ${newsCount} haber eklendi.`);

        // İki site arasında bekleme süresi
        await new Promise(resolve => setTimeout(resolve, 3000));

      } catch (siteError: any) {
        console.error(`${site.name} sitesinden haber çekerken hata: ${siteError.message}`);
      }
    }

    console.log(`Konyaspor haber işlemi tamamlandı. Toplam ${totalProcessed} haber işlendi, ${totalAdded} haber eklendi.`);
    return { processed: totalProcessed, added: totalAdded };

  } catch (error: any) {
    console.error('Konyaspor scraper genel hatası:', error.message);
    throw error;
  }
}

/**
 * Haberin daha önce eklenip eklenmediğini kontrol eder
 */
async function checkIfNewsExists(title: string, sourceUrl: string): Promise<boolean> {
  try {
    // Başlık veya kaynak URL ile haberi ara (direkt Prisma client kullanarak)
    const existingNews = await prisma.news.findFirst({
      where: {
        OR: [
          {
            title: {
              equals: title,
              mode: 'insensitive'
            }
          },
          {
            source_url: sourceUrl
          }
        ]
      }
    });

    return !!existingNews;
  } catch (error) {
    console.error('Haber kontrolü sırasında hata:', error);
    return false;
  }
}

/**
 * Haberi veritabanına ekler
 */
async function createNews(newsData: Prisma.newsCreateInput) {
  try {
    // Haberi oluştur
    const createdNews = await News.create(newsData);
    return {
      success: true,
      id: createdNews.id
    };
  } catch (error) {
    console.error('Haber oluşturma hatası:', error);
    return {
      success: false,
      error
    };
  }
}

// Script doğrudan çalıştırıldığında scraping işlemini başlat
if (require.main === module) {
  scrapeKonyasporNews().catch(error => {
    console.error('Konyaspor scraper çalıştırılırken hata:', error);
    process.exit(1);
  });
}
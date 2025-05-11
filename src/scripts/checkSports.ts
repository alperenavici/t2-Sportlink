import { supabase } from '../config/supabase';
import dotenv from 'dotenv';

dotenv.config();

async function checkSports() {
  console.log('Sports tablosunu kontrol ediyorum...');
  
  try {
    const { data, error } = await supabase
      .from('Sports')
      .select('*');
    
    if (error) {
      console.error('Sporlar listelenirken hata:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('Sports tablosunda hiç kayıt bulunamadı. Temel sporları ekliyorum...');
      await createSports();
    } else {
      console.log('Sports tablosunda bulunan kayıtlar:');
      data.forEach(sport => {
        console.log(`ID: ${sport.id}, Ad: ${sport.name}, Açıklama: ${sport.description}`);
      });
    }
  } catch (error) {
    console.error('Sports tablosu kontrolünde beklenmeyen hata:', error);
  }
}

async function createSports() {
  try {
    const sports = [
      {
        name: 'Futbol',
        description: 'Futbol ile ilgili haberler',
        icon: 'https://cdn-icons-png.flaticon.com/512/33/33736.png'
      },
      {
        name: 'Basketbol',
        description: 'Basketbol ile ilgili haberler',
        icon: 'https://cdn-icons-png.flaticon.com/512/33/33722.png'
      },
      {
        name: 'Voleybol',
        description: 'Voleybol ile ilgili haberler',
        icon: 'https://cdn-icons-png.flaticon.com/512/33/33682.png'
      },
      {
        name: 'Tenis',
        description: 'Tenis ile ilgili haberler',
        icon: 'https://cdn-icons-png.flaticon.com/512/33/33621.png'
      },
      {
        name: 'Yüzme',
        description: 'Yüzme ile ilgili haberler',
        icon: 'https://cdn-icons-png.flaticon.com/512/33/33707.png'
      }
    ];
    
    for (const sport of sports) {
      const { data, error } = await supabase
        .from('Sports')
        .insert(sport)
        .select();
      
      if (error) {
        console.error(`Spor eklenirken hata (${sport.name}):`, error);
      } else {
        console.log(`Spor başarıyla eklendi: ${sport.name}, ID: ${data[0].id}`);
      }
    }
    
    // Kontrol için tekrar listele
    const { data, error } = await supabase
      .from('Sports')
      .select('*');
    
    if (!error && data) {
      console.log('Eklenen sporlar:');
      data.forEach(sport => {
        console.log(`ID: ${sport.id}, Ad: ${sport.name}`);
      });
    }
  } catch (error) {
    console.error('Spor ekleme işleminde beklenmeyen hata:', error);
  }
}

// Scripti çalıştır
checkSports().then(() => {
  console.log('Sports tablosu kontrolü tamamlandı.');
  process.exit(0);
}).catch(error => {
  console.error('Script çalışırken hata:', error);
  process.exit(1);
}); 
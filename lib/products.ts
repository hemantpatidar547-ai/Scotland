import { Product } from '@/types/product';

const assetImages = [
  "13440498883859832.jpeg",
  "17+ Chic Italian Summer Outfit Ideas For Your Next Getaway.jpeg",
  "17451517303522631.jpeg",
  "844493674045206.jpeg",
  "Blue Check Shirt Outfit for Men _ Casual Korean Streetwear Style.jpeg",
  "Cozy Korean Casual Outfit 🤍.jpeg",
  "Dark Green Resort Shirt Outfit Inspiration for Effortless Summer Style.jpeg",
  "Effortless Street Style Outfit 🤎✨.jpeg",
  "Effortless Summer Linen Outfit for Boys_ trendy outfit ideas 2026.jpeg",
  "Italian Summer Linen Style for Men.jpeg",
  "Italian Vibezzzz 💸🍕.jpeg",
  "Japanese Street Fashion Outfit – Minimal & Trendy_.jpeg",
  "Korean Men Casual Outfit – Brown Striped Shirt Style.jpeg",
  "MEN FASHION.jpeg",
  "Minimal Campus Chic 🤍📚.jpeg",
  "Old Money Summer Outfit for Men 🍂 _ Minimal Luxury Street Style 2026.jpeg",
  "Old money Style.jpeg",
  "Relaxed Fit Mens Trousers.jpeg",
  "Sage Green Polo Shirt and Cream Trousers Outfit for Men.jpeg",
  "Viral Men’s Summer Outfit 2026 _ Casual Luxury Streetwear Ideas You Need to Try.jpeg",
  "korean outfit idea.jpeg",
  "【ONELYC1NS】Korean version of sweater na1641.jpeg",
  "カジュアル派の【バサッとフレアスカート】コーデ8選｜今っぽくかっこよく仕上げたい！ _ Oggi_jp.jpeg",
  "𝐊𝐈𝐎.jpeg"
];

function generateName ( filename: string )
{
  let name = filename.replace( /\.jpeg|\.png|\.jpg/g, '' );
  if ( name.length > 30 )
  {
    name = name.substring( 0, 30 ) + '...';
  }
  return name;
}

export const products: Product[] = assetImages.map( ( filename, index ) =>
{
  const name = generateName( filename );
  return {
    id: `p-asset-${ index }`,
    slug: `asset-product-${ index }`,
    name: name,
    shortDescription: 'From assets collection',
    description: `This product is generated from ${ filename }.`,
    category: 'Clothing',
    gender: 'Unisex',
    price: 9999,
    rating: 5,
    reviews: 100,
    image: `/assests/${ filename }`,
    images: [ `/assests/${ filename }` ],
    colors: [ 'Multi' ],
    sizes: [ 'S', 'M', 'L', 'XL' ],
    material: 'Various',
    stock: 100,
    styleOrigin: 'Various',
    occasion: 'Casual',
    isNew: true
  };
} );

export const findProduct = ( slug: string ) => products.find( p => p.slug === slug );

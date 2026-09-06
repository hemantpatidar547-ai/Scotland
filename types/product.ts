export type Category = 'Clothing' | 'Shoes' | 'Watches' | 'Belts' | 'Bags' | 'Accessories';
export type StyleOrigin = string;
export type Occasion = string;
export type Product = { id: string; slug: string; name: string; shortDescription: string; description: string; category: Category; gender: 'Men' | 'Women' | 'Unisex'; price: number; salePrice?: number; rating: number; reviews: number; image: string; images: string[]; colors: string[]; sizes: string[]; material: string; stock: number; styleOrigin: StyleOrigin; occasion: Occasion; isNew?: boolean; isBestSeller?: boolean; };

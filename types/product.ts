export type Category = string;
export type StyleOrigin = string;
export type Occasion = string;

export type Product = {
    id: string;
    slug: string;
    sku?: string;
    name: string;
    shortDescription?: string;
    description: string;
    updatedAt?: string;
    category: Category;
    subcategory?: string;
    gender: string;
    price: number;
    salePrice?: number;
    mrp?: number;
    cost_price?: number;
    discount?: number;
    gst?: string;
    rating: number;
    reviews: number;
    image: string;
    images: string[];
    colors: string[];
    sizes: string[];

    // Product Details
    material?: string;
    fabric?: string;
    fit?: string;
    pattern?: string;
    sleeve?: string;
    collar?: string;
    occasion?: Occasion;
    season?: string;
    styleOrigin?: StyleOrigin;

    // Inventory
    stock?: number;
    sizeStock?: Record<string, number>;
    inventoryVariants?: Array<{
        id: string;
        color: string;
        size: string;
        stockQuantity: number;
        sku?: string;
        price?: number;
        salePrice?: number;
    }>;
    stock_quantity?: number;
    low_stock_alert?: number;
    stock_status?: string;

    // Shipping
    weight?: string;
    dimensions?: string;
    cod?: boolean;

    // SEO
    seo_title?: string;
    meta_description?: string;
    focus_keyword?: string;
    canonical_url?: string;
    no_index?: boolean;
    image_alt_text?: string;
    brand_name?: string;
    gtin?: string;
    mpn?: string;
    tags?: string[];

    // Publishing
    status?: 'draft' | 'published';
    isNew?: boolean;
    isBestSeller?: boolean;
    best_seller?: boolean;
    featured?: boolean;

    // Size Chart
    size_chart?: string;
};

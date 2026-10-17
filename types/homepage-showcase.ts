export type HomepageShowcaseCard = {
    image: string;
    title: string;
    detail: string;
};

export type HomepageShowcase = {
    enabled: boolean;
    eyebrow: string;
    title: string;
    description: string;
    badge: string;
    cards: HomepageShowcaseCard[];
};

export const DEFAULT_HOMEPAGE_SHOWCASE: HomepageShowcase = {
    enabled: true,
    eyebrow: 'Discover the collection',
    title: 'Styles for every day.',
    description: 'Explore a growing collection of considered essentials, easy layers, and complete looks. New products and fresh styles are on the way.',
    badge: 'New styles arriving soon',
    cards: [
        { image: '/images/italian-looks/evening-knit-polo.jpeg', title: 'Sky blue breeze', detail: 'An airy sky blue button-up shirt, made for relaxed days and easy escapes.' },
        { image: '/images/italian-looks/lake-navy-polo.jpeg', title: 'Modern monochrome', detail: 'A textured knit polo with a contrasting collar and an effortlessly refined feel.' },
        { image: '/images/italian-looks/cafe-linen-set.jpeg', title: 'The linen edit', detail: 'A lightweight open-collar shirt and easy layers for a laid-back day.' },
        { image: '/images/italian-looks/green-resort-shirt.jpeg', title: 'Everyday in green', detail: 'A textured green shirt that brings a fresh note to your everyday wardrobe.' },
        { image: '/images/italian-looks/coastal-blue-shirt.jpeg', title: 'Classic tailoring', detail: 'A sharp, versatile look made to feel right from day to evening.' },
    ],
};

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PropertyDetailClient from './PropertyDetailClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

interface PageProps {
    params: Promise<{ id: string }>;
}

async function getPropertyData(id: string) {
    try {
        const res = await fetch(`${API_URL}/properties/${id}`, {
            cache: 'no-store', // ensures we fetch fresh data
        });
        if (!res.ok) {
            if (res.status === 404) {
                return null;
            }
            console.error(`Failed to fetch property ${id}: ${res.statusText}`);
            return null;
        }
        return res.json();
    } catch (error) {
        console.error(`Fetch error for property ${id}:`, error);
        return null;
    }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id } = await params;
    const property = await getPropertyData(id);

    if (!property) {
        return {
            title: 'Property Not Found - Roomivo',
            description: 'The requested property could not be found on Roomivo.',
        };
    }

    const title = `${property.title} | Roomivo`;
    const description = property.description || `Rent this beautiful ${property.property_type} in ${property.city} for €${property.monthly_rent}/month.`;
    
    // Resolve cover photo
    let ogImage = '';
    const photos = Array.isArray(property.photos) ? property.photos : property.photos?.urls ? property.photos.urls.map((url: string) => ({ url })) : [];
    if (photos.length > 0) {
        const firstPhoto = photos[0];
        const rawUrl = firstPhoto.url || firstPhoto;
        if (rawUrl) {
            if (rawUrl.startsWith('http')) {
                ogImage = rawUrl;
            } else {
                ogImage = `${API_URL}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
            }
        }
    }

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            type: 'website',
            images: ogImage ? [{ url: ogImage }] : [],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: ogImage ? [ogImage] : [],
        },
    };
}

export default async function PropertyDetailPage({ params }: PageProps) {
    const { id } = await params;
    const property = await getPropertyData(id);

    if (!property) {
        notFound();
    }

    // Prepare JSON-LD structured data
    const schemaType = property.property_type === 'house' ? 'House' : 'Apartment';
    
    let jsonLdPhotos: string[] = [];
    const photos = Array.isArray(property.photos) ? property.photos : property.photos?.urls ? property.photos.urls.map((url: string) => ({ url })) : [];
    if (photos.length > 0) {
        jsonLdPhotos = photos.map((p: any) => {
            const rawUrl = p.url || p;
            return rawUrl.startsWith('http') ? rawUrl : `${API_URL}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
        }).filter(Boolean);
    }

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': schemaType,
        'name': property.title,
        'description': property.description,
        'image': jsonLdPhotos,
        'numberOfRooms': property.bedrooms,
        'floorSize': {
            '@type': 'QuantitativeValue',
            'value': property.size_sqm,
            'unitCode': 'MTK'
        },
        'address': {
            '@type': 'PostalAddress',
            'streetAddress': [property.address_line1, property.address_line2].filter(Boolean).join(', '),
            'addressLocality': property.city,
            'postalCode': property.postal_code,
            'addressCountry': property.country
        },
        'offers': {
            '@type': 'Offer',
            'price': property.monthly_rent,
            'priceCurrency': 'EUR',
            'priceSpecification': {
                '@type': 'UnitPriceSpecification',
                'price': property.monthly_rent,
                'priceCurrency': 'EUR',
                'referenceQuantity': {
                    '@type': 'QuantitativeValue',
                    'value': 1,
                    'unitCode': 'MON'
                }
            }
        }
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
            />
            <PropertyDetailClient initialProperty={property} />
        </>
    );
}

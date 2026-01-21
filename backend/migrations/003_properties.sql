-- Property Listings Database Migration
-- Run this SQL to create all required tables

-- Properties table
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    landlord_id UUID NOT NULL REFERENCES users(id),
    
    -- Basic Info
    title VARCHAR(200) NOT NULL,
    description TEXT,
    property_type VARCHAR(50),
    
    -- Location
    address_line1 VARCHAR(200) NOT NULL,
    address_line2 VARCHAR(200),
    city VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) DEFAULT 'France',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Details
    bedrooms INTEGER NOT NULL,
    bathrooms DECIMAL(3,1),
    size_sqm DECIMAL(8,2),
    floor_number INTEGER,
    furnished BOOLEAN DEFAULT FALSE,
    
    -- Pricing
    monthly_rent DECIMAL(10,2) NOT NULL,
    deposit DECIMAL(10,2),
    charges DECIMAL(10,2),
    
    -- Availability
    available_from DATE,
    lease_duration_months INTEGER,
    
    -- Features  
    amenities JSONB,
    photos JSONB,
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft',
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    published_at TIMESTAMP,
    views_count INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_properties_landlord ON properties(landlord_id);
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_rent ON properties(monthly_rent);

-- Property Media Sessions table
CREATE TABLE IF NOT EXISTS property_media_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    
    verification_code VARCHAR(50) UNIQUE NOT NULL,
    generated_by UUID NOT NULL REFERENCES users(id),
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    
    target_address TEXT,
    target_latitude DECIMAL(10, 8),
    target_longitude DECIMAL(11, 8),
    gps_radius_meters INTEGER DEFAULT 500,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_sessions_code ON property_media_sessions(verification_code);
CREATE INDEX IF NOT EXISTS idx_media_sessions_property ON property_media_sessions(property_id);

-- Property Media table
CREATE TABLE IF NOT EXISTS property_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    session_id UUID REFERENCES property_media_sessions(id),
    
    media_type VARCHAR(20),
    file_url TEXT NOT NULL,
    file_size INTEGER,
    order_index INTEGER DEFAULT 0,
    is_cover BOOLEAN DEFAULT FALSE,
    
    captured_latitude DECIMAL(10, 8),
    captured_longitude DECIMAL(11, 8),
    distance_from_target DECIMAL(8,2),
    captured_at TIMESTAMP,
    device_id VARCHAR(100),
    
    watermark_address TEXT,
    
    verification_status VARCHAR(20) DEFAULT 'verified',
    verified_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_media_property ON property_media(property_id);
CREATE INDEX IF NOT EXISTS idx_property_media_session ON property_media(session_id);

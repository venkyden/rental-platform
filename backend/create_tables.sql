-- Create enum types
CREATE TYPE userrole AS ENUM ('tenant', 'landlord', 'property_manager', 'admin');
CREATE TYPE verificationstatus AS ENUM ('pending', 'verified', 'failed', 'expired');

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR UNIQUE NOT NULL,
    hashed_password VARCHAR NOT NULL,
    role userrole NOT NULL,
    full_name VARCHAR,
    phone VARCHAR,
    email_verified BOOLEAN DEFAULT FALSE,
    identity_verified BOOLEAN DEFAULT FALSE,
    employment_verified BOOLEAN DEFAULT FALSE,
    identity_data JSONB,
    employment_data JSONB,
    trust_score INTEGER DEFAULT 0,
    risk_tier VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX ix_users_email ON users(email);

-- Create verification_records table
CREATE TABLE verification_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    verification_type VARCHAR NOT NULL,
    status verificationstatus NOT NULL,
    confidence_score INTEGER,
    verification_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX ix_verification_records_user_id ON verification_records(user_id);

-- Create property_manager_access table
CREATE TABLE property_manager_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_manager_id UUID NOT NULL,
    landlord_id UUID NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    management_fee_percentage VARCHAR,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP,
    notes VARCHAR
);

CREATE INDEX ix_pm_access_property_manager_id ON property_manager_access(property_manager_id);
CREATE INDEX ix_pm_access_landlord_id ON property_manager_access(landlord_id);
